import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel, PanelTitle } from "@/components/common/page";
import { LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useApp } from "@/features/app/app-context";
import { contextEmoji } from "@/features/contexts/queries";
import {
  addDays,
  isoOf,
  parseISO,
  startOfWeek,
  KIND_LABEL,
  useAgendaItems,
  type AgendaItem,
  type AgendaKind,
} from "@/features/agenda/queries";
import {
  deleteEventOccurrence,
  moveEventOccurrence,
  setTaskDone,
  type EventScope,
} from "@/features/agenda/mutations";
import { setTransactionStatus } from "@/features/finance/mutations";
import { MonthView, WeekView, DayView, ListView, type ViewHandlers } from "@/components/agenda/views";
import { EventDialog } from "@/components/agenda/event-dialog";
import { SimpleRecordDialog, type SimpleKind } from "@/components/quick/simple-record-dialog";
import { TransactionDialog } from "@/components/quick/transaction-dialog";
import { AgendaRow } from "@/components/agenda/agenda-row";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — Life OS" },
      {
        name: "description",
        content: "Eventos, tarefas, pagamentos e prazos do casal em um só calendário.",
      },
      { property: "og:title", content: "Agenda — Life OS" },
      { property: "og:description", content: "O centro temporal da vida de vocês." },
    ],
  }),
  component: Agenda,
});

type ViewMode = "month" | "week" | "day" | "list";
const VIEWS: { value: ViewMode; label: string }[] = [
  { value: "month", label: "Mês" },
  { value: "week", label: "Semana" },
  { value: "day", label: "Dia" },
  { value: "list", label: "Lista" },
];
const KINDS: { value: AgendaKind | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "event", label: "Eventos" },
  { value: "task", label: "Tarefas" },
  { value: "finance", label: "Financeiro" },
  { value: "goal", label: "Metas" },
  { value: "note", label: "Notas" },
];
const STORAGE_KEY = "lifeos-agenda-view";

