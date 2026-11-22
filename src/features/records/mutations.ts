import { supabase } from "@/integrations/supabase/client";

export type SimpleKind = "event" | "task" | "goal" | "note";
export type SimpleRecordInput = {
  title: string;
  contextId: string | null;
  date: string | null;
  time: string | null;
  amount: number | null;
  content: string;
  /** Campos de meta contínua (formulário de metas). Ausentes = comportamento antigo (date = prazo). */
  goal?: {
    startDate: string | null;
    dueDate: string | null;
    recurrence: "NONE" | "MONTHLY" | "YEARLY" | "CUSTOM";
    recurrenceMonths: number | null;
    periodAmount: number | null;
  };
};

/** Shared by the quick form and confirmed Inbox actions; RLS remains the write boundary. */
export async function saveSimpleRecord(
  kind: SimpleKind,
  workspaceId: string,
  userId: string,
  input: SimpleRecordInput,
  recordId?: string,
): Promise<{ id: string }> {
  if (!input.title.trim()) throw new Error("Informe um título.");
  if (input.goal) {
    const g = input.goal;
    if (g.startDate && g.dueDate && g.dueDate < g.startDate)
      throw new Error("O prazo não pode ser antes do início.");
    if (g.recurrence === "CUSTOM" && !(g.recurrenceMonths && g.recurrenceMonths >= 1 && g.recurrenceMonths <= 120))
      throw new Error("Informe a cada quantos meses (1 a 120).");
    if (g.periodAmount !== null && !(g.periodAmount > 0)) throw new Error("Valor por período inválido.");
  }
  const shape = {
    title: input.title.trim(),
    context_id: input.contextId,
    visibility: "SHARED" as const,
  };
  const owner = { workspace_id: workspaceId, owner_id: userId };
  const table = { event: "events", task: "tasks", goal: "goals", note: "notes" } as const;
  const values =
    kind === "event"
      ? { ...shape, starts_at: new Date(`${input.date}T${input.time ?? "09:00"}`).toISOString() }
      : kind === "task"
        ? { ...shape, due_date: input.date }
        : kind === "goal"
          ? input.goal
            ? {
                ...shape,
                target_amount: input.amount,
                due_date: input.goal.dueDate,
                start_date: input.goal.startDate,
                recurrence: input.goal.recurrence,
                recurrence_months: input.goal.recurrence === "CUSTOM" ? input.goal.recurrenceMonths : null,
                period_amount: input.goal.recurrence === "NONE" ? null : input.goal.periodAmount,
              }
            : { ...shape, target_amount: input.amount, due_date: input.date }
          : { ...shape, content: input.content };
  const query = recordId
    ? supabase.from(table[kind]).update(values).eq("workspace_id", workspaceId).eq("id", recordId)
    : supabase.from(table[kind]).insert({ ...values, ...owner });
  const { data, error } = await query.select("id").single();
  if (error) throw error;
  if (!data?.id) throw new Error("Não foi possível confirmar o registro salvo.");
  return { id: data.id };
}
