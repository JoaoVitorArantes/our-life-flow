import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type GoalContribution = Tables<"goal_contributions">;
export type GoalMovementType = "CONTRIBUTION" | "WITHDRAWAL";

export const MOVEMENT_LABEL: Record<GoalMovementType, string> = {
  CONTRIBUTION: "Adicionar valor",
  WITHDRAWAL: "Retirar valor",
};

/** Movement type of a row (older rows may carry the sign in the amount). */
export function movementType(item: GoalContribution): GoalMovementType {
  const kind = (item as { movement_type?: string | null }).movement_type;
  if (kind === "WITHDRAWAL") return "WITHDRAWAL";
  if (kind === "CONTRIBUTION") return "CONTRIBUTION";
  return Number(item.amount) < 0 ? "WITHDRAWAL" : "CONTRIBUTION";
}

/** Amount with sign applied: contributions add, withdrawals subtract. */
export function signedAmount(item: GoalContribution) {
  const value = Math.abs(Number(item.amount));
  return movementType(item) === "WITHDRAWAL" ? -value : value;
}

/** Contributions of a single goal, newest first. */
export function useGoalContributions(goalId?: string) {
  return useQuery({
    queryKey: ["goal-contributions", goalId],
    enabled: !!goalId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goal_contributions")
        .select("*")
        .eq("goal_id", goalId!)
        .order("contribution_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as GoalContribution[];
    },
  });
}

/** All contributions the user can read — used to compute progress in lists. */
export function useAllContributions(goalIds: string[]) {
  const key = [...goalIds].sort().join(",");
  return useQuery({
    queryKey: ["goal-contributions-all", key],
    enabled: goalIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goal_contributions")
        .select("*")
        .in("goal_id", goalIds);
      if (error) throw error;
      return data as GoalContribution[];
    },
  });
}

/** Net balance: contributions minus withdrawals. */
export function sumContributions(items: GoalContribution[]) {
  return items.reduce((total, item) => total + signedAmount(item), 0);
}

/** Progress always comes from the movement history. */
export function goalProgress(goal: { id: string }, contributions: GoalContribution[]) {
  return sumContributions(contributions.filter((item) => item.goal_id === goal.id));
}

export async function addContribution(input: {
  workspaceId: string;
  goalId: string;
  userId: string;
  amount: number;
  movementType: GoalMovementType;
  contributionDate: string;
  description?: string | null;
}) {
  if (!input.goalId) throw new Error("Movimentação sem meta relacionada.");
  const amount = Math.abs(input.amount);
  if (!amount || !Number.isFinite(amount)) throw new Error("Informe um valor maior que zero.");
  const { error } = await supabase.from("goal_contributions").insert({
    workspace_id: input.workspaceId,
    goal_id: input.goalId,
    user_id: input.userId,
    amount,
    movement_type: input.movementType,
    contribution_date: input.contributionDate,
    description: input.description ?? null,
  });
  if (error) throw error;
}

export async function updateContribution(
  id: string,
  workspaceId: string,
  input: {
    amount: number;
    movementType: GoalMovementType;
    contribution_date: string;
    description?: string | null;
  },
) {
  const amount = Math.abs(input.amount);
  if (!amount || !Number.isFinite(amount)) throw new Error("Informe um valor maior que zero.");
  const { error } = await supabase
    .from("goal_contributions")
    .update({
      amount,
      movement_type: input.movementType,
      contribution_date: input.contribution_date,
      description: input.description ?? null,
    })
    .eq("workspace_id", workspaceId)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteContribution(id: string, workspaceId: string) {
  const { error } = await supabase.from("goal_contributions").delete().eq("workspace_id", workspaceId).eq("id", id);
  if (error) throw error;
}
