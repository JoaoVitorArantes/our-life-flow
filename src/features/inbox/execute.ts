import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createTransaction } from "@/features/finance/queries";
import { createInstallmentPlan } from "@/features/finance/mutations";
import { saveDivision } from "@/features/nos/mutations";
import {
  createPurchase,
  type PersonScope,
  type PurchasePriority,
} from "@/features/purchases/queries";
import { createActivity, type ActivityPerson } from "@/features/activities/queries";
import type { z } from "zod";
import { actionSchema } from "@/features/plugins/action-schema";
import { authorizePluginAction } from "@/features/plugins/plugins.functions";
import { saveSimpleRecord } from "@/features/records/mutations";
import {
  contextCreateInput,
  contextProposalSchema,
  isContextIntent,
} from "@/features/contexts/ai-contract";
import { executeContextAction } from "@/features/contexts/execute-confirmed";
import { createEvaluation, createSession } from "@/features/academic/mutations";
import { isAcademicIntent } from "@/features/plugins/intents.shared";
import type { EvaluationKind } from "@/features/academic/contracts";

/**
 * Executor da Inbox: transforma uma ação JÁ confirmada em chamadas às MESMAS mutações usadas
 * pelos formulários. Não contém regras financeiras próprias (ciclos, faturas, parcelas e
 * acertos continuam no motor existente).
 */
export type ExecContext = {
  workspaceId: string;
  userId: string;
  memberIds: string[];
  queryClient: QueryClient;
  threadId?: string;
};

export type ExecResult = { id: string; module: string; href: string };

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export function missingFields(a: z.infer<typeof actionSchema>): string[] {
  const missing: string[] = [];
  if (!a.description.trim()) missing.push("descrição");
  if (isContextIntent(a.intent) && a.intent !== "create_context" && !a.context_id)
    missing.push("contexto a alterar");
  if ((a.intent === "expense" || a.intent === "income") && !a.amount) missing.push("valor");
  if (a.intent === "expense" && !a.card_id && !a.account_id) missing.push("forma de pagamento");
  if (a.intent === "expense" && a.installments && !a.card_id) missing.push("cartão das parcelas");
  if (["expense", "income", "event", "activity"].includes(a.intent) && !a.date)
    missing.push("data");
  if (a.intent === "expense" && a.installments && a.shared)
    missing.push("parcelamento dividido ainda não suportado nesta prévia");
  if (isAcademicIntent(a.intent) && !a.academic_course_id) missing.push("disciplina");
  if (a.intent === "log_class" && !a.date) missing.push("data da aula");
  return missing;
}

