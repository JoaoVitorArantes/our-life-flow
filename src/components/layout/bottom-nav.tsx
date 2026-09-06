import { Link, useRouterState } from "@tanstack/react-router";
import { Plus, Home, Wallet, CalendarDays, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/features/app/app-context";

const ITEMS = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/nos", label: "Nós", icon: Heart },
];

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { setQuickMenuOpen } = useApp();
  const left = ITEMS.slice(0, 2);
  const right = ITEMS.slice(2);

  const renderItem = (item: (typeof ITEMS)[number]) => {
    const active = pathname === item.to;
    return (
      <Link
        key={item.to}
        to={item.to}
        className={cn(
          "relative flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium transition-all duration-200",
          active ? "text-primary" : "text-muted-foreground",
        )}
      >
        <item.icon className={cn("size-5 transition-transform", active && "-translate-y-0.5")} />
        {item.label}
        {active ? <span className="absolute bottom-0 size-1 rounded-full bg-primary" /> : null}
      </Link>
    );
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-surface/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_40px_var(--color-background)/0.65] backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-md items-center px-2">
        {left.map(renderItem)}
        <button
          type="button"
          aria-label="Criação rápida"
          onClick={() => setQuickMenuOpen(true)}
          className="mx-1 -mt-6 flex size-14 shrink-0 items-center justify-center rounded-2xl border-4 border-background bg-primary text-primary-foreground shadow-[0_8px_30px_var(--color-primary)/0.3] transition-transform active:scale-95"
        >
          <Plus className="size-6" />
        </button>
        {right.map(renderItem)}
      </div>
    </nav>
  );
}
