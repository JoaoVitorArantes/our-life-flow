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

export const PURCHASE_STATUSES: {
  value: PurchaseStatus;
  label: string;
  emoji: string;
  dot: string;
  tone: string;
}[] = [
  { value: "WANT_TO_BUY", label: "Quero isso", emoji: "👀", dot: "bg-primary", tone: "border-primary/30 bg-primary/10 text-primary" },
  { value: "RESEARCHING", label: "Pesquisando", emoji: "🔎", dot: "bg-sky-500", tone: "border-sky-500/30 bg-sky-500/10 text-sky-500" },
  { value: "DECIDED", label: "Já decidimos", emoji: "😎", dot: "bg-amber-500", tone: "border-amber-500/30 bg-amber-500/10 text-amber-500" },
  { value: "PURCHASED", label: "Compramos!", emoji: "🎉", dot: "bg-emerald-500", tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500" },
  { value: "DISCARDED", label: "Deixamos pra lá", emoji: "🙃", dot: "bg-muted-foreground", tone: "border-border bg-muted text-muted-foreground" },
];

export const PURCHASE_PRIORITIES: { value: PurchasePriority; label: string; emoji: string }[] = [
  { value: "LOW", label: "Pode esperar", emoji: "🌙" },
  { value: "MEDIUM", label: "Queremos", emoji: "✨" },
  { value: "HIGH", label: "Queremos muito", emoji: "🔥" },
];

export const PERSON_SCOPES: { value: PersonScope; label: string; emoji: string }[] = [
  { value: "COUPLE", label: "Nós", emoji: "👥" },
  { value: "JOAO", label: "João", emoji: "👤" },
  { value: "RENIFER", label: "Renifer", emoji: "👤" },
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
export function statusEmoji(status: string) {
  return PURCHASE_STATUSES.find((item) => item.value === status)?.emoji ?? "👀";
}
export function statusTone(status: string) {
  return (
    PURCHASE_STATUSES.find((item) => item.value === status)?.tone ??
    "border-border bg-muted text-muted-foreground"
  );
}
export function priorityEmoji(priority: string) {
  return PURCHASE_PRIORITIES.find((item) => item.value === priority)?.emoji ?? "✨";
}
export function personEmoji(scope: string) {
  return PERSON_SCOPES.find((item) => item.value === scope)?.emoji ?? "👤";
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

/** Microtexto simpático derivado dos dados reais da compra. */
export function purchaseVibe(purchase: Purchase): { text: string; tone: "good" | "warn" | "soft" } | null {
  if (purchase.status === "PURCHASED") return { text: "🎉 Essa já saiu da wishlist!", tone: "good" };
  if (purchase.status === "DISCARDED") return null;
  const delta = budgetDelta(purchase);
  if (delta?.under) {
    return delta.percent >= 20
      ? { text: "🔥 Achado! Bem abaixo do orçamento.", tone: "good" }
      : { text: "🤑 Tá dentro do orçamento!", tone: "good" };
  }
  if (delta && !delta.under) return { text: "😬 Passou um pouco do limite.", tone: "warn" };
  if (purchase.status === "DECIDED") return { text: "😎 Agora só falta comprar.", tone: "soft" };
  if (purchase.found_price == null) return { text: "👀 Ainda estamos de olho.", tone: "soft" };
  if (purchase.purchase_url) return { text: "🔗 Encontramos onde comprar.", tone: "soft" };
  return null;
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
