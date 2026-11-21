import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/korapay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.KORAPAY_SECRET_KEY;
        if (!secret) return new Response("Not configured", { status: 500 });

        const raw = await request.text();
        const signature = request.headers.get("x-korapay-signature") || "";

        let payload: { event?: unknown; data?: unknown };
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        // Korapay signs the JSON-stringified `data` object with the secret key.
        const expected = createHmac("sha256", secret)
          .update(JSON.stringify(payload.data ?? {}))
          .digest("hex");

        const sigBuf = Buffer.from(signature);
        const expBuf = Buffer.from(expected);
        if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const data =
          typeof payload.data === "object" && payload.data !== null
            ? (payload.data as { reference?: unknown; status?: unknown; amount?: unknown; currency?: unknown })
            : undefined;
        const reference = typeof data?.reference === "string" ? data.reference : undefined;
        const paymentStatus = typeof data?.status === "string" ? data.status : undefined;

        // Activate the matching subscription on successful payment.
        const isSuccess =
          payload.event === "charge.success" || paymentStatus === "success";
        if (isSuccess && reference) {
          const paidAmount = Number(data?.amount);
          const paidCurrency = data?.currency;
          if (!Number.isFinite(paidAmount) || (paidCurrency !== "NGN" && paidCurrency !== "KES")) {
            return new Response("Invalid payment details", { status: 400 });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: sub, error: lookupError } = await supabaseAdmin
            .from("subscriptions")
            .select("plan_id, amount, currency, status")
            .eq("reference", reference)
            .maybeSingle();

          if (lookupError) return new Response("Could not verify subscription", { status: 500 });
          if (!sub || sub.amount !== paidAmount || sub.currency !== paidCurrency) {
            return new Response("Payment does not match subscription", { status: 409 });
          }
          if (sub.status !== "pending") return new Response("ok", { status: 200 });

          const durations: Record<string, number> = { daily: 1, "7day": 7, "30day": 30, "1year": 365 };
          const days = sub ? durations[sub.plan_id] ?? 30 : 30;
          const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

          const { error: updateError } = await supabaseAdmin
            .from("subscriptions")
            .update({ status: "active", expires_at: expiresAt })
            .eq("reference", reference)
            .eq("status", "pending");
          if (updateError) return new Response("Could not activate subscription", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
