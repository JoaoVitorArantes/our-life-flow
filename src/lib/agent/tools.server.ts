import { tool, type ToolSet } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/integrations/supabase/types";
import { calculateSafeToSpend, paidByInvoice, invoiceKey } from "@/features/finance/safe-to-spend";
import { dueDateOf, isOpen, registerCardCycles, sumBy } from "@/features/finance/calc";
import { netBalance } from "@/features/nos/settlements";
import { occursOn } from "@/features/routines/queries";
import { proposalInputSchema, normalizeProposal } from "@/features/plugins/action-schema";
import { readInputSchemas } from "@/features/plugins/contracts";
import { guardTools } from "@/features/plugins/dispatch.server";
import { writeCapabilityAudit } from "@/features/plugins/audit.server";
import { intentAllowed } from "@/features/plugins/registry";
import { loadPluginAccess } from "@/features/plugins/access.server";
import { validateActionReferences } from "@/features/plugins/references.server";

/**
 * Camada de ferramentas do Life OS AI. Todas as consultas usam o cliente do PRÓPRIO usuário
 * (RLS ativa) e o workspace derivado da sessão — a IA nunca escolhe workspace/usuário.
 * Leituras executam direto; escritas só geram PROPOSTAS: a execução acontece no app,
 * após Confirmar, com as mesmas mutações dos formulários.
 */
export type AgentCtx = {
  supabase: SupabaseClient<Database>;
  workspaceId: string;
  userId: string;
  today: string;
  enabledPlugins: ReadonlySet<string>;
  executionRunId: string;
};

const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

function fail(area: string, error: unknown) {
  void error; // Never log private query payloads or raw database errors.
  return { error: `Não consegui consultar ${area} agora. Não invente números.` };
}

export async function loadBase(ctx: AgentCtx) {
  const { supabase: sb, workspaceId: w } = ctx;
  const [accounts, cards, categories, contexts, members, goals, workspace] = await Promise.all([
    ctx.enabledPlugins.has("finance")
      ? sb.from("accounts").select("*").eq("workspace_id", w)
      : { data: [] },
    ctx.enabledPlugins.has("finance")
      ? sb.from("cards").select("*").eq("workspace_id", w)
      : { data: [] },
    ctx.enabledPlugins.has("finance")
      ? sb.from("categories").select("id, name, type").eq("workspace_id", w).is("archived_at", null)
      : { data: [] },
    ctx.enabledPlugins.has("contexts")
      ? sb.from("contexts").select("id, name, type, status").eq("workspace_id", w)
      : { data: [] },
    sb.from("workspace_members").select("user_id").eq("workspace_id", w),
    ctx.enabledPlugins.has("goals")
      ? sb.from("goals").select("id, title, status").eq("workspace_id", w)
      : { data: [] },
    sb.from("workspaces").select("name, description").eq("id", w).maybeSingle(),
  ]);
  for (const result of [accounts, cards, categories, contexts, members, goals, workspace]) {
    if ("error" in result && result.error)
      throw new Error("Não foi possível consultar os dados do espaço.");
  }
  const ids = (members.data ?? []).map((m) => m.user_id);
  const profilesResult = ids.length
    ? await sb.from("profiles").select("id, name").in("id", ids)
    : { data: [] };
  if ("error" in profilesResult && profilesResult.error)
    throw new Error("Não foi possível verificar as pessoas do espaço.");
  const profiles = profilesResult.data;
  return {
    workspace: {
      name: workspace.data?.name ?? "Life OS",
      description: workspace.data?.description ?? null,
      members: ids.length,
    },
    accounts: accounts.data ?? [],
    cards: cards.data ?? [],
    categories: categories.data ?? [],
    contexts: contexts.data ?? [],
    goals: goals.data ?? [],
    people: (profiles ?? []).map((p) => ({ id: p.id, name: p.name, me: p.id === ctx.userId })),
  };
}
export type Base = Awaited<ReturnType<typeof loadBase>>;

