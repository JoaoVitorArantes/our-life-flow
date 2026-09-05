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
          "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] transition-colors",
          active ? "text-primary" : "text-muted-foreground",
        )}
      >
        <item.icon className="size-5" />
        {item.label}
      </Link>
    );
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-md items-center px-2">
        {left.map(renderItem)}
        <button
          type="button"
          aria-label="Criação rápida"
          onClick={() => setQuickMenuOpen(true)}
          className="mx-1 -mt-6 flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lift transition-transform active:scale-95"
        >
          <Plus className="size-6" />
        </button>
        {right.map(renderItem)}
      </div>
    </nav>
  );
}
