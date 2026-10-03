import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CalendarPlus,
  CheckSquare,
  Compass,
  Heart,
  StickyNote,
  Target,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { BalanceCard } from "@/components/nos/balance-card";
import { RelationshipTime } from "@/components/nos/relationship-time";
import { MemberAvatar } from "@/components/profile/member-avatar";
import { Panel, PanelTitle } from "@/components/common/page";
import { useMemberName } from "@/components/common/created-by";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useApp, type QuickActionKind } from "@/features/app/app-context";
import { useAccounts, useTransactions } from "@/features/finance/queries";
import { useSafeToSpend } from "@/features/finance/use-safe-to-spend";
import { useEvents, useGoals, useTasks } from "@/features/planner/queries";
import { categoryEmoji, usePurchases } from "@/features/purchases/queries";
import {
  activityEmoji,
  formatDistance,
  formatDuration,
  useActivities,
} from "@/features/activities/queries";
import { goalProgress, movementType, useAllContributions } from "@/features/planner/contributions";
import { contextEmoji, useContexts } from "@/features/contexts/queries";
import {
  dueDateOf,
  inMonth,
  isOpen,
  netWorth,
  statusOf,
  todayISO,
  totalExpense,
  totalIncome,
} from "@/features/finance/calc";
import { formatCurrency, formatDateLong, formatDateShort, formatTime, greeting, parseDateOnly } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Life OS" },
      { name: "description", content: "Resumo do seu dia: finanças, agenda, tarefas e metas." },
      { property: "og:title", content: "Dashboard — Life OS" },
      { property: "og:description", content: "Resumo do seu dia no Life OS." },
    ],
  }),
  component: Dashboard,
});

const QUICK_ACTIONS: { kind: QuickActionKind; label: string; icon: typeof ArrowUpRight }[] = [
  { kind: "expense", label: "Despesa", icon: ArrowUpRight },
  { kind: "income", label: "Receita", icon: ArrowDownLeft },
  { kind: "event", label: "Evento", icon: CalendarPlus },
  { kind: "task", label: "Tarefa", icon: CheckSquare },
  { kind: "goal", label: "Meta", icon: Target },
  { kind: "note", label: "Nota", icon: StickyNote },
  { kind: "context", label: "Contexto", icon: Compass },
];

/** "Hoje" / "Amanhã" / "12 set" for a `YYYY-MM-DD` value. */
function relativeDay(iso: string) {
  const today = todayISO();
  if (iso === today) return "Hoje";
  const date = parseDateOnly(iso);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (iso === `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`)
    return "Amanhã";
  return formatDateShort(date);
}

function relativeTime(at: string) {
  const diff = Date.now() - new Date(at).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  return formatDateShort(at);
}

function Money({ label, value, tone }: { label: string; value: number; tone?: string | undefined }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className={cn("numeric mt-1 text-xl font-semibold sm:text-2xl", tone)}>
        {formatCurrency(value)}
      </p>
    </div>
  );
}

