/**
 * Metas contínuas: progresso total vem das movimentações; quando há frequência, o período atual
 * é calculado a partir do início (data de início ou de criação), sem depender de ano fixo.
 */
export type GoalRecurrence = "NONE" | "MONTHLY" | "YEARLY" | "CUSTOM";
export const RECURRENCE_LABEL: Record<GoalRecurrence, string> = {
  NONE: "Sem frequência",
  MONTHLY: "Mensal",
  YEARLY: "Anual",
  CUSTOM: "Personalizada",
};

type GoalLike = {
  start_date?: string | null;
  created_at: string;
  due_date?: string | null;
  recurrence?: string | null;
  recurrence_months?: number | null;
};

export function periodMonths(goal: GoalLike): number | null {
  if (goal.recurrence === "MONTHLY") return 1;
  if (goal.recurrence === "YEARLY") return 12;
  if (goal.recurrence === "CUSTOM" && goal.recurrence_months && goal.recurrence_months > 0)
    return goal.recurrence_months;
  return null;
}

const idx = (iso: string) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;
const fromIdx = (i: number, last = false) => {
  const y = Math.floor(i / 12);
  const m = i - y * 12 + 1;
  const day = last ? new Date(Date.UTC(y, m, 0)).getUTCDate() : 1;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

/** Janela do período que contém `today`, ou estado antes do início / após o prazo. */
export function currentGoalPeriod(goal: GoalLike, today: string) {
  const anchor = (goal.start_date ?? goal.created_at).slice(0, 10);
  if (today < anchor) return { state: "not_started" as const, startsOn: anchor };
  if (goal.due_date && today > goal.due_date)
    return { state: "ended" as const, endedOn: goal.due_date };
  const n = periodMonths(goal);
  if (!n) return { state: "open" as const };
  const k = Math.floor((idx(today) - idx(anchor)) / n);
  const startI = idx(anchor) + k * n;
  let end = fromIdx(startI + n - 1, true);
  if (goal.due_date && goal.due_date < end) end = goal.due_date;
  return { state: "period" as const, from: fromIdx(startI), to: end, index: k + 1 };
}

export function sumInWindow(
  items: { contribution_date: string; amount: number | string; movement_type?: string | null }[],
  from: string,
  to: string,
) {
  return items
    .filter((i) => i.contribution_date >= from && i.contribution_date <= to)
    .reduce((t, i) => {
      const v = Math.abs(Number(i.amount));
      const w = i.movement_type === "WITHDRAWAL" || (!i.movement_type && Number(i.amount) < 0);
      return t + (w ? -v : v);
    }, 0);
}
