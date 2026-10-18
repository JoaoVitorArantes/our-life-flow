import { expect, test } from "vitest";
import { calendarAgendaItems, eventsInputSchema, type CalendarEvent } from "./events";
import { readCalendarEvents } from "./events.server";
const event: CalendarEvent = { id: "real-id", summary: "Consulta", calendarId: "personal", calendarName: "Pessoal", calendarTimeZone: "America/Sao_Paulo", start: { date: "2026-10-21" }, end: { date: "2026-10-24" } };
test("all-day 21–24 cobre apenas 21, 22 e 23 sem conversão de fuso", () => {
  expect(calendarAgendaItems([event], "2026-10-18", "2026-10-31", "America/Sao_Paulo").map((i) => i.date)).toEqual(["2026-10-21", "2026-10-22", "2026-10-23"]);
});
test("timed conserva instante e mostra hora local com término real", () => {
  const rows = calendarAgendaItems([{ ...event, start: { dateTime: "2026-10-22T01:00:00Z" }, end: { dateTime: "2026-10-22T02:00:00Z" } }], "2026-10-18", "2026-10-31", "America/Sao_Paulo");
  expect(rows[0]?.date).toBe("2026-10-21"); expect(rows[0]?.minutes).toBe(1320); expect(rows[0]?.endMinutes).toBe(1380); expect(rows[0]?.event).toBeUndefined();
});
test("eventos cancelados não entram na Agenda", () => {
  expect(calendarAgendaItems([{ ...event, status: "cancelled" }], "2026-10-18", "2026-10-31", "UTC")).toEqual([]);
});
test("rejeita intervalo invertido e fuso inválido", () => {
  expect(eventsInputSchema.safeParse({ workspaceId: "2c3cecfb-b766-443e-987e-954fe96c5cdb", from: "2026-10-22T00:00:00Z", to: "2026-10-21T00:00:00Z", timeZone: "UTC" }).success).toBe(false);
  expect(eventsInputSchema.safeParse({ workspaceId: "2c3cecfb-b766-443e-987e-954fe96c5cdb", from: "2026-10-21T00:00:00Z", to: "2026-10-22T00:00:00Z", timeZone: "fake" }).success).toBe(false);
});
test("consulta paginada expande recorrências e não perde a segunda página", async () => {
  const paths: string[] = [];
  const result = await readCalendarEvents(async (path) => {
    paths.push(path);
    return Response.json(path.includes("calendarList") ? { items: [{ id: "email@example.test", summary: "Pessoal" }] } : path.includes("pageToken") ? { items: [{ ...event, id: "second" }] } : { items: [event], nextPageToken: "page2" });
  }, { from: "2026-10-18T00:00:00Z", to: "2026-10-31T00:00:00Z", timeZone: "UTC" });
  expect(result.events.map((e) => e.id)).toEqual(["real-id", "second"]);
  expect(paths[1]).toContain("singleEvents=true"); expect(paths[1]).toContain("email%40example.test"); expect(result.truncated).toBe(false);
});