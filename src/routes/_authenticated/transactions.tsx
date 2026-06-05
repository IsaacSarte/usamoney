import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTransactions, createTransaction, deleteTransaction } from "@/lib/transactions.functions";
import { listCategories } from "@/lib/categories.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { peso, todayISO } from "@/lib/format";
import { Trash2, Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({ meta: [{ title: "Transactions — Piso Tracker" }] }),
  component: TransactionsPage,
});

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
        <CardHeader><CardTitle>Add transaction</CardTitle></CardHeader>
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
            <Button type="submit" className="w-full" disabled={createMut.isPending}>Add</Button>
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