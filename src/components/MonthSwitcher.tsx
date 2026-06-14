import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { useMonth } from "@/lib/month-context";
import { Button } from "@/components/ui/button";

export function MonthSwitcher({ compact = false }: { compact?: boolean }) {
  const { label, shift, isCurrent, setMonth } = useMonth();
  const reset = () => {
    const d = new Date();
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  return (
    <div className={`flex items-center gap-1 rounded-full bg-white/70 px-1 py-1 shadow-[var(--shadow-soft)] ${compact ? "" : ""}`}>
      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => shift(-1)} aria-label="Previous month">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <button
        type="button"
        onClick={reset}
        className="flex items-center gap-1 px-2 text-xs font-medium text-primary"
        title={isCurrent ? "Current month" : "Jump to current month"}
      >
        <Calendar className="h-3.5 w-3.5" />
        {label}
      </button>
      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => shift(1)} aria-label="Next month">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}