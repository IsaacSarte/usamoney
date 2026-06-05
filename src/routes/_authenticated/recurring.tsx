import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listRecurring,
  createRecurring,
  deleteRecurring,
  materializeDue,
} from "@/lib/recurring.functions";
import { listCategories } from "@/lib/categories.functions";
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
import { Trash2, RefreshCcw, Plus } from "lucide-react";
import { toast } from "sonner";
import { peso, todayISO } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/recurring")({
  head: () => ({ meta: [{ title: "Recurring — Piso Tracker" }] }),
  component: RecurringPage,
});

type Freq = "daily" | "weekly" | "monthly" | "yearly";
type Kind = "income" | "expense";

function RecurringPage() {
  const qc = useQueryClient();
  const rules = useQuery({ queryKey: ["recurring"], queryFn: () => listRecurring() });
  const cats = useQuery({ queryKey: ["categories"], queryFn: () => listCategories() });

  const createFn = useServerFn(createRecurring);
  const delFn = useServerFn(deleteRecurring);
  const runFn = useServerFn(materializeDue);

  const createMut = useMutation({
    mutationFn: (v: {
      kind: Kind;
      amount: number;
      category_id: string | null;
      frequency: Freq;
      start_on: string;
      end_on: string | null;
      note: string | null;
    }) => createFn({ data: v }),
    onSuccess: () => {
      toast.success("Recurring rule added");
      qc.invalidateQueries({ queryKey: ["recurring"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring"] }),
  });
  const runMut = useMutation({
    mutationFn: () => runFn(),
    onSuccess: (r) => {
      toast.success(`Generated ${r.created} transaction${r.created === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["recurring"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const [kind, setKind] = useState<Kind>("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [frequency, setFrequency] = useState<Freq>("monthly");
  const [startOn, setStartOn] = useState(todayISO());
  const [endOn, setEndOn] = useState("");
  const [note, setNote] = useState("");

  const categoryOptions = (cats.data ?? []).filter((c) => c.kind === kind);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return toast.error("Enter an amount");
    createMut.mutate({
      kind,
      amount: amt,
      category_id: categoryId || null,
      frequency,
      start_on: startOn,
      end_on: endOn || null,
      note: note.trim() || null,
    });
    setAmount("");
    setNote("");
  }

  const catName = (id: string | null | undefined) =>
    cats.data?.find((c) => c.id === id)?.name ?? "Uncategorized";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Recurring</h1>
          <p className="text-sm text-muted-foreground">
            Automate repeating income and expenses.
          </p>
        </div>
        <Button onClick={() => runMut.mutate()} disabled={runMut.isPending} variant="secondary">
          <RefreshCcw className="mr-2 h-4 w-4" />
          {runMut.isPending ? "Running…" : "Run due now"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New recurring rule</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={kind} onValueChange={(v) => { setKind(v as Kind); setCategoryId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Amount (₱)</Label>
              <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as Freq)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Start</Label>
              <Input type="date" value={startOn} onChange={(e) => setStartOn(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>End (optional)</Label>
              <Input type="date" value={endOn} onChange={(e) => setEndOn(e.target.value)} />
            </div>
            <div className="space-y-1 md:col-span-3">
              <Label>Note</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Netflix subscription" rows={2} />
            </div>
            <div className="md:col-span-3">
              <Button type="submit" disabled={createMut.isPending}>
                <Plus className="mr-2 h-4 w-4" /> Add rule
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Active rules</CardTitle></CardHeader>
        <CardContent>
          {rules.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (rules.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No recurring rules yet.</p>
          ) : (
            <ul className="divide-y">
              {rules.data!.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-3 text-sm">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className={r.kind === "income" ? "font-medium text-emerald-600" : "font-medium text-rose-600"}>
                        {r.kind === "income" ? "+" : "-"}{peso(r.amount)}
                      </span>
                      <span className="text-muted-foreground">· {r.frequency} · {catName(r.category_id)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Next: {r.next_run_on}{r.end_on ? ` · ends ${r.end_on}` : ""}
                      {r.note ? ` · ${r.note}` : ""}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => delMut.mutate(r.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}