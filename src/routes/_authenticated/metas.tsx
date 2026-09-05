import { createFileRoute } from "@tanstack/react-router";
import { Target } from "lucide-react";
import { PageHeader, Panel } from "@/components/common/page";
import { EmptyState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/features/app/app-context";
import { useGoals } from "@/features/planner/queries";
import { formatCurrency, formatDateShort } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/metas")({
  head: () => ({
    meta: [
      { title: "Metas — Life OS" },
      { name: "description", content: "Objetivos pessoais e do casal com progresso real." },
      { property: "og:title", content: "Metas — Life OS" },
      { property: "og:description", content: "Suas metas no Life OS." },
    ],
  }),
  component: Metas,
});

function Metas() {
  const { workspaceId, openQuickAction } = useApp();
  const { data: goals = [], isLoading } = useGoals(workspaceId);

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Metas"
        subtitle="Onde você quer chegar"
        action={
          <Button size="sm" onClick={() => openQuickAction("goal")}>
            Nova meta
          </Button>
        }
      />

      {goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Nenhuma meta ainda"
          description="Defina um objetivo com valor e prazo."
          action={
            <Button size="sm" variant="outline" onClick={() => openQuickAction("goal")}>
              Nova meta
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {goals.map((goal) => {
            const target = Number(goal.target_amount ?? 0);
            const current = Number(goal.current_amount ?? 0);
            const progress = target ? Math.min((current / target) * 100, 100) : 0;
            return (
              <Panel key={goal.id} className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{goal.title}</p>
                    {goal.due_date ? (
                      <p className="text-xs text-muted-foreground">
                        até {formatDateShort(goal.due_date)}
                      </p>
                    ) : null}
                  </div>
                  {goal.visibility === "SHARED" ? <Badge variant="outline">Nós</Badge> : null}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="numeric">{formatCurrency(current)}</span>
                    <span className="numeric text-muted-foreground">{formatCurrency(target)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
