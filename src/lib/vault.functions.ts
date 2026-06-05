import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getVaultMeta = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("vault_meta")
      .select("salt, verifier_iv, verifier_ciphertext")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const setVaultMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      salt: z.string().min(1),
      verifier_iv: z.string().min(1),
      verifier_ciphertext: z.string().min(1),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("vault_meta")
      .insert({ user_id: context.userId, ...data });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listVaultItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("vault_items")
      .select("id, label, item_type, iv, ciphertext, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertVaultItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid().optional(),
      label: z.string().trim().min(1).max(120),
      item_type: z.string().trim().min(1).max(40),
      iv: z.string().min(1),
      ciphertext: z.string().min(1),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { error } = await context.supabase
        .from("vault_items")
        .update({
          label: data.label,
          item_type: data.item_type,
          iv: data.iv,
          ciphertext: data.ciphertext,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("vault_items").insert({
        user_id: context.userId,
        label: data.label,
        item_type: data.item_type,
        iv: data.iv,
        ciphertext: data.ciphertext,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteVaultItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("vault_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });