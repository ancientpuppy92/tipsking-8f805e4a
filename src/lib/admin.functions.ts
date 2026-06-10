import { createServerFn } from "@tanstack/react-start";
import { createMiddleware } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Extends requireSupabaseAuth with a server-side admin role check.
 * RLS already restricts writes to admins, but validating here lets us return
 * clean, explicit errors and refuse the request before any write is attempted.
 */
const requireAdmin = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (error) throw new Error("Could not verify permissions");
    if (!data) throw new Error("Forbidden: admin role required");
    return next();
  });

class ConflictError extends Error {
  conflict = true as const;
  constructor() {
    super(
      "This item was changed by someone else since you opened it. Refresh and try again.",
    );
  }
}

const text = (max = 255) => z.string().trim().min(1).max(max);

const predictionSchema = z.object({
  id: z.string().uuid().optional(),
  expectedUpdatedAt: z.string().optional(),
  day: z.enum(["Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue"]),
  time: text(20),
  home: text(120),
  away: text(120),
  tip: text(120),
  odds: text(20),
  result: z.enum(["pending", "won", "lost"]),
  vip: z.boolean(),
  sort_order: z.number().int().min(0).max(100000),
});

const historySchema = z.object({
  id: z.string().uuid().optional(),
  expectedUpdatedAt: z.string().optional(),
  date: text(120),
  time: text(20),
  home: text(120),
  away: text(120),
  tip: text(120),
  odds: text(20),
  score: text(20),
  sort_order: z.number().int().min(0).max(100000),
});

const idSchema = z.object({ id: z.string().uuid() });

export const savePrediction = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => predictionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, expectedUpdatedAt, ...payload } = data;
    if (id) {
      let query = supabase.from("predictions").update(payload).eq("id", id);
      if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
      const { data: rows, error } = await query.select("id");
      if (error) throw new Error(error.message);
      if (!rows || rows.length === 0) throw new ConflictError();
      return { ok: true as const, id };
    }
    const { data: row, error } = await supabase
      .from("predictions")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true as const, id: row.id };
  });

export const deletePrediction = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("predictions")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const saveHistory = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => historySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, expectedUpdatedAt, ...payload } = data;
    if (id) {
      let query = supabase.from("winning_history").update(payload).eq("id", id);
      if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
      const { data: rows, error } = await query.select("id");
      if (error) throw new Error(error.message);
      if (!rows || rows.length === 0) throw new ConflictError();
      return { ok: true as const, id };
    }
    const { data: row, error } = await supabase
      .from("winning_history")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true as const, id: row.id };
  });

export const deleteHistory = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("winning_history")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });