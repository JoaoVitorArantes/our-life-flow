import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Compass } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/common/page";
import { EmptyState, LoadingState } from "@/components/common/states";
import { RecordActions } from "@/components/common/record-actions";
import { Button } from "@/components/ui/button";
import { CreatedBy } from "@/components/common/created-by";
import { Badge } from "@/components/ui/badge";
import { ContextDialog } from "@/components/quick/context-dialog";
import { useApp } from "@/features/app/app-context";
import {
  contextEmoji,
  contextStatusLabel,
  deleteContext,
  useContexts,
  type Context,
} from "@/features/contexts/queries";
import { useTransactions } from "@/features/finance/queries";
import { formatCurrency, formatDateShort } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/contextos/")({
  head: () => ({
    meta: [
      { title: "Contextos — Life OS" },
      {
        name: "description",
        content: "Viagens, projetos, eventos e períodos com tudo o que pertence a eles.",
      },
      { property: "og:title", content: "Contextos — Life OS" },
      { property: "og:description", content: "Seus contextos de vida no Life OS." },
    ],
  }),
  component: Contextos,
});

function Contextos() {
  const { workspaceId, userId } = useApp();
  const { data: contexts = [], isLoading } = useContexts(workspaceId);
  const { data: transactions = [] } = useTransactions(workspaceId);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Context | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (isLoading) return <LoadingState />;

  const spent = (contextId: string) =>
    transactions
      .filter((t) => t.context_id === contextId && t.type === "EXPENSE")
      .reduce((total, t) => total + Number(t.amount), 0);

  async function remove(context: Context) {
    try {
      await deleteContext(context.id);
      await queryClient.invalidateQueries({ queryKey: ["contexts"] });
      toast.success("Contexto excluído.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir.");
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Contextos"
        subtitle="Períodos, viagens, projetos e eventos"
        action={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            Novo contexto
          </Button>
        }
      />

      {contexts.length === 0 ? (
        <EmptyState
          icon={Compass}
          title="Nenhum contexto ainda"
          description="Crie um contexto como “Camaro 2026” e vincule despesas, eventos e tarefas a ele."
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              Novo contexto
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {contexts.map((context) => (
            <Panel key={context.id} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <Link
                  to="/contextos/$id"
                  params={{ id: context.id }}
                  className="min-w-0 flex-1 space-y-1"
                >
                  <p className="truncate font-medium">
                    <span className="mr-1">{contextEmoji(context.type)}</span>
                    {context.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {context.start_date ? formatDateShort(context.start_date) : "Sem data"}
                    {context.end_date ? ` — ${formatDateShort(context.end_date)}` : ""}
                    {context.location ? ` · ${context.location}` : ""}
                  </p>
                </Link>
                <RecordActions
                  onEdit={() => {
                    setEditing(context);
                    setDialogOpen(true);
                  }}
                  onDelete={() => remove(context)}
                  confirmTitle="Excluir este contexto?"
                  confirmDescription="Os registros vinculados continuam existindo, mas perdem o vínculo. Essa ação não poderá ser desfeita."
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-2">
                  <Badge variant="outline">{contextStatusLabel(context.status)}</Badge>
                  <CreatedBy userId={context.owner_id} />
                </div>
                <span className="numeric text-sm">{formatCurrency(spent(context.id))}</span>
              </div>
            </Panel>
          ))}
        </div>
      )}

      <ContextDialog open={dialogOpen} onOpenChange={setDialogOpen} context={editing} />
    </div>
  );
}
