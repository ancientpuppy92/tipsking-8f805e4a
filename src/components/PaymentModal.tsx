import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Smartphone, Wallet, Bitcoin } from "lucide-react";
import { plans, formatKsh } from "@/data/predictions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialPlan?: string;
}

export function PaymentModal({ open, onOpenChange, initialPlan = "7day" }: Props) {
  const [selected, setSelected] = useState(initialPlan);

  useEffect(() => {
    if (open) setSelected(initialPlan);
  }, [open, initialPlan]);

  const plan = plans.find((p) => p.id === selected) ?? plans[1];

  const pay = (method: string) => {
    toast.success(`Processing ${method} payment of ${formatKsh(plan.price)}…`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete your payment</DialogTitle>
        </DialogHeader>

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
              <span className="font-semibold">{formatKsh(p.price)}</span>
            </label>
          ))}
        </div>

        <Tabs defaultValue="mobile" className="mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="mobile"><Smartphone className="mr-1 size-4" />Mobile</TabsTrigger>
            <TabsTrigger value="paypal"><Wallet className="mr-1 size-4" />PayPal</TabsTrigger>
            <TabsTrigger value="crypto"><Bitcoin className="mr-1 size-4" />Crypto</TabsTrigger>
          </TabsList>
          <TabsContent value="mobile" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="phone">M-Pesa phone number</Label>
              <Input id="phone" placeholder="0712 345 678" />
            </div>
            <Button className="w-full" onClick={() => pay("M-Pesa")}>
              Pay Now · {formatKsh(plan.price)}
            </Button>
          </TabsContent>
          <TabsContent value="paypal" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="pp">PayPal email</Label>
              <Input id="pp" type="email" placeholder="you@example.com" />
            </div>
            <Button className="w-full" onClick={() => pay("PayPal")}>
              Pay Now · {formatKsh(plan.price)}
            </Button>
          </TabsContent>
          <TabsContent value="crypto" className="space-y-3 pt-3">
            <div className="rounded-lg border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
              Send the equivalent of {formatKsh(plan.price)} in BTC/USDT to the wallet shown after confirming.
            </div>
            <Button className="w-full" onClick={() => pay("Crypto")}>
              Pay Now · {formatKsh(plan.price)}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}