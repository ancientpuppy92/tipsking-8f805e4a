import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, XCircle, Loader2, ShieldCheck, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { verifyKorapayCharge } from "@/lib/payments.functions";

export const Route = createFileRoute("/payment-status")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Payment Status — TipKings" },
      { name: "description", content: "Check the status of your TipKings VIP membership payment." },
      { property: "og:title", content: "Payment Status — TipKings" },
      { property: "og:description", content: "Check the status of your TipKings VIP membership payment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({ ref: typeof s.ref === "string" ? s.ref : "" }),
  component: PaymentStatusPage,
});

function PaymentStatusPage() {
  const { ref } = useSearch({ from: "/payment-status" });
  const verify = useServerFn(verifyKorapayCharge);

  const { data, isLoading } = useQuery({
    queryKey: ["korapay-verify", ref],
    queryFn: () => verify({ data: { reference: ref } }),
    enabled: !!ref,
    refetchInterval: (q) => (q.state.data?.status === "pending" ? 3000 : false),
  });

  const status = !ref ? "error" : isLoading ? "loading" : data?.success ? "success" : data?.status;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-center gap-2 border-b border-border bg-muted/30 py-4">
          <ShieldCheck className="size-6 text-primary" />
          <span className="text-lg font-extrabold tracking-tight">TipKings</span>
        </div>

        <div className="px-6 py-10 text-center">
          {status === "loading" && (
            <>
              <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-primary/10">
                <Loader2 className="size-10 animate-spin text-primary" />
              </div>
              <h1 className="mt-5 text-xl font-bold">Confirming your payment</h1>
              <p className="mt-2 text-sm text-muted-foreground">Hold tight — this only takes a moment.</p>
            </>
          )}
          {status === "success" && (
            <>
              <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle2 className="size-12 text-primary" />
              </div>
              <h1 className="mt-5 text-xl font-bold">Payment successful! 🎉</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Your VIP membership is now active. All premium picks are unlocked on your account.
              </p>
              <div className="mt-5 rounded-xl bg-vip/10 px-4 py-3 text-left">
                <p className="flex items-center gap-2 text-sm font-semibold text-vip">
                  <Crown className="size-4" /> VIP access unlocked
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Head back to see today's premium predictions.</p>
              </div>
            </>
          )}
          {status === "pending" && (
            <>
              <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-vip/10">
                <Clock className="size-12 text-vip" />
              </div>
              <h1 className="mt-5 text-xl font-bold">Payment pending</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We're waiting for confirmation from your provider. This page updates automatically.
              </p>
              <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Checking status…
              </div>
            </>
          )}
          {(status === "error" || status === "failed" || status === "expired") && (
            <>
              <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-destructive/10">
                <XCircle className="size-12 text-destructive" />
              </div>
              <h1 className="mt-5 text-xl font-bold">Payment not completed</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {!ref
                  ? "We couldn't find a payment reference. Please start your subscription again."
                  : "Something went wrong and your payment wasn't completed. No charge was made — please try again."}
              </p>
            </>
          )}

          <Button asChild className="mt-8 w-full" variant={status === "success" ? "default" : "outline"}>
            <Link to="/">{status === "success" ? "View VIP predictions" : "Back to predictions"}</Link>
          </Button>
          {ref && (
            <p className="mt-3 text-[11px] text-muted-foreground/70">Reference: {ref}</p>
          )}
        </div>
      </div>
    </div>
  );
}
