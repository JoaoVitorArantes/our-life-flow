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

/**
 * Registro leve dos ciclos de cartão (fechamento/vencimento) para que o
 * vencimento de uma compra no crédito seja o da FATURA, não o da compra.
 */
type CardCycleInfo = { closingDay: number | null; dueDay: number | null };
const cardCycleIndex = new Map<string, CardCycleInfo>();

export function registerCardCycles(
  cards: { id: string; closing_day: number | null; due_day: number | null }[],
) {
  for (const card of cards) {
    cardCycleIndex.set(card.id, { closingDay: card.closing_day, dueDay: card.due_day });
  }
}

/** Vencimento da fatura que contém uma compra feita em `purchaseISO`. */
export function invoiceDueDateFor(purchaseISO: string, closingDay: number, dueDay: number) {
  const [y, m, d] = purchaseISO.split("-").map(Number);
  const reference = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  const closingISO = cardCycles(closingDay, reference).current.end;
  return cardDueDate(closingISO, dueDay);
}

export const dueDateOf = (t: Transaction) => {
  if (t.card_id) {
    const cycle = cardCycleIndex.get(t.card_id);
    if (cycle?.closingDay && cycle.dueDay) {
      return invoiceDueDateFor(t.transaction_date, cycle.closingDay, cycle.dueDay);
    }
  }
  return t.due_date ?? t.transaction_date;
};

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

const clampDay = (year: number, month: number, day: number) =>
  Math.min(Math.max(day, 1), new Date(year, month + 1, 0).getDate());

const dayAfter = (date: Date) =>
  toISO(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1));

/** Current (open) and next invoice cycles of a card, based on its closing day. */
export function cardCycles(closingDay: number, reference = new Date()) {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const offset = reference.getDate() <= clampDay(year, month, closingDay) ? 0 : 1;
  const closingOf = (shift: number) =>
    new Date(year, month + offset + shift, clampDay(year, month + offset + shift, closingDay));
  const previous = closingOf(-1);
  const current = closingOf(0);
  const next = closingOf(1);
  return {
    current: { start: dayAfter(previous), end: toISO(current) },
    next: { start: dayAfter(current), end: toISO(next) },
  };
}

/** Due date of the invoice that closes on `closingISO`. */
export function cardDueDate(closingISO: string, dueDay: number) {
  const [y, m, d] = closingISO.split("-").map(Number);
  const year = y ?? 1970;
  const month = (m ?? 1) - 1;
  const shift = dueDay >= (d ?? 1) ? 0 : 1;
  return toISO(new Date(year, month + shift, clampDay(year, month + shift, dueDay)));
}

/** Whole days between two ISO dates (b - a). */
export function daysBetween(fromISO: string, toISODate: string) {
  const parse = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  };
  return Math.round((parse(toISODate) - parse(fromISO)) / 86400000);
}
