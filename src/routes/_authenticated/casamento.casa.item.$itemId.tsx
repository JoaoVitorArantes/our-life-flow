import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Archive, Copy, RotateCcw, ShoppingBag, Trash2, Search } from "lucide-react";
import { EmptyState, LoadingState } from "@/components/common/states";
import { WeddingShell } from "@/components/wedding/shell";
import { BackToHouse } from "@/components/wedding/back";
import { Confirm } from "@/components/wedding/confirm";
import { Choice, Field, ItemForm, itemToInput } from "@/components/wedding/item-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { duplicateInput } from "@/features/wedding/contracts";
import { useWeddingMutations, type WeddingItem } from "@/features/wedding/api";
import { useWeddingData, type WeddingData } from "@/features/wedding/use-wedding";

export const Route = createFileRoute("/_authenticated/casamento/casa/item/$itemId")({
  head: () => ({
    meta: [
      { title: "Item do enxoval — Life OS" },
      { name: "description", content: "Detalhes, preços e status de um item do enxoval do casal." },
      { property: "og:title", content: "Item do enxoval — Life OS" },
      { property: "og:description", content: "Detalhes de um item do enxoval do casal." },
    ],
  }),
  component: ItemPage,
});

function ItemPage() {
  const { itemId } = Route.useParams();
  const w = useWeddingData();
  const m = useWeddingMutations(w.workspaceId, w.userId);
  const navigate = useNavigate();
  if (w.loading) return <LoadingState />;
  const item = w.items.find((i) => i.id === itemId) ?? w.archivedItems.find((i) => i.id === itemId);
  if (!item)
    return (
      <WeddingShell title="Item não encontrado" back={<BackToHouse label="Nossa Casa" />}>
        <EmptyState
          icon={Search}
          title="Este item não existe mais"
          description="Ele pode ter sido excluído definitivamente."
        />
      </WeddingShell>
    );
  const room = w.roomOf(item.room_id);
  const archived = !!item.archived_at;
  const isBought = !!item.status_id && w.boughtIds.has(item.status_id);

  return (
    <WeddingShell
      title={item.name}
      subtitle={archived ? "Na lixeira — restaure para editar" : room?.name}
      back={
        <BackToHouse
          roomId={room && !room.archived_at ? room.id : undefined}
          label={room?.name ?? "Nossa Casa"}
        />
      }
      action={
        archived ? (
          <>
            <Button
              className="h-11"
              onClick={() =>
                m.setArchived.mutate(
                  { table: "wedding_items", id: item.id, archived: false },
                  { onSuccess: () => toast.success("Item restaurado.") },
                )
              }
            >
              <RotateCcw className="size-4" /> Restaurar
            </Button>
            <Confirm
              title="Excluir definitivamente?"
              description="Esta ação não pode ser desfeita. Despesas ligadas ao item continuam registradas."
              confirmLabel="Excluir"
              onConfirm={() =>
                m.deleteRow.mutate(
                  { table: "wedding_items", id: item.id },
                  {
                    onSuccess: () => {
                      toast.success("Item excluído.");
                      void navigate({ to: "/casamento/casa" });
                    },
                  },
                )
              }
              trigger={
                <Button variant="ghost" className="h-11">
                  <Trash2 className="size-4" /> Excluir
                </Button>
              }
            />
          </>
        ) : (
          <>
            {!isBought && <BuyDialog w={w} item={item} />}
            <Button
              variant="outline"
              className="h-11"
              onClick={() =>
                m.saveItem.mutate(
                  { input: duplicateInput(itemToInput(item), w.initialStatusId) },
                  {
                    onSuccess: (id) => {
                      toast.success("Item duplicado.");
                      if (typeof id === "string")
                        void navigate({
                          to: "/casamento/casa/item/$itemId",
                          params: { itemId: id },
                        });
                    },
                    onError: (e) => toast.error(e.message),
                  },
                )
              }
            >
              <Copy className="size-4" /> Duplicar
            </Button>
            <Confirm
              title="Mover para a lixeira?"
              description="O item sai das listas e dos totais. Vocês podem restaurar depois."
              confirmLabel="Mover para a lixeira"
              onConfirm={() =>
                m.setArchived.mutate(
                  { table: "wedding_items", id: item.id, archived: true },
                  { onSuccess: () => toast.success("Item na lixeira.") },
                )
              }
              trigger={
                <Button variant="ghost" className="h-11">
                  <Archive className="size-4" /> Arquivar
                </Button>
              }
            />
          </>
        )
      }
    >
      <div className={`wed-card p-4 sm:p-6 ${archived ? "pointer-events-none opacity-60" : ""}`}>
        <ItemForm
          key={item.updated_at}
          w={w}
          initial={itemToInput(item)}
          pending={m.saveItem.isPending}
          onSubmit={(input) =>
            m.saveItem.mutate(
              { id: item.id, input },
              {
                onSuccess: () => toast.success("Item salvo."),
                onError: (e) => toast.error(e.message),
              },
            )
          }
        />
      </div>
    </WeddingShell>
  );
}

function BuyDialog({ w, item }: { w: WeddingData; item: WeddingItem }) {
  const m = useWeddingMutations(w.workspaceId, w.userId);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(
    item.price_target != null ? String(Number(item.price_target) * item.quantity) : "",
  );
  const [paidBy, setPaidBy] = useState(w.userId ?? "");
  const [split, setSplit] = useState<"equal" | "payer">("equal");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const value = amount.trim() === "" ? null : Number(amount.replace(",", "."));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11">
          <ShoppingBag className="size-4" /> Registrar compra
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg">
        <DialogHeader>
          <DialogTitle className="wed-display text-2xl">Registrar compra</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Cria uma despesa só dentro do Casamento. Nada é lançado no Financeiro geral.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Valor pago (R$)" htmlFor="buy-v">
            <Input
              id="buy-v"
              className="h-11"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Data" htmlFor="buy-d">
            <Input
              id="buy-d"
              className="h-11"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Quem pagou">
            <Choice
              value={paidBy}
              onChange={setPaidBy}
              options={w.people.map((x) => [x.id, x.name])}
            />
          </Field>
          <Field label="Divisão">
            <Choice
              value={split}
              onChange={(v) => setSplit(v as "equal" | "payer")}
              options={[
                ["equal", "Metade cada"],
                ["payer", "Só quem pagou"],
              ]}
            />
          </Field>
        </div>
        {!w.boughtStatusId && (
          <p className="text-sm text-destructive">
            Nenhum status está marcado como “conta como comprado”. Ajuste em Ajustes › Status.
          </p>
        )}
        <DialogFooter>
          <Button
            className="h-11"
            disabled={!value || value <= 0 || !paidBy || m.buyItem.isPending}
            onClick={() =>
              m.buyItem.mutate(
                { item, amount: value!, paidBy, split, date, boughtStatusId: w.boughtStatusId },
                {
                  onSuccess: () => {
                    toast.success("Compra registrada.");
                    setOpen(false);
                  },
                  onError: (e) => toast.error(e.message),
                },
              )
            }
          >
            Confirmar compra
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
