import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPublicPredictions } from "@/lib/predictions.functions";

export const DAYS = ["Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue"] as const;
export type Day = (typeof DAYS)[number];
export type Result = "won" | "lost" | "pending";

export interface PredictionRow {
  id: string;
  day: string;
  time: string;
  home: string;
  away: string;
  tip: string;
  odds: string;
  result: string;
  vip: boolean;
  sort_order: number;
  updated_at: string;
}

export interface HistoryRow {
  id: string;
  date: string;
  time: string;
  home: string;
  away: string;
  tip: string;
  odds: string;
  score: string;
  sort_order: number;
  updated_at: string;
}

export async function fetchPredictions(): Promise<PredictionRow[]> {
  return (await getPublicPredictions()) as PredictionRow[];
}

/**
 * Admin-only feed queried directly (RLS grants admins full rows, including VIP
 * tip/odds needed for editing). Only usable by an authenticated admin session.
 */
export async function fetchAdminPredictions(): Promise<PredictionRow[]> {
  const { data, error } = await supabase
    .from("predictions")
    .select("*")
    .order("day")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as PredictionRow[];
}

export async function fetchWinningHistory(): Promise<HistoryRow[]> {
  const { data, error } = await supabase
    .from("winning_history")
    .select("*")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as HistoryRow[];
}

export const predictionsQueryOptions = () =>
  queryOptions({ queryKey: ["predictions"], queryFn: fetchPredictions });

export const adminPredictionsQueryOptions = () =>
  queryOptions({ queryKey: ["predictions", "admin"], queryFn: fetchAdminPredictions });

export const winningHistoryQueryOptions = () =>
  queryOptions({ queryKey: ["winning_history"], queryFn: fetchWinningHistory });

export function groupByDay(rows: PredictionRow[]): Record<Day, PredictionRow[]> {
  const map = {} as Record<Day, PredictionRow[]>;
  for (const d of DAYS) map[d] = [];
  for (const r of rows) {
    if ((DAYS as readonly string[]).includes(r.day)) map[r.day as Day].push(r);
  }
  return map;
}

export interface HistoryGroup {
  date: string;
  games: HistoryRow[];
}

export function groupByDate(rows: HistoryRow[]): HistoryGroup[] {
  const order: string[] = [];
  const map = new Map<string, HistoryRow[]>();
  for (const r of rows) {
    if (!map.has(r.date)) {
      map.set(r.date, []);
      order.push(r.date);
    }
    map.get(r.date)!.push(r);
  }
  return order.map((date) => ({ date, games: map.get(date)! }));
}

export const formatKsh = (n: number) => `KSH ${n.toLocaleString()}`;