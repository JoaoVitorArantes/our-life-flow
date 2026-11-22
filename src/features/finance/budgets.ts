import type { Tables, TablesInsert } from "@/integrations/supabase/types";

/**
 * Orçamentos contínuos: cada regra vale de `start_month` até `end_month` (inclusivo) ou para
 * sempre quando `end_month` é nulo. Nada é copiado por mês/ano — o mês consultado escolhe a regra.
 */
export type BudgetRule = Tables<"budget_rules">;
export type BudgetScope = "SHARED" | "MINE";
export type MonthKey = string; // "YYYY-MM"

type Tx = Pick<
  Tables<"transactions">,
  "type" | "status" | "amount" | "transaction_date" | "category_id" | "visibility" | "owner_id"
>;

export const ALL = "__all__"; // orçamento geral (sem categoria)

export function shiftMonth(key: MonthKey, n: number): MonthKey {
  const [y, m] = key.split("-").map(Number) as [number, number];
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  return `${String(ny).padStart(4, "0")}-${String(total - ny * 12 + 1).padStart(2, "0")}`;
}
export const monthsBetween = (a: MonthKey, b: MonthKey) => {
  const [ay, am] = a.split("-").map(Number) as [number, number];
  const [by, bm] = b.split("-").map(Number) as [number, number];
  return (by - ay) * 12 + (bm - am);
};
export const toMonthDate = (key: MonthKey) => `${key}-01`;
const keyOf = (date: string | null | undefined) => (date ? date.slice(0, 7) : null);

export function ruleCovers(rule: Pick<BudgetRule, "start_month" | "end_month">, key: MonthKey) {
  const start = keyOf(rule.start_month)!;
  const end = keyOf(rule.end_month);
  return start <= key && (end === null || end >= key);
}

export function inScope(
  row: { visibility: string; owner_id: string },
  scope: BudgetScope,
  userId: string,
) {
  return scope === "SHARED"
    ? row.visibility === "SHARED"
    : row.visibility === "PRIVATE" && row.owner_id === userId;
}

/** Regra mais específica do mês: início mais recente, depois a de menor duração, depois a mais nova. */
export function pickRule(rules: BudgetRule[], key: MonthKey): BudgetRule | null {
  const span = (r: BudgetRule) =>
    r.end_month ? monthsBetween(r.start_month.slice(0, 7), r.end_month.slice(0, 7)) : Infinity;
  return (
    rules
      .filter((r) => ruleCovers(r, key))
      .sort(
        (a, b) =>
          b.start_month.localeCompare(a.start_month) ||
          span(a) - span(b) ||
          b.created_at.localeCompare(a.created_at),
      )[0] ?? null
  );
}

/** Orçamento vigente por categoria (ou ALL) no mês, dentro do escopo. */
export function resolveBudgets(
  rules: BudgetRule[],
  key: MonthKey,
  scope: BudgetScope,
  userId: string,
) {
  const groups = new Map<string, BudgetRule[]>();
  for (const r of rules) {
    if (!inScope(r, scope, userId)) continue;
    const k = r.category_id ?? ALL;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const out = new Map<string, { rule: BudgetRule; amount: number }>();
  for (const [k, list] of groups) {
    const rule = pickRule(list, key);
    if (rule) out.set(k, { rule, amount: Number(rule.amount) || 0 });
  }
  return out;
}

/** Despesas reais do mês por competência (data do lançamento), sem canceladas, no escopo. */
export function expensesOf(transactions: Tx[], key: MonthKey, scope: BudgetScope, userId: string) {
  return transactions.filter(
    (t) =>
      t.type === "EXPENSE" &&
      t.status !== "CANCELLED" &&
      t.transaction_date.slice(0, 7) === key &&
      inScope(t, scope, userId),
  );
}

export function spentByCategory(
  transactions: Tx[],
  key: MonthKey,
  scope: BudgetScope,
  userId: string,
) {
  const map = new Map<string, number>();
  let total = 0;
  for (const t of expensesOf(transactions, key, scope, userId)) {
    const v = Number(t.amount) || 0;
    total += v;
    const k = t.category_id ?? "none";
    map.set(k, (map.get(k) ?? 0) + v);
  }
  return { byCategory: map, total };
}

export type RuleKind = "recurring" | "once" | "range";
export function ruleKind(rule: Pick<BudgetRule, "start_month" | "end_month">): RuleKind {
  if (!rule.end_month) return "recurring";
  return rule.start_month.slice(0, 7) === rule.end_month.slice(0, 7) ? "once" : "range";
}

export type BudgetOp =
  | { type: "insert"; row: Omit<TablesInsert<"budget_rules">, "workspace_id" | "owner_id"> }
  | { type: "update"; id: string; patch: { amount?: number; end_month?: string | null } }
  | { type: "delete"; id: string };

/**
 * Editar o valor vigente em `key`:
 * - "month": só este mês (cria uma exceção de um mês; a regra original segue igual);
 * - "forward": deste mês em diante (encerra a regra no mês anterior e cria a nova) — meses
 *   anteriores nunca são reescritos.
 */
export function planEdit(
  rule: BudgetRule,
  key: MonthKey,
  amount: number,
  mode: "month" | "forward",
): BudgetOp[] {
  const start = rule.start_month.slice(0, 7);
  const kind = ruleKind(rule);
  if (kind === "once" && start === key) return [{ type: "update", id: rule.id, patch: { amount } }];
  const base = { category_id: rule.category_id, visibility: rule.visibility };
  if (mode === "month")
    return [
      {
        type: "insert",
        row: { ...base, amount, start_month: toMonthDate(key), end_month: toMonthDate(key) },
      },
    ];
  if (start === key) return [{ type: "update", id: rule.id, patch: { amount } }];
  return [
    { type: "update", id: rule.id, patch: { end_month: toMonthDate(shiftMonth(key, -1)) } },
    {
      type: "insert",
      row: { ...base, amount, start_month: toMonthDate(key), end_month: rule.end_month },
    },
  ];
}

/** Encerrar a partir de `key`: meses anteriores continuam com o valor que tinham. */
export function planStop(rule: BudgetRule, key: MonthKey): BudgetOp[] {
  if (rule.start_month.slice(0, 7) >= key) return [{ type: "delete", id: rule.id }];
  return [{ type: "update", id: rule.id, patch: { end_month: toMonthDate(shiftMonth(key, -1)) } }];
}

export function parseMoney(raw: string): number | null {
  const s = raw.trim().replace(/\s|R\$/g, "");
  if (!s) return null;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000) return NaN;
  return Math.round(n * 100) / 100;
}

