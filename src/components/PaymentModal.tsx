import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock } from "lucide-react";
import { plans, formatPrice } from "@/data/predictions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useCurrency } from "@/hooks/useCurrency";
import { prepareKorapayModalCharge } from "@/lib/payments.functions";
import { CurrencySwitch } from "@/components/CurrencySwitch";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialPlan?: string;
}

interface KorapayOptions {
  key: string;
  reference: string;
  amount: number;
  currency: "NGN" | "KES";
  customer: { name: string; email: string };
  notification_url: string;
  onSuccess: () => void;
  onFailed: (error?: unknown) => void;
  onClose: () => void;
}

declare global {
  interface Window {
    Korapay?: { initialize: (options: KorapayOptions) => void };
  }
}

const KORA_SCRIPT = "https://korablobstorage.blob.core.windows.net/modal-bucket/korapay-collections.min.js";
const KORA_PUBLIC_KEY = "pk_live_KxNb5jDg18CQtJWzJt1RdgyMNsRo4D9NanrmE7nP";

function loadKoraScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Korapay) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${KORA_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load Kora checkout.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = KORA_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Kora checkout."));
    document.body.appendChild(script);
  });
}

export function PaymentModal({ open, onOpenChange, initialPlan = "7day" }: Props) {
  const [selected, setSelected] = useState(initialPlan);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const { currency } = useCurrency();
  const startCharge = useServerFn(prepareKorapayModalCharge);

  useEffect(() => {
    if (open) setSelected(initialPlan);
  }, [open, initialPlan]);

  const plan = plans.find((p) => p.id === selected) ?? plans[1];

  const pay = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error("Please enter your name and email.");
      return;
    }
    setBusy(true);
    try {
      const charge = await startCharge({
        data: { planId: plan.id, email: email.trim(), name: name.trim(), currency },
      });
      await loadKoraScript();
      const kora = window.Korapay;
      if (!kora) throw new Error("Kora checkout did not load. Please try again.");

      kora.initialize({
        key: KORA_PUBLIC_KEY,
        reference: charge.reference,
        amount: charge.amount,
        currency: charge.currency,
        customer: { name: name.trim(), email: email.trim() },
        notification_url: charge.notificationUrl,
        onSuccess: () => {
          window.location.assign(`/payment-status?ref=${encodeURIComponent(charge.reference)}`);
        },
        onFailed: (error) => {
          const message =
            typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
              ? error.message
              : "Payment failed. Please try again.";
          toast.error(message);
          setBusy(false);
        },
        onClose: () => setBusy(false),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start payment.");
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete your payment</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Currency</span>
          <CurrencySwitch />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Select plan</p>
          {plans.map((p) => (
            <label
              key={p.id}
              className={cn(
                "flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 text-sm",
                selected === p.id ? "border-primary bg-primary/10" : "border-border",
              )}
            >
              <span className="flex items-center gap-2.5">
                <input
                  type="radio"
                  name="plan"
                  checked={selected === p.id}
                  onChange={() => setSelected(p.id)}
                  className="size-4 accent-[var(--primary)]"
                />
                <span className="font-medium">{p.period}</span>
              </span>
              <span className="font-semibold">{formatPrice(p, currency)}</span>
            </label>
          ))}
        </div>

        <div className="mt-2 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button className="w-full" onClick={pay} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
            Pay {formatPrice(plan, currency)}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Secured by Kora · Card, bank transfer & mobile money
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}