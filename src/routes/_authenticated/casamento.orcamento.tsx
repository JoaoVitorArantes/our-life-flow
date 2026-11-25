import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LoadingState } from "@/components/common/states";
import { WeddingShell } from "@/components/wedding/shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ItemsTab } from "@/components/wedding/budget/items-tab";
import { PeriodTab } from "@/components/wedding/budget/period-tab";
import { ExpensesTab, SavingsTab } from "@/components/wedding/budget/savings-tab";
import { ItemDialog } from "@/components/wedding/budget/item-dialog";
import { ItemSheet } from "@/components/wedding/budget/item-sheet";
import { CategoriesDialog } from "@/components/wedding/budget/categories-dialog";
import { useWeddingMutations } from "@/features/wedding/api";
import { useWeddingData } from "@/features/wedding/use-wedding";
import { useWeddingBudget, useWeddingBudgetMutations } from "@/features/wedding/budget-api";
import { useWeddingFunding, useWeddingFundingMutations } from "@/features/wedding/funding-api";
import { overview } from "@/features/wedding/budget";
import { FundingTab } from "@/components/wedding/budget/funding-tab";

export const Route = createFileRoute("/_authenticated/casamento/orcamento")({
  head: () => ({
    meta: [
      { title: "Orçamento do casamento — Life OS" },
      {
        name: "description",
        content:
          "Itens do casamento com previsto, contratado e pago, vencimentos, economia e despesas avulsas.",
      },
      { property: "og:title", content: "Orçamento do casamento — Life OS" },
      {
        property: "og:description",
        content: "Planejamento financeiro do casamento, separado do Financeiro geral.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Budget,
});

function Budget() {
  const w = useWeddingData();
  const m = useWeddingMutations(w.workspaceId, w.userId);
  const b = useWeddingBudget(w.workspaceId);
  const bm = useWeddingBudgetMutations(w.workspaceId, w.userId);
  const fd = useWeddingFunding(w.workspaceId);
  const fm = useWeddingFundingMutations(w.workspaceId, w.userId);
  const [tab, setTab] = useState("itens");
  const [editing, setEditing] = useState<{ id: string | null; category: string | null } | null>(
    null,
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const [cats, setCats] = useState(false);
  if (w.loading || b.loading || fd.loading) return <LoadingState />;

  const opened = b.items.find((i) => i.id === openId) ?? null;
  const editingItem = editing?.id ? (b.items.find((i) => i.id === editing.id) ?? null) : null;
  const totalBudget = w.plan?.total_budget != null ? Number(w.plan.total_budget) : null;
  const catName = (id: string | null) =>
    id ? (b.categories.find((c) => c.id === id)?.name ?? "Categoria") : "Sem categoria";
  const supplierName = (id: string | null) =>
    id ? (w.suppliers.find((s) => s.id === id)?.name ?? null) : null;

  return (
    <WeddingShell
      title="Orçamento"
      subtitle="Só do casamento — nada é lançado no Financeiro geral."
    >
      {b.error || fd.error ? (
        <p className="text-sm text-destructive">
          Não foi possível carregar o orçamento. Tente de novo.
        </p>
      ) : null}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:inline-grid sm:w-auto sm:grid-cols-5">
          <TabsTrigger value="itens">Itens</TabsTrigger>
          <TabsTrigger value="periodo">Por período</TabsTrigger>
          <TabsTrigger value="economia">Economia</TabsTrigger>
          <TabsTrigger value="avulsas">Avulsas</TabsTrigger>
          <TabsTrigger value="fontes" className="col-span-2 sm:col-span-1">
            Fontes e dívidas
          </TabsTrigger>
        </TabsList>
        <TabsContent value="itens" className="mt-5">
          <ItemsTab
            totalBudget={totalBudget}
            items={b.items}
            payments={b.payments}
            categories={b.categories}
            suppliers={w.suppliers}
            expenses={w.expenses}
            m={bm}
            onNew={(category) => setEditing({ id: null, category: category ?? null })}
            onOpen={setOpenId}
            onManageCategories={() => setCats(true)}
          />
        </TabsContent>
        <TabsContent value="periodo" className="mt-5">
          <PeriodTab
            items={b.items}
            payments={b.payments}
            expenses={w.expenses}
            onOpen={setOpenId}
          />
        </TabsContent>
        <TabsContent value="economia" className="mt-5">
          <SavingsTab w={w} m={m} />
        </TabsContent>
        <TabsContent value="avulsas" className="mt-5">
          <ExpensesTab w={w} m={m} />
        </TabsContent>
        <TabsContent value="fontes" className="mt-5">
          <FundingTab
            data={fd}
            m={fm}
            weddingCost={overview(totalBudget, b.items, b.payments, w.expenses).committed}
          />
        </TabsContent>
      </Tabs>

      <ItemDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        item={editingItem}
        defaultCategory={editing?.category ?? null}
        categories={b.categories}
        suppliers={w.suppliers}
        m={bm}
      />
      <ItemSheet
        item={editing ? null : opened}
        payments={b.payments}
        categoryName={catName(opened?.category_id ?? null)}
        supplierName={supplierName(opened?.supplier_id ?? null)}
        people={w.people}
        personName={w.personName}
        m={bm}
        onClose={() => setOpenId(null)}
        onEdit={() => opened && setEditing({ id: opened.id, category: opened.category_id })}
        meta={
          opened
            ? {
                created_at: opened.created_at,
                updated_at: opened.updated_at,
                created_by: opened.created_by,
              }
            : null
        }
      />
      <CategoriesDialog
        open={cats}
        onOpenChange={setCats}
        categories={b.categories}
        usage={(id) => b.items.filter((i) => i.category_id === id).length}
        m={bm}
      />
    </WeddingShell>
  );
}
