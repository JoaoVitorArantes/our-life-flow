import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, Panel, PanelTitle } from "@/components/common/page";
import { EmptyState, LoadingState } from "@/components/common/states";
import { RecordActions } from "@/components/common/record-actions";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/app/app-context";
import { useContexts } from "@/features/contexts/queries";
import { useGoals } from "@/features/planner/queries";
import { useRecurring } from "@/features/finance/queries";
import {
  ROUTINE_PERSONS, deleteRoutine, frequencyLabel, occursOn, routineStats, useRoutineLogs, useRoutines, type Routine,
} from "@/features/routines/queries";
import { RoutineRow } from "@/components/routines/routine-row";
import { RoutineDialog } from "@/components/routines/routine-dialog";
import { toISO } from "@/features/finance/calc";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/rotinas")({
  head: () => ({
    meta: [
      { title: "Rotinas & Hábitos — Life OS" },
      { name: "description", content: "Rotinas e hábitos de João e Renifer, com check-in diário, sequência e histórico." },
      { property: "og:title", content: "Rotinas & Hábitos — Life OS" },
      { property: "og:description", content: "Check-in diário, sequências e histórico dos hábitos do casal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Rotinas,
});

function Rotinas() {
  const { workspaceId } = useApp();
  const qc = useQueryClient();
  const routinesQ = useRoutines(workspaceId);
  const logsQ = useRoutineLogs(workspaceId);
  const { data: contexts = [] } = useContexts(workspaceId);
  const { data: goals = [] } = useGoals(workspaceId);
  const { data: recurrences = [] } = useRecurring(workspaceId);
  const [editing, setEditing] = useState<Routine | null>(null);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"ROUTINE" | "HABIT">("ROUTINE");
  const today = toISO(new Date());
  const logs = logsQ.data ?? [];
  const all = (routinesQ.data ?? []).filter((r) => r.status !== "ARCHIVED");
  const todayList = all.filter((r) => occursOn(r, today));

  const openNew = (k: "ROUTINE" | "HABIT") => { setEditing(null); setKind(k); setOpen(true); };

  async function remove(r: Routine) {
    try {
      await deleteRoutine(r.id);
      await qc.invalidateQueries({ queryKey: ["routines", workspaceId] });
      toast.success("Removido.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  if (routinesQ.isLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rotinas & Hábitos"
        subtitle="O que vocês repetem para viver melhor."
        action={<div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => openNew("HABIT")}>🌱 Hábito</Button><Button size="sm" onClick={() => openNew("ROUTINE")}>🗓️ Rotina</Button></div>}
      />

      {!all.length ? (
        <EmptyState title="Nenhuma rotina ainda" description="Crie uma rotina (Academia, Estudar) ou um hábito (Beber água, Ler)." />
      ) : (
        <>
          <Panel>
            <PanelTitle>Hoje</PanelTitle>
            {todayList.length ? (
              <ul className="-mx-2 space-y-0.5">
                {todayList.map((r) => <RoutineRow key={r.id} routine={r} date={today} status={logs.find((l) => l.routine_id === r.id && l.log_date === today)?.status ?? null} />)}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Nada programado para hoje.</p>}
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
            {all.map((r) => {
              const s = routineStats(r, logs, today);
              const ctx = contexts.find((c) => c.id === r.context_id);
              const goal = goals.find((g) => g.id === r.goal_id);
              const rec = recurrences.find((x) => x.id === r.recurring_id);
              const person = ROUTINE_PERSONS.find((p) => p.value === r.person_scope);
              return (
                <Panel key={r.id} className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{r.kind === "HABIT" ? "Hábito" : "Rotina"}{r.status === "PAUSED" ? " · pausada" : ""}</p>
                      <p className="truncate font-medium">{r.icon} {r.title}</p>
                      <p className="text-xs text-muted-foreground">{[frequencyLabel(r), r.start_time?.slice(0, 5), person ? `${person.emoji} ${person.label}` : null].filter(Boolean).join(" · ")}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>Editar</Button>
                      <RecordActions onDelete={() => remove(r)} confirmTitle="Excluir esta rotina?" confirmDescription="O histórico de check-ins dela também será apagado." />
                    </div>
                  </div>
                  <dl className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div><dt className="text-muted-foreground">Sequência</dt><dd className="text-base font-semibold">{s.current}</dd></div>
                    <div><dt className="text-muted-foreground">Melhor</dt><dd className="text-base font-semibold">{s.best}</dd></div>
                    <div><dt className="text-muted-foreground">Feitos</dt><dd className="text-base font-semibold">{s.doneDays}</dd></div>
                    <div><dt className="text-muted-foreground">30 dias</dt><dd className="text-base font-semibold">{s.rate}%</dd></div>
                  </dl>
                  <div className="flex gap-[3px]" aria-label="Últimos 30 dias">
                    {s.last30.map((d) => (
                      <span key={d.date} title={d.date} className={`h-5 flex-1 rounded-sm ${d.status === "DONE" ? "bg-primary" : d.status === "SKIPPED" ? "bg-muted-foreground/40" : d.scheduled ? "bg-elevated" : "bg-transparent"}`} />
                    ))}
                  </div>
                  {r.weekly_target ? <p className="text-xs text-muted-foreground">Semana: {s.week}/{r.weekly_target} dias</p> : null}
                  {ctx || goal || rec ? (
                    <p className="text-xs text-muted-foreground">
                      {[ctx ? `Contexto: ${ctx.name}` : null, goal ? `Meta: ${goal.title}` : null, rec ? `Relacionado a: ${rec.description} ${formatCurrency(Number(rec.amount))}/mês` : null].filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                </Panel>
              );
            })}
          </div>
        </>
      )}
      <RoutineDialog open={open} onOpenChange={setOpen} routine={editing} defaultKind={kind} />
    </div>
  );
}