/** Resumo do mês para alertas/cockpit (casal + pessoal da pessoa logada). */
export function monthBudgetStatus(
  rules: BudgetRule[],
  transactions: Tx[],
  key: MonthKey,
  userId: string,
) {
  const items: { scope: BudgetScope; categoryId: string; budget: number; spent: number }[] = [];
  for (const scope of ["SHARED", "MINE"] as const) {
    const budgets = resolveBudgets(rules, key, scope, userId);
    const spent = spentByCategory(transactions, key, scope, userId);
    for (const [k, b] of budgets) {
      if (b.amount <= 0) continue;
      items.push({
        scope,
        categoryId: k,
        budget: b.amount,
        spent: k === ALL ? spent.total : (spent.byCategory.get(k) ?? 0),
      });
    }
  }
  return items;
}

/** Ano digitado pelo usuário: qualquer ano de 4 dígitos (sem faixa artificial). */
export function parseYear(raw: string | number): number | null {
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  return Number.isInteger(n) && n >= 1900 && n <= 9999 ? n : null;
}

export type BudgetState = "none" | "ok" | "warn" | "over";
export function budgetState(spent: number, limit: number): BudgetState {
  if (!(limit > 0)) return "none";
  if (spent > limit) return "over";
  return spent / limit >= 0.85 ? "warn" : "ok";
}

/** Só lançamentos de uma pessoa (filtro “quem gastou”); null = todos. */
export function byOwner<T extends { owner_id: string }>(rows: T[], ownerId: string | null) {
  return ownerId ? rows.filter((r) => r.owner_id === ownerId) : rows;
}

/**
 * Resumo de um mês. Com orçamento geral (> 0) o teto é o geral e conta todo o gasto;
 * sem ele, o teto é a soma dos limites por categoria e conta só o gasto dessas categorias.
 */
export function monthSummary(
  rules: BudgetRule[],
  transactions: Tx[],
  key: MonthKey,
  scope: BudgetScope,
  userId: string,
) {
  const budgets = resolveBudgets(rules, key, scope, userId);
  const spent = spentByCategory(transactions, key, scope, userId);
  const overall = budgets.get(ALL);
  let catPlanned = 0;
  let catUsed = 0;
  for (const [k, b] of budgets) {
    if (k === ALL || b.amount <= 0) continue;
    catPlanned += b.amount;
    catUsed += spent.byCategory.get(k) ?? 0;
  }
  const hasOverall = !!overall && overall.amount > 0;
  const planned = hasOverall ? overall.amount : catPlanned;
  const used = hasOverall ? spent.total : catUsed;
  return {
    key,
    budgets,
    spent,
    hasOverall,
    catPlanned,
    planned,
    used,
    spentTotal: spent.total,
    unbudgeted: hasOverall ? 0 : spent.total - catUsed,
    left: planned - used,
    pct: planned > 0 ? Math.round((used / planned) * 100) : null,
    state: budgetState(used, planned),
  };
}

/** Visão anual: 12 resumos calculados das mesmas regras e lançamentos (nada é copiado). */
export function yearSummary(
  rules: BudgetRule[],
  transactions: Tx[],
  year: number,
  scope: BudgetScope,
  userId: string,
) {
  const months = Array.from({ length: 12 }, (_, i) =>
    monthSummary(
      rules,
      transactions,
      `${String(year).padStart(4, "0")}-${String(i + 1).padStart(2, "0")}`,
      scope,
      userId,
    ),
  );
  return {
    months,
    planned: months.reduce((t, m) => t + m.planned, 0),
    spent: months.reduce((t, m) => t + m.spentTotal, 0),
    used: months.reduce((t, m) => t + m.used, 0),
    monthsWithBudget: months.filter((m) => m.planned > 0).length,
  };
}
