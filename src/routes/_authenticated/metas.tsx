import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Target } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/common/page";
import { EmptyState, LoadingState } from "@/components/common/states";
import { RecordActions } from "@/components/common/record-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SimpleRecordDialog } from "@/components/quick/simple-record-dialog";
import { ContributionDialog } from "@/components/quick/contribution-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/features/app/app-context";
import { useGoals, type Goal } from "@/features/planner/queries";
import { goalProgress, useAllContributions } from "@/features/planner/contributions";
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
  const { workspaceId, userId, openQuickAction } = useApp();
  const { data: goals = [], isLoading } = useGoals(workspaceId);
  const { data: contributions = [] } = useAllContributions(goals.map((goal) => goal.id));
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Goal | null>(null);
  const [contributingTo, setContributingTo] = useState<Goal | null>(null);

  if (isLoading) return <LoadingState />;

  async function remove(goal: Goal) {
    try {
      const { error } = await supabase.from("goals").delete().eq("id", goal.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["goals"] });
      toast.success("Meta excluída.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir.");
    }
  }

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
            const current = goalProgress(goal, contributions);
            const progress = target ? Math.min((current / target) * 100, 100) : 0;
            return (
              <Panel key={goal.id} className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <Link to="/metas/$id" params={{ id: goal.id }} className="min-w-0 flex-1">
                    <p className="truncate font-medium">{goal.title}</p>
                    {goal.due_date ? (
                      <p className="text-xs text-muted-foreground">
                        até {formatDateShort(goal.due_date)}
                      </p>
                    ) : null}
                  </Link>
                  <div className="flex items-center gap-2">
                    {goal.visibility === "SHARED" ? <Badge variant="outline">Nós</Badge> : null}
                    <RecordActions
                      onEdit={() => setEditing(goal)}
                      onDelete={() => remove(goal)}
                      confirmTitle="Excluir esta meta?"
                      confirmDescription="O histórico de contribuições também será perdido. Essa ação não poderá ser desfeita."
                    />
                  </div>
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
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setContributingTo(goal)}
                >
                  + Adicionar valor
                </Button>
              </Panel>
            );
          })}
        </div>
      )}

      <SimpleRecordDialog
        kind="goal"
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        record={editing}
      />
      {contributingTo ? (
        <ContributionDialog
          goalId={contributingTo.id}
          open
          onOpenChange={(open) => {
            if (!open) setContributingTo(null);
          }}
        />
      ) : null}
    </div>
  );
}
