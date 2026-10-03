import type { Account, InvoicePayment, Recurring, Transaction } from "./queries";
import { addMonths, splitInstallments, sumBy, todayISO } from "./calc";
import { calculateSafeToSpend, type SafeToSpend } from "./safe-to-spend";

/**
 * Simulador "E se...?": monta lançamentos/recorrências fictícios em memória e
 * roda exatamente o mesmo motor do Dinheiro livre (calculateSafeToSpend).
 * Nunca grava nada.
 */
export type ScenarioKind = "purchase" | "expense" | "income" | "installment" | "cancel" | "change";

export type Scenario = {
  kind: ScenarioKind;
  description: string;
  amount: number;
  date: string;
  parts: number;
  recurringIncome: boolean;
  cardId: string | null;
  accountId: string | null;
  categoryId: string | null;
  contextId: string | null;
  /** "rec:<id>" ou "tx:<id>" para cancelar/alterar. */
  targetKey: string | null;
  newAmount: number;
};

export type Base = {
  accounts: Account[];
  transactions: Transaction[];
  recurrences: Recurring[];
  payments: InvoicePayment[];
};

const fake = (s: Scenario, i: number, date: string, amount: number, type: "INCOME" | "EXPENSE", ws: string): Transaction =>
  ({
    id: `sim-${i}-${date}`,
    workspace_id: ws,
    owner_id: "",
    type,
    amount,
    description: s.description || "Simulação",
    transaction_date: date,
    due_date: date,
    category_id: s.categoryId,
    account_id: s.accountId,
    card_id: type === "EXPENSE" ? s.cardId : null,
    context_id: s.contextId,
    status: "PENDING",
    installment_plan_id: null,
    recurring_id: null,
  }) as unknown as Transaction;

/** Aplica a decisão sobre uma cópia dos dados reais. */
export function applyScenario(base: Base, s: Scenario): Base {
  const ws = base.accounts[0]?.workspace_id ?? "";
  let transactions = base.transactions;
  let recurrences = base.recurrences;
  const amount = Math.max(0, s.amount || 0);
  if (s.kind === "purchase" || s.kind === "expense" || s.kind === "installment") {
    if (amount > 0) {
      const parts = s.kind === "expense" ? 1 : Math.max(1, Math.round(s.parts || 1));
      const values = splitInstallments(amount, parts);
      // Cada parcela no seu mês; no cartão, dueDateOf leva para a fatura correta.
      transactions = [...transactions, ...values.map((v, i) => fake(s, i, addMonths(s.date, i), v, "EXPENSE", ws))];
    }
  } else if (s.kind === "income") {
    if (amount > 0) {
      if (s.recurringIncome) {
        recurrences = [
          ...recurrences,
          {
            id: "sim-rec",
            workspace_id: ws,
            owner_id: "",
            description: s.description || "Nova receita (simulação)",
            amount,
            type: "INCOME",
            category_id: s.categoryId,
            account_id: s.accountId,
            card_id: null,
            context_id: s.contextId,
            frequency: "MONTHLY",
            start_date: s.date,
            end_date: null,
            next_date: null,
            due_day: Number(s.date.slice(8, 10)),
            is_active: true,
          } as unknown as Recurring,
        ];
      } else transactions = [...transactions, fake(s, 0, s.date, amount, "INCOME", ws)];
    }
  } else if (s.targetKey) {
    const [kind, id] = s.targetKey.split(":");
    const today = todayISO();
    if (kind === "rec") {
      if (s.kind === "cancel") {
        recurrences = recurrences.filter((r) => r.id !== id);
        transactions = transactions.filter((t) => !(t.recurring_id === id && t.status !== "PAID" && (t.due_date ?? t.transaction_date) >= today));
      } else {
        recurrences = recurrences.map((r) => (r.id === id ? { ...r, amount: s.newAmount } : r));
        transactions = transactions.map((t) => (t.recurring_id === id && t.status !== "PAID" ? { ...t, amount: s.newAmount } : t));
      }
    } else if (kind === "tx") {
      transactions =
        s.kind === "cancel"
          ? transactions.filter((t) => t.id !== id)
          : transactions.map((t) => (t.id === id ? { ...t, amount: s.newAmount } : t));
    }
  }
  return { ...base, transactions, recurrences };
}

export type MonthPoint = { month: string; balance: number };

