import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const txSchema = z.object({
  kind: z.enum(["income", "expense"]),
  amount: z.number().positive().max(99_999_999),
  category_id: z.string().uuid().nullable().optional(),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(500).optional().nullable(),
});

export const listTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("transactions")
      .select("id, kind, amount, category_id, occurred_on, note, created_at")
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw new Error(error.message);
    return (data ?? []).map((t) => ({ ...t, amount: Number(t.amount) }));
  });

export const createTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => txSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("transactions").insert({
      user_id: context.userId,
      kind: data.kind,
      amount: data.amount,
      category_id: data.category_id ?? null,
      occurred_on: data.occurred_on,
      note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => txSchema.extend({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase
      .from("transactions")
      .update({
        kind: rest.kind,
        amount: rest.amount,
        category_id: rest.category_id ?? null,
        occurred_on: rest.occurred_on,
        note: rest.note ?? null,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("transactions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });