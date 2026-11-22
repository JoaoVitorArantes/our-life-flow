import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useWeddingMutations } from "@/features/wedding/api";
import type { WeddingData } from "@/features/wedding/use-wedding";
import { ItemForm } from "./item-form";

export function NewItemButton({ w, roomId }: { w: WeddingData; roomId?: string }) {
  const [open, setOpen] = useState(false);
  const m = useWeddingMutations(w.workspaceId, w.userId);
  const navigate = useNavigate();
  const room = roomId ?? w.rooms[0]?.id;
  if (!room) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11">
          <Plus className="size-4" /> Novo item
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="wed-display text-2xl">Novo item</DialogTitle>
        </DialogHeader>
        <ItemForm
          w={w}
          pending={m.saveItem.isPending}
          submitLabel="Adicionar item"
          initial={{
            room_id: room,
            name: "",
            description: null,
            quantity: 1,
            priority_id: w.priorities[1]?.id ?? w.priorities[0]?.id ?? null,
            status_id: w.initialStatusId,
            price_low: null,
            price_target: null,
            price_high: null,
            price_actual: null,
            responsible_user_id: null,
            links: [],
            notes: null,
            image_path: null,
          }}
          onSubmit={(input) =>
            m.saveItem.mutate(
              { input },
              {
                onSuccess: (id) => {
                  setOpen(false);
                  toast.success("Item adicionado.");
                  if (typeof id === "string")
                    void navigate({ to: "/casamento/casa/item/$itemId", params: { itemId: id } });
                },
                onError: (e) => toast.error(e.message),
              },
            )
          }
        />
      </DialogContent>
    </Dialog>
  );
}
