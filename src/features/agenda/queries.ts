import { useMemo } from "react";
import type { Tables, Enums } from "@/integrations/supabase/types";
import { useEvents, useTasks, useGoals, useNotes, type Event } from "@/features/planner/queries";
import { useRecurring, useTransactions, type Transaction } from "@/features/finance/queries";
import { getProjectedRecurring } from "@/features/finance/safe-to-spend";
import { useContexts } from "@/features/contexts/queries";
import { dueDateOf, statusOf, toISO } from "@/features/finance/calc";

export type AgendaKind = "event" | "task" | "finance" | "goal" | "note";
export type EventRecurrence = Enums<"event_recurrence">;
export type EventStatus = Enums<"event_status">;

export type AgendaItem = {
  /** Unique key of the occurrence (recurring events repeat the same record id). */
  key: string;
  recordId: string;
  kind: AgendaKind;
  title: string;
  /** YYYY-MM-DD of the occurrence. */
  date: string;
  /** Minutes from midnight when the item has a time, otherwise null. */
  minutes: number | null;
  endMinutes: number | null;
  amount: number | null;
  contextId: string | null;
  ownerId: string | null;
  done: boolean;
  overdue: boolean;
  hint: string | null;
  location: string | null;
  recurring: boolean;
  event?: Event;
  task?: Tables<"tasks">;
  goal?: Tables<"goals">;
  note?: Tables<"notes">;
  transaction?: Transaction;
};

const pad = (n: number) => String(n).padStart(2, "0");

export const isoOf = (date: Date) => toISO(date);

export function parseISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfWeek(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return addDays(start, -start.getDay());
}

