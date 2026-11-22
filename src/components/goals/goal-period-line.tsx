import {
  currentGoalPeriod,
  RECURRENCE_LABEL,
  sumInWindow,
  periodMonths,
  type GoalRecurrence,
} from "@/features/planner/goal-period";
import type { GoalContribution } from "@/features/planner/contributions";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";

type G = {
  created_at: string;
  start_date: string | null;
  due_date: string | null;
  recurrence: string;
  recurrence_months: number | null;
  period_amount: number | string | null;
};

/** Progresso do período atual de uma meta contínua (mensal/anual/a cada N meses). */
export function GoalPeriodLine({
  goal,
  contributions,
  today,
}: {
  goal: G;
  contributions: GoalContribution[];
  today: string;
}) {
  const n = periodMonths(goal);
  const p = currentGoalPeriod(goal, today);
  if (p.state === "not_started")
    return (
      <p className="text-xs text-muted-foreground">Começa em {formatDateShort(p.startsOn)}.</p>
    );
  if (p.state === "ended")
    return (
      <p className="text-xs text-muted-foreground">
        Prazo encerrado em {formatDateShort(p.endedOn)}.
      </p>
    );
  if (!n || p.state !== "period") return null;
  const label =
    goal.recurrence === "CUSTOM"
      ? `A cada ${n} meses`
      : RECURRENCE_LABEL[goal.recurrence as GoalRecurrence];
  const done = sumInWindow(contributions, p.from, p.to);
  const target = Number(goal.period_amount) || 0;
  const pct = target > 0 ? Math.min(100, Math.max(0, (done / target) * 100)) : 0;
  return (
    <div className="space-y-1 rounded-xl bg-elevated/50 p-2 text-xs">
      <div className="flex flex-wrap justify-between gap-x-2">
        <span className="text-muted-foreground">
          {label} · {formatDateShort(p.from)}–{formatDateShort(p.to)}
        </span>
        <span className="numeric">
          {formatCurrency(done)}
          {target ? ` de ${formatCurrency(target)}` : ""}
        </span>
      </div>
      {target ? (
        <div className="h-1 rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full bg-primary", done >= target && "bg-success")}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
