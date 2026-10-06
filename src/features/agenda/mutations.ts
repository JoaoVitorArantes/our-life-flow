import { supabase } from "@/integrations/supabase/client";
import { moveToTrash } from "@/features/trash/api";
import type { TablesInsert } from "@/integrations/supabase/types";
import type { Event } from "@/features/planner/queries";
import { addDays, isoOf, parseISO, type EventStatus } from "./queries";

export type EventScope = "this" | "future" | "all";

function combine(dateIso: string, minutes: number) {
  const base = parseISO(dateIso);
  base.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return base.toISOString();
}

function durationMs(event: Event) {
  if (!event.ends_at) return null;
  return new Date(event.ends_at).getTime() - new Date(event.starts_at).getTime();
}

function seriesCopy(event: Event, startsAt: string, endsAt: string | null): TablesInsert<"events"> {
  return {
    workspace_id: event.workspace_id,
    owner_id: event.owner_id,
    title: event.title,
    description: event.description,
    location: event.location,
    context_id: event.context_id,
    visibility: event.visibility,
    status: event.status,
    reminder_minutes: event.reminder_minutes,
    participants: event.participants,
    recurrence: event.recurrence,
    recurrence_until: event.recurrence_until,
    starts_at: startsAt,
    ends_at: endsAt,
  };
}

/**
 * Moves one occurrence of an event. Recurring events are never duplicated as
 * rows: "this" stores an exception + a single detached copy, "future" closes
 * the original series and opens a new one, "all" shifts the series itself.
 */
export async function moveEventOccurrence(
  event: Event,
  occurrenceDate: string,
  target: { date: string; minutes: number },
  scope: EventScope = "all",
) {
  const length = durationMs(event);
  const startsAt = combine(target.date, target.minutes);
  const endsAt = length != null ? new Date(new Date(startsAt).getTime() + length).toISOString() : null;

  if (!event.recurrence || scope === "all") {
    const { error } = await supabase
      .from("events")
      .update({ starts_at: startsAt, ends_at: endsAt })
      .eq("id", event.id);
    if (error) throw error;
    return;
  }

  if (scope === "this") {
    const { error } = await supabase
      .from("events")
      .update({ recurrence_exceptions: [...(event.recurrence_exceptions ?? []), occurrenceDate] })
      .eq("id", event.id);
    if (error) throw error;
    const single = seriesCopy(event, startsAt, endsAt);
    single.recurrence = null;
    single.recurrence_until = null;
    const { error: insertError } = await supabase.from("events").insert(single);
    if (insertError) throw insertError;
    return;
  }

  const previousDay = isoOf(addDays(parseISO(occurrenceDate), -1));
  const { error } = await supabase
    .from("events")
    .update({ recurrence_until: previousDay })
    .eq("id", event.id);
  if (error) throw error;
  const { error: insertError } = await supabase.from("events").insert(seriesCopy(event, startsAt, endsAt));
  if (insertError) throw insertError;
}

export async function deleteEventOccurrence(
  event: Event,
  occurrenceDate: string,
  scope: EventScope = "all",
) {
  if (!event.recurrence || scope === "all") {
    await moveToTrash("events", event.id);
    return;
  }
  if (scope === "this") {
    const { error } = await supabase
      .from("events")
      .update({ recurrence_exceptions: [...(event.recurrence_exceptions ?? []), occurrenceDate] })
      .eq("id", event.id);
    if (error) throw error;
    return;
  }
  const previousDay = isoOf(addDays(parseISO(occurrenceDate), -1));
  const { error } = await supabase
    .from("events")
    .update({ recurrence_until: previousDay })
    .eq("id", event.id);
  if (error) throw error;
}

export async function setEventStatus(id: string, status: EventStatus) {
  const { error } = await supabase.from("events").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function duplicateEvent(event: Event, startsAt?: string) {
  const copy = seriesCopy(event, startsAt ?? event.starts_at, event.ends_at);
  copy.title = `${event.title} (cópia)`;
  copy.recurrence_exceptions = [];
  const { error } = await supabase.from("events").insert(copy);
  if (error) throw error;
}

export async function setTaskDone(id: string, done: boolean) {
  const { error } = await supabase
    .from("tasks")
    .update({ status: done ? "DONE" : "TODO" })
    .eq("id", id);
  if (error) throw error;
}
