import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { useApp } from "@/features/app/app-context";
import { EmptyState, LoadingState } from "@/components/common/states";
import { WEDDING_AREAS } from "@/features/wedding/contracts";
import { cn } from "@/lib/utils";

export function WeddingShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const { workspace, loading } = useApp();
  if (loading) return <LoadingState />;
  if (!workspace || workspace.is_demo)
    return (
      <EmptyState
        icon={Heart}
        title="Casamento disponível no espaço do casal"
        description="Este módulo não funciona em espaços de demonstração. Troque para o espaço compartilhado de vocês."
      />
    );
  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl border border-border bg-surface p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Casamento
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {action}
        </div>
        <nav className="relative mt-5 flex gap-2 overflow-x-auto pb-1">
          <AreaLink to="/casamento" label="Visão geral" />
          {WEDDING_AREAS.map((a) =>
            a.slug === "casa" ? (
              <AreaLink key={a.key} to="/casamento/casa" label={`${a.emoji} ${a.label}`} />
            ) : (
              <Link
                key={a.key}
                to="/casamento/$area"
                params={{ area: a.slug }}
                className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
                activeProps={{ className: "bg-primary/15 text-foreground border-primary/40" }}
              >
                {a.emoji} {a.label}
              </Link>
            ),
          )}
          <AreaLink to="/casamento/configuracoes" label="⚙️ Configurações" />
        </nav>
      </header>
      {children}
    </div>
  );
}

function AreaLink({
  to,
  label,
}: {
  to: "/casamento" | "/casamento/casa" | "/casamento/configuracoes";
  label: string;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: true }}
      className={cn(
        "shrink-0 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground",
      )}
      activeProps={{ className: "bg-primary/15 text-foreground border-primary/40" }}
    >
      {label}
    </Link>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
