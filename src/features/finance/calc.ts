import type { Tables } from "@/integrations/supabase/types";

export type Transaction = Tables<"transactions">;
export type Account = Tables<"accounts">;

export function sumBy<T>(items: T[], pick: (item: T) => number) {
  return items.reduce((total, item) => total + (pick(item) || 0), 0);
}

export function totalIncome(transactions: Transaction[]) {
  return sumBy(
    transactions.filter((t) => t.type === "INCOME"),
    (t) => Number(t.amount),
  );
}

export function totalExpense(transactions: Transaction[]) {
  return sumBy(
    transactions.filter((t) => t.type === "EXPENSE"),
    (t) => Number(t.amount),
  );
}

/** Transfers never count as income or expense in net worth. */
export function accountBalance(account: Account, transactions: Transaction[]) {
  const income = sumBy(
    transactions.filter((t) => t.type === "INCOME" && t.account_id === account.id),
    (t) => Number(t.amount),
  );
  const expense = sumBy(
    transactions.filter((t) => t.type === "EXPENSE" && t.account_id === account.id),
    (t) => Number(t.amount),
  );
  const transfersIn = sumBy(
    transactions.filter((t) => t.type === "TRANSFER" && t.destination_account_id === account.id),
    (t) => Number(t.amount),
  );
  const transfersOut = sumBy(
    transactions.filter((t) => t.type === "TRANSFER" && t.source_account_id === account.id),
    (t) => Number(t.amount),
  );
  return Number(account.initial_balance) + income - expense + transfersIn - transfersOut;
}

export function netWorth(accounts: Account[], transactions: Transaction[]) {
  return sumBy(accounts, (account) => accountBalance(account, transactions));
}

/** Difference between the balance Life OS calculates and the one informed by the bank. */
export function reconciliationGap(calculated: number, informed: number) {
  return informed - calculated;
}

export function inMonth(dateISO: string, reference = new Date()) {
  const [y, m] = dateISO.split("-").map(Number);
  return y === reference.getFullYear() && m === reference.getMonth() + 1;
}
