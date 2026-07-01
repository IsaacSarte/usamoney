import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listTransactions } from "@/lib/transactions.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { peso, monthKey } from "@/lib/format";
import { useMonth } from "@/lib/month-context";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "History — Usamoney" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const { setMonth, month: current } = useMonth();
  const txs = useQuery({ queryKey: ["transactions"], queryFn: () => listTransactions() });
  const transactions = txs.data ?? [];

  const byMonth = new Map<string, { income: number; expense: number; count: number }>();
  for (const t of transactions) {
    const k = monthKey(t.occurred_on);
    const row = byMonth.get(k) ?? { income: 0, expense: 0, count: 0 };
    if (t.kind === "income") row.income += t.amount;
    else row.expense += t.amount;
    row.count += 1;
    byMonth.set(k, row);
  }

  const months = Array.from(byMonth.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([m, v]) => ({
      month: m,
      label: new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1))
        .toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
      ...v,
      balance: v.income - v.expense,
    }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly history</CardTitle>
      </CardHeader>
      <CardContent>
        {months.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transactions yet.</p>
        ) : (
          <ul className="divide-y">
            {months.map((m) => (
              <li key={m.month} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <div className="font-medium">
                    {m.label}
                    {m.month === current && (
                      <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        selected
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {m.count} transaction{m.count === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Income</div>
                    <div className="text-[color:var(--income)]">{peso(m.income)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Expense</div>
                    <div className="text-[color:var(--expense)]">{peso(m.expense)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Balance</div>
                    <div className={m.balance >= 0 ? "text-primary font-medium" : "text-destructive font-medium"}>
                      {peso(m.balance)}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setMonth(m.month)}>
                    View
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}