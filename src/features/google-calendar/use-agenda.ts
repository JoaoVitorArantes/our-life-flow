import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCalendarEvents } from "./calendar.functions";
import { calendarAgendaItems } from "./events";
import { isoOf } from "@/features/agenda/queries";

export function useCalendarAgenda(userId: string | undefined, workspaceId: string | undefined, from: Date, to: Date) {
  const fetchEvents = useServerFn(getCalendarEvents);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const query = useQuery({
    queryKey: ["google_calendar_events", userId, workspaceId, isoOf(from), isoOf(to), timeZone],
    queryFn: () => {
      if (!workspaceId) throw new Error("Selecione um espaço.");
      return fetchEvents({ data: { workspaceId, from: from.toISOString(), to: to.toISOString(), timeZone } });
    },
    enabled: Boolean(userId && workspaceId), retry: false, staleTime: 60000,
  });
  const end = new Date(to); end.setDate(end.getDate() - 1);
  return { ...query, items: query.data?.state === "connected" ? calendarAgendaItems(query.data.events, isoOf(from), isoOf(end), timeZone) : [], timeZone };
}