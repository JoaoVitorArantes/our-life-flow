import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { LoadingState } from "@/components/common/states";
import { WeddingShell } from "@/components/wedding/shell";
import { Choice } from "@/components/wedding/item-form";
import { Confirm } from "@/components/wedding/confirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TASK_KIND, TASK_STATUS } from "@/features/wedding/contracts";
import { useWeddingMutations } from "@/features/wedding/api";
import { useWeddingData } from "@/features/wedding/use-wedding";

export const Route = createFileRoute("/_authenticated/casamento/preparativos")({
  head: () => ({
    meta: [
      { title: "Preparativos do casamento — Life OS" },
      { name: "description", content: "Tarefas, decisões e prazos do casal para o casamento." },
      { property: "og:title", content: "Preparativos do casamento — Life OS" },
      {
        property: "og:description",
        content: "Tarefas e decisões do casal, separadas das Tarefas gerais.",
      },
    ],
  }),
  component: Prep,
});

function Prep() {
  const w = useWeddingData();
  const m = useWeddingMutations(w.workspaceId, w.userId);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"task" | "decision" | "note">("task");
  const [due, setDue] = useState("");
  const [resp, setResp] = useState("none");
  const [show, setShow] = useState("open");
  if (w.loading) return <LoadingState />;
  const tasks = [...w.tasks]
    .filter((t) => show === "all" || (show === "open" ? t.status !== "done" : t.status === "done"))
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  return (
    <WeddingShell title="Preparativos" subtitle="Tarefas, decisões e notas só do casamento.">
      <section className="wed-card space-y-2 p-4 sm:p-5">
        <Input
          aria-label="Título"
          className="h-11"
          placeholder="Tarefa, decisão ou nota"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <Choice
            value={kind}
            onChange={(v) => setKind(v as typeof kind)}
            options={Object.entries(TASK_KIND)}
          />
          <Input
            aria-label="Prazo"
            className="h-11"
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
          <Choice
            value={resp}
            onChange={setResp}
            options={[
              ["none", "Sem responsável"],
              ...w.people.map((x) => [x.id, x.name] as [string, string]),
            ]}
          />
          <Button
            className="h-11"
            disabled={!title.trim()}
            onClick={() =>
              m.addTask.mutate(
                {
                  title: title.trim(),
                  kind,
                  due: due || null,
                  responsible: resp === "none" ? null : resp,
                },
                {
                  onSuccess: () => {
                    setTitle("");
                    setDue("");
                  },
                  onError: (e) => toast.error(e.message),
                },
              )
            }
          >
            Adicionar
          </Button>
        </div>
      </section>
      <div className="w-full sm:w-56">
        <Choice
          value={show}
          onChange={setShow}
          options={[
            ["open", "Em aberto"],
            ["done", "Concluídos"],
            ["all", "Todos"],
          ]}
        />
      </div>
      <ul className="space-y-3">
        {tasks.length === 0 && (
          <li className="wed-card px-5 py-6 text-sm text-muted-foreground">Nada por aqui.</li>
        )}
        {tasks.map((t) => (
          <li
            key={t.id}
            className="wed-card grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-center"
          >
            <div className="min-w-0">
              <p
                className={`break-words font-semibold ${t.status === "done" ? "text-muted-foreground line-through" : ""}`}
              >
                {t.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {TASK_KIND[t.kind as keyof typeof TASK_KIND]} ·{" "}
                {t.due_date
                  ? new Date(`${t.due_date}T12:00:00`).toLocaleDateString("pt-BR")
                  : "sem prazo"}{" "}
                · {w.personName(t.responsible_user_id)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <Choice
                  value={t.status}
                  onChange={(v) => m.setTaskStatus.mutate({ id: t.id, status: v as "todo" })}
                  options={Object.entries(TASK_STATUS)}
                />
              </div>
              <Confirm
                title="Excluir?"
                description="Esta ação não pode ser desfeita."
                confirmLabel="Excluir"
                onConfirm={() => m.deleteRow.mutate({ table: "wedding_tasks", id: t.id })}
                trigger={
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-10 shrink-0"
                    aria-label={`Excluir ${t.title}`}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                }
              />
            </div>
          </li>
        ))}
      </ul>
    </WeddingShell>
  );
}
