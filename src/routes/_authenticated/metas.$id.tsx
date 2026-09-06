import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Target } from "lucide-react";
import { toast } from "sonner";
import { Panel, PanelTitle } from "@/components/common/page";
import { EmptyState, LoadingState } from "@/components/common/states";
import { RecordActions } from "@/components/common/record-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ContributionDialog } from "@/components/quick/contribution-dialog";
import { SimpleRecordDialog } from "@/components/quick/simple-record-dialog";
import { useApp } from "@/features/app/app-context";
import { useGoal } from "@/features/planner/queries";
import {
  deleteContribution,
  movementType,
  signedAmount,
  sumContributions,
  useGoalContributions,
  type GoalContribution,
} from "@/features/planner/contributions";
import { formatCurrency, formatDateShort } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/metas/$id")({
  head: () => ({
    meta: [
      { title: "Meta — Life OS" },
      { name: "description", content: "Progresso da meta e histórico de contribuições." },
      { property: "og:title", content: "Meta — Life OS" },
      { property: "og:description", content: "Detalhes da meta no Life OS." },
    ],
  }),
  component: GoalDetail,
});

function GoalDetail() {
  const { id } = Route.useParams();
  const { memberProfiles, workspaceId } = useApp();
  const queryClient = useQueryClient();
  const { data: goal, isLoading } = useGoal(id);
  const { data: contributions = [] } = useGoalContributions(id);
  const [addOpen, setAddOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [editing, setEditing] = useState<GoalContribution | null>(null);
  const [editGoalOpen, setEditGoalOpen] = useState(false);

  if (isLoading) return <LoadingState />;
  if (!goal) {
    return (
      <EmptyState
        title="Meta não encontrada"
        description="Ela pode ter sido excluída ou é privada de outra pessoa."
        action={
          <Button size="sm" variant="outline" asChild>
            <Link to="/metas">Voltar</Link>
          </Button>
        }
      />
    );
  }

  const target = Number(goal.target_amount ?? 0);
  const current = sumContributions(contributions);
  const remaining = Math.max(target - current, 0);
  const progress = target ? Math.min((current / target) * 100, 100) : 0;

  const perMember = memberProfiles
    .map((profile) => ({
      profile,
      total: sumContributions(contributions.filter((item) => item.user_id === profile.id)),
    }))
    .filter((item) => item.total !== 0);

  async function removeContribution(contribution: GoalContribution) {
    try {
      if (!workspaceId) return;
      await deleteContribution(contribution.id, workspaceId);
      await queryClient.invalidateQueries({ queryKey: ["goal-contributions"] });
      await queryClient.invalidateQueries({ queryKey: ["goal-contributions-all"] });
      toast.success("Movimentação excluída.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível remover.");
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
          <Link to="/metas">
            <ArrowLeft className="size-4" />
            Metas
          </Link>
        </Button>
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{goal.title}</h1>
            <p className="text-sm text-muted-foreground">
              {goal.due_date ? `até ${formatDateShort(goal.due_date)}` : "Sem prazo"}
              
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditGoalOpen(true)}>
              Editar meta
            </Button>
            <Button variant="outline" size="sm" onClick={() => setWithdrawOpen(true)}>
              Retirar
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              + Adicionar valor
            </Button>
          </div>
        </header>
      </div>

      <Panel className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <p className="numeric text-3xl font-semibold">{formatCurrency(current)}</p>
          <p className="numeric text-sm text-muted-foreground">
            de {formatCurrency(target)} · {progress.toFixed(0)}%
          </p>
        </div>
        <p className="numeric text-sm text-muted-foreground">
          Faltam {formatCurrency(remaining)}
        </p>
        <div className="h-2 rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        {perMember.length > 0 ? (
          <ul className="space-y-1 pt-2">
            {perMember.map((item) => (
              <li key={item.profile.id} className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {item.profile.name || item.profile.email}
                </span>
                <span className="numeric">{formatCurrency(item.total)}</span>
              </li>
            ))}
            <li className="flex justify-between border-t border-border pt-1 text-sm font-medium">
              <span>Total</span>
              <span className="numeric">{formatCurrency(current)}</span>
            </li>
          </ul>
        ) : null}
      </Panel>

      <Panel>
        <PanelTitle
          action={
            <Button variant="ghost" size="sm" onClick={() => setAddOpen(true)}>
              + Adicionar valor
            </Button>
          }
        >
          Histórico
        </PanelTitle>
        {contributions.length === 0 ? (
          <EmptyState
            icon={Target}
            title="Nenhuma contribuição ainda"
            description="Adicione o primeiro valor para começar a acompanhar o progresso."
            action={
              <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                Adicionar valor
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {contributions.map((contribution) => {
              const amount = signedAmount(contribution);
              const isWithdrawal = movementType(contribution) === "WITHDRAWAL";
              const author = memberProfiles.find((p) => p.id === contribution.user_id);
              return (
                <li key={contribution.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className={isWithdrawal ? "numeric text-destructive" : "numeric text-success"}>
                        {isWithdrawal ? "−" : "+"} {formatCurrency(Math.abs(amount))}
                      </span>
                      {contribution.description ? (
                        <span className="text-muted-foreground"> · {contribution.description}</span>
                      ) : null}
                    </p>
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      {formatDateShort(contribution.contribution_date)}
                      {author && memberProfiles.length > 1 ? (
                        <Badge variant="outline">{author.name || author.email}</Badge>
                      ) : null}
                    </p>
                  </div>
                  <RecordActions
                    onEdit={() => setEditing(contribution)}
                    onDelete={() => removeContribution(contribution)}
                    confirmTitle="Excluir esta movimentação?"
                    confirmDescription="O progresso da meta será recalculado. Essa ação não poderá ser desfeita."
                    deleteLabel="Remover"
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <ContributionDialog goalId={goal.id} open={addOpen} onOpenChange={setAddOpen} balance={current} />
      <ContributionDialog
        goalId={goal.id}
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        mode="withdraw"
        balance={current}
      />
      <ContributionDialog
        goalId={goal.id}
        balance={current}
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        contribution={editing}
      />
      <SimpleRecordDialog
        kind="goal"
        open={editGoalOpen}
        onOpenChange={setEditGoalOpen}
        record={goal}
      />
    </div>
  );
}
