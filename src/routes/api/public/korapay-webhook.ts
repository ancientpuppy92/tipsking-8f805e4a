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

        let payload: { event?: string; data?: unknown };
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

        const data = payload.data as { reference?: string; status?: string } | undefined;
        console.log("Korapay webhook verified:", payload.event, data?.reference, data?.status);

        // Activate the matching subscription on successful payment.
        const isSuccess =
          payload.event === "charge.success" || data?.status === "success";
        if (isSuccess && data?.reference) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: sub } = await supabaseAdmin
            .from("subscriptions")
            .select("plan_id")
            .eq("reference", data.reference)
            .maybeSingle();

          const durations: Record<string, number> = { daily: 1, "7day": 7, "30day": 30, "1year": 365 };
          const days = sub ? durations[sub.plan_id] ?? 30 : 30;
          const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

          await supabaseAdmin
            .from("subscriptions")
            .update({ status: "active", expires_at: expiresAt })
            .eq("reference", data.reference);
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
