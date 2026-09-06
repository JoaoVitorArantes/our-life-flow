import { eventOccurrences } from "@/features/agenda/queries";
import { isOpen } from "@/features/finance/calc";
import { useTransactions } from "@/features/finance/queries";
import { useEvents, useGoals, useTasks } from "@/features/planner/queries";

export function useNavigationIndicators(workspaceId?: string) {
  const { data: tasks = [] } = useTasks(workspaceId);
  const { data: transactions = [] } = useTransactions(workspaceId);
  const { data: events = [] } = useEvents(workspaceId);
  const { data: goals = [] } = useGoals(workspaceId);
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 7);
  const goalLimit = new Date(from);
  goalLimit.setDate(goalLimit.getDate() + 30);

  return {
    "/tarefas": tasks.filter((task) => task.status !== "DONE").length,
    "/financeiro": transactions.filter((transaction) => transaction.type === "EXPENSE" && isOpen(transaction)).length,
    "/agenda": events.filter((event) => event.status !== "CANCELLED" && eventOccurrences(event, from, to).length > 0).length,
    "/metas": goals.filter((goal) => goal.status === "ACTIVE" && goal.due_date && new Date(`${goal.due_date}T00:00:00`) <= goalLimit).length,
  } satisfies Record<string, number>;
}