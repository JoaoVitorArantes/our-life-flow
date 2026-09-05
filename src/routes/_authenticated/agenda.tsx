import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { PageHeader, Panel, PanelTitle } from "@/components/common/page";
import { EmptyState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/features/app/app-context";
import { useEvents } from "@/features/planner/queries";
import { formatDateShort, formatTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — Life OS" },
      { name: "description", content: "Compromissos pessoais e compartilhados em um só lugar." },
      { property: "og:title", content: "Agenda — Life OS" },
      { property: "og:description", content: "Seus compromissos no Life OS." },
    ],
  }),
  component: Agenda,
});

function Agenda() {
  const { workspaceId, openQuickAction } = useApp();
  const { data: events = [], isLoading } = useEvents(workspaceId);

  if (isLoading) return <LoadingState />;

  const today = new Date(new Date().toDateString());
  const upcoming = events.filter((event) => new Date(event.starts_at) >= today);
  const past = events.filter((event) => new Date(event.starts_at) < today).reverse();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Agenda"
        subtitle="Seus próximos compromissos"
        action={
          <Button size="sm" onClick={() => openQuickAction("event")}>
            Novo evento
          </Button>
        }
      />

      <Panel>
        <PanelTitle>Próximos</PanelTitle>
        {upcoming.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Nenhum compromisso"
            description="Sua agenda está livre."
            action={
              <Button size="sm" variant="outline" onClick={() => openQuickAction("event")}>
                Novo evento
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {upcoming.map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateShort(new Date(event.starts_at))} · {formatTime(event.starts_at)}
                  </p>
                </div>
                {event.visibility === "SHARED" ? <Badge variant="outline">Nós</Badge> : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {past.length > 0 ? (
        <Panel>
          <PanelTitle>Anteriores</PanelTitle>
          <ul className="divide-y divide-border">
            {past.slice(0, 10).map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-3 py-3 text-muted-foreground">
                <p className="truncate text-sm">{event.title}</p>
                <span className="numeric shrink-0 text-xs">
                  {formatDateShort(new Date(event.starts_at))}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
