import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Wallet } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel, PanelTitle } from "@/components/common/page";
import { StatCard } from "@/components/common/stat-card";
import { EmptyState, LoadingState } from "@/components/common/states";
import { RecordActions } from "@/components/common/record-actions";
import { CreatedBy } from "@/components/common/created-by";
import { StatusBadge } from "@/components/finance/status-badge";
import { CardPanel } from "@/components/finance/card-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BudgetPanel, CashFlow, FinanceCalendar, FinanceSearch, ReportsPanel } from "@/components/finance/finance-overview";
import { FinanceCockpit } from "@/components/finance/finance-cockpit";

const SECTIONS = [
  { id: "visao", label: "Visão geral", subs: [{ value: "visao", label: "Visão geral" }] },
  { id: "movimentacoes", label: "Movimentações", subs: [
    { value: "lancamentos", label: "Lançamentos" },
    { value: "pagos", label: "Pagos" },
    { value: "calendario", label: "Calendário" },
  ] },
  { id: "compromissos", label: "Compromissos", subs: [
    { value: "pagar", label: "A pagar" },
    { value: "parcelas", label: "Parcelas" },
    { value: "recorrentes", label: "Recorrentes" },
    { value: "financiamentos", label: "Financiamentos" },
    { value: "emprestimos", label: "Empréstimos" },
  ] },
  { id: "planejamento", label: "Planejamento", subs: [
    { value: "orcamento", label: "Orçamento" },
    { value: "fluxo", label: "Projeção" },
    { value: "relatorios", label: "Relatórios" },
  ] },
  { id: "contas", label: "Contas e cartões", subs: [
    { value: "contas", label: "Contas" },
    { value: "cartoes", label: "Cartões" },
    { value: "categorias", label: "Categorias" },
  ] },
];
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TransactionDialog } from "@/components/quick/transaction-dialog";
import { FinanceEntityDialog } from "@/components/quick/finance-entity-dialog";
import { RecurringDialog } from "@/components/quick/recurring-dialog";
import { useApp } from "@/features/app/app-context";
import {
  useAccounts,
  useCards,
  useCategories,
  useTransactions,
  useInstallmentPlans,
  useLoans,
  useFinancings,
  useRecurring,
  useInvoicePayments,
  type Account,
  type Card as CardRecord,
  type Category,
  type Transaction,
  type Recurring,
} from "@/features/finance/queries";
import {
  deleteAccount,
  deleteCard,
  deleteCategory,
  deleteFinancing,
  deleteInstallmentPlan,
  deleteLoan,
  deleteRecurring,
  deleteTransaction,
  generateRecurringOccurrences,
  setTransactionStatus,
} from "@/features/finance/mutations";
import {
  accountBalance,
  cardInvoiceRange,
  dueDateOf,
  inMonth,
  isOpen,
  netWorth,
  statusOf,
  sumBy,
  todayISO,
  totalExpense,
  totalIncome,
  totalOverdue,
  totalPending,
} from "@/features/finance/calc";
import { PAYMENT_STATUSES } from "@/features/finance/constants";
import { useContexts, contextEmoji } from "@/features/contexts/queries";
import { formatCurrency, formatDateShort } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Life OS" },
      {
        name: "description",
        content:
          "Contas a pagar, parcelas, recorrências, empréstimos, financiamentos e cartões em um só lugar.",
      },
      { property: "og:title", content: "Financeiro — Life OS" },
      { property: "og:description", content: "Suas contas e lançamentos no Life OS." },
    ],
  }),
  component: Financeiro,
});

type EntityEdit =
  | { kind: "account"; record: Account | null }
  | { kind: "card"; record: CardRecord | null }
  | { kind: "category"; record: Category | null };

const ALL = "all";