function Agenda() {
  const { workspaceId } = useApp();
  const queryClient = useQueryClient();
  const { items, contexts, isLoading } = useAgendaItems(workspaceId);

  const [view, setView] = useState<ViewMode>("list");
  const [cursor, setCursor] = useState(() => new Date());
  const [kind, setKind] = useState<AgendaKind | "all">("all");
  const [contextFilter, setContextFilter] = useState("all");

  const [eventEdit, setEventEdit] = useState<{ item: AgendaItem } | null>(null);
  const [eventCreate, setEventCreate] = useState<{ date: string; minutes?: number } | null>(null);
  const [simpleEdit, setSimpleEdit] = useState<{ kind: SimpleKind; record: unknown } | null>(null);
  const [simpleCreate, setSimpleCreate] = useState<SimpleKind | null>(null);
  const [txEdit, setTxEdit] = useState<AgendaItem | null>(null);
  const [txCreate, setTxCreate] = useState(false);
  const [dayMenu, setDayMenu] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<
    { item: AgendaItem; date: string; minutes: number } | null
  >(null);
  const [pendingDelete, setPendingDelete] = useState<AgendaItem | null>(null);
  const [scope, setScope] = useState<EventScope>("all");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (saved && VIEWS.some((entry) => entry.value === saved)) setView(saved as ViewMode);
  }, []);

  function changeView(next: ViewMode) {
    setView(next);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, next);
  }

  const todayIso = isoOf(new Date());

  const filtered = useMemo(
    () =>
      items.filter(
        (item) =>
          (kind === "all" || item.kind === kind) &&
          (contextFilter === "all" || item.contextId === contextFilter),
      ),
    [items, kind, contextFilter],
  );

  const periodItems = useMemo(() => {
    if (view === "list") {
      return filtered.filter((item) => item.date >= todayIso || item.overdue);
    }
    if (view === "day") return filtered;
    if (view === "week") {
      const start = isoOf(startOfWeek(cursor));
      const end = isoOf(addDays(startOfWeek(cursor), 6));
      return filtered.filter((item) => item.date >= start && item.date <= end);
    }
    return filtered.filter((item) => {
      const date = parseISO(item.date);
      return date.getMonth() === cursor.getMonth() && date.getFullYear() === cursor.getFullYear();
    });
  }, [filtered, view, cursor, todayIso]);

  const today = filtered.filter((item) => item.date === todayIso);
  const next7 = useMemo(() => {
    const limit = isoOf(addDays(new Date(), 7));
    return filtered
      .filter((item) => !item.done && item.date <= limit && (item.date >= todayIso || item.overdue))
      .sort((a, b) => {
        const rank = (i: AgendaItem) => (i.overdue ? 0 : i.date === todayIso ? 1 : 2);
        if (rank(a) !== rank(b)) return rank(a) - rank(b);
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        const order: Record<AgendaKind, number> = { finance: 0, event: 1, task: 2, goal: 3, note: 4 };
        return order[a.kind] - order[b.kind];
      })
      .slice(0, 12);
  }, [filtered, todayIso]);

  const insights = useMemo(() => {
    const list: string[] = [];
    const tomorrow = isoOf(addDays(new Date(), 1));
    const todayEvents = today.filter((item) => item.kind === "event").length;
    const tomorrowEvents = filtered.filter(
      (item) => item.date === tomorrow && item.kind === "event",
    ).length;
    const overdueTasks = filtered.filter((item) => item.kind === "task" && item.overdue).length;
    const soon = isoOf(addDays(new Date(), 3));
    const payingSoon = filtered.filter(
      (item) => item.kind === "finance" && !item.done && item.date <= soon && item.date >= todayIso,
    );
    const overduePay = filtered.filter((item) => item.kind === "finance" && item.overdue);

    if (today.length >= 5) list.push("Hoje está cheio.");
    else if (todayEvents === 0 && today.length === 0) list.push("Hoje está livre.");
    if (tomorrowEvents > 0)
      list.push(
        tomorrowEvents === 1
          ? "Vocês têm 1 compromisso amanhã."
          : `Vocês têm ${tomorrowEvents} compromissos amanhã.`,
      );
    if (overduePay.length > 0)
      list.push(
        `${overduePay.length} ${overduePay.length === 1 ? "pagamento vencido" : "pagamentos vencidos"} (${formatCurrency(
          overduePay.reduce((total, item) => total + (item.amount ?? 0), 0),
        )}).`,
      );
    if (payingSoon.length > 0)
      list.push(`Há ${payingSoon.length} pagamento(s) vencendo nos próximos 3 dias.`);
    if (overdueTasks > 0)
      list.push(
        overdueTasks === 1 ? "Uma tarefa está atrasada." : `${overdueTasks} tarefas estão atrasadas.`,
      );
    const goalSoon = filtered.filter(
      (item) => item.kind === "goal" && !item.done && item.date >= todayIso && item.date <= soon,
    ).length;
    if (goalSoon > 0) list.push("Um prazo importante está se aproximando.");
    return list;
  }, [filtered, today, todayIso]);

  async function refresh(keys: string[]) {
    await Promise.all(keys.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
  }

  function openItem(item: AgendaItem) {
    if (item.kind === "event") setEventEdit({ item });
    else if (item.kind === "finance") setTxEdit(item);
    else if (item.kind === "task") setSimpleEdit({ kind: "task", record: item.task });
    else if (item.kind === "goal") setSimpleEdit({ kind: "goal", record: item.goal });
    else setSimpleEdit({ kind: "note", record: item.note });
  }

  async function toggleTask(item: AgendaItem) {
    try {
      await setTaskDone(item.recordId, !item.done);
      await refresh(["tasks"]);
      toast.success(item.done ? "Tarefa reaberta." : "Tarefa concluída.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar.");
    }
  }

  async function pay(item: AgendaItem) {
    try {
      await setTransactionStatus(item.recordId, "PAID");
      await refresh(["transactions"]);
      toast.success("Pagamento registrado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar.");
    }
  }

  async function move(item: AgendaItem, date: string, minutes: number) {
    if (item.kind !== "event" || !item.event) return;
    if (item.recurring) {
      setScope("this");
      setPendingMove({ item, date, minutes });
      return;
    }
    try {
      await moveEventOccurrence(item.event, item.date, { date, minutes }, "all");
      await refresh(["events"]);
      toast.success("Evento movido.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível mover.");
    }
  }

  const handlers: ViewHandlers = {
    contexts,
    onOpen: openItem,
    onToggleTask: toggleTask,
    onPay: pay,
    onCreateAt: (date, minutes) => setEventCreate({ date, ...(minutes != null ? { minutes } : {}) }),
    onDayMenu: (date) => {
      setCursor(parseISO(date));
      setDayMenu(date);
    },
    onMove: move,
  };

  const step = (direction: number) => {
    if (view === "month") setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1));
    else if (view === "week") setCursor(addDays(cursor, 7 * direction));
    else setCursor(addDays(cursor, direction));
  };

  const periodLabel =
    view === "month"
      ? new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(cursor)
      : view === "week"
        ? `${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(startOfWeek(cursor))} – ${new Intl.DateTimeFormat(
            "pt-BR",
            { day: "2-digit", month: "short" },
          ).format(addDays(startOfWeek(cursor), 6))}`
        : new Intl.DateTimeFormat("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
          }).format(cursor);

  if (isLoading) return <LoadingState />;

  const counts = {
    events: today.filter((item) => item.kind === "event").length,
    tasks: today.filter((item) => item.kind === "task" && !item.done).length,
    payments: today.filter((item) => item.kind === "finance" && !item.done).length,
    goals: today.filter((item) => item.kind === "goal").length,
  };

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Agenda"
        subtitle="Veja o que está acontecendo com vocês."
        action={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <Plus className="size-4" /> Novo
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEventCreate({ date: isoOf(cursor) })}>
                Evento
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSimpleCreate("task")}>Tarefa</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSimpleCreate("note")}>Nota</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setTxCreate(true)}>Despesa</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSimpleCreate("goal")}>Meta</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <Panel className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl border border-border p-1">
            {VIEWS.map((entry) => (
              <button
                key={entry.value}
                type="button"
                onClick={() => changeView(entry.value)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm transition-colors",
                  view === entry.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>
              Hoje
            </Button>
            {view !== "list" ? (
              <>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => step(-1)}>
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="min-w-[130px] text-center text-sm capitalize">{periodLabel}</span>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => step(1)}>
                  <ChevronRight className="size-4" />
                </Button>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {KINDS.map((entry) => (
            <button
              key={entry.value}
              type="button"
              onClick={() => setKind(entry.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                kind === entry.value
                  ? "border-primary/50 bg-primary/15 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {entry.label}
            </button>
          ))}
          <Select value={contextFilter} onValueChange={setContextFilter}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue placeholder="Contexto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os contextos</SelectItem>
              {contexts.map((context) => (
                <SelectItem key={context.id} value={context.id}>
                  {contextEmoji(context.type)} {context.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2">
        <Panel>
          <PanelTitle>Hoje vocês têm</PanelTitle>
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="outline">{counts.events} eventos</Badge>
            <Badge variant="outline">{counts.tasks} tarefas</Badge>
            <Badge variant="outline">{counts.payments} pagamentos</Badge>
            <Badge variant="outline">{counts.goals} metas</Badge>
          </div>
        </Panel>
        <Panel>
          <PanelTitle>Leitura da agenda</PanelTitle>
          {insights.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tudo tranquilo por aqui.</p>
          ) : (
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {insights.map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Sparkles className="mt-0.5 size-3.5 text-primary" />
                  {line}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {view === "month" ? <MonthView cursor={cursor} items={periodItems} handlers={handlers} /> : null}
      {view === "week" ? <WeekView cursor={cursor} items={periodItems} handlers={handlers} /> : null}
      {view === "day" ? <DayView cursor={cursor} items={periodItems} handlers={handlers} /> : null}
      {view === "list" ? <ListView items={periodItems} handlers={handlers} /> : null}

      <Panel>
        <PanelTitle>Próximos 7 dias</PanelTitle>
        {next7.length === 0 ? (
          <p className="text-sm text-muted-foreground">Semana livre.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {next7.map((item) => (
              <AgendaRow
                key={`next-${item.key}`}
                item={item}
                contexts={contexts}
                onOpen={openItem}
                onToggleTask={toggleTask}
                onPay={pay}
              />
            ))}
          </div>
        )}
      </Panel>

      {/* diálogos */}
      <EventDialog
        open={!!eventCreate}
        onOpenChange={(open) => !open && setEventCreate(null)}
        {...(eventCreate?.date ? { defaultDate: eventCreate.date } : {})}
        {...(eventCreate?.minutes != null ? { defaultMinutes: eventCreate.minutes } : {})}
        {...(contextFilter !== "all" ? { defaultContextId: contextFilter } : {})}
      />
      <EventDialog
        open={!!eventEdit}
        onOpenChange={(open) => !open && setEventEdit(null)}
        event={eventEdit?.item.event ?? null}
        occurrenceDate={eventEdit?.item.date}
      />
      {simpleCreate ? (
        <SimpleRecordDialog
          kind={simpleCreate}
          open
          onOpenChange={(open) => !open && setSimpleCreate(null)}
        />
      ) : null}
      {simpleEdit ? (
        <SimpleRecordDialog
          kind={simpleEdit.kind}
          open
          onOpenChange={(open) => !open && setSimpleEdit(null)}
          record={simpleEdit.record as never}
        />
      ) : null}
      {txCreate ? (
        <TransactionDialog kind="expense" open onOpenChange={(open) => !open && setTxCreate(false)} />
      ) : null}
      {txEdit?.transaction ? (
        <TransactionDialog
          kind={txEdit.transaction.type === "INCOME" ? "income" : "expense"}
          open
          onOpenChange={(open) => !open && setTxEdit(null)}
          transaction={txEdit.transaction}
        />
      ) : null}

      {/* menu do dia (mês) */}
      <AlertDialog open={!!dayMenu} onOpenChange={(open) => !open && setDayMenu(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Criar neste dia</AlertDialogTitle>
            <AlertDialogDescription>
              Escolha o que vocês querem registrar em{" "}
              {dayMenu
                ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long" }).format(
                    parseISO(dayMenu),
                  )
                : ""}
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEventCreate({ date: dayMenu! });
                setDayMenu(null);
              }}
            >
              Novo evento
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSimpleCreate("task");
                setDayMenu(null);
              }}
            >
              Nova tarefa
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSimpleCreate("note");
                setDayMenu(null);
              }}
            >
              Nova nota
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setTxCreate(true);
                setDayMenu(null);
              }}
            >
              Nova despesa
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (dayMenu) setCursor(parseISO(dayMenu));
                changeView("day");
                setDayMenu(null);
              }}
            >
              Ver o dia
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* mover ocorrência de série */}
      <AlertDialog open={!!pendingMove} onOpenChange={(open) => !open && setPendingMove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Este evento se repete</AlertDialogTitle>
            <AlertDialogDescription>O que vocês querem mover?</AlertDialogDescription>
          </AlertDialogHeader>
          <Select value={scope} onValueChange={(value) => setScope(value as EventScope)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this">Somente este evento</SelectItem>
              <SelectItem value="future">Este e os próximos</SelectItem>
              <SelectItem value="all">Toda a série</SelectItem>
            </SelectContent>
          </Select>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (clickEvent) => {
                clickEvent.preventDefault();
                if (!pendingMove?.item.event) return;
                try {
                  await moveEventOccurrence(
                    pendingMove.item.event,
                    pendingMove.item.date,
                    { date: pendingMove.date, minutes: pendingMove.minutes },
                    scope,
                  );
                  await refresh(["events"]);
                  toast.success("Evento movido.");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Não foi possível mover.");
                } finally {
                  setPendingMove(null);
                }
              }}
            >
              Mover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir evento?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não poderá ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (clickEvent) => {
                clickEvent.preventDefault();
                if (!pendingDelete?.event) return;
                try {
                  await deleteEventOccurrence(pendingDelete.event, pendingDelete.date, scope);
                  await refresh(["events"]);
                  toast.success("Evento excluído.");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Não foi possível excluir.");
                } finally {
                  setPendingDelete(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export { KIND_LABEL };
