import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";

export function VipBanner({ onClick }: { onClick: () => void }) {
  return (
    <div
      className="flex flex-col items-start gap-3 rounded-2xl p-5 text-vip-foreground sm:flex-row sm:items-center sm:justify-between"
      style={{ background: "var(--gradient-vip)" }}
    >
      <div className="flex items-center gap-3">
        <Crown className="size-7 shrink-0" />
        <div>
          <p className="font-bold leading-tight">Get VIP Membership for 1 Month</p>
          <p className="text-sm opacity-90">with as little as KSH 2,500</p>
        </div>
      </div>
      <Button onClick={onClick} className="bg-vip-foreground text-vip hover:bg-vip-foreground/90">
        Get VIP Now
      </Button>
    </div>
  );
}