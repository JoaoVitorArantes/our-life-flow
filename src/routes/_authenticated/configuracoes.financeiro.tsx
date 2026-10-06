import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, CreditCard, Landmark, Tags } from "lucide-react";
import { PageHeader } from "@/components/common/page";
import { useApp } from "@/features/app/app-context";
import { useAccounts, useCards, useCategories } from "@/features/finance/queries";

export const Route = createFileRoute("/_authenticated/configuracoes/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Configurações — Life OS" },
      { name: "description", content: "Atalhos para contas, cartões e categorias." },
      { property: "og:title", content: "Financeiro — Configurações — Life OS" },
      { property: "og:description", content: "Organize o Financeiro do seu espaço." },
    ],
  }),
  component: FinanceSettings,
});

function FinanceSettings() {
  const { workspaceId } = useApp();
  const accounts = useAccounts(workspaceId).data ?? [];
  const cards = useCards(workspaceId).data ?? [];
  const categories = useCategories(workspaceId).data ?? [];

  const items = [
    { to: "/configuracoes/categorias" as const, icon: Tags, label: "Categorias", detail: `${categories.filter((c) => !c.archived_at).length} em uso` },
    { to: "/financeiro" as const, icon: Landmark, label: "Contas", detail: `${accounts.filter((a) => a.is_active).length} ativas · gerencie na aba Contas do Financeiro` },
    { to: "/financeiro" as const, icon: CreditCard, label: "Cartões", detail: `${cards.filter((c) => c.is_active).length} ativos · gerencie na aba Cartões do Financeiro` },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Financeiro" subtitle="Tudo que organiza o seu dinheiro, num lugar só. Os atalhos rápidos continuam iguais." />
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {items.map((item) => (
          <li key={item.label}>
            <Link to={item.to} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-accent/40">
              <item.icon className="size-4 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{item.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
