import { useState } from "react";
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

export type SimpleKind = "event" | "task" | "goal" | "note";

const CONFIG: Record<SimpleKind, { title: string; label: string; queryKey: string }> = {
  event: { title: "Novo evento", label: "Título do evento", queryKey: "events" },
  task: { title: "Nova tarefa", label: "O que precisa ser feito?", queryKey: "tasks" },
  goal: { title: "Nova meta", label: "Nome da meta", queryKey: "goals" },
  note: { title: "Nova nota", label: "Título da nota", queryKey: "notes" },
};

export function SimpleRecordDialog({
  kind,
  open,
  onOpenChange,
}: {
  kind: SimpleKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { workspaceId, userId } = useApp();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(toDateInput());
  const [time, setTime] = useState("19:00");
  const [target, setTarget] = useState("");
  const [content, setContent] = useState("");
  const [shared, setShared] = useState(false);
  const [saving, setSaving] = useState(false);

  const config = CONFIG[kind];

  async function handleSubmit() {
    if (!workspaceId || !userId) return;
    if (!title.trim()) {
      toast.error("Informe um título.");
      return;
    }
    setSaving(true);
    const base = {
      workspace_id: workspaceId,
      owner_id: userId,
      title: title.trim(),
      visibility: shared ? ("SHARED" as const) : ("PRIVATE" as const),
    };
    try {
      let error = null;
      if (kind === "event") {
        ({ error } = await supabase
          .from("events")
          .insert({ ...base, starts_at: new Date(`${date}T${time}`).toISOString() }));
      } else if (kind === "task") {
        ({ error } = await supabase.from("tasks").insert({ ...base, due_date: date }));
      } else if (kind === "goal") {
        ({ error } = await supabase
          .from("goals")
          .insert({ ...base, target_amount: parseAmount(target) || null, due_date: date }));
      } else {
        ({ error } = await supabase.from("notes").insert({ ...base, content }));
      }
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: [config.queryKey] });
      toast.success("Registro criado.");
      setTitle("");
      setContent("");
      setTarget("");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
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

          <div className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
            <div>
              <p className="text-sm font-medium">Compartilhado</p>
              <p className="text-xs text-muted-foreground">Visível para o workspace</p>
            </div>
            <Switch checked={shared} onCheckedChange={setShared} />
          </div>

          <Button className="w-full" disabled={saving} onClick={handleSubmit}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
