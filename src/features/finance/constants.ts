import type { Database } from "@/integrations/supabase/types";

export type AccountType = Database["public"]["Enums"]["account_type"];
export type TransactionType = Database["public"]["Enums"]["transaction_type"];
export type Visibility = Database["public"]["Enums"]["visibility"];
export type CategoryType = Database["public"]["Enums"]["category_type"];
export type SettlementStatus = Database["public"]["Enums"]["settlement_status"];
export type RecurrenceFrequency = Database["public"]["Enums"]["recurrence_frequency"];

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
