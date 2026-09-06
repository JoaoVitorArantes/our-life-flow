import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { useApp } from "@/features/app/app-context";
import {
  CONTEXT_STATUSES,
  CONTEXT_TYPES,
  createContext,
  updateContext,
  type Context,
  type ContextStatus,
  type ContextType,
} from "@/features/contexts/queries";

export function ContextDialog({
  open,
  onOpenChange,
  context,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context?: Context | null;
}) {
  const { workspaceId, userId } = useApp();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ContextType>("PERSONAL");
  const [status, setStatus] = useState<ContextStatus>("ACTIVE");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [budget, setBudget] = useState("");
  const [color, setColor] = useState("#7C5CFC");
  const [coverImage, setCoverImage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(context?.name ?? "");
    setDescription(context?.description ?? "");
    setType(context?.type ?? "PERSONAL");
    setStatus(context?.status ?? "ACTIVE");
    setStartDate(context?.start_date ?? "");
    setEndDate(context?.end_date ?? "");
    setLocation(context?.location ?? "");
    setBudget(
      context?.budget_amount != null
        ? String(Number(context.budget_amount)).replace(".", ",")
        : "",
    );
    setColor(context?.color ?? "#7C5CFC");
    setCoverImage(context?.cover_image ?? "");
  }, [open, context]);

  async function handleSubmit() {
    if (!workspaceId || !userId) return;
    if (!name.trim()) {
      toast.error("Informe um nome.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        type,
        status,
        start_date: startDate || null,
        end_date: endDate || null,
        location: location.trim() || null,
        visibility: "SHARED" as const,
      };
      if (context) {
        await updateContext(context.id, payload);
      } else {
        await createContext(workspaceId, userId, payload);
      }
      await queryClient.invalidateQueries({ queryKey: ["contexts"] });
      await queryClient.invalidateQueries({ queryKey: ["context"] });
      toast.success(context ? "Contexto atualizado." : "Contexto criado.");
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
          <DialogTitle>{context ? "Editar contexto" : "Novo contexto"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="context-name">Nome</Label>
            <Input
              id="context-name"
              placeholder="Camaro 2026"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(value) => setType(value as ContextType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTEXT_TYPES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.emoji} {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Situação</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as ContextStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTEXT_STATUSES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="context-start">Início</Label>
              <Input
                id="context-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="context-end">Fim</Label>
              <Input
                id="context-end"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="context-location">Local</Label>
            <Input
              id="context-location"
              placeholder="Uberlândia"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="context-description">Descrição</Label>
            <Textarea
              id="context-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>


          <Button className="w-full" disabled={saving} onClick={handleSubmit}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
