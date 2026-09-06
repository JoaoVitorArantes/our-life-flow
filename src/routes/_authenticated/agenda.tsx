import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel, PanelTitle } from "@/components/common/page";
import { EmptyState, LoadingState } from "@/components/common/states";
import { RecordActions } from "@/components/common/record-actions";
import { Button } from "@/components/ui/button";
import { CreatedBy } from "@/components/common/created-by";
import { Badge } from "@/components/ui/badge";
import { SimpleRecordDialog } from "@/components/quick/simple-record-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/features/app/app-context";
import { useEvents, type Event } from "@/features/planner/queries";
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
  const { workspaceId, userId, openQuickAction } = useApp();
  const { data: events = [], isLoading } = useEvents(workspaceId);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Event | null>(null);

  if (isLoading) return <LoadingState />;

  const today = new Date(new Date().toDateString());
  const upcoming = events.filter((event) => new Date(event.starts_at) >= today);
  const past = events.filter((event) => new Date(event.starts_at) < today).reverse();

  async function remove(event: Event) {
    try {
      const { error } = await supabase.from("events").delete().eq("id", event.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Evento excluído.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir.");
    }
  }

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
                <div className="flex shrink-0 items-center gap-2">
                  <CreatedBy userId={event.owner_id} />
                  <RecordActions
                    onEdit={() => setEditing(event)}
                    onDelete={() => remove(event)}
                    confirmTitle="Excluir este evento?"
                    confirmDescription="Essa ação não poderá ser desfeita."
                  />
                </div>
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
              <li key={event.id} className="flex items-center justify-between gap-3 py-3">
                <p className="truncate text-sm text-muted-foreground">{event.title}</p>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="numeric text-xs text-muted-foreground">
                    {formatDateShort(new Date(event.starts_at))}
                  </span>
                  <RecordActions
                    onEdit={() => setEditing(event)}
                    onDelete={() => remove(event)}
                    confirmTitle="Excluir este evento?"
                    confirmDescription="Essa ação não poderá ser desfeita."
                  />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <SimpleRecordDialog
        kind="event"
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        record={editing}
      />
    </div>
  );
}