function Dashboard() {
  const { workspaceId, profile, memberProfiles, loading, error, refetchWorkspace, openQuickAction, userId } =
    useApp();
  const queryClient = useQueryClient();
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const [busyPay, setBusyPay] = useState<string | null>(null);

  const transactionsQuery = useTransactions(workspaceId);
  const accountsQuery = useAccounts(workspaceId);
  const safe = useSafeToSpend(workspaceId);
  const eventsQuery = useEvents(workspaceId);
  const tasksQuery = useTasks(workspaceId);
  const goalsQuery = useGoals(workspaceId);
  const contextsQuery = useContexts(workspaceId);
  const nameOf = useMemberName();

  const goals = useMemo(() => goalsQuery.data ?? [], [goalsQuery.data]);
  const contributionsQuery = useAllContributions(goals.map((goal) => goal.id));

  const transactions = useMemo(() => transactionsQuery.data ?? [], [transactionsQuery.data]);
  const accounts = accountsQuery.data ?? [];
  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);
  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const contexts = useMemo(() => contextsQuery.data ?? [], [contextsQuery.data]);
  const contributions = contributionsQuery.data ?? [];

  const purchasesQuery = usePurchases(workspaceId);
  const activitiesQuery = useActivities(workspaceId);
  const weekActivities = useMemo(() => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - 6);
    return (activitiesQuery.data ?? []).filter(
      (item) => parseDateOnly(item.activity_date) >= from,
    );
  }, [activitiesQuery.data]);
  const plannedPurchases = useMemo(
    () =>
      (purchasesQuery.data ?? [])
        .filter((item) => item.status !== "PURCHASED" && item.status !== "DISCARDED")
        .slice(0, 4),
    [purchasesQuery.data],
  );

  const finance = useMemo(() => {
    const monthly = transactions.filter((t) => inMonth(t.transaction_date));
    const open = transactions
      .filter((t) => t.type === "EXPENSE" && isOpen(t))
      .sort((a, b) => dueDateOf(a).localeCompare(dueDateOf(b)));
    const overdue = open.filter((t) => statusOf(t) === "OVERDUE");
    const today = todayISO();
    const limit = new Date();
    limit.setDate(limit.getDate() + 7);
    const weekLimit = `${limit.getFullYear()}-${String(limit.getMonth() + 1).padStart(2, "0")}-${String(limit.getDate()).padStart(2, "0")}`;
    const nextWeek = open.filter((t) => dueDateOf(t) >= today && dueDateOf(t) <= weekLimit);
    return {
      balance: netWorth(accounts, transactions),
      income: totalIncome(monthly),
      expense: totalExpense(monthly),
      openTotal: open.reduce((sum, t) => sum + Number(t.amount), 0),
      open,
      overdue,
      overdueTotal: overdue.reduce((sum, t) => sum + Number(t.amount), 0),
      weekTotal: nextWeek.reduce((sum, t) => sum + Number(t.amount), 0),
      weekCount: nextWeek.length,
    };
  }, [transactions, accounts]);

  const upcomingEvents = useMemo(() => {
    const from = new Date(new Date().toDateString()).getTime();
    return events
      .filter((event) => new Date(event.starts_at).getTime() >= from)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .slice(0, 4);
  }, [events]);

  const openTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.status !== "DONE")
        .sort((a, b) => {
          if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
          if (a.due_date) return -1;
          if (b.due_date) return 1;
          return b.created_at.localeCompare(a.created_at);
        })
        .slice(0, 5),
    [tasks],
  );

  const activeContexts = useMemo(
    () =>
      contexts
        .filter((context) => context.status === "ACTIVE" || context.status === "PLANNED")
        .slice(0, 4)
        .map((context) => ({
          context,
          spend: transactions
            .filter((t) => t.context_id === context.id && t.type === "EXPENSE")
            .reduce((sum, t) => sum + Number(t.amount), 0),
          tasks: tasks.filter((t) => t.context_id === context.id && t.status !== "DONE").length,
          events: events.filter((e) => e.context_id === context.id).length,
        })),
    [contexts, transactions, tasks, events],
  );

  const activeGoals = useMemo(
    () =>
      goals
        .filter((goal) => goal.status === "ACTIVE")
        .slice(0, 3)
        .map((goal) => {
          const target = Number(goal.target_amount ?? 0);
          const current = goalProgress(goal, contributions);
          return {
            goal,
            target,
            current,
            percent: target ? Math.min(Math.round((current / target) * 100), 100) : 0,
          };
        }),
    [goals, contributions],
  );

  const nearGoal = activeGoals.find((item) => item.target > 0 && item.percent >= 80);

  const activity = useMemo(
    () =>
      [
        ...transactions.map((t) => ({
          key: `t-${t.id}`,
          userId: t.owner_id,
          action: t.type === "INCOME" ? "registrou uma receita" : "registrou uma despesa",
          label: `${formatCurrency(Number(t.amount))} — ${t.description}`,
          at: t.created_at,
        })),
        ...tasks
          .filter((t) => t.status === "DONE")
          .map((t) => ({
            key: `kd-${t.id}`,
            userId: t.owner_id,
            action: "concluiu a tarefa",
            label: t.title,
            at: t.updated_at,
          })),
        ...tasks.map((t) => ({
          key: `k-${t.id}`,
          userId: t.owner_id,
          action: "criou a tarefa",
          label: t.title,
          at: t.created_at,
        })),
        ...events.map((e) => ({
          key: `e-${e.id}`,
          userId: e.owner_id,
          action: "agendou",
          label: e.title,
          at: e.created_at,
        })),
        ...goals.map((g) => ({
          key: `g-${g.id}`,
          userId: g.owner_id,
          action: "criou a meta",
          label: g.title,
          at: g.created_at,
        })),
        ...contexts.map((c) => ({
          key: `c-${c.id}`,
          userId: c.owner_id,
          action: "criou o contexto",
          label: c.name,
          at: c.created_at,
        })),
        ...contributions.map((item) => ({
          key: `gc-${item.id}`,
          userId: item.user_id,
          action:
            movementType(item) === "WITHDRAWAL"
              ? `retirou ${formatCurrency(Math.abs(Number(item.amount)))} da meta`
              : `adicionou ${formatCurrency(Math.abs(Number(item.amount)))} à meta`,
          label: goals.find((goal) => goal.id === item.goal_id)?.title ?? "",
          at: item.created_at,
        })),
      ]
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
        .slice(0, 6),
    [transactions, tasks, events, goals, contexts, contributions],
  );

  if (loading) return <LoadingState />;
  if (error) return <ErrorState onRetry={refetchWorkspace} />;

  const anyLoading =
    transactionsQuery.isLoading ||
    accountsQuery.isLoading ||
    eventsQuery.isLoading ||
    tasksQuery.isLoading ||
    goalsQuery.isLoading ||
    contextsQuery.isLoading;
  const anyError =
    transactionsQuery.error ??
    accountsQuery.error ??
    eventsQuery.error ??
    tasksQuery.error ??
    goalsQuery.error ??
    contextsQuery.error;

  if (anyLoading) return <LoadingState label="Carregando nossa vida..." />;
  if (anyError)
    return (
      <ErrorState
        message="Não foi possível carregar o painel."
        onRetry={() => {
          void transactionsQuery.refetch();
          void accountsQuery.refetch();
          void eventsQuery.refetch();
          void tasksQuery.refetch();
          void goalsQuery.refetch();
          void contextsQuery.refetch();
        }}
      />
    );

  const toggleTask = async (id: string) => {
    setBusyTask(id);
    try {
      const { error: updateError } = await supabase
        .from("tasks")
        .update({ status: "DONE" })
        .eq("id", id);
      if (updateError) throw updateError;
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Tarefa concluída");
    } catch {
      toast.error("Não foi possível concluir a tarefa");
    } finally {
      setBusyTask(null);
    }
  };

  const payNow = async (id: string) => {
    setBusyPay(id);
    try {
      const { error: payError } = await supabase
        .from("transactions")
        .update({ status: "PAID", paid_at: todayISO() })
        .eq("id", id);
      if (payError) throw payError;
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Pagamento registrado");
    } catch {
      toast.error("Não foi possível registrar o pagamento");
    } finally {
      setBusyPay(null);
    }
  };

  const highlights: { tone: "warn" | "ok" | "info"; text: string }[] = [];
  if (finance.overdue.length > 0)
    highlights.push({
      tone: "warn",
      text: `Vocês têm ${finance.overdue.length} pagamento${finance.overdue.length > 1 ? "s" : ""} atrasado${finance.overdue.length > 1 ? "s" : ""} · ${formatCurrency(finance.overdueTotal)}`,
    });
  else if (finance.open.length > 0)
    highlights.push({ tone: "ok", text: "Nenhum pagamento atrasado" });
  if (finance.weekCount > 0)
    highlights.push({
      tone: "info",
      text: `${formatCurrency(finance.weekTotal)} vencem nos próximos 7 dias`,
    });
  if (nearGoal)
    highlights.push({
      tone: "info",
      text: `${nearGoal.goal.title} está em ${nearGoal.percent}%`,
    });

  const nothingAtAll =
    transactions.length === 0 &&
    events.length === 0 &&
    tasks.length === 0 &&
    goals.length === 0 &&
    contexts.length === 0;

  return (
    <div className="space-y-8">
      <header className="flex items-center gap-4">
        <MemberAvatar name={profile?.name} email={profile?.email} src={profile?.avatar_url} className="size-12 ring-primary/20" />
        <div className="min-w-0 space-y-0.5">
          <h1 className="truncate text-2xl font-semibold sm:text-3xl">
            <span className="sr-only">Dashboard — </span>
            {greeting(profile?.name)}
          </h1>
          <p className="text-sm text-muted-foreground">Nossa vida, em um só lugar.</p>
          <p className="text-xs capitalize text-muted-foreground/80">{formatDateLong()}</p>
        </div>
      </header>

      <RelationshipTime />

      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.kind}
            type="button"
            onClick={() => openQuickAction(action.kind)}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs transition-colors hover:border-primary"
          >
            <action.icon className="size-3.5 text-primary" />
            {action.label}
          </button>
        ))}
      </div>

      {highlights.length > 0 ? (
        <div className="space-y-2">
          {highlights.map((item) => (
            <p
              key={item.text}
              className={cn(
                "rounded-xl border px-4 py-3 text-sm",
                item.tone === "warn"
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : item.tone === "ok"
                    ? "border-border bg-surface text-muted-foreground"
                    : "border-border bg-surface text-foreground",
              )}
            >
              {item.text}
            </p>
          ))}
        </div>
      ) : null}

      {nothingAtAll ? (
        <EmptyState
          icon={Heart}
          title="Está tudo tranquilo por aqui."
          description="Comece registrando uma despesa, um compromisso ou uma tarefa."
          action={
            <Button size="sm" onClick={() => openQuickAction("expense")}>
              Registrar algo
            </Button>
          }
        />
      ) : null}

      <Panel>
        <PanelTitle
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/financeiro">Financeiro</Link>
            </Button>
          }
        >
          Financeiro
        </PanelTitle>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Money label="Saldo total" value={finance.balance} />
          <Money label="Entradas no mês" value={finance.income} tone="text-success" />
          <Money label="Despesas no mês" value={finance.expense} tone="text-destructive" />
          <Money
            label="A pagar"
            value={finance.openTotal}
            tone={finance.overdueTotal > 0 ? "text-destructive" : undefined}
          />
        </div>
      </Panel>

      <BalanceCard />



      {safe ? (
        <Link to="/financeiro" className="block rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Dinheiro livre</p>
          <p className={cn("numeric mt-1 text-3xl font-semibold", safe.spendable <= 0 && "text-destructive")}>{formatCurrency(safe.spendable)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {safe.lowest < 0
              ? `Vocês podem ficar ${formatCurrency(-safe.lowest)} abaixo do necessário antes da próxima entrada.`
              : `Entradas previstas ${formatCurrency(safe.income)} · compromissos ${formatCurrency(safe.commitments)} nos próximos 30 dias.`}
          </p>
        </Link>
      ) : null}

      <div className="grid grid-cols-1 gap-4 [&>*]:min-w-0 lg:grid-cols-2">
        <Panel>
          <PanelTitle
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link to="/financeiro">Ver todos</Link>
              </Button>
            }
          >
            Próximos pagamentos
          </PanelTitle>
          {finance.open.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Tudo em dia"
              description="Nenhuma conta em aberto por enquanto."
            />
          ) : (
            <ul className="divide-y divide-border">
              {finance.open.slice(0, 5).map((item) => {
                const overdue = statusOf(item) === "OVERDUE";
                return (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.description}</p>
                      <p
                        className={cn(
                          "text-xs",
                          overdue ? "text-destructive" : "text-muted-foreground",
                        )}
                      >
                        {overdue ? "Atrasada · " : ""}
                        {relativeDay(dueDateOf(item))}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="numeric text-sm">{formatCurrency(Number(item.amount))}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyPay === item.id}
                        onClick={() => void payNow(item.id)}
                      >
                        Pagar
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelTitle
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link to="/agenda">Ver agenda</Link>
              </Button>
            }
          >
            Próximos eventos
          </PanelTitle>
          {upcomingEvents.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Agenda livre"
              description="Nada marcado para os próximos dias."
              action={
                <Button size="sm" variant="outline" onClick={() => openQuickAction("event")}>
                  Novo evento
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {upcomingEvents.map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{event.title}</p>
                    {event.location ? (
                      <p className="truncate text-xs text-muted-foreground">{event.location}</p>
                    ) : null}
                  </div>
                  <span className="numeric shrink-0 text-xs text-muted-foreground">
                    {relativeDay(event.starts_at.slice(0, 10))} · {formatTime(event.starts_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelTitle
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link to="/tarefas">Tarefas</Link>
              </Button>
            }
          >
            Precisamos fazer
          </PanelTitle>
          {openTasks.length === 0 ? (
            <EmptyState
              icon={CheckSquare}
              title="Nada pendente"
              description="A lista de vocês está limpa."
              action={
                <Button size="sm" variant="outline" onClick={() => openQuickAction("task")}>
                  Nova tarefa
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {openTasks.map((task) => (
                <li key={task.id} className="flex items-center gap-3 py-3">
                  <Checkbox
                    checked={false}
                    disabled={busyTask === task.id}
                    onCheckedChange={() => void toggleTask(task.id)}
                    aria-label={`Concluir ${task.title}`}
                  />
                  <p className="min-w-0 flex-1 truncate text-sm">{task.title}</p>
                  {task.due_date ? (
                    <span className="numeric shrink-0 text-xs text-muted-foreground">
                      {relativeDay(task.due_date)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelTitle
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link to="/contextos">Contextos</Link>
              </Button>
            }
          >
            Contextos ativos
          </PanelTitle>
          {activeContexts.length === 0 ? (
            <EmptyState
              icon={Compass}
              title="Nenhum contexto ativo"
              description="Contextos agrupam gastos, tarefas e eventos de um projeto ou viagem."
              action={
                <Button size="sm" variant="outline" onClick={() => openQuickAction("context")}>
                  Novo contexto
                </Button>
              }
            />
          ) : (
            <ul className="space-y-2">
              {activeContexts.map((item) => (
                <li key={item.context.id}>
                  <Link
                    to="/contextos/$id"
                    params={{ id: item.context.id }}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/40 px-4 py-3 transition-colors hover:border-primary"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {contextEmoji(item.context.type)} {item.context.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.tasks} tarefa{item.tasks === 1 ? "" : "s"} · {item.events} evento
                        {item.events === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span className="numeric shrink-0 text-sm">{formatCurrency(item.spend)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel>
        <PanelTitle
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/metas">Metas</Link>
            </Button>
          }
        >
          Nossas metas
        </PanelTitle>
        {activeGoals.length === 0 ? (
          <EmptyState
            icon={Target}
            title="Nenhuma meta ativa"
            description="Comece com um objetivo simples e mensurável."
            action={
              <Button size="sm" variant="outline" onClick={() => openQuickAction("goal")}>
                Nova meta
              </Button>
            }
          />
        ) : (
          <ul className="space-y-4">
            {activeGoals.map(({ goal, target, current, percent }) => (
              <li key={goal.id}>
                <Link to="/metas/$id" params={{ id: goal.id }} className="block space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{goal.title}</span>
                    <span className="numeric text-muted-foreground">
                      {formatCurrency(current)}
                      {target ? ` / ${formatCurrency(target)}` : ""}
                      {target ? ` · ${percent}%` : ""}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {plannedPurchases.length > 0 ? (
        <Panel>
          <PanelTitle
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link to="/compras">Ver compras</Link>
              </Button>
            }
          >
            Compras planejadas
          </PanelTitle>
          <ul className="space-y-2">
            {plannedPurchases.map((purchase) => (
              <li key={purchase.id} className="flex items-center gap-3 text-sm">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted">
                  {categoryEmoji(purchase.category)}
                </span>
                <span className="min-w-0 flex-1 truncate">{purchase.title}</span>
                <span className="numeric shrink-0 text-muted-foreground">
                  {purchase.found_price != null
                    ? formatCurrency(Number(purchase.found_price))
                    : purchase.budget_amount != null
                      ? formatCurrency(Number(purchase.budget_amount))
                      : "—"}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {weekActivities.length > 0 ? (
        <Panel>
          <PanelTitle
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link to="/esporte">Ver atividades</Link>
              </Button>
            }
          >
            🏃 Movimento
          </PanelTitle>
          <p className="text-sm text-muted-foreground">
            Vocês fizeram {weekActivities.length}{" "}
            {weekActivities.length === 1 ? "atividade" : "atividades"} nos últimos 7 dias.
          </p>
          <ul className="mt-3 space-y-2">
            {weekActivities.slice(0, 3).map((item) => (
              <li key={item.id} className="flex items-center gap-3 text-sm">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted">
                  {activityEmoji(item.activity_type)}
                </span>
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                <span className="numeric shrink-0 text-muted-foreground">
                  {formatDuration(item.duration_minutes) ?? formatDistance(item.distance_km) ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}


      <Panel>
        <PanelTitle>Atividade recente</PanelTitle>
        {activity.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="Está tudo tranquilo por aqui."
            description="Tudo que vocês criarem aparece aqui, com o nome de quem registrou."
          />
        ) : (
          <ul className="divide-y divide-border">
            {activity.map((item) => (
              <li key={item.key} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div className="flex min-w-0 items-center gap-2.5">
                  <MemberAvatar
                    name={memberProfiles.find((profile) => profile.id === item.userId)?.name}
                    email={memberProfiles.find((profile) => profile.id === item.userId)?.email}
                    src={memberProfiles.find((profile) => profile.id === item.userId)?.avatar_url}
                    className="size-7 shrink-0"
                    fallbackClassName="text-[9px]"
                  />
                  <span className="truncate">
                    <span className="font-medium">
                      {nameOf(item.userId) ?? (item.userId === userId ? "Você" : "Alguém")}
                    </span>{" "}
                    {item.action} <span className="text-muted-foreground">{item.label}</span>
                  </span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {relativeTime(item.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
