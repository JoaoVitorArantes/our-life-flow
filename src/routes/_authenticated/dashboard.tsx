import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, CheckSquare, Heart, Target, Wallet } from "lucide-react";
import { Panel, PanelTitle } from "@/components/common/page";
import { useMemberName } from "@/components/common/created-by";
import { StatCard } from "@/components/common/stat-card";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/app/app-context";
import { useAccounts, useTransactions } from "@/features/finance/queries";
import { useEvents, useGoals, useTasks } from "@/features/planner/queries";
import { goalProgress, useAllContributions } from "@/features/planner/contributions";
import { contextEmoji, useContexts } from "@/features/contexts/queries";
import { inMonth, netWorth, totalExpense, totalIncome } from "@/features/finance/calc";
import { formatCurrency, formatDateLong, formatDateShort, formatTime, greeting } from "@/lib/format";

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

function Dashboard() {
  const { workspaceId, profile, loading, error, refetchWorkspace, openQuickAction } = useApp();
  const transactionsQuery = useTransactions(workspaceId);
  const accountsQuery = useAccounts(workspaceId);
  const eventsQuery = useEvents(workspaceId);
  const tasksQuery = useTasks(workspaceId);
  const goalsQuery = useGoals(workspaceId);
  const contextsQuery = useContexts(workspaceId);
  const nameOf = useMemberName();

  if (loading) return <LoadingState />;
  if (error) return <ErrorState onRetry={refetchWorkspace} />;

  const transactions = transactionsQuery.data ?? [];
  const accounts = accountsQuery.data ?? [];
  const monthly = transactions.filter((t) => inMonth(t.transaction_date));
  const income = totalIncome(monthly);
  const expense = totalExpense(monthly);
  const balance = netWorth(accounts, transactions);

  const now = new Date();
  const upcoming = (eventsQuery.data ?? [])
    .filter((event) => new Date(event.starts_at) >= new Date(now.toDateString()))
    .slice(0, 4);
  const openTasks = (tasksQuery.data ?? []).filter((task) => task.status !== "DONE").slice(0, 5);
  const goals = (goalsQuery.data ?? []).slice(0, 3);
  const activeContexts = (contextsQuery.data ?? [])
    .filter((context) => context.status === "ACTIVE" || context.status === "PLANNED")
    .slice(0, 5);
  const sharedMonth = monthly.filter((t) => t.is_shared && t.type === "EXPENSE");
  const sharedTotal = sharedMonth.reduce((total, t) => total + Number(t.amount), 0);

  const activity = [
    ...transactions.map((t) => ({
      key: `t-${t.id}`,
      userId: t.owner_id,
      action: t.type === "INCOME" ? "registrou uma receita" : "registrou uma despesa",
      label: t.description,
      at: t.created_at,
    })),
    ...(tasksQuery.data ?? []).map((t) => ({
      key: `k-${t.id}`,
      userId: t.owner_id,
      action: "criou a tarefa",
      label: t.title,
      at: t.created_at,
    })),
    ...(eventsQuery.data ?? []).map((e) => ({
      key: `e-${e.id}`,
      userId: e.owner_id,
      action: "agendou",
      label: e.title,
      at: e.created_at,
    })),
    ...(goalsQuery.data ?? []).map((g) => ({
      key: `g-${g.id}`,
      userId: g.owner_id,
      action: "criou a meta",
      label: g.title,
      at: g.created_at,
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 6);


  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {greeting(profile?.name)}
        </h1>
        <p className="text-sm capitalize text-muted-foreground">{formatDateLong()}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Patrimônio" value={balance} hint="Saldo das contas" />
        <StatCard label="Receitas do mês" value={income} tone="success" />
        <StatCard label="Despesas do mês" value={expense} tone="destructive" />
        <StatCard
          label="Balanço do mês"
          value={income - expense}
          tone={income - expense >= 0 ? "success" : "destructive"}
        />
      </div>

      {activeContexts.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Contextos ativos
          </span>
          {activeContexts.map((context) => (
            <Link
              key={context.id}
              to="/contextos/$id"
              params={{ id: context.id }}
              className="rounded-full border border-border bg-surface px-3 py-1 text-xs transition-colors hover:border-primary"
            >
              {contextEmoji(context.type)} {context.name}
            </Link>
          ))}
        </div>
      ) : null}



      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelTitle
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link to="/financeiro">Ver tudo</Link>
              </Button>
            }
          >
            Últimos lançamentos
          </PanelTitle>
          {transactions.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Nenhum lançamento ainda"
              description="Registre sua primeira despesa em poucos segundos."
              action={
                <Button size="sm" onClick={() => openQuickAction("expense")}>
                  Nova despesa
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {transactions.slice(0, 5).map((transaction) => (
                <li key={transaction.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{transaction.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateShort(transaction.transaction_date)}
                      {transaction.is_shared ? " · compartilhado" : ""}
                    </p>
                  </div>
                  <span
                    className={
                      transaction.type === "INCOME"
                        ? "numeric text-sm text-success"
                        : "numeric text-sm"
                    }
                  >
                    {transaction.type === "EXPENSE" ? "−" : ""}
                    {formatCurrency(Number(transaction.amount))}
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
                <Link to="/agenda">Agenda</Link>
              </Button>
            }
          >
            Próximos compromissos
          </PanelTitle>
          {upcoming.length === 0 ? (
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
              {upcoming.map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-3 py-3">
                  <p className="truncate text-sm font-medium">{event.title}</p>
                  <span className="numeric shrink-0 text-xs text-muted-foreground">
                    {formatDateShort(new Date(event.starts_at))} · {formatTime(event.starts_at)}
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
            Tarefas abertas
          </PanelTitle>
          {openTasks.length === 0 ? (
            <EmptyState
              icon={CheckSquare}
              title="Nada pendente"
              description="Sua lista está limpa."
              action={
                <Button size="sm" variant="outline" onClick={() => openQuickAction("task")}>
                  Nova tarefa
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {openTasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-3 py-3">
                  <p className="truncate text-sm">{task.title}</p>
                  {task.due_date ? (
                    <span className="numeric shrink-0 text-xs text-muted-foreground">
                      {formatDateShort(task.due_date)}
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
                <Link to="/nos">Nós</Link>
              </Button>
            }
          >
            Nós neste mês
          </PanelTitle>
          {sharedMonth.length === 0 ? (
            <EmptyState
              icon={Heart}
              title="Sem despesas compartilhadas"
              description="Marque uma despesa como compartilhada para dividir automaticamente."
            />
          ) : (
            <div className="space-y-3">
              <p className="numeric text-2xl font-semibold">{formatCurrency(sharedTotal)}</p>
              <p className="text-sm text-muted-foreground">
                {sharedMonth.length} despesa{sharedMonth.length > 1 ? "s" : ""} dividida
                {sharedMonth.length > 1 ? "s" : ""} neste mês.
              </p>
            </div>
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
          Metas
        </PanelTitle>
        {goals.length === 0 ? (
          <EmptyState
            icon={Target}
            title="Nenhuma meta definida"
            description="Comece com um objetivo simples e mensurável."
            action={
              <Button size="sm" variant="outline" onClick={() => openQuickAction("goal")}>
                Nova meta
              </Button>
            }
          />
        ) : (
          <ul className="space-y-4">
            {goals.map((goal) => {
              const target = Number(goal.target_amount ?? 0);
              const current = goalProgress(goal, goalContributions);
              const progress = target ? Math.min((current / target) * 100, 100) : 0;
              return (
                <li key={goal.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{goal.title}</span>
                    <span className="numeric text-muted-foreground">
                      {formatCurrency(current)} / {formatCurrency(target)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelTitle>Atividade recente do Nós</PanelTitle>
        {activity.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="Nada por aqui ainda"
            description="Tudo que vocês criarem aparece aqui, com o nome de quem registrou."
          />
        ) : (
          <ul className="divide-y divide-border">
            {activity.map((item) => (
              <li key={item.key} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="truncate">
                  <span className="font-medium">{nameOf(item.userId) ?? "Alguém"}</span>{" "}
                  {item.action}{" "}
                  <span className="text-muted-foreground">{item.label}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDateShort(item.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>

  );
}
