import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Home, LayoutGrid, List, Plus, Search } from "lucide-react";
import { EmptyState, LoadingState } from "@/components/common/states";
import { Bar, SectionTitle, Stat, WeddingShell } from "@/components/wedding/shell";
import { ItemCard } from "@/components/wedding/item-card";
import { Choice } from "@/components/wedding/item-form";
import { NewItemButton } from "@/components/wedding/new-item";
import { RoomDialog } from "@/components/wedding/room-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { moveInOrder } from "@/features/wedding/contracts";
import { useWeddingMutations } from "@/features/wedding/api";
import { useWeddingData } from "@/features/wedding/use-wedding";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/casamento/casa/")({
  head: () => ({
    meta: [
      { title: "Nossa Casa / Enxoval — Life OS" },
      {
        name: "description",
        content: "Enxoval do casal por cômodo, com prioridades, status e preços.",
      },
      { property: "og:title", content: "Nossa Casa / Enxoval — Life OS" },
      {
        property: "og:description",
        content: "Enxoval do casal por cômodo, com prioridades, status e preços.",
      },
    ],
  }),
  component: NossaCasa,
});

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const ALL = "__all__";

function NossaCasa() {
  const w = useWeddingData();
  const m = useWeddingMutations(w.workspaceId, w.userId);
  const [view, setView] = useState<"rooms" | "list">("rooms");
  const [q, setQ] = useState("");
  const [room, setRoom] = useState(ALL);
  const [prio, setPrio] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [resp, setResp] = useState(ALL);
  const [price, setPrice] = useState(ALL);
  const [sort, setSort] = useState("manual");

  const list = useMemo(() => {
    const term = q.trim().toLocaleLowerCase("pt-BR");
    const prioRank = (id: string | null) => w.priorities.findIndex((p) => p.id === id) + 1 || 999;
    const statusRank = (id: string | null) => w.statuses.findIndex((s) => s.id === id) + 1 || 999;
    const roomRank = (id: string) => w.rooms.findIndex((r) => r.id === id);
    return w.items
      .filter(
        (i) =>
          !term ||
          i.name.toLocaleLowerCase("pt-BR").includes(term) ||
          (i.notes ?? "").toLocaleLowerCase("pt-BR").includes(term),
      )
      .filter((i) => room === ALL || i.room_id === room)
      .filter((i) => prio === ALL || i.priority_id === prio)
      .filter((i) => status === ALL || i.status_id === status)
      .filter(
        (i) =>
          resp === ALL ||
          (resp === "none" ? !i.responsible_user_id : i.responsible_user_id === resp),
      )
      .filter(
        (i) =>
          price === ALL || (price === "missing" ? i.price_target == null : i.price_target != null),
      )
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name, "pt-BR");
        if (sort === "priority") return prioRank(a.priority_id) - prioRank(b.priority_id);
        if (sort === "status") return statusRank(a.status_id) - statusRank(b.status_id);
        if (sort === "price") return Number(b.price_target ?? -1) - Number(a.price_target ?? -1);
        return roomRank(a.room_id) - roomRank(b.room_id) || a.sort_order - b.sort_order;
      });
  }, [w, q, room, prio, status, resp, price, sort]);

  if (w.loading) return <LoadingState />;
  const s = w.summary;

  if (w.rooms.length === 0)
    return (
      <WeddingShell
        title="Nossa Casa"
        subtitle="Aluguel · 2 quartos · casa completa · padrão intermediário"
      >
        <EmptyState
          icon={Home}
          title="Comecem o enxoval"
          description="Cria 15 cômodos com itens sugeridos, quantidade e prioridade. Todos os preços ficam vazios para vocês preencherem."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                disabled={m.seed.isPending}
                onClick={() =>
                  m.seed.mutate(undefined, {
                    onSuccess: () => toast.success("Inventário sugerido criado."),
                    onError: (e) => toast.error(e.message),
                  })
                }
              >
                Criar inventário sugerido
              </Button>
              <RoomDialog w={w} trigger={<Button variant="outline">Começar do zero</Button>} />
            </div>
          }
        />
      </WeddingShell>
    );

  return (
    <WeddingShell
      title="Nossa Casa"
      subtitle="Aluguel · 2 quartos · casa completa · padrão intermediário"
      action={
        <>
          <NewItemButton w={w} />
          <RoomDialog
            w={w}
            trigger={
              <Button variant="outline" className="h-11">
                <Plus className="size-4" /> Cômodo
              </Button>
            }
          />
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Itens comprados" value={`${s.boughtItems}/${s.totalItems}`} />
        <Stat
          label="Custo estimado"
          value={formatCurrency(s.estimated)}
          hint={s.itemsWithoutPrice ? `Parcial · ${s.itemsWithoutPrice} sem preço-meta` : undefined}
        />
        <Stat label="Gasto" value={formatCurrency(s.spent)} />
        <Stat label="Cômodos" value={String(w.rooms.length)} />
      </div>

      <div className="flex gap-2" role="tablist" aria-label="Visualização">
        <Button
          role="tab"
          aria-selected={view === "rooms"}
          variant={view === "rooms" ? "default" : "outline"}
          className="h-11 flex-1 sm:flex-none"
          onClick={() => setView("rooms")}
        >
          <LayoutGrid className="size-4" /> Por cômodo
        </Button>
        <Button
          role="tab"
          aria-selected={view === "list"}
          variant={view === "list" ? "default" : "outline"}
          className="h-11 flex-1 sm:flex-none"
          onClick={() => setView("list")}
        >
          <List className="size-4" /> Lista geral
        </Button>
      </div>

      {view === "rooms" ? (
        <section>
          <SectionTitle>Cômodos</SectionTitle>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {w.rooms.map((r) => {
              const d = s.byRoom[r.id] ?? { total: 0, bought: 0, estimated: 0 };
              return (
                <li key={r.id} className="wed-card flex min-w-0 flex-col">
                  <Link
                    to="/casamento/casa/$roomId"
                    params={{ roomId: r.id }}
                    className="flex min-w-0 flex-1 flex-col gap-3 rounded-[1.25rem] p-4 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-xl"
                        aria-hidden
                      >
                        {r.icon || "🏠"}
                      </span>
                      <div className="min-w-0">
                        <p className="wed-display text-lg leading-snug break-words">{r.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.bought} de {d.total} comprados · {formatCurrency(d.estimated)}
                        </p>
                      </div>
                    </div>
                    <Bar value={pct(d.bought, d.total)} />
                  </Link>
                  <div className="flex justify-end gap-1 px-3 pb-3">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-9"
                      aria-label={`Mover ${r.name} para cima`}
                      onClick={() =>
                        m.reorder.mutate({
                          table: "wedding_rooms",
                          rows: moveInOrder(w.rooms, r.id, -1),
                        })
                      }
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-9"
                      aria-label={`Mover ${r.name} para baixo`}
                      onClick={() =>
                        m.reorder.mutate({
                          table: "wedding_rooms",
                          rows: moveInOrder(w.rooms, r.id, 1),
                        })
                      }
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <section className="space-y-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              aria-label="Buscar item"
              placeholder="Buscar item ou observação"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-11 pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
            <Choice
              value={room}
              onChange={setRoom}
              options={[
                [ALL, "Todos os cômodos"],
                ...w.rooms.map((r) => [r.id, r.name] as [string, string]),
              ]}
            />
            <Choice
              value={prio}
              onChange={setPrio}
              options={[
                [ALL, "Todas prioridades"],
                ...w.priorities.map((p) => [p.id, p.label] as [string, string]),
              ]}
            />
            <Choice
              value={status}
              onChange={setStatus}
              options={[
                [ALL, "Todos status"],
                ...w.statuses.map((x) => [x.id, x.label] as [string, string]),
              ]}
            />
            <Choice
              value={resp}
              onChange={setResp}
              options={[
                [ALL, "Qualquer responsável"],
                ["none", "Sem responsável"],
                ...w.people.map((p) => [p.id, p.name] as [string, string]),
              ]}
            />
            <Choice
              value={price}
              onChange={setPrice}
              options={[
                [ALL, "Com e sem preço"],
                ["missing", "Sem preço-meta"],
                ["set", "Com preço-meta"],
              ]}
            />
            <Choice
              value={sort}
              onChange={setSort}
              options={[
                ["manual", "Ordem por cômodo"],
                ["name", "Nome (A–Z)"],
                ["priority", "Prioridade"],
                ["status", "Status"],
                ["price", "Maior preço-meta"],
              ]}
            />
          </div>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {list.length} {list.length === 1 ? "item" : "itens"}
          </p>
          {list.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Nenhum item encontrado"
              description="Ajuste a busca ou os filtros."
            />
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {list.map((i) => (
                <li key={i.id} className="min-w-0">
                  <ItemCard item={i} w={w} showRoom />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </WeddingShell>
  );
}
