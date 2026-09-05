import type { Database } from "@/integrations/supabase/types";

export type AccountType = Database["public"]["Enums"]["account_type"];
export type TransactionType = Database["public"]["Enums"]["transaction_type"];
export type Visibility = Database["public"]["Enums"]["visibility"];
export type CategoryType = Database["public"]["Enums"]["category_type"];
export type SettlementStatus = Database["public"]["Enums"]["settlement_status"];
export type RecurrenceFrequency = Database["public"]["Enums"]["recurrence_frequency"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status"];
export type LoanType = Database["public"]["Enums"]["loan_type"];
export type ObligationStatus = Database["public"]["Enums"]["obligation_status"];

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "CHECKING", label: "Conta corrente" },
  { value: "SAVINGS", label: "Poupança" },
  { value: "CASH", label: "Dinheiro" },
  { value: "INVESTMENT", label: "Investimento" },
  { value: "OTHER", label: "Outro" },
];

export const TRANSACTION_TYPES: { value: TransactionType; label: string }[] = [
  { value: "EXPENSE", label: "Despesa" },
  { value: "INCOME", label: "Receita" },
  { value: "TRANSFER", label: "Transferência" },
];

export const VISIBILITIES: { value: Visibility; label: string; hint: string }[] = [
  { value: "PRIVATE", label: "Privado", hint: "Só você enxerga" },
  { value: "SHARED", label: "Compartilhado", hint: "Visível para o workspace" },
];

export const SPLIT_PRESETS = [
  { label: "50/50", value: 50 },
  { label: "70/30", value: 70 },
  { label: "Personalizada", value: -1 },
];

export const PAYMENT_STATUSES: { value: PaymentStatus; label: string }[] = [
  { value: "PAID", label: "Pago" },
  { value: "PENDING", label: "Pendente" },
  { value: "OVERDUE", label: "Atrasado" },
  { value: "CANCELLED", label: "Cancelado" },
];

export const RECURRENCE_FREQUENCIES: { value: RecurrenceFrequency; label: string }[] = [
  { value: "WEEKLY", label: "Semanal" },
  { value: "MONTHLY", label: "Mensal" },
  { value: "YEARLY", label: "Anual" },
  { value: "CUSTOM", label: "Personalizada" },
];

export const LOAN_TYPES: { value: LoanType; label: string; hint: string }[] = [
  { value: "LENT", label: "Emprestei", hint: "Você vai receber de volta" },
  { value: "BORROWED", label: "Peguei emprestado", hint: "Você vai pagar" },
];

export const OBLIGATION_STATUSES: { value: ObligationStatus; label: string }[] = [
  { value: "ACTIVE", label: "Ativo" },
  { value: "COMPLETED", label: "Concluído" },
  { value: "CANCELLED", label: "Cancelado" },
];

export function statusLabel(status: PaymentStatus) {
  return PAYMENT_STATUSES.find((item) => item.value === status)?.label ?? status;
}

/** Pending items whose due date already passed are shown as overdue. */
export function effectiveStatus(
  status: PaymentStatus,
  dueDate: string | null,
  today = new Date(),
): PaymentStatus {
  if (status !== "PENDING") return status;
  if (!dueDate) return status;
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  return dueDate < iso ? "OVERDUE" : "PENDING";
}
