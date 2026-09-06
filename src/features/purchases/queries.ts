import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Purchase = Tables<"purchases">;

export type PurchaseStatus =
  | "WANT_TO_BUY"
  | "RESEARCHING"
  | "DECIDED"
  | "PURCHASED"
  | "DISCARDED";
export type PurchasePriority = "LOW" | "MEDIUM" | "HIGH";
export type PersonScope = "JOAO" | "RENIFER" | "COUPLE";

export const PURCHASE_STATUSES: { value: PurchaseStatus; label: string; dot: string }[] = [
  { value: "WANT_TO_BUY", label: "Quero comprar", dot: "bg-primary" },
  { value: "RESEARCHING", label: "Pesquisando", dot: "bg-sky-500" },
  { value: "DECIDED", label: "Decidido", dot: "bg-amber-500" },
  { value: "PURCHASED", label: "Comprado", dot: "bg-emerald-500" },
  { value: "DISCARDED", label: "Desistimos", dot: "bg-muted-foreground" },
];

export const PURCHASE_PRIORITIES: { value: PurchasePriority; label: string }[] = [
  { value: "LOW", label: "Baixa" },
  { value: "MEDIUM", label: "Média" },
  { value: "HIGH", label: "Alta" },
];

export const PERSON_SCOPES: { value: PersonScope; label: string }[] = [
  { value: "COUPLE", label: "Nós" },
  { value: "JOAO", label: "João" },
  { value: "RENIFER", label: "Renifer" },
];

export const PURCHASE_CATEGORIES: { value: string; label: string; emoji: string }[] = [
  { value: "HOME", label: "Casa", emoji: "🏠" },
  { value: "ELECTRONICS", label: "Eletrônicos", emoji: "🔌" },
  { value: "CLOTHES", label: "Roupas", emoji: "👕" },
  { value: "LEISURE", label: "Lazer", emoji: "🎉" },
  { value: "TRAVEL", label: "Viagem", emoji: "✈️" },
  { value: "SPORT", label: "Academia/Esporte", emoji: "🏋️" },
  { value: "COLLEGE", label: "Faculdade", emoji: "🎓" },
  { value: "WORK", label: "Trabalho", emoji: "💼" },
  { value: "GIFTS", label: "Presentes", emoji: "🎁" },
  { value: "TECH", label: "Tecnologia", emoji: "💻" },
  { value: "OTHER", label: "Outros", emoji: "📦" },
];

export function statusLabel(status: string) {
  return PURCHASE_STATUSES.find((item) => item.value === status)?.label ?? status;
}
export function statusDot(status: string) {
  return PURCHASE_STATUSES.find((item) => item.value === status)?.dot ?? "bg-muted-foreground";
}
export function priorityLabel(priority: string) {
  return PURCHASE_PRIORITIES.find((item) => item.value === priority)?.label ?? priority;
}
export function personLabel(scope: string) {
  return PERSON_SCOPES.find((item) => item.value === scope)?.label ?? scope;
}
export function categoryLabel(category?: string | null) {
  if (!category) return null;
  return PURCHASE_CATEGORIES.find((item) => item.value === category)?.label ?? category;
}
export function categoryEmoji(category?: string | null) {
  return PURCHASE_CATEGORIES.find((item) => item.value === category)?.emoji ?? "🛍️";
}

/** Diferença entre orçamento e melhor preço encontrado. */
export function budgetDelta(purchase: Purchase) {
  const budget = purchase.budget_amount == null ? null : Number(purchase.budget_amount);
  const price = purchase.found_price == null ? null : Number(purchase.found_price);
  if (budget == null || price == null || !budget) return null;
  const diff = budget - price;
  if (Math.abs(diff) < 0.01) return null;
  return { diff, percent: (Math.abs(diff) / budget) * 100, under: diff > 0 };
}

export function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function usePurchases(workspaceId?: string) {
  return useQuery({
    queryKey: ["purchases", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Purchase[];
    },
  });
}

export type PurchaseInput = {
  title: string;
  description?: string | null;
  category?: string | null;
  budget_amount?: number | null;
  found_price?: number | null;
  purchase_url?: string | null;
  image_url?: string | null;
  priority: PurchasePriority;
  status: PurchaseStatus;
  desired_date?: string | null;
  context_id?: string | null;
  person_scope: PersonScope;
  notes?: string | null;
  purchased_at?: string | null;
};

export async function createPurchase(workspaceId: string, createdBy: string, input: PurchaseInput) {
  const { data, error } = await supabase
    .from("purchases")
    .insert({ ...input, workspace_id: workspaceId, created_by: createdBy })
    .select("*")
    .single();
  if (error) throw error;
  return data as Purchase;
}

export async function updatePurchase(id: string, input: Partial<PurchaseInput> & { transaction_id?: string | null }) {
  const { error } = await supabase.from("purchases").update(input).eq("id", id);
  if (error) throw error;
}

export async function deletePurchase(id: string) {
  const { error } = await supabase.from("purchases").delete().eq("id", id);
  if (error) throw error;
}
