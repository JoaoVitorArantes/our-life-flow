import { z } from "zod";
import type { AgendaItem } from "@/features/agenda/queries";

export const eventsInputSchema = z.object({
  workspaceId: z.string().uuid(),
  from: z.string().datetime({ offset: true }),
  to: z.string().datetime({ offset: true }),
  timeZone: z.string().max(100).refine((value) => {
    try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
  }),
}).strict().refine(({ from, to }) => Date.parse(to) > Date.parse(from) && Date.parse(to) - Date.parse(from) <= 100 * 86400000, "Período inválido.");

const boundary = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), dateTime: z.string().datetime({ offset: true }).optional(), timeZone: z.string().optional() });
export const eventSchema = z.object({
  id: z.string(), summary: z.string().optional(), status: z.string().optional(),
  start: boundary.optional(), end: boundary.optional(), recurringEventId: z.string().optional(),
});
export type CalendarEvent = z.infer<typeof eventSchema> & { calendarId: string; calendarName: string; calendarTimeZone: string };

function dateParts(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const part = (key: string) => parts.find((p) => p.type === key)?.value ?? "00";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, minutes: Number(part("hour")) * 60 + Number(part("minute")) };
}
function nextDate(date: string) {
  const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + 1); return value.toISOString().slice(0, 10);
}
export function calendarAgendaItems(events: CalendarEvent[], from: string, to: string, timeZone: string): AgendaItem[] {
  const items: AgendaItem[] = [];
  for (const event of events) {
    if (event.status === "cancelled" || !event.start || !event.end) continue;
    const allDay = Boolean(event.start.date);
    const start = event.start.date ? { date: event.start.date, minutes: null } : event.start.dateTime ? dateParts(event.start.dateTime, timeZone) : null;
    const end = event.end.date ? { date: event.end.date, minutes: null } : event.end.dateTime ? dateParts(event.end.dateTime, timeZone) : null;
    if (!start || !end) continue;
    for (let date = start.date < from ? from : start.date, count = 0; date <= to && count < 101; date = nextDate(date), count++) {
      if (allDay ? date >= end.date : date > end.date || (date === end.date && end.minutes === 0 && date !== start.date)) break;
      items.push({ key: `google:${event.calendarId}:${event.id}:${date}`, recordId: event.id, kind: "event", title: event.summary ?? "Sem título", date,
        minutes: allDay ? null : date === start.date ? start.minutes : 0,
        endMinutes: allDay ? null : date === end.date ? end.minutes : 1440,
        amount: null, contextId: null, ownerId: null, done: false, overdue: false, location: null, recurring: Boolean(event.recurringEventId),
        hint: `Google · ${event.calendarName} · somente leitura`,
        googleCalendar: { calendarName: event.calendarName, timeZone: event.start.timeZone ?? event.calendarTimeZone, start: event.start.dateTime ?? event.start.date ?? "", end: event.end.dateTime ?? event.end.date ?? "", allDay },
      });
    }
  }
  return items;
}