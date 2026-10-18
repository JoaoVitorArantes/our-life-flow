import { z } from "zod";
import { eventSchema, type CalendarEvent } from "./events";

export async function readCalendarEvents(
  call: (path: string) => Promise<Response>,
  range: { from: string; to: string; timeZone: string },
) {
  const calendarsSchema = z.object({
    items: z
      .array(
        z.object({
          id: z.string(),
          summary: z.string().optional(),
          timeZone: z.string().optional(),
          deleted: z.boolean().optional(),
        }),
      )
      .optional(),
    nextPageToken: z.string().optional(),
  });
  const eventsSchema = z.object({
    items: z.array(eventSchema).optional(),
    nextPageToken: z.string().optional(),
  });
  const calendars: z.infer<typeof calendarsSchema>["items"] = [];
  let token: string | undefined;
  let truncated = false;
  for (let page = 0; page < 5; page++) {
    const params = new URLSearchParams({
      maxResults: "100",
      ...(token ? { pageToken: token } : {}),
    });
    const result = calendarsSchema.parse(
      await (await call(`/calendar/v3/users/me/calendarList?${params}`)).json(),
    );
    calendars.push(...(result.items ?? []).filter((c) => !c.deleted));
    token = result.nextPageToken;
    if (!token) break;
  }
  truncated = Boolean(token) || calendars.length > 50;
  const events: CalendarEvent[] = [];
  for (const calendar of calendars.slice(0, 50)) {
    token = undefined;
    for (let page = 0; page < 10; page++) {
      const params = new URLSearchParams({
        timeMin: range.from,
        timeMax: range.to,
        timeZone: range.timeZone,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "250",
        ...(token ? { pageToken: token } : {}),
      });
      const result = eventsSchema.parse(
        await (
          await call(`/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?${params}`)
        ).json(),
      );
      events.push(
        ...(result.items ?? []).map((event) => ({
          ...event,
          calendarId: calendar.id,
          calendarName: calendar.summary ?? "Calendário",
          calendarTimeZone: calendar.timeZone ?? range.timeZone,
        })),
      );
      token = result.nextPageToken;
      if (!token) break;
    }
    truncated ||= Boolean(token);
  }
  return { events, truncated };
}
