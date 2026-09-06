import { CreatedBy } from "@/components/common/created-by";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  budgetDelta,
  categoryEmoji,
  categoryLabel,
  personEmoji,
  personLabel,
  priorityEmoji,
  priorityLabel,
  purchaseVibe,
  statusEmoji,
  statusLabel,
  statusTone,
  type Purchase,
} from "@/features/purchases/queries";

export function PurchaseCard({ purchase, onOpen }: { purchase: Purchase; onOpen: () => void }) {
  const delta = budgetDelta(purchase);
  const vibe = purchaseVibe(purchase);
  const high = purchase.priority === "HIGH";
  const price = purchase.found_price == null ? null : Number(purchase.found_price);
  const budget = purchase.budget_amount == null ? null : Number(purchase.budget_amount);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface text-left transition-all duration-300",
        "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft active:scale-[0.995]",
        high && "border-primary/25",
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {purchase.image_url ? (
          <img
            src={purchase.image_url}
            alt={purchase.title}
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <span className="grid size-full place-items-center bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_70%)] text-5xl">
            {categoryEmoji(purchase.category)}
          </span>
        )}
        <span
          className={cn(
            "absolute left-3 top-3 rounded-full border px-2.5 py-1 text-[11px] font-medium backdrop-blur-md",
            statusTone(purchase.status),
          )}
        >
          {statusEmoji(purchase.status)} {statusLabel(purchase.status)}
        </span>
        {high ? (
          <span className="absolute right-3 top-3 rounded-full border border-primary/30 bg-background/70 px-2.5 py-1 text-[11px] font-medium text-primary backdrop-blur-md">
            🔥 Queremos muito
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">
            {purchase.image_url ? `${categoryEmoji(purchase.category)} ` : ""}
            {purchase.title}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {[
              categoryLabel(purchase.category) ?? "Sem categoria",
              `${priorityEmoji(purchase.priority)} ${priorityLabel(purchase.priority)}`,
            ].join(" · ")}
          </p>
        </div>

        <div className="space-y-0.5">
          {price != null ? (
            <p className="numeric text-xl font-semibold tracking-tight">{formatCurrency(price)}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Preço ainda não definido</p>
          )}
          {budget != null ? (
            <p className="numeric text-xs text-muted-foreground">
              Orçamento {formatCurrency(budget)}
            </p>
          ) : null}
          {delta ? (
            <p className={cn("text-xs font-medium", delta.under ? "text-emerald-500" : "text-destructive")}>
              {formatCurrency(Math.abs(delta.diff))} {delta.under ? "abaixo" : "acima"} do orçamento ·{" "}
              {delta.percent.toFixed(0)}%
            </p>
          ) : null}
        </div>

        {vibe ? (
          <p
            className={cn(
              "text-xs",
              vibe.tone === "good"
                ? "text-emerald-500"
                : vibe.tone === "warn"
                  ? "text-destructive"
                  : "text-muted-foreground",
            )}
          >
            {vibe.text}
          </p>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
          <span className="truncate">
            {personEmoji(purchase.person_scope)} {personLabel(purchase.person_scope)}
          </span>
          <CreatedBy userId={purchase.created_by} />
        </div>
      </div>
    </button>
  );
}
