import { Link, useRouterState } from "@tanstack/react-router";
import { PanelLeftClose, PanelLeftOpen, Repeat2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOOTER_NAV, NAV_GROUPS, type NavItem } from "@/features/app/navigation";
import { useApp } from "@/features/app/app-context";
import { useEvents, useGoals, useTasks } from "@/features/planner/queries";
import { useTransactions } from "@/features/finance/queries";
import { eventOccurrences } from "@/features/agenda/queries";
import { isOpen } from "@/features/finance/calc";
import { AvatarMenu } from "@/components/profile/avatar-menu";
import { WorkspaceAvatarMenu } from "@/components/profile/workspace-avatar-menu";

function NavLink({ item, collapsed, badge }: { item: NavItem; collapsed: boolean; badge?: number | undefined }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = pathname === item.to;
  return (
    <Link
      to={item.to}
      title={item.label}
      className={cn(
        "group relative flex min-h-10 items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-all duration-200",
        collapsed && "justify-center px-0",
        active
          ? "border-primary/20 bg-primary/10 text-foreground shadow-soft"
          : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-accent/45 hover:text-foreground",
      )}
    >
      {active ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" aria-hidden /> : null}
      <item.icon className={cn("size-4 shrink-0 transition-colors", active && "text-primary")} />
      {collapsed ? null : <span className="truncate font-medium">{item.label}</span>}
      {!collapsed && badge && badge > 0 ? (
        <span className="numeric ml-auto flex min-w-5 items-center justify-center rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
      {collapsed && badge && badge > 0 ? <span className="absolute right-1 top-1 size-1.5 rounded-full bg-primary" /> : null}
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
  const { workspaceId, profile, availableWorkspaces, switchWorkspace } = useApp();
  const { data: tasks = [] } = useTasks(workspaceId);
  const { data: transactions = [] } = useTransactions(workspaceId);
  const { data: events = [] } = useEvents(workspaceId);
  const { data: goals = [] } = useGoals(workspaceId);
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 7);
  const goalLimit = new Date(from);
  goalLimit.setDate(goalLimit.getDate() + 30);
  const indicators: Record<string, number> = {
    "/tarefas": tasks.filter((task) => task.status !== "DONE").length,
    "/financeiro": transactions.filter((transaction) => transaction.type === "EXPENSE" && isOpen(transaction)).length,
    "/agenda": events.filter((event) => event.status !== "CANCELLED" && eventOccurrences(event, from, to).length > 0).length,
    "/metas": goals.filter((goal) => goal.status === "ACTIVE" && goal.due_date && new Date(`${goal.due_date}T00:00:00`) <= goalLimit).length,
  };

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar/95 backdrop-blur-xl transition-[width] duration-200 md:flex",
        collapsed ? "w-[72px]" : "w-64",
      )}
    >
      <div className={cn("flex items-center gap-3 px-5 py-6", collapsed && "justify-center px-0")}>
        <WorkspaceAvatarMenu collapsed={collapsed} />
        {collapsed ? null : (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Life OS</p>
            <p className="truncate text-[11px] text-muted-foreground">{workspaceName}</p>
          </div>
        )}
      </div>
      {availableWorkspaces.length > 1 && !collapsed ? (
        <div className="px-3 pb-3">
          <button type="button" onClick={() => {
            const index = availableWorkspaces.findIndex((item) => item.id === workspaceId);
            const next = availableWorkspaces[(index + 1) % availableWorkspaces.length];
            if (next) void switchWorkspace(next.id);
          }} className="flex w-full items-center gap-2 rounded-lg border border-sidebar-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent/45 hover:text-foreground">
            <Repeat2 className="size-3.5" /> Trocar espaço
          </button>
        </div>
      ) : null}

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-1">
            {collapsed ? <div className="mx-auto mb-2 h-px w-6 bg-sidebar-border" /> : (
              <p className="px-3 pb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/65">{group.label}</p>
            )}
            {group.items.map((item) => (
              <NavLink key={item.to} item={item} collapsed={collapsed} badge={indicators[item.to]} />
            ))}
          </div>
        ))}
        <div className="mt-auto space-y-1 border-t border-sidebar-border pt-3">
          {collapsed ? null : <p className="px-3 pb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/65">Sistema</p>}
          {FOOTER_NAV.map((item) => (
            <NavLink key={item.to} item={item} collapsed={collapsed} />
          ))}
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              "flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/45 hover:text-foreground",
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
      <div className={cn("border-t border-sidebar-border p-3", collapsed && "flex justify-center")}> 
        <div className={cn("flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-accent/35", collapsed && "p-0")}>
          <AvatarMenu compact />
          {collapsed ? null : <div className="min-w-0"><p className="truncate text-xs font-semibold">{profile?.name || "Seu perfil"}</p><p className="truncate text-[10px] text-muted-foreground">Perfil pessoal</p></div>}
        </div>
      </div>
    </aside>
  );
}
