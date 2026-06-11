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

        // Payment confirmed — fulfillment hooks can be added here.
        return new Response("ok", { status: 200 });
      },
    },
  },
});
