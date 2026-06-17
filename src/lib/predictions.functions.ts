import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Public predictions feed. VIP rows are returned as locked teasers with the
 * sensitive tip/odds stripped server-side, so paid content is never sent to
 * non-entitled visitors even though the match row is still shown (blurred).
 */
export const getPublicPredictions = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("predictions")
    .select("id,day,time,home,away,tip,odds,result,vip,sort_order,updated_at")
    .order("day")
    .order("sort_order");
  if (error) throw new Error("Could not load predictions");
  return (data ?? []).map((p) =>
    p.vip ? { ...p, tip: "VIP", odds: "—" } : p,
  );
});

/**
 * Predictions feed for a signed-in user. If the user has an active VIP
 * subscription, full VIP tip/odds are returned; otherwise VIP rows are masked
 * exactly like the public feed. Also reports the VIP entitlement flag.
 */
export const getEntitledPredictions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: active } = await context.supabase.rpc("has_active_subscription", {
      _user_id: context.userId,
    });
    const isActive = !!active;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("predictions")
      .select("id,day,time,home,away,tip,odds,result,vip,sort_order,updated_at")
      .order("day")
      .order("sort_order");
    if (error) throw new Error("Could not load predictions");

    const predictions = (data ?? []).map((p) =>
      p.vip && !isActive ? { ...p, tip: "VIP", odds: "—" } : p,
    );
    return { active: isActive, predictions };
  });