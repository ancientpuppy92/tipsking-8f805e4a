import { createServerFn } from "@tanstack/react-start";
import { getRequestIP, getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import { plans, planAmount, type Currency } from "@/data/predictions";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Free IP geolocation — returns the visitor's ISO country code + currency. */
export const detectCountry = createServerFn({ method: "GET" }).handler(async () => {
  const fallback = { country: "KE", currency: "KES" as Currency };
  try {
    const ip = getRequestIP({ xForwardedFor: true });
    if (!ip || ip === "127.0.0.1" || ip === "::1") return fallback;

    // Free, no-key geolocation service
    const res = await fetch(`https://ipapi.co/${ip}/country/`, {
      headers: { "User-Agent": "tipkings/1.0" },
    });
    if (!res.ok) return fallback;
    const code = (await res.text()).trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) return fallback;

    const currency: Currency = code === "NG" ? "NGN" : "KES";
    return { country: code, currency };
  } catch {
    return fallback;
  }
});

function detectCurrencyFromIp(ip: string | undefined): Promise<Currency> {
  return (async () => {
    if (!ip || ip === "127.0.0.1" || ip === "::1") return "KES";
    try {
      const res = await fetch(`https://ipapi.co/${ip}/country/`);
      if (!res.ok) return "KES";
      const code = (await res.text()).trim().toUpperCase();
      return code === "NG" ? "NGN" : "KES";
    } catch {
      return "KES";
    }
  })();
}

/** Create a pending subscription and return trusted details for Kora Checkout. */
export const prepareKorapayModalCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        planId: z.string().min(1).max(40),
        email: z.string().email().max(255),
        name: z.string().min(1).max(120),
        currency: z.enum(["NGN", "KES"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const plan = plans.find((p) => p.id === data.planId);
    if (!plan) throw new Error("Invalid plan selected.");

    // Use the client-selected currency when supplied, otherwise auto-detect.
    const ip = getRequestIP({ xForwardedFor: true });
    const currency = data.currency ?? (await detectCurrencyFromIp(ip));
    const amount = planAmount(plan, currency);

    const host = getRequestHost();
    if (!host) throw new Error("Could not prepare payment. Please try again.");
    const notificationUrl = `https://${host}/api/public/korapay-webhook`;
    const reference = `tk_${plan.id}_${crypto.randomUUID()}`;

    // Record a pending subscription tied to the signed-in user.
    const { error: subErr } = await context.supabase.from("subscriptions").insert({
      user_id: context.userId,
      plan_id: plan.id,
      reference,
      status: "pending",
      currency,
      amount,
    });
    if (subErr) {
      console.error("subscription insert failed", subErr.message);
      throw new Error("Could not start payment. Please try again.");
    }

    return { reference, currency, amount, notificationUrl };
  });

/** Verify a charge status by reference (used by the return/status page). */
export const verifyKorapayCharge = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ reference: z.string().min(1).max(120) }).parse(input))
  .handler(async ({ data }) => {
    const secret = process.env.KORAPAY_SECRET_KEY;
    if (!secret) throw new Error("Payment provider is not configured.");

    const res = await fetch(
      `https://api.korapay.com/merchant/api/v1/charges/${encodeURIComponent(data.reference)}`,
      { headers: { Authorization: `Bearer ${secret}` } },
    );
    const body = (await res.json().catch(() => null)) as
      | { status?: boolean; data?: { status?: string; amount?: number; currency?: string } }
      | null;

    const providerStatus = body?.data?.status ?? "pending";
    const amount = body?.data?.amount == null ? null : Number(body.data.amount);
    const currency = body?.data?.currency ?? null;
    let verified = false;

    if (providerStatus === "success" && amount !== null && currency) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: subscription, error: subscriptionError } = await supabaseAdmin
        .from("subscriptions")
        .select("plan_id, amount, currency, status")
        .eq("reference", data.reference)
        .maybeSingle();

      if (subscriptionError) throw new Error("Could not confirm your subscription.");

      verified = Boolean(
        subscription &&
          subscription.amount === amount &&
          subscription.currency === currency &&
          (subscription.status === "pending" || subscription.status === "active"),
      );

      if (verified && subscription?.status === "pending") {
        const days = plans.find((plan) => plan.id === subscription.plan_id)?.durationDays ?? 30;
        const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
        const { error: activationError } = await supabaseAdmin
          .from("subscriptions")
          .update({ status: "active", expires_at: expiresAt })
          .eq("reference", data.reference)
          .eq("status", "pending");

        if (activationError) throw new Error("Payment was confirmed, but VIP access could not be updated yet.");
      }
    }

    const status = providerStatus === "success" && !verified ? "failed" : providerStatus;
    return {
      status,
      success: verified,
      amount,
      currency,
    };
  });
