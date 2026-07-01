import { Link, Outlet, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Wallet,
  LayoutDashboard,
  ListOrdered,
  Tags,
  Target,
  RefreshCcw,
  Lock,
  LogOut,
  Plus,
  History,
  Sigma,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MonthProvider } from "@/lib/month-context";
import { MonthSwitcher } from "@/components/MonthSwitcher";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transactions", label: "Transactions", icon: ListOrdered },
  { to: "/categories", label: "Categories", icon: Tags },
  { to: "/budgets", label: "Budgets", icon: Target },
  { to: "/recurring", label: "Recurring", icon: RefreshCcw },
  { to: "/vault", label: "Vault", icon: Lock },
  { to: "/history", label: "History", icon: History },
  { to: "/totals", label: "Totals", icon: Sigma },
] as const;

// Mobile bottom nav: 5 slots with a centered "+" FAB linking to add transaction.
const mobileLeft = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Home" },
  { to: "/transactions", icon: ListOrdered, label: "Txns" },
] as const;
const mobileRight = [
  { to: "/budgets", icon: Target, label: "Budgets" },
  { to: "/vault", icon: Lock, label: "Vault" },
] as const;

export function AppShell() {
  const router = useRouter();
  const qc = useQueryClient();
  const signOut = async () => {
    await supabase.auth.signOut();
    qc.clear();
    router.navigate({ to: "/auth", replace: true });
  };
  return (
    <MonthProvider>
    <div className="min-h-screen bg-background text-foreground">
      {/* Top header: full bar on md+, compact bar on mobile */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-soft)]">
              <Wallet className="h-4 w-4" />
            </span>
            <span className="text-lg text-primary">Usamoney</span>
          </Link>
          <div className="flex items-center gap-2">
            <MonthSwitcher />
            <Button variant="ghost" size="sm" onClick={signOut} className="rounded-full">
              <LogOut className="mr-2 h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
        {/* Desktop/tablet horizontal nav */}
        <nav className="mx-auto hidden max-w-6xl gap-1 overflow-x-auto px-4 pb-3 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-2 rounded-full px-4 py-2 text-sm text-muted-foreground transition hover:bg-white hover:text-foreground"
              activeProps={{
                className:
                  "flex items-center gap-2 rounded-full px-4 py-2 text-sm bg-primary text-primary-foreground font-medium shadow-[var(--shadow-soft)]",
              }}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-2 md:pb-6 md:pt-6">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-white/40 bg-[color:var(--primary-soft)]/95 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-around px-2 py-2">
          {mobileLeft.map((item) => (
            <MobileNavLink key={item.to} {...item} />
          ))}
          <Link
            to="/transactions"
            className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-soft)]"
            aria-label="Add transaction"
          >
            <Plus className="h-6 w-6" />
          </Link>
          {mobileRight.map((item) => (
            <MobileNavLink key={item.to} {...item} />
          ))}
        </div>
      </nav>
    </div>
    </MonthProvider>
  );
}

function MobileNavLink({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] text-primary/70"
      activeProps={{
        className:
          "flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] text-primary font-medium",
      }}
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}