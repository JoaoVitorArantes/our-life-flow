import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

type T = "wedding_funding_sources" | "wedding_loan_installments" | "wedding_loan_payments";
export type WFundingSource = Tables<"wedding_funding_sources">;
export type SourceInput = Omit<
  TablesInsert<"wedding_funding_sources">,
  "workspace_id" | "created_by" | "id"
>;

const num = (v: number | string | null) => (v == null ? null : Number(v));

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

/** Fontes de recursos e dívidas do casamento — só do workspace ativo (RLS: membros). */
export function useWeddingFunding(workspaceId?: string) {
  const s = useList("wedding_funding_sources", workspaceId);
  const i = useList("wedding_loan_installments", workspaceId, "due_date");
  const p = useList("wedding_loan_payments", workspaceId, "paid_on");
  return {
    loading: s.isLoading || i.isLoading || p.isLoading,
    error: s.error ?? i.error ?? p.error ?? null,
    sources: (s.data ?? []).map((x) => ({
      ...x,
      promised_amount: num(x.promised_amount),
      received_amount: num(x.received_amount),
      total_to_repay: num(x.total_to_repay),
      financial_cost: num(x.financial_cost),
      installment_amount: num(x.installment_amount),
    })),
    installments: (i.data ?? []).map((x) => ({ ...x, amount: Number(x.amount) })),
    payments: (p.data ?? []).map((x) => ({ ...x, amount: Number(x.amount) })),
  };
}
export type FundingData = ReturnType<typeof useWeddingFunding>;

const friendly = (e: { message?: string; code?: string }) =>
  new Error(
    e.code === "23505"
      ? "Já existe uma parcela com esse número."
      : e.code === "23514"
        ? "Algum valor está fora do permitido."
        : e.message || "Não foi possível salvar.",
  );

export function useWeddingFundingMutations(workspaceId?: string, userId?: string) {
  const qc = useQueryClient();
  const base = () => {
    if (!workspaceId || !userId) throw new Error("Sessão ou espaço indisponível.");
    return { workspace_id: workspaceId, created_by: userId };
  };
  const done = (...t: T[]) => Promise.all(t.map((k) => qc.invalidateQueries({ queryKey: [k] })));
  const all: T[] = [
    "wedding_funding_sources",
    "wedding_loan_installments",
    "wedding_loan_payments",
  ];
  const useDel = (table: T) =>
    useMutation({
      mutationFn: async (id: string) => {
        const b = base();
        const { error } = await supabase
          .from(table)
          .delete()
          .eq("workspace_id", b.workspace_id)
          .eq("id", id);
        if (error) throw friendly(error);
      },
      onSuccess: () => done(...all),
    });
  return {
    saveSource: useMutation({
      mutationFn: async (a: { id?: string | undefined; input: SourceInput }) => {
        const b = base();
        if (a.id) {
          const { error } = await supabase
            .from("wedding_funding_sources")
            .update(a.input)
            .eq("workspace_id", b.workspace_id)
            .eq("id", a.id);
          if (error) throw friendly(error);
          return a.id;
        }
        const { data, error } = await supabase
          .from("wedding_funding_sources")
          .insert({ ...b, ...a.input })
          .select("id")
          .single();
        if (error) throw friendly(error);
        return data.id;
      },
      onSuccess: () => done("wedding_funding_sources"),
    }),
    deleteSource: useDel("wedding_funding_sources"),
    addInstallments: useMutation({
      mutationFn: async (
        rows: { source_id: string; number: number; due_date: string; amount: number }[],
      ) => {
        const b = base();
        const { error } = await supabase
          .from("wedding_loan_installments")
          .insert(rows.map((r) => ({ ...b, ...r })));
        if (error) throw friendly(error);
      },
      onSuccess: () => done("wedding_loan_installments"),
    }),
    deleteInstallment: useDel("wedding_loan_installments"),
    addPayment: useMutation({
      mutationFn: async (a: {
        installment_id: string;
        amount: number;
        paid_on: string;
        note: string | null;
      }) => {
        const { error } = await supabase.from("wedding_loan_payments").insert({ ...base(), ...a });
        if (error) throw friendly(error);
      },
      onSuccess: () => done("wedding_loan_payments"),
    }),
    deletePayment: useDel("wedding_loan_payments"),
  };
}
export type FundingMutations = ReturnType<typeof useWeddingFundingMutations>;
