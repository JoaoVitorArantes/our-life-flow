import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TrashTable = "tasks" | "notes" | "goals" | "contexts" | "events" | "purchases";

export const TRASH_LABELS: Record<TrashTable, string> = {
  tasks: "Tarefa",
  notes: "Nota",
  goals: "Meta",
  contexts: "Contexto",
  events: "Evento",
  purchases: "Compra",
};

async function run(table: TrashTable, id: string, op: "delete" | "restore" | "purge") {
  const { error } = await supabase.rpc("trash_record", { _table: table, _id: id, _op: op });
  if (error) throw error;
}

/** Moves a record to the workspace trash (server checks membership and ownership). */
export const moveToTrash = (table: TrashTable, id: string) => run(table, id, "delete");
export const restoreFromTrash = (table: TrashTable, id: string) => run(table, id, "restore");
/** Permanent deletion; only allowed for records already in the trash. */
export const purgeFromTrash = (table: TrashTable, id: string) => run(table, id, "purge");

export type TrashItem = {
  table_name: TrashTable;
  id: string;
  label: string | null;
  deleted_at: string;
  deleted_by: string | null;
  can_manage: boolean;
};

export function useTrash(workspaceId?: string) {
  return useQuery({
    queryKey: ["trash", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_trash", { _workspace_id: workspaceId! });
      if (error) throw error;
      return (data ?? []) as TrashItem[];
    },
  });
}
