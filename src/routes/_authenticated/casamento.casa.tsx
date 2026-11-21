import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Home, Plus, Trash2 } from "lucide-react";
import { Panel, PanelTitle } from "@/components/common/page";
import { EmptyState, LoadingState } from "@/components/common/states";
import { WeddingShell, Stat } from "@/components/wedding/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ITEM_STATUS,
  PRIORITIES,
  TASK_KIND,
  TASK_STATUS,
  itemInputSchema,
  monthsFrom,
  type ItemInput,
  type Priority,
} from "@/features/wedding/contracts";
import { useWeddingMutations, type WeddingItem } from "@/features/wedding/api";
import { useWeddingData } from "@/features/wedding/use-wedding";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/casamento/casa")({
  head: () => ({
    meta: [
      { title: "Nossa Casa / Enxoval — Life OS" },
      {
        name: "description",
        content: "Inventário da casa por cômodo, economia, despesas e preparativos do casal.",
      },
      { property: "og:title", content: "Nossa Casa / Enxoval — Life OS" },
      {
        property: "og:description",
        content: "Enxoval completo do casal, por cômodo e prioridade.",
      },
    ],
  }),
  component: NossaCasa,
});

const today = () => new Date().toISOString().slice(0, 10);
const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
type W = ReturnType<typeof useWeddingData>;
type M = ReturnType<typeof useWeddingMutations>;

function NossaCasa() {
  const w = useWeddingData();
  const m = useWeddingMutations(w.workspaceId, w.userId);
  if (w.loading) return <LoadingState />;
  return (
    <WeddingShell
      title="🏡 Nossa Casa / Enxoval"
      subtitle="Aluguel · 2 quartos · casa completa · padrão intermediário"
    >
      {w.rooms.length === 0 ? (
        <EmptyState
          icon={Home}
          title="Comece o inventário"
          description="Cria cômodos e itens sugeridos com quantidade e prioridade. Todos os preços ficam vazios para vocês preencherem."
          action={
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
          }
        />
      ) : (
        <Tabs defaultValue="painel">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="painel">Painel</TabsTrigger>
            <TabsTrigger value="inventario">Inventário</TabsTrigger>
            <TabsTrigger value="economia">Economia</TabsTrigger>
            <TabsTrigger value="despesas">Despesas</TabsTrigger>
            <TabsTrigger value="preparativos">Preparativos</TabsTrigger>
            <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
          </TabsList>
          <TabsContent value="painel">
            <Dashboard w={w} />
          </TabsContent>
          <TabsContent value="inventario">
            <Inventory w={w} m={m} />
          </TabsContent>
          <TabsContent value="economia">
            <Savings w={w} m={m} />
          </TabsContent>
          <TabsContent value="despesas">
            <Expenses w={w} m={m} />
          </TabsContent>
          <TabsContent value="preparativos">
            <Tasks w={w} m={m} />
          </TabsContent>
          <TabsContent value="fornecedores">
            <Suppliers w={w} m={m} />
          </TabsContent>
        </Tabs>
      )}
    </WeddingShell>
  );
}

