import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { z } from "zod";
import type { actionSchema } from "./action-schema";
import {
  contextCreateInput,
  contextProposalSchema,
  isContextIntent,
} from "@/features/contexts/ai-contract";
import { contextSchema } from "@/features/contexts/validation";
import { evaluationInputSchema, sessionInputSchema } from "@/features/academic/contracts";
import { isAcademicIntent } from "./intents.shared";

/** Re-check edited references at the point of confirmation, with the caller's RLS client. */
export async function validateActionReferences(
  sb: SupabaseClient<Database>,
  workspaceId: string,
  action: z.infer<typeof actionSchema>,
) {
  const { card_id, account_id, category_id, context_id, payer_user_id } = action;
  if (isContextIntent(action.intent)) {
    if (card_id || account_id || category_id || payer_user_id || action.shared)
      throw new Error("Confira os campos do contexto; pagamentos não fazem parte desta ação.");
    if (action.intent === "create_context") {
      if (context_id) throw new Error("Um novo contexto não pode usar o identificador de outro.");
      contextCreateInput(action.description, action.context_data);
      return;
    }
    if (!context_id) throw new Error("Selecione o contexto antes de confirmar.");
    const { data: current, error } = await sb
      .from("contexts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("id", context_id)
      .maybeSingle();
    if (error || !current) throw new Error("Este contexto não está disponível neste espaço.");
    if (action.intent === "update_context")
      contextSchema.parse({
        ...current,
        ...contextProposalSchema.parse(action.context_data ?? {}),
        name: action.description,
      });
    return;
  }
  if (isAcademicIntent(action.intent)) {
    if (card_id || account_id || category_id || context_id || payer_user_id || action.shared)
      throw new Error("Confira os campos; pagamentos não fazem parte desta ação.");
    if (!action.academic_course_id)
      throw new Error("Selecione a disciplina antes de confirmar.");
    const { data: course, error: courseError } = await sb
      .from("academic_courses")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("id", action.academic_course_id)
      .maybeSingle();
    if (courseError || !course)
      throw new Error("Esta disciplina não está disponível neste espaço.");
    if (action.intent === "create_evaluation")
      evaluationInputSchema.parse({
        course_id: action.academic_course_id,
        title: action.description,
        kind: action.evaluation_kind ?? "EXAM",
        due_date: action.date,
        weight: action.weight,
        grade: action.grade,
        status: action.grade != null ? "GRADED" : "PENDING",
      });
    else
      sessionInputSchema.parse({
        course_id: action.academic_course_id,
        date: action.date,
        time: action.time,
        duration_minutes: action.duration_minutes,
        topic: action.content,
        attended: action.attended,
      });
    return;
  }
  if (card_id && account_id) throw new Error("Escolha cartão ou conta, não ambos.");
  if (action.intent === "income" && card_id)
    throw new Error("Selecione uma conta para a receita, não um cartão.");
  const reject = () =>
    new Error(
      "Uma referência não está mais disponível neste espaço. Edite a prévia antes de confirmar.",
    );
  const results = await Promise.all([
    card_id
      ? sb
          .from("cards")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("id", card_id)
          .eq("is_active", true)
          .maybeSingle()
      : null,
    account_id
      ? sb
          .from("accounts")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("id", account_id)
          .eq("is_active", true)
          .maybeSingle()
      : null,
    category_id
      ? sb
          .from("categories")
          .select("id,type")
          .eq("workspace_id", workspaceId)
          .eq("id", category_id)
          .is("archived_at", null)
          .maybeSingle()
      : null,
    context_id
      ? sb
          .from("contexts")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("id", context_id)
          .neq("status", "ARCHIVED")
          .maybeSingle()
      : null,
    payer_user_id
      ? sb
          .from("workspace_members")
          .select("user_id")
          .eq("workspace_id", workspaceId)
          .eq("user_id", payer_user_id)
          .maybeSingle()
      : null,
  ]);
  if (results.some((r) => r && (r.error || !r.data))) throw reject();
  const category = results[2]?.data;
  if (
    category &&
    "type" in category &&
    (action.intent === "expense" || action.intent === "income") &&
    category.type !== (action.intent === "expense" ? "EXPENSE" : "INCOME")
  )
    throw reject();
}
