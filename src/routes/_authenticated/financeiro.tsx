import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel, PanelTitle } from "@/components/common/page";
import { StatCard } from "@/components/common/stat-card";
import { EmptyState, LoadingState } from "@/components/common/states";
import { RecordActions } from "@/components/common/record-actions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TransactionDialog } from "@/components/quick/transaction-dialog";
import { FinanceEntityDialog } from "@/components/quick/finance-entity-dialog";
import { useApp } from "@/features/app/app-context";
import {
  useAccounts,
  useCards,
  useCategories,
  useTransactions,
  type Account,
  type Card as CardRecord,
  type Category,
  type Transaction,
} from "@/features/finance/queries";
import {
  deleteAccount,
  deleteCard,
  deleteCategory,
  deleteTransaction,
} from "@/features/finance/mutations";
import {
  accountBalance,
  inMonth,
  netWorth,
  totalExpense,
  totalIncome,
} from "@/features/finance/calc";
import { formatCurrency, formatDateShort } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Life OS" },
      {
        name: "description",
        content: "Contas, cartões, categorias e lançamentos pessoais e compartilhados.",
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

function Financeiro() {
  const { workspaceId, userId, openQuickAction } = useApp();
  const transactionsQuery = useTransactions(workspaceId);
  const accountsQuery = useAccounts(workspaceId);
  const cardsQuery = useCards(workspaceId);
  const categoriesQuery = useCategories(workspaceId);
  const queryClient = useQueryClient();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [entity, setEntity] = useState<EntityEdit | null>(null);

  if (transactionsQuery.isLoading || accountsQuery.isLoading) return <LoadingState />;

  const transactions = transactionsQuery.data ?? [];
  const accounts = accountsQuery.data ?? [];
  const cards = cardsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const monthly = transactions.filter((t) => inMonth(t.transaction_date));
  const categoryName = (id: string | null) =>
    categories.find((category) => category.id === id)?.name ?? "Sem categoria";

  async function run(action: () => Promise<unknown>, keys: string[], message: string) {
    try {
      await action();
      for (const key of keys) await queryClient.invalidateQueries({ queryKey: [key] });
      toast.success(message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir.");
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Financeiro"
        subtitle="Contas, cartões e lançamentos"
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => openQuickAction("income")}>
              Receita
            </Button>
            <Button size="sm" onClick={() => openQuickAction("expense")}>
              Despesa
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Patrimônio" value={netWorth(accounts, transactions)} />
        <StatCard label="Receitas do mês" value={totalIncome(monthly)} tone="success" />
        <StatCard label="Despesas do mês" value={totalExpense(monthly)} tone="destructive" />
      </div>

      <Tabs defaultValue="lancamentos">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
          <TabsTrigger value="contas">Contas</TabsTrigger>
          <TabsTrigger value="cartoes">Cartões</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
        </TabsList>

        <TabsContent value="lancamentos" className="pt-6">
          <Panel>
            <PanelTitle>Todos os lançamentos</PanelTitle>
            {transactions.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="Nenhum lançamento"
                description="Registre uma despesa ou receita para começar."
                action={
                  <Button size="sm" onClick={() => openQuickAction("expense")}>
                    Nova despesa
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {transactions.map((transaction) => (
                  <li key={transaction.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{transaction.description}</p>
                      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {formatDateShort(transaction.transaction_date)} ·{" "}
                        {categoryName(transaction.category_id)}
                        {transaction.is_shared ? (
                          <Badge variant="outline">Compartilhado</Badge>
                        ) : null}
                        {transaction.is_demo ? <Badge variant="secondary">Demo</Badge> : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
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
                      <RecordActions
                        canManage={transaction.owner_id === userId}
                        onEdit={() => setEditingTransaction(transaction)}
                        onDelete={() =>
                          run(
                            () => deleteTransaction(transaction.id),
                            ["transactions"],
                            "Lançamento excluído.",
                          )
                        }
                        confirmTitle="Excluir este lançamento?"
                        confirmDescription="Divisões e parcelas vinculadas também serão removidas."
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>

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
                        canManage={account.owner_id === userId}
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

        <TabsContent value="cartoes" className="pt-6">
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
              Cartões
            </PanelTitle>
            {cards.length === 0 ? (
              <EmptyState
                title="Nenhum cartão cadastrado"
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
              <ul className="divide-y divide-border">
                {cards.map((card) => (
                  <li key={card.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{card.name}</p>
                      <p className="text-xs text-muted-foreground">{card.institution ?? "—"}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="numeric text-sm text-muted-foreground">
                        Limite {formatCurrency(Number(card.credit_limit ?? 0))}
                      </span>
                      <RecordActions
                        canManage={card.owner_id === userId}
                        onEdit={() => setEntity({ kind: "card", record: card })}
                        onDelete={() => run(() => deleteCard(card.id), ["cards"], "Cartão excluído.")}
                        confirmTitle="Excluir este cartão?"
                        confirmDescription="Lançamentos vinculados continuam existindo, mas ficam sem cartão."
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>

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
                  <p className="truncate text-sm">{category.name}</p>
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
                </li>
              ))}
            </ul>
          </Panel>
        </TabsContent>
      </Tabs>

      {editingTransaction ? (
        <TransactionDialog
          kind={editingTransaction.type === "INCOME" ? "income" : "expense"}
          open
          onOpenChange={(open) => {
            if (!open) setEditingTransaction(null);
          }}
          transaction={editingTransaction}
        />
      ) : null}

      {entity ? (
        <FinanceEntityDialog
          kind={entity.kind}
          open
          onOpenChange={(open) => {
            if (!open) setEntity(null);
          }}
          record={entity.record}
        />
      ) : null}
    </div>
  );
}
