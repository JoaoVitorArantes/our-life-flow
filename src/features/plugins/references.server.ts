import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { z } from "zod";
import type { actionSchema } from "./action-schema";

/** Re-check edited references at the point of confirmation, with the caller's RLS client. */
export async function validateActionReferences(
  sb: SupabaseClient<Database>, workspaceId: string, action: z.infer<typeof actionSchema>,
) {
  const { card_id, account_id, category_id, context_id, payer_user_id } = action;
  if (card_id && account_id) throw new Error("Escolha cartão ou conta, não ambos.");
  if (action.intent === "income" && card_id)
    throw new Error("Selecione uma conta para a receita, não um cartão.");
  const reject = () => new Error("Uma referência não está mais disponível neste espaço. Edite a prévia antes de confirmar.");
  const results = await Promise.all([
    card_id ? sb.from("cards").select("id").eq("workspace_id", workspaceId)
      .eq("id", card_id).eq("is_active", true).maybeSingle() : null,
    account_id ? sb.from("accounts").select("id").eq("workspace_id", workspaceId)
      .eq("id", account_id).eq("is_active", true).maybeSingle() : null,
    category_id ? sb.from("categories").select("id,type").eq("workspace_id", workspaceId)
      .eq("id", category_id).is("archived_at", null).maybeSingle() : null,
    context_id ? sb.from("contexts").select("id").eq("workspace_id", workspaceId)
      .eq("id", context_id).neq("status", "ARCHIVED").maybeSingle() : null,
    payer_user_id ? sb.from("workspace_members").select("user_id").eq("workspace_id", workspaceId)
      .eq("user_id", payer_user_id).maybeSingle() : null,
  ]);
  if (results.some((r) => r && (r.error || !r.data))) throw reject();
  const category = results[2]?.data;
  if (category && "type" in category && (action.intent === "expense" || action.intent === "income") &&
      category.type !== (action.intent === "expense" ? "EXPENSE" : "INCOME")) throw reject();
}