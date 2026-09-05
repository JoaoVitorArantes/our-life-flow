import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { TransactionType, Visibility } from "./constants";

export type Account = Tables<"accounts">;
export type Card = Tables<"cards">;
export type Category = Tables<"categories">;
export type Transaction = Tables<"transactions">;

export function useAccounts(workspaceId?: string) {
  return useQuery({
    queryKey: ["accounts", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at");
      if (error) throw error;
      return data as Account[];
    },
  });
}

export function useCards(workspaceId?: string) {
  return useQuery({
    queryKey: ["cards", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cards")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at");
      if (error) throw error;
      return data as Card[];
    },
  });
}

export function useCategories(workspaceId?: string) {
  return useQuery({
    queryKey: ["categories", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("name");
      if (error) throw error;
      return data as Category[];
    },
  });
}

export function useTransactions(workspaceId?: string) {
  return useQuery({
    queryKey: ["transactions", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("transaction_date", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as Transaction[];
    },
  });
}

export type NewTransactionInput = {
  workspaceId: string;
  ownerId: string;
  type: TransactionType;
  amount: number;
  description: string;
  transactionDate: string;
  categoryId?: string | null;
  accountId?: string | null;
  cardId?: string | null;
  sourceAccountId?: string | null;
  destinationAccountId?: string | null;
  visibility: Visibility;
  isShared: boolean;
  notes?: string | null;
  splits?: { userId: string; amount: number; percentage: number }[];
  installments?: { total: number; amount: number; startDate: string } | null;
};

export async function createTransaction(input: NewTransactionInput) {
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      workspace_id: input.workspaceId,
      owner_id: input.ownerId,
      type: input.type,
      amount: input.amount,
      description: input.description,
      transaction_date: input.transactionDate,
      category_id: input.categoryId ?? null,
      account_id: input.accountId ?? null,
      card_id: input.cardId ?? null,
      source_account_id: input.sourceAccountId ?? null,
      destination_account_id: input.destinationAccountId ?? null,
      visibility: input.visibility,
      is_shared: input.isShared,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;

  if (input.splits?.length) {
    const { error: splitError } = await supabase.from("transaction_splits").insert(
      input.splits.map((split) => ({
        transaction_id: data.id,
        user_id: split.userId,
        amount: split.amount,
        percentage: split.percentage,
      })),
    );
    if (splitError) throw splitError;
  }

  if (input.installments && input.installments.total > 1) {
    const { error: installmentError } = await supabase.from("installments").insert({
      transaction_id: data.id,
      total_installments: input.installments.total,
      current_installment: 1,
      installment_amount: input.installments.amount,
      start_date: input.installments.startDate,
    });
    if (installmentError) throw installmentError;
  }

  return data as Transaction;
}