/** Saldo projetado no fim de cada um dos próximos meses (mesmo motor, horizonte longo). */
function monthly(b: Base, today: string, months: number): MonthPoint[] {
  const long = calculateSafeToSpend(b.accounts, b.transactions, months * 31 + 5, today, b.recurrences, b.payments);
  const out: MonthPoint[] = [];
  for (let i = 0; i < months; i++) {
    const ref = addMonths(`${today.slice(0, 7)}-01`, i);
    const [y, m] = ref.split("-").map(Number);
    const end = `${ref.slice(0, 7)}-${String(new Date(y!, m!, 0).getDate()).padStart(2, "0")}`;
    let bal = long.available;
    for (const e of long.timeline) if (e.date <= end) bal = e.balance;
    out.push({ month: ref.slice(0, 7), balance: bal });
  }
  return out;
}

export type SimResult = {
  before: SafeToSpend;
  after: SafeToSpend;
  series: { month: string; before: number; after: number }[];
  monthlyDelta: number;
  totalImpact: number;
  affectedMonths: number;
  conclusions: string[];
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function simulate(base: Base, s: Scenario, today = todayISO(), months = 12): SimResult {
  const sim = applyScenario(base, s);
  const before = calculateSafeToSpend(base.accounts, base.transactions, 30, today, base.recurrences, base.payments);
  const after = calculateSafeToSpend(sim.accounts, sim.transactions, 30, today, sim.recurrences, sim.payments);
  const mb = monthly(base, today, months);
  const ma = monthly(sim, today, months);
  const series = mb.map((p, i) => ({ month: p.month, before: p.balance, after: ma[i]!.balance }));
  const diffs = series.map((p, i) => p.after - p.before - (i ? series[i - 1]!.after - series[i - 1]!.before : 0));
  const affectedMonths = diffs.filter((d) => Math.abs(d) > 0.009).length;
  const totalImpact = series.length ? series[series.length - 1]!.after - series[series.length - 1]!.before : 0;

  let monthlyDelta = 0;
  if (s.kind === "installment" || (s.kind === "purchase" && s.parts > 1)) monthlyDelta = -splitInstallments(s.amount, Math.max(1, s.parts))[0]!;
  else if (s.kind === "income" && s.recurringIncome) monthlyDelta = s.amount;
  else if (s.targetKey?.startsWith("rec:")) {
    const r = base.recurrences.find((x) => `rec:${x.id}` === s.targetKey);
    if (r) {
      const sign = r.type === "INCOME" ? 1 : -1;
      monthlyDelta = s.kind === "cancel" ? -sign * Number(r.amount) : sign * (s.newAmount - Number(r.amount));
    }
  }

  const c: string[] = [];
  const freeDiff = after.spendable - before.spendable;
  const isSpend = s.kind === "purchase" || s.kind === "expense" || s.kind === "installment";
  if (isSpend) {
    if (s.amount > before.spendable && (s.parts <= 1 || s.kind === "expense")) c.push("Essa compra ultrapassa o dinheiro livre atual.");
    else if (after.lowest >= 0) c.push("Essa compra cabe no planejamento atual.");
  }
  if (after.lowest < 0 && before.lowest >= 0) c.push("Essa decisão cria um período de saldo negativo.");
  if (isSpend && affectedMonths > 1) c.push(`Essa compra reduz o espaço financeiro de vocês pelos próximos ${affectedMonths} meses.`);
  if (monthlyDelta < 0) c.push(`Essa decisão aumenta o comprometimento mensal em ${brl(-monthlyDelta)}.`);
  if (monthlyDelta > 0 && s.kind !== "income") c.push(`Isso libera ${brl(monthlyDelta)} por mês — ${brl(monthlyDelta * 12)} em 12 meses.`);
  if (s.kind === "income" && freeDiff > 0) c.push(`Essa receita aumentaria o dinheiro livre em ${brl(freeDiff)}.`);
  if (s.kind === "income" && freeDiff <= 0 && s.amount > 0)
    c.push("Essa receita não muda o dinheiro livre de hoje, mas melhora o saldo dos próximos meses.");
  if (!c.length && Math.abs(totalImpact) < 0.01) c.push("Essa decisão não muda a projeção dos próximos meses.");
  return { before, after, series, monthlyDelta, totalImpact, affectedMonths, conclusions: c };
}

export const committed = (r: SafeToSpend) => r.commitments;
export { sumBy };
