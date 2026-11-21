import { useMemo } from "react";
import { useApp } from "@/features/app/app-context";
import { firstName } from "@/features/app/navigation";
import { computeSummary } from "./contracts";
import { useWeddingList, useWeddingPlan } from "./api";

export function useWeddingData() {
  const { workspaceId, userId, members, memberProfiles } = useApp();
  const plan = useWeddingPlan(workspaceId);
  const rooms = useWeddingList("wedding_rooms", workspaceId);
  const items = useWeddingList("wedding_items", workspaceId);
  const contributions = useWeddingList("wedding_contributions", workspaceId);
  const expenses = useWeddingList("wedding_expenses", workspaceId);
  const goals = useWeddingList("wedding_savings_goals", workspaceId);
  const tasks = useWeddingList("wedding_tasks", workspaceId);
  const suppliers = useWeddingList("wedding_suppliers", workspaceId);
  const people = useMemo(
    () =>
      members.map((m) => ({
        id: m.user_id,
        name: firstName(memberProfiles.find((p) => p.id === m.user_id)?.name, "Membro"),
      })),
    [members, memberProfiles],
  );
  const summary = useMemo(
    () =>
      computeSummary(
        items.data ?? [],
        contributions.data ?? [],
        expenses.data ?? [],
        goals.data ?? [],
      ),
    [items.data, contributions.data, expenses.data, goals.data],
  );
  const loading = plan.isLoading || rooms.isLoading || items.isLoading;
  return {
    workspaceId,
    userId,
    people,
    loading,
    summary,
    plan: plan.data ?? null,
    rooms: [...(rooms.data ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    items: items.data ?? [],
    contributions: contributions.data ?? [],
    expenses: expenses.data ?? [],
    goals: goals.data ?? [],
    tasks: tasks.data ?? [],
    suppliers: suppliers.data ?? [],
    personName: (id: string | null) =>
      id ? (people.find((p) => p.id === id)?.name ?? "Membro") : "—",
  };
}
