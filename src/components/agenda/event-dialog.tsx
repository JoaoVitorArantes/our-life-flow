import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/features/app/app-context";
import { ContextSelect, NO_CONTEXT } from "@/components/quick/context-select";
import type { Event } from "@/features/planner/queries";
import {
  EVENT_RECURRENCES,
  EVENT_STATUSES,
  addDays,
  isoOf,
  parseISO,
  type EventRecurrence,
  type EventStatus,
} from "@/features/agenda/queries";
import type { EventScope } from "@/features/agenda/mutations";
import { toDateInput } from "@/lib/format";

const NONE = "none";
const REMINDERS = [
  { value: NONE, label: "Sem lembrete" },
  { value: "10", label: "10 minutos antes" },
  { value: "30", label: "30 minutos antes" },
  { value: "60", label: "1 hora antes" },
  { value: "1440", label: "1 dia antes" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const timeOf = (value: string | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export function EventDialog({
  open,
  onOpenChange,
  event,
  occurrenceDate,
  defaultDate,
  defaultMinutes,
  defaultContextId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: Event | null;
  occurrenceDate?: string | undefined;
  defaultDate?: string | undefined;
  defaultMinutes?: number | undefined;
  defaultContextId?: string | null | undefined;
}) {
  const { workspaceId, userId, activeContextId, memberProfiles } = useApp();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(toDateInput());
  const [start, setStart] = useState("19:00");
  const [end, setEnd] = useState("");
  const [location, setLocation] = useState("");
  const [contextId, setContextId] = useState<string>(NO_CONTEXT);
  const [participants, setParticipants] = useState<string[]>([]);
  const [reminder, setReminder] = useState<string>(NONE);
  const [recurrence, setRecurrence] = useState<string>(NONE);
  const [until, setUntil] = useState("");
  const [status, setStatus] = useState<EventStatus>("SCHEDULED");
  const [scope, setScope] = useState<EventScope>("all");
  const [saving, setSaving] = useState(false);

  const isEditing = !!event;
  const isSeries = !!event?.recurrence;

  useEffect(() => {
    if (!open) return;
    setScope("all");
    if (event) {
      setTitle(event.title ?? "");
      setDescription(event.description ?? "");
      setDate(occurrenceDate ?? toDateInput(new Date(event.starts_at)));
      setStart(timeOf(event.starts_at) || "19:00");
      setEnd(timeOf(event.ends_at));
      setLocation(event.location ?? "");
      setContextId(event.context_id ?? NO_CONTEXT);
      setParticipants(event.participants ?? []);
      setReminder(event.reminder_minutes != null ? String(event.reminder_minutes) : NONE);
      setRecurrence(event.recurrence ?? NONE);
      setUntil(event.recurrence_until ?? "");
      setStatus(event.status ?? "SCHEDULED");
    } else {
      setTitle("");
      setDescription("");
      setDate(defaultDate ?? toDateInput());
      setStart(
        defaultMinutes != null
          ? `${pad(Math.floor(defaultMinutes / 60))}:${pad(defaultMinutes % 60)}`
          : "19:00",
      );
      setEnd("");
      setLocation("");
      setContextId(defaultContextId ?? activeContextId ?? NO_CONTEXT);
      setParticipants(userId ? [userId] : []);
      setReminder(NONE);
      setRecurrence(NONE);
      setUntil("");
      setStatus("SCHEDULED");
    }
  }, [open, event, occurrenceDate, defaultDate, defaultMinutes, defaultContextId, activeContextId, userId]);

  function toggleParticipant(id: string) {
    setParticipants((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function handleSubmit() {
    if (!workspaceId || !userId) return;
    if (!title.trim()) {
      toast.error("Informe um título.");
      return;
    }
    setSaving(true);
    const startsAt = new Date(`${date}T${start || "00:00"}`).toISOString();
    const endsAt = end ? new Date(`${date}T${end}`).toISOString() : null;
    const values = {
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      context_id: contextId === NO_CONTEXT ? null : contextId,
      participants,
      reminder_minutes: reminder === NONE ? null : Number(reminder),
      recurrence: recurrence === NONE ? null : (recurrence as EventRecurrence),
      recurrence_until: recurrence === NONE || !until ? null : until,
      status,
      starts_at: startsAt,
      ends_at: endsAt,
      visibility: "SHARED" as const,
    };

    try {
      if (!isEditing) {
        const { error } = await supabase
          .from("events")
          .insert({ ...values, workspace_id: workspaceId, owner_id: userId });
        if (error) throw error;
      } else if (!isSeries || scope === "all") {
        const { error } = await supabase.from("events").update(values).eq("id", event!.id);
        if (error) throw error;
      } else if (scope === "this") {
        const day = occurrenceDate ?? date;
        const { error } = await supabase
          .from("events")
          .update({ recurrence_exceptions: [...(event!.recurrence_exceptions ?? []), day] })
          .eq("id", event!.id);
        if (error) throw error;
        const { error: insertError } = await supabase.from("events").insert({
          ...values,
          recurrence: null,
          recurrence_until: null,
          workspace_id: workspaceId,
          owner_id: event!.owner_id,
        });
        if (insertError) throw insertError;
      } else {
        const day = occurrenceDate ?? date;
        const { error } = await supabase
          .from("events")
          .update({ recurrence_until: isoOf(addDays(parseISO(day), -1)) })
          .eq("id", event!.id);
        if (error) throw error;
        const { error: insertError } = await supabase.from("events").insert({
          ...values,
          workspace_id: workspaceId,
          owner_id: event!.owner_id,
        });
        if (insertError) throw insertError;
      }

      await queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success(isEditing ? "Evento atualizado." : "Evento criado.");
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
          <DialogTitle>{isEditing ? "Editar evento" : "Novo evento"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="event-title">Título</Label>
            <Input
              id="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="event-date">Data</Label>
              <Input
                id="event-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-start">Início</Label>
              <Input
                id="event-start"
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-end">Fim</Label>
              <Input
                id="event-end"
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-location">Local</Label>
            <Input
              id="event-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-description">Descrição</Label>
            <Textarea
              id="event-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <ContextSelect value={contextId} onChange={setContextId} />

          {memberProfiles.length > 0 ? (
            <div className="space-y-2">
              <Label>Participantes</Label>
              <div className="flex flex-wrap gap-4">
                {memberProfiles.map((member) => (
                  <label key={member.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={participants.includes(member.id)}
                      onCheckedChange={() => toggleParticipant(member.id)}
                    />
                    {member.name || member.email || "Membro"}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Lembrete</Label>
              <Select value={reminder} onValueChange={setReminder}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REMINDERS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Repetição</Label>
              <Select value={recurrence} onValueChange={setRecurrence}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Não repete</SelectItem>
                  {EVENT_RECURRENCES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {recurrence !== NONE ? (
            <div className="space-y-2">
              <Label htmlFor="event-until">Repetir até</Label>
              <Input
                id="event-until"
                type="date"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
              />
            </div>
          ) : null}

          {isEditing ? (
            <div className="space-y-2">
              <Label>Situação</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as EventStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_STATUSES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {isEditing && isSeries ? (
            <div className="space-y-2">
              <Label>Aplicar alteração a</Label>
              <Select value={scope} onValueChange={(value) => setScope(value as EventScope)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this">Somente este evento</SelectItem>
                  <SelectItem value="future">Este e os próximos</SelectItem>
                  <SelectItem value="all">Toda a série</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <Button className="w-full" disabled={saving} onClick={handleSubmit}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
