import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  CheckSquare,
  Plus,
  StickyNote,
  Target,
  Wallet,
} from "lucide-react";
import { Panel, PanelTitle } from "@/components/common/page";
import { EmptyState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { CreatedBy, useMemberName } from "@/components/common/created-by";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RecordActions } from "@/components/common/record-actions";
import { StatusBadge } from "@/components/finance/status-badge";
import { ContextDialog } from "@/components/quick/context-dialog";
import { TransactionDialog } from "@/components/quick/transaction-dialog";
import { SimpleRecordDialog, type SimpleKind } from "@/components/quick/simple-record-dialog";
import { useApp } from "@/features/app/app-context";
import {
  contextEmoji,
  contextStatusLabel,
  contextTypeLabel,
  deleteContext,
  useContext_,
} from "@/features/contexts/queries";
import { useAccounts, useCards, useCategories, useTransactions } from "@/features/finance/queries";
import { deleteTransaction, setTransactionStatus } from "@/features/finance/mutations";
import { useEvents, useGoals, useNotes, useTasks } from "@/features/planner/queries";
import { useAllContributions, goalProgress } from "@/features/planner/contributions";
import { supabase } from "@/integrations/supabase/client";
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

type StatusFilter = "ALL" | "PAID" | "PENDING" | "OVERDUE";
type SimpleRecord = { id: string; [key: string]: unknown };

function relativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "ontem" : `há ${days} dias`;
}

function ContextDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const nameOf = useMemberName();
  const { workspaceId, openQuickAction, setQuickMenuOpen, setActiveContextId } = useApp();
  const { data: context, isLoading } = useContext_(id);
  const { data: transactions = [] } = useTransactions(workspaceId);
  const { data: categories = [] } = useCategories(workspaceId);
  const { data: accounts = [] } = useAccounts(workspaceId);
  const { data: cards = [] } = useCards(workspaceId);
  const { data: events = [] } = useEvents(workspaceId);
  const { data: tasks = [] } = useTasks(workspaceId);
  const { data: notes = [] } = useNotes(workspaceId);
  const { data: goals = [] } = useGoals(workspaceId);

  const [editOpen, setEditOpen] = useState(false);
  const [txEdit, setTxEdit] = useState<{ id: string; type: "EXPENSE" | "INCOME" } | null>(null);
  const [simpleEdit, setSimpleEdit] = useState<{ kind: SimpleKind; record: SimpleRecord } | null>(
    null,
  );
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [categoryId, setCategoryId] = useState("ALL");
  const [accountId, setAccountId] = useState("ALL");
  const [cardId, setCardId] = useState("ALL");
  const [month, setMonth] = useState("");

  useEffect(() => {
    setActiveContextId(id);
    return () => setActiveContextId(null);
  }, [id, setActiveContextId]);

  const contextGoals = useMemo(
    () => goals.filter((goal) => goal.context_id === id),
    [goals, id],
  );
  const { data: contributions = [] } = useAllContributions(contextGoals.map((goal) => goal.id));

  const contextTransactions = transactions.filter((t) => t.context_id === id);
  const contextEvents = events.filter((event) => event.context_id === id);
  const contextTasks = tasks.filter((task) => task.context_id === id);
  const contextNotes = notes.filter((note) => note.context_id === id);

  const expenses = contextTransactions.filter((t) => t.type === "EXPENSE");
  const spent = expenses.reduce((total, t) => total + Number(t.amount), 0);
  const received = contextTransactions
    .filter((t) => t.type === "INCOME")
    .reduce((total, t) => total + Number(t.amount), 0);
  const paid = expenses
    .filter((t) => t.status === "PAID")
    .reduce((total, t) => total + Number(t.amount), 0);
  const pending = expenses
    .filter((t) => t.status === "PENDING")
    .reduce((total, t) => total + Number(t.amount), 0);
  const overdue = expenses
    .filter((t) => t.status === "OVERDUE")
    .reduce((total, t) => total + Number(t.amount), 0);
  const openTasks = contextTasks.filter((task) => task.status !== "DONE");

  const budget = context?.budget_amount != null ? Number(context.budget_amount) : null;
  const budgetUsed = budget && budget > 0 ? (spent / budget) * 100 : 0;

  const goalsTotal = contextGoals.reduce(
    (total, goal) => total + goalProgress(goal, contributions),
    0,
  );
  const goalsTarget = contextGoals.reduce(
    (total, goal) => total + Number(goal.target_amount ?? 0),
    0,
  );

  const filtered = contextTransactions.filter((t) => {
    if (status !== "ALL" && t.status !== status) return false;
    if (categoryId !== "ALL" && t.category_id !== categoryId) return false;
    if (accountId !== "ALL" && t.account_id !== accountId) return false;
    if (cardId !== "ALL" && t.card_id !== cardId) return false;
    if (month && !t.transaction_date.startsWith(month)) return false;
    return true;
  });

  const activity = useMemo(() => {
    type Item = { id: string; at: string; who?: string | null; text: string; detail?: string };
    const items: Item[] = [
      ...contextTransactions.map((t) => ({
        id: `t-${t.id}`,
        at: t.created_at,
        who: t.owner_id,
        text: t.type === "INCOME" ? "registrou uma receita" : "registrou uma despesa",
        detail: `${formatCurrency(Number(t.amount))} — ${t.description}`,
      })),
      ...contextTasks.map((t) => ({
        id: `k-${t.id}`,
        at: t.created_at,
        who: t.owner_id,
        text: "criou uma tarefa",
        detail: t.title,
      })),
      ...contextEvents.map((e) => ({
        id: `e-${e.id}`,
        at: e.created_at,
        who: e.owner_id,
        text: "criou um evento",
        detail: e.title,
      })),
      ...contextNotes.map((n) => ({
        id: `n-${n.id}`,
        at: n.created_at,
        who: n.owner_id,
        text: "criou uma nota",
        detail: n.title,
      })),
      ...contextGoals.map((g) => ({
        id: `g-${g.id}`,
        at: g.created_at,
        who: g.owner_id,
        text: "criou uma meta",
        detail: g.title,
      })),
      ...contributions
        .filter((c) => contextGoals.some((goal) => goal.id === c.goal_id))
        .map((c) => ({
          id: `c-${c.id}`,
          at: c.created_at,
          who: c.user_id,
          text:
            c.movement_type === "WITHDRAWAL"
              ? `retirou ${formatCurrency(Number(c.amount))} de uma meta`
              : `adicionou ${formatCurrency(Number(c.amount))} a uma meta`,
        })),
    ];
    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  }, [contextTransactions, contextTasks, contextEvents, contextNotes, contextGoals, contributions]);

  async function refresh(keys: string[]) {
    await Promise.all(
      keys.map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
    );
  }

  async function run(action: () => Promise<unknown>, keys: string[], message: string) {
    try {
      await action();
      await refresh(keys);
      toast.success(message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível concluir.");
    }
  }

  async function removeSimple(table: "events" | "tasks" | "notes" | "goals", recordId: string) {
    const { error } = await supabase.from(table).delete().eq("id", recordId);
    if (error) throw error;
  }

  async function removeContext() {
    try {
      await deleteContext(id);
      await refresh(["contexts", "transactions", "tasks", "events", "notes", "goals"]);
      toast.success("Contexto excluído. Os registros continuam no Nós.");
      void navigate({ to: "/contextos" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir.");
    }
  }

  if (isLoading) return <LoadingState />;
  if (!context) {
    return (
      <EmptyState
        title="Contexto não encontrado"
        description="Ele pode ter sido excluído."
        action={
          <Button size="sm" variant="outline" asChild>
            <Link to="/contextos">Voltar</Link>
          </Button>
        }
      />
    );
  }

  const accent = context.color ?? undefined;

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
          <Link to="/contextos">
            <ArrowLeft className="size-4" />
            Contextos
          </Link>
        </Button>

        {context.cover_image ? (
          <img
            src={context.cover_image}
            alt={`Capa do contexto ${context.name}`}
            loading="lazy"
            className="h-36 w-full rounded-2xl object-cover sm:h-48"
          />
        ) : null}

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
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge
                variant="outline"
                style={accent ? { borderColor: `${accent}66`, color: accent } : undefined}
              >
                {contextTypeLabel(context.type)}
              </Badge>
              <Badge variant="outline">{contextStatusLabel(context.status)}</Badge>
              <CreatedBy userId={context.owner_id} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              Editar
            </Button>
            <RecordActions
              onDelete={removeContext}
              confirmTitle="Excluir este contexto?"
              confirmDescription={`Este contexto possui ${expenses.length} despesas, ${contextTasks.length} tarefas, ${contextEvents.length} eventos e ${contextNotes.length} notas. Nada disso será apagado — os registros apenas deixam de ficar vinculados ao contexto.`}
            />
            <Button size="sm" onClick={() => setQuickMenuOpen(true)}>
              <Plus className="size-4" />
              Criar aqui
            </Button>
          </div>
        </header>

        {context.description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">{context.description}</p>
        ) : null}
      </div>

      <Panel>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              💰 Total gasto
            </p>
            <p className="numeric mt-2 text-xl font-semibold">{formatCurrency(spent)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">🎯 Metas</p>
            <p className="numeric mt-2 text-xl font-semibold">
              {goalsTarget ? `${Math.round((goalsTotal / goalsTarget) * 100)}%` : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">✅ Tarefas</p>
            <p className="numeric mt-2 text-xl font-semibold">
              {contextTasks.length - openTasks.length}/{contextTasks.length}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">📅 Eventos</p>
            <p className="numeric mt-2 text-xl font-semibold">{contextEvents.length}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">📝 Notas</p>
            <p className="numeric mt-2 text-xl font-semibold">{contextNotes.length}</p>
          </div>
        </div>

        {budget && budget > 0 ? (
          <div className="mt-6 space-y-2 border-t border-border pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="text-muted-foreground">
                Orçamento <span className="numeric">{formatCurrency(budget)}</span>
              </span>
              <span
                className={
                  spent > budget
                    ? "numeric text-destructive"
                    : "numeric text-muted-foreground"
                }
              >
                Restante {formatCurrency(budget - spent)} · {budgetUsed.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className={
                  spent > budget
                    ? "h-full rounded-full bg-destructive transition-all"
                    : "h-full rounded-full bg-primary transition-all"
                }
                style={{ width: `${Math.min(budgetUsed, 100)}%` }}
              />
            </div>
            {spent > budget ? (
              <p className="text-xs text-destructive">⚠️ Orçamento excedido</p>
            ) : null}
          </div>
        ) : null}
      </Panel>

      <Tabs defaultValue="visao">
        <TabsList className="flex w-full justify-start overflow-x-auto">
          <TabsTrigger value="visao">Visão geral</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
          <TabsTrigger value="notas">Notas</TabsTrigger>
          <TabsTrigger value="metas">Metas</TabsTrigger>
        </TabsList>

        <TabsContent value="visao" className="space-y-6 pt-6">
          <Panel>
            <PanelTitle>Resumo</PanelTitle>
            <ul className="grid gap-3 sm:grid-cols-2">
              {[
                ["Total gasto", formatCurrency(spent)],
                ["Recebido", formatCurrency(received)],
                ["Despesas", String(expenses.length)],
                ["Tarefas pendentes", String(openTasks.length)],
                ["Eventos", String(contextEvents.length)],
                ["Notas", String(contextNotes.length)],
                ["Metas", String(contextGoals.length)],
                ["Balanço", formatCurrency(received - spent)],
              ].map(([label, value]) => (
                <li key={label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="numeric">{value}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelTitle>Atividade recente</PanelTitle>
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nada aconteceu por aqui ainda.</p>
            ) : (
              <ul className="space-y-4">
                {activity.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{nameOf(item.who)}</span> {item.text}
                      </p>
                      {item.detail ? (
                        <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {relativeTime(item.at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="financeiro" className="space-y-6 pt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Total gasto", formatCurrency(spent), ""],
              ["Pago", formatCurrency(paid), "text-success"],
              ["Pendente", formatCurrency(pending), ""],
              ["Atrasado", formatCurrency(overdue), "text-destructive"],
            ].map(([label, value, tone]) => (
              <div key={label} className="rounded-2xl border border-border bg-surface p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
                <p className={`numeric mt-2 text-lg font-semibold ${tone}`}>{value}</p>
              </div>
            ))}
          </div>

          <Panel>
            <PanelTitle
              action={
                <Button variant="ghost" size="sm" onClick={() => openQuickAction("expense")}>
                  Nova despesa
                </Button>
              }
            >
              Lançamentos · {filtered.length}
            </PanelTitle>

            <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="PAID">Pagos</SelectItem>
                  <SelectItem value="PENDING">Pendentes</SelectItem>
                  <SelectItem value="OVERDUE">Atrasados</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas as categorias</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Conta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas as contas</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={cardId} onValueChange={setCardId}>
                <SelectTrigger>
                  <SelectValue placeholder="Cartão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os cartões</SelectItem>
                  {cards.map((card) => (
                    <SelectItem key={card.id} value={card.id}>
                      {card.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                aria-label="Período"
              />
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="Nenhum lançamento"
                description="Crie uma despesa aqui dentro e ela já entra neste contexto."
              />
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((transaction) => (
                  <li key={transaction.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{transaction.description}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {formatDateShort(transaction.transaction_date)}
                        </span>
                        <StatusBadge status={transaction.status} />
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
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
                      {transaction.status !== "PAID" && transaction.type !== "TRANSFER" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            void run(
                              () => setTransactionStatus(transaction.id, "PAID"),
                              ["transactions"],
                              "Lançamento pago.",
                            )
                          }
                        >
                          Pagar
                        </Button>
                      ) : null}
                      <RecordActions
                        {...(transaction.type === "TRANSFER"
                          ? {}
                          : {
                              onEdit: () =>
                                setTxEdit({
                                  id: transaction.id,
                                  type: transaction.type === "INCOME" ? "INCOME" : "EXPENSE",
                                }),
                            })}
                        onDelete={() =>
                          run(
                            () => deleteTransaction(transaction.id),
                            ["transactions"],
                            "Lançamento excluído.",
                          )
                        }
                      />
                    </div>
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
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateShort(new Date(event.starts_at))} · {formatTime(event.starts_at)}
                        {event.location ? ` · ${event.location}` : ""}
                      </p>
                    </div>
                    <RecordActions
                      onEdit={() => setSimpleEdit({ kind: "event", record: event })}
                      onDelete={() =>
                        run(() => removeSimple("events", event.id), ["events"], "Evento excluído.")
                      }
                    />
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
              <div className="space-y-6">
                {(
                  [
                    ["TODO", "Pendentes"],
                    ["DOING", "Em andamento"],
                    ["DONE", "Concluídas"],
                  ] as const
                ).map(([key, label]) => {
                  const group = contextTasks.filter((task) => task.status === key);
                  if (group.length === 0) return null;
                  return (
                    <div key={key} className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        {label} · {group.length}
                      </p>
                      <ul className="divide-y divide-border">
                        {group.map((task) => (
                          <li key={task.id} className="flex items-center gap-3 py-3">
                            <Checkbox
                              checked={task.status === "DONE"}
                              onCheckedChange={(checked) =>
                                void run(
                                  async () => {
                                    const { error } = await supabase
                                      .from("tasks")
                                      .update({ status: checked ? "DONE" : "TODO" })
                                      .eq("id", task.id);
                                    if (error) throw error;
                                  },
                                  ["tasks"],
                                  checked ? "Tarefa concluída." : "Tarefa reaberta.",
                                )
                              }
                            />
                            <p
                              className={
                                task.status === "DONE"
                                  ? "min-w-0 flex-1 truncate text-sm text-muted-foreground line-through"
                                  : "min-w-0 flex-1 truncate text-sm"
                              }
                            >
                              {task.title}
                            </p>
                            {task.due_date ? (
                              <span className="numeric shrink-0 text-xs text-muted-foreground">
                                {formatDateShort(task.due_date)}
                              </span>
                            ) : null}
                            <RecordActions
                              onEdit={() => setSimpleEdit({ kind: "task", record: task })}
                              onDelete={() =>
                                run(
                                  () => removeSimple("tasks", task.id),
                                  ["tasks"],
                                  "Tarefa excluída.",
                                )
                              }
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
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
                  <li key={note.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{note.title}</p>
                      {note.content ? (
                        <p className="line-clamp-2 text-xs text-muted-foreground">{note.content}</p>
                      ) : null}
                    </div>
                    <RecordActions
                      onEdit={() => setSimpleEdit({ kind: "note", record: note })}
                      onDelete={() =>
                        run(() => removeSimple("notes", note.id), ["notes"], "Nota excluída.")
                      }
                    />
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
                          {formatCurrency(current)} / {formatCurrency(target)} ·{" "}
                          {Math.round(progress)}%
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

      {txEdit ? (
        <TransactionDialog
          kind={txEdit.type === "INCOME" ? "income" : "expense"}
          open
          onOpenChange={(open) => !open && setTxEdit(null)}
          transaction={contextTransactions.find((t) => t.id === txEdit.id) ?? null}
          defaultContextId={id}
        />
      ) : null}

      {simpleEdit ? (
        <SimpleRecordDialog
          kind={simpleEdit.kind}
          open
          onOpenChange={(open) => !open && setSimpleEdit(null)}
          record={simpleEdit.record as never}
          defaultContextId={id}
        />
      ) : null}
    </div>
  );
}
