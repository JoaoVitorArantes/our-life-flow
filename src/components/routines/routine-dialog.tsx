import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContextSelect, NO_CONTEXT } from "@/components/quick/context-select";
import { useApp } from "@/features/app/app-context";
import { useGoals } from "@/features/planner/queries";
import { useRecurring } from "@/features/finance/queries";
import { ACTIVITY_TYPES } from "@/features/activities/queries";
import {
  FREQUENCIES, ROUTINE_ICONS, ROUTINE_PERSONS, WEEKDAYS, createRoutine, updateRoutine,
  type Routine, type RoutineFrequency, type RoutineKind,
} from "@/features/routines/queries";
import { toDateInput } from "@/lib/format";

const NONE = "none";

export function RoutineDialog({ open, onOpenChange, routine, defaultKind = "ROUTINE" }: {
  open: boolean; onOpenChange: (o: boolean) => void; routine?: Routine | null; defaultKind?: RoutineKind;
}) {
  const { workspaceId, userId } = useApp();
  const qc = useQueryClient();
  const { data: goals = [] } = useGoals(workspaceId);
  const { data: recurrences = [] } = useRecurring(workspaceId);
  const [kind, setKind] = useState<RoutineKind>(defaultKind);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState<RoutineFrequency>("DAILY");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [monthDays, setMonthDays] = useState("");
  const [interval, setInterval] = useState("2");
  const [startDate, setStartDate] = useState(toDateInput());
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("");
  const [person, setPerson] = useState("COUPLE");
  const [contextId, setContextId] = useState(NO_CONTEXT);
  const [goalId, setGoalId] = useState(NONE);
  const [recurringId, setRecurringId] = useState(NONE);
  const [activityType, setActivityType] = useState(NONE);
  const [dailyTarget, setDailyTarget] = useState("");
  const [weeklyTarget, setWeeklyTarget] = useState("");
  const [icon, setIcon] = useState("✨");
  const [status, setStatus] = useState("ACTIVE");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const r = routine;
    setKind((r?.kind as RoutineKind) ?? defaultKind);
    setTitle(r?.title ?? "");
    setDescription(r?.description ?? "");
    setFrequency((r?.frequency as RoutineFrequency) ?? "DAILY");
    setWeekdays(r?.weekdays ?? []);
    setMonthDays((r?.month_days ?? []).join(", "));
    setInterval(String(r?.interval_days ?? 2));
    setStartDate(r?.start_date ?? toDateInput());
    setTime(r?.start_time?.slice(0, 5) ?? "");
    setDuration(r?.duration_minutes ? String(r.duration_minutes) : "");
    setPerson(r?.person_scope ?? "COUPLE");
    setContextId(r?.context_id ?? NO_CONTEXT);
    setGoalId(r?.goal_id ?? NONE);
    setRecurringId(r?.recurring_id ?? NONE);
    setActivityType(r?.activity_type ?? NONE);
    setDailyTarget(r?.daily_target ? String(r.daily_target) : "");
    setWeeklyTarget(r?.weekly_target ? String(r.weekly_target) : "");
    setIcon(r?.icon ?? "✨");
    setStatus(r?.status ?? "ACTIVE");
  }, [open, routine, defaultKind]);

  async function save() {
    if (!workspaceId || !userId) return;
    if (!title.trim()) { toast.error("Dê um nome para a rotina ou hábito."); return; }
    if ((frequency === "WEEKDAYS") && !weekdays.length) { toast.error("Escolha pelo menos um dia da semana."); return; }
    const days = monthDays.split(/[,\s]+/).map(Number).filter((n) => n >= 1 && n <= 31);
    if (frequency === "MONTH_DAYS" && !days.length) { toast.error("Informe os dias do mês (ex.: 1, 15)."); return; }
    const input = {
      kind, title: title.trim(), description: description.trim() || null, frequency,
      weekdays, month_days: days, interval_days: frequency === "CUSTOM" ? Math.max(1, Number(interval) || 1) : null,
      start_date: startDate || toDateInput(), start_time: time || null,
      duration_minutes: Number(duration) > 0 ? Number(duration) : null, person_scope: person,
      context_id: contextId === NO_CONTEXT ? null : contextId, goal_id: goalId === NONE ? null : goalId,
      recurring_id: recurringId === NONE ? null : recurringId, activity_type: activityType === NONE ? null : activityType,
      daily_target: Number(dailyTarget) > 0 ? Number(dailyTarget) : null, weekly_target: Number(weeklyTarget) > 0 ? Number(weeklyTarget) : null,
      icon, status,
    };
    setSaving(true);
    try {
      if (routine) await updateRoutine(routine.id, input);
      else await createRoutine(workspaceId, userId, input);
      await qc.invalidateQueries({ queryKey: ["routines", workspaceId] });
      toast.success(routine ? "Atualizado." : kind === "HABIT" ? "Hábito criado." : "Rotina criada.");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally { setSaving(false); }
  }

  const toggleDay = (d: number) => setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d].sort()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{routine ? "Editar" : kind === "HABIT" ? "Novo hábito" : "Nova rotina"}</DialogTitle>
          <DialogDescription>Ocorrências são calculadas a partir da frequência — nada vira tarefa ou evento.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(["ROUTINE", "HABIT"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setKind(k)}
                className={`min-h-11 rounded-xl border px-3 text-sm ${kind === k ? "border-primary bg-primary/15" : "border-border text-muted-foreground"}`}>
                {k === "ROUTINE" ? "🗓️ Rotina" : "🌱 Hábito"}
              </button>
            ))}
          </div>
          <div className="space-y-1.5"><Label>Nome *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "HABIT" ? "Beber água, Ler…" : "Academia, Estudar AOC…"} /></div>
          <div className="space-y-1.5"><Label>Ícone</Label>
            <div className="flex flex-wrap gap-1.5">{ROUTINE_ICONS.map((i) => (
              <button key={i} type="button" onClick={() => setIcon(i)} className={`size-10 rounded-lg border text-lg ${icon === i ? "border-primary bg-primary/15" : "border-border"}`}>{i}</button>
            ))}</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Frequência</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as RoutineFrequency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FREQUENCIES.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Começa em</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
          </div>
          {frequency === "WEEKDAYS" || frequency === "WEEKLY" ? (
            <div className="flex flex-wrap gap-1.5">{WEEKDAYS.map((w, i) => (
              <button key={w} type="button" onClick={() => toggleDay(i)} className={`min-h-10 min-w-11 rounded-lg border px-2 text-sm ${weekdays.includes(i) ? "border-primary bg-primary/15" : "border-border text-muted-foreground"}`}>{w}</button>
            ))}</div>
          ) : null}
          {frequency === "MONTH_DAYS" ? <div className="space-y-1.5"><Label>Dias do mês</Label><Input value={monthDays} onChange={(e) => setMonthDays(e.target.value)} placeholder="1, 15" /></div> : null}
          {frequency === "CUSTOM" ? <div className="space-y-1.5"><Label>A cada quantos dias?</Label><Input inputMode="numeric" value={interval} onChange={(e) => setInterval(e.target.value)} /></div> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Horário</Label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Duração (min)</Label><Input inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} /></div>
          </div>
          {kind === "HABIT" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Meta diária (vezes)</Label><Input inputMode="numeric" value={dailyTarget} onChange={(e) => setDailyTarget(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Meta semanal (dias)</Label><Input inputMode="numeric" value={weeklyTarget} onChange={(e) => setWeeklyTarget(e.target.value)} /></div>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Pessoa</Label>
              <Select value={person} onValueChange={setPerson}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROUTINE_PERSONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.emoji} {p.label}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1.5"><Label>Contexto</Label><ContextSelect value={contextId} onChange={setContextId} /></div>
            <div className="space-y-1.5"><Label>Meta relacionada</Label>
              <Select value={goalId} onValueChange={setGoalId}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={NONE}>Nenhuma</SelectItem>{goals.map((g) => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1.5"><Label>Atividade física</Label>
              <Select value={activityType} onValueChange={setActivityType}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={NONE}>Não é atividade</SelectItem>{ACTIVITY_TYPES.map((a) => <SelectItem key={a.value} value={a.value}>{a.emoji} {a.label}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Gasto relacionado (só exibição)</Label>
              <Select value={recurringId} onValueChange={setRecurringId}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={NONE}>Nenhum</SelectItem>{recurrences.map((r) => <SelectItem key={r.id} value={r.id}>{r.description}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Descrição</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          {routine ? (
            <div className="space-y-1.5"><Label>Situação</Label>
              <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ACTIVE">Ativa</SelectItem><SelectItem value="PAUSED">Pausada</SelectItem><SelectItem value="ARCHIVED">Arquivada</SelectItem></SelectContent></Select>
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
