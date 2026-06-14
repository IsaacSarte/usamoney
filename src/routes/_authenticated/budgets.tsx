import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listBudgets, upsertBudget, deleteBudget } from "@/lib/budgets.functions";
import { listCategories } from "@/lib/categories.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { peso, monthKey } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { listTransactions } from "@/lib/transactions.functions";
import { useMonth } from "@/lib/month-context";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/budgets")({
  head: () => ({ meta: [{ title: "Budgets — Usamoney" }] }),
  component: BudgetsPage,
});

function BudgetsPage() {
  const qc = useQueryClient();
  const { month: selectedMonth, label: monthLabel } = useMonth();
  const cats = useQuery({ queryKey: ["categories"], queryFn: () => listCategories() });
  const budgets = useQuery({ queryKey: ["budgets"], queryFn: () => listBudgets() });
  const txs = useQuery({ queryKey: ["transactions"], queryFn: () => listTransactions() });
  const upsert = useServerFn(upsertBudget);
  const del = useServerFn(deleteBudget);
  const [categoryId, setCategoryId] = useState("");
  const [limit, setLimit] = useState("");

  const upMut = useMutation({
    mutationFn: () => upsert({ data: { category_id: categoryId, monthly_limit: parseFloat(limit) } }),
    onSuccess: () => { toast.success("Saved"); setLimit(""); qc.invalidateQueries({ queryKey: ["budgets"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgets"] }),
  });

  const expenseCats = (cats.data ?? []).filter((c) => c.kind === "expense");
  const catMap = new Map((cats.data ?? []).map((c) => [c.id, c]));
  const monthTxs = (txs.data ?? []).filter((t) => monthKey(t.occurred_on) === selectedMonth);

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card>
        <CardHeader><CardTitle>Set monthly budget</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); if (categoryId && limit) upMut.mutate(); }} className="space-y-3">
            <div>
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>
                  {expenseCats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Monthly limit (₱)</Label>
              <Input type="number" step="0.01" min="0" value={limit} onChange={(e) => setLimit(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={upMut.isPending}>Save</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            Active budgets
            <span className="ml-2 text-sm font-normal text-muted-foreground">{monthLabel}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(budgets.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No budgets yet.</p>
          ) : (
            <ul className="divide-y">
              {(budgets.data ?? []).map((b) => {
                const spent = monthTxs
                  .filter((t) => t.kind === "expense" && t.category_id === b.category_id)
                  .reduce((s, t) => s + t.amount, 0);
                const pct = b.monthly_limit > 0 ? Math.min(100, (spent / b.monthly_limit) * 100) : 0;
                const over = spent > b.monthly_limit;
                return (
                  <li key={b.id} className="py-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{catMap.get(b.category_id)?.name ?? "—"}</div>
                        <div className={`text-xs ${over ? "text-destructive" : "text-muted-foreground"}`}>
                          {peso(spent)} / {peso(b.monthly_limit)}
                        </div>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => delMut.mutate(b.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Progress value={pct} className="mt-2" />
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}