import { createFileRoute } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { PageHeader, Panel, PanelTitle } from "@/components/common/page";
import { StatCard } from "@/components/common/stat-card";
import { EmptyState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/app/app-context";
import { useTransactions } from "@/features/finance/queries";
import { inMonth } from "@/features/finance/calc";
import { formatCurrency, formatDateShort } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/nos")({
  head: () => ({
    meta: [
      { title: "Nós — Life OS" },
      { name: "description", content: "Despesas compartilhadas, divisões e acertos do casal." },
      { property: "og:title", content: "Nós — Life OS" },
      { property: "og:description", content: "O espaço compartilhado do Life OS." },
    ],
  }),
  component: Nos,
});

function Nos() {
  const { workspaceId, memberProfiles, openQuickAction } = useApp();
  const { data: transactions = [], isLoading } = useTransactions(workspaceId);

  if (isLoading) return <LoadingState />;

  const shared = transactions.filter((t) => t.is_shared);
  const sharedMonth = shared.filter((t) => inMonth(t.transaction_date));
  const monthTotal = sharedMonth.reduce((total, t) => total + Number(t.amount), 0);
  const people = Math.max(memberProfiles.length, 1);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Nós"
        subtitle="O que é do casal fica aqui"
        action={
          <Button size="sm" onClick={() => openQuickAction("expense")}>
            Despesa compartilhada
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Compartilhado no mês" value={monthTotal} />
        <StatCard label="Média por pessoa" value={monthTotal / people} tone="primary" />
      </div>

      <Panel>
        <PanelTitle>Pessoas no workspace</PanelTitle>
        {memberProfiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">Carregando membros...</p>
        ) : (
          <ul className="divide-y divide-border">
            {memberProfiles.map((profile) => (
              <li key={profile.id} className="py-3 text-sm">
                {profile.name || profile.email}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelTitle>Despesas compartilhadas</PanelTitle>
        {shared.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="Nada dividido ainda"
            description="Marque uma despesa como compartilhada para dividir 50/50, 70/30 ou como preferirem."
            action={
              <Button size="sm" variant="outline" onClick={() => openQuickAction("expense")}>
                Nova despesa
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {shared.map((transaction) => (
              <li key={transaction.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{transaction.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateShort(transaction.transaction_date)}
                  </p>
                </div>
                <span className="numeric shrink-0 text-sm">
                  {formatCurrency(Number(transaction.amount))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
