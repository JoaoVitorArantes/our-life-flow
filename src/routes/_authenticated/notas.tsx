import { createFileRoute } from "@tanstack/react-router";
import { StickyNote } from "lucide-react";
import { PageHeader, Panel } from "@/components/common/page";
import { EmptyState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/features/app/app-context";
import { useNotes } from "@/features/planner/queries";

export const Route = createFileRoute("/_authenticated/notas")({
  head: () => ({
    meta: [
      { title: "Notas — Life OS" },
      { name: "description", content: "Anotações pessoais e informações compartilhadas." },
      { property: "og:title", content: "Notas — Life OS" },
      { property: "og:description", content: "Suas notas no Life OS." },
    ],
  }),
  component: Notas,
});

function Notas() {
  const { workspaceId, openQuickAction } = useApp();
  const { data: notes = [], isLoading } = useNotes(workspaceId);

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Notas"
        subtitle="Informações que não podem se perder"
        action={
          <Button size="sm" onClick={() => openQuickAction("note")}>
            Nova nota
          </Button>
        }
      />

      {notes.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title="Nenhuma nota"
          description="Guarde senhas de rotina, listas e lembretes."
          action={
            <Button size="sm" variant="outline" onClick={() => openQuickAction("note")}>
              Nova nota
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {notes.map((note) => (
            <Panel key={note.id} className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{note.title}</p>
                {note.visibility === "SHARED" ? <Badge variant="outline">Nós</Badge> : null}
              </div>
              {note.content ? (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{note.content}</p>
              ) : null}
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
