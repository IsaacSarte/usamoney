import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ruleSchema = z.object({
  kind: z.enum(["income", "expense"]),
  amount: z.number().positive().max(99_999_999),
  category_id: z.string().uuid().nullable().optional(),
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
  start_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

function addInterval(dateStr: string, freq: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  if (freq === "daily") d.setUTCDate(d.getUTCDate() + 1);
  else if (freq === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else if (freq === "monthly") d.setUTCMonth(d.getUTCMonth() + 1);
  else if (freq === "yearly") d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export const listRecurring = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("recurring_rules")
      .select("id, kind, amount, category_id, frequency, start_on, end_on, next_run_on, note")
      .order("next_run_on");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({ ...r, amount: Number(r.amount) }));
  });

export const createRecurring = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ruleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("recurring_rules").insert({
      user_id: context.userId,
      kind: data.kind,
      amount: data.amount,
      category_id: data.category_id ?? null,
      frequency: data.frequency,
      start_on: data.start_on,
      end_on: data.end_on ?? null,
      next_run_on: data.start_on,
      note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteRecurring = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("recurring_rules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Materialize all due recurring rules into transactions. Idempotent via next_run_on.
export const materializeDue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const today = new Date().toISOString().slice(0, 10);
    const { data: rules, error } = await context.supabase
      .from("recurring_rules")
      .select("id, kind, amount, category_id, frequency, end_on, next_run_on, note")
      .lte("next_run_on", today);
    if (error) throw new Error(error.message);
    let created = 0;
    for (const r of rules ?? []) {
      let next = r.next_run_on as string;
      while (next <= today && (!r.end_on || next <= r.end_on)) {
        const { error: insErr } = await context.supabase.from("transactions").insert({
          user_id: context.userId,
          kind: r.kind,
          amount: r.amount,
          category_id: r.category_id,
          occurred_on: next,
          note: r.note ? `[recurring] ${r.note}` : "[recurring]",
        });
        if (insErr) throw new Error(insErr.message);
        created++;
        next = addInterval(next, r.frequency as string);
      }
      await context.supabase
        .from("recurring_rules").update({ next_run_on: next }).eq("id", r.id);
    }
    return { created };
  });