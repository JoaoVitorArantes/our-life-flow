import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CreatedBy } from "@/components/common/created-by";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  budgetDelta,
  categoryEmoji,
  categoryLabel,
  statusDot,
  statusLabel,
  type Purchase,
} from "@/features/purchases/queries";

export function PurchaseCard({ purchase, onOpen }: { purchase: Purchase; onOpen: () => void }) {
  const delta = budgetDelta(purchase);
  const high = purchase.priority === "HIGH";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group flex w-full flex-col gap-3 rounded-2xl border border-border bg-surface p-4 text-left transition-all duration-200 hover:border-primary/30 hover:shadow-soft active:scale-[0.995]",
        high && "border-primary/25",
      )}
    >
      <div className="flex items-start gap-3">
        {purchase.image_url ? (
          <img
            src={purchase.image_url}
            alt={purchase.title}
            loading="lazy"
            className="size-12 shrink-0 rounded-xl border border-border object-cover"
          />
        ) : (
          <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-border bg-muted text-xl">
            {categoryEmoji(purchase.category)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{purchase.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[categoryLabel(purchase.category), high ? "Alta prioridade" : null]
              .filter(Boolean)
              .join(" · ") || "Sem categoria"}
          </p>
        </div>
      </div>

      {purchase.budget_amount != null || purchase.found_price != null ? (
        <div className="space-y-1 text-sm">
          {purchase.budget_amount != null ? (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Orçamento</span>
              <span className="numeric">{formatCurrency(Number(purchase.budget_amount))}</span>
            </div>
          ) : null}
          {purchase.found_price != null ? (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Melhor preço</span>
              <span className="numeric font-medium">{formatCurrency(Number(purchase.found_price))}</span>
            </div>
          ) : null}
          {delta ? (
            <p className={cn("text-xs", delta.under ? "text-emerald-500" : "text-destructive")}>
              {formatCurrency(Math.abs(delta.diff))} {delta.under ? "abaixo" : "acima"} do orçamento ·{" "}
              {delta.percent.toFixed(1).replace(".", ",")}%
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="gap-1.5">
          <span className={cn("size-1.5 rounded-full", statusDot(purchase.status))} />
          {statusLabel(purchase.status)}
        </Badge>
        <CreatedBy userId={purchase.created_by} />
      </div>

      <span className="flex items-center gap-1 text-xs font-medium text-primary">
        Ver detalhes <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}
