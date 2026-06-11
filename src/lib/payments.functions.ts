import { createServerFn } from "@tanstack/react-start";
import { getRequestIP, getRequestHost } from "@tanstack/react-start/server";
import { z } from "zod";
import { plans, planAmount, type Currency } from "@/data/predictions";

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

/** Initialize a Korapay charge and return the hosted checkout URL. */
export const initializeKorapayCharge = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        planId: z.string().min(1).max(40),
        email: z.string().email().max(255),
        name: z.string().min(1).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const secret = process.env.KORAPAY_SECRET_KEY;
    if (!secret) throw new Error("Payment provider is not configured.");

    const plan = plans.find((p) => p.id === data.planId);
    if (!plan) throw new Error("Invalid plan selected.");

    // Trust the server-detected currency + the server-side plan price.
    const ip = getRequestIP({ xForwardedFor: true });
    const currency = await detectCurrencyFromIp(ip);
    const amount = planAmount(plan, currency);

    const host = getRequestHost();
    const origin = host ? `https://${host}` : "";
    const reference = `tk_${plan.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const res = await fetch("https://api.korapay.com/merchant/api/v1/charges/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        currency,
        reference,
        narration: `TipKings ${plan.name} VIP subscription`,
        redirect_url: `${origin}/payment-status?ref=${reference}`,
        notification_url: `${origin}/api/public/korapay-webhook`,
        customer: { email: data.email, name: data.name },
        metadata: { plan_id: plan.id, plan_name: plan.name },
      }),
    });

    const body = (await res.json().catch(() => null)) as
      | { status?: boolean; message?: string; data?: { checkout_url?: string } }
      | null;

    if (!res.ok || !body?.status || !body.data?.checkout_url) {
      console.error("Korapay init failed", res.status, body?.message);
      throw new Error(body?.message || "Could not start payment. Please try again.");
    }

    return { checkoutUrl: body.data.checkout_url, reference, currency, amount };
  });
