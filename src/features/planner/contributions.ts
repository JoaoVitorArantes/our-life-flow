import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type GoalContribution = Tables<"goal_contributions">;

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

export function sumContributions(items: GoalContribution[]) {
  return items.reduce((total, item) => total + Number(item.amount), 0);
}

/** Progress = saved contributions, falling back to the legacy current_amount. */
export function goalProgress(
  goal: { id: string; current_amount: number | string | null },
  contributions: GoalContribution[],
) {
  const own = contributions.filter((item) => item.goal_id === goal.id);
  if (own.length === 0) return Number(goal.current_amount ?? 0);
  return sumContributions(own);
}

export async function addContribution(input: {
  goalId: string;
  userId: string;
  amount: number;
  contributionDate: string;
  description?: string | null;
}) {
  const { error } = await supabase.from("goal_contributions").insert({
    goal_id: input.goalId,
    user_id: input.userId,
    amount: input.amount,
    contribution_date: input.contributionDate,
    description: input.description ?? null,
  });
  if (error) throw error;
}

export async function updateContribution(
  id: string,
  input: { amount: number; contribution_date: string; description?: string | null },
) {
  const { error } = await supabase.from("goal_contributions").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteContribution(id: string) {
  const { error } = await supabase.from("goal_contributions").delete().eq("id", id);
  if (error) throw error;
}
