import { useMemo } from "react";
import { useApp } from "@/features/app/app-context";
import { firstName } from "@/features/app/navigation";
import { computeSummary } from "./contracts";
import { useWeddingList, useWeddingPlan } from "./api";

const bySort = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order;

/** Todos os dados do módulo para o workspace ativo. Arquivados ficam separados (lixeira). */
export function useWeddingData() {
  const { workspaceId, userId, members, memberProfiles } = useApp();
  const plan = useWeddingPlan(workspaceId);
  const rooms = useWeddingList("wedding_rooms", workspaceId);
  const items = useWeddingList("wedding_items", workspaceId);
  const priorities = useWeddingList("wedding_priorities", workspaceId);
  const statuses = useWeddingList("wedding_statuses", workspaceId);
  const contributions = useWeddingList("wedding_contributions", workspaceId);
  const expenses = useWeddingList("wedding_expenses", workspaceId);
  const goals = useWeddingList("wedding_savings_goals", workspaceId);
  const tasks = useWeddingList("wedding_tasks", workspaceId);
  const suppliers = useWeddingList("wedding_suppliers", workspaceId);

  return useMemo(() => {
    const people = members.map((m) => ({
      id: m.user_id,
      name: firstName(memberProfiles.find((p) => p.id === m.user_id)?.name, "Membro"),
    }));
    const allRooms = [...(rooms.data ?? [])].sort(bySort);
    const activeRooms = allRooms.filter((r) => !r.archived_at);
    const activeRoomIds = new Set(activeRooms.map((r) => r.id));
    const allItems = [...(items.data ?? [])].sort(bySort);
    const activeItems = allItems.filter((i) => !i.archived_at && activeRoomIds.has(i.room_id));
    const allPriorities = [...(priorities.data ?? [])].sort(bySort);
    const allStatuses = [...(statuses.data ?? [])].sort(bySort);
    const boughtIds = new Set(allStatuses.filter((s) => s.counts_as_bought).map((s) => s.id));
    const summary = computeSummary(
      activeItems,
      contributions.data ?? [],
      expenses.data ?? [],
      goals.data ?? [],
      boughtIds,
    );
    return {
      workspaceId,
      userId,
      people,
      loading:
        plan.isLoading ||
        rooms.isLoading ||
        items.isLoading ||
        priorities.isLoading ||
        statuses.isLoading,
      error: rooms.error ?? items.error ?? null,
      plan: plan.data ?? null,
      summary,
      rooms: activeRooms,
      archivedRooms: allRooms.filter((r) => r.archived_at),
      items: activeItems,
      archivedItems: allItems.filter((i) => i.archived_at),
      priorities: allPriorities.filter((p) => !p.archived_at),
      allPriorities,
      statuses: allStatuses.filter((s) => !s.archived_at),
      allStatuses,
      boughtIds,
      boughtStatusId: allStatuses.find((s) => s.counts_as_bought && !s.archived_at)?.id ?? null,
      initialStatusId: allStatuses.find((s) => !s.archived_at)?.id ?? null,
      contributions: contributions.data ?? [],
      expenses: expenses.data ?? [],
      goals: goals.data ?? [],
      tasks: tasks.data ?? [],
      suppliers: suppliers.data ?? [],
      personName: (id: string | null) =>
        id ? (people.find((p) => p.id === id)?.name ?? "Membro") : "—",
      priorityOf: (id: string | null) => allPriorities.find((p) => p.id === id) ?? null,
      statusOf: (id: string | null) => allStatuses.find((s) => s.id === id) ?? null,
      roomOf: (id: string) => allRooms.find((r) => r.id === id) ?? null,
    };
  }, [
    workspaceId,
    userId,
    members,
    memberProfiles,
    plan.data,
    plan.isLoading,
    rooms.data,
    rooms.isLoading,
    rooms.error,
    items.data,
    items.isLoading,
    items.error,
    priorities.data,
    priorities.isLoading,
    statuses.data,
    statuses.isLoading,
    contributions.data,
    expenses.data,
    goals.data,
    tasks.data,
    suppliers.data,
  ]);
}
export type WeddingData = ReturnType<typeof useWeddingData>;
