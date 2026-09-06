import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Heart, HeartHandshake, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel, PanelTitle } from "@/components/common/page";
import { StatCard } from "@/components/common/stat-card";
import { EmptyState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useTransactions } from "@/features/finance/queries";
import { inMonth } from "@/features/finance/calc";
import { useGoals } from "@/features/planner/queries";
import { contextEmoji, useContexts } from "@/features/contexts/queries";
import { useAgendaItems } from "@/features/agenda/queries";
import {
  divisionOf,
  groupBy,
  netBalance,
  usePayers,
  useSettlements,
  useSplits,
  type Settlement,
} from "@/features/nos/settlements";
import { markSettlementPaid } from "@/features/nos/mutations";
import { formatCurrency, formatDateShort } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/nos")({
  head: () => ({
    meta: [
      { title: "Nós — Life OS" },
      {
        name: "description",
        content: "Saldo entre vocês, acertos, despesas divididas e a vida em conjunto.",
      },
      { property: "og:title", content: "Nós — Life OS" },
      { property: "og:description", content: "O espaço compartilhado do Life OS." },
    ],
  }),
  component: Nos,
});

type Filter = "all" | "PENDING" | "SETTLED";

function Nos() {
  const { workspaceId, userId, memberProfiles, openQuickAction } = useApp();
  const queryClient = useQueryClient();
  const { data: transactions = [], isLoading } = useTransactions(workspaceId);
  const { data: settlements = [] } = useSettlements(workspaceId);
  const { data: splits = [] } = useSplits(workspaceId);
  const { data: payers = [] } = usePayers(workspaceId);
  const { data: goals = [] } = useGoals(workspaceId);
  const { data: contexts = [] } = useContexts(workspaceId);
  const { items: agenda } = useAgendaItems(workspaceId);

  const [filter, setFilter] = useState<Filter>("all");
  const [confirming, setConfirming] = useState<Settlement | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const nameOf = (id: string) =>
    id === userId
      ? "Você"
      : (memberProfiles.find((profile) => profile.id === id)?.name ??
        memberProfiles.find((profile) => profile.id === id)?.email ??
        "Parceiro(a)");

  const balance = netBalance(settlements, userId);
  const shared = useMemo(() => transactions.filter((t) => t.is_shared), [transactions]);
  const splitsByTx = useMemo(() => groupBy(splits, (row) => row.transaction_id), [splits]);
  const payersByTx = useMemo(() => groupBy(payers, (row) => row.transaction_id), [payers]);
  const txById = useMemo(() => new Map(transactions.map((t) => [t.id, t])), [transactions]);

  const sharedMonthTotal = shared
    .filter((t) => inMonth(t.transaction_date))
    .reduce((total, t) => total + Number(t.amount), 0);
  const settledMonth = settlements
    .filter(
      (item) =>
        item.status === "SETTLED" && item.settled_at && inMonth(item.settled_at.slice(0, 10)),
    )
    .reduce((total, item) => total + Number(item.amount), 0);

  const history = useMemo(
    () => settlements.filter((item) => (filter === "all" ? true : item.status === filter)),
    [settlements, filter],
  );

  const insights = useMemo(() => {
    const list: string[] = [];
    const transfer = balance.transfers[0];
    if (transfer)
      list.push(
        `${nameOf(transfer.fromUserId)} deve ${formatCurrency(transfer.amount)} para ${nameOf(
          transfer.toUserId,
        ).toLowerCase() === "você" ? "você" : nameOf(transfer.toUserId)}.`,
      );
    else list.push("Está tudo certo entre vocês.");
    if (balance.pending.length > 1)
      list.push(`Vocês têm ${balance.pending.length} acertos pendentes.`);
    if (sharedMonthTotal > 0)
      list.push(`Este mês vocês dividiram ${formatCurrency(sharedMonthTotal)} em despesas.`);
    if (settledMonth > 0)
      list.push(`Vocês já acertaram ${formatCurrency(settledMonth)} entre si este mês.`);
    return list;
  }, [balance, sharedMonthTotal, settledMonth, memberProfiles, userId]);

  const activity = useMemo(() => {
    const entries: { key: string; text: string; date: string }[] = [];
    for (const transaction of transactions.slice(0, 40)) {
      entries.push({
        key: `t-${transaction.id}`,
        date: transaction.created_at,
        text: `${nameOf(transaction.owner_id)} registrou ${
          transaction.type === "INCOME" ? "uma receita" : "uma despesa"
        } de ${formatCurrency(Number(transaction.amount))} · ${transaction.description}`,
      });
    }
    for (const settlement of settlements.slice(0, 20)) {
      entries.push({
        key: `s-${settlement.id}`,
        date: settlement.settled_at ?? settlement.created_at,
        text:
          settlement.status === "SETTLED"
            ? `${nameOf(settlement.from_user_id)} acertou ${formatCurrency(
                Number(settlement.amount),
              )} com ${nameOf(settlement.to_user_id)}`
            : `Acerto pendente de ${formatCurrency(Number(settlement.amount))} entre vocês`,
      });
    }
    return entries.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 10);
  }, [transactions, settlements, memberProfiles, userId]);

  const upcoming = agenda
    .filter((item) => item.kind === "event" && !item.done)
    .slice(0, 4);
  const activeContexts = contexts.filter((context) => context.status === "ACTIVE");
  const activeGoals = goals.filter((goal) => goal.status === "ACTIVE").slice(0, 4);

  async function confirmSettlement(settlement: Settlement) {
    try {
      await markSettlementPaid(settlement.id);
      await queryClient.invalidateQueries({ queryKey: ["settlements"] });
      toast.success(
        `✅ Acerto realizado. ${nameOf(settlement.from_user_id)} passou ${formatCurrency(
          Number(settlement.amount),
        )} para ${nameOf(settlement.to_user_id)}.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar o acerto.");
    } finally {
      setConfirming(null);
    }
  }

  if (isLoading) return <LoadingState />;

  const transfer = balance.transfers[0] ?? null;

  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        title="Nós"
        subtitle="O espaço da vida de vocês"
        action={
          <Button size="sm" onClick={() => openQuickAction("expense")}>
            Despesa compartilhada
          </Button>
        }
      />

      {/* saldo consolidado */}
      <section
        className={cn(
          "rounded-2xl border p-6",
          transfer ? "border-primary/40 bg-primary/10" : "border-border bg-surface",
        )}
      >
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {transfer ? (
            <Heart className="size-4 text-primary" />
          ) : (
            <HeartHandshake className="size-4 text-success" />
          )}
          Saldo entre vocês
        </div>
        {transfer ? (
          <>
            <p className="mt-3 text-sm text-muted-foreground">
              {nameOf(transfer.fromUserId)} → {nameOf(transfer.toUserId)}
            </p>
            <p className="numeric mt-1 text-3xl font-semibold">{formatCurrency(transfer.amount)}</p>
          </>
        ) : (
          <p className="mt-3 text-lg">💚 Tudo certo entre vocês. Nenhum acerto pendente.</p>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Você deve</p>
            <p className="numeric text-lg">{formatCurrency(balance.owedByMe)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Devem para você</p>
            <p className="numeric text-lg">{formatCurrency(balance.owedToMe)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Saldo líquido</p>
            <p
              className={cn(
                "numeric text-lg",
                balance.net > 0 ? "text-success" : balance.net < 0 ? "text-destructive" : "",
              )}
            >
              {formatCurrency(Math.abs(balance.net))}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Compartilhado no mês" value={sharedMonthTotal} />
        <StatCard label="Acertado no mês" value={settledMonth} tone="primary" />
      </div>

      <Panel>
        <PanelTitle>Leitura do Nós</PanelTitle>
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {insights.map((line) => (
            <li key={line} className="flex items-start gap-2">
              <Sparkles className="mt-0.5 size-3.5 text-primary" />
              {line}
            </li>
          ))}
        </ul>
      </Panel>

      {/* acertos pendentes */}
      <Panel>
        <PanelTitle>Acertos pendentes</PanelTitle>
        {balance.pending.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Nenhum acerto pendente.</p>
        ) : (
          <ul className="divide-y divide-border">
            {balance.pending.map((settlement) => {
              const source = settlement.transaction_id
                ? txById.get(settlement.transaction_id)
                : null;
              return (
                <li
                  key={settlement.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {nameOf(settlement.from_user_id)} → {nameOf(settlement.to_user_id)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {source?.description ?? settlement.note ?? "Acerto entre vocês"} ·{" "}
                      {formatDateShort(settlement.created_at.slice(0, 10))}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="numeric text-sm font-semibold">
                      {formatCurrency(Number(settlement.amount))}
                    </span>
                    <Button size="sm" onClick={() => setConfirming(settlement)}>
                      Marcar como pago
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* despesas divididas */}
      <Panel>
        <PanelTitle>Despesas divididas</PanelTitle>
        {shared.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="Nada dividido ainda"
            description="Marque uma despesa como “Dividir entre nós” para definir a divisão e quem pagou."
            action={
              <Button size="sm" variant="outline" onClick={() => openQuickAction("expense")}>
                Nova despesa
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {shared.slice(0, 20).map((transaction) => {
              const detail = divisionOf(
                transaction,
                splitsByTx.get(transaction.id) ?? [],
                payersByTx.get(transaction.id) ?? [],
              );
              const open = expanded === transaction.id;
              const linked = settlements.find(
                (item) => item.transaction_id === transaction.id && item.status === "PENDING",
              );
              return (
                <li key={transaction.id} className="py-3">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 text-left"
                    onClick={() => setExpanded(open ? null : transaction.id)}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{transaction.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateShort(transaction.transaction_date)} · Dividida entre nós
                      </p>
                    </div>
                    <span className="numeric shrink-0 text-sm">
                      {formatCurrency(Number(transaction.amount))}
                    </span>
                  </button>

                  {open ? (
                    <div className="mt-3 space-y-2 rounded-xl bg-elevated p-3 text-sm">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Divisão
                      </p>
                      {detail.shares.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Sem divisão detalhada registrada.
                        </p>
                      ) : (
                        detail.shares.map((share) => (
                          <p key={share.userId} className="flex justify-between">
                            <span className="text-muted-foreground">{nameOf(share.userId)}</span>
                            <span className="numeric">{formatCurrency(share.amount)}</span>
                          </p>
                        ))
                      )}
                      <p className="pt-2 text-xs uppercase tracking-wide text-muted-foreground">
                        Pagamento
                      </p>
                      {detail.payers.map((payer) => (
                        <p key={payer.userId} className="flex justify-between">
                          <span className="text-muted-foreground">
                            {nameOf(payer.userId)} pagou
                          </span>
                          <span className="numeric">{formatCurrency(payer.amount)}</span>
                        </p>
                      ))}
                      {detail.transfer ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/10 p-3">
                          <p className="text-sm">
                            💜 {nameOf(detail.transfer.fromUserId)} deve{" "}
                            <strong className="numeric">
                              {formatCurrency(detail.transfer.amount)}
                            </strong>{" "}
                            para {nameOf(detail.transfer.toUserId)}
                          </p>
                          {linked ? (
                            <Button size="sm" onClick={() => setConfirming(linked)}>
                              Marcar como pago
                            </Button>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Cada um pagou a própria parte — nenhum acerto necessário.
                        </p>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* histórico */}
      <Panel>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <PanelTitle>Histórico de acertos</PanelTitle>
          <div className="flex gap-2">
            {(
              [
                { value: "all", label: "Todos" },
                { value: "PENDING", label: "Pendentes" },
                { value: "SETTLED", label: "Pagos" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  filter === option.value
                    ? "border-primary/50 bg-primary/15 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        {history.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Nenhum acerto registrado.</p>
        ) : (
          <ul className="divide-y divide-border">
            {history.map((settlement) => {
              const source = settlement.transaction_id
                ? txById.get(settlement.transaction_id)
                : null;
              return (
                <li key={settlement.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {source?.description ?? settlement.note ?? "Acerto entre vocês"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {nameOf(settlement.from_user_id)} → {nameOf(settlement.to_user_id)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="numeric text-sm">
                      {formatCurrency(Number(settlement.amount))}
                    </span>
                    {settlement.status === "SETTLED" ? (
                      <Badge variant="outline" className="text-success">
                        Pago em{" "}
                        {settlement.settled_at
                          ? formatDateShort(settlement.settled_at.slice(0, 10))
                          : "—"}
                      </Badge>
                    ) : settlement.status === "PENDING" ? (
                      <Badge variant="outline">Pendente</Badge>
                    ) : (
                      <Badge variant="outline">Cancelado</Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* vida em conjunto */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelTitle>Atividade recente</PanelTitle>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nada por aqui ainda.</p>
          ) : (
            <ul className="space-y-2 text-sm text-muted-foreground">
              {activity.map((entry) => (
                <li key={entry.key} className="flex gap-2">
                  <span className="numeric shrink-0 text-xs">
                    {formatDateShort(entry.date.slice(0, 10))}
                  </span>
                  <span className="min-w-0">{entry.text}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelTitle>Metas em conjunto</PanelTitle>
            {activeGoals.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma meta ativa.</p>
            ) : (
              <ul className="divide-y divide-border">
                {activeGoals.map((goal) => (
                  <li key={goal.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <Link to="/metas/$id" params={{ id: goal.id }} className="truncate">
                      {goal.title}
                    </Link>
                    <span className="numeric shrink-0 text-xs text-muted-foreground">
                      {formatCurrency(Number(goal.current_amount))}
                      {goal.target_amount
                        ? ` / ${formatCurrency(Number(goal.target_amount))}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelTitle>Contextos ativos</PanelTitle>
            {activeContexts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum contexto ativo.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {activeContexts.map((context) => (
                  <Link
                    key={context.id}
                    to="/contextos/$id"
                    params={{ id: context.id }}
                    className="rounded-full border border-border px-3 py-1 text-xs hover:border-ring/50"
                  >
                    {contextEmoji(context.type)} {context.name}
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          <Panel>
            <PanelTitle>Próximos eventos</PanelTitle>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">Agenda livre.</p>
            ) : (
              <ul className="divide-y divide-border">
                {upcoming.map((item) => (
                  <li key={item.key} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="truncate">{item.title}</span>
                    <span className="numeric shrink-0 text-xs text-muted-foreground">
                      {formatDateShort(item.date)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <Panel>
        <PanelTitle>
          <span className="inline-flex items-center gap-2">
            <Users className="size-3.5" /> Pessoas
          </span>
        </PanelTitle>
        <ul className="divide-y divide-border">
          {memberProfiles.map((profile) => (
            <li key={profile.id} className="py-3 text-sm">
              {profile.name || profile.email}
              {profile.id === userId ? (
                <span className="ml-2 text-xs text-muted-foreground">(você)</span>
              ) : null}
            </li>
          ))}
        </ul>
      </Panel>

      <AlertDialog open={!!confirming} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar acerto</AlertDialogTitle>
            <AlertDialogDescription>
              {confirming
                ? `${nameOf(confirming.from_user_id)} passou ${formatCurrency(
                    Number(confirming.amount),
                  )} para ${nameOf(confirming.to_user_id)}?`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (confirming) void confirmSettlement(confirming);
              }}
            >
              Confirmar acerto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
