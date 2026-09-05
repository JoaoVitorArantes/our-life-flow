import { createFileRoute } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import { PageHeader, Panel, PanelTitle } from "@/components/common/page";
import { StatCard } from "@/components/common/stat-card";
import { EmptyState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/features/app/app-context";
import { useAccounts, useCards, useCategories, useTransactions } from "@/features/finance/queries";
import { accountBalance, inMonth, netWorth, totalExpense, totalIncome } from "@/features/finance/calc";
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

function Financeiro() {
  const { workspaceId, openQuickAction } = useApp();
  const transactionsQuery = useTransactions(workspaceId);
  const accountsQuery = useAccounts(workspaceId);
  const cardsQuery = useCards(workspaceId);
  const categoriesQuery = useCategories(workspaceId);

  if (transactionsQuery.isLoading || accountsQuery.isLoading) return <LoadingState />;

  const transactions = transactionsQuery.data ?? [];
  const accounts = accountsQuery.data ?? [];
  const cards = cardsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const monthly = transactions.filter((t) => inMonth(t.transaction_date));
  const categoryName = (id: string | null) =>
    categories.find((category) => category.id === id)?.name ?? "Sem categoria";

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
        <TabsList>
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
                        {transaction.is_shared ? <Badge variant="outline">Compartilhado</Badge> : null}
                        {transaction.is_demo ? <Badge variant="secondary">Demo</Badge> : null}
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

        <TabsContent value="contas" className="pt-6">
          <Panel>
            <PanelTitle>Contas</PanelTitle>
            {accounts.length === 0 ? (
              <EmptyState title="Nenhuma conta cadastrada" description="Adicione uma conta em Configurações." />
            ) : (
              <ul className="divide-y divide-border">
                {accounts.map((account) => (
                  <li key={account.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-medium">{account.name}</p>
                      <p className="text-xs text-muted-foreground">{account.institution ?? "—"}</p>
                    </div>
                    <span className="numeric text-sm">
                      {formatCurrency(accountBalance(account, transactions))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="cartoes" className="pt-6">
          <Panel>
            <PanelTitle>Cartões</PanelTitle>
            {cards.length === 0 ? (
              <EmptyState title="Nenhum cartão cadastrado" />
            ) : (
              <ul className="divide-y divide-border">
                {cards.map((card) => (
                  <li key={card.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-medium">{card.name}</p>
                      <p className="text-xs text-muted-foreground">{card.institution ?? "—"}</p>
                    </div>
                    <span className="numeric text-sm text-muted-foreground">
                      Limite {formatCurrency(Number(card.credit_limit ?? 0))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="categorias" className="pt-6">
          <Panel>
            <PanelTitle>Categorias</PanelTitle>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <Badge key={category.id} variant="outline">
                  {category.name}
                </Badge>
              ))}
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
