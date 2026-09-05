import { createFileRoute } from "@tanstack/react-router";
import { Dumbbell } from "lucide-react";
import { PageHeader, Panel, PanelTitle } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/app/app-context";

export const Route = createFileRoute("/_authenticated/esporte")({
  head: () => ({
    meta: [
      { title: "Esporte — Life OS" },
      { name: "description", content: "Treinos, constância e evolução física." },
      { property: "og:title", content: "Esporte — Life OS" },
      { property: "og:description", content: "Seus treinos no Life OS." },
    ],
  }),
  component: Esporte,
});

function Esporte() {
  const { openQuickAction } = useApp();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Esporte"
        subtitle="Treinos e constância"
        action={
          <Button size="sm" onClick={() => openQuickAction("workout")}>
            Registrar treino
          </Button>
        }
      />

      <Panel>
        <PanelTitle>Treinos</PanelTitle>
        <EmptyState
          icon={Dumbbell}
          title="Módulo em construção"
          description="A base do Life OS já está pronta para receber treinos, séries e histórico de evolução na próxima etapa."
        />
      </Panel>
    </div>
  );
}
