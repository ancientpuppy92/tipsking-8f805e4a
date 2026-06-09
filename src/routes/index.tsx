import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, History, Tag, LogIn, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { DaySelector } from "@/components/DaySelector";
import { PredictionsTable } from "@/components/PredictionsTable";
import { WinningHistory } from "@/components/WinningHistory";
import { Pricing } from "@/components/Pricing";
import { StatsBanner } from "@/components/StatsBanner";
import { VipBanner } from "@/components/VipBanner";
import { LoginModal } from "@/components/LoginModal";
import { PaymentModal } from "@/components/PaymentModal";
import {
  predictionsQueryOptions,
  winningHistoryQueryOptions,
  groupByDay,
  groupByDate,
  DAYS,
  type Day,
} from "@/lib/predictions-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TipKings — Kenya's #1 Football Prediction Tips" },
      { name: "description", content: "Daily free & VIP football betting tips with a 95% success rate. Winning history, premium picks, and instant M-Pesa payments." },
      { property: "og:title", content: "TipKings — Kenya's #1 Football Prediction Tips" },
      { property: "og:description", content: "Daily free & VIP football betting tips with a 95% success rate." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(predictionsQueryOptions());
    context.queryClient.ensureQueryData(winningHistoryQueryOptions());
  },
  component: Index,
});

type Tab = "predictions" | "history" | "pricing";

const tabs: { id: Tab; label: string; icon: typeof Trophy }[] = [
  { id: "predictions", label: "Predictions", icon: Trophy },
  { id: "history", label: "Winning History", icon: History },
  { id: "pricing", label: "Pricing", icon: Tag },
];

function Index() {
  const [tab, setTab] = useState<Tab>("predictions");
  const [day, setDay] = useState<Day>("Wed");
  const [loginOpen, setLoginOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payPlan, setPayPlan] = useState("7day");

  const { data: predictions = [] } = useQuery(predictionsQueryOptions());
  const { data: history = [] } = useQuery(winningHistoryQueryOptions());
  const byDay = groupByDay(predictions);
  const historyGroups = groupByDate(history);

  const openPayment = (planId = "7day") => {
    setPayPlan(planId);
    setPayOpen(true);
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <Toaster position="top-center" />

      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-6 text-primary" />
            <span className="text-lg font-extrabold tracking-tight">TipKings</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => setLoginOpen(true)}>
            <LogIn className="size-4" /> Sign In
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-5">
        <StatsBanner />
        <VipBanner onClick={() => openPayment("30day")} />

        <nav className="flex gap-1.5 rounded-xl border border-border bg-card p-1.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-colors sm:text-sm",
                tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
              )}
            >
              <t.icon className="size-4" />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        {tab === "predictions" && (
          <div className="space-y-4">
            <DaySelector active={day} onChange={setDay} />
            <PredictionsTable predictions={byDay[day]} onUnlock={() => openPayment("7day")} />
            <Button className="w-full bg-vip text-vip-foreground hover:bg-vip/90" onClick={() => openPayment("7day")}>
              Unlock all VIP picks
            </Button>
          </div>
        )}

        {tab === "history" && <WinningHistory groups={historyGroups} />}

        {tab === "pricing" && <Pricing onSubscribe={openPayment} />}
      </main>

      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
      <PaymentModal open={payOpen} onOpenChange={setPayOpen} initialPlan={payPlan} />
    </div>
  );
}
