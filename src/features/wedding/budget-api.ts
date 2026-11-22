import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { SUGGESTED_CATEGORIES, type BudgetStatus } from "./budget";

export type WBudgetCategory = Tables<"wedding_budget_categories">;
export type WBudgetItem = Tables<"wedding_budget_items">;
export type WBudgetPayment = Tables<"wedding_budget_payments">;

type T = "wedding_budget_categories" | "wedding_budget_items" | "wedding_budget_payments";

function useList<K extends T>(table: K, workspaceId?: string, order = "created_at") {
  return useQuery({
    queryKey: [table, workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from(table) as any)
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order(order, { ascending: true });
      if (error) throw error;
      return (data ?? []) as Tables<K>[];
    },
  });
}

/** Dados do orçamento do casamento, sempre do workspace ativo (RLS: só membros). */
export function useWeddingBudget(workspaceId?: string) {
  const categories = useList("wedding_budget_categories", workspaceId, "sort_order");
  const items = useList("wedding_budget_items", workspaceId);
  const payments = useList("wedding_budget_payments", workspaceId, "paid_on");
  return {
    loading: categories.isLoading || items.isLoading || payments.isLoading,
    error: categories.error ?? items.error ?? payments.error ?? null,
    categories: categories.data ?? [],
    items: (items.data ?? []).map((i) => ({
      ...i,
      planned_amount: i.planned_amount == null ? null : Number(i.planned_amount),
      contracted_amount: i.contracted_amount == null ? null : Number(i.contracted_amount),
    })),
    payments: (payments.data ?? []).map((p) => ({ ...p, amount: Number(p.amount) })),
  };
}

export type ItemInput = {
  name: string;
  category_id: string | null;
  supplier_id: string | null;
  planned_amount: number | null;
  contracted_amount: number | null;
  status: BudgetStatus;
  due_date: string | null;
  notes: string | null;
};

const friendly = (e: { message?: string; code?: string }) =>
  new Error(
    e.code === "23505"
      ? "Já existe uma categoria com esse nome."
      : e.code === "23514"
        ? "Algum valor está fora do permitido."
        : e.message || "Não foi possível salvar.",
  );

export function useWeddingBudgetMutations(workspaceId?: string, userId?: string) {
  const qc = useQueryClient();
  const ensure = () => {
    if (!workspaceId || !userId) throw new Error("Sessão ou espaço indisponível.");
    return { workspace_id: workspaceId, created_by: userId };
  };
  const done = (...tables: T[]) =>
    Promise.all(tables.map((t) => qc.invalidateQueries({ queryKey: [t] })));
  const all: T[] = ["wedding_budget_categories", "wedding_budget_items", "wedding_budget_payments"];

  return {
    addSuggested: useMutation({
      mutationFn: async (existing: string[]) => {
        const base = ensure();
        const have = new Set(existing.map((x) => x.trim().toLocaleLowerCase("pt-BR")));
        const rows = SUGGESTED_CATEGORIES.filter(
          (c) => !have.has(c.toLocaleLowerCase("pt-BR")),
        ).map((name, i) => ({ ...base, name, sort_order: existing.length + i + 1 }));
        if (!rows.length) return;
        const { error } = await supabase.from("wedding_budget_categories").insert(rows);
        if (error) throw friendly(error);
      },
      onSuccess: () => done("wedding_budget_categories"),
    }),
    saveCategory: useMutation({
      mutationFn: async (a: { id?: string; name: string; sort_order?: number }) => {
        const base = ensure();
        if (a.id) {
          const { error } = await supabase
            .from("wedding_budget_categories")
            .update({ name: a.name })
            .eq("workspace_id", base.workspace_id)
            .eq("id", a.id);
          if (error) throw friendly(error);
          return a.id;
        }
        const { data, error } = await supabase
          .from("wedding_budget_categories")
          .insert({ ...base, name: a.name, sort_order: a.sort_order ?? 999 })
          .select("id")
          .single();
        if (error) throw friendly(error);
        return data.id;
      },
      onSuccess: () => done("wedding_budget_categories"),
    }),
    deleteCategory: useMutation({
      mutationFn: async (id: string) => {
        const base = ensure();
        const { error } = await supabase
          .from("wedding_budget_categories")
          .delete()
          .eq("workspace_id", base.workspace_id)
          .eq("id", id);
        if (error) throw friendly(error);
      },
      onSuccess: () => done(...all),
    }),
    saveItem: useMutation({
      mutationFn: async (a: { id?: string | undefined; input: ItemInput }) => {
        const base = ensure();
        if (a.id) {
          const { error } = await supabase
            .from("wedding_budget_items")
            .update(a.input)
            .eq("workspace_id", base.workspace_id)
            .eq("id", a.id);
          if (error) throw friendly(error);
          return a.id;
        }
        const { data, error } = await supabase
          .from("wedding_budget_items")
          .insert({ ...base, ...a.input })
          .select("id")
          .single();
        if (error) throw friendly(error);
        return data.id;
      },
      onSuccess: () => done("wedding_budget_items"),
    }),
    deleteItem: useMutation({
      mutationFn: async (id: string) => {
        const base = ensure();
        const { error } = await supabase
          .from("wedding_budget_items")
          .delete()
          .eq("workspace_id", base.workspace_id)
          .eq("id", id);
        if (error) throw friendly(error);
      },
      onSuccess: () => done("wedding_budget_items", "wedding_budget_payments"),
    }),
    addPayment: useMutation({
      mutationFn: async (a: {
        item_id: string;
        amount: number;
        paid_on: string;
        paid_by_user_id: string | null;
        note: string | null;
      }) => {
        const base = ensure();
        const { error } = await supabase.from("wedding_budget_payments").insert({ ...base, ...a });
        if (error) throw friendly(error);
      },
      onSuccess: () => done("wedding_budget_payments"),
    }),
    deletePayment: useMutation({
      mutationFn: async (id: string) => {
        const base = ensure();
        const { error } = await supabase
          .from("wedding_budget_payments")
          .delete()
          .eq("workspace_id", base.workspace_id)
          .eq("id", id);
        if (error) throw friendly(error);
      },
      onSuccess: () => done("wedding_budget_payments"),
    }),
  };
}
export type WeddingBudgetMutations = ReturnType<typeof useWeddingBudgetMutations>;
