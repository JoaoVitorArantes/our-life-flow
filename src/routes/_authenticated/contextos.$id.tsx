import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, CheckSquare, StickyNote, Target, Wallet } from "lucide-react";
import { Panel, PanelTitle } from "@/components/common/page";
import { StatCard } from "@/components/common/stat-card";
import { EmptyState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { CreatedBy } from "@/components/common/created-by";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContextDialog } from "@/components/quick/context-dialog";
import { useApp } from "@/features/app/app-context";
import {
  contextEmoji,
  contextStatusLabel,
  contextTypeLabel,
  useContext_,
} from "@/features/contexts/queries";
import { useTransactions } from "@/features/finance/queries";
import { useEvents, useGoals, useNotes, useTasks } from "@/features/planner/queries";
import { useAllContributions, goalProgress } from "@/features/planner/contributions";
import { formatCurrency, formatDateShort, formatTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/contextos/$id")({
  head: () => ({
    meta: [
      { title: "Contexto — Life OS" },
      { name: "description", content: "Tudo o que pertence a este contexto em um só lugar." },
      { property: "og:title", content: "Contexto — Life OS" },
      { property: "og:description", content: "Detalhes do contexto no Life OS." },
    ],
  }),
  component: ContextDetail,
});

function ContextDetail() {
  const { id } = Route.useParams();
  const { workspaceId, userId, openQuickAction, setActiveContextId } = useApp();
  const { data: context, isLoading } = useContext_(id);
  const { data: transactions = [] } = useTransactions(workspaceId);
  const { data: events = [] } = useEvents(workspaceId);
  const { data: tasks = [] } = useTasks(workspaceId);
  const { data: notes = [] } = useNotes(workspaceId);
  const { data: goals = [] } = useGoals(workspaceId);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    setActiveContextId(id);
    return () => setActiveContextId(null);
  }, [id, setActiveContextId]);

  const contextGoals = goals.filter((goal) => goal.context_id === id);
  const { data: contributions = [] } = useAllContributions(contextGoals.map((goal) => goal.id));

  if (isLoading) return <LoadingState />;
  if (!context) {
    return (
      <EmptyState
        title="Contexto não encontrado"
        description="Ele pode ter sido excluído ou é privado de outra pessoa."
        action={
          <Button size="sm" variant="outline" asChild>
            <Link to="/contextos">Voltar</Link>
          </Button>
        }
      />
    );
  }

  const contextTransactions = transactions.filter((t) => t.context_id === id);
  const contextEvents = events.filter((event) => event.context_id === id);
  const contextTasks = tasks.filter((task) => task.context_id === id);
  const contextNotes = notes.filter((note) => note.context_id === id);
  const spent = contextTransactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((total, t) => total + Number(t.amount), 0);
  const received = contextTransactions
    .filter((t) => t.type === "INCOME")
    .reduce((total, t) => total + Number(t.amount), 0);
  const openTasks = contextTasks.filter((task) => task.status !== "DONE");

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
          <Link to="/contextos">
            <ArrowLeft className="size-4" />
            Contextos
          </Link>
        </Button>
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              <span className="mr-2">{contextEmoji(context.type)}</span>
              {context.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {context.start_date ? formatDateShort(context.start_date) : "Sem data"}
              {context.end_date ? ` — ${formatDateShort(context.end_date)}` : ""}
              {context.location ? ` · ${context.location}` : ""}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="outline">{contextTypeLabel(context.type)}</Badge>
              <Badge variant="outline">{contextStatusLabel(context.status)}</Badge>
              <CreatedBy userId={context.owner_id} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {context.owner_id === userId ? (
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                Editar
              </Button>
            ) : null}
            <Button size="sm" onClick={() => openQuickAction("expense")}>
              Nova despesa
            </Button>
          </div>
        </header>
        {context.description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">{context.description}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Gasto no contexto" value={spent} tone="destructive" />
        <StatCard label="Recebido" value={received} tone="success" />
        <StatCard label="Balanço" value={received - spent} />
      </div>

      <Tabs defaultValue="visao">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="visao">Visão geral</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
          <TabsTrigger value="notas">Notas</TabsTrigger>
          <TabsTrigger value="metas">Metas</TabsTrigger>
        </TabsList>

        <TabsContent value="visao" className="pt-6">
          <Panel>
            <PanelTitle>Resumo</PanelTitle>
            <ul className="grid gap-3 sm:grid-cols-2">
              <li className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Lançamentos</span>
                <span className="numeric">{contextTransactions.length}</span>
              </li>
              <li className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Eventos</span>
                <span className="numeric">{contextEvents.length}</span>
              </li>
              <li className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tarefas pendentes</span>
                <span className="numeric">{openTasks.length}</span>
              </li>
              <li className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Notas</span>
                <span className="numeric">{contextNotes.length}</span>
              </li>
            </ul>
          </Panel>
        </TabsContent>

        <TabsContent value="financeiro" className="pt-6">
          <Panel>
            <PanelTitle
              action={
                <Button variant="ghost" size="sm" onClick={() => openQuickAction("expense")}>
                  Nova despesa
                </Button>
              }
            >
              Lançamentos
            </PanelTitle>
            {contextTransactions.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="Nenhum lançamento"
                description="Registre uma despesa e escolha este contexto."
              />
            ) : (
              <ul className="divide-y divide-border">
                {contextTransactions.map((transaction) => (
                  <li key={transaction.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{transaction.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateShort(transaction.transaction_date)}
                      </p>
                    </div>
                    <span
                      className={
                        transaction.type === "INCOME"
                          ? "numeric shrink-0 text-sm text-success"
                          : "numeric shrink-0 text-sm"
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
        </TabsContent>

        <TabsContent value="agenda" className="pt-6">
          <Panel>
            <PanelTitle
              action={
                <Button variant="ghost" size="sm" onClick={() => openQuickAction("event")}>
                  Novo evento
                </Button>
              }
            >
              Eventos
            </PanelTitle>
            {contextEvents.length === 0 ? (
              <EmptyState icon={CalendarDays} title="Nenhum evento neste contexto" />
            ) : (
              <ul className="divide-y divide-border">
                {contextEvents.map((event) => (
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
        </TabsContent>

        <TabsContent value="tarefas" className="pt-6">
          <Panel>
            <PanelTitle
              action={
                <Button variant="ghost" size="sm" onClick={() => openQuickAction("task")}>
                  Nova tarefa
                </Button>
              }
            >
              Tarefas
            </PanelTitle>
            {contextTasks.length === 0 ? (
              <EmptyState icon={CheckSquare} title="Nenhuma tarefa neste contexto" />
            ) : (
              <ul className="divide-y divide-border">
                {contextTasks.map((task) => (
                  <li key={task.id} className="flex items-center justify-between gap-3 py-3">
                    <p
                      className={
                        task.status === "DONE"
                          ? "truncate text-sm text-muted-foreground line-through"
                          : "truncate text-sm"
                      }
                    >
                      {task.title}
                    </p>
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
        </TabsContent>

        <TabsContent value="notas" className="pt-6">
          <Panel>
            <PanelTitle
              action={
                <Button variant="ghost" size="sm" onClick={() => openQuickAction("note")}>
                  Nova nota
                </Button>
              }
            >
              Notas
            </PanelTitle>
            {contextNotes.length === 0 ? (
              <EmptyState icon={StickyNote} title="Nenhuma nota neste contexto" />
            ) : (
              <ul className="divide-y divide-border">
                {contextNotes.map((note) => (
                  <li key={note.id} className="py-3">
                    <p className="text-sm font-medium">{note.title}</p>
                    {note.content ? (
                      <p className="line-clamp-2 text-xs text-muted-foreground">{note.content}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="metas" className="pt-6">
          <Panel>
            <PanelTitle
              action={
                <Button variant="ghost" size="sm" onClick={() => openQuickAction("goal")}>
                  Nova meta
                </Button>
              }
            >
              Metas
            </PanelTitle>
            {contextGoals.length === 0 ? (
              <EmptyState icon={Target} title="Nenhuma meta neste contexto" />
            ) : (
              <ul className="space-y-4">
                {contextGoals.map((goal) => {
                  const target = Number(goal.target_amount ?? 0);
                  const current = goalProgress(goal, contributions);
                  const progress = target ? Math.min((current / target) * 100, 100) : 0;
                  return (
                    <li key={goal.id} className="space-y-2">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <Link to="/metas/$id" params={{ id: goal.id }} className="truncate">
                          {goal.title}
                        </Link>
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
        </TabsContent>
      </Tabs>

      <ContextDialog open={editOpen} onOpenChange={setEditOpen} context={context} />
    </div>
  );
}
