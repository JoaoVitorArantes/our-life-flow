import { useEffect, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  CalendarHeart,
  Gift,
  Heart,
  Home,
  ListChecks,
  Mail,
  ScanLine,
  Settings,
  Store,
  Wallet,
} from "lucide-react";
import { useApp } from "@/features/app/app-context";
import { EmptyState, LoadingState } from "@/components/common/states";
import { useWeddingPlan, useWeddingImage } from "@/features/wedding/api";
import { colorClass } from "@/features/wedding/contracts";
import { cn } from "@/lib/utils";

/** Aplica o tema do Casamento ao <html> enquanto a área está aberta (inclui diálogos e menus). */
export function useWeddingTheme(theme: string | undefined) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("wedding-theme");
    root.dataset["weddingTheme"] = theme ?? "champagne";
    return () => {
      root.classList.remove("wedding-theme");
      delete root.dataset["weddingTheme"];
    };
  }, [theme]);
}

const NAV = [
  { to: "/casamento", label: "Início", icon: Heart, exact: true },
  { to: "/casamento/casa", label: "Nossa Casa", icon: Home },
  { to: "/casamento/orcamento", label: "Orçamento", icon: Wallet },
  { to: "/casamento/preparativos", label: "Preparativos", icon: ListChecks },
  { to: "/casamento/fornecedores", label: "Fornecedores", icon: Store },
  { to: "/casamento/convidados", label: "Convidados", icon: Mail },
  { to: "/casamento/checkin", label: "Check-in", icon: ScanLine },
  { to: "/casamento/presentes", label: "Presentes", icon: Gift },
  { to: "/casamento/configuracoes", label: "Ajustes", icon: Settings },
] as const;
const SOON = [{ slug: "cerimonia", label: "Cerimônia", icon: CalendarHeart }] as const;

export function WeddingShell({
  title,
  subtitle,
  action,
  back,
  children,
}: {
  title: string;
  subtitle?: string | undefined;
  action?: ReactNode;
  back?: ReactNode;
  children: ReactNode;
}) {
  const { workspace, workspaceId, loading } = useApp();
  const plan = useWeddingPlan(workspaceId);
  useWeddingTheme(plan.data?.theme);
  const cover = useWeddingImage(plan.data?.cover_path);
  if (loading) return <LoadingState />;
  if (!workspace || workspace.is_demo)
    return (
      <EmptyState
        icon={Heart}
        title="Casamento disponível no espaço do casal"
        description="Este módulo não funciona em espaços de demonstração. Troque para o espaço compartilhado de vocês."
      />
    );
  const names = plan.data?.couple_names?.trim();
  return (
    <div className="space-y-6 pb-6">
      <header className="wed-card relative overflow-hidden">
        {cover.data && (
          <img
            src={cover.data}
            alt=""
            className="absolute inset-0 size-full object-cover opacity-25"
          />
        )}
        <div className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-wed-blush/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 size-56 rounded-full bg-wed-lavender/40 blur-3xl" />
        <div className="relative space-y-4 p-5 sm:p-8">
          {back}
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            <Ornament />
            <span className="min-w-0 truncate">{names || "Nosso casamento"}</span>
          </div>
          <div className="grid gap-3 sm:flex sm:items-end sm:justify-between">
            <div className="min-w-0 space-y-1">
              <h1 className="wed-display text-3xl leading-tight break-words sm:text-4xl">
                {title}
              </h1>
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {action && <div className="flex flex-wrap gap-2">{action}</div>}
          </div>
          <div className="wed-divider" />
          <nav
            aria-label="Áreas do casamento"
            className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9"
          >
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: "exact" in n }}
                className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl border border-transparent px-2 py-2 text-center text-xs text-muted-foreground transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                activeProps={{
                  className: "!border-primary/30 !bg-accent !text-accent-foreground font-semibold",
                }}
              >
                <n.icon className="size-4 shrink-0" aria-hidden />
                <span className="leading-tight">{n.label}</span>
              </Link>
            ))}
          </nav>
          <div className="flex flex-wrap gap-2">
            {SOON.map((s) => (
              <Link
                key={s.slug}
                to="/casamento/$area"
                params={{ area: s.slug }}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-dashed border-border px-3 text-xs text-muted-foreground hover:text-foreground"
              >
                <s.icon className="size-3.5" aria-hidden /> {s.label} · em breve
              </Link>
            ))}
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

export function Ornament({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 16"
      aria-hidden
      className={cn("h-3 w-9 shrink-0 text-wed-gold", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    >
      <path d="M2 8h14M32 8h14" strokeLinecap="round" />
      <path d="M24 3c-2.5 0-4 2-4 5s1.5 5 4 5 4-2 4-5-1.5-5-4-5Z" />
      <path d="M16 8c2-3 4-3 6-1M32 8c-2-3-4-3-6-1" strokeLinecap="round" />
    </svg>
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
    <div className="wed-card min-w-0 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="wed-display mt-1 break-words text-2xl tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function OptionBadge({ label, color }: { label: string; color: string | null | undefined }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        colorClass(color),
      )}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="wed-display text-xl">{children}</h2>
      {action}
    </div>
  );
}

export function Bar({ value }: { value: number }) {
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-wed-blush to-primary"
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}
