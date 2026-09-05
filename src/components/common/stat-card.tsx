import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

type Tone = "neutral" | "success" | "destructive" | "primary";

const toneClass: Record<Tone, string> = {
  neutral: "text-foreground",
  success: "text-success",
  destructive: "text-destructive",
  primary: "text-primary",
};

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className={cn("numeric mt-3 text-2xl font-semibold", toneClass[tone])}>
        {formatCurrency(value)}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
