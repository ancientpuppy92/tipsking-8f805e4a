import { createServerFn } from "@tanstack/react-start";

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