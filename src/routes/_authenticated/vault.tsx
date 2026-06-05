import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getVaultMeta,
  setVaultMeta,
  listVaultItems,
  upsertVaultItem,
  deleteVaultItem,
} from "@/lib/vault.functions";
import {
  deriveKey,
  encryptString,
  decryptString,
  randomSaltB64,
  VERIFIER_PLAINTEXT,
} from "@/lib/vault-crypto";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Lock, ShieldAlert, Eye, EyeOff, Trash2, Plus, LockKeyhole } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vault")({
  head: () => ({ meta: [{ title: "Vault — Piso Tracker" }] }),
  component: VaultPage,
});

type VaultItem = {
  id: string;
  label: string;
  item_type: string;
  iv: string;
  ciphertext: string;
  updated_at: string;
};

const ITEM_TYPES = [
  { value: "bank", label: "Bank account" },
  { value: "loan", label: "Loan / credit" },
  { value: "card", label: "Card" },
  { value: "note", label: "Secure note" },
] as const;

function VaultPage() {
  const meta = useQuery({ queryKey: ["vault-meta"], queryFn: () => getVaultMeta() });
  const [key, setKey] = useState<CryptoKey | null>(null);

  // Auto-lock when leaving the page
  useEffect(() => () => setKey(null), []);
  useEffect(() => {
    const onHide = () => setKey(null);
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  if (meta.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading vault…</p>;
  }

  if (!meta.data) {
    return <SetupVault onReady={(k) => { setKey(k); meta.refetch(); }} />;
  }

  if (!key) {
    return <UnlockVault meta={meta.data} onUnlock={setKey} />;
  }

  return <VaultContents cryptoKey={key} onLock={() => setKey(null)} />;
}

function SetupVault({ onReady }: { onReady: (k: CryptoKey) => void }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const save = useServerFn(setVaultMeta);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return toast.error("Use at least 8 characters");
    if (pw !== pw2) return toast.error("Passwords don't match");
    setBusy(true);
    try {
      const salt = randomSaltB64();
      const k = await deriveKey(pw, salt);
      const { iv, ciphertext } = await encryptString(k, VERIFIER_PLAINTEXT);
      await save({ data: { salt, verifier_iv: iv, verifier_ciphertext: ciphertext } });
      toast.success("Vault created");
      onReady(k);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create vault");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-primary" />
          Set up your vault
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Your vault is encrypted in your browser with a master password. We never
          see it — <strong>if you forget it, your data cannot be recovered.</strong>
        </p>
        <form onSubmit={onCreate} className="space-y-3">
          <div className="space-y-1">
            <Label>Master password</Label>
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1">
            <Label>Confirm password</Label>
            <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            <Lock className="mr-2 h-4 w-4" />
            {busy ? "Creating…" : "Create vault"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function UnlockVault({
  meta,
  onUnlock,
}: {
  meta: { salt: string; verifier_iv: string; verifier_ciphertext: string };
  onUnlock: (k: CryptoKey) => void;
}) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const k = await deriveKey(pw, meta.salt);
      const v = await decryptString(k, meta.verifier_iv, meta.verifier_ciphertext);
      if (v !== VERIFIER_PLAINTEXT) throw new Error("Wrong password");
      onUnlock(k);
    } catch {
      toast.error("Wrong password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LockKeyhole className="h-5 w-5 text-primary" /> Unlock vault
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label>Master password</Label>
            <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Unlocking…" : "Unlock"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function VaultContents({ cryptoKey, onLock }: { cryptoKey: CryptoKey; onLock: () => void }) {
  const qc = useQueryClient();
  const items = useQuery({ queryKey: ["vault-items"], queryFn: () => listVaultItems() });
  const upsert = useServerFn(upsertVaultItem);
  const del = useServerFn(deleteVaultItem);

  const [label, setLabel] = useState("");
  const [itemType, setItemType] = useState<string>("bank");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function resetForm() {
    setLabel("");
    setItemType("bank");
    setContent("");
    setEditingId(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !content.trim()) return toast.error("Label and content required");
    setBusy(true);
    try {
      const { iv, ciphertext } = await encryptString(cryptoKey, content);
      await upsert({
        data: {
          id: editingId ?? undefined,
          label: label.trim(),
          item_type: itemType,
          iv,
          ciphertext,
        },
      });
      toast.success(editingId ? "Updated" : "Saved");
      resetForm();
      qc.invalidateQueries({ queryKey: ["vault-items"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function onEdit(item: VaultItem) {
    try {
      const plain = await decryptString(cryptoKey, item.iv, item.ciphertext);
      setEditingId(item.id);
      setLabel(item.label);
      setItemType(item.item_type);
      setContent(plain);
    } catch {
      toast.error("Failed to decrypt");
    }
  }

  async function onDelete(id: string) {
    await del({ data: { id } });
    if (editingId === id) resetForm();
    qc.invalidateQueries({ queryKey: ["vault-items"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Vault</h1>
          <p className="text-sm text-muted-foreground">
            End-to-end encrypted. Auto-locks when you leave this page.
          </p>
        </div>
        <Button variant="secondary" onClick={onLock}>
          <Lock className="mr-2 h-4 w-4" /> Lock
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {editingId ? "Edit item" : "Add new item"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Label</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. BPI Savings" />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={itemType} onValueChange={setItemType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ITEM_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Encrypted content</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Account number, loan reference, notes…"
                rows={4}
              />
            </div>
            <div className="flex gap-2 md:col-span-2">
              <Button type="submit" disabled={busy}>
                <Plus className="mr-2 h-4 w-4" />
                {busy ? "Saving…" : editingId ? "Update" : "Save"}
              </Button>
              {editingId && (
                <Button type="button" variant="ghost" onClick={resetForm}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Stored items</CardTitle></CardHeader>
        <CardContent>
          {items.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (items.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing stored yet.</p>
          ) : (
            <ul className="divide-y">
              {items.data!.map((it) => (
                <VaultRow
                  key={it.id}
                  item={it}
                  cryptoKey={cryptoKey}
                  onEdit={() => onEdit(it)}
                  onDelete={() => onDelete(it.id)}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function VaultRow({
  item,
  cryptoKey,
  onEdit,
  onDelete,
}: {
  item: VaultItem;
  cryptoKey: CryptoKey;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const typeLabel = useMemo(
    () => ITEM_TYPES.find((t) => t.value === item.item_type)?.label ?? item.item_type,
    [item.item_type],
  );

  async function toggle() {
    if (revealed) return setRevealed(null);
    try {
      const plain = await decryptString(cryptoKey, item.iv, item.ciphertext);
      setRevealed(plain);
    } catch {
      toast.error("Failed to decrypt");
    }
  }

  return (
    <li className="py-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-medium">{item.label}</div>
          <div className="text-xs text-muted-foreground">{typeLabel}</div>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={toggle}>
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={onEdit}>Edit</Button>
          <Button size="icon" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {revealed && (
        <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{revealed}</pre>
      )}
    </li>
  );
}