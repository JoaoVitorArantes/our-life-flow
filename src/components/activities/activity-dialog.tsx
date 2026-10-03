import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ContextSelect, NO_CONTEXT } from "@/components/quick/context-select";
import { useApp } from "@/features/app/app-context";
import {
  ACTIVITY_PERSONS,
  ACTIVITY_TYPES,
  createActivity,
  updateActivity,
  type Activity,
  type ActivityPerson,
} from "@/features/activities/queries";
import { parseAmount, toDateInput } from "@/lib/format";

export function ActivityDialog({
  open,
  onOpenChange,
  activity,
  defaultContextId,
  prefill,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity?: Activity | null;
  defaultContextId?: string | null;
  prefill?: { activity_type?: string | null; title?: string; duration_minutes?: number | null; person_scope?: string; time?: string | null } | undefined;
}) {
  const { workspaceId, userId, activeContextId } = useApp();
  const queryClient = useQueryClient();
  const [type, setType] = useState("WALK");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(toDateInput());
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("");
  const [distance, setDistance] = useState("");
  const [location, setLocation] = useState("");
  const [person, setPerson] = useState<ActivityPerson>("COUPLE");
  const [contextId, setContextId] = useState(NO_CONTEXT);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (activity) {
      setType(activity.activity_type);
      setTitle(activity.title);
      setDescription(activity.description ?? "");
      setDate(activity.activity_date);
      setTime(activity.start_time ? activity.start_time.slice(0, 5) : "");
      setDuration(activity.duration_minutes == null ? "" : String(activity.duration_minutes));
      setDistance(
        activity.distance_km == null ? "" : String(Number(activity.distance_km)).replace(".", ","),
      );
      setLocation(activity.location ?? "");
      setPerson(activity.person_scope as ActivityPerson);
      setContextId(activity.context_id ?? NO_CONTEXT);
      setNotes(activity.notes ?? "");
    } else {
      setType("WALK");
      setTitle("");
      setDescription("");
      setDate(toDateInput());
      setTime("");
      setDuration("");
      setDistance("");
      setLocation("");
      setPerson("COUPLE");
      setContextId(defaultContextId ?? activeContextId ?? NO_CONTEXT);
      setNotes("");
      if (prefill) {
        if (prefill.activity_type) setType(prefill.activity_type);
        if (prefill.title) setTitle(prefill.title);
        if (prefill.duration_minutes) setDuration(String(prefill.duration_minutes));
        if (prefill.time) setTime(prefill.time.slice(0, 5));
        if (prefill.person_scope) setPerson(prefill.person_scope as ActivityPerson);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activity, defaultContextId, activeContextId]);

  async function handleSubmit() {
    if (!workspaceId || !userId) return;
    if (!title.trim()) {
      toast.error("Dê um nome pra essa atividade.");
      return;
    }
    if (!date) {
      toast.error("Escolha a data da atividade.");
      return;
    }
    const minutes = duration.trim() ? Math.round(Number(duration.replace(",", "."))) : null;
    if (minutes != null && (!Number.isFinite(minutes) || minutes < 0)) {
      toast.error("Duração inválida.");
      return;
    }
    setSaving(true);
    try {
      const input = {
        activity_type: type,
        title: title.trim(),
        description: description.trim() || null,
        activity_date: date,
        start_time: time ? `${time}:00` : null,
        duration_minutes: minutes,
        distance_km: distance.trim() ? parseAmount(distance) : null,
        location: location.trim() || null,
        person_scope: person,
        context_id: contextId === NO_CONTEXT ? null : contextId,
        notes: notes.trim() || null,
      };
      if (activity) await updateActivity(activity.id, input);
      else await createActivity(workspaceId, userId, input);
      await queryClient.invalidateQueries({ queryKey: ["activities"] });
      toast.success(activity ? "Atividade atualizada." : "Boa! Mais uma atividade 💪");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{activity ? "Editar atividade" : "Nova atividade 💪"}</DialogTitle>
          <DialogDescription>
            {activity
              ? "Atualize o que rolou nessa atividade."
              : "Registrar é simples — só o essencial já vale."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              O que rolou?
            </p>
            <div className="space-y-2">
              <Label htmlFor="activity-title">Atividade</Label>
              <Input
                id="activity-title"
                placeholder="Parque do Sabiá, treino de perna, pedal..."
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="h-12 text-base"
                autoFocus
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_TYPES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.emoji} {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pessoa</Label>
                <Select value={person} onValueChange={(value) => setPerson(value as ActivityPerson)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_PERSONS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.emoji} {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity-description">Descrição</Label>
              <Input
                id="activity-description"
                placeholder="Demos 4 voltas no parque."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Quando?
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="activity-date">Data</Label>
                <Input
                  id="activity-date"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="activity-time">Horário</Label>
                <Input
                  id="activity-time"
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Se quiserem registrar (opcional)
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="activity-duration">Duração (min)</Label>
                <Input
                  id="activity-duration"
                  inputMode="numeric"
                  placeholder="52"
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="activity-distance">Distância (km)</Label>
                <Input
                  id="activity-distance"
                  inputMode="decimal"
                  placeholder="4,8"
                  value={distance}
                  onChange={(event) => setDistance(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity-location">Local</Label>
              <Input
                id="activity-location"
                placeholder="Parque do Sabiá"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Mais detalhes
            </p>
            <ContextSelect value={contextId} onChange={setContextId} />
            <div className="space-y-2">
              <Label htmlFor="activity-notes">Observações</Label>
              <Textarea
                id="activity-notes"
                placeholder="Ficamos conversando o caminho todo."
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
              />
            </div>
          </section>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Salvando..." : activity ? "Salvar" : "Registrar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
