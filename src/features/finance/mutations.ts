import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import type { LoanType, PaymentStatus, RecurrenceFrequency, Visibility } from "./constants";
import { addMonths, shiftDate, splitInstallments, todayISO, toISO } from "./calc";
import type { Recurring } from "./queries";

export async function updateTransaction(id: string, values: TablesUpdate<"transactions">) {
  const { error } = await supabase.from("transactions").update(values).eq("id", id);
  if (error) throw error;
}

export async function deleteTransaction(id: string, workspaceId: string) {
  await supabase.from("transaction_splits").delete().eq("workspace_id", workspaceId).eq("transaction_id", id);
  await supabase.from("transaction_payers").delete().eq("workspace_id", workspaceId).eq("transaction_id", id);
  // Acertos ainda pendentes deixam de existir junto com a despesa; os pagos viram histórico.
  await supabase.from("settlements").delete().eq("workspace_id", workspaceId).eq("transaction_id", id).eq("status", "PENDING");
  const { error } = await supabase.from("transactions").delete().eq("workspace_id", workspaceId).eq("id", id);
  if (error) throw error;
}


/** Marks one entry as paid/pending without touching its siblings. */
export async function setTransactionStatus(
  id: string,
  status: PaymentStatus,
  paidAt: string | null = todayISO(),
) {
  const { error } = await supabase
    .from("transactions")
    .update({ status, paid_at: status === "PAID" ? paidAt : null })
    .eq("id", id);
  if (error) throw error;
}

export async function saveAccount(
  id: string | null,
  values: TablesInsert<"accounts"> | TablesUpdate<"accounts">,
) {
  const { error } = id
    ? await supabase.from("accounts").update(values as TablesUpdate<"accounts">).eq("id", id)
    : await supabase.from("accounts").insert(values as TablesInsert<"accounts">);
  if (error) throw error;
}

export async function deleteAccount(id: string) {
  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) throw error;
}

export async function saveCard(
  id: string | null,
  values: TablesInsert<"cards"> | TablesUpdate<"cards">,
) {
  const { error } = id
    ? await supabase.from("cards").update(values as TablesUpdate<"cards">).eq("id", id)
    : await supabase.from("cards").insert(values as TablesInsert<"cards">);
  if (error) throw error;
}

export async function deleteCard(id: string) {
  const { error } = await supabase.from("cards").delete().eq("id", id);
  if (error) throw error;
}

export async function saveCategory(
  id: string | null,
  values: TablesInsert<"categories"> | TablesUpdate<"categories">,
) {
  const { error } = id
    ? await supabase.from("categories").update(values as TablesUpdate<"categories">).eq("id", id)
    : await supabase.from("categories").insert(values as TablesInsert<"categories">);
  if (error) throw error;
}