function Dashboard({ w }: { w: W }) {
  const s = w.summary;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat
          label="Custo estimado"
          value={formatCurrency(s.estimated)}
          hint={
            s.itemsWithoutPrice
              ? `Parcial: ${s.itemsWithoutPrice} itens sem preço-meta`
              : "Todos os itens com preço"
          }
        />
        <Stat
          label="Meta de economia"
          value={formatCurrency(s.savingsTarget)}
          hint="Soma das metas mensais"
        />
        <Stat label="Acumulado" value={formatCurrency(s.saved)} />
        <Stat label="Gasto / comprado" value={formatCurrency(s.spent)} />
        <Stat
          label="Falta economizar"
          value={s.remainingToSave == null ? "—" : formatCurrency(s.remainingToSave)}
          hint="Estimado − acumulado"
        />
        <Stat label="Itens comprados" value={`${s.boughtItems}/${s.totalItems}`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelTitle>Por prioridade</PanelTitle>
          <div className="space-y-3">
            {(Object.keys(PRIORITIES) as Priority[]).map((p) => (
              <div key={p}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{PRIORITIES[p]}</span>
                  <span className="text-muted-foreground">
                    {s.byPriority[p].bought}/{s.byPriority[p].total}
                  </span>
                </div>
                <Progress value={pct(s.byPriority[p].bought, s.byPriority[p].total)} />
              </div>
            ))}
          </div>
        </Panel>
        <Panel>
          <PanelTitle>Por cômodo</PanelTitle>
          <div className="space-y-3">
            {w.rooms.map((r) => {
              const d = s.byRoom[r.id] ?? { total: 0, bought: 0, estimated: 0 };
              return (
                <div key={r.id}>
                  <div className="mb-1 flex justify-between gap-2 text-sm">
                    <span className="truncate">{r.name}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {d.bought}/{d.total} · {formatCurrency(d.estimated)}
                    </span>
                  </div>
                  <Progress value={pct(d.bought, d.total)} />
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Inventory({ w, m }: { w: W; m: M }) {
  const [room, setRoom] = useState("all");
  const [prio, setPrio] = useState("all");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<WeddingItem | "new" | null>(null);
  const [buying, setBuying] = useState<WeddingItem | null>(null);
  const [newRoom, setNewRoom] = useState("");
  const filtered = useMemo(
    () =>
      w.items.filter(
        (i) =>
          (room === "all" || i.room_id === room) &&
          (prio === "all" || i.priority === prio) &&
          (status === "all" || i.status === status) &&
          i.name.toLowerCase().includes(q.toLowerCase()),
      ),
    [w.items, room, prio, status, q],
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Buscar item"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full sm:w-48"
        />
        <Filter
          value={room}
          onChange={setRoom}
          all="Todos os cômodos"
          options={w.rooms.map((r) => [r.id, r.name])}
        />
        <Filter
          value={prio}
          onChange={setPrio}
          all="Todas prioridades"
          options={Object.entries(PRIORITIES)}
        />
        <Filter
          value={status}
          onChange={setStatus}
          all="Todos status"
          options={Object.entries(ITEM_STATUS)}
        />
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4" /> Item
        </Button>
      </div>
      {w.rooms
        .filter((r) => room === "all" || r.id === room)
        .map((r) => {
          const list = filtered.filter((i) => i.room_id === r.id);
          if (!list.length) return null;
          return (
            <Panel key={r.id} className="p-0">
              <div className="border-b border-border px-5 py-3 text-sm font-medium">{r.name}</div>
              <ul className="divide-y divide-border">
                {list.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(i)}>
                      <p className="truncate font-medium">
                        {i.quantity}× {i.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {i.price_target != null
                          ? `Meta ${formatCurrency(Number(i.price_target))}`
                          : "Sem preço-meta"}
                        {i.price_actual != null &&
                          ` · Real ${formatCurrency(Number(i.price_actual))}`}
                        {i.responsible_user_id && ` · ${w.personName(i.responsible_user_id)}`}
                      </p>
                    </button>
                    <Badge variant={i.priority === "P1" ? "default" : "secondary"}>
                      {i.priority}
                    </Badge>
                    <Badge variant="outline">
                      {ITEM_STATUS[i.status as keyof typeof ITEM_STATUS]}
                    </Badge>
                    {i.status !== "bought" && (
                      <Button size="sm" variant="outline" onClick={() => setBuying(i)}>
                        Comprado
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          );
        })}
      <Panel className="flex flex-wrap gap-2">
        <Input
          placeholder="Novo cômodo ou categoria"
          value={newRoom}
          onChange={(e) => setNewRoom(e.target.value)}
          className="flex-1"
        />
        <Button
          variant="outline"
          disabled={!newRoom.trim()}
          onClick={() =>
            m.addRoom.mutate(newRoom.trim(), {
              onSuccess: () => setNewRoom(""),
              onError: (e) => toast.error(e.message),
            })
          }
        >
          Adicionar cômodo
        </Button>
      </Panel>
      {editing && (
        <ItemDialog
          w={w}
          m={m}
          item={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {buying && <BuyDialog w={w} m={m} item={buying} onClose={() => setBuying(null)} />}
    </div>
  );
}

function Filter({
  value,
  onChange,
  all,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  all: string;
  options: [string, string][];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{all}</SelectItem>
        {options.map(([k, v]) => (
          <SelectItem key={k} value={k}>
            {v}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ItemDialog({
  w,
  m,
  item,
  onClose,
}: {
  w: W;
  m: M;
  item: WeddingItem | null;
  onClose: () => void;
}) {
  const p = (v: number | null | undefined) => (v == null ? "" : String(v));
  const [f, setF] = useState({
    room_id: item?.room_id ?? w.rooms[0]?.id ?? "",
    name: item?.name ?? "",
    quantity: String(item?.quantity ?? 1),
    priority: item?.priority ?? "P2",
    status: item?.status ?? "to_research",
    price_low: p(item?.price_low),
    price_target: p(item?.price_target),
    price_high: p(item?.price_high),
    price_actual: p(item?.price_actual),
    responsible: item?.responsible_user_id ?? "none",
    links: (item?.links ?? []).join("\n"),
    notes: item?.notes ?? "",
  });
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const submit = () => {
    const input: ItemInput = {
      room_id: f.room_id,
      name: f.name,
      quantity: Number(f.quantity),
      priority: f.priority as Priority,
      status: f.status as ItemInput["status"],
      price_low: num(f.price_low),
      price_target: num(f.price_target),
      price_high: num(f.price_high),
      price_actual: num(f.price_actual),
      responsible_user_id: f.responsible === "none" ? null : f.responsible,
      links: f.links
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
      notes: f.notes.trim() || null,
    };
    const parsed = itemInputSchema.safeParse(input);
    if (!parsed.success) {
      toast.error("Confira nome, quantidade, preços (≥ 0) e links (URLs completas).");
      return;
    }
    m.saveItem.mutate(
      { id: item?.id, input: parsed.data },
      { onSuccess: onClose, onError: (e) => toast.error(e.message) },
    );
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Editar item" : "Novo item"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <F label="Nome" wide>
            <Input value={f.name} onChange={(e) => set("name")(e.target.value)} />
          </F>
          <F label="Cômodo">
            <Filter
              value={f.room_id}
              onChange={set("room_id")}
              all="—"
              options={w.rooms.map((r) => [r.id, r.name])}
            />
          </F>
          <F label="Quantidade">
            <Input
              type="number"
              min={1}
              value={f.quantity}
              onChange={(e) => set("quantity")(e.target.value)}
            />
          </F>
          <F label="Prioridade">
            <Filter
              value={f.priority}
              onChange={set("priority")}
              all="—"
              options={Object.entries(PRIORITIES)}
            />
          </F>
          <F label="Status">
            <Filter
              value={f.status}
              onChange={set("status")}
              all="—"
              options={Object.entries(ITEM_STATUS)}
            />
          </F>
          <F label="Faixa econômica (R$)">
            <Input
              inputMode="decimal"
              value={f.price_low}
              onChange={(e) => set("price_low")(e.target.value)}
            />
          </F>
          <F label="Preço-meta intermediário (R$)">
            <Input
              inputMode="decimal"
              value={f.price_target}
              onChange={(e) => set("price_target")(e.target.value)}
            />
          </F>
          <F label="Faixa premium (R$)">
            <Input
              inputMode="decimal"
              value={f.price_high}
              onChange={(e) => set("price_high")(e.target.value)}
            />
          </F>
          <F label="Preço real (R$)">
            <Input
              inputMode="decimal"
              value={f.price_actual}
              onChange={(e) => set("price_actual")(e.target.value)}
            />
          </F>
          <F label="Responsável">
            <Filter
              value={f.responsible}
              onChange={set("responsible")}
              all="—"
              options={[
                ["none", "Ninguém"],
                ...w.people.map((x) => [x.id, x.name] as [string, string]),
              ]}
            />
          </F>
          <F label="Links (um por linha)" wide>
            <Textarea value={f.links} onChange={(e) => set("links")(e.target.value)} />
          </F>
          <F label="Observações" wide>
            <Textarea value={f.notes} onChange={(e) => set("notes")(e.target.value)} />
          </F>
        </div>
        <DialogFooter className="gap-2">
          {item && (
            <Button
              variant="ghost"
              onClick={() =>
                confirm("Excluir este item?") &&
                m.deleteRow.mutate({ table: "wedding_items", id: item.id }, { onSuccess: onClose })
              }
            >
              <Trash2 className="size-4" /> Excluir
            </Button>
          )}
          <Button onClick={submit} disabled={m.saveItem.isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function F({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function BuyDialog({
  w,
  m,
  item,
  onClose,
}: {
  w: W;
  m: M;
  item: WeddingItem;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(
    item.price_target != null ? String(Number(item.price_target) * item.quantity) : "",
  );
  const [paidBy, setPaidBy] = useState(w.userId ?? "");
  const [split, setSplit] = useState<"equal" | "payer">("equal");
  const [date, setDate] = useState(today());
  const value = num(amount);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar compra — {item.name}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Gera uma despesa só dentro do Casamento. Nada é lançado no Financeiro geral.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <F label="Valor pago (R$)">
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </F>
          <F label="Data">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </F>
          <F label="Quem pagou">
            <Filter
              value={paidBy}
              onChange={setPaidBy}
              all="—"
              options={w.people.map((x) => [x.id, x.name])}
            />
          </F>
          <F label="Divisão">
            <Filter
              value={split}
              onChange={(v) => setSplit(v as "equal" | "payer")}
              all="—"
              options={[
                ["equal", "Metade cada"],
                ["payer", "Só quem pagou"],
              ]}
            />
          </F>
        </div>
        <DialogFooter>
          <Button
            disabled={!value || value <= 0 || !paidBy || m.buyItem.isPending}
            onClick={() =>
              m.buyItem.mutate(
                { item, amount: value!, paidBy, split, date },
                {
                  onSuccess: () => {
                    toast.success("Compra registrada.");
                    onClose();
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

function Savings({ w, m }: { w: W; m: M }) {
  const start = (w.plan?.savings_start ?? "2027-01-01").slice(0, 7) + "-01";
  const months = monthsFrom(start, 12);
  const [who, setWho] = useState(w.userId ?? "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const byMonth = (mo: string) =>
    w.contributions
      .filter((c) => c.contributed_on.slice(0, 7) === mo.slice(0, 7))
      .reduce((s, c) => s + Number(c.amount), 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {w.people.map((p) => (
          <Stat
            key={p.id}
            label={`Aportes — ${p.name}`}
            value={formatCurrency(
              w.contributions
                .filter((c) => c.user_id === p.id)
                .reduce((s, c) => s + Number(c.amount), 0),
            )}
          />
        ))}
        <Stat label="Total acumulado" value={formatCurrency(w.summary.saved)} />
      </div>
      <Panel>
        <PanelTitle>Registrar aporte</PanelTitle>
        <div className="flex flex-wrap gap-2">
          <Filter
            value={who}
            onChange={setWho}
            all="—"
            options={w.people.map((x) => [x.id, x.name])}
          />
          <Input
            inputMode="decimal"
            placeholder="Valor (R$)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full sm:w-36"
          />
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full sm:w-40"
          />
          <Button
            disabled={!num(amount) || !who}
            onClick={() =>
              m.addContribution.mutate(
                { userId: who, amount: num(amount)!, date, note: null },
                { onSuccess: () => setAmount(""), onError: (e) => toast.error(e.message) },
              )
            }
          >
            Adicionar
          </Button>
        </div>
      </Panel>
      <Panel>
        <PanelTitle>Metas mensais (12 meses a partir do início)</PanelTitle>
        <ul className="divide-y divide-border">
          {months.map((mo) => {
            const goal = w.goals.find((g) => g.month === mo);
            return (
              <li key={mo} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="w-28 capitalize">
                  {new Date(`${mo}T12:00:00`).toLocaleDateString("pt-BR", {
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <Input
                  key={goal?.target_amount ?? "x"}
                  inputMode="decimal"
                  placeholder="Meta (R$)"
                  defaultValue={goal ? String(goal.target_amount) : ""}
                  className="w-32"
                  onBlur={(e) => {
                    const v = num(e.target.value);
                    if (v != null && v >= 0 && v !== Number(goal?.target_amount))
                      m.setGoal.mutate(
                        { month: mo, amount: v },
                        { onError: (er) => toast.error(er.message) },
                      );
                  }}
                />
                <span className="text-muted-foreground">
                  Realizado {formatCurrency(byMonth(mo))}
                </span>
              </li>
            );
          })}
        </ul>
      </Panel>
      <RowList
        title="Aportes"
        rows={w.contributions.map((c) => ({
          id: c.id,
          main: `${w.personName(c.user_id)} · ${formatCurrency(Number(c.amount))}`,
          sub: c.contributed_on,
        }))}
        onDelete={(id) => m.deleteRow.mutate({ table: "wedding_contributions", id })}
      />
    </div>
  );
}

function Expenses({ w, m }: { w: W; m: M }) {
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState(w.userId ?? "");
  return (
    <div className="space-y-4">
      <Panel>
        <PanelTitle>Nova despesa (instalação, mudança, outros)</PanelTitle>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Descrição"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="flex-1"
          />
          <Input
            inputMode="decimal"
            placeholder="Valor (R$)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full sm:w-36"
          />
          <Filter
            value={paidBy}
            onChange={setPaidBy}
            all="—"
            options={w.people.map((x) => [x.id, x.name])}
          />
          <Button
            disabled={!desc.trim() || !num(amount) || !paidBy}
            onClick={() =>
              m.addExpense.mutate(
                {
                  description: desc.trim(),
                  amount: num(amount)!,
                  paidBy,
                  split: "equal",
                  date: today(),
                },
                {
                  onSuccess: () => {
                    setDesc("");
                    setAmount("");
                  },
                  onError: (e) => toast.error(e.message),
                },
              )
            }
          >
            Adicionar
          </Button>
        </div>
      </Panel>
      <RowList
        title={`Despesas · ${formatCurrency(w.summary.spent)}`}
        rows={w.expenses.map((e) => ({
          id: e.id,
          main: `${e.description} · ${formatCurrency(Number(e.amount))}`,
          sub: `${e.spent_on} · pago por ${w.personName(e.paid_by_user_id)} · ${e.split === "equal" ? "metade cada" : "só quem pagou"}`,
        }))}
        onDelete={(id) => m.deleteRow.mutate({ table: "wedding_expenses", id })}
      />
    </div>
  );
}

function Tasks({ w, m }: { w: W; m: M }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"task" | "decision" | "note">("task");
  const [due, setDue] = useState("");
  const [resp, setResp] = useState("none");
  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Tarefa, decisão ou nota"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1"
          />
          <Filter
            value={kind}
            onChange={(v) => setKind(v as typeof kind)}
            all="—"
            options={Object.entries(TASK_KIND)}
          />
          <Input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="w-full sm:w-40"
          />
          <Filter
            value={resp}
            onChange={setResp}
            all="—"
            options={[
              ["none", "Sem responsável"],
              ...w.people.map((x) => [x.id, x.name] as [string, string]),
            ]}
          />
          <Button
            disabled={!title.trim()}
            onClick={() =>
              m.addTask.mutate(
                {
                  title: title.trim(),
                  kind,
                  due: due || null,
                  responsible: resp === "none" ? null : resp,
                },
                { onSuccess: () => setTitle(""), onError: (e) => toast.error(e.message) },
              )
            }
          >
            Adicionar
          </Button>
        </div>
      </Panel>
      <Panel className="p-0">
        <ul className="divide-y divide-border">
          {w.tasks.length === 0 && (
            <li className="px-5 py-6 text-sm text-muted-foreground">Nenhum preparativo ainda.</li>
          )}
          {w.tasks.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p
                  className={`font-medium ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}
                >
                  {t.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {TASK_KIND[t.kind as keyof typeof TASK_KIND]} · {t.due_date ?? "sem prazo"} ·{" "}
                  {w.personName(t.responsible_user_id)}
                </p>
              </div>
              <Filter
                value={t.status}
                onChange={(v) => m.setTaskStatus.mutate({ id: t.id, status: v as "todo" })}
                all="—"
                options={Object.entries(TASK_STATUS)}
              />
              <Button
                size="icon"
                variant="ghost"
                aria-label="Excluir"
                onClick={() =>
                  confirm("Excluir?") && m.deleteRow.mutate({ table: "wedding_tasks", id: t.id })
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function Suppliers({ w, m }: { w: W; m: M }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [contact, setContact] = useState("");
  const [url, setUrl] = useState("");
  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Loja ou prestador"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="Categoria"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full sm:w-36"
          />
          <Input
            placeholder="Contato"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            className="w-full sm:w-40"
          />
          <Input
            placeholder="https://"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full sm:w-48"
          />
          <Button
            disabled={!name.trim()}
            onClick={() =>
              m.addSupplier.mutate(
                {
                  name: name.trim(),
                  category: category.trim() || null,
                  contact: contact.trim() || null,
                  url: url.trim() || null,
                },
                {
                  onSuccess: () => {
                    setName("");
                    setCategory("");
                    setContact("");
                    setUrl("");
                  },
                  onError: (e) => toast.error(e.message),
                },
              )
            }
          >
            Adicionar
          </Button>
        </div>
      </Panel>
      <RowList
        title="Fornecedores"
        rows={w.suppliers.map((s) => ({
          id: s.id,
          main: s.name,
          sub: [s.category, s.contact, s.url].filter(Boolean).join(" · "),
        }))}
        onDelete={(id) => m.deleteRow.mutate({ table: "wedding_suppliers", id })}
      />
    </div>
  );
}

function RowList({
  title,
  rows,
  onDelete,
}: {
  title: string;
  rows: { id: string; main: string; sub: string }[];
  onDelete: (id: string) => void;
}) {
  return (
    <Panel className="p-0">
      <div className="border-b border-border px-5 py-3 text-sm font-medium">{title}</div>
      <ul className="divide-y divide-border">
        {rows.length === 0 && (
          <li className="px-5 py-6 text-sm text-muted-foreground">Nada registrado ainda.</li>
        )}
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.main}</p>
              <p className="truncate text-xs text-muted-foreground">{r.sub}</p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Excluir"
              onClick={() => confirm("Excluir este registro?") && onDelete(r.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
