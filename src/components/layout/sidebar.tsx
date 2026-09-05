import { Link, useRouterState } from "@tanstack/react-router";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOOTER_NAV, PRIMARY_NAV, SECONDARY_NAV, type NavItem } from "@/features/app/navigation";

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = pathname === item.to;
  return (
    <Link
      to={item.to}
      title={item.label}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        collapsed && "justify-center px-0",
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      <span className="text-base leading-none">{item.emoji}</span>
      {collapsed ? null : <span className="truncate">{item.label}</span>}
      {active && !collapsed ? (
        <span className="ml-auto size-1.5 rounded-full bg-primary" aria-hidden />
      ) : null}
    </Link>
  );
}

export function Sidebar({
  collapsed,
  onToggle,
  workspaceName,
}: {
  collapsed: boolean;
  onToggle: () => void;
  workspaceName: string;
}) {
  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200 md:flex",
        collapsed ? "w-[68px]" : "w-60",
      )}
    >
      <div className={cn("flex items-center gap-2 px-4 py-5", collapsed && "justify-center px-0")}>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
          L
        </span>
        {collapsed ? null : (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Life OS</p>
            <p className="truncate text-xs text-muted-foreground">{workspaceName}</p>
          </div>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 pb-4">
        <div className="space-y-1">
          {PRIMARY_NAV.map((item) => (
            <NavLink key={item.to} item={item} collapsed={collapsed} />
          ))}
        </div>
        <div className="space-y-1">
          {SECONDARY_NAV.map((item) => (
            <NavLink key={item.to} item={item} collapsed={collapsed} />
          ))}
        </div>
        <div className="mt-auto space-y-1">
          {FOOTER_NAV.map((item) => (
            <NavLink key={item.to} item={item} collapsed={collapsed} />
          ))}
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground",
              collapsed && "justify-center px-0",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <>
                <PanelLeftClose className="size-4" />
                <span>Recolher</span>
              </>
            )}
          </button>
        </div>
      </nav>
    </aside>
  );
}
