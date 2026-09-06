import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CreatedBy } from "@/components/common/created-by";
import { ActivityDialog } from "@/components/activities/activity-dialog";
import { useApp } from "@/features/app/app-context";
import { contextEmoji, useContexts } from "@/features/contexts/queries";
import {
  activityDayLabel,
  activityEmoji,
  activityLabel,
  deleteActivity,
  formatClock,
  formatDistance,
  formatDuration,
  personEmoji,
  personLabel,
  type Activity,
} from "@/features/activities/queries";
import { formatDateShort } from "@/lib/format";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-2 last:border-0">
      <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <span className="text-right text-sm">{value}</span>
    </div>
  );
}

export function ActivityDetail({
  activity,
  open,
  onOpenChange,
}: {
  activity: Activity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { workspaceId } = useApp();
  const { data: contexts = [] } = useContexts(workspaceId);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!activity) return null;
  const context = contexts.find((item) => item.id === activity.context_id);
  const duration = formatDuration(activity.duration_minutes);
  const distance = formatDistance(activity.distance_km);
  const clock = formatClock(activity.start_time);

  async function handleDelete() {
    if (!activity) return;
    try {
      await deleteActivity(activity.id);
      await queryClient.invalidateQueries({ queryKey: ["activities"] });
      toast.success("Atividade excluída.");
      setConfirmDelete(false);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir.");
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-left">
              <span className="text-2xl">{activityEmoji(activity.activity_type)}</span>
              {activity.title}
            </DialogTitle>
            <DialogDescription className="text-left">
              {activityLabel(activity.activity_type)} · {activityDayLabel(activity.activity_date)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                {personEmoji(activity.person_scope)} {personLabel(activity.person_scope)}
              </Badge>
              {context ? (
                <Badge variant="outline">
                  {contextEmoji(context.type)} {context.name}
                </Badge>
              ) : null}
            </div>

            {duration || distance ? (
              <div className="grid grid-cols-2 gap-3">
                {duration ? (
                  <div className="rounded-2xl border border-border bg-surface p-4">
                    <p className="text-xs text-muted-foreground">⏱️ Duração</p>
                    <p className="numeric mt-1 text-xl font-semibold">{duration}</p>
                  </div>
                ) : null}
                {distance ? (
                  <div className="rounded-2xl border border-border bg-surface p-4">
                    <p className="text-xs text-muted-foreground">📍 Distância</p>
                    <p className="numeric mt-1 text-xl font-semibold">{distance}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {activity.description ? (
              <p className="rounded-2xl bg-muted/60 p-4 text-sm">“{activity.description}”</p>
            ) : null}

            <div>
              <Row label="Data" value={formatDateShort(activity.activity_date)} />
              {clock ? <Row label="Horário" value={clock} /> : null}
              {activity.location ? <Row label="Local" value={activity.location} /> : null}
              {activity.notes ? <Row label="Observações" value={activity.notes} /> : null}
            </div>

            <div className="flex items-center justify-between gap-3">
              <CreatedBy userId={activity.created_by} />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="size-4" /> Editar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ActivityDialog open={editing} onOpenChange={setEditing} activity={activity} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir atividade?</AlertDialogTitle>
            <AlertDialogDescription>
              “{activity.title}” será removida do histórico. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
