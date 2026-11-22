/**
 * Orçamento do Casamento — cálculos puros sobre os registros `wedding_budget_*` e
 * `wedding_expenses` (despesas avulsas). Nada aqui lê ou soma o Financeiro geral.
 * Valores vazios nunca viram zero presumido: ficam fora dos totais e são contados como “sem valor”.
 */
export type BudgetStatus = "planned" | "quoting" | "contracted" | "cancelled";
export const STATUS_LABEL: Record<BudgetStatus, string> = {
  planned: "Planejado",
  quoting: "Orçando",
  contracted: "Contratado",
  cancelled: "Cancelado",
};
export const STATUSES = Object.keys(STATUS_LABEL) as BudgetStatus[];

/** Sugestões oferecidas ao casal (só criadas se eles pedirem). */
export const SUGGESTED_CATEGORIES = [
  "Espaço",
  "Buffet",
  "Decoração",
  "Fotografia e vídeo",
  "Música",
  "Vestuário",
  "Cerimônia",
  "Papelaria",
  "Beleza",
  "Transporte",
  "Outros",
] as const;

export type BItem = {
  id: string;
  name: string;
  category_id: string | null;
  supplier_id: string | null;
  planned_amount: number | null;
  contracted_amount: number | null;
  status: string;
  due_date: string | null;
  notes: string | null;
};
export type BPayment = { id: string; item_id: string; amount: number; paid_on: string };
export type BExpense = { amount: number; spent_on: string };

const n = (v: number | string | null | undefined) => (v == null ? null : Number(v));
const isoToday = () => new Date().toISOString().slice(0, 10);

export function parseMoney(raw: string): number | null | typeof NaN {
  const s = raw.trim().replace(/\s|R\$/g, "");
  if (!s) return null;
  // “25.000” (milhar, sem vírgula) é 25 mil; “1.500,50” usa vírgula decimal.
  const normalized = s.includes(",")
    ? s.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(s)
      ? s.replace(/\./g, "")
      : s;
  const v = Number(normalized);
  if (!Number.isFinite(v) || v < 0 || v > 100_000_000) return NaN;
  return Math.round(v * 100) / 100;
}

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type PayState = "unknown" | "none" | "partial" | "paid" | "over";
export type DueState = "none" | "overdue" | "soon" | "later";

export function itemTotals(item: BItem, payments: readonly BPayment[], today = isoToday()) {
  const paid = payments
    .filter((p) => p.item_id === item.id)
    .reduce((t, p) => t + Number(p.amount), 0);
  const contracted = n(item.contracted_amount);
  const planned = n(item.planned_amount);
  const cancelled = item.status === "cancelled";
  const pending = !cancelled && contracted != null ? Math.max(contracted - paid, 0) : null;
  const payState: PayState =
    contracted == null
      ? paid > 0
        ? "partial"
        : "unknown"
      : paid === 0
        ? contracted === 0
          ? "paid"
          : "none"
        : paid > contracted
          ? "over"
          : paid === contracted
            ? "paid"
            : "partial";
  const open = !cancelled && !(contracted != null && paid >= contracted);
  const due: DueState =
    !item.due_date || !open
      ? "none"
      : item.due_date < today
        ? "overdue"
        : item.due_date <= addDays(today, 14)
          ? "soon"
          : "later";
  return {
    paid,
    planned,
    contracted,
    pending,
    /** Dinheiro já comprometido: contratado (ou o pago, se for maior); cancelado conta só o que foi pago. */
    committed: cancelled ? paid : Math.max(contracted ?? 0, paid),
    payState,
    due,
    hasValue: planned != null || contracted != null,
  };
}

