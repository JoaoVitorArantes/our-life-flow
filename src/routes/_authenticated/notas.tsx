import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { StickyNote } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/common/page";
import { EmptyState, LoadingState } from "@/components/common/states";
import { RecordActions } from "@/components/common/record-actions";
import { Button } from "@/components/ui/button";
import { CreatedBy } from "@/components/common/created-by";
import { Badge } from "@/components/ui/badge";
import { SimpleRecordDialog } from "@/components/quick/simple-record-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/features/app/app-context";
import { useNotes, type Note } from "@/features/planner/queries";

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
  const { workspaceId, userId, openQuickAction } = useApp();
  const { data: notes = [], isLoading } = useNotes(workspaceId);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Note | null>(null);

  if (isLoading) return <LoadingState />;

  async function remove(note: Note) {
    try {
      const { error } = await supabase.from("notes").delete().eq("id", note.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Nota excluída.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir.");
    }
  }

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
                <p className="min-w-0 flex-1 truncate font-medium">{note.title}</p>
                <div className="flex items-center gap-2">
                  <CreatedBy userId={note.owner_id} />
                  <RecordActions
                    onEdit={() => setEditing(note)}
                    onDelete={() => remove(note)}
                    confirmTitle="Excluir esta nota?"
                    confirmDescription="Essa ação não poderá ser desfeita."
                  />
                </div>
              </div>
              {note.content ? (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{note.content}</p>
              ) : null}
            </Panel>
          ))}
        </div>
      )}

      <SimpleRecordDialog
        kind="note"
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        record={editing}
      />
    </div>
  );
}
