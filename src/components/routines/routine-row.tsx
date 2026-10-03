import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/features/app/app-context";
import { ActivityDialog } from "@/components/activities/activity-dialog";
import { ROUTINE_PERSONS, setRoutineLog, type Routine } from "@/features/routines/queries";

/** Linha de check-in de uma rotina/hábito num dia. Concluir/pular e desfazer. */
export function RoutineRow({ routine, date, status, extra }: { routine: Routine; date: string; status: string | null; extra?: React.ReactNode }) {
  const { workspaceId, userId } = useApp();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const person = ROUTINE_PERSONS.find((p) => p.value === routine.person_scope);

  async function mark(next: "DONE" | "SKIPPED") {
    if (!userId) return;
    const value = status === next ? null : next;
    setBusy(true);
    try {
      await setRoutineLog(routine, userId, date, value);
      await qc.invalidateQueries({ queryKey: ["routine_logs", workspaceId] });
      if (value === "DONE" && routine.activity_type) {
        toast.success("Feito! Quer registrar como atividade?", {
          action: { label: "Registrar atividade", onClick: () => setActivityOpen(true) },
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally { setBusy(false); }
  }

  const done = status === "DONE";
  const skipped = status === "SKIPPED";
  return (
    <li className={`flex items-center gap-3 rounded-xl px-2 py-2 transition-colors ${done ? "opacity-70" : ""}`}>
      <button
        type="button"
        aria-label={done ? `Desfazer ${routine.title}` : `Concluir ${routine.title}`}
        disabled={busy}
        onClick={() => mark("DONE")}
        className={`grid size-11 shrink-0 place-items-center rounded-full border text-lg transition-all ${done ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"}`}
      >
        {done ? <Check className="size-5" /> : <span>{routine.icon ?? "✨"}</span>}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${done ? "line-through" : ""} ${skipped ? "text-muted-foreground" : ""}`}>{routine.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[routine.start_time?.slice(0, 5), routine.duration_minutes ? `${routine.duration_minutes} min` : null, person ? `${person.emoji} ${person.label}` : null, skipped ? "pulado" : null].filter(Boolean).join(" · ")}
        </p>
        {extra}
      </div>
      <button type="button" disabled={busy} onClick={() => mark("SKIPPED")} aria-label={skipped ? "Desfazer pular" : "Pular hoje"}
        className={`grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-elevated ${skipped ? "bg-elevated text-foreground" : ""}`}>
        <SkipForward className="size-4" />
      </button>
      {routine.activity_type ? (
        <ActivityDialog open={activityOpen} onOpenChange={setActivityOpen} defaultContextId={routine.context_id}
          prefill={{ activity_type: routine.activity_type, title: routine.title, duration_minutes: routine.duration_minutes, person_scope: routine.person_scope, time: routine.start_time }} />
      ) : null}
    </li>
  );
}