export function overview(
  totalBudget: number | null,
  items: readonly BItem[],
  payments: readonly BPayment[],
  expenses: readonly BExpense[] = [],
  today = isoToday(),
) {
  let planned = 0;
  let contracted = 0;
  let paidItems = 0;
  let pending = 0;
  let committed = 0;
  let withoutValue = 0;
  let overdue = 0;
  let overdueAmount = 0;
  let soon = 0;
  let active = 0;
  for (const item of items) {
    const t = itemTotals(item, payments, today);
    paidItems += t.paid;
    committed += t.committed;
    if (item.status === "cancelled") continue;
    active += 1;
    if (t.planned != null) planned += t.planned;
    if (t.contracted != null) contracted += t.contracted;
    if (t.pending != null) pending += t.pending;
    if (!t.hasValue) withoutValue += 1;
    if (t.due === "overdue") {
      overdue += 1;
      overdueAmount += t.pending ?? 0;
    }
    if (t.due === "soon") soon += 1;
  }
  const avulsas = expenses.reduce((t, e) => t + Number(e.amount), 0);
  const committedAll = committed + avulsas;
  return {
    totalBudget,
    planned,
    contracted,
    paidItems,
    avulsas,
    paid: paidItems + avulsas,
    pending,
    committed: committedAll,
    remaining: totalBudget == null ? null : totalBudget - committedAll,
    withoutValue,
    overdue,
    overdueAmount,
    soon,
    active,
  };
}

export function byCategory(
  items: readonly BItem[],
  payments: readonly BPayment[],
  categoryIds: readonly string[],
) {
  const keys = [...categoryIds, "none"];
  return keys
    .map((k) => {
      const list = items.filter((i) => (i.category_id ?? "none") === k);
      const live = list.filter((i) => i.status !== "cancelled");
      const t = live.map((i) => itemTotals(i, payments));
      return {
        id: k,
        items: list,
        planned: t.reduce((s, x) => s + (x.planned ?? 0), 0),
        contracted: t.reduce((s, x) => s + (x.contracted ?? 0), 0),
        paid: list.map((i) => itemTotals(i, payments).paid).reduce((s, x) => s + x, 0),
        pending: t.reduce((s, x) => s + (x.pending ?? 0), 0),
      };
    })
    .filter((g) => g.items.length > 0);
}

/** 12 meses de qualquer ano: pago (pagamentos + avulsas) e a vencer (saldo de itens com data). */
export function byMonth(
  year: number,
  items: readonly BItem[],
  payments: readonly BPayment[],
  expenses: readonly BExpense[] = [],
) {
  const y = String(year).padStart(4, "0");
  return Array.from({ length: 12 }, (_, i) => {
    const key = `${y}-${String(i + 1).padStart(2, "0")}`;
    const due = items.filter((it) => it.due_date?.slice(0, 7) === key && it.status !== "cancelled");
    const duePending = due.reduce((s, it) => s + (itemTotals(it, payments).pending ?? 0), 0);
    const paidPayments = payments.filter((p) => p.paid_on.slice(0, 7) === key);
    const paidExpenses = expenses.filter((e) => e.spent_on.slice(0, 7) === key);
    return {
      key,
      dueItems: due,
      duePending,
      payments: paidPayments,
      paid:
        paidPayments.reduce((s, p) => s + Number(p.amount), 0) +
        paidExpenses.reduce((s, e) => s + Number(e.amount), 0),
      expenses: paidExpenses,
    };
  });
}

/** Busca sem diferenciar maiúsculas e acentos (“foto” encontra “Fotógrafo”). */
const fold = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

export type ItemFilter = {
  q: string;
  category: string; // "all" | id | "none"
  status: string; // "all" | BudgetStatus
  pay: "all" | "pending" | "paid" | "overdue" | "novalue";
};
export function filterItems(
  items: readonly BItem[],
  payments: readonly BPayment[],
  f: ItemFilter,
  supplierName: (id: string | null) => string | null = () => null,
  today = isoToday(),
) {
  const q = fold(f.q.trim());
  return items.filter((i) => {
    if (f.category !== "all" && (i.category_id ?? "none") !== f.category) return false;
    if (f.status !== "all" && i.status !== f.status) return false;
    if (f.pay !== "all") {
      const t = itemTotals(i, payments, today);
      if (f.pay === "pending" && !(t.pending && t.pending > 0)) return false;
      if (f.pay === "paid" && !(t.payState === "paid" || t.payState === "over")) return false;
      if (f.pay === "overdue" && t.due !== "overdue") return false;
      if (f.pay === "novalue" && (t.hasValue || i.status === "cancelled")) return false;
    }
    if (!q) return true;
    return [i.name, i.notes, supplierName(i.supplier_id)]
      .filter(Boolean)
      .some((s) => fold(s!).includes(q));
  });
}
