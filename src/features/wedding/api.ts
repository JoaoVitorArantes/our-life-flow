import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";
import { SUGGESTED_INVENTORY, type ItemInput, type PlanInput } from "./contracts";

export type WeddingPlan = Tables<"wedding_plans">;
export type WeddingRoom = Tables<"wedding_rooms">;
export type WeddingItem = Tables<"wedding_items">;
export type WeddingPriority = Tables<"wedding_priorities">;
export type WeddingStatus = Tables<"wedding_statuses">;
export type WeddingGoal = Tables<"wedding_savings_goals">;
export type WeddingContribution = Tables<"wedding_contributions">;
export type WeddingExpense = Tables<"wedding_expenses">;
export type WeddingTask = Tables<"wedding_tasks">;
export type WeddingSupplier = Tables<"wedding_suppliers">;

export type ListTable =
  | "wedding_rooms"
  | "wedding_items"
  | "wedding_priorities"
  | "wedding_statuses"
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

/** URL temporária para imagem privada do módulo (pasta do próprio workspace). */
export function useWeddingImage(path?: string | null) {
  return useQuery({
    queryKey: ["wedding_image", path],
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("wedding").createSignedUrl(path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

export async function uploadWeddingImage(workspaceId: string, file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Use uma imagem JPG, PNG ou WebP.");
  if (file.size > 5 * 1024 * 1024) throw new Error("A imagem deve ter até 5 MB.");
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${workspaceId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("wedding")
    .upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}

function useInvalidate() {
  const qc = useQueryClient();
  return (...tables: string[]) =>
    Promise.all(tables.map((t) => qc.invalidateQueries({ queryKey: [t] })));
}

export function useSavePlan(workspaceId?: string, userId?: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (
      input: PlanInput &
        Partial<Pick<WeddingPlan, "couple_names" | "message" | "cover_path" | "theme">>,
    ) => {
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
        sort_order: index + 1,
      })
      .select("id")
      .single();
    if (error) throw error;
    // O primeiro cômodo dispara a criação das prioridades/status padrão no banco.
    const [{ data: prios }, { data: statuses }] = await Promise.all([
      supabase.from("wedding_priorities").select("id, legacy_key").eq("workspace_id", workspaceId),
      supabase.from("wedding_statuses").select("id, legacy_key").eq("workspace_id", workspaceId),
    ]);
    const initial = statuses?.find((s) => s.legacy_key === "to_research")?.id ?? null;
    const { error: itemsError } = await supabase.from("wedding_items").insert(
      group.items.map(([name, quantity, priority], i) => ({
        workspace_id: workspaceId,
        created_by: userId,
        room_id: room.id,
        name,
        quantity,
        priority_id: prios?.find((p) => p.legacy_key === priority)?.id ?? null,
        status_id: initial,
        sort_order: i + 1,
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
  const wrap = <A, R = unknown>(tables: string[], fn: (a: A) => Promise<R>) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useMutation({ mutationFn: fn, onSuccess: () => invalidate(...tables) });

  const update = async (table: ListTable, id: string, patch: Record<string, unknown>) => {
    const s = ensure();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from(table) as any)
      .update(patch)
      .eq("workspace_id", s.workspaceId)
      .eq("id", id);
    if (error) throw error;
  };

  return {
    seed: wrap(
      ["wedding_rooms", "wedding_items", "wedding_priorities", "wedding_statuses"],
      async () => {
        const s = ensure();
        await createSuggestedInventory(s.workspaceId, s.userId);
      },
    ),

    // Cômodos
    saveRoom: wrap(
      ["wedding_rooms", "wedding_priorities", "wedding_statuses"],
      async ({
        id,
        input,
      }: {
        id?: string | undefined;
        input: {
          name: string;
          description: string | null;
          icon: string | null;
          color: string | null;
        };
      }) => {
        const s = ensure();
        if (id) return update("wedding_rooms", id, input);
        const { error } = await supabase
          .from("wedding_rooms")
          .insert({ ...input, workspace_id: s.workspaceId, created_by: s.userId, sort_order: 999 });
        if (error) throw error;
      },
    ),
    reorder: wrap(
      ["wedding_rooms", "wedding_items", "wedding_priorities", "wedding_statuses"],
      async ({ table, rows }: { table: ListTable; rows: { id: string; sort_order: number }[] }) => {
        for (const r of rows) await update(table, r.id, { sort_order: r.sort_order });
      },
    ),
    setArchived: wrap(
      ["wedding_rooms", "wedding_items", "wedding_priorities", "wedding_statuses"],
      async ({
        table,
        id,
        archived,
      }: {
        table: "wedding_rooms" | "wedding_items" | "wedding_priorities" | "wedding_statuses";
        id: string;
        archived: boolean;
      }) => {
        const s = ensure();
        const patch: Record<string, unknown> = {
          archived_at: archived ? new Date().toISOString() : null,
        };
        if (table === "wedding_items") patch["archived_by"] = archived ? s.userId : null;
        await update(table, id, patch);
      },
    ),

    // Itens
    saveItem: wrap(
      ["wedding_items"],
      async ({ id, input }: { id?: string | undefined; input: ItemInput }) => {
        const s = ensure();
        if (id) return update("wedding_items", id, input as TablesUpdate<"wedding_items">);
        const { data, error } = await supabase
          .from("wedding_items")
          .insert({ ...input, workspace_id: s.workspaceId, created_by: s.userId, sort_order: 999 })
          .select("id")
          .single();
        if (error) throw error;
        return data.id;
      },
    ),
    deleteRow: wrap(
      [
        "wedding_items",
        "wedding_rooms",
        "wedding_expenses",
        "wedding_contributions",
        "wedding_tasks",
        "wedding_suppliers",
        "wedding_savings_goals",
        "wedding_priorities",
        "wedding_statuses",
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
    /** Compra: despesa interna do módulo + item no status de compra. Nada vai ao Financeiro geral. */
    buyItem: wrap(
      ["wedding_items", "wedding_expenses"],
      async (a: {
        item: WeddingItem;
        amount: number;
        paidBy: string;
        split: "equal" | "payer";
        date: string;
        boughtStatusId: string | null;
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
        await update("wedding_items", a.item.id, {
          status_id: a.boughtStatusId,
          price_actual: a.amount,
        });
      },
    ),

    // Prioridades e status
    saveOption: wrap(
      ["wedding_priorities", "wedding_statuses"],
      async ({
        table,
        id,
        input,
      }: {
        table: "wedding_priorities" | "wedding_statuses";
        id?: string | undefined;
        input: Record<string, unknown>;
      }) => {
        const s = ensure();
        if (id) return update(table, id, input);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from(table) as any).insert({
          ...input,
          workspace_id: s.workspaceId,
          created_by: s.userId,
          sort_order: 999,
        });
        if (error) throw error;
      },
    ),

    // Economia, despesas, preparativos, fornecedores
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
      async (a: { id: string; status: "todo" | "doing" | "done" }) =>
        update("wedding_tasks", a.id, { status: a.status }),
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
export type WeddingMutations = ReturnType<typeof useWeddingMutations>;
