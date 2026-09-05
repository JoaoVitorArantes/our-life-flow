import type { Tables } from "@/integrations/supabase/types";
import type { PaymentStatus, RecurrenceFrequency } from "./constants";
import { effectiveStatus } from "./constants";

export type Transaction = Tables<"transactions">;
export type Account = Tables<"accounts">;

export function sumBy<T>(items: T[], pick: (item: T) => number) {
  return items.reduce((total, item) => total + (pick(item) || 0), 0);
}

/** Only settled (PAID) entries move real money. */
export const isSettled = (t: Transaction) => t.status === "PAID";
export const isOpen = (t: Transaction) => t.status === "PENDING" || t.status === "OVERDUE";

export const dueDateOf = (t: Transaction) => t.due_date ?? t.transaction_date;

export function statusOf(t: Transaction): PaymentStatus {
  return effectiveStatus(t.status, dueDateOf(t));
}

export function totalIncome(transactions: Transaction[]) {
  return sumBy(
    transactions.filter((t) => t.type === "INCOME" && isSettled(t)),
    (t) => Number(t.amount),
  );
}

export function totalExpense(transactions: Transaction[]) {
  return sumBy(
    transactions.filter((t) => t.type === "EXPENSE" && isSettled(t)),
    (t) => Number(t.amount),
  );
}

export function totalPending(transactions: Transaction[]) {
  return sumBy(
    transactions.filter((t) => t.type === "EXPENSE" && isOpen(t)),
    (t) => Number(t.amount),
  );
}

export function totalOverdue(transactions: Transaction[]) {
  return sumBy(
    transactions.filter((t) => t.type === "EXPENSE" && statusOf(t) === "OVERDUE"),
    (t) => Number(t.amount),
  );
}

/** Transfers never count as income or expense in net worth. Pending items don't either. */
export function accountBalance(account: Account, transactions: Transaction[]) {
  const settled = transactions.filter(isSettled);
  const income = sumBy(
    settled.filter((t) => t.type === "INCOME" && t.account_id === account.id),
    (t) => Number(t.amount),
  );
  const expense = sumBy(
    settled.filter((t) => t.type === "EXPENSE" && t.account_id === account.id),
    (t) => Number(t.amount),
  );
  const transfersIn = sumBy(
    settled.filter((t) => t.type === "TRANSFER" && t.destination_account_id === account.id),
    (t) => Number(t.amount),
  );
  const transfersOut = sumBy(
    settled.filter((t) => t.type === "TRANSFER" && t.source_account_id === account.id),
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

const pad = (n: number) => String(n).padStart(2, "0");
export const toISO = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const todayISO = () => toISO(new Date());

/** Adds `count` months keeping the day of month (clamped to month length). */
export function addMonths(iso: string, count: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const base = new Date(y ?? 1970, (m ?? 1) - 1 + count, 1);
  const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  base.setDate(Math.min(d ?? 1, lastDay));
  return toISO(base);
}

export function shiftDate(iso: string, index: number, frequency: RecurrenceFrequency) {
  if (index === 0) return iso;
  if (frequency === "WEEKLY") {
    const [y, m, d] = iso.split("-").map(Number);
    return toISO(new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + index * 7));
  }
  if (frequency === "YEARLY") return addMonths(iso, index * 12);
  return addMonths(iso, index);
}

/** Round to cents and put the rounding leftover on the last installment. */
export function splitInstallments(total: number, count: number) {
  const base = Math.floor((total / count) * 100) / 100;
  const values = Array.from({ length: count }, () => base);
  const diff = Math.round((total - base * count) * 100) / 100;
  if (values.length) values[values.length - 1] = Math.round((base + diff) * 100) / 100;
  return values;
}

/** Invoice window of a card for a given reference month (closing day based). */
export function cardInvoiceRange(closingDay: number, reference = new Date()) {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const end = new Date(year, month, closingDay);
  const start = new Date(year, month - 1, closingDay + 1);
  return { start: toISO(start), end: toISO(end) };
}
