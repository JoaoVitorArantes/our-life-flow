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
import type { InboxAction } from "@/lib/inbox/inbox.functions";
import { actionSchema } from "@/features/plugins/action-schema";
import { authorizePluginAction } from "@/features/plugins/plugins.functions";

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
};

export type ExecResult = { id: string; module: string; href: string };

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

export function missingFields(a: InboxAction): string[] {
  const missing: string[] = [];
  if (!a.description.trim()) missing.push("descrição");
  if ((a.intent === "expense" || a.intent === "income") && !a.amount) missing.push("valor");
  if (a.intent === "expense" && !a.card_id && !a.account_id) missing.push("forma de pagamento");
  if (a.intent === "expense" && a.installments && !a.card_id) missing.push("cartão das parcelas");
  return missing;
}

export async function executeAction(a: InboxAction, ctx: ExecContext): Promise<ExecResult> {
  a = actionSchema.parse(a);
  const missing = missingFields(a);
  if (missing.length) throw new Error(`Confira os campos: ${missing.join(", ")}.`);
  const authorized = await authorizePluginAction({
    data: { intent: a.intent, expectedWorkspaceId: ctx.workspaceId, confirmed: true },
  });
  const { workspaceId, userId } = authorized;
  const { queryClient } = ctx;
  const invalidate = (...keys: string[]) =>
    Promise.all(keys.map((k) => queryClient.invalidateQueries({ queryKey: [k] })));

  const amount = a.amount;
  const date = a.date;
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

  // tarefas, agenda, notas e metas: mesmos inserts do formulário rápido
  const owner = {
    workspace_id: workspaceId,
    owner_id: userId,
    visibility: "SHARED" as const,
    context_id: a.context_id,
    title: a.description,
  };
  if (a.intent === "event") {
    const { data, error } = await supabase
      .from("events")
      .insert({ ...owner, starts_at: new Date(`${a.date}T${a.time ?? "09:00"}`).toISOString() })
      .select("id")
      .single();
    if (error) throw error;
    await invalidate("events");
    return { id: data.id, module: "Agenda", href: "/agenda" };
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
  if (a.intent === "task") {
    const { data, error } = await supabase
      .from("tasks")
      .insert({ ...owner, due_date: a.date })
      .select("id")
      .single();
    if (error) throw error;
    await invalidate("tasks");
    return { id: data.id, module: "Tarefas", href: "/tarefas" };
  }
  if (a.intent === "goal") {
    const { data, error } = await supabase
      .from("goals")
      .insert({ ...owner, target_amount: a.amount, due_date: a.date })
      .select("id")
      .single();
    if (error) throw error;
    await invalidate("goals");
    return { id: data.id, module: "Metas", href: "/metas" };
  }
  if (a.intent !== "note") throw new Error("Esta ação não está disponível.");
  const { data, error } = await supabase
    .from("notes")
    .insert({ ...owner, content: a.content ?? a.description })
    .select("id")
    .single();
  if (error) throw error;
  await invalidate("notes");
  return { id: data.id, module: "Notas", href: "/notas" };
}
