import type { DueState, PayState } from "@/features/wedding/budget";
import { cn } from "@/lib/utils";

const base = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium";

export function PayTag({ state, cancelled }: { state: PayState; cancelled?: boolean }) {
  if (cancelled)
    return <span className={cn(base, "border-border text-muted-foreground")}>Cancelado</span>;
  const map: Record<PayState, [string, string]> = {
    unknown: ["Sem valor contratado", "border-border text-muted-foreground"],
    none: ["Nada pago", "border-border text-muted-foreground"],
    partial: ["Pago em parte", "border-wed-gold/50 text-foreground"],
    paid: ["Quitado", "border-primary/40 bg-accent text-accent-foreground"],
    over: ["Pago a mais", "border-destructive/40 text-destructive"],
  };
  const [label, cls] = map[state];
  return <span className={cn(base, cls)}>{label}</span>;
}

export function DueTag({ state, date }: { state: DueState; date: string | null }) {
  if (state === "none" || state === "later" || !date) return null;
  const d = new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
  return state === "overdue" ? (
    <span className={cn(base, "border-destructive/40 bg-destructive/10 text-destructive")}>
      Vencido em {d}
    </span>
  ) : (
    <span className={cn(base, "border-wed-gold/50 bg-wed-gold/10 text-foreground")}>Vence {d}</span>
  );
}
