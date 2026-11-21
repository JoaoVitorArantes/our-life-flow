import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { SUGGESTED_INVENTORY, type ItemInput, type PlanInput } from "./contracts";

export type WeddingPlan = Tables<"wedding_plans">;
export type WeddingRoom = Tables<"wedding_rooms">;
export type WeddingItem = Tables<"wedding_items">;
export type WeddingGoal = Tables<"wedding_savings_goals">;
export type WeddingContribution = Tables<"wedding_contributions">;
export type WeddingExpense = Tables<"wedding_expenses">;
export type WeddingTask = Tables<"wedding_tasks">;
export type WeddingSupplier = Tables<"wedding_suppliers">;

type ListTable =
  | "wedding_rooms"
  | "wedding_items"
  | "wedding_savings_goals"
  | "wedding_contributions"
  | "wedding_expenses"
  | "wedding_tasks"
  | "wedding_suppliers";

/** Leitura sempre filtrada pelo workspace ativo; a chave começa pelo nome da tabela (sync em tempo real). */
export function useWeddingList<T extends ListTable>(table: T, workspaceId?: string) {
  return useQuery({
    queryKey: [table, workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from(table) as any)
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Tables<T>[];
    },
  });
}

export function useWeddingPlan(workspaceId?: string) {
  return useQuery({
    queryKey: ["wedding_plans", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wedding_plans")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return (...tables: string[]) =>
    Promise.all(tables.map((t) => qc.invalidateQueries({ queryKey: [t] })));
}

export function useSavePlan(workspaceId?: string, userId?: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: PlanInput) => {
      if (!workspaceId || !userId) throw new Error("Sessão ou espaço indisponível.");
      const { error } = await supabase
        .from("wedding_plans")
        .upsert(
          { workspace_id: workspaceId, created_by: userId, ...input },
          { onConflict: "workspace_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => invalidate("wedding_plans"),
  });
}

/** Cria o inventário sugerido: só nomes, quantidades e prioridades; preços vazios. */
export async function createSuggestedInventory(workspaceId: string, userId: string) {
  for (const [index, group] of SUGGESTED_INVENTORY.entries()) {
    const { data: room, error } = await supabase
      .from("wedding_rooms")
      .insert({
        workspace_id: workspaceId,
        created_by: userId,
        name: group.room,
        sort_order: index,
      })
      .select("id")
      .single();
    if (error) throw error;
    const { error: itemsError } = await supabase.from("wedding_items").insert(
      group.items.map(([name, quantity, priority]) => ({
        workspace_id: workspaceId,
        created_by: userId,
        room_id: room.id,
        name,
        quantity,
        priority,
      })),
    );
    if (itemsError) throw itemsError;
  }
}

export function useWeddingMutations(workspaceId?: string, userId?: string) {
  const invalidate = useInvalidate();
  const ensure = () => {
    if (!workspaceId || !userId) throw new Error("Sessão ou espaço indisponível.");
    return { workspaceId, userId };
  };
  const wrap = <A>(tables: string[], fn: (a: A) => Promise<unknown>) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useMutation({ mutationFn: fn, onSuccess: () => invalidate(...tables) });

  return {
    seed: wrap(["wedding_rooms", "wedding_items"], async () => {
      const s = ensure();
      await createSuggestedInventory(s.workspaceId, s.userId);
    }),
    addRoom: wrap(["wedding_rooms"], async (name: string) => {
      const s = ensure();
      const { error } = await supabase
        .from("wedding_rooms")
        .insert({ workspace_id: s.workspaceId, created_by: s.userId, name, sort_order: 999 });
      if (error) throw error;
    }),
    saveItem: wrap(
      ["wedding_items"],
      async ({ id, input }: { id?: string | undefined; input: ItemInput }) => {
        const s = ensure();
        const res = id
          ? await supabase
              .from("wedding_items")
              .update(input)
              .eq("workspace_id", s.workspaceId)
              .eq("id", id)
          : await supabase
              .from("wedding_items")
              .insert({ ...input, workspace_id: s.workspaceId, created_by: s.userId });
        if (res.error) throw res.error;
      },
    ),
    deleteRow: wrap(
      [
        "wedding_items",
        "wedding_expenses",
        "wedding_contributions",
        "wedding_tasks",
        "wedding_suppliers",
        "wedding_savings_goals",
      ],
      async ({ table, id }: { table: ListTable; id: string }) => {
        const s = ensure();
        const { error } = await supabase
          .from(table)
          .delete()
          .eq("workspace_id", s.workspaceId)
          .eq("id", id);
        if (error) throw error;
      },
    ),
    /** Compra: despesa interna do módulo + item marcado como comprado. Nada vai ao Financeiro geral. */
    buyItem: wrap(
      ["wedding_items", "wedding_expenses"],
      async (a: {
        item: WeddingItem;
        amount: number;
        paidBy: string;
        split: "equal" | "payer";
        date: string;
      }) => {
        const s = ensure();
        const { error } = await supabase.from("wedding_expenses").insert({
          workspace_id: s.workspaceId,
          created_by: s.userId,
          item_id: a.item.id,
          description: a.item.name,
          amount: a.amount,
          paid_by_user_id: a.paidBy,
          split: a.split,
          spent_on: a.date,
        });
        if (error) throw error;
        const { error: e2 } = await supabase
          .from("wedding_items")
          .update({ status: "bought", price_actual: a.amount })
          .eq("workspace_id", s.workspaceId)
          .eq("id", a.item.id);
        if (e2) throw e2;
      },
    ),
    addExpense: wrap(
      ["wedding_expenses"],
      async (a: {
        description: string;
        amount: number;
        paidBy: string;
        split: "equal" | "payer";
        date: string;
      }) => {
        const s = ensure();
        const { error } = await supabase.from("wedding_expenses").insert({
          workspace_id: s.workspaceId,
          created_by: s.userId,
          description: a.description,
          amount: a.amount,
          paid_by_user_id: a.paidBy,
          split: a.split,
          spent_on: a.date,
        });
        if (error) throw error;
      },
    ),
    addContribution: wrap(
      ["wedding_contributions"],
      async (a: { userId: string; amount: number; date: string; note: string | null }) => {
        const s = ensure();
        const { error } = await supabase.from("wedding_contributions").insert({
          workspace_id: s.workspaceId,
          created_by: s.userId,
          user_id: a.userId,
          amount: a.amount,
          contributed_on: a.date,
          note: a.note,
        });
        if (error) throw error;
      },
    ),
    setGoal: wrap(["wedding_savings_goals"], async (a: { month: string; amount: number }) => {
      const s = ensure();
      const { error } = await supabase.from("wedding_savings_goals").upsert(
        {
          workspace_id: s.workspaceId,
          created_by: s.userId,
          area: "house",
          month: a.month,
          target_amount: a.amount,
        },
        { onConflict: "workspace_id,area,month" },
      );
      if (error) throw error;
    }),
    addTask: wrap(
      ["wedding_tasks"],
      async (a: {
        title: string;
        kind: "task" | "decision" | "note";
        due: string | null;
        responsible: string | null;
      }) => {
        const s = ensure();
        const { error } = await supabase.from("wedding_tasks").insert({
          workspace_id: s.workspaceId,
          created_by: s.userId,
          title: a.title,
          kind: a.kind,
          due_date: a.due,
          responsible_user_id: a.responsible,
        });
        if (error) throw error;
      },
    ),
    setTaskStatus: wrap(
      ["wedding_tasks"],
      async (a: { id: string; status: "todo" | "doing" | "done" }) => {
        const s = ensure();
        const { error } = await supabase
          .from("wedding_tasks")
          .update({ status: a.status })
          .eq("workspace_id", s.workspaceId)
          .eq("id", a.id);
        if (error) throw error;
      },
    ),
    addSupplier: wrap(
      ["wedding_suppliers"],
      async (a: {
        name: string;
        category: string | null;
        contact: string | null;
        url: string | null;
      }) => {
        const s = ensure();
        const { error } = await supabase
          .from("wedding_suppliers")
          .insert({ workspace_id: s.workspaceId, created_by: s.userId, ...a });
        if (error) throw error;
      },
    ),
  };
}
