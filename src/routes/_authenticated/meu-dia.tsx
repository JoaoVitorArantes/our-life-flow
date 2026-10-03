import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel, PanelTitle } from "@/components/common/page";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/app/app-context";
import { useAgendaItems, minutesLabel } from "@/features/agenda/queries";
import { setTaskDone } from "@/features/agenda/mutations";
import { useGoals, useTasks } from "@/features/planner/queries";
import { useActivities, activityEmoji, formatDuration } from "@/features/activities/queries";
import { useSafeToSpend } from "@/features/finance/use-safe-to-spend";
import { useRoutines, useRoutineLogs, occursOn, routineStats } from "@/features/routines/queries";
import { RoutineRow } from "@/components/routines/routine-row";
import { RoutineDialog } from "@/components/routines/routine-dialog";
import { ActivityDialog } from "@/components/activities/activity-dialog";
import { relationshipDuration } from "@/components/nos/relationship-time";
import { toISO } from "@/features/finance/calc";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/meu-dia")({
  head: () => ({
    meta: [
      { title: "Meu Dia — Life OS" },
      { name: "description", content: "O que importa hoje: agenda, rotinas, tarefas, metas e dinheiro livre em um só lugar." },
      { property: "og:title", content: "Meu Dia — Life OS" },
      { property: "og:description", content: "Veja o que importa hoje no Life OS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MeuDia,
});

function greeting(h: number) {
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

/** Escopo pessoal pelo primeiro nome do perfil (João/Renifer); "Nós" vale para ambos. */
export function scopeOf(name?: string | null) {
  const n = (name ?? "").toLowerCase();
  if (n.startsWith("renifer")) return "RENIFER";
  if (n.startsWith("jo")) return "JOAO";
  return null;
}

function MeuDia() {
  const { workspaceId, profile, relationship, openQuickAction } = useApp();
  const qc = useQueryClient();
  const now = new Date();
  const today = toISO(now);
  const firstName = (profile?.name ?? "").split(" ")[0] || "";
  const myScope = scopeOf(profile?.name);
  const range = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return { from: d, to: d }; }, []);
  const agenda = useAgendaItems(workspaceId, range);
  const tasksQ = useTasks(workspaceId);
  const goalsQ = useGoals(workspaceId);
  const activitiesQ = useActivities(workspaceId);
  const routinesQ = useRoutines(workspaceId);
  const logsQ = useRoutineLogs(workspaceId);
  const safe = useSafeToSpend(workspaceId);
  const [routineOpen, setRoutineOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);

  const events = agenda.items.filter((i) => i.kind === "event" && i.date === today);
  const finance = agenda.items.filter((i) => i.kind === "finance" && i.date === today && !i.done);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const nextEvent = events.find((e) => e.minutes != null && e.minutes >= nowMin);

  const tasks = (tasksQ.data ?? []).filter((t) => t.status !== "DONE" && t.due_date && t.due_date <= today)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));
  const overdue = tasks.filter((t) => t.due_date! < today);

  const logs = logsQ.data ?? [];
  const todays = (routinesQ.data ?? []).filter((r) => occursOn(r, today));
  const mine = todays.filter((r) => r.person_scope === "COUPLE" || !myScope || r.person_scope === myScope);
  const partner = todays.filter((r) => myScope && r.person_scope !== "COUPLE" && r.person_scope !== myScope);
  const statusOf = (id: string) => logs.find((l) => l.routine_id === id && l.log_date === today)?.status ?? null;
  const doneCount = mine.filter((r) => statusOf(r.id) === "DONE").length;

  const goals = (goalsQ.data ?? []).filter((g) => g.status === "ACTIVE").map((g) => ({
    g, days: g.due_date ? Math.round((new Date(`${g.due_date}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86_400_000) : null,
  })).filter((x) => x.days != null && x.days >= 0 && x.days <= 14).sort((a, b) => a.days! - b.days!).slice(0, 3);

  const todayActivities = (activitiesQ.data ?? []).filter((a) => a.activity_date === today);
  const together = events.filter((e) => e.event?.visibility === "SHARED").length + todays.filter((r) => r.person_scope === "COUPLE").length;
  const rel = relationship?.status === "ACTIVE" && relationship.started_at ? relationshipDuration(new Date(relationship.started_at), now) : null;

  const insights: string[] = [];
  insights.push(events.length ? `Hoje vocês têm ${events.length} ${events.length === 1 ? "compromisso" : "compromissos"}.` : "Agenda livre hoje.");
  if (nextEvent) insights.push(`Seu próximo compromisso é às ${minutesLabel(nextEvent.minutes)}.`);
  const dueToday = tasks.length - overdue.length;
  if (dueToday) insights.push(`Você tem ${dueToday} ${dueToday === 1 ? "tarefa" : "tarefas"} para hoje.`);
  if (overdue.length) insights.push(`${overdue.length} ${overdue.length === 1 ? "tarefa está atrasada" : "tarefas estão atrasadas"}.`);
  insights.push(finance.length ? `Hoje vencem ${finance.length} ${finance.length === 1 ? "pagamento" : "pagamentos"}.` : "Hoje não há nenhum vencimento financeiro.");
  if (goals[0]) insights.push(goals[0].days === 0 ? `A meta "${goals[0].g.title}" vence hoje.` : `Você está a ${goals[0].days} ${goals[0].days === 1 ? "dia" : "dias"} da meta "${goals[0].g.title}".`);

  async function completeTask(id: string) {
    try {
      await setTaskDone(id, true);
      await qc.invalidateQueries({ queryKey: ["tasks", workspaceId] });
      toast.success("Tarefa concluída.", { action: { label: "Desfazer", onClick: async () => { await setTaskDone(id, false); await qc.invalidateQueries({ queryKey: ["tasks", workspaceId] }); } } });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  const hasFinance = !!safe && (safe.available !== 0 || safe.commitments !== 0 || safe.income !== 0);
  const quick: { label: string; on: () => void }[] = [
    { label: "Tarefa", on: () => openQuickAction("task") },
    { label: "Nota", on: () => openQuickAction("note") },
    { label: "Evento", on: () => openQuickAction("event") },
    { label: "Despesa", on: () => openQuickAction("expense") },
    { label: "Receita", on: () => openQuickAction("income") },
    { label: "Atividade", on: () => setActivityOpen(true) },
    { label: "Hábito", on: () => setRoutineOpen(true) },
    { label: "Meta", on: () => openQuickAction("goal") },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={`${greeting(now.getHours())}${firstName ? `, ${firstName}` : ""} 👋`} subtitle={new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(now)} />

      <section className="space-y-1.5 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-surface to-surface p-5">
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Veja o que importa hoje</p>
        {insights.slice(0, 4).map((t) => <p key={t} className="text-sm">{t}</p>)}
      </section>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {quick.map((q) => (
          <Button key={q.label} size="sm" variant="outline" className="min-h-10 shrink-0 rounded-full" onClick={q.on}><Plus className="mr-1 size-3.5" />{q.label}</Button>
        ))}
      </div>

      {hasFinance && safe ? (
        <Link to="/financeiro" className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-primary/50">
          <span className="text-2xl">💰</span>
          <div>
            <p className={`text-xl font-semibold tabular-nums ${safe.spendable <= 0 ? "text-destructive" : ""}`}>{formatCurrency(safe.spendable)}</p>
            <p className="text-xs text-muted-foreground">Dinheiro livre</p>
          </div>
        </Link>
      ) : null}

      <Panel>
        <PanelTitle action={<Button asChild size="sm" variant="ghost"><Link to="/agenda">Agenda</Link></Button>}>Agenda de hoje</PanelTitle>
        {events.length || finance.length ? (
          <ol className="relative space-y-3 border-l border-border pl-4">
            {[...events, ...finance].sort((a, b) => (a.minutes ?? 1e4) - (b.minutes ?? 1e4)).map((e) => (
              <li key={e.key} className="relative">
                <span className={`absolute -left-[21px] top-1.5 size-2.5 rounded-full ${e.kind === "finance" ? "bg-warning" : e === nextEvent ? "bg-primary" : "bg-muted-foreground"}`} />
                <p className="text-xs text-muted-foreground">{e.minutes != null ? minutesLabel(e.minutes) : "Dia todo"}{e.location ? ` · ${e.location}` : ""}</p>
                <p className="text-sm font-medium">{e.title}{e.amount != null ? ` · ${formatCurrency(e.amount)}` : ""}</p>
              </li>
            ))}
          </ol>
        ) : <p className="text-sm text-muted-foreground">Nada marcado para hoje.</p>}
      </Panel>

      <Panel>
        <PanelTitle action={<Button asChild size="sm" variant="ghost"><Link to="/rotinas">Rotinas</Link></Button>}>
          Rotinas {mine.length ? `· ${doneCount}/${mine.length}` : ""}
        </PanelTitle>
        {mine.length ? (
          <ul className="-mx-2 space-y-0.5">
            {mine.map((r) => {
              const st = routineStats(r, logs, today);
              return <RoutineRow key={r.id} routine={r} date={today} status={statusOf(r.id)} extra={st.current > 1 ? <p className="text-xs text-primary">{st.current} seguidos</p> : null} />;
            })}
          </ul>
        ) : (
          <div className="text-sm text-muted-foreground">Nenhuma rotina para hoje. <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => setRoutineOpen(true)}>Criar uma</button></div>
        )}
      </Panel>

      <Panel>
        <PanelTitle action={<Button asChild size="sm" variant="ghost"><Link to="/tarefas">Tarefas</Link></Button>}>Tarefas</PanelTitle>
        {tasks.length ? (
          <ul className="space-y-1">
            {tasks.slice(0, 8).map((t) => (
              <li key={t.id} className="flex items-center gap-3">
                <button type="button" aria-label={`Concluir ${t.title}`} onClick={() => completeTask(t.id)} className="grid size-11 shrink-0 place-items-center rounded-full border border-border hover:border-primary">
                  <Check className="size-4 opacity-40" />
                </button>
                <div className="min-w-0">
                  <p className="truncate text-sm">{t.title}</p>
                  <p className={`text-xs ${t.due_date! < today ? "text-destructive" : "text-muted-foreground"}`}>{t.due_date! < today ? "Atrasada" : "Hoje"}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">Nenhuma tarefa para hoje. 🎉</p>}
      </Panel>

      {goals.length ? (
        <Panel>
          <PanelTitle action={<Button asChild size="sm" variant="ghost"><Link to="/metas">Metas</Link></Button>}>Metas perto do prazo</PanelTitle>
          <ul className="space-y-2">
            {goals.map(({ g, days }) => {
              const pct = g.target_amount ? Math.min(100, Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100)) : null;
              return (
                <li key={g.id} className="text-sm">
                  <div className="flex justify-between gap-2"><span className="truncate">{g.title}</span><span className="shrink-0 text-xs text-muted-foreground">{days === 0 ? "hoje" : `${days} d`}</span></div>
                  {pct != null ? <div className="mt-1 h-1.5 rounded-full bg-elevated"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div> : null}
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}

      {todayActivities.length ? (
        <Panel>
          <PanelTitle action={<Button asChild size="sm" variant="ghost"><Link to="/esporte">Esporte</Link></Button>}>Movimento hoje</PanelTitle>
          <ul className="space-y-1 text-sm">
            {todayActivities.map((a) => <li key={a.id}>{activityEmoji(a.activity_type)} {a.title}{formatDuration(a.duration_minutes) ? ` · ${formatDuration(a.duration_minutes)}` : ""}</li>)}
          </ul>
        </Panel>
      ) : null}

      {rel || together || partner.length ? (
        <Panel>
          <PanelTitle action={<Button asChild size="sm" variant="ghost"><Link to="/nos">Nós</Link></Button>}>Nós hoje 💜</PanelTitle>
          <div className="space-y-1 text-sm">
            {rel ? <p>{rel.years ? `${rel.years} ${rel.years === 1 ? "ano" : "anos"}, ` : ""}{rel.months} {rel.months === 1 ? "mês" : "meses"} e {rel.days} {rel.days === 1 ? "dia" : "dias"} juntos.</p> : null}
            {together ? <p className="text-muted-foreground">{together} {together === 1 ? "coisa" : "coisas"} de vocês dois hoje.</p> : null}
            {partner.length ? (
              <p className="text-muted-foreground">Rotinas do(a) parceiro(a): {partner.map((r) => `${r.icon ?? ""} ${r.title}${statusOf(r.id) === "DONE" ? " ✓" : ""}`).join(", ")}</p>
            ) : null}
          </div>
        </Panel>
      ) : null}

      <RoutineDialog open={routineOpen} onOpenChange={setRoutineOpen} defaultKind="HABIT" />
      <ActivityDialog open={activityOpen} onOpenChange={setActivityOpen} />
    </div>
  );
}