export function buildTools(ctx: AgentCtx, base: Base) {
  const { supabase: sb, workspaceId: w, userId, today } = ctx;
  registerCardCycles(base.cards);
  const catName = new Map(base.categories.map((c) => [c.id, c.name]));
  const personName = new Map(base.people.map((p) => [p.id, p.name.split(" ")[0] ?? p.name]));
  const payName = new Map<string, string>([
    ...base.cards.map((c) => [c.id, c.name] as const),
    ...base.accounts.map((a) => [a.id, a.name] as const),
  ]);

  let finance: Promise<{
    tx: Tables<"transactions">[];
    rec: Tables<"recurring_transactions">[];
    pay: Tables<"card_invoice_payments">[];
  }> | null = null;
  const loadFinance = () =>
    (finance ??= (async () => {
      const [tx, rec, pay] = await Promise.all([
        sb
          .from("transactions")
          .select("*")
          .eq("workspace_id", w)
          .neq("status", "CANCELLED")
          .limit(5000),
        sb.from("recurring_transactions").select("*").eq("workspace_id", w),
        sb.from("card_invoice_payments").select("*").eq("workspace_id", w),
      ]);
      if (tx.error || rec.error || pay.error) throw new Error("Financial query failed");
      return { tx: tx.data ?? [], rec: rec.data ?? [], pay: pay.data ?? [] };
    })());

  const txLine = (t: Tables<"transactions">) => ({
    descricao: t.description,
    valor: Number(t.amount),
    tipo: t.type,
    data: t.transaction_date,
    vencimento: dueDateOf(t),
    status: t.status,
    categoria: t.category_id ? (catName.get(t.category_id) ?? null) : null,
    pagamento: payName.get(t.card_id ?? t.account_id ?? "") ?? null,
    quem_registrou: personName.get(t.owner_id) ?? null,
  });

  const tools = {
    financial_overview: tool({
      description:
        "Dinheiro Livre (quanto podem gastar com segurança) e projeção: saldo disponível, receitas previstas, compromissos e menor saldo projetado. Use para 'quanto posso gastar', 'como está meu dinheiro', 'posso comprar X'. É EXATAMENTE o mesmo cálculo do cockpit do Financeiro.",
      inputSchema: readInputSchemas.financial_overview,
      execute: async ({ horizon_days }) => {
        try {
          const { tx, rec, pay } = await loadFinance();
          const s = calculateSafeToSpend(
            base.accounts,
            tx,
            Math.min(365, Math.max(1, horizon_days || 30)),
            today,
            rec,
            pay,
          );
          return {
            dinheiro_livre: r2(s.spendable),
            saldo_disponivel_contas: r2(s.available),
            receitas_previstas: r2(s.income),
            compromissos_conhecidos: r2(s.commitments),
            saldo_ao_fim_do_horizonte: r2(s.safe),
            menor_saldo_projetado: r2(s.lowest),
            data_menor_saldo: s.lowestDate,
            ate: s.horizon,
            proximos_movimentos: s.timeline.slice(0, 12).map((e) => ({
              data: e.date,
              descricao: e.t.description,
              valor: e.t.type === "INCOME" ? r2(Number(e.t.amount)) : -r2(Number(e.t.amount)),
              previsto_recorrente: e.projected,
              saldo_apos: r2(e.balance),
            })),
          };
        } catch (e) {
          return fail("o Financeiro", e);
        }
      },
    }),

    transactions_summary: tool({
      description:
        "Totais e lançamentos reais (receitas/despesas) num período pela data do lançamento. Filtros opcionais: categoria, pessoa que registrou, busca na descrição, status. Retorna total, pago, pendente, por categoria, por pessoa e principais itens.",
      inputSchema: readInputSchemas.transactions_summary,
      execute: async (q) => {
        try {
          const { tx } = await loadFinance();
          const cat = q.category?.toLowerCase().trim();
          const rows = tx.filter(
            (t) =>
              (q.type === "ALL" ? t.type !== "TRANSFER" : t.type === q.type) &&
              t.transaction_date >= q.from &&
              t.transaction_date <= q.to &&
              (!cat || (catName.get(t.category_id ?? "") ?? "").toLowerCase().includes(cat)) &&
              (!q.person_id || t.owner_id === q.person_id) &&
              (!q.search ||
                `${t.description} ${t.notes ?? ""}`
                  .toLowerCase()
                  .includes(q.search.toLowerCase())) &&
              (q.status === "ANY" || (q.status === "PAID" ? t.status === "PAID" : isOpen(t))),
          );
          const group = (key: (t: Tables<"transactions">) => string) => {
            const m = new Map<string, number>();
            rows.forEach((t) => m.set(key(t), (m.get(key(t)) ?? 0) + Number(t.amount)));
            return [...m]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10)
              .map(([nome, total]) => ({ nome, total: r2(total) }));
          };
          return {
            periodo: { de: q.from, ate: q.to },
            quantidade: rows.length,
            total: r2(
              sumBy(
                rows,
                (t) => (q.type === "ALL" && t.type === "EXPENSE" ? -1 : 1) * Number(t.amount),
              ),
            ),
            pago_ou_recebido: r2(
              sumBy(
                rows.filter((t) => t.status === "PAID"),
                (t) => Number(t.amount),
              ),
            ),
            pendente_ou_previsto: r2(sumBy(rows.filter(isOpen), (t) => Number(t.amount))),
            por_categoria: group((t) => catName.get(t.category_id ?? "") ?? "Sem categoria"),
            por_pessoa: group((t) => personName.get(t.owner_id) ?? "—"),
            principais: [...rows]
              .sort((a, b) => Number(b.amount) - Number(a.amount))
              .slice(0, 10)
              .map(txLine),
          };
        } catch (e) {
          return fail("seus lançamentos", e);
        }
      },
    }),

    monthly_trend: tool({
      description:
        "Totais mês a mês (últimos N meses, incluindo o atual) de despesas ou receitas, opcionalmente de uma categoria. Use para comparar com a média histórica.",
      inputSchema: readInputSchemas.monthly_trend,
      execute: async ({ type, months, category }) => {
        try {
          const { tx } = await loadFinance();
          const n = Math.min(24, Math.max(2, months || 6));
          const [y, m] = today.split("-").map(Number);
          const cat = category?.toLowerCase().trim();
          const out = [];
          for (let i = n - 1; i >= 0; i--) {
            const d = new Date(y ?? 2026, (m ?? 1) - 1 - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            const total = sumBy(
              tx.filter(
                (t) =>
                  t.type === type &&
                  t.transaction_date.startsWith(key) &&
                  (!cat || (catName.get(t.category_id ?? "") ?? "").toLowerCase().includes(cat)),
              ),
              (t) => Number(t.amount),
            );
            out.push({ mes: key, total: r2(total), mes_atual_parcial: i === 0 });
          }
          return { meses: out };
        } catch (e) {
          return fail("o histórico", e);
        }
      },
    }),

    cards_status: tool({
      description:
        "Cartões: limite, quanto está usado, disponível, fatura atual (vencimento, total, já pago parcialmente, restante), fechamento e vencimento.",
      inputSchema: readInputSchemas.cards_status,
      execute: async () => {
        try {
          const { tx, pay } = await loadFinance();
          const paid = paidByInvoice(pay);
          return base.cards
            .filter((c) => c.is_active)
            .map((c) => {
              const open = tx.filter(
                (t) => t.card_id === c.id && t.type === "EXPENSE" && isOpen(t),
              );
              const byDue = new Map<string, number>();
              open.forEach((t) =>
                byDue.set(dueDateOf(t), (byDue.get(dueDateOf(t)) ?? 0) + Number(t.amount)),
              );
              const invoices = [...byDue]
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([due, total]) => {
                  const already = paid.get(invoiceKey(c.id, due)) ?? 0;
                  return {
                    vencimento: due,
                    total: r2(total),
                    ja_pago: r2(already),
                    restante: r2(Math.max(0, total - already)),
                  };
                });
              const used = sumBy(invoices, (i) => i.restante);
              return {
                cartao: c.name,
                dono: personName.get(c.owner_id) ?? null,
                limite: c.credit_limit != null ? Number(c.credit_limit) : null,
                usado: r2(used),
                disponivel: c.credit_limit != null ? r2(Number(c.credit_limit) - used) : null,
                fecha_dia: c.closing_day,
                vence_dia: c.due_day,
                faturas_abertas: invoices.slice(0, 6),
              };
            });
        } catch (e) {
          return fail("seus cartões", e);
        }
      },
    }),

    upcoming_bills: tool({
      description:
        "Próximas contas/compromissos a pagar (inclui faturas de cartão pelo vencimento da fatura, parcelas e recorrentes previstas) e contas atrasadas.",
      inputSchema: readInputSchemas.upcoming_bills,
      execute: async ({ days }) => {
        try {
          const { tx, rec, pay } = await loadFinance();
          const s = calculateSafeToSpend(
            base.accounts,
            tx,
            Math.min(180, Math.max(1, days || 30)),
            today,
            rec,
            pay,
          );
          const list = s.expenses
            .map((t) => ({
              ...txLine(t),
              previsto_recorrente: !!t.projected,
              atrasada: dueDateOf(t) < today,
            }))
            .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
          return {
            ate: s.horizon,
            total: r2(s.commitments),
            atrasadas: list.filter((x) => x.atrasada).slice(0, 15),
            proximas: list.filter((x) => !x.atrasada).slice(0, 20),
          };
        } catch (e) {
          return fail("suas contas", e);
        }
      },
    }),

    installments: tool({
      description:
        "Compras parceladas: total, parcelas pagas, restantes, valor que falta e última parcela.",
      inputSchema: readInputSchemas.installments,
      execute: async () => {
        try {
          const [{ tx }, plans] = await Promise.all([
            loadFinance(),
            sb.from("installment_plans").select("*").eq("workspace_id", w),
          ]);
          if (plans.error) throw plans.error;
          return (plans.data ?? []).map((p) => {
            const items = tx
              .filter((t) => t.installment_plan_id === p.id)
              .sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));
            const open = items.filter(isOpen);
            return {
              descricao: p.description,
              total: Number(p.total_amount),
              parcelas: p.total_installments,
              pagas: items.filter((t) => t.status === "PAID").length,
              restantes: open.length,
              falta_pagar: r2(sumBy(open, (t) => Number(t.amount))),
              ultima_parcela: items.at(-1)
                ? dueDateOf(items.at(-1) as Tables<"transactions">)
                : null,
              cartao: payName.get(p.card_id ?? p.account_id ?? "") ?? null,
            };
          });
        } catch (e) {
          return fail("suas parcelas", e);
        }
      },
    }),

    nos_balance: tool({
      description:
        "Nós (casal): quem deve quanto para quem (acertos pendentes) e despesas compartilhadas num período. Acertos NÃO são receitas nem despesas.",
      inputSchema: readInputSchemas.nos_balance,
      execute: async ({ from, to }) => {
        try {
          const [{ tx }, st, splits] = await Promise.all([
            loadFinance(),
            sb.from("settlements").select("*").eq("workspace_id", w),
            sb.from("transaction_splits").select("transaction_id").eq("workspace_id", w),
          ]);
          if (st.error || splits.error) throw new Error("Shared query failed");
          const nb = netBalance(st.data ?? [], userId);
          const splitIds = new Set((splits.data ?? []).map((s) => s.transaction_id));
          const shared = tx.filter(
            (t) =>
              t.type === "EXPENSE" &&
              (t.is_shared || splitIds.has(t.id)) &&
              t.transaction_date >= from &&
              t.transaction_date <= to,
          );
          return {
            eu_devo: nb.owedByMe,
            me_devem: nb.owedToMe,
            saldo_liquido_para_mim: nb.net,
            transferencias_para_acertar: nb.transfers.map((t) => ({
              de: personName.get(t.fromUserId),
              para: personName.get(t.toUserId),
              valor: r2(t.amount),
            })),
            acertos_pendentes: nb.pending.length,
            despesas_compartilhadas_no_periodo: {
              total: r2(sumBy(shared, (t) => Number(t.amount))),
              quantidade: shared.length,
              itens: shared.slice(0, 10).map(txLine),
            },
          };
        } catch (e) {
          return fail("o Nós", e);
        }
      },
    }),

    goals: tool({
      description: "Metas: alvo, valor atual, quanto falta, prazo e status.",
      inputSchema: readInputSchemas.goals,
      execute: async () => {
        const { data, error } = await sb
          .from("goals")
          .select("title, target_amount, current_amount, due_date, status")
          .eq("workspace_id", w);
        if (error) return fail("suas metas", error);
        return data.map((g) => ({
          ...g,
          falta:
            g.target_amount != null
              ? r2(Number(g.target_amount) - Number(g.current_amount ?? 0))
              : null,
        }));
      },
    }),

    tasks: tool({
      description:
        "Tarefas não concluídas (ou todas). scope: overdue (atrasadas), today, upcoming (próximos 7 dias), open (todas abertas).",
      inputSchema: readInputSchemas.tasks,
      execute: async ({ scope }) => {
        const { data, error } = await sb
          .from("tasks")
          .select("title, due_date, status, owner_id")
          .eq("workspace_id", w)
          .neq("status", "DONE")
          .order("due_date", { nullsFirst: false });
        if (error) return fail("suas tarefas", error);
        const week = new Date(`${today}T12:00:00`);
        week.setDate(week.getDate() + 7);
        const wk = week.toISOString().slice(0, 10);
        const f = data.filter((t) =>
          scope === "overdue"
            ? !!t.due_date && t.due_date < today
            : scope === "today"
              ? t.due_date === today
              : scope === "upcoming"
                ? !!t.due_date && t.due_date >= today && t.due_date <= wk
                : true,
        );
        return {
          quantidade: f.length,
          tarefas: f.slice(0, 25).map((t) => ({
            titulo: t.title,
            prazo: t.due_date,
            status: t.status,
            de: personName.get(t.owner_id),
          })),
        };
      },
    }),

    agenda: tool({
      description:
        "Compromissos da Agenda num intervalo de datas, mais eventos recorrentes e rotinas que ocorrem nesses dias.",
      inputSchema: readInputSchemas.agenda,
      execute: async ({ from, to }) => {
        const [ev, rec, routines] = await Promise.all([
          sb
            .from("events")
            .select("title, starts_at, ends_at, location, status")
            .eq("workspace_id", w)
            .is("recurrence", null)
            .gte("starts_at", `${from}T00:00:00-03:00`)
            .lte("starts_at", `${to}T23:59:59-03:00`)
            .order("starts_at"),
          sb
            .from("events")
            .select("title, starts_at, recurrence, recurrence_until")
            .eq("workspace_id", w)
            .not("recurrence", "is", null)
            .lte("starts_at", `${to}T23:59:59-03:00`),
          sb.from("routines").select("*").eq("workspace_id", w).eq("status", "ACTIVE"),
        ]);
        if (ev.error || rec.error || routines.error)
          return fail("sua agenda", ev.error ?? rec.error ?? routines.error);
        const days: string[] = [];
        for (
          let d = new Date(`${from}T12:00:00`);
          d.toISOString().slice(0, 10) <= to && days.length < 31;
          d.setDate(d.getDate() + 1)
        )
          days.push(d.toISOString().slice(0, 10));
        const fmt = (s: string) =>
          new Date(s).toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
            weekday: "short",
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          });
        return {
          compromissos: ev.data.map((e) => ({
            titulo: e.title,
            inicio: fmt(e.starts_at),
            local: e.location,
            status: e.status,
          })),
          recorrentes: (rec.data ?? [])
            .filter((e) => !e.recurrence_until || e.recurrence_until >= from)
            .map((e) => ({ titulo: e.title, desde: fmt(e.starts_at), repete: e.recurrence })),
          rotinas: days
            .flatMap((d) =>
              (routines.data ?? [])
                .filter((r) => occursOn(r, d))
                .map((r) => ({ dia: d, titulo: r.title, horario: r.start_time, tipo: r.kind })),
            )
            .slice(0, 30),
        };
      },
    }),

    activities: tool({
      description:
        "Atividades físicas registradas (Esporte) num período: total de minutos, quantidade, última atividade.",
      inputSchema: readInputSchemas.activities,
      execute: async ({ from, to }) => {
        const { data, error } = await sb
          .from("physical_activities")
          .select(
            "title, activity_type, activity_date, duration_minutes, distance_km, person_scope",
          )
          .eq("workspace_id", w)
          .gte("activity_date", from)
          .lte("activity_date", to)
          .order("activity_date", { ascending: false });
        if (error) return fail("suas atividades", error);
        const last = await sb
          .from("physical_activities")
          .select("title, activity_date")
          .eq("workspace_id", w)
          .order("activity_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (last.error) return fail("suas atividades", last.error);
        return {
          quantidade: data.length,
          minutos_total: sumBy(data, (a) => a.duration_minutes ?? 0),
          atividades: data.slice(0, 20),
          ultima_atividade_geral: last.data,
        };
      },
    }),

    purchases: tool({
      description:
        "Lista de Compras/desejos: itens, orçamento planejado, prioridade e status (WANT_TO_BUY, RESEARCHING, DECIDED, PURCHASED, DISCARDED).",
      inputSchema: readInputSchemas.purchases,
      execute: async ({ include_done }) => {
        let q = sb
          .from("purchases")
          .select("title, budget_amount, found_price, priority, status, desired_date")
          .eq("workspace_id", w);
        if (!include_done) q = q.not("status", "in", "(PURCHASED,DISCARDED)");
        const { data, error } = await q;
        if (error) return fail("suas compras", error);
        return {
          quantidade: data.length,
          total_planejado: r2(sumBy(data, (p) => Number(p.budget_amount ?? p.found_price ?? 0))),
          itens: data.slice(0, 30),
        };
      },
    }),

    routines_today: tool({
      description: "Rotinas e hábitos do dia e se já foram feitos.",
      inputSchema: readInputSchemas.routines_today,
      execute: async ({ date }) => {
        const [rs, logs] = await Promise.all([
          sb.from("routines").select("*").eq("workspace_id", w).eq("status", "ACTIVE"),
          sb
            .from("routine_logs")
            .select("routine_id, status")
            .eq("workspace_id", w)
            .eq("log_date", date),
        ]);
        if (rs.error || logs.error) return fail("suas rotinas", rs.error ?? logs.error);
        const st = new Map((logs.data ?? []).map((l) => [l.routine_id, l.status]));
        return rs.data
          .filter((r) => occursOn(r, date))
          .map((r) => ({
            titulo: r.title,
            tipo: r.kind,
            horario: r.start_time,
            feito: st.get(r.id) ?? "pendente",
          }));
      },
    }),

    contexts: tool({
      description:
        "Contextos (viagens, projetos, eventos) com orçamento e quanto já foi gasto em cada um.",
      inputSchema: readInputSchemas.contexts,
      execute: async () => {
        try {
          const { tx } = await loadFinance();
          const { data, error } = await sb
            .from("contexts")
            .select("id, name, type, status, start_date, end_date, budget_amount")
            .eq("workspace_id", w)
            .neq("status", "ARCHIVED");
          if (error) throw error;
          return (data ?? []).map((c) => ({
            ...c,
            gasto: r2(
              sumBy(
                tx.filter((t) => t.context_id === c.id && t.type === "EXPENSE"),
                (t) => Number(t.amount),
              ),
            ),
          }));
        } catch (e) {
          return fail("seus contextos", e);
        }
      },
    }),

    context_details: tool({
      description:
        "Consulta detalhes atuais de um contexto por id real, incluindo arquivados; use antes de propor edição, arquivamento ou lixeira.",
      inputSchema: readInputSchemas.context_details,
      execute: async ({ id }) => {
        const { data, error } = await sb
          .from("contexts")
          .select(
            "id,name,description,type,status,start_date,end_date,location,budget_amount,visibility",
          )
          .eq("workspace_id", w)
          .eq("id", id)
          .maybeSingle();
        if (error || !data) return fail("este contexto", error);
        return data;
      },
    }),
    notes: tool({
      description:
        "Consulta notas acessíveis no espaço; busca literal opcional no título e conteúdo.",
      inputSchema: readInputSchemas.notes,
      execute: async ({ search }) => {
        const { data, error } = await sb
          .from("notes")
          .select("id,title,content,context_id")
          .eq("workspace_id", w)
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) return fail("suas notas", error);
        const term = search?.trim().toLocaleLowerCase();
        return {
          notas: (data ?? []).filter(
            (n) => !term || `${n.title} ${n.content ?? ""}`.toLocaleLowerCase().includes(term),
          ),
          limite: 100,
        };
      },
    }),

    academics: tool({
      description:
        "Consulta a vida acadêmica de um aluno do espaço (Faculdade é compartilhada entre os membros, separada por aluno): períodos letivos, disciplinas (situação, nota, créditos, pré-requisitos), avaliações e aulas com presença. owner_id opcional escolhe o aluno (precisa ser membro do espaço; veja Pessoas); sem owner_id, consulta o seu próprio perfil. Se a tela atual for /faculdade/<id>, use esse id como owner_id. Campos null = dado não informado; nunca invente.",
      inputSchema: readInputSchemas.academics,
      execute: async ({ owner_id }) => {
        const ownerId = owner_id ?? userId;
        if (!base.people.some((p) => p.id === ownerId))
          return fail("o perfil acadêmico desta pessoa", null);
        const [terms, courses, evaluations, sessions] = await Promise.all([
          sb
            .from("academic_terms")
            .select("id,name,starts_on,ends_on,enrollment_until,status")
            .eq("workspace_id", w)
            .eq("owner_id", ownerId)
            .order("starts_on", { ascending: true, nullsFirst: false }),
          sb
            .from("academic_courses")
            .select(
              "id,name,code,semester,credits,status,grade,attendance_percent,prerequisites,term_id",
            )
            .eq("workspace_id", w)
            .eq("owner_id", ownerId)
            .order("name"),
          sb
            .from("academic_evaluations")
            .select("id,course_id,title,kind,due_date,weight,grade,status")
            .eq("workspace_id", w)
            .eq("owner_id", ownerId)
            .order("due_date", { ascending: true, nullsFirst: false })
            .limit(100),
          sb
            .from("academic_sessions")
            .select("id,course_id,starts_at,duration_minutes,topic,attended")
            .eq("workspace_id", w)
            .eq("owner_id", ownerId)
            .order("starts_at", { ascending: false })
            .limit(200),
        ]);
        if (terms.error || courses.error || evaluations.error || sessions.error)
          return fail(
            "a vida acadêmica deste perfil",
            terms.error ?? courses.error ?? evaluations.error ?? sessions.error,
          );
        return {
          periodos: terms.data ?? [],
          disciplinas: courses.data ?? [],
          avaliacoes: evaluations.data ?? [],
          aulas: sessions.data ?? [],
        };
      },
    }),

    propose_action: tool({
      description:
        "Propõe registro: Contextos (create_context, update_context, archive_context, delete_context) e Faculdade (create_evaluation, log_class). description = nome/título; context_data = campos de contexto; context_id = id real apenas para alterar existente; academic_course_id = id real de disciplina (obrigatório para avaliação/aula); evaluation_kind = EXAM/ASSIGNMENT/PROJECT/QUIZ/OTHER; log_class exige date, aceita time, duration_minutes, content (assunto) e attended. Criar contexto só exige nome (Pessoal, Ativo, Compartilhado). NÃO salva: usuário confirma. Despesas precisam forma de pagamento; pergunte quando ambíguo. Nunca substitua ids desconhecidos nem proponha gasto vinculado a contexto ainda não criado.",
      inputSchema: proposalInputSchema,
      execute: async (input) => {
        const a = normalizeProposal(input);
        const enabled = await loadPluginAccess(sb, userId, w);
        if (!intentAllowed(a.intent, enabled))
          throw new Error("Plugin desativado ou permissão necessária. Nenhuma ação foi proposta.");
        await validateActionReferences(sb, w, a);
        if (
          [
            "create_context",
            "update_context",
            "archive_context",
            "delete_context",
            "create_evaluation",
            "log_class",
          ].includes(a.intent)
        )
          return a;
        const ok = (set: { id: string }[], id: string | null) =>
          id && set.some((x) => x.id === id) ? id : null;
        return {
          ...a,
          amount:
            a.amount != null && Number.isFinite(a.amount) && a.amount > 0 ? r2(a.amount) : null,
          date: a.date && /^\d{4}-\d{2}-\d{2}$/.test(a.date) ? a.date : today,
          time: a.time && /^\d{2}:\d{2}$/.test(a.time) ? a.time : null,
          card_id: ok(base.cards, a.card_id),
          account_id: ok(base.accounts, a.account_id),
          category_id: ok(base.categories, a.category_id),
          context_id: ok(base.contexts, a.context_id),
          payer_user_id: base.people.some((p) => p.id === a.payer_user_id)
            ? a.payer_user_id
            : userId,
          installments:
            a.installments && a.installments > 1 ? Math.min(48, Math.round(a.installments)) : null,
          my_share_percent:
            a.my_share_percent != null ? Math.min(100, Math.max(0, a.my_share_percent)) : 50,
        };
      },
    }),
  };
  const registered: ToolSet = tools;
  return guardTools(
    registered,
    ctx.enabledPlugins,
    () => loadPluginAccess(sb, userId, w),
    (name, outcome) =>
      writeCapabilityAudit(
        sb,
        ctx,
        ctx.executionRunId,
        name,
        outcome,
        name === "propose_action" ? "proposed" : "not_required",
      ),
  );
}
