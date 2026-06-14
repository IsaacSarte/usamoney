import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Ctx = {
  month: string; // YYYY-MM
  setMonth: (m: string) => void;
  shift: (delta: number) => void;
  label: string;
  isCurrent: boolean;
};

const MonthCtx = createContext<Ctx | null>(null);
const KEY = "usamoney.selectedMonth.v1";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function MonthProvider({ children }: { children: ReactNode }) {
  const [month, setMonthState] = useState<string>(currentMonth);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(KEY);
    if (saved && /^\d{4}-\d{2}$/.test(saved)) setMonthState(saved);
  }, []);

  const setMonth = (m: string) => {
    setMonthState(m);
    if (typeof window !== "undefined") localStorage.setItem(KEY, m);
  };

  const shift = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  };

  const value = useMemo<Ctx>(() => {
    const [y, m] = month.split("-").map(Number);
    const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
      month: "long", year: "numeric", timeZone: "UTC",
    });
    return { month, setMonth, shift, label, isCurrent: month === currentMonth() };
  }, [month]);

  return <MonthCtx.Provider value={value}>{children}</MonthCtx.Provider>;
}

export function useMonth() {
  const ctx = useContext(MonthCtx);
  if (!ctx) throw new Error("useMonth must be used within MonthProvider");
  return ctx;
}

export function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${month}-${String(last).padStart(2, "0")}`;
  return { start, end };
}