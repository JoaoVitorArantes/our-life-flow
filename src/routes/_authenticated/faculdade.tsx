import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";
import { PageHeader, Panel, PanelTitle } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/app/app-context";
import { useTasks } from "@/features/planner/queries";
import { formatDateShort } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/faculdade")({
  head: () => ({
    meta: [
      { title: "Faculdade — Life OS" },
      { name: "description", content: "Entregas, provas e rotina acadêmica." },
      { property: "og:title", content: "Faculdade — Life OS" },
      { property: "og:description", content: "Sua rotina acadêmica no Life OS." },
    ],
  }),
  component: Faculdade,
});

function Faculdade() {
  const { workspaceId, openQuickAction } = useApp();
  const { data: tasks = [] } = useTasks(workspaceId);
  const academic = tasks.filter(
    (task) => task.status !== "DONE" && /faculdade|prova|trabalho|aula/i.test(task.title),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Faculdade"
        subtitle="Entregas e rotina acadêmica"
        action={
          <Button size="sm" onClick={() => openQuickAction("task")}>
            Nova entrega
          </Button>
        }
      />

      <Panel>
        <PanelTitle>Próximas entregas</PanelTitle>
        {academic.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="Nada acadêmico em aberto"
            description="Registre provas e trabalhos como tarefas — o módulo completo (disciplinas, notas e frequência) chega em uma próxima etapa."
          />
        ) : (
          <ul className="divide-y divide-border">
            {academic.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-3 py-3">
                <p className="truncate text-sm">{task.title}</p>
                {task.due_date ? (
                  <span className="numeric shrink-0 text-xs text-muted-foreground">
                    {formatDateShort(task.due_date)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
