import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Archive, ArrowDown, ArrowUp, Pencil, Search } from "lucide-react";
import { EmptyState, LoadingState } from "@/components/common/states";
import { Bar, OptionBadge, SectionTitle, Stat, WeddingShell } from "@/components/wedding/shell";
import { BackToHouse } from "@/components/wedding/back";
import { Confirm } from "@/components/wedding/confirm";
import { ItemCard } from "@/components/wedding/item-card";
import { NewItemButton } from "@/components/wedding/new-item";
import { RoomDialog } from "@/components/wedding/room-form";
import { Button } from "@/components/ui/button";
import { moveInOrder } from "@/features/wedding/contracts";
import { useWeddingMutations } from "@/features/wedding/api";
import { useWeddingData } from "@/features/wedding/use-wedding";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/casamento/casa/$roomId")({
  head: () => ({
    meta: [
      { title: "Cômodo — Nossa Casa · Life OS" },
      {
        name: "description",
        content: "Itens, prioridades, status e progresso de um cômodo do enxoval.",
      },
      { property: "og:title", content: "Cômodo — Nossa Casa · Life OS" },
      { property: "og:description", content: "Itens e progresso de um cômodo do enxoval." },
    ],
  }),
  component: RoomPage,
});

function RoomPage() {
  const { roomId } = Route.useParams();
  const w = useWeddingData();
  const m = useWeddingMutations(w.workspaceId, w.userId);
  const navigate = useNavigate();
  if (w.loading) return <LoadingState />;
  const room = w.rooms.find((r) => r.id === roomId);
  if (!room)
    return (
      <WeddingShell title="Cômodo não encontrado" back={<BackToHouse label="Nossa Casa" />}>
        <EmptyState
          icon={Search}
          title="Este cômodo não existe ou está na lixeira"
          description="Itens arquivados podem ser restaurados em Ajustes."
        />
      </WeddingShell>
    );
  const items = w.items.filter((i) => i.room_id === room.id);
  const d = w.summary.byRoom[room.id] ?? { total: 0, bought: 0, estimated: 0 };
  const spent = items.reduce((sum, i) => sum + Number(i.price_actual ?? 0), 0);
  const missing = items.filter((i) => i.price_target == null).length;

  return (
    <WeddingShell
      title={`${room.icon ? `${room.icon} ` : ""}${room.name}`}
      subtitle={room.description ?? undefined}
      back={<BackToHouse label="Nossa Casa" />}
      action={
        <>
          <NewItemButton w={w} roomId={room.id} />
          <RoomDialog
            w={w}
            room={room}
            trigger={
              <Button variant="outline" className="h-11">
                <Pencil className="size-4" /> Editar
              </Button>
            }
          />
          <Confirm
            title="Arquivar cômodo?"
            description="O cômodo e seus itens saem das telas e dos totais. Vocês podem restaurar em Ajustes › Lixeira."
            confirmLabel="Arquivar"
            onConfirm={() =>
              m.setArchived.mutate(
                { table: "wedding_rooms", id: room.id, archived: true },
                {
                  onSuccess: () => {
                    toast.success("Cômodo arquivado.");
                    void navigate({ to: "/casamento/casa" });
                  },
                },
              )
            }
            trigger={
              <Button variant="ghost" className="h-11">
                <Archive className="size-4" /> Arquivar
              </Button>
            }
          />
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Comprados" value={`${d.bought}/${d.total}`} />
        <Stat
          label="Estimado"
          value={formatCurrency(d.estimated)}
          hint={missing ? `Parcial · ${missing} sem preço` : undefined}
        />
        <Stat label="Pago" value={formatCurrency(spent)} />
        <Stat
          label="Progresso"
          value={`${d.total ? Math.round((d.bought / d.total) * 100) : 0}%`}
        />
      </div>
      <div className="wed-card space-y-3 p-4">
        <Bar value={d.total ? (d.bought / d.total) * 100 : 0} />
        <div className="flex flex-wrap gap-2">
          {w.priorities.map((p) => {
            const n = items.filter((i) => i.priority_id === p.id).length;
            return n ? <OptionBadge key={p.id} label={`${p.label}: ${n}`} color={p.color} /> : null;
          })}
        </div>
      </div>
      <section>
        <SectionTitle>Itens</SectionTitle>
        {items.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Nenhum item neste cômodo"
            description="Use “Novo item” para começar."
          />
        ) : (
          <ul className="space-y-3">
            {items.map((i) => (
              <li key={i.id} className="flex min-w-0 items-stretch gap-2">
                <div className="min-w-0 flex-1">
                  <ItemCard item={i} w={w} />
                </div>
                <div className="flex shrink-0 flex-col justify-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-10"
                    aria-label={`Mover ${i.name} para cima`}
                    onClick={() =>
                      m.reorder.mutate({
                        table: "wedding_items",
                        rows: moveInOrder(items, i.id, -1),
                      })
                    }
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-10"
                    aria-label={`Mover ${i.name} para baixo`}
                    onClick={() =>
                      m.reorder.mutate({
                        table: "wedding_items",
                        rows: moveInOrder(items, i.id, 1),
                      })
                    }
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </WeddingShell>
  );
}
