import { supabase } from "@/integrations/supabase/client";

export type SimpleKind = "event" | "task" | "goal" | "note";
export type SimpleRecordInput = {
  title: string;
  contextId: string | null;
  date: string | null;
  time: string | null;
  amount: number | null;
  content: string;
};

/** Shared by the quick form and confirmed Inbox actions; RLS remains the write boundary. */
export async function saveSimpleRecord(
  kind: SimpleKind, workspaceId: string, userId: string,
  input: SimpleRecordInput, recordId?: string,
): Promise<{ id: string }> {
  if (!input.title.trim()) throw new Error("Informe um título.");
  const shape = { title: input.title.trim(), context_id: input.contextId, visibility: "SHARED" as const };
  const owner = { workspace_id: workspaceId, owner_id: userId };
  const table = { event: "events", task: "tasks", goal: "goals", note: "notes" } as const;
  const values = kind === "event"
    ? { ...shape, starts_at: new Date(`${input.date}T${input.time ?? "09:00"}`).toISOString() }
    : kind === "task" ? { ...shape, due_date: input.date }
    : kind === "goal" ? { ...shape, target_amount: input.amount, due_date: input.date }
    : { ...shape, content: input.content };
  const query = recordId
    ? supabase.from(table[kind]).update(values).eq("workspace_id", workspaceId).eq("id", recordId)
    : supabase.from(table[kind]).insert({ ...values, ...owner });
  const { data, error } = await query.select("id").single();
  if (error) throw error;
  if (!data?.id) throw new Error("Não foi possível confirmar o registro salvo.");
  return { id: data.id };
}