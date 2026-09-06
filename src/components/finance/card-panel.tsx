import { useState } from "react";
import { CalendarDays, CreditCard, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RecordActions } from "@/components/common/record-actions";
import { CreatedBy } from "@/components/common/created-by";
import { StatusBadge } from "@/components/finance/status-badge";
import {
  cardCycles,
  cardDueDate,
  daysBetween,
  statusOf,
  sumBy,
  todayISO,
} from "@/features/finance/calc";
import type { Card as CardRecord, Transaction, InstallmentPlan } from "@/features/finance/queries";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  card: CardRecord;
  transactions: Transaction[];
  plans: InstallmentPlan[];
  categoryName: (id: string | null) => string;
  contextLabel: (id: string | null) => string | null;
  paymentAccountName: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onPayInvoice: (items: Transaction[]) => void;
};

function relativeLabel(dateISO: string, today: string, verb: string) {
  const diff = daysBetween(today, dateISO);
  if (diff === 0) return `${verb} hoje`;
  if (diff === 1) return `${verb} amanhã`;
  if (diff > 1) return `${verb} em ${diff} dias`;
  return `${verb === "Vence" ? "Vencida" : "Fechada"} há ${Math.abs(diff)} dia${Math.abs(diff) > 1 ? "s" : ""}`;
}

export function CardPanel({
  card,
  transactions,
  plans,
  categoryName,
  contextLabel,
  paymentAccountName,
  onEdit,
  onDelete,
  onPayInvoice,
}: Props) {
  const [showPurchases, setShowPurchases] = useState(false);
  const today = todayISO();
  const hasClosing = !!card.closing_day;
  const hasDue = !!card.due_day;
  const cycles = cardCycles(card.closing_day ?? 1);
  const inRange = (t: Transaction, range: { start: string; end: string }) =>
    t.transaction_date >= range.start && t.transaction_date <= range.end;

  const active = transactions.filter((t) => t.status !== "CANCELLED");
  const invoice = active.filter((t) => inRange(t, cycles.current));
  const nextInvoice = active.filter((t) => inRange(t, cycles.next));
  const invoiceTotal = sumBy(invoice, (t) => Number(t.amount));
  const nextTotal = sumBy(nextInvoice, (t) => Number(t.amount));

  const used = Math.max(
    0,
    sumBy(
      active.filter((t) => t.status !== "PAID"),
      (t) => Number(t.amount),
    ),
  );
  const limit = Number(card.credit_limit) || 0;
  const available = Math.max(0, limit - used);
  const usage = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

  const closingISO = cycles.current.end;
  const dueISO = hasDue ? cardDueDate(closingISO, card.due_day!) : null;
  const openItems = invoice.filter((t) => t.status !== "PAID");

  const invoiceStatus = !invoice.length
    ? "Sem compras"
    : !openItems.length
      ? "Paga"
      : today <= closingISO
        ? "Aberta"
        : dueISO && today > dueISO
          ? "Vencida"
          : dueISO && today === dueISO
            ? "Vencendo"
            : "Fechada";

  const statusTone =
    invoiceStatus === "Vencida"
      ? "text-destructive"
      : invoiceStatus === "Paga"
        ? "text-success"
        : "text-muted-foreground";

  const installmentLabel = (t: Transaction) => {
    if (!t.installment_number || !t.installment_plan_id) return null;
    const plan = plans.find((p) => p.id === t.installment_plan_id);
    return plan ? `${t.installment_number}/${plan.total_installments}` : `${t.installment_number}`;
  };

  return (
    <div className="rounded-2xl border border-border bg-surface/60 p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <CreditCard className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{card.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {card.institution || "Sem instituição"}
            </p>
          </div>
        </div>
        <RecordActions
          onEdit={onEdit}
          onDelete={onDelete}
          confirmTitle="Excluir este cartão?"
          confirmDescription="Lançamentos vinculados continuam existindo, mas ficam sem cartão."
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5 text-[11px]">
        <Badge variant="outline" className="gap-1">
          <CalendarDays className="size-3" />
          {hasClosing ? `Fecha dia ${card.closing_day}` : "Fechamento não configurado"}
        </Badge>
        <Badge variant="outline" className="gap-1">
          <CalendarDays className="size-3" />
          {hasDue ? `Vence dia ${card.due_day}` : "Vencimento não configurado"}
        </Badge>
        <Badge variant="outline" className={cn("gap-1", statusTone)}>
          <Receipt className="size-3" />
          Fatura {invoiceStatus.toLowerCase()}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-elevated p-2">
          <p className="text-muted-foreground">Limite</p>
          <p className="numeric text-sm">{formatCurrency(limit)}</p>
        </div>
        <div className="rounded-lg bg-elevated p-2">
          <p className="text-muted-foreground">Disponível</p>
          <p className="numeric text-sm text-success">{formatCurrency(available)}</p>
        </div>
        <div className="rounded-lg bg-elevated p-2">
          <p className="text-muted-foreground">Fatura atual</p>
          <p className="numeric text-sm">{formatCurrency(invoiceTotal)}</p>
        </div>
      </div>

      <div className="mt-3 space-y-1">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-elevated">
          <div
            className={cn("h-full rounded-full bg-primary", usage > 85 && "bg-destructive")}
            style={{ width: `${usage}%` }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          {formatCurrency(used)} utilizados · {usage.toFixed(1).replace(".", ",")}% do limite
        </p>
      </div>

      <div className="mt-3 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
        <p>
          {hasClosing
            ? `${relativeLabel(closingISO, today, "Fecha")} · ${formatDateShort(closingISO)}`
            : "Configure o fechamento para acompanhar a fatura."}
        </p>
        <p>
          {dueISO
            ? `${relativeLabel(dueISO, today, "Vence")} · ${formatDateShort(dueISO)}`
            : "Configure o vencimento para acompanhar o pagamento."}
        </p>
        {nextTotal > 0 ? (
          <p>
            Próxima fatura: <span className="numeric">{formatCurrency(nextTotal)}</span> (após o
            fechamento)
          </p>
        ) : null}
        {paymentAccountName ? <p>Pagamento pela conta {paymentAccountName}</p> : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setShowPurchases((value) => !value)}>
          {showPurchases ? "Ocultar compras" : `Ver compras (${invoice.length})`}
        </Button>
        {openItems.length ? (
          <Button size="sm" variant="ghost" onClick={() => onPayInvoice(openItems)}>
            Pagar fatura
          </Button>
        ) : null}
      </div>

      {showPurchases ? (
        invoice.length ? (
          <ul className="mt-3 divide-y divide-border">
            {invoice.map((item) => {
              const parcel = installmentLabel(item);
              const context = contextLabel(item.context_id);
              return (
                <li key={item.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">{item.description}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span>{formatDateShort(item.transaction_date)}</span>
                      <span>·</span>
                      <span>{categoryName(item.category_id)}</span>
                      {parcel ? <Badge variant="outline">{parcel}</Badge> : null}
                      {context ? <Badge variant="outline">{context}</Badge> : null}
                      <CreatedBy userId={item.owner_id} />
                    </div>
                  </div>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="numeric">{formatCurrency(Number(item.amount))}</span>
                    <StatusBadge status={statusOf(item)} />
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">Nenhuma compra nesta fatura.</p>
        )
      ) : null}
    </div>
  );
}