export async function executeAction(
  a: z.infer<typeof actionSchema>,
  ctx: ExecContext,
): Promise<ExecResult> {
  // Prévias salvas antes dos campos acadêmicos continuam confirmáveis: preenche nulls ausentes.
  const legacyDefaults = {
    academic_course_id: null,
    evaluation_kind: null,
    grade: null,
    weight: null,
    attended: null,
  };
  a = actionSchema.parse({ ...legacyDefaults, ...(a as object) });
  const missing = missingFields(a);
  if (missing.length) throw new Error(`Confira os campos: ${missing.join(", ")}.`);
  if (a.intent === "create_context") contextCreateInput(a.description, a.context_data);
  if (isContextIntent(a.intent)) contextProposalSchema.parse(a.context_data ?? {});
  const authorized = await authorizePluginAction({
    data: {
      intent: a.intent,
      expectedWorkspaceId: ctx.workspaceId,
      confirmed: true,
      action: a,
      ...(ctx.threadId ? { threadId: ctx.threadId } : {}),
    },
  });
  const { workspaceId, userId } = authorized;
  const { queryClient } = ctx;
  const invalidate = (...keys: string[]) =>
    Promise.all(keys.map((k) => queryClient.invalidateQueries({ queryKey: [k] })));

  const amount = a.amount;
  const date = a.date;
  if (isContextIntent(a.intent)) {
    const result = await executeContextAction(a, workspaceId, userId);
    await invalidate("contexts", "context", "trash", "workspace_activity");
    return result;
  }
  if (
    (a.intent === "expense" || a.intent === "income") &&
    (amount == null || !Number.isFinite(amount) || amount <= 0 || !date)
  )
    throw new Error("Confira o valor e a data antes de confirmar.");
  if ((a.intent === "activity" || a.intent === "event") && !date)
    throw new Error("Informe a data antes de confirmar.");
  if (a.intent === "expense" && a.installments && a.card_id && amount != null && date) {
    const planId = await createInstallmentPlan({
      workspaceId,
      ownerId: userId,
      description: a.description,
      totalAmount: amount ?? 0,
      totalInstallments: a.installments,
      startDate: date ?? "",
      categoryId: a.category_id,
      cardId: a.card_id,
      contextId: a.context_id,
      visibility: "SHARED",
      firstPaid: false,
    });
    await invalidate("transactions", "installment_plans");
    return {
      id: String((planId as { id?: string } | undefined)?.id ?? planId ?? ""),
      module: "Financeiro",
      href: "/financeiro",
    };
  }

  if (a.intent === "expense" || a.intent === "income") {
    const isExpense = a.intent === "expense";
    const shared = isExpense && a.shared && ctx.memberIds.length === 2;
    const created = await createTransaction({
      workspaceId,
      ownerId: userId,
      type: isExpense ? "EXPENSE" : "INCOME",
      amount: amount ?? 0,
      description: a.description,
      transactionDate: date ?? "",
      dueDate: date ?? "",
      // compra no cartão fica pendente até a fatura; demais seguem o padrão do formulário (pago)
      status: isExpense && a.card_id ? "PENDING" : "PAID",
      categoryId: a.category_id,
      accountId: a.card_id ? null : a.account_id,
      cardId: isExpense ? a.card_id : null,
      contextId: a.context_id,
      visibility: "SHARED",
      isShared: shared,
    });
    if (shared) {
      const other = ctx.memberIds.find((id) => id !== userId);
      if (!other) throw new Error("Confira as pessoas do espaço antes de dividir.");
      const mine = round2(((amount ?? 0) * (a.my_share_percent ?? 50)) / 100);
      await saveDivision({
        workspaceId,
        transactionId: created.id,
        memberIds: ctx.memberIds,
        shares: [
          { userId, amount: mine },
          { userId: other, amount: round2((amount ?? 0) - mine) },
        ],
        payers: [{ userId: a.payer_user_id ?? userId, amount: amount ?? 0 }],
        note: a.description,
      });
    }
    await invalidate(
      "transactions",
      "settlements",
      "transaction_splits",
      "transaction_payers",
      "transaction_division",
    );
    return { id: created.id, module: "Financeiro", href: "/financeiro" };
  }

  if (a.intent === "purchase") {
    const p = await createPurchase(workspaceId, userId, {
      title: a.description,
      budget_amount: a.amount,
      category: a.purchase_category,
      priority: (["LOW", "MEDIUM", "HIGH"].includes(a.priority ?? "")
        ? a.priority
        : "MEDIUM") as PurchasePriority,
      status: "WANT_TO_BUY",
      context_id: a.context_id,
      person_scope: (["JOAO", "RENIFER", "COUPLE"].includes(a.person_scope ?? "")
        ? a.person_scope
        : "COUPLE") as PersonScope,
    });
    await invalidate("purchases");
    return { id: p.id, module: "Compras", href: "/compras" };
  }

  if (a.intent === "activity") {
    const act = await createActivity(workspaceId, userId, {
      activity_type: a.activity_type || "OTHER",
      title: a.description,
      activity_date: date ?? "",
      start_time: a.time,
      duration_minutes: a.duration_minutes ? Math.round(a.duration_minutes) : null,
      distance_km: a.distance_km,
      person_scope: (["JOAO", "RENIFER", "COUPLE"].includes(a.person_scope ?? "")
        ? a.person_scope
        : "COUPLE") as ActivityPerson,
      context_id: a.context_id,
    });
    await invalidate("physical_activities", "activities");
    return { id: act.id, module: "Esporte", href: "/esporte" };
  }

  if (a.intent === "rename_workspace") {
    // Ação administrativa: só roda depois do Confirmar, pela mesma função protegida da tela Meu espaço.
    const { data: ws, error: wsError } = await supabase
      .from("workspaces")
      .select("*")
      .eq("id", workspaceId)
      .single();
    if (wsError) throw wsError;
    const { error } = await supabase.rpc("update_workspace_identity", {
      _workspace_id: workspaceId,
      _name: a.description.trim().slice(0, 60),
      _description: ws.description ?? "",
      _accent_color: ws.accent_color as string,
      _avatar_url: null as unknown as string,
      _cover_url: null as unknown as string,
      _set_avatar: false,
      _set_cover: false,
    });
    if (error) throw error;
    await invalidate("workspace");
    return { id: workspaceId, module: "Meu espaço", href: "/configuracoes/espaco" };
  }
  if (a.intent === "create_evaluation") {
    const kind = (
      ["EXAM", "ASSIGNMENT", "PROJECT", "QUIZ", "OTHER"].includes(a.evaluation_kind ?? "")
        ? a.evaluation_kind
        : "EXAM"
    ) as EvaluationKind;
    const evaluation = await createEvaluation(workspaceId, userId, {
      course_id: a.academic_course_id ?? "",
      title: a.description,
      kind,
      due_date: a.date,
      weight: a.weight,
      grade: a.grade,
      status: a.grade != null ? "GRADED" : "PENDING",
    });
    await invalidate("academic_evaluations", "academic_courses");
    return { id: evaluation.id, module: "Faculdade", href: "/faculdade" };
  }

  if (a.intent === "log_class") {
    const session = await createSession(workspaceId, userId, {
      course_id: a.academic_course_id ?? "",
      date: date ?? "",
      time: a.time,
      duration_minutes: a.duration_minutes ? Math.round(a.duration_minutes) : null,
      topic: a.content,
      attended: a.attended,
    });
    await invalidate("academic_sessions");
    return { id: session.id, module: "Faculdade", href: "/faculdade" };
  }

  if (!["event", "task", "goal", "note"].includes(a.intent))
    throw new Error("Esta ação não está disponível.");
  const kind = a.intent as "event" | "task" | "goal" | "note";
  const targets = {
    event: { key: "events", module: "Agenda", href: "/agenda" },
    task: { key: "tasks", module: "Tarefas", href: "/tarefas" },
    goal: { key: "goals", module: "Metas", href: "/metas" },
    note: { key: "notes", module: "Notas", href: "/notas" },
  };
  const saved = await saveSimpleRecord(kind, workspaceId, userId, {
    title: a.description,
    contextId: a.context_id,
    date: a.date,
    time: a.time,
    amount: a.amount,
    content: a.content ?? a.description,
  });
  await invalidate(targets[kind].key);
  return { id: saved.id, module: targets[kind].module, href: targets[kind].href };
}
