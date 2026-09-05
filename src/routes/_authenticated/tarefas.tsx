import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CheckSquare } from "lucide-react";
import { PageHeader, Panel, PanelTitle } from "@/components/common/page";
import { EmptyState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/features/app/app-context";
import { useTasks } from "@/features/planner/queries";
import { formatDateShort } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/tarefas")({
  head: () => ({
    meta: [
      { title: "Tarefas — Life OS" },
      { name: "description", content: "Tarefas pessoais e do casal, com prazos e prioridades." },
      { property: "og:title", content: "Tarefas — Life OS" },
      { property: "og:description", content: "Suas tarefas no Life OS." },
    ],
  }),
  component: Tarefas,
});

function Tarefas() {
  const { workspaceId, openQuickAction } = useApp();
  const { data: tasks = [], isLoading } = useTasks(workspaceId);
  const queryClient = useQueryClient();

  async function toggle(id: string, done: boolean) {
    await supabase
      .from("tasks")
      .update({ status: done ? "DONE" : "TODO" })
      .eq("id", id);

    await queryClient.invalidateQueries({ queryKey: ["tasks"] });
  }

  if (isLoading) return <LoadingState />;

  const open = tasks.filter((task) => task.status !== "DONE");
  const done = tasks.filter((task) => task.status === "DONE");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tarefas"
        subtitle="O que precisa acontecer"
        action={
          <Button size="sm" onClick={() => openQuickAction("task")}>
            Nova tarefa
          </Button>
        }
      />

      <Panel>
        <PanelTitle>Abertas</PanelTitle>
        {open.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="Nada pendente"
            description="Aproveite o silêncio."
            action={
              <Button size="sm" variant="outline" onClick={() => openQuickAction("task")}>
                Nova tarefa
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {open.map((task) => (
              <li key={task.id} className="flex items-center gap-3 py-3">
                <Checkbox checked={false} onCheckedChange={() => toggle(task.id, true)} />
                <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
                {task.visibility === "SHARED" ? <Badge variant="outline">Nós</Badge> : null}
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

      {done.length > 0 ? (
        <Panel>
          <PanelTitle>Concluídas</PanelTitle>
          <ul className="divide-y divide-border">
            {done.slice(0, 15).map((task) => (
              <li key={task.id} className="flex items-center gap-3 py-3 text-muted-foreground">
                <Checkbox checked onCheckedChange={() => toggle(task.id, false)} />
                <span className="min-w-0 flex-1 truncate text-sm line-through">{task.title}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
