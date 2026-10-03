import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { toISO } from "@/features/finance/calc";

export type Routine = Tables<"routines">;
export type RoutineLog = Tables<"routine_logs">;
export type RoutineKind = "ROUTINE" | "HABIT";
export type RoutineFrequency = "DAILY" | "WEEKDAYS" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "MONTH_DAYS" | "CUSTOM";

export const FREQUENCIES: { value: RoutineFrequency; label: string }[] = [
  { value: "DAILY", label: "Todo dia" },
  { value: "WEEKDAYS", label: "Dias da semana" },
  { value: "WEEKLY", label: "Semanal" },
  { value: "BIWEEKLY", label: "Quinzenal" },
  { value: "MONTHLY", label: "Mensal" },
  { value: "MONTH_DAYS", label: "Dias do mês" },
  { value: "CUSTOM", label: "A cada X dias" },
];
export const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const ROUTINE_ICONS = ["✨", "💧", "📚", "🎓", "🚶", "🏋️", "🏃", "🧘", "💜", "💰", "🍎", "😴", "🧹", "🌱"];
export const ROUTINE_PERSONS = [
  { value: "COUPLE", label: "Nós", emoji: "👥" },
  { value: "JOAO", label: "João", emoji: "👤" },
  { value: "RENIFER", label: "Renifer", emoji: "👤" },
];

const parse = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
};
const dayDiff = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);

/** Se a rotina acontece na data — ocorrências são derivadas, nunca gravadas. */
export function occursOn(r: Routine, iso: string) {
  if (r.status !== "ACTIVE" || iso < r.start_date) return false;
  const d = parse(iso);
  const start = parse(r.start_date);
  const diff = dayDiff(r.start_date, iso);
  switch (r.frequency as RoutineFrequency) {
    case "DAILY":
      return true;
    case "WEEKDAYS":
      return (r.weekdays ?? []).includes(d.getDay());
    case "WEEKLY":
      return (r.weekdays?.length ? r.weekdays.includes(d.getDay()) : d.getDay() === start.getDay());
    case "BIWEEKLY":
      return diff % 14 === 0;
    case "MONTHLY": {
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      return d.getDate() === Math.min(start.getDate(), last);
    }
    case "MONTH_DAYS":
      return (r.month_days ?? []).includes(d.getDate());
    case "CUSTOM":
      return diff % Math.max(1, r.interval_days ?? 1) === 0;
    default:
      return false;
  }
}

export function frequencyLabel(r: Routine) {
  const f = r.frequency as RoutineFrequency;
  if ((f === "WEEKDAYS" || f === "WEEKLY") && r.weekdays?.length) return r.weekdays.map((w) => WEEKDAYS[w]).join(", ");
  if (f === "MONTH_DAYS" && r.month_days?.length) return `Dias ${r.month_days.join(", ")}`;
  if (f === "CUSTOM") return `A cada ${r.interval_days ?? 1} dias`;
  return FREQUENCIES.find((x) => x.value === f)?.label ?? f;
}

export function useRoutines(workspaceId?: string) {
  return useQuery({
    queryKey: ["routines", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase.from("routines").select("*").eq("workspace_id", workspaceId!).order("start_time", { nullsFirst: false }).order("title");
      if (error) throw error;
      return data as Routine[];
    },
  });
}

/** Histórico dos últimos 400 dias (suficiente para sequência e taxa). */
export function useRoutineLogs(workspaceId?: string) {
  return useQuery({
    queryKey: ["routine_logs", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 400);
      const { data, error } = await supabase.from("routine_logs").select("*").eq("workspace_id", workspaceId!).gte("log_date", toISO(since));
      if (error) throw error;
      return data as RoutineLog[];
    },
  });
}

export type RoutineInput = Omit<TablesInsert<"routines">, "workspace_id" | "created_by" | "id">;

export async function createRoutine(workspaceId: string, userId: string, input: RoutineInput) {
  const { error } = await supabase.from("routines").insert({ ...input, workspace_id: workspaceId, created_by: userId });
  if (error) throw error;
}
export async function updateRoutine(id: string, input: Partial<RoutineInput>) {
  const { error } = await supabase.from("routines").update(input).eq("id", id);
  if (error) throw error;
}
export async function deleteRoutine(id: string) {
  const { error } = await supabase.from("routines").delete().eq("id", id);
  if (error) throw error;
}

/** Marca (ou desfaz, se já tiver o mesmo status) o check-in do dia. */
export async function setRoutineLog(r: Routine, userId: string, date: string, status: "DONE" | "SKIPPED" | null) {
  if (!status) {
    const { error } = await supabase.from("routine_logs").delete().eq("routine_id", r.id).eq("log_date", date);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("routine_logs")
    .upsert({ routine_id: r.id, workspace_id: r.workspace_id, log_date: date, status, user_id: userId }, { onConflict: "routine_id,log_date" });
  if (error) throw error;
}

export function routineStats(r: Routine, logs: RoutineLog[], today = toISO(new Date())) {
  const mine = new Map(logs.filter((l) => l.routine_id === r.id).map((l) => [l.log_date, l.status]));
  const last30: { date: string; scheduled: boolean; status: string | null }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(parse(today));
    d.setDate(d.getDate() - i);
    const iso = toISO(d);
    last30.push({ date: iso, scheduled: occursOn({ ...r, status: "ACTIVE" }, iso), status: mine.get(iso) ?? null });
  }
  // Sequências: só dias programados contam; pular não quebra nem soma; hoje ainda aberto não quebra.
  let current = 0, best = 0, run = 0, scheduled = 0, done = 0;
  const start = r.start_date > toISO(new Date(parse(today).getTime() - 399 * 86_400_000)) ? r.start_date : toISO(new Date(parse(today).getTime() - 399 * 86_400_000));
  for (let d = parse(start); toISO(d) <= today; d.setDate(d.getDate() + 1)) {
    const iso = toISO(d);
    if (!occursOn({ ...r, status: "ACTIVE" }, iso)) continue;
    const st = mine.get(iso);
    if (st === "SKIPPED") continue;
    if (st === "DONE") { run++; done++; scheduled++; best = Math.max(best, run); }
    else if (iso !== today) { run = 0; scheduled++; }
  }
  current = run;
  const s30 = last30.filter((x) => x.scheduled && x.status !== "SKIPPED" && (x.date !== today || x.status));
  const rate = s30.length ? Math.round((s30.filter((x) => x.status === "DONE").length / s30.length) * 100) : 0;
  const week = (() => {
    const d = parse(today);
    const monday = new Date(d); monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return logs.filter((l) => l.routine_id === r.id && l.status === "DONE" && l.log_date >= toISO(monday) && l.log_date <= today).length;
  })();
  return { current, best, doneDays: done, scheduled, rate, last30, week, todayStatus: mine.get(today) ?? null };
}
