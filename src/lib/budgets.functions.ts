import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listBudgets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("budgets")
      .select("id, category_id, monthly_limit");
    if (error) throw new Error(error.message);
    return (data ?? []).map((b) => ({ ...b, monthly_limit: Number(b.monthly_limit) }));
  });

export const upsertBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      category_id: z.string().uuid(),
      monthly_limit: z.number().nonnegative().max(99_999_999),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("budgets")
      .upsert(
        { user_id: context.userId, category_id: data.category_id, monthly_limit: data.monthly_limit },
        { onConflict: "user_id,category_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("budgets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });