import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Wallet } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Piso Tracker — Personal Budget" },
      { name: "description", content: "Track income, expenses, budgets, and a secure vault for your important info." },
      { property: "og:title", content: "Piso Tracker" },
      { property: "og:description", content: "Personal budget tracker with an encrypted data vault." },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      navigate({ to: data.user ? "/dashboard" : "/auth", replace: true });
    });
    return () => { active = false; };
  }, [navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Wallet className="h-6 w-6 text-primary animate-pulse" />
        <span>Loading…</span>
      </div>
    </div>
  );
}
