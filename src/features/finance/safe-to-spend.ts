import type { Account, Recurring, Transaction } from "./queries";
import type { Database } from "@/integrations/supabase/types";
type RecurrenceFrequency = Database["public"]["Enums"]["recurrence_frequency"];
import { accountBalance, addMonths, dueDateOf, isOpen, shiftDate, sumBy, todayISO } from "./calc";

export type Projected = Transaction & { projected?: true };

/**
 * Previsões de recorrências ativas (salário, aluguel...) entre hoje e o horizonte.
 * Nunca grava nada: são objetos em memória. Uma ocorrência é ignorada quando já
 * existe lançamento real da mesma recorrência no mesmo período (evita contar duas vezes).
 */
export function getProjectedRecurring(
  recurrences: Recurring[],
  transactions: Transaction[],
  today: string,
  horizon: string,
): Projected[] {
  const out: Projected[] = [];
  for (const r of recurrences) {
    if (!r.is_active || r.type === "TRANSFER") continue;
    const freq = (r.frequency === "CUSTOM" ? "MONTHLY" : r.frequency) as RecurrenceFrequency;
    const real = transactions.filter((t) => t.recurring_id === r.id && t.status !== "CANCELLED");
    for (let i = 0; i < 400; i++) {
      const date = shiftDate(r.start_date, i, freq);
      if (date > horizon || (r.end_date && date > r.end_date)) break;
      if (date < today) continue;
      const key = freq === "WEEKLY" ? date : freq === "YEARLY" ? date.slice(0, 4) : date.slice(0, 7);
      const covered = real.some((t) => {
        const d = t.due_date ?? t.transaction_date;
        return freq === "WEEKLY" ? d === date : d.startsWith(key);
      });
      if (covered) continue;
      out.push({
        id: `proj-${r.id}-${date}`,
        workspace_id: r.workspace_id,
        owner_id: r.owner_id,
        type: r.type,
        amount: r.amount,
        description: r.description,
        transaction_date: date,
        due_date: date,
        category_id: r.category_id,
        account_id: r.account_id,
        card_id: r.card_id,
        context_id: r.context_id,
        recurring_id: r.id,
        status: "PENDING",
        projected: true,
      } as unknown as Projected);
    }
  }
  return out;
}

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
  recurrences: Recurring[] = [],
) {
  const [y, m, d] = today.split("-").map(Number);
  const horizonDate = new Date(y!, m! - 1, d! + horizonDays);
  const horizon = `${horizonDate.getFullYear()}-${String(horizonDate.getMonth() + 1).padStart(2, "0")}-${String(horizonDate.getDate()).padStart(2, "0")}`;
  const liquid = accounts.filter((a) => a.is_active && a.account_type !== "INVESTMENT");
  const available = sumBy(liquid, (a) => accountBalance(a, transactions));
  const projected = getProjectedRecurring(recurrences, transactions, today, horizon);
  const open: Projected[] = [
    ...transactions.filter((t) => t.status !== "CANCELLED" && isOpen(t) && dueDateOf(t) <= horizon),
    ...projected.filter((t) => dueDateOf(t) <= horizon),
  ];
  const incomes = open.filter((t) => t.type === "INCOME");
  const expenses = open.filter((t) => t.type === "EXPENSE");
  const income = sumBy(incomes, (t) => Number(t.amount));
  const commitments = sumBy(expenses, (t) => Number(t.amount));
  const safe = available + income - commitments;

  // Linha do tempo: saldo após cada movimento, em ordem de vencimento.
  // Mesmo dia: entradas antes das saídas.
  const events = [...incomes, ...expenses].sort(
    (a, b) => dueDateOf(a).localeCompare(dueDateOf(b)) || (a.type === "INCOME" ? -1 : 1) - (b.type === "INCOME" ? -1 : 1),
  );
  let running = available;
  let lowest = available;
  let lowestDate = today;
  const timeline = events.map((t) => {
    running += t.type === "INCOME" ? Number(t.amount) : -Number(t.amount);
    if (running < lowest) {
      lowest = running;
      lowestDate = dueDateOf(t);
    }
    return { t, date: dueDateOf(t), balance: running, projected: !!t.projected };
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
    projectedIncome: sumBy(incomes.filter((t) => t.projected), (t) => Number(t.amount)),
    expenses,
    nextMonth: addMonths(today, 1),
  };
}

export type SafeToSpend = ReturnType<typeof calculateSafeToSpend>;

export type MoodTone = "calm" | "tight" | "alert";

/** Leitura determinística do estado financeiro. */
export function financialMood(s: SafeToSpend): { text: string; tone: MoodTone } {
  if (s.lowest < 0)
    return {
      text: `Vocês podem ficar ${(-s.lowest).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} abaixo do necessário antes da próxima entrada.`,
      tone: "alert",
    };
  const base = s.available + s.income;
  const ratio = base > 0 ? s.commitments / base : 1;
  if (ratio > 0.8) return { text: "Boa parte do dinheiro já está comprometida.", tone: "tight" };
  if (s.spendable < s.commitments * 0.2 && s.commitments > 0)
    return { text: "Vocês estão com pouco espaço até os próximos recebimentos.", tone: "tight" };
  return { text: "Vocês estão tranquilos.", tone: "calm" };
}
