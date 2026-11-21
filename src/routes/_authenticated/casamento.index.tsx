import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, PanelTitle } from "@/components/common/page";
import { LoadingState } from "@/components/common/states";
import { WeddingShell, Stat } from "@/components/wedding/shell";
import { WEDDING_AREAS } from "@/features/wedding/contracts";
import { useWeddingData } from "@/features/wedding/use-wedding";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/casamento/")({
  head: () => ({
    meta: [
      { title: "Casamento — Life OS" },
      {
        name: "description",
        content: "Planejamento do casamento do casal: casa, economia e preparativos.",
      },
      { property: "og:title", content: "Casamento — Life OS" },
      { property: "og:description", content: "O projeto do casal, em um só lugar." },
    ],
  }),
  component: WeddingOverview,
});

function fmtDate(d: string | null | undefined) {
  return d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR") : "Não informada";
}

function WeddingOverview() {
  const w = useWeddingData();
  if (w.loading) return <LoadingState />;
  const s = w.summary;
  return (
    <WeddingShell
      title="Nosso casamento"
      subtitle="Área independente do casal — dados próprios, separados do Financeiro, Metas e Tarefas gerais."
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Data do casamento" value={fmtDate(w.plan?.wedding_date)} />
        <Stat label="Mudança" value={fmtDate(w.plan?.move_in_date)} />
        <Stat
          label="Orçamento total"
          value={
            w.plan?.total_budget != null
              ? formatCurrency(Number(w.plan.total_budget))
              : "Não informado"
          }
        />
        <Stat label="Economia desde" value={fmtDate(w.plan?.savings_start ?? "2027-01-01")} />
        <Stat label="Acumulado" value={formatCurrency(s.saved)} />
        <Stat label="Gasto" value={formatCurrency(s.spent)} />
        <Stat
          label="Casa estimada"
          value={formatCurrency(s.estimated)}
          hint={
            s.itemsWithoutPrice
              ? `${s.itemsWithoutPrice} itens sem preço — total parcial`
              : undefined
          }
        />
        <Stat
          label="Pendências"
          value={String(w.tasks.filter((t) => t.status !== "done").length)}
        />
      </div>
      <Panel>
        <PanelTitle>Áreas</PanelTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {WEDDING_AREAS.map((a) => (
            <Link
              key={a.key}
              to="/casamento/$area"
              params={{ area: a.slug }}
              className="rounded-2xl border border-border bg-background/40 p-4 transition hover:border-primary/50"
            >
              <p className="text-2xl">{a.emoji}</p>
              <p className="mt-2 font-medium">{a.label}</p>
              <p className="text-xs text-muted-foreground">
                {a.ready ? `${s.totalItems} itens · ${s.boughtItems} comprados` : "Em breve"}
              </p>
            </Link>
          ))}
        </div>
      </Panel>
    </WeddingShell>
  );
}