function Financeiro() {
  const { workspaceId, userId, memberProfiles, openQuickAction } = useApp();
  const transactionsQuery = useTransactions(workspaceId);
  const accountsQuery = useAccounts(workspaceId);
  const cardsQuery = useCards(workspaceId);
  const categoriesQuery = useCategories(workspaceId);
  const plansQuery = useInstallmentPlans(workspaceId);
  const loansQuery = useLoans(workspaceId);
  const financingsQuery = useFinancings(workspaceId);
  const recurringQuery = useRecurring(workspaceId);
  const paymentsQuery = useInvoicePayments(workspaceId);
  const invoicePayments = useMemo(() => paymentsQuery.data ?? [], [paymentsQuery.data]);
  const paidMap = useMemo(() => paidByInvoice(invoicePayments), [invoicePayments]);
  const contextsQuery = useContexts(workspaceId);
  const queryClient = useQueryClient();

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [entity, setEntity] = useState<EntityEdit | null>(null);
  const [editingRecurring, setEditingRecurring] = useState<Recurring | null>(null);
  const [recurringOpen, setRecurringOpen] = useState(false);

  const [period, setPeriod] = useState("month");
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [sourceFilter, setSourceFilter] = useState(ALL);
  const [contextFilter, setContextFilter] = useState(ALL);
  const [originFilter, setOriginFilter] = useState(ALL);
  const [ownerFilter, setOwnerFilter] = useState(ALL);
  const [search, setSearch] = useState("");
  const [sub, setSub] = useState("visao");
  const section = SECTIONS.find((sec) => sec.subs.some((item) => item.value === sub)) ?? SECTIONS[0]!;

  const transactions = transactionsQuery.data ?? [];
  const accounts = accountsQuery.data ?? [];
  const cards = cardsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const plans = plansQuery.data ?? [];
  const loans = loansQuery.data ?? [];
  const financings = financingsQuery.data ?? [];
  const recurrences = recurringQuery.data ?? [];
  const contexts = contextsQuery.data ?? [];
  const today = todayISO();

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (period === "month" && !inMonth(t.transaction_date)) return false;
      if (period === "open" && !isOpen(t)) return false;
      if (typeFilter !== ALL && t.type !== typeFilter) return false;
      if (statusFilter !== ALL && statusOf(t) !== statusFilter) return false;
      if (categoryFilter !== ALL && t.category_id !== categoryFilter) return false;
      if (sourceFilter !== ALL) {
        const [kind, id] = sourceFilter.split(":");
        if (kind === "account" && t.account_id !== id) return false;
        if (kind === "card" && t.card_id !== id) return false;
      }
      if (contextFilter !== ALL && t.context_id !== contextFilter) return false;
      if (originFilter === "installment" && !t.installment_plan_id) return false;
      if (originFilter === "recurring" && !t.recurring_id) return false;
      if (originFilter === "loan" && !t.loan_id) return false;
      if (originFilter === "financing" && !t.financing_id) return false;
      if (originFilter === "single" && (t.installment_plan_id || t.recurring_id || t.loan_id || t.financing_id))
        return false;
      if (ownerFilter !== ALL && t.owner_id !== ownerFilter) return false;
      if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [
    transactions,
    period,
    typeFilter,
    statusFilter,
    categoryFilter,
    sourceFilter,
    contextFilter,
    originFilter,
    ownerFilter,
    search,
  ]);

  if (transactionsQuery.isLoading || accountsQuery.isLoading) return <LoadingState />;

  const monthly = transactions.filter((t) => inMonth(t.transaction_date));
  const payables = transactions
    .filter((t) => t.type === "EXPENSE" && isOpen(t))
    .sort((a, b) => dueDateOf(a).localeCompare(dueDateOf(b)));
  const overdue = payables.filter((t) => dueDateOf(t) < today);
  const dueToday = payables.filter((t) => dueDateOf(t) === today);
  const upcoming = payables.filter((t) => dueDateOf(t) > today);
  const paid = transactions
    .filter((t) => t.status === "PAID" && t.type !== "TRANSFER")
    .sort((a, b) => (b.paid_at ?? b.transaction_date).localeCompare(a.paid_at ?? a.transaction_date));

  const categoryName = (id: string | null) =>
    categories.find((category) => category.id === id)?.name ?? "Sem categoria";
  const sourceName = (t: Transaction) =>
    accounts.find((a) => a.id === t.account_id)?.name ??
    cards.find((c) => c.id === t.card_id)?.name ??
    "—";

  async function run(action: () => Promise<unknown>, keys: string[], message: string) {
    try {
      await action();
      for (const key of keys) await queryClient.invalidateQueries({ queryKey: [key] });
      toast.success(message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível concluir.");
    }
  }

  const markPaid = (id: string) =>
    run(() => setTransactionStatus(id, "PAID"), ["transactions"], "Marcado como pago.");
  const markPending = (id: string) =>
    run(() => setTransactionStatus(id, "PENDING", null), ["transactions"], "Voltou para pendente.");

  function TransactionRow({ transaction }: { transaction: Transaction }) {
    const status = statusOf(transaction);
    return (
      <li className="flex items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{transaction.description}</p>
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {formatDateShort(dueDateOf(transaction))} · {categoryName(transaction.category_id)}
            <CreatedBy userId={transaction.owner_id} />
            <StatusBadge status={status} />
            {transaction.is_shared ? <Badge variant="outline" className="border-primary/40 text-primary">Dividida entre nós</Badge> : null}
            {transaction.is_demo ? <Badge variant="secondary">Demo</Badge> : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {status !== "PAID" && transaction.status !== "CANCELLED" ? (
            <Button size="sm" variant="outline" onClick={() => markPaid(transaction.id)}>
              <Check className="size-4" />
              <span className="hidden sm:inline">Pagar</span>
            </Button>
          ) : null}
          <span
            className={
              transaction.type === "INCOME" ? "numeric text-sm text-success" : "numeric text-sm"
            }
          >
            {transaction.type === "EXPENSE" ? "−" : ""}
            {formatCurrency(Number(transaction.amount))}
          </span>
          <RecordActions
            onEdit={() => setEditingTransaction(transaction)}
            onDelete={() =>
              run(
                () => deleteTransaction(transaction.id, workspaceId ?? ""),
                ["transactions"],
                "Lançamento excluído.",
              )
            }
            confirmTitle="Excluir este lançamento?"
            confirmDescription={
              transaction.is_shared
                ? "A divisão entre vocês e o acerto pendente ligado a esta despesa também serão removidos."
                : "Divisões vinculadas também serão removidas."
            }

          />
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Financeiro"
        subtitle="Como está o dinheiro de vocês?"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => openQuickAction("income")}>
              Receita
            </Button>
            <Button variant="outline" size="sm" onClick={() => openQuickAction("installment")}>
              Parcelada
            </Button>
            <Button size="sm" onClick={() => openQuickAction("expense")}>
              Despesa
            </Button>
          </div>
        }
      />

      <nav aria-label="Áreas do Financeiro" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {SECTIONS.map((sec) => (
          <button
            key={sec.id}
            type="button"
            onClick={() => setSub(sec.subs[0]!.value)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm transition-colors ${section.id === sec.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-elevated hover:text-foreground"}`}
          >
            {sec.label}
          </button>
        ))}
      </nav>

      <Tabs value={sub} onValueChange={setSub}>
        {section.subs.length > 1 ? (
          <TabsList className="flex h-auto w-full flex-wrap justify-start">
            {section.subs.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>{item.label}</TabsTrigger>
            ))}
          </TabsList>
        ) : null}
        {section.id === "movimentacoes" ? <div className="pt-4"><FinanceSearch transactions={transactions} categories={categories} /></div> : null}

        <TabsContent value="visao" className="pt-2">
          <FinanceCockpit accounts={accounts} transactions={transactions} categories={categories} recurrences={recurrences} payments={invoicePayments} onNavigate={setSub} />
        </TabsContent>
        <TabsContent value="relatorios" className="pt-6">
          <ReportsPanel transactions={transactions} categories={categories} accounts={accounts} memberName={(id) => memberProfiles.find((m) => m.id === id)?.name || (id === userId ? "Você" : "Membro")} />
        </TabsContent>
        <TabsContent value="calendario" className="pt-6">
          <FinanceCalendar transactions={transactions} />
        </TabsContent>
        <TabsContent value="fluxo" className="pt-6">
          <CashFlow transactions={transactions} accounts={accounts} />
        </TabsContent>
        <TabsContent value="orcamento" className="pt-6">
          {workspaceId ? <BudgetPanel transactions={transactions} categories={categories} workspaceId={workspaceId} /> : null}
        </TabsContent>

        {/* ------------------------------------------------------- a pagar */}
        <TabsContent value="pagar" className="space-y-4 pt-6">
          {payables.length === 0 ? (
            <Panel>
              <EmptyState
                icon={Wallet}
                title="Nada a pagar"
                description="Nenhuma despesa pendente por aqui."
              />
            </Panel>
          ) : (
            <>
              {overdue.length ? (
                <Panel>
                  <PanelTitle>⚠ Atrasadas</PanelTitle>
                  <ul className="divide-y divide-border">
                    {overdue.map((t) => (
                      <TransactionRow key={t.id} transaction={t} />
                    ))}
                  </ul>
                </Panel>
              ) : null}
              {dueToday.length ? (
                <Panel>
                  <PanelTitle>Vencem hoje</PanelTitle>
                  <ul className="divide-y divide-border">
                    {dueToday.map((t) => (
                      <TransactionRow key={t.id} transaction={t} />
                    ))}
                  </ul>
                </Panel>
              ) : null}
              {upcoming.length ? (
                <Panel>
                  <PanelTitle>Próximos vencimentos</PanelTitle>
                  <ul className="divide-y divide-border">
                    {upcoming.slice(0, 40).map((t) => (
                      <TransactionRow key={t.id} transaction={t} />
                    ))}
                  </ul>
                </Panel>
              ) : null}
              <Panel className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Total a pagar
                </p>
                <p className="numeric text-xl font-semibold">
                  {formatCurrency(sumBy(payables, (t) => Number(t.amount)))}
                </p>
              </Panel>
            </>
          )}
        </TabsContent>

        {/* --------------------------------------------------------- pagos */}
        <TabsContent value="pagos" className="pt-6">
          <Panel>
            <PanelTitle>Pagos</PanelTitle>
            {paid.length === 0 ? (
              <EmptyState title="Nada pago ainda" description="Marque uma conta como paga." />
            ) : (
              <ul className="divide-y divide-border">
                {paid.slice(0, 60).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">✓ {t.description}</p>
                      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {formatDateShort(t.paid_at ?? t.transaction_date)} ·{" "}
                        {categoryName(t.category_id)} · {sourceName(t)}
                        <CreatedBy userId={t.owner_id} />
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={
                          t.type === "INCOME" ? "numeric text-sm text-success" : "numeric text-sm"
                        }
                      >
                        {formatCurrency(Number(t.amount))}
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => markPending(t.id)}>
                        Desfazer
                      </Button>
                      <RecordActions
                        onEdit={() => setEditingTransaction(t)}
                        onDelete={() =>
                          run(
                            () => deleteTransaction(t.id, workspaceId ?? ""),
                            ["transactions", "settlements"],
                            "Lançamento excluído.",
                          )
                        }
                        confirmTitle={
                          t.type === "INCOME" ? "Excluir esta receita?" : "Excluir esta despesa?"
                        }
                        confirmDescription="Essa ação não poderá ser desfeita."
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>

        {/* --------------------------------------------------- lançamentos */}
        <TabsContent value="lancamentos" className="space-y-4 pt-6">
          <Panel>
            <PanelTitle>Filtros</PanelTitle>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">Período</Label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Mês atual</SelectItem>
                    <SelectItem value="open">Em aberto</SelectItem>
                    <SelectItem value="all">Tudo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos</SelectItem>
                    <SelectItem value="EXPENSE">Despesa</SelectItem>
                    <SelectItem value="INCOME">Receita</SelectItem>
                    <SelectItem value="TRANSFER">Transferência</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Situação</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todas</SelectItem>
                    {PAYMENT_STATUSES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Categoria</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todas</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Conta / cartão</Label>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={`account:${account.id}`}>
                        {account.name}
                      </SelectItem>
                    ))}
                    {cards.map((card) => (
                      <SelectItem key={card.id} value={`card:${card.id}`}>
                        {card.name} (cartão)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Contexto</Label>
                <Select value={contextFilter} onValueChange={setContextFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos</SelectItem>
                    {contexts.map((context) => (
                      <SelectItem key={context.id} value={context.id}>
                        {contextEmoji(context.type)} {context.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Origem</Label>
                <Select value={originFilter} onValueChange={setOriginFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todas</SelectItem>
                    <SelectItem value="single">Avulsos</SelectItem>
                    <SelectItem value="installment">Parcelados</SelectItem>
                    <SelectItem value="recurring">Recorrentes</SelectItem>
                    <SelectItem value="loan">Empréstimos</SelectItem>
                    <SelectItem value="financing">Financiamentos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pessoa</Label>
                <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todos</SelectItem>
                    {memberProfiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name || profile.email || "Membro"}
                        {profile.id === userId ? " (você)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Busca</Label>
                <Input
                  placeholder="Descrição"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelTitle>
              {filtered.length} lançamento{filtered.length === 1 ? "" : "s"}
            </PanelTitle>
            {filtered.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="Nenhum lançamento"
                description="Ajuste os filtros ou registre um novo lançamento."
                action={
                  <Button size="sm" onClick={() => openQuickAction("expense")}>
                    Nova despesa
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {filtered.slice(0, 200).map((t) => (
                  <TransactionRow key={t.id} transaction={t} />
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>

        {/* ---------------------------------------------------- parcelas */}
        <TabsContent value="parcelas" className="space-y-4 pt-6">
          <Panel>
            <PanelTitle
              action={
                <Button variant="ghost" size="sm" onClick={() => openQuickAction("installment")}>
                  Nova
                </Button>
              }
            >
              Compras parceladas
            </PanelTitle>
            {plans.length === 0 ? (
              <EmptyState
                title="Nenhum parcelamento"
                description="Registre uma compra dividida em parcelas."
              />
            ) : (
              <div className="space-y-6">
                {plans.map((plan) => {
                  const items = transactions
                    .filter((t) => t.installment_plan_id === plan.id)
                    .sort((a, b) => (a.installment_number ?? 0) - (b.installment_number ?? 0));
                  const paidCount = items.filter((t) => t.status === "PAID").length;
                  return (
                    <div key={plan.id} className="rounded-xl border border-border p-4">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{plan.description}</p>
                          <p className="numeric text-xs text-muted-foreground">
                            {formatCurrency(Number(plan.total_amount))} · {plan.total_installments}x{" "}
                            {formatCurrency(Number(plan.installment_amount))} · {paidCount} pagas
                          </p>
                        </div>
                        <RecordActions
                          onDelete={() =>
                            run(
                              () => deleteInstallmentPlan(plan.id),
                              ["installment_plans", "transactions"],
                              "Parcelamento excluído.",
                            )
                          }
                          confirmTitle="Excluir este parcelamento?"
                          confirmDescription="Todas as parcelas, inclusive as pagas, serão removidas."
                        />
                      </div>
                      <ul className="divide-y divide-border">
                        {items.map((item) => (
                          <li
                            key={item.id}
                            className="flex items-center justify-between gap-3 py-2 text-sm"
                          >
                            <span className="numeric text-muted-foreground">
                              {item.installment_number}/{plan.total_installments} ·{" "}
                              {formatDateShort(dueDateOf(item))}
                            </span>
                            <span className="flex items-center gap-2">
                              <span className="numeric">{formatCurrency(Number(item.amount))}</span>
                              <StatusBadge status={statusOf(item)} />
                              {item.status === "PAID" ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => markPending(item.id)}
                                >
                                  Desfazer
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => markPaid(item.id)}
                                >
                                  Pagar
                                </Button>
                              )}
                            </span>
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

        {/* -------------------------------------------------- recorrentes */}
        <TabsContent value="recorrentes" className="pt-6">
          <Panel>
            <PanelTitle
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingRecurring(null);
                    setRecurringOpen(true);
                  }}
                >
                  Nova
                </Button>
              }
            >
              Despesas fixas e recorrentes
            </PanelTitle>
            {recurrences.length === 0 ? (
              <EmptyState
                title="Nenhuma recorrência"
                description="Cadastre internet, streaming, academia e outras despesas fixas."
              />
            ) : (
              <ul className="divide-y divide-border">
                {recurrences.map((item) => {
                  const generated = transactions.filter((t) => t.recurring_id === item.id).length;
                  return (
                    <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.frequency === "MONTHLY" ? "Mensal" : item.frequency}
                          {item.due_day ? ` · dia ${item.due_day}` : ""} · {generated} ocorrências
                          {item.is_active ? "" : " · inativa"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="numeric text-sm">
                          {formatCurrency(Number(item.amount))}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            run(
                              async () => {
                                const created = await generateRecurringOccurrences(
                                  item,
                                  userId ?? item.owner_id,
                                );
                                if (!created) throw new Error("Nada novo para gerar.");
                              },
                              ["transactions", "recurring_transactions"],
                              "Ocorrências geradas.",
                            )
                          }
                        >
                          Gerar
                        </Button>
                        <RecordActions
                          onEdit={() => {
                            setEditingRecurring(item);
                            setRecurringOpen(true);
                          }}
                          onDelete={() =>
                            run(
                              () => deleteRecurring(item.id),
                              ["recurring_transactions"],
                              "Recorrência excluída.",
                            )
                          }
                          confirmTitle="Excluir esta recorrência?"
                          confirmDescription="Os lançamentos já gerados continuam existindo."
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </TabsContent>

        {/* -------------------------------------------------- empréstimos */}
        <TabsContent value="emprestimos" className="pt-6">
          <Panel>
            <PanelTitle
              action={
                <Button variant="ghost" size="sm" onClick={() => openQuickAction("loan")}>
                  Novo
                </Button>
              }
            >
              Empréstimos
            </PanelTitle>
            {loans.length === 0 ? (
              <EmptyState
                title="Nenhum empréstimo"
                description="Registre valores emprestados ou tomados."
              />
            ) : (
              <div className="space-y-6">
                {loans.map((loan) => {
                  const items = transactions
                    .filter((t) => t.loan_id === loan.id)
                    .sort((a, b) => (a.installment_number ?? 0) - (b.installment_number ?? 0));
                  const settledValue = sumBy(
                    items.filter((t) => t.status === "PAID"),
                    (t) => Number(t.amount),
                  );
                  const total = Number(loan.total_amount);
                  return (
                    <div key={loan.id} className="rounded-xl border border-border p-4">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">
                            {loan.type === "LENT" ? "Emprestado para" : "Peguei com"}{" "}
                            {loan.person_name}
                          </p>
                          <p className="numeric text-xs text-muted-foreground">
                            {formatCurrency(total)} · {loan.total_installments}x{" "}
                            {formatCurrency(Number(loan.installment_amount))}
                          </p>
                        </div>
                        <RecordActions
                          onDelete={() =>
                            run(
                              () => deleteLoan(loan.id),
                              ["loans", "transactions"],
                              "Empréstimo excluído.",
                            )
                          }
                          confirmTitle="Excluir este empréstimo?"
                          confirmDescription="As parcelas vinculadas também serão removidas."
                        />
                      </div>
                      <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-lg bg-elevated p-2">
                          <p className="text-muted-foreground">Total</p>
                          <p className="numeric text-sm">{formatCurrency(total)}</p>
                        </div>
                        <div className="rounded-lg bg-elevated p-2">
                          <p className="text-muted-foreground">
                            {loan.type === "LENT" ? "Recebido" : "Pago"}
                          </p>
                          <p className="numeric text-sm text-success">
                            {formatCurrency(settledValue)}
                          </p>
                        </div>
                        <div className="rounded-lg bg-elevated p-2">
                          <p className="text-muted-foreground">Pendente</p>
                          <p className="numeric text-sm">{formatCurrency(total - settledValue)}</p>
                        </div>
                      </div>
                      <ul className="divide-y divide-border">
                        {items.map((item) => (
                          <li
                            key={item.id}
                            className="flex items-center justify-between gap-3 py-2 text-sm"
                          >
                            <span className="numeric text-muted-foreground">
                              {item.installment_number}/{loan.total_installments} ·{" "}
                              {formatDateShort(dueDateOf(item))}
                            </span>
                            <span className="flex items-center gap-2">
                              <span className="numeric">{formatCurrency(Number(item.amount))}</span>
                              {item.status === "PAID" ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => markPending(item.id)}
                                >
                                  Desfazer
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => markPaid(item.id)}
                                >
                                  {loan.type === "LENT" ? "Recebi" : "Paguei"}
                                </Button>
                              )}
                            </span>
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

        {/* ----------------------------------------------- financiamentos */}
        <TabsContent value="financiamentos" className="pt-6">
          <Panel>
            <PanelTitle
              action={
                <Button variant="ghost" size="sm" onClick={() => openQuickAction("financing")}>
                  Novo
                </Button>
              }
            >
              Financiamentos
            </PanelTitle>
            {financings.length === 0 ? (
              <EmptyState
                title="Nenhum financiamento"
                description="Cadastre carro, imóvel ou equipamento."
              />
            ) : (
              <div className="space-y-6">
                {financings.map((financing) => {
                  const items = transactions
                    .filter((t) => t.financing_id === financing.id)
                    .sort((a, b) => (a.installment_number ?? 0) - (b.installment_number ?? 0));
                  const paidItems = items.filter((t) => t.status === "PAID");
                  const paidValue = sumBy(paidItems, (t) => Number(t.amount));
                  const pendingValue = sumBy(
                    items.filter((t) => t.status !== "PAID"),
                    (t) => Number(t.amount),
                  );
                  const next = items.find((t) => t.status !== "PAID");
                  return (
                    <div key={financing.id} className="rounded-xl border border-border p-4">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{financing.name}</p>
                          <p className="numeric text-xs text-muted-foreground">
                            {formatCurrency(Number(financing.financed_amount))} ·{" "}
                            {financing.total_installments} parcelas de{" "}
                            {formatCurrency(Number(financing.installment_amount))}
                          </p>
                        </div>
                        <RecordActions
                          onDelete={() =>
                            run(
                              () => deleteFinancing(financing.id),
                              ["financings", "transactions"],
                              "Financiamento excluído.",
                            )
                          }
                          confirmTitle="Excluir este financiamento?"
                          confirmDescription="As parcelas vinculadas também serão removidas."
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
                        <div className="rounded-lg bg-elevated p-2">
                          <p className="text-muted-foreground">Pagas</p>
                          <p className="numeric text-sm">{paidItems.length}</p>
                        </div>
                        <div className="rounded-lg bg-elevated p-2">
                          <p className="text-muted-foreground">Restantes</p>
                          <p className="numeric text-sm">{items.length - paidItems.length}</p>
                        </div>
                        <div className="rounded-lg bg-elevated p-2">
                          <p className="text-muted-foreground">Pago</p>
                          <p className="numeric text-sm text-success">
                            {formatCurrency(paidValue)}
                          </p>
                        </div>
                        <div className="rounded-lg bg-elevated p-2">
                          <p className="text-muted-foreground">Pendente</p>
                          <p className="numeric text-sm">{formatCurrency(pendingValue)}</p>
                        </div>
                      </div>
                      {next ? (
                        <div className="mt-3 flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            Próxima: {next.installment_number}/{financing.total_installments} ·{" "}
                            {formatDateShort(dueDateOf(next))}
                          </span>
                          <Button size="sm" variant="outline" onClick={() => markPaid(next.id)}>
                            Pagar {formatCurrency(Number(next.amount))}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </TabsContent>

        {/* ---------------------------------------------------------- contas */}
        <TabsContent value="contas" className="pt-6">
          <Panel>
            <PanelTitle
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEntity({ kind: "account", record: null })}
                >
                  Nova conta
                </Button>
              }
            >
              Contas
            </PanelTitle>
            {accounts.length === 0 ? (
              <EmptyState
                title="Nenhuma conta cadastrada"
                description="Adicione uma conta para acompanhar o saldo."
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEntity({ kind: "account", record: null })}
                  >
                    Nova conta
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {accounts.map((account) => (
                  <li key={account.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{account.name}</p>
                      <p className="text-xs text-muted-foreground">{account.institution ?? "—"}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="numeric text-sm">
                        {formatCurrency(accountBalance(account, transactions))}
                      </span>
                      <RecordActions
                        onEdit={() => setEntity({ kind: "account", record: account })}
                        onDelete={() =>
                          run(() => deleteAccount(account.id), ["accounts"], "Conta excluída.")
                        }
                        confirmTitle="Excluir esta conta?"
                        confirmDescription="Lançamentos vinculados continuam existindo, mas ficam sem conta."
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>

        {/* -------------------------------------------------------- cartões */}
        <TabsContent value="cartoes" className="space-y-4 pt-6">
          <Panel>
            <PanelTitle
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEntity({ kind: "card", record: null })}
                >
                  Novo cartão
                </Button>
              }
            >
              Cartões e faturas
            </PanelTitle>
            {cards.length === 0 ? (
              <EmptyState
                title="Nenhum cartão"
                description="Cadastre um cartão para acompanhar a fatura."
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEntity({ kind: "card", record: null })}
                  >
                    Novo cartão
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {cards.map((card) => (
                  <CardPanel
                    key={card.id}
                    card={card}
                    transactions={transactions.filter((t) => t.card_id === card.id)}
                    plans={plans}
                    categoryName={categoryName}
                    contextLabel={(id) => {
                      const context = contexts.find((item) => item.id === id);
                      return context ? `${contextEmoji(context.type)} ${context.name}` : null;
                    }}
                    paymentAccountName={
                      accounts.find((a) => a.id === card.payment_account_id)?.name ?? null
                    }
                    onEdit={() => setEntity({ kind: "card", record: card })}
                    onDelete={() =>
                      run(() => deleteCard(card.id), ["cards"], "Cartão excluído.")
                    }
                    onPayInvoice={(items) =>
                      run(
                        async () => {
                          for (const item of items) await setTransactionStatus(item.id, "PAID");
                        },
                        ["transactions"],
                        "Fatura paga.",
                      )
                    }
                    paidFor={(due) => paidMap.get(invoiceKey(card.id, due)) ?? 0}
                    onPartialPay={(amount, due) =>
                      run(
                        async () => {
                          const { error } = await supabase
                            .from("card_invoice_payments")
                            .insert({ workspace_id: workspaceId!, card_id: card.id, due_date: due, amount });
                          if (error) throw error;
                        },
                        ["card_invoice_payments"],
                        "Pagamento parcial registrado.",
                      )
                    }
                  />
                ))}
              </div>
            )}
          </Panel>
        </TabsContent>

        {/* ----------------------------------------------------- categorias */}
        <TabsContent value="categorias" className="pt-6">
          <Panel>
            <PanelTitle
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEntity({ kind: "category", record: null })}
                >
                  Nova categoria
                </Button>
              }
            >
              Categorias
            </PanelTitle>
            <ul className="divide-y divide-border">
              {categories.map((category) => (
                <li key={category.id} className="flex items-center justify-between gap-3 py-3">
                  <p className="text-sm font-medium">{category.name}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{category.type}</Badge>
                    <RecordActions
                      onEdit={() => setEntity({ kind: "category", record: category })}
                      onDelete={() =>
                        run(
                          () => deleteCategory(category.id),
                          ["categories"],
                          "Categoria excluída.",
                        )
                      }
                      confirmTitle="Excluir esta categoria?"
                      confirmDescription="Lançamentos vinculados ficam sem categoria."
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </TabsContent>
      </Tabs>

      {editingTransaction ? (
        <TransactionDialog
          kind={editingTransaction.type === "INCOME" ? "income" : "expense"}
          transaction={editingTransaction}
          open
          onOpenChange={(open) => {
            if (!open) setEditingTransaction(null);
          }}
        />
      ) : null}

      {entity ? (
        <FinanceEntityDialog
          kind={entity.kind}
          record={entity.record as never}
          open
          onOpenChange={(open) => {
            if (!open) setEntity(null);
          }}
        />
      ) : null}

      <RecurringDialog
        open={recurringOpen}
        onOpenChange={(open) => {
          setRecurringOpen(open);
          if (!open) setEditingRecurring(null);
        }}
        record={editingRecurring}
      />
    </div>
  );
}
