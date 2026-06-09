import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Pencil, Trash2, LogOut, ShieldCheck, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  predictionsQueryOptions,
  winningHistoryQueryOptions,
  groupByDay,
  groupByDate,
  DAYS,
  type PredictionRow,
  type HistoryRow,
} from "@/lib/predictions-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({ meta: [{ title: "Admin — TipKings" }] }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const { session, isAdmin, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return null;

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <ShieldCheck className="size-10 text-muted-foreground" />
        <div>
          <h1 className="text-lg font-semibold">Not an admin</h1>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Your account ({session.user.email}) doesn't have admin access yet. Ask an
            existing admin to grant your account the admin role.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => signOut()}>
            <LogOut className="size-4" /> Sign out
          </Button>
          <Button asChild variant="ghost">
            <Link to="/">Back to site</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-6 text-primary" />
            <span className="text-lg font-extrabold tracking-tight">TipKings Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" asChild>
              <Link to="/">
                <ArrowLeft className="size-4" /> Site
              </Link>
            </Button>
            <Button size="sm" variant="outline" onClick={() => signOut()}>
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-5">
        <Tabs defaultValue="predictions">
          <TabsList className="w-full">
            <TabsTrigger value="predictions" className="flex-1">Predictions</TabsTrigger>
            <TabsTrigger value="history" className="flex-1">Winning History</TabsTrigger>
          </TabsList>
          <TabsContent value="predictions">
            <PredictionsAdmin />
          </TabsContent>
          <TabsContent value="history">
            <HistoryAdmin />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

const RESULTS = ["pending", "won", "lost"];

const emptyPrediction = (day: string): Partial<PredictionRow> => ({
  day,
  time: "",
  home: "",
  away: "",
  tip: "",
  odds: "",
  result: "pending",
  vip: false,
  sort_order: 0,
});

