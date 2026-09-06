import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/features/app/app-context";
import { parseAmount, toDateInput } from "@/lib/format";
import { ContextSelect, NO_CONTEXT } from "./context-select";

export type SimpleKind = "event" | "task" | "goal" | "note";

type SimpleRecord = {
  id: string;
  title: string;
  context_id?: string | null;
  visibility?: string | null;
  content?: string | null;
  due_date?: string | null;
  starts_at?: string | null;
  target_amount?: number | string | null;
};

const CONFIG: Record<SimpleKind, { title: string; editTitle: string; label: string; queryKey: string }> =
  {
    event: {
      title: "Novo evento",
      editTitle: "Editar evento",
      label: "Título do evento",
      queryKey: "events",
    },
    task: {
      title: "Nova tarefa",
      editTitle: "Editar tarefa",
      label: "O que precisa ser feito?",
      queryKey: "tasks",
    },
    goal: { title: "Nova meta", editTitle: "Editar meta", label: "Nome da meta", queryKey: "goals" },
    note: { title: "Nova nota", editTitle: "Editar nota", label: "Título da nota", queryKey: "notes" },
  };

const TABLE: Record<SimpleKind, "events" | "tasks" | "goals" | "notes"> = {
  event: "events",
  task: "tasks",
  goal: "goals",
  note: "notes",
};

export function SimpleRecordDialog({
  kind,
  open,
  onOpenChange,
  record,
  defaultContextId,
}: {
  kind: SimpleKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: SimpleRecord | null;
  defaultContextId?: string | null;
}) {
  const { workspaceId, userId, activeContextId } = useApp();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(toDateInput());
  const [time, setTime] = useState("19:00");
  const [target, setTarget] = useState("");
  const [content, setContent] = useState("");
  const [contextId, setContextId] = useState<string>(NO_CONTEXT);
  const [saving, setSaving] = useState(false);

  const config = CONFIG[kind];
  const isEditing = !!record;

  useEffect(() => {
    if (!open) return;
    if (record) {
      setTitle(record.title ?? "");
      setContent(record.content ?? "");
      setTarget(record.target_amount ? String(Number(record.target_amount)).replace(".", ",") : "");
      setContextId(record.context_id ?? NO_CONTEXT);
      if (record.starts_at) {
        const start = new Date(record.starts_at);
        setDate(toDateInput(start));
        setTime(
          `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`,
        );
      } else if (record.due_date) {
        setDate(record.due_date);
      }
    } else {
      setTitle("");
      setContent("");
      setTarget("");
      setDate(toDateInput());
      setTime("19:00");
      setContextId(defaultContextId ?? activeContextId ?? NO_CONTEXT);
    }
  }, [open, record, defaultContextId, activeContextId]);

  async function handleSubmit() {
    if (!workspaceId || !userId) return;
    if (!title.trim()) {
      toast.error("Informe um título.");
      return;
    }
    setSaving(true);
    const shape = {
      title: title.trim(),
      visibility: "SHARED" as const,
      context_id: contextId === NO_CONTEXT ? null : contextId,
    };
    const owner = { workspace_id: workspaceId, owner_id: userId };
    const recordId = record?.id ?? "";

    try {
      let error = null;
      if (kind === "event") {
        const values = { ...shape, starts_at: new Date(`${date}T${time}`).toISOString() };
        ({ error } = isEditing
          ? await supabase.from("events").update(values).eq("id", recordId)
          : await supabase.from("events").insert({ ...values, ...owner }));
      } else if (kind === "task") {
        const values = { ...shape, due_date: date };
        ({ error } = isEditing
          ? await supabase.from("tasks").update(values).eq("id", recordId)
          : await supabase.from("tasks").insert({ ...values, ...owner }));
      } else if (kind === "goal") {
        const values = { ...shape, target_amount: parseAmount(target) || null, due_date: date };
        ({ error } = isEditing
          ? await supabase.from("goals").update(values).eq("id", recordId)
          : await supabase.from("goals").insert({ ...values, ...owner }));
      } else {
        const values = { ...shape, content };
        ({ error } = isEditing
          ? await supabase.from("notes").update(values).eq("id", recordId)
          : await supabase.from("notes").insert({ ...values, ...owner }));
      }
      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: [config.queryKey] });
      await queryClient.invalidateQueries({ queryKey: ["goal", record?.id] });
      toast.success(isEditing ? "Registro atualizado." : "Registro criado.");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? config.editTitle : config.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">{config.label}</Label>
            <Input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              autoFocus
            />
          </div>

          {kind !== "note" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date">{kind === "task" ? "Prazo" : "Data"}</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
              {kind === "event" ? (
                <div className="space-y-2">
                  <Label htmlFor="time">Horário</Label>
                  <Input
                    id="time"
                    type="time"
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                  />
                </div>
              ) : null}
              {kind === "goal" ? (
                <div className="space-y-2">
                  <Label htmlFor="target">Valor alvo</Label>
                  <Input
                    id="target"
                    inputMode="decimal"
                    placeholder="R$ 0,00"
                    value={target}
                    onChange={(event) => setTarget(event.target.value)}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="content">Conteúdo</Label>
              <Textarea
                id="content"
                rows={4}
                value={content}
                onChange={(event) => setContent(event.target.value)}
              />
            </div>
          )}

          <ContextSelect value={contextId} onChange={setContextId} />


          <Button className="w-full" disabled={saving} onClick={handleSubmit}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
