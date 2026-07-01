import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listTransactions } from "@/lib/transactions.functions";
import { listCategories } from "@/lib/categories.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { peso, monthKey } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/totals")({
  head: () => ({ meta: [{ title: "Totals — Usamoney" }] }),
  component: TotalsPage,
});

function TotalsPage() {
  const txs = useQuery({ queryKey: ["transactions"], queryFn: () => listTransactions() });
  const cats = useQuery({ queryKey: ["categories"], queryFn: () => listCategories() });
  const transactions = txs.data ?? [];
  const categories = cats.data ?? [];

  let income = 0;
  let expense = 0;
  const months = new Set<string>();
  const byCat = new Map<string, { name: string; kind: "income" | "expense"; total: number }>();
  const catMap = new Map(categories.map((c) => [c.id, c]));

  for (const t of transactions) {
    months.add(monthKey(t.occurred_on));
    if (t.kind === "income") income += t.amount;
    else expense += t.amount;
    const key = t.category_id ?? `__none_${t.kind}`;
    const name = (t.category_id && catMap.get(t.category_id)?.name) || "Uncategorized";
    const row = byCat.get(key) ?? { name, kind: t.kind, total: 0 };
    row.total += t.amount;
    byCat.set(key, row);
  }

  const balance = income - expense;
  const catRows = Array.from(byCat.values()).sort((a, b) => b.total - a.total);

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>All-time totals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Total income" value={peso(income)} tone="income" />
            <Stat label="Total expense" value={peso(expense)} tone="expense" />
            <Stat
              label="Net balance"
              value={peso(balance)}
              tone={balance >= 0 ? "income" : "expense"}
            />
          </div>
          <div className="mt-4 text-xs text-muted-foreground">
            Across {months.size} month{months.size === 1 ? "" : "s"} · {transactions.length} transaction
            {transactions.length === 1 ? "" : "s"}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By category (all time)</CardTitle>
        </CardHeader>
        <CardContent>
          {catRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <ul className="divide-y">
              {catRows.map((r, i) => (
                <li key={i} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">{r.kind}</div>
                  </div>
                  <span
                    className={
                      r.kind === "income"
                        ? "text-[color:var(--income)] font-medium"
                        : "text-[color:var(--expense)] font-medium"
                    }
                  >
                    {r.kind === "income" ? "+" : "-"}
                    {peso(r.total)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "income" | "expense";
}) {
  return (
    <div className="rounded-2xl bg-[color:var(--primary-soft)]/40 p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={
          tone === "income"
            ? "mt-1 text-2xl font-semibold text-[color:var(--income)]"
            : "mt-1 text-2xl font-semibold text-[color:var(--expense)]"
        }
      >
        {value}
      </div>
    </div>
  );
}