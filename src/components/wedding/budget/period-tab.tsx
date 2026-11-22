import { useMemo, useState } from "react";
import { Bar } from "@/components/wedding/shell";
import { byMonth, itemTotals } from "@/features/wedding/budget";
import type { WBudgetItem, WBudgetPayment } from "@/features/wedding/budget-api";
import type { WeddingExpense } from "@/features/wedding/api";
import { formatCurrency } from "@/lib/format";
import { YearNav } from "./year-nav";
import { fmtDate } from "./ui-utils";

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

type Item = WBudgetItem & { planned_amount: number | null; contracted_amount: number | null };

export function PeriodTab({
  items,
  payments,
  expenses,
  onOpen,
}: {
  items: Item[];
  payments: (WBudgetPayment & { amount: number })[];
  expenses: WeddingExpense[];
  onOpen: (id: string) => void;
}) {
  const [year, setYear] = useState(new Date().getFullYear());
  const months = useMemo(
    () =>
      byMonth(
        year,
        items,
        payments,
        expenses.map((e) => ({ amount: Number(e.amount), spent_on: e.spent_on })),
      ),
    [year, items, payments, expenses],
  );
  const totalPaid = months.reduce((s, x) => s + x.paid, 0);
  const totalDue = months.reduce((s, x) => s + x.duePending, 0);
  const max = Math.max(1, ...months.map((x) => Math.max(x.paid, x.duePending)));
  const noDate = items.filter((i) => !i.due_date && i.status !== "cancelled").length;
  const nameOf = (id: string) => items.find((i) => i.id === id)?.name ?? "Item";
  const nowKey = new Date().toISOString().slice(0, 7);

  return (
    <div className="space-y-4">
      <div className="wed-card flex flex-wrap items-center justify-between gap-3 p-4">
        <YearNav year={year} onChange={setYear} />
        <p className="text-sm tabular-nums text-muted-foreground">
          Pago em {year}: <strong className="text-foreground">{formatCurrency(totalPaid)}</strong> ·
          A vencer/vencido: <strong className="text-foreground">{formatCurrency(totalDue)}</strong>
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Pagos contam pela data do pagamento (inclui despesas avulsas). “A pagar” usa o vencimento do
        item e só aparece quando há data e valor contratado.
        {noDate ? ` ${noDate} item(ns) sem vencimento não entram aqui.` : ""}
      </p>
      <ul className="space-y-2">
        {months.map((mo, i) => {
          const empty = !mo.paid && !mo.dueItems.length;
          return (
            <li key={mo.key} className="wed-card p-4">
              <details open={!empty && mo.key === nowKey}>
                <summary className="grid cursor-pointer list-none grid-cols-[6.5rem_1fr] items-center gap-3 [&::-webkit-details-marker]:hidden">
                  <span
                    className={mo.key === nowKey ? "font-semibold text-primary" : "font-medium"}
                  >
                    {MONTHS[i]}
                  </span>
                  <span className="min-w-0 space-y-1">
                    {empty ? (
                      <span className="text-xs text-muted-foreground">Nada registrado</span>
                    ) : (
                      <>
                        <span className="block text-xs tabular-nums text-muted-foreground">
                          Pago {formatCurrency(mo.paid)}
                          {mo.duePending > 0 ? ` · a pagar ${formatCurrency(mo.duePending)}` : ""}
                        </span>
                        <Bar value={Math.round((mo.paid / max) * 100)} />
                      </>
                    )}
                  </span>
                </summary>
                {!empty ? (
                  <div className="mt-3 space-y-2 border-t border-border pt-3 text-sm">
                    {mo.dueItems.map((it) => {
                      const t = itemTotals(it, payments);
                      return (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => onOpen(it.id)}
                          className="flex w-full justify-between gap-2 text-left hover:underline"
                        >
                          <span className="min-w-0 break-words">
                            Vence {fmtDate(it.due_date!)} · {it.name}
                          </span>
                          <span className="shrink-0 tabular-nums">
                            {t.pending == null
                              ? "sem valor"
                              : t.pending > 0
                                ? formatCurrency(t.pending)
                                : "quitado"}
                          </span>
                        </button>
                      );
                    })}
                    {mo.payments.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onOpen(p.item_id)}
                        className="flex w-full justify-between gap-2 text-left text-muted-foreground hover:underline"
                      >
                        <span className="min-w-0 break-words">
                          Pago {fmtDate(p.paid_on)} · {nameOf(p.item_id)}
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {formatCurrency(Number(p.amount))}
                        </span>
                      </button>
                    ))}
                    {mo.expenses.length ? (
                      <p className="text-xs text-muted-foreground">
                        + {mo.expenses.length} despesa(s) avulsa(s):{" "}
                        {formatCurrency(mo.expenses.reduce((s, e) => s + Number(e.amount), 0))}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
