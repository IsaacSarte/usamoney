import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTransactions } from "@/lib/transactions.functions";
import { listCategories } from "@/lib/categories.functions";
import { listBudgets } from "@/lib/budgets.functions";
import { materializeDue } from "@/lib/recurring.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { peso, monthKey } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Piso Tracker" }] }),
  component: Dashboard,
});

function Dashboard() {
  const qc = useQueryClient();
  const materialize = useServerFn(materializeDue);
  const txs = useQuery({ queryKey: ["transactions"], queryFn: () => listTransactions() });
  const cats = useQuery({ queryKey: ["categories"], queryFn: () => listCategories() });
  const budgets = useQuery({ queryKey: ["budgets"], queryFn: () => listBudgets() });

  useEffect(() => {
    materialize().then((r) => {
      if (r.created > 0) {
        qc.invalidateQueries({ queryKey: ["transactions"] });
      }
    }).catch(() => {});
  }, [materialize, qc]);

  const transactions = txs.data ?? [];
  const categories = cats.data ?? [];
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const now = new Date();
  const thisMonth = monthKey(now);

  const monthTxs = transactions.filter((t) => monthKey(t.occurred_on) === thisMonth);
  const income = monthTxs.filter((t) => t.kind === "income").reduce((s, t) => s + t.amount, 0);
  const expense = monthTxs.filter((t) => t.kind === "expense").reduce((s, t) => s + t.amount, 0);

  // last 6 months
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(monthKey(d));
  }
  const monthly = months.map((m) => {
    const inc = transactions.filter((t) => t.kind === "income" && monthKey(t.occurred_on) === m).reduce((s, t) => s + t.amount, 0);
    const exp = transactions.filter((t) => t.kind === "expense" && monthKey(t.occurred_on) === m).reduce((s, t) => s + t.amount, 0);
    return { month: m.slice(5), income: inc, expense: exp };
  });

  // expense breakdown this month
  const expByCat = new Map<string, number>();
  monthTxs.filter((t) => t.kind === "expense").forEach((t) => {
    const name = (t.category_id && catMap.get(t.category_id)?.name) || "Uncategorized";
    expByCat.set(name, (expByCat.get(name) ?? 0) + t.amount);
  });
  const pieData = Array.from(expByCat.entries()).map(([name, value]) => ({ name, value }));
  // Candy palette matching the reference shot: mint, purple, pink, peach, coral, lilac.
  const pieColors = ["#7ad3c5", "#7c5cff", "#f48fb1", "#ffb38a", "#ff7a7a", "#b39ddb", "#80deea", "#ffd180"];

  // budget progress
  const budgetRows = (budgets.data ?? []).map((b) => {
    const cat = catMap.get(b.category_id);
    const spent = monthTxs.filter((t) => t.kind === "expense" && t.category_id === b.category_id).reduce((s, t) => s + t.amount, 0);
    return { id: b.id, name: cat?.name ?? "—", limit: b.monthly_limit, spent };
  });

  const recent = transactions.slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Balance</h1>
        <p className="text-4xl font-semibold text-primary mt-1">{peso(income - expense)}</p>
        <p className="text-sm text-muted-foreground mt-1">Net for {thisMonth}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={<TrendingUp className="h-5 w-5 text-[color:var(--income)]" />} label="Income this month" value={peso(income)} />
        <StatCard icon={<TrendingDown className="h-5 w-5 text-[color:var(--expense)]" />} label="Expenses this month" value={peso(expense)} />
        <StatCard icon={<Wallet className="h-5 w-5 text-primary" />} label="Net" value={peso(income - expense)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Last 6 months</CardTitle></CardHeader>
          <CardContent style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <XAxis dataKey="month" fontSize={12} stroke="#9aa0bf" />
                <YAxis fontSize={12} stroke="#9aa0bf" />
                <Tooltip formatter={(v: number) => peso(v)} />
                <Legend />
                <Bar dataKey="income" fill="#7ad3c5" radius={[8, 8, 0, 0]} />
                <Bar dataKey="expense" fill="#7c5cff" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Expense breakdown</CardTitle></CardHeader>
          <CardContent style={{ height: 260 }}>
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expenses this month yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={95}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {pieData.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => peso(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {budgetRows.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Budgets</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {budgetRows.map((b) => {
              const pct = b.limit > 0 ? Math.min(100, (b.spent / b.limit) * 100) : 0;
              return (
                <div key={b.id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{b.name}</span>
                    <span className={b.spent > b.limit ? "text-destructive" : "text-muted-foreground"}>
                      {peso(b.spent)} / {peso(b.limit)}
                    </span>
                  </div>
                  <Progress value={pct} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Recent transactions</CardTitle></CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet. Add one from the Transactions tab.</p>
          ) : (
            <ul className="divide-y">
              {recent.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <div className="font-medium">{(t.category_id && catMap.get(t.category_id)?.name) || "Uncategorized"}</div>
                    <div className="text-xs text-muted-foreground">{t.occurred_on} {t.note ? `· ${t.note}` : ""}</div>
                  </div>
                  <span className={t.kind === "income" ? "text-[color:var(--income)] font-medium" : "text-[color:var(--expense)] font-medium"}>
                    {t.kind === "income" ? "+" : "-"}{peso(t.amount)}
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

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-6">
        <div className="rounded-full bg-muted p-3">{icon}</div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}