import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { roomInputSchema, WED_COLORS, WED_COLOR_LABEL } from "@/features/wedding/contracts";
import { useWeddingMutations, type WeddingRoom } from "@/features/wedding/api";
import type { WeddingData } from "@/features/wedding/use-wedding";
import { Choice, Field } from "./item-form";

export function RoomDialog({
  w,
  room,
  trigger,
}: {
  w: WeddingData;
  room?: WeddingRoom;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const m = useWeddingMutations(w.workspaceId, w.userId);
  const [name, setName] = useState(room?.name ?? "");
  const [icon, setIcon] = useState(room?.icon ?? "");
  const [color, setColor] = useState(room?.color ?? "blush");
  const [description, setDescription] = useState(room?.description ?? "");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = roomInputSchema.safeParse({
      name,
      icon: icon.trim() || null,
      color,
      description: description.trim() || null,
    });
    if (!parsed.success) {
      toast.error("Informe um nome (até 120 caracteres) e um ícone curto.");
      return;
    }
    m.saveRoom.mutate(
      { id: room?.id, input: parsed.data },
      {
        onSuccess: () => {
          setOpen(false);
          toast.success(room ? "Cômodo atualizado." : "Cômodo criado.");
          if (!room) {
            setName("");
            setIcon("");
            setDescription("");
          }
        },
        onError: (er) => toast.error(er.message),
      },
    );
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg">
        <DialogHeader>
          <DialogTitle className="wed-display text-2xl">
            {room ? "Editar cômodo" : "Novo cômodo ou categoria"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" wide htmlFor="rm-name">
            <Input
              id="rm-name"
              className="h-11"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>
          <Field label="Ícone (emoji)" htmlFor="rm-icon">
            <Input
              id="rm-icon"
              className="h-11"
              value={icon}
              maxLength={8}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="🛋️"
            />
          </Field>
          <Field label="Cor" htmlFor="rm-color">
            <Choice
              id="rm-color"
              value={color}
              onChange={setColor}
              options={WED_COLORS.map((c) => [c, WED_COLOR_LABEL[c]])}
            />
          </Field>
          <Field label="Descrição" wide htmlFor="rm-desc">
            <Textarea
              id="rm-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" className="h-11 w-full sm:w-auto" disabled={m.saveRoom.isPending}>
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
