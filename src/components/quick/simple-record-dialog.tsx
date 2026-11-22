import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveSimpleRecord, type SimpleKind } from "@/features/records/mutations";
import { useApp } from "@/features/app/app-context";
import { parseAmount, toDateInput } from "@/lib/format";
import { ContextSelect, NO_CONTEXT } from "./context-select";

export type { SimpleKind } from "@/features/records/mutations";

type SimpleRecord = {
  id: string;
  title: string;
  context_id?: string | null;
  visibility?: string | null;
  content?: string | null;
  due_date?: string | null;
  starts_at?: string | null;
  target_amount?: number | string | null;
  start_date?: string | null;
  recurrence?: string | null;
  recurrence_months?: number | null;
  period_amount?: number | string | null;
};

type Recurrence = "NONE" | "MONTHLY" | "YEARLY" | "CUSTOM";

const CONFIG: Record<
  SimpleKind,
  { title: string; editTitle: string; label: string; queryKey: string }
> = {
  event: {
    title: "Novo evento",
    editTitle: "Editar evento",
    label: "Título do evento",
    queryKey: "events",
  },
  task: {
    title: "Nova tarefa",
    editTitle: "Editar tarefa",
    label: "O que precisa ser feito?",
    queryKey: "tasks",
  },
  goal: { title: "Nova meta", editTitle: "Editar meta", label: "Nome da meta", queryKey: "goals" },
  note: {
    title: "Nova nota",
    editTitle: "Editar nota",
    label: "Título da nota",
    queryKey: "notes",
  },
};

export function SimpleRecordDialog({
  kind,
  open,
  onOpenChange,
  record,
  defaultContextId,
}: {
  kind: SimpleKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: SimpleRecord | null;
  defaultContextId?: string | null;
}) {
  const { workspaceId, userId, activeContextId } = useApp();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(toDateInput());
  const [time, setTime] = useState("19:00");
  const [target, setTarget] = useState("");
  const [content, setContent] = useState("");
  const [contextId, setContextId] = useState<string>(NO_CONTEXT);
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("NONE");
  const [months, setMonths] = useState("3");
  const [periodAmount, setPeriodAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const config = CONFIG[kind];
  const isEditing = !!record;

  useEffect(() => {
    if (!open) return;
    if (record) {
      setTitle(record.title ?? "");
      setContent(record.content ?? "");
      setTarget(record.target_amount ? String(Number(record.target_amount)).replace(".", ",") : "");
      setContextId(record.context_id ?? NO_CONTEXT);
      setStartDate(record.start_date ?? "");
      setDueDate(record.due_date ?? "");
      setRecurrence(((record.recurrence as Recurrence) || "NONE"));
      setMonths(String(record.recurrence_months ?? 3));
      setPeriodAmount(record.period_amount ? String(Number(record.period_amount)).replace(".", ",") : "");
      if (record.starts_at) {
        const start = new Date(record.starts_at);
        setDate(toDateInput(start));
        setTime(
          `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`,
        );
      } else if (record.due_date) {
        setDate(record.due_date);
      }
    } else {
      setTitle("");
      setContent("");
      setTarget("");
      setDate(toDateInput());
      setTime("19:00");
      setStartDate(kind === "goal" ? toDateInput() : "");
      setDueDate("");
      setRecurrence("NONE");
      setMonths("3");
      setPeriodAmount("");
      setContextId(defaultContextId ?? activeContextId ?? NO_CONTEXT);
    }
  }, [open, record, defaultContextId, activeContextId, kind]);

  async function handleSubmit() {
    if (!workspaceId || !userId) return;
    if (!title.trim()) {
      toast.error("Informe um título.");
      return;
    }
    setSaving(true);
    try {
      await saveSimpleRecord(
        kind,
        workspaceId,
        userId,
        {
          title,
          contextId: contextId === NO_CONTEXT ? null : contextId,
          date,
          time,
          amount: parseAmount(target) || null,
          content,
          ...(kind === "goal"
            ? {
                goal: {
                  startDate: startDate || null,
                  dueDate: dueDate || null,
                  recurrence,
                  recurrenceMonths: recurrence === "CUSTOM" ? Number(months) || null : null,
                  periodAmount: recurrence !== "NONE" ? parseAmount(periodAmount) || null : null,
                },
              }
            : {}),
        },
        record?.id,
      );

      await queryClient.invalidateQueries({ queryKey: [config.queryKey] });
      await queryClient.invalidateQueries({ queryKey: ["goal", record?.id] });
      toast.success(isEditing ? "Registro atualizado." : "Registro criado.");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? config.editTitle : config.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">{config.label}</Label>
            <Input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              autoFocus
            />
          </div>

          {kind === "goal" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="target">Valor alvo (opcional)</Label>
                <Input id="target" inputMode="decimal" placeholder="R$ 0,00" value={target} onChange={(event) => setTarget(event.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="goal-start">Começa em</Label>
                  <Input id="goal-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="goal-due">Prazo (opcional)</Label>
                  <Input id="goal-due" type="date" value={dueDate} min={startDate || undefined} onChange={(event) => setDueDate(event.target.value)} />
                  <p className="text-xs text-muted-foreground">{dueDate ? <button type="button" className="underline" onClick={() => setDueDate("")}>Tornar contínua (sem prazo)</button> : "Sem prazo: a meta é contínua."}</p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="goal-freq">Frequência</Label>
                  <select id="goal-freq" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={recurrence} onChange={(event) => setRecurrence(event.target.value as Recurrence)}>
                    <option value="NONE">Sem frequência</option>
                    <option value="MONTHLY">Mensal</option>
                    <option value="YEARLY">Anual</option>
                    <option value="CUSTOM">A cada N meses</option>
                  </select>
                </div>
                {recurrence === "CUSTOM" ? (
                  <div className="space-y-2">
                    <Label htmlFor="goal-months">A cada quantos meses</Label>
                    <Input id="goal-months" type="number" min={1} max={120} value={months} onChange={(event) => setMonths(event.target.value)} />
                  </div>
                ) : null}
                {recurrence !== "NONE" ? (
                  <div className="space-y-2">
                    <Label htmlFor="goal-period">Juntar por período (opcional)</Label>
                    <Input id="goal-period" inputMode="decimal" placeholder="R$ 0,00" value={periodAmount} onChange={(event) => setPeriodAmount(event.target.value)} />
                  </div>
                ) : null}
              </div>
            </div>
          ) : kind !== "note" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date">{kind === "task" ? "Prazo" : "Data"}</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
              {kind === "event" ? (
                <div className="space-y-2">
                  <Label htmlFor="time">Horário</Label>
                  <Input
                    id="time"
                    type="time"
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="content">Conteúdo</Label>
              <Textarea
                id="content"
                rows={4}
                value={content}
                onChange={(event) => setContent(event.target.value)}
              />
            </div>
          )}

          <ContextSelect value={contextId} onChange={setContextId} />

          <Button className="w-full" disabled={saving} onClick={handleSubmit}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
