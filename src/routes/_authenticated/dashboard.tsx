import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTransactions } from "@/lib/transactions.functions";
import { listCategories } from "@/lib/categories.functions";
import { listBudgets } from "@/lib/budgets.functions";
import { materializeDue } from "@/lib/recurring.functions";
import { Progress } from "@/components/ui/progress";
import { peso, monthKey } from "@/lib/format";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

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
  const balance = income - expense;
  const monthlyLimit = (budgets.data ?? []).reduce((s, b) => s + b.monthly_limit, 0);

  // expense breakdown this month
  const expByCat = new Map<string, number>();
  monthTxs.filter((t) => t.kind === "expense").forEach((t) => {
    const name = (t.category_id && catMap.get(t.category_id)?.name) || "Uncategorized";
    expByCat.set(name, (expByCat.get(name) ?? 0) + t.amount);
  });
  const pieData = Array.from(expByCat.entries()).map(([name, value]) => ({ name, value }));
  const pieTotal = pieData.reduce((s, p) => s + p.value, 0);
  const topCatPct = pieTotal > 0 ? Math.round((Math.max(...pieData.map((p) => p.value)) / pieTotal) * 100) : 0;
  // Candy palette matching the reference shot: mint, purple, pink, gray, navy.
  const pieColors = ["#5ec6b8", "#7c5cff", "#f48fb1", "#c8c8d6", "#2e3a8a", "#ffb38a", "#ff7a7a", "#b39ddb"];

  // budget progress
  const budgetRows = (budgets.data ?? []).map((b) => {
    const cat = catMap.get(b.category_id);
    const spent = monthTxs.filter((t) => t.kind === "expense" && t.category_id === b.category_id).reduce((s, t) => s + t.amount, 0);
    return { id: b.id, name: cat?.name ?? "—", limit: b.monthly_limit, spent };
  });

  const recent = transactions.slice(0, 8);
  const pieLegend = pieData.slice(0, 5);

  return (
    <>
      {/* ===== MOBILE LAYOUT (matches screenshot 2) ===== */}
      <div className="md:hidden -mx-4 -mt-2">
        <section className="bg-[color:var(--primary-soft)] px-6 pt-6 pb-10 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Balance</h1>
          <p className="mt-4 flex items-baseline justify-center gap-2 text-primary">
            <span className="text-4xl font-light">₱</span>
            <span className="text-5xl font-semibold tracking-tight">
              {new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(balance)}
            </span>
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Monthly Limit Goal</div>
              <div className="mt-1 text-primary">{peso(monthlyLimit)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Monthly Income</div>
              <div className="mt-1 text-primary">{peso(income)}</div>
            </div>
          </div>
        </section>
        <section className="-mt-6 rounded-t-[2rem] bg-white px-6 pt-8 pb-10 shadow-[var(--shadow-soft)]">
          <h2 className="text-center text-xl font-semibold text-primary">Last Transactions</h2>
          <div className="mx-auto mt-2 h-0.5 w-28 bg-primary/40" />
          {recent.length === 0 ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <ul className="mt-6 space-y-4 text-sm">
              {recent.map((t) => (
                <li key={t.id} className="flex items-center justify-between">
                  <span className="text-foreground/80">
                    {(t.category_id && catMap.get(t.category_id)?.name) || t.note || "Uncategorized"}
                  </span>
                  <span className={t.kind === "income" ? "text-[color:var(--income)]" : "text-primary"}>
                    {t.kind === "income" ? "+" : "-"}{peso(t.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ===== DESKTOP / TABLET LAYOUT (matches screenshot 1) ===== */}
      <div className="hidden md:grid md:grid-cols-3 md:gap-6">
        {/* Main white card */}
        <div className="md:col-span-2 rounded-[2rem] bg-white p-8 shadow-[var(--shadow-soft)]">
          <h1 className="text-3xl font-semibold tracking-tight">Balance</h1>
          <p className="mt-4 flex items-baseline gap-2 text-primary">
            <span className="text-4xl font-light">₱</span>
            <span className="text-5xl font-semibold tracking-tight">
              {new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(balance)}
            </span>
          </p>
          <div className="mt-6 flex gap-12 text-sm">
            <div>
              <div className="text-muted-foreground">Monthly Limit Goal</div>
              <div className="mt-1 text-primary">{peso(monthlyLimit)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Monthly Income</div>
              <div className="mt-1 text-primary">{peso(income)}</div>
            </div>
          </div>

          <hr className="my-8 border-primary/20" />

          {/* Breakdown */}
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-3 self-center">
              {pieLegend.length === 0 ? (
                <p className="text-sm text-muted-foreground">No expenses this month yet.</p>
              ) : (
                pieLegend.map((p, i) => (
                  <div key={p.name} className="flex items-center justify-end gap-3 text-sm">
                    <span className="text-foreground/80">{p.name}</span>
                    <span className="inline-block h-3 w-3 rounded-full" style={{ background: pieColors[i % pieColors.length] }} />
                  </div>
                ))
              )}
            </div>
            <div className="relative h-[260px]">
              {pieData.length > 0 && (
                <>
                  <div className="absolute left-2 top-2 text-sm text-primary">
                    {peso(Math.max(...pieData.map((p) => p.value)))}
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={70}
                        outerRadius={110}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={pieColors[i % pieColors.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-semibold text-foreground/80">{topCatPct}%</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right purple sidebar */}
        <aside className="rounded-[2rem] bg-[color:var(--primary-soft)] p-6 shadow-[var(--shadow-soft)]">
          <h2 className="text-center text-lg font-semibold text-primary">Last Transactions</h2>
          <div className="mx-auto mt-2 h-0.5 w-32 bg-primary/40" />
          {recent.length === 0 ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <ul className="mt-5 space-y-3 text-sm">
              {recent.map((t) => (
                <li key={t.id} className="flex items-center justify-between">
                  <span className="text-foreground/80">
                    {(t.category_id && catMap.get(t.category_id)?.name) || t.note || "Uncategorized"}
                  </span>
                  <span className={t.kind === "income" ? "text-[color:var(--income)]" : "text-primary"}>
                    {t.kind === "income" ? "+" : "-"}{peso(t.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {budgetRows.length > 0 && (
            <div className="mt-8 space-y-3">
              <h3 className="text-sm font-semibold text-primary">Budgets</h3>
              {budgetRows.slice(0, 4).map((b) => {
                const pct = b.limit > 0 ? Math.min(100, (b.spent / b.limit) * 100) : 0;
                return (
                  <div key={b.id}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-foreground/80">{b.name}</span>
                      <span className={b.spent > b.limit ? "text-destructive" : "text-muted-foreground"}>
                        {peso(b.spent)} / {peso(b.limit)}
                      </span>
                    </div>
                    <Progress value={pct} />
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        {/* Quick links row */}
        <div className="md:col-span-3 mt-2 grid gap-4 sm:grid-cols-3">
          <Link
            to="/transactions"
            className="rounded-2xl bg-primary px-6 py-4 text-center font-medium text-primary-foreground shadow-[var(--shadow-soft)] transition hover:opacity-90"
          >
            + Add Transaction
          </Link>
          <Link
            to="/budgets"
            className="rounded-2xl bg-white px-6 py-4 text-center font-medium text-primary shadow-[var(--shadow-soft)] transition hover:bg-primary/5"
          >
            Manage Budgets
          </Link>
          <Link
            to="/categories"
            className="rounded-2xl bg-white px-6 py-4 text-center font-medium text-primary shadow-[var(--shadow-soft)] transition hover:bg-primary/5"
          >
            Categories
          </Link>
        </div>
      </div>
    </>
  );
}