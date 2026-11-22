import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { BudgetOp, BudgetRule } from "./budgets";

export function useBudgetRules(workspaceId?: string) {
  return useQuery({
    queryKey: ["budget_rules", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_rules")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("start_month");
      if (error) throw error;
      return (data ?? []) as BudgetRule[];
    },
  });
}

/** Aplica operações planejadas (RLS e o gatilho de validação continuam sendo a fronteira). */
export function useApplyBudgetOps(workspaceId?: string, userId?: string) {
  const qc = useQueryClient();
  return async (ops: BudgetOp[]) => {
    if (!workspaceId || !userId) throw new Error("Sessão ou espaço indisponível.");
    for (const op of ops) {
      const q =
        op.type === "insert"
          ? supabase
              .from("budget_rules")
              .insert({ ...op.row, workspace_id: workspaceId, owner_id: userId })
          : op.type === "update"
            ? supabase
                .from("budget_rules")
                .update(op.patch)
                .eq("id", op.id)
                .eq("workspace_id", workspaceId)
            : supabase
                .from("budget_rules")
                .delete()
                .eq("id", op.id)
                .eq("workspace_id", workspaceId);
      const { error } = await q;
      if (error) {
        await qc.invalidateQueries({ queryKey: ["budget_rules", workspaceId] });
        throw new Error(error.message || "Não foi possível salvar o orçamento.");
      }
    }
    await qc.invalidateQueries({ queryKey: ["budget_rules", workspaceId] });
  };
}