function PredictionsAdmin() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(predictionsQueryOptions());
  const [editing, setEditing] = useState<Partial<PredictionRow> | null>(null);

  const save = useMutation({
    mutationFn: async (row: Partial<PredictionRow>) => {
      const payload = {
        day: row.day,
        time: row.time,
        home: row.home,
        away: row.away,
        tip: row.tip,
        odds: row.odds,
        result: row.result,
        vip: row.vip ?? false,
        sort_order: Number(row.sort_order) || 0,
      };
      if (row.id) {
        const { error } = await supabase.from("predictions").update(payload).eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("predictions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["predictions"] });
      setEditing(null);
      toast.success("Saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("predictions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["predictions"] });
      toast.success("Deleted");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  if (isLoading) return <Loading />;
  const grouped = groupByDay(data ?? []);

  return (
    <div className="space-y-6">
      {DAYS.map((day) => (
        <div key={day} className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-4 py-2.5">
            <span className="font-semibold">{day}</span>
            <Button size="sm" variant="ghost" onClick={() => setEditing(emptyPrediction(day))}>
              <Plus className="size-4" /> Add
            </Button>
          </div>
          {grouped[day].length === 0 && (
            <p className="px-4 py-3 text-sm text-muted-foreground">No predictions.</p>
          )}
          {grouped[day].map((p) => (
            <div key={p.id} className="flex items-center gap-3 border-b border-border/60 px-4 py-2.5 text-sm last:border-0">
              <span className="w-12 font-mono text-xs text-muted-foreground">{p.time}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {p.home} <span className="text-muted-foreground">vs</span> {p.away}
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.tip} @ {p.odds} · {p.result}
                  {p.vip && " · VIP"}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setEditing(p)}>
                <Pencil className="size-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => remove.mutate(p.id)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      ))}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit prediction" : "New prediction"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate(editing);
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <Field label="Day">
                  <Select value={editing.day} onValueChange={(v) => setEditing({ ...editing, day: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Time">
                  <Input value={editing.time ?? ""} onChange={(e) => setEditing({ ...editing, time: e.target.value })} placeholder="20:45" required />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Home">
                  <Input value={editing.home ?? ""} onChange={(e) => setEditing({ ...editing, home: e.target.value })} required />
                </Field>
                <Field label="Away">
                  <Input value={editing.away ?? ""} onChange={(e) => setEditing({ ...editing, away: e.target.value })} required />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tip">
                  <Input value={editing.tip ?? ""} onChange={(e) => setEditing({ ...editing, tip: e.target.value })} required />
                </Field>
                <Field label="Odds">
                  <Input value={editing.odds ?? ""} onChange={(e) => setEditing({ ...editing, odds: e.target.value })} placeholder="1.85" required />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Result">
                  <Select value={editing.result} onValueChange={(v) => setEditing({ ...editing, result: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RESULTS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Sort order">
                  <Input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
                </Field>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <Label htmlFor="vip">VIP pick (blurred for free users)</Label>
                <Switch id="vip" checked={!!editing.vip} onCheckedChange={(v) => setEditing({ ...editing, vip: v })} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending && <Loader2 className="size-4 animate-spin" />} Save
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const emptyHistory = (): Partial<HistoryRow> => ({
  date: "",
  time: "",
  home: "",
  away: "",
  tip: "",
  odds: "",
  score: "",
  sort_order: 0,
});

function HistoryAdmin() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(winningHistoryQueryOptions());
  const [editing, setEditing] = useState<Partial<HistoryRow> | null>(null);

  const save = useMutation({
    mutationFn: async (row: Partial<HistoryRow>) => {
      const payload = {
        date: row.date,
        time: row.time,
        home: row.home,
        away: row.away,
        tip: row.tip,
        odds: row.odds,
        score: row.score,
        sort_order: Number(row.sort_order) || 0,
      };
      if (row.id) {
        const { error } = await supabase.from("winning_history").update(payload).eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("winning_history").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["winning_history"] });
      setEditing(null);
      toast.success("Saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("winning_history").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["winning_history"] });
      toast.success("Deleted");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  if (isLoading) return <Loading />;
  const groups = groupByDate(data ?? []);

  return (
    <div className="space-y-6">
      <Button onClick={() => setEditing(emptyHistory())}>
        <Plus className="size-4" /> Add winning entry
      </Button>

      {groups.map((group) => (
        <div key={group.date} className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border bg-secondary/50 px-4 py-2.5 font-semibold">
            {group.date}
          </div>
          {group.games.map((g) => (
            <div key={g.id} className="flex items-center gap-3 border-b border-border/60 px-4 py-2.5 text-sm last:border-0">
              <span className="w-12 font-mono text-xs text-muted-foreground">{g.time}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {g.home} <span className="text-muted-foreground">vs</span> {g.away}
                </p>
                <p className="text-xs text-muted-foreground">
                  {g.tip} @ {g.odds} · FT {g.score}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setEditing(g)}>
                <Pencil className="size-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => remove.mutate(g.id)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      ))}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit entry" : "New winning entry"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate(editing);
              }}
              className="space-y-3"
            >
              <Field label="Date (e.g. September 30, 2025)">
                <Input value={editing.date ?? ""} onChange={(e) => setEditing({ ...editing, date: e.target.value })} required />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Time">
                  <Input value={editing.time ?? ""} onChange={(e) => setEditing({ ...editing, time: e.target.value })} placeholder="20:45" required />
                </Field>
                <Field label="Score">
                  <Input value={editing.score ?? ""} onChange={(e) => setEditing({ ...editing, score: e.target.value })} placeholder="3-0" required />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Home">
                  <Input value={editing.home ?? ""} onChange={(e) => setEditing({ ...editing, home: e.target.value })} required />
                </Field>
                <Field label="Away">
                  <Input value={editing.away ?? ""} onChange={(e) => setEditing({ ...editing, away: e.target.value })} required />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tip">
                  <Input value={editing.tip ?? ""} onChange={(e) => setEditing({ ...editing, tip: e.target.value })} required />
                </Field>
                <Field label="Odds">
                  <Input value={editing.odds ?? ""} onChange={(e) => setEditing({ ...editing, odds: e.target.value })} placeholder="1.80" required />
                </Field>
              </div>
              <Field label="Sort order">
                <Input type="number" value={editing.sort_order ?? 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} />
              </Field>
              <DialogFooter>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending && <Loader2 className="size-4 animate-spin" />} Save
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="size-6 animate-spin text-primary" />
    </div>
  );
}