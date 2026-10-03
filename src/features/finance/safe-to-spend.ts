import type { Account, Transaction } from "./queries";
import { accountBalance, addMonths, dueDateOf, isOpen, sumBy, todayISO } from "./calc";

/**
 * Fonte única do "Dinheiro livre".
 * disponível (contas ativas, exceto investimento) + receitas pendentes no horizonte
 * − despesas pendentes no horizonte (inclui atrasadas e faturas de cartão).
 * Usa apenas lançamentos reais: limite de cartão, patrimônio investido e acertos
 * entre o casal não entram, e cada parcela/fatura/recorrência conta uma única vez.
 */
export function calculateSafeToSpend(
  accounts: Account[],
  transactions: Transaction[],
  horizonDays = 30,
  today = todayISO(),
) {
  const [y, m, d] = today.split("-").map(Number);
  const horizonDate = new Date(y!, m! - 1, d! + horizonDays);
  const horizon = `${horizonDate.getFullYear()}-${String(horizonDate.getMonth() + 1).padStart(2, "0")}-${String(horizonDate.getDate()).padStart(2, "0")}`;
  const liquid = accounts.filter((a) => a.is_active && a.account_type !== "INVESTMENT");
  const available = sumBy(liquid, (a) => accountBalance(a, transactions));
  const open = transactions.filter((t) => t.status !== "CANCELLED" && isOpen(t) && dueDateOf(t) <= horizon);
  const incomes = open.filter((t) => t.type === "INCOME");
  const expenses = open.filter((t) => t.type === "EXPENSE");
  const income = sumBy(incomes, (t) => Number(t.amount));
  const commitments = sumBy(expenses, (t) => Number(t.amount));
  const safe = available + income - commitments;

  // Linha do tempo: saldo após cada movimento, em ordem de vencimento.
  const events = [...incomes, ...expenses].sort((a, b) => dueDateOf(a).localeCompare(dueDateOf(b)));
  let running = available;
  let lowest = available;
  let lowestDate = today;
  const timeline = events.map((t) => {
    running += t.type === "INCOME" ? Number(t.amount) : -Number(t.amount);
    if (running < lowest) {
      lowest = running;
      lowestDate = dueDateOf(t);
    }
    return { t, date: dueDateOf(t), balance: running };
  });
  // Teto seguro: o menor ponto da projeção limita quanto pode sair hoje.
  const spendable = Math.max(0, Math.min(safe, lowest));
  return {
    available,
    income,
    commitments,
    safe,
    spendable,
    lowest,
    lowestDate,
    horizon,
    timeline,
    expenses,
    nextMonth: addMonths(today, 1),
  };
}

export type SafeToSpend = ReturnType<typeof calculateSafeToSpend>;

export type MoodTone = "calm" | "tight" | "alert";

/** Leitura determinística do estado financeiro. */
export function financialMood(s: SafeToSpend): { text: string; tone: MoodTone } {
  if (s.lowest < 0)
    return { text: "Atenção: os compromissos passam do dinheiro disponível antes dos próximos recebimentos.", tone: "alert" };
  const base = s.available + s.income;
  const ratio = base > 0 ? s.commitments / base : 1;
  if (ratio > 0.8) return { text: "Boa parte do dinheiro já está comprometida.", tone: "tight" };
  if (s.spendable < s.commitments * 0.2 && s.commitments > 0)
    return { text: "Vocês estão com pouco espaço até os próximos recebimentos.", tone: "tight" };
  return { text: "Vocês estão tranquilos.", tone: "calm" };
}
