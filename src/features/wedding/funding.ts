/**
 * Fontes de recursos e dívidas do casamento (puro, sem I/O).
 * Fontes NÃO são custo nem receita; parcelas de empréstimo reduzem a dívida
 * e nunca somam ao custo do casamento (o custo vem só dos itens/avulsas).
 */
export type FundingKind = "own" | "loan" | "family";
export const KIND_LABEL: Record<FundingKind, string> = {
  own: "Dinheiro próprio",
  loan: "Empréstimo",
  family: "Ajuda da família",
};
export type FSource = {
  id: string;
  kind: string;
  promised_amount: number | null;
  received_amount: number | null;
  total_to_repay: number | null;
};
export type FInstallment = {
  id: string;
  source_id: string;
  number: number;
  due_date: string;
  amount: number;
};
export type FLoanPayment = { id: string; installment_id: string; amount: number; paid_on: string };
export type InstStatus = "upcoming" | "overdue" | "paid";
export const INST_LABEL: Record<InstStatus, string> = {
  upcoming: "A vencer",
  overdue: "Vencida",
  paid: "Paga",
};

const isoToday = () => new Date().toISOString().slice(0, 10);
const r2 = (v: number) => Math.round(v * 100) / 100;

export function installmentState(
  i: FInstallment,
  payments: readonly FLoanPayment[],
  today = isoToday(),
) {
  const paid = r2(
    payments.filter((p) => p.installment_id === i.id).reduce((t, p) => t + p.amount, 0),
  );
  const remaining = r2(Math.max(i.amount - paid, 0));
  const status: InstStatus = remaining <= 0 ? "paid" : i.due_date < today ? "overdue" : "upcoming";
  return { paid, remaining, status, partial: paid > 0 && remaining > 0 };
}

/** Datas mensais a partir da 1ª, mantendo o dia (ajusta ao fim do mês). Só roda por ação explícita. */
export function monthlySchedule(firstDue: string, count: number): string[] {
  const [y, m, d] = firstDue.split("-").map(Number) as [number, number, number];
  return Array.from({ length: count }, (_, k) => {
    const mm = m - 1 + k;
    const yy = y + Math.floor(mm / 12);
    const mon = ((mm % 12) + 12) % 12;
    const last = new Date(Date.UTC(yy, mon + 1, 0)).getUTCDate();
    return `${String(yy).padStart(4, "0")}-${String(mon + 1).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
  });
}

export function loanTotals(
  s: FSource,
  installments: readonly FInstallment[],
  payments: readonly FLoanPayment[],
  today = isoToday(),
) {
  const mine = installments.filter((i) => i.source_id === s.id);
  const states = mine.map((i) => ({ i, ...installmentState(i, payments, today) }));
  const scheduled = r2(mine.reduce((t, i) => t + i.amount, 0));
  const paid = r2(states.reduce((t, x) => t + x.paid, 0));
  // Total a devolver: o informado; sem ele, a soma das parcelas cadastradas; sem nada, desconhecido.
  const toRepay = s.total_to_repay != null ? s.total_to_repay : mine.length ? scheduled : null;
  const balance = toRepay == null ? null : r2(Math.max(toRepay - paid, 0));
  return {
    toRepay,
    paid,
    balance,
    overdue: states.filter((x) => x.status === "overdue").length,
    open: states.filter((x) => x.status !== "paid").length,
    mismatch:
      s.total_to_repay != null && mine.length > 0 && Math.abs(scheduled - s.total_to_repay) >= 0.01,
  };
}

export function fundingSummary(
  sources: readonly FSource[],
  installments: readonly FInstallment[],
  payments: readonly FLoanPayment[],
  today = isoToday(),
) {
  const sum = (kind: FundingKind, f: "promised_amount" | "received_amount") =>
    r2(sources.filter((s) => s.kind === kind).reduce((t, s) => t + (s[f] ?? 0), 0));
  let toRepay = 0,
    debtPaid = 0,
    balance = 0,
    unknownRepay = 0,
    overdue = 0;
  for (const s of sources.filter((x) => x.kind === "loan")) {
    const t = loanTotals(s, installments, payments, today);
    debtPaid += t.paid;
    overdue += t.overdue;
    if (t.toRepay == null) unknownRepay += 1;
    else {
      toRepay += t.toRepay;
      balance += t.balance ?? 0;
    }
  }
  const loanIds = new Set(sources.filter((s) => s.kind === "loan").map((s) => s.id));
  const month = today.slice(0, 7);
  const monthly = new Map<string, number>();
  for (const i of installments) {
    if (!loanIds.has(i.source_id) || i.due_date.slice(0, 7) < month) continue;
    const st = installmentState(i, payments, today);
    if (st.remaining <= 0) continue;
    const k = i.due_date.slice(0, 7);
    monthly.set(k, r2((monthly.get(k) ?? 0) + st.remaining));
  }
  return {
    ownReserved: sum("own", "promised_amount"),
    ownReceived: sum("own", "received_amount"),
    loanReceived: sum("loan", "received_amount"),
    familyPromised: sum("family", "promised_amount"),
    familyReceived: sum("family", "received_amount"),
    toRepay: r2(toRepay),
    debtPaid: r2(debtPaid),
    balance: r2(balance),
    unknownRepay,
    overdue,
    monthly: [...monthly.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([m, amount]) => ({ month: m, amount })),
  };
}
