import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export async function updateTransaction(id: string, values: TablesUpdate<"transactions">) {
  const { error } = await supabase.from("transactions").update(values).eq("id", id);
  if (error) throw error;
}

export async function deleteTransaction(id: string) {
  await supabase.from("transaction_splits").delete().eq("transaction_id", id);
  await supabase.from("installments").delete().eq("transaction_id", id);
  const { error } = await supabase.from("transactions").delete().eq("id", id);
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
