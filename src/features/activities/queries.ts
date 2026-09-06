import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { parseDateOnly } from "@/lib/format";

export type Activity = Tables<"physical_activities">;

export type ActivityPerson = "JOAO" | "RENIFER" | "COUPLE";

export const ACTIVITY_TYPES: { value: string; label: string; emoji: string; group: string }[] = [
  { value: "GYM", label: "Academia", emoji: "🏋️", group: "GYM" },
  { value: "WALK", label: "Caminhada", emoji: "🚶", group: "WALK" },
  { value: "RUN", label: "Corrida", emoji: "🏃", group: "RUN" },
  { value: "BIKE", label: "Bicicleta", emoji: "🚴", group: "BIKE" },
  { value: "SWIM", label: "Natação", emoji: "🏊", group: "SPORTS" },
  { value: "SOCCER", label: "Futebol", emoji: "⚽", group: "SPORTS" },
  { value: "BASKET", label: "Basquete", emoji: "🏀", group: "SPORTS" },
  { value: "TENNIS", label: "Tênis", emoji: "🎾", group: "SPORTS" },
  { value: "TRAIL", label: "Trilha", emoji: "🥾", group: "OUTDOOR" },
  { value: "YOGA", label: "Alongamento/Yoga", emoji: "🧘", group: "OTHER" },
  { value: "PARK", label: "Parque/ao ar livre", emoji: "🌳", group: "OUTDOOR" },
  { value: "SPORT_OTHER", label: "Outro esporte", emoji: "🏅", group: "SPORTS" },
  { value: "OTHER", label: "Outra atividade", emoji: "✨", group: "OTHER" },
];

export const ACTIVITY_GROUPS: { value: string; label: string }[] = [
  { value: "GYM", label: "Academia" },
  { value: "WALK", label: "Caminhada" },
  { value: "RUN", label: "Corrida" },
  { value: "BIKE", label: "Bike" },
  { value: "SPORTS", label: "Esportes" },
  { value: "OUTDOOR", label: "Ao ar livre" },
  { value: "OTHER", label: "Outros" },
];

export const ACTIVITY_PERSONS: { value: ActivityPerson; label: string; emoji: string }[] = [
  { value: "COUPLE", label: "Nós", emoji: "👥" },
  { value: "JOAO", label: "João", emoji: "👤" },
  { value: "RENIFER", label: "Renifer", emoji: "👤" },
];

export function activityLabel(type: string) {
  return ACTIVITY_TYPES.find((item) => item.value === type)?.label ?? type;
}
export function activityEmoji(type: string) {
  return ACTIVITY_TYPES.find((item) => item.value === type)?.emoji ?? "✨";
}
export function activityGroup(type: string) {
  return ACTIVITY_TYPES.find((item) => item.value === type)?.group ?? "OTHER";
}
export function personLabel(scope: string) {
  return ACTIVITY_PERSONS.find((item) => item.value === scope)?.label ?? scope;
}
export function personEmoji(scope: string) {
  return ACTIVITY_PERSONS.find((item) => item.value === scope)?.emoji ?? "👤";
}

/** 85 -> "1h 25min" | 45 -> "45 min" */
export function formatDuration(minutes?: number | null) {
  if (minutes == null || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  if (!rest) return `${hours}h`;
  return `${hours}h ${String(rest).padStart(2, "0")}min`;
}

export function formatDistance(km?: number | null) {
  const value = km == null ? null : Number(km);
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return `${value.toFixed(value % 1 === 0 ? 0 : 1).replace(".", ",")} km`;
}

export function formatClock(time?: string | null) {
  if (!time) return null;
  return time.slice(0, 5);
}

/** "Hoje" | "Ontem" | "domingo, 07 de setembro" */
export function activityDayLabel(dateISO: string) {
  const date = parseDateOnly(dateISO);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - date.getTime()) / 86_400_000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  if (diff > 1 && diff < 7) {
    return new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(date);
  }
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long" }).format(date);
}

export function useActivities(workspaceId?: string) {
  return useQuery({
    queryKey: ["activities", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("physical_activities")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("activity_date", { ascending: false })
        .order("start_time", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Activity[];
    },
  });
}

export type ActivityInput = {
  activity_type: string;
  title: string;
  description?: string | null;
  activity_date: string;
  start_time?: string | null;
  duration_minutes?: number | null;
  distance_km?: number | null;
  location?: string | null;
  person_scope: ActivityPerson;
  context_id?: string | null;
  notes?: string | null;
};

export async function createActivity(
  workspaceId: string,
  createdBy: string,
  input: ActivityInput,
) {
  const { data, error } = await supabase
    .from("physical_activities")
    .insert({ ...input, workspace_id: workspaceId, created_by: createdBy })
    .select("*")
    .single();
  if (error) throw error;
  return data as Activity;
}

export async function updateActivity(id: string, input: Partial<ActivityInput>) {
  const { error } = await supabase.from("physical_activities").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteActivity(id: string) {
  const { error } = await supabase.from("physical_activities").delete().eq("id", id);
  if (error) throw error;
}

/** Resumo real do período — nunca inventa valores. */
export function summarize(items: Activity[]) {
  const minutes = items.reduce((sum, item) => sum + (item.duration_minutes ?? 0), 0);
  const distance = items.reduce((sum, item) => sum + Number(item.distance_km ?? 0), 0);
  const together = items.filter((item) => item.person_scope === "COUPLE").length;
  const days = new Set(items.map((item) => item.activity_date)).size;
  const joao = items.filter((item) => item.person_scope === "JOAO").length;
  const renifer = items.filter((item) => item.person_scope === "RENIFER").length;
  return {
    count: items.length,
    minutes,
    distance,
    together,
    days,
    joao,
    renifer,
    solo: joao + renifer,
  };
}

/** Frases leves apenas quando existem dados que as sustentem. */
export function activityInsights(items: Activity[], periodLabel: string) {
  const stats = summarize(items);
  if (!stats.count) return [];
  const today = new Date().toISOString().slice(0, 10);
  const insights: string[] = [];
  if (items.some((item) => item.activity_date === today)) {
    insights.push("Hoje já teve movimento por aí 👀");
  }
  if (stats.together > 0) {
    insights.push(
      `Vocês fizeram ${stats.together} ${stats.together === 1 ? "atividade" : "atividades"} ${
        stats.together === 1 ? "junto" : "juntos"
      } ${periodLabel} ❤️`,
    );
  }
  if (stats.days > 1) {
    insights.push(`Vocês estiveram ativos em ${stats.days} dias ${periodLabel}.`);
  }
  const byType = new Map<string, number>();
  for (const item of items) byType.set(item.activity_type, (byType.get(item.activity_type) ?? 0) + 1);
  const ranked = [...byType.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length > 1 && ranked[0]![1] > ranked[1]![1]) {
    insights.push(
      `Essa temporada teve mais ${activityLabel(ranked[0]![0]).toLowerCase()} do que ${activityLabel(
        ranked[1]![0],
      ).toLowerCase()}.`,
    );
  }
  return insights.slice(0, 3);
}
