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

export type BudgetTx = Pick<
  import("@/integrations/supabase/types").Tables<"transactions">,
  "type" | "status" | "amount" | "transaction_date" | "category_id" | "visibility" | "owner_id"
>;

/**
 * Despesas do ano consultado (qualquer ano), direto do banco e sob RLS — não depende da lista
 * geral de lançamentos, que é limitada aos mais recentes. A chave começa com "transactions" para
 * ser atualizada junto com qualquer mudança em lançamentos.
 */
export function useBudgetYearExpenses(workspaceId: string | undefined, year: number) {
  return useQuery({
    queryKey: ["transactions", workspaceId, "budget-year", year],
    enabled: !!workspaceId,
    queryFn: async () => {
      const y = String(year).padStart(4, "0");
      const out: BudgetTx[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("transactions")
          .select("type,status,amount,transaction_date,category_id,visibility,owner_id")
          .eq("workspace_id", workspaceId!)
          .eq("type", "EXPENSE")
          .neq("status", "CANCELLED")
          .gte("transaction_date", `${y}-01-01`)
          .lte("transaction_date", `${y}-12-31`)
          .order("transaction_date")
          .range(from, from + 999);
        if (error) throw error;
        out.push(...((data ?? []) as BudgetTx[]));
        if (!data || data.length < 1000) break;
      }
      return out;
    },
  });
}
