import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTransactions, createTransaction, deleteTransaction } from "@/lib/transactions.functions";
import { listCategories } from "@/lib/categories.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { peso, todayISO } from "@/lib/format";
import { Trash2, Download, Clock, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({ meta: [{ title: "Transactions — Piso Tracker" }] }),
  component: TransactionsPage,
});

type QueuedTx = {
  id: string;
  kind: "income" | "expense";
  amount: number;
  category_id: string | null;
  occurred_on: string;
  note: string | null;
};

const QUEUE_KEY = "piso.queuedTransactions.v1";

function loadQueue(): QueuedTx[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]"); } catch { return []; }
}
function saveQueue(q: QueuedTx[]) {
  if (typeof window !== "undefined") localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

function TransactionsPage() {
  const qc = useQueryClient();
  const txs = useQuery({ queryKey: ["transactions"], queryFn: () => listTransactions() });
  const cats = useQuery({ queryKey: ["categories"], queryFn: () => listCategories() });
  const create = useServerFn(createTransaction);
  const del = useServerFn(deleteTransaction);

  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [queue, setQueue] = useState<QueuedTx[]>([]);
  const [queueOpen, setQueueOpen] = useState(false);
  const [pushing, setPushing] = useState(false);

  useEffect(() => { setQueue(loadQueue()); }, []);

  const createMut = useMutation({
    mutationFn: () => create({ data: {
      kind, amount: parseFloat(amount), category_id: categoryId || null,
      occurred_on: date, note: note || null,
    } }),
    onSuccess: () => {
      toast.success("Saved");
      setAmount(""); setNote("");
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });

  const queueNow = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error("Enter an amount"); return; }
    const item: QueuedTx = {
      id: crypto.randomUUID(),
      kind, amount: amt,
      category_id: categoryId || null,
      occurred_on: date, note: note || null,
    };
    const next = [item, ...queue];
    setQueue(next); saveQueue(next);
    setAmount(""); setNote("");
    toast.success("Queued");
  };

  const removeQueued = (id: string) => {
    const next = queue.filter((q) => q.id !== id);
    setQueue(next); saveQueue(next);
  };

  const pushOne = async (item: QueuedTx) => {
    await create({ data: {
      kind: item.kind, amount: item.amount, category_id: item.category_id,
      occurred_on: item.occurred_on, note: item.note,
    } });
    removeQueued(item.id);
  };

  const pushAll = async () => {
    if (queue.length === 0) return;
    setPushing(true);
    let ok = 0, fail = 0;
    const remaining: QueuedTx[] = [];
    for (const item of queue) {
      try {
        await create({ data: {
          kind: item.kind, amount: item.amount, category_id: item.category_id,
          occurred_on: item.occurred_on, note: item.note,
        } });
        ok++;
      } catch { fail++; remaining.push(item); }
    }
    setQueue(remaining); saveQueue(remaining);
    qc.invalidateQueries({ queryKey: ["transactions"] });
    setPushing(false);
    if (ok) toast.success(`Posted ${ok} transaction${ok > 1 ? "s" : ""}`);
    if (fail) toast.error(`${fail} failed`);
    if (!fail) setQueueOpen(false);
  };

  const categories = cats.data ?? [];
  const visibleCats = categories.filter((c) => c.kind === kind);
  const transactions = txs.data ?? [];
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const exportCsv = () => {
    const rows = [["Date","Type","Category","Amount","Note"]];
    transactions.forEach((t) => rows.push([
      t.occurred_on, t.kind,
      (t.category_id && catMap.get(t.category_id)?.name) || "",
      String(t.amount), (t.note ?? "").replace(/"/g, '""'),
    ]));
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "transactions.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Add transaction</CardTitle>
          <Dialog open={queueOpen} onOpenChange={setQueueOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full">
                <Clock className="mr-2 h-4 w-4" />Queue ({queue.length})
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Queued transactions</DialogTitle></DialogHeader>
              {queue.length === 0 ? (
                <p className="text-sm text-muted-foreground">No queued transactions.</p>
              ) : (
                <>
                  <ul className="divide-y max-h-80 overflow-auto">
                    {queue.map((q) => (
                      <li key={q.id} className="flex items-center justify-between py-2 text-sm">
                        <div>
                          <div className="font-medium">
                            {(q.category_id && catMap.get(q.category_id)?.name) || "Uncategorized"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {q.occurred_on}{q.note ? ` · ${q.note}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={q.kind === "income" ? "text-[color:var(--income)] font-medium" : "text-[color:var(--expense)] font-medium"}>
                            {q.kind === "income" ? "+" : "-"}{peso(q.amount)}
                          </span>
                          <Button size="icon" variant="ghost" onClick={() => pushOne(q).then(() => qc.invalidateQueries({ queryKey: ["transactions"] })).catch((e) => toast.error(e instanceof Error ? e.message : "Failed"))}>
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => removeQueued(q.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <Button onClick={pushAll} disabled={pushing} className="w-full rounded-full">
                    <Send className="mr-2 h-4 w-4" />Display all now
                  </Button>
                </>
              )}
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }} className="space-y-3">
            <div>
              <Label>Type</Label>
              <Select value={kind} onValueChange={(v) => { setKind(v as any); setCategoryId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (₱)</Label>
              <Input type="number" step="0.01" min="0" required value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>
                  {visibleCats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Note</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={createMut.isPending}>Add</Button>
              <Button type="button" variant="outline" onClick={queueNow}>
                <Clock className="mr-2 h-4 w-4" />Queue
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All transactions</CardTitle>
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />CSV</Button>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <ul className="divide-y">
              {transactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <div className="font-medium">{(t.category_id && catMap.get(t.category_id)?.name) || "Uncategorized"}</div>
                    <div className="text-xs text-muted-foreground">{t.occurred_on}{t.note ? ` · ${t.note}` : ""}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={t.kind === "income" ? "text-[color:var(--income)] font-medium" : "text-[color:var(--expense)] font-medium"}>
                      {t.kind === "income" ? "+" : "-"}{peso(t.amount)}
                    </span>
                    <Button size="icon" variant="ghost" onClick={() => delMut.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}