export function startOfMonthGrid(date: Date) {
  return startOfWeek(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function minutesLabel(minutes: number | null) {
  if (minutes == null) return null;
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** Dates on which a (possibly recurring) event happens inside [from, to]. */
export function eventOccurrences(event: Event, from: Date, to: Date) {
  const start = new Date(event.starts_at);
  const first = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const recurrence = event.recurrence as EventRecurrence | null;
  const skipped = new Set(event.recurrence_exceptions ?? []);
  const limit = event.recurrence_until ? parseISO(event.recurrence_until) : null;
  const dates: string[] = [];

  if (!recurrence) {
    const iso = isoOf(first);
    if (first >= from && first <= to && !skipped.has(iso)) dates.push(iso);
    return dates;
  }

  const hardStop = limit && limit < to ? limit : to;
  let cursor = new Date(first);
  for (let i = 0; i < 800 && cursor <= hardStop; i += 1) {
    if (cursor >= from) {
      const iso = isoOf(cursor);
      if (!skipped.has(iso)) dates.push(iso);
    }
    if (recurrence === "DAILY") cursor = addDays(cursor, 1);
    else if (recurrence === "WEEKLY") cursor = addDays(cursor, 7);
    else if (recurrence === "MONTHLY") {
      const next = new Date(first);
      next.setMonth(first.getMonth() + i + 1);
      cursor = next;
    } else {
      const next = new Date(first);
      next.setFullYear(first.getFullYear() + i + 1);
      cursor = next;
    }
  }
  return dates;
}

function financeHint(t: Transaction, todayIso: string) {
  const due = dueDateOf(t);
  const status = statusOf(t);
  if (status === "PAID") return "Pago";
  if (status === "CANCELLED") return "Cancelado";
  if (due === todayIso) return "Vence hoje";
  if (due && due < todayIso) return "Vencido";
  return "A vencer";
}

/**
 * Single source of truth for everything time-based in the Life OS.
 * Reuses the module queries already cached by React Query — no extra fetches.
 */
export function useAgendaItems(workspaceId?: string, range?: { from: Date; to: Date }) {
  const events = useEvents(workspaceId);
  const tasks = useTasks(workspaceId);
  const goals = useGoals(workspaceId);
  const notes = useNotes(workspaceId);
  const transactions = useTransactions(workspaceId);
  const recurring = useRecurring(workspaceId);
  const contexts = useContexts(workspaceId);

  const from = range?.from ?? addDays(new Date(), -400);
  const to = range?.to ?? addDays(new Date(), 400);
  const fromIso = isoOf(from);
  const toIso = isoOf(to);

  const items = useMemo<AgendaItem[]>(() => {
    const todayIso = isoOf(new Date());
    const list: AgendaItem[] = [];

    for (const event of events.data ?? []) {
      const start = new Date(event.starts_at);
      const end = event.ends_at ? new Date(event.ends_at) : null;
      const minutes = start.getHours() * 60 + start.getMinutes();
      const endMinutes = end ? end.getHours() * 60 + end.getMinutes() : null;
      for (const date of eventOccurrences(event, from, to)) {
        list.push({
          key: `event:${event.id}:${date}`,
          recordId: event.id,
          kind: "event",
          title: event.title,
          date,
          minutes,
          endMinutes,
          amount: null,
          contextId: event.context_id,
          ownerId: event.owner_id,
          done: event.status === "DONE",
          overdue: false,
          hint: event.status === "CANCELLED" ? "Cancelado" : null,
          location: event.location,
          recurring: !!event.recurrence,
          event,
        });
      }
    }

    for (const task of tasks.data ?? []) {
      if (!task.due_date || task.due_date < fromIso || task.due_date > toIso) continue;
      const done = task.status === "DONE";
      list.push({
        key: `task:${task.id}`,
        recordId: task.id,
        kind: "task",
        title: task.title,
        date: task.due_date,
        minutes: null,
        endMinutes: null,
        amount: null,
        contextId: task.context_id,
        ownerId: task.owner_id,
        done,
        overdue: !done && task.due_date < todayIso,
        hint: done ? "Concluída" : !done && task.due_date < todayIso ? "Atrasada" : null,
        location: null,
        recurring: false,
        task,
      });
    }

    for (const t of transactions.data ?? []) {
      if (t.type === "TRANSFER") continue;
      const due = dueDateOf(t);
      if (!due || due < fromIso || due > toIso) continue;
      const status = statusOf(t);
      list.push({
        key: `finance:${t.id}`,
        recordId: t.id,
        kind: "finance",
        title: t.description,
        date: due,
        minutes: null,
        endMinutes: null,
        amount: Number(t.amount),
        contextId: t.context_id,
        ownerId: t.owner_id,
        done: status === "PAID",
        overdue: status === "OVERDUE",
        hint: financeHint(t, todayIso),
        location: null,
        recurring: !!t.recurring_id,
        transaction: t,
      });
    }

    // Previsões de recorrentes (ex.: salário): mesmas do Dinheiro livre, nunca gravadas.
    const projFrom = fromIso > todayIso ? fromIso : todayIso;
    if (projFrom <= toIso) {
      for (const t of getProjectedRecurring(recurring.data ?? [], transactions.data ?? [], projFrom, toIso)) {
        const due = dueDateOf(t);
        if (due < fromIso || due > toIso) continue;
        list.push({
          key: `finance:${t.id}`,
          recordId: t.id,
          kind: "finance",
          title: `${t.description} (previsto)`,
          date: due,
          minutes: null,
          endMinutes: null,
          amount: Number(t.amount),
          contextId: t.context_id,
          ownerId: t.owner_id,
          done: false,
          overdue: false,
          hint: "Previsão de recorrente",
          location: null,
          recurring: true,
        });
      }
    }

    for (const goal of goals.data ?? []) {
      if (!goal.due_date || goal.due_date < fromIso || goal.due_date > toIso) continue;
      const done = goal.status === "DONE";
      list.push({
        key: `goal:${goal.id}`,
        recordId: goal.id,
        kind: "goal",
        title: goal.title,
        date: goal.due_date,
        minutes: null,
        endMinutes: null,
        amount: goal.target_amount != null ? Number(goal.target_amount) : null,
        contextId: goal.context_id,
        ownerId: goal.owner_id,
        done,
        overdue: !done && goal.due_date < todayIso,
        hint: done ? "Meta concluída" : "Prazo da meta",
        location: null,
        recurring: false,
        goal,
      });
    }

    for (const note of notes.data ?? []) {
      if (!note.note_date || note.note_date < fromIso || note.note_date > toIso) continue;
      list.push({
        key: `note:${note.id}`,
        recordId: note.id,
        kind: "note",
        title: note.title,
        date: note.note_date,
        minutes: null,
        endMinutes: null,
        amount: null,
        contextId: note.context_id,
        ownerId: note.owner_id,
        done: false,
        overdue: false,
        hint: "Nota",
        location: null,
        recurring: false,
        note,
      });
    }

    return list.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      const am = a.minutes ?? 24 * 60 + 1;
      const bm = b.minutes ?? 24 * 60 + 1;
      if (am !== bm) return am - bm;
      return a.title.localeCompare(b.title);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.data, tasks.data, transactions.data, recurring.data, goals.data, notes.data, fromIso, toIso]);

  return {
    items,
    contexts: contexts.data ?? [],
    isLoading:
      events.isLoading ||
      tasks.isLoading ||
      transactions.isLoading ||
      goals.isLoading ||
      notes.isLoading,
  };
}

export function groupByDate(items: AgendaItem[]) {
  const map = new Map<string, AgendaItem[]>();
  for (const item of items) {
    const bucket = map.get(item.date);
    if (bucket) bucket.push(item);
    else map.set(item.date, [item]);
  }
  return map;
}

export const KIND_LABEL: Record<AgendaKind, string> = {
  event: "Evento",
  task: "Tarefa",
  finance: "Financeiro",
  goal: "Meta",
  note: "Nota",
};

export const EVENT_RECURRENCES: { value: EventRecurrence; label: string }[] = [
  { value: "DAILY", label: "Diário" },
  { value: "WEEKLY", label: "Semanal" },
  { value: "MONTHLY", label: "Mensal" },
  { value: "YEARLY", label: "Anual" },
];

export const EVENT_STATUSES: { value: EventStatus; label: string }[] = [
  { value: "SCHEDULED", label: "Agendado" },
  { value: "DONE", label: "Concluído" },
  { value: "CANCELLED", label: "Cancelado" },
];