export async function deleteCategory(id: string) {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------------------------------------------------------- parcelas */

export type InstallmentPlanInput = {
  workspaceId: string;
  ownerId: string;
  description: string;
  totalAmount: number;
  totalInstallments: number;
  startDate: string;
  categoryId?: string | null;
  accountId?: string | null;
  cardId?: string | null;
  contextId?: string | null;
  visibility: Visibility;
  firstPaid: boolean;
  notes?: string | null;
};

export async function createInstallmentPlan(input: InstallmentPlanInput) {
  const values = splitInstallments(input.totalAmount, input.totalInstallments);
  const { data: plan, error } = await supabase
    .from("installment_plans")
    .insert({
      workspace_id: input.workspaceId,
      owner_id: input.ownerId,
      description: input.description,
      total_amount: input.totalAmount,
      total_installments: input.totalInstallments,
      installment_amount: values[0] ?? 0,
      start_date: input.startDate,
      category_id: input.categoryId ?? null,
      account_id: input.accountId ?? null,
      card_id: input.cardId ?? null,
      context_id: input.contextId ?? null,
      visibility: input.visibility,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;

  const rows = values.map((amount, index) => {
    const date = addMonths(input.startDate, index);
    const paid = input.firstPaid && index === 0;
    return {
      workspace_id: input.workspaceId,
      owner_id: input.ownerId,
      type: "EXPENSE" as const,
      amount,
      description: `${input.description} ${index + 1}/${input.totalInstallments}`,
      transaction_date: date,
      due_date: date,
      status: (paid ? "PAID" : "PENDING") as PaymentStatus,
      paid_at: paid ? date : null,
      category_id: input.categoryId ?? null,
      account_id: input.accountId ?? null,
      card_id: input.cardId ?? null,
      context_id: input.contextId ?? null,
      visibility: input.visibility,
      is_shared: input.visibility === "SHARED",
      installment_plan_id: plan.id,
      installment_number: index + 1,
    };
  });

  const { error: rowsError } = await supabase.from("transactions").insert(rows);
  if (rowsError) throw rowsError;
  return plan;
}

/** scope "future" leaves already-paid installments untouched. */
export async function updateInstallmentPlan(
  planId: string,
  values: TablesUpdate<"installment_plans">,
  scope: "future" | "all",
  perInstallmentAmount?: number,
) {
  const { error } = await supabase.from("installment_plans").update(values).eq("id", planId);
  if (error) throw error;

  const patch: TablesUpdate<"transactions"> = {};
  if (values.category_id !== undefined) patch.category_id = values.category_id;
  if (values.account_id !== undefined) patch.account_id = values.account_id;
  if (values.card_id !== undefined) patch.card_id = values.card_id;
  if (values.context_id !== undefined) patch.context_id = values.context_id;
  if (perInstallmentAmount !== undefined) patch.amount = perInstallmentAmount;
  if (Object.keys(patch).length === 0) return;

  let query = supabase.from("transactions").update(patch).eq("installment_plan_id", planId);
  if (scope === "future") query = query.neq("status", "PAID");
  const { error: rowError } = await query;
  if (rowError) throw rowError;
}

export async function deleteInstallmentPlan(id: string) {
  const { error } = await supabase.from("installment_plans").delete().eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------------ recorrências */

export async function saveRecurring(
  id: string | null,
  values: TablesInsert<"recurring_transactions"> | TablesUpdate<"recurring_transactions">,
) {
  const { error } = id
    ? await supabase
        .from("recurring_transactions")
        .update(values as TablesUpdate<"recurring_transactions">)
        .eq("id", id)
    : await supabase
        .from("recurring_transactions")
        .insert(values as TablesInsert<"recurring_transactions">);
  if (error) throw error;
}

export async function deleteRecurring(id: string) {
  const { error } = await supabase.from("recurring_transactions").delete().eq("id", id);
  if (error) throw error;
}

function horizonISO(days = 60) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toISO(date);
}

/**
 * Materialises the occurrences of an active recurrence up to the horizon.
 * Existing dates are skipped, so it never duplicates entries.
 */
export async function generateRecurringOccurrences(recurring: Recurring, ownerId: string) {
  if (!recurring.is_active) return 0;
  const limit = horizonISO();
  const frequency = recurring.frequency as RecurrenceFrequency;

  const { data: existing, error: existingError } = await supabase
    .from("transactions")
    .select("transaction_date")
    .eq("recurring_id", recurring.id);
  if (existingError) throw existingError;
  const taken = new Set((existing ?? []).map((row) => row.transaction_date));

  const dates: string[] = [];
  for (let index = 0; index < 240; index += 1) {
    const date = shiftDate(recurring.start_date, index, frequency);
    if (date > limit) break;
    if (recurring.end_date && date > recurring.end_date) break;
    if (!taken.has(date)) dates.push(date);
  }
  if (!dates.length) return 0;

  const today = todayISO();
  const rows = dates.map((date) => ({
    workspace_id: recurring.workspace_id,
    owner_id: ownerId,
    type: recurring.type,
    amount: recurring.amount,
    description: recurring.description,
    transaction_date: date,
    due_date: date,
    status: "PENDING" as PaymentStatus,
    category_id: recurring.category_id,
    account_id: recurring.account_id,
    card_id: recurring.card_id,
    context_id: recurring.context_id,
    visibility: recurring.visibility,
    is_shared: recurring.visibility === "SHARED",
    recurring_id: recurring.id,
  }));

  const { error } = await supabase.from("transactions").insert(rows);
  if (error) throw error;

  const next = dates.find((date) => date >= today) ?? dates[dates.length - 1] ?? null;
  await supabase.from("recurring_transactions").update({ next_date: next }).eq("id", recurring.id);
  return rows.length;
}

/* ------------------------------------------------------------- empréstimos */

export type LoanInput = {
  workspaceId: string;
  ownerId: string;
  type: LoanType;
  personName: string;
  description?: string | null;
  totalAmount: number;
  totalInstallments: number;
  startDate: string;
  dueDay?: number | null;
  accountId?: string | null;
  contextId?: string | null;
  visibility: Visibility;
};

export async function createLoan(input: LoanInput) {
  const values = splitInstallments(input.totalAmount, input.totalInstallments);
  const { data: loan, error } = await supabase
    .from("loans")
    .insert({
      workspace_id: input.workspaceId,
      owner_id: input.ownerId,
      type: input.type,
      person_name: input.personName,
      description: input.description ?? null,
      total_amount: input.totalAmount,
      total_installments: input.totalInstallments,
      installment_amount: values[0] ?? 0,
      start_date: input.startDate,
      due_day: input.dueDay ?? null,
      account_id: input.accountId ?? null,
      context_id: input.contextId ?? null,
      visibility: input.visibility,
    })
    .select("*")
    .single();
  if (error) throw error;

  const label = input.type === "LENT" ? "Recebimento" : "Pagamento";
  const rows = values.map((amount, index) => {
    const date = addMonths(input.startDate, index);
    return {
      workspace_id: input.workspaceId,
      owner_id: input.ownerId,
      type: (input.type === "LENT" ? "INCOME" : "EXPENSE") as "INCOME" | "EXPENSE",
      amount,
      description: `${label} ${input.personName} ${index + 1}/${input.totalInstallments}`,
      transaction_date: date,
      due_date: date,
      status: "PENDING" as PaymentStatus,
      account_id: input.accountId ?? null,
      context_id: input.contextId ?? null,
      visibility: input.visibility,
      is_shared: input.visibility === "SHARED",
      loan_id: loan.id,
      installment_number: index + 1,
    };
  });
  const { error: rowsError } = await supabase.from("transactions").insert(rows);
  if (rowsError) throw rowsError;
  return loan;
}

export async function updateLoan(id: string, values: TablesUpdate<"loans">) {
  const { error } = await supabase.from("loans").update(values).eq("id", id);
  if (error) throw error;
}

export async function deleteLoan(id: string) {
  const { error } = await supabase.from("loans").delete().eq("id", id);
  if (error) throw error;
}

/* ----------------------------------------------------------- financiamentos */

export type FinancingInput = {
  workspaceId: string;
  ownerId: string;
  name: string;
  description?: string | null;
  financedAmount: number;
  totalInstallments: number;
  installmentAmount: number;
  interestRate?: number | null;
  startDate: string;
  dueDay?: number | null;
  accountId?: string | null;
  categoryId?: string | null;
  contextId?: string | null;
  visibility: Visibility;
  paidInstallments: number;
};

export async function createFinancing(input: FinancingInput) {
  const { data: financing, error } = await supabase
    .from("financings")
    .insert({
      workspace_id: input.workspaceId,
      owner_id: input.ownerId,
      name: input.name,
      description: input.description ?? null,
      financed_amount: input.financedAmount,
      total_installments: input.totalInstallments,
      installment_amount: input.installmentAmount,
      interest_rate: input.interestRate ?? null,
      start_date: input.startDate,
      due_day: input.dueDay ?? null,
      account_id: input.accountId ?? null,
      category_id: input.categoryId ?? null,
      context_id: input.contextId ?? null,
      visibility: input.visibility,
    })
    .select("*")
    .single();
  if (error) throw error;

  const rows = Array.from({ length: input.totalInstallments }, (_, index) => {
    const date = addMonths(input.startDate, index);
    const paid = index < input.paidInstallments;
    return {
      workspace_id: input.workspaceId,
      owner_id: input.ownerId,
      type: "EXPENSE" as const,
      amount: input.installmentAmount,
      description: `${input.name} ${index + 1}/${input.totalInstallments}`,
      transaction_date: date,
      due_date: date,
      status: (paid ? "PAID" : "PENDING") as PaymentStatus,
      paid_at: paid ? date : null,
      account_id: input.accountId ?? null,
      category_id: input.categoryId ?? null,
      context_id: input.contextId ?? null,
      visibility: input.visibility,
      is_shared: input.visibility === "SHARED",
      financing_id: financing.id,
      installment_number: index + 1,
    };
  });
  const { error: rowsError } = await supabase.from("transactions").insert(rows);
  if (rowsError) throw rowsError;
  return financing;
}

export async function updateFinancing(id: string, values: TablesUpdate<"financings">) {
  const { error } = await supabase.from("financings").update(values).eq("id", id);
  if (error) throw error;
}

export async function deleteFinancing(id: string) {
  const { error } = await supabase.from("financings").delete().eq("id", id);
  if (error) throw error;
}
