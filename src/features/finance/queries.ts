import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { PaymentStatus, TransactionType, Visibility } from "./constants";

export type Account = Tables<"accounts">;
export type Card = Tables<"cards">;
export type Category = Tables<"categories">;
export type Transaction = Tables<"transactions">;
export type InstallmentPlan = Tables<"installment_plans">;
export type Loan = Tables<"loans">;
export type Financing = Tables<"financings">;
export type Recurring = Tables<"recurring_transactions">;

function listQuery<T>(table: string, key: string, workspaceId?: string, orderBy = "created_at") {
  return {
    queryKey: [key, workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table as never)
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order(orderBy);
      if (error) throw error;
      return (data ?? []) as T[];
    },
  };
}

export function useAccounts(workspaceId?: string) {
  return useQuery(listQuery<Account>("accounts", "accounts", workspaceId));
}

export function useCards(workspaceId?: string) {
  return useQuery(listQuery<Card>("cards", "cards", workspaceId));
}

export function useCategories(workspaceId?: string) {
  return useQuery(listQuery<Category>("categories", "categories", workspaceId, "name"));
}

export function useInstallmentPlans(workspaceId?: string) {
  return useQuery(listQuery<InstallmentPlan>("installment_plans", "installment_plans", workspaceId));
}

export function useLoans(workspaceId?: string) {
  return useQuery(listQuery<Loan>("loans", "loans", workspaceId));
}

export function useFinancings(workspaceId?: string) {
  return useQuery(listQuery<Financing>("financings", "financings", workspaceId));
}

export function useRecurring(workspaceId?: string) {
  return useQuery(
    listQuery<Recurring>("recurring_transactions", "recurring_transactions", workspaceId),
  );
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
        .limit(2000);
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
  dueDate?: string | null | undefined;
  status?: PaymentStatus | undefined;
  paidAt?: string | null | undefined;
  categoryId?: string | null | undefined;
  accountId?: string | null | undefined;
  cardId?: string | null | undefined;
  sourceAccountId?: string | null | undefined;
  destinationAccountId?: string | null | undefined;
  contextId?: string | null | undefined;
  visibility: Visibility;
  isShared: boolean;
  notes?: string | null | undefined;
  splits?: { userId: string; amount: number; percentage: number }[] | undefined;
};

export async function createTransaction(input: NewTransactionInput) {
  const status = input.status ?? "PAID";
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      workspace_id: input.workspaceId,
      owner_id: input.ownerId,
      type: input.type,
      amount: input.amount,
      description: input.description,
      transaction_date: input.transactionDate,
      due_date: input.dueDate ?? input.transactionDate,
      status,
      paid_at: status === "PAID" ? (input.paidAt ?? input.transactionDate) : null,
      category_id: input.categoryId ?? null,
      account_id: input.accountId ?? null,
      card_id: input.cardId ?? null,
      source_account_id: input.sourceAccountId ?? null,
      destination_account_id: input.destinationAccountId ?? null,
      context_id: input.contextId ?? null,
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

  return data as Transaction;
}
