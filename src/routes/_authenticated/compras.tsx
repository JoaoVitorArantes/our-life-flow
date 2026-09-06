import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LayoutGrid, List } from "lucide-react";
import { PageHeader, Panel } from "@/components/common/page";
import { EmptyState, LoadingState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PurchaseCard } from "@/components/purchases/purchase-card";
import { PurchaseDetail } from "@/components/purchases/purchase-detail";
import { PurchaseDialog } from "@/components/purchases/purchase-dialog";
import { CreatedBy } from "@/components/common/created-by";
import { useApp } from "@/features/app/app-context";
import { useContexts, contextEmoji } from "@/features/contexts/queries";
import {
  budgetDelta,
  categoryEmoji,
  categoryLabel,
  personEmoji,
  personLabel,
  priorityEmoji,
  priorityLabel,
  statusDot,
  statusEmoji,
  statusLabel,

  usePurchases,
  PERSON_SCOPES,
  PURCHASE_CATEGORIES,
  PURCHASE_PRIORITIES,
  PURCHASE_STATUSES,
  type Purchase,
} from "@/features/purchases/queries";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/compras")({
  head: () => ({
    meta: [
      { title: "Compras — Life OS" },
      { name: "description", content: "Planejador de compras e desejos do casal." },
      { property: "og:title", content: "Compras — Life OS" },
      { property: "og:description", content: "O que vocês estão pensando em comprar." },
    ],
  }),
  component: Compras,
});

const ALL = "all";
const SORTS = [
  { value: "recent", label: "Mais recentes" },
  { value: "priority", label: "Prioridade" },
  { value: "price-asc", label: "Menor preço" },
  { value: "price-desc", label: "Maior preço" },
  { value: "budget", label: "Maior orçamento" },
  { value: "desired", label: "Data desejada" },
];

const PRIORITY_WEIGHT: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

function Stat({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <Panel className="p-4 transition-colors hover:border-primary/30">
      <p className="text-xs text-muted-foreground">
        {emoji} {label}
      </p>
      <p className="numeric mt-1 text-xl font-semibold">{value}</p>
    </Panel>
  );
}


function Compras() {
  const { workspaceId } = useApp();
  const { data: purchases = [], isLoading } = usePurchases(workspaceId);
  const { data: contexts = [] } = useContexts(workspaceId);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [priority, setPriority] = useState(ALL);
  const [person, setPerson] = useState(ALL);
  const [contextId, setContextId] = useState(ALL);
  const [sort, setSort] = useState("recent");
  const [view, setView] = useState<"cards" | "list">("cards");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Purchase | null>(null);
  const [detail, setDetail] = useState<Purchase | null>(null);

  const active = useMemo(
    () => purchases.filter((item) => item.status !== "DISCARDED"),
    [purchases],
  );

  const stats = useMemo(() => {
    const planned = active.filter((item) => item.status !== "PURCHASED");
    const budget = planned.reduce((sum, item) => sum + Number(item.budget_amount ?? 0), 0);
    const price = planned
      .filter((item) => item.found_price != null)
      .reduce((sum, item) => sum + Number(item.found_price), 0);
    const high = planned.filter((item) => item.priority === "HIGH").length;
    const under = planned.filter((item) => budgetDelta(item)?.under).length;
    const over = planned.filter((item) => budgetDelta(item)?.under === false).length;
    const saved = planned.reduce((sum, item) => {
      const delta = budgetDelta(item);
      return delta?.under ? sum + delta.diff : sum;
    }, 0);
    return { count: planned.length, budget, price, high, under, over, saved };
  }, [active]);


  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = purchases.filter((item) => {
      if (status !== ALL && item.status !== status) return false;
      if (status === ALL && item.status === "DISCARDED") return false;
      if (category !== ALL && item.category !== category) return false;
      if (priority !== ALL && item.priority !== priority) return false;
      if (person !== ALL && item.person_scope !== person) return false;
      if (contextId !== ALL && item.context_id !== contextId) return false;
      if (term) {
        const haystack = `${item.title} ${item.description ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sort) {
        case "priority":
          return (PRIORITY_WEIGHT[a.priority] ?? 3) - (PRIORITY_WEIGHT[b.priority] ?? 3);
        case "price-asc":
          return Number(a.found_price ?? Infinity) - Number(b.found_price ?? Infinity);
        case "price-desc":
          return Number(b.found_price ?? -Infinity) - Number(a.found_price ?? -Infinity);
        case "budget":
          return Number(b.budget_amount ?? 0) - Number(a.budget_amount ?? 0);
        case "desired":
          return (a.desired_date ?? "9999").localeCompare(b.desired_date ?? "9999");
        default:
          return b.created_at.localeCompare(a.created_at);
      }
    });
    return sorted;
  }, [purchases, search, status, category, priority, person, contextId, sort]);

  const summary = useMemo(() => {
    const lines: string[] = [];
    if (stats.count && stats.budget)
      lines.push(`Vocês têm ${formatCurrency(stats.budget)} em compras planejadas.`);
    if (stats.under) lines.push(`${stats.under} ${stats.under === 1 ? "compra está" : "compras estão"} abaixo do orçamento.`);
    if (stats.over) lines.push(`${stats.over} ${stats.over === 1 ? "compra está" : "compras estão"} acima do orçamento.`);
    if (stats.high) lines.push(`${stats.high} ${stats.high === 1 ? "compra é" : "compras são"} de alta prioridade.`);
    return lines;
  }, [stats]);

  if (isLoading) return <LoadingState />;

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Compras"
        subtitle="Desejos, achados e próximas compras 👀"
        action={
          <Button size="sm" onClick={openNew}>
            Quero isso
          </Button>
        }
      />

      {purchases.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-border bg-[radial-gradient(circle_at_50%_0%,color-mix(in_oklab,var(--primary)_12%,transparent),transparent_65%)] px-6 py-16 text-center">
          <span className="grid size-16 place-items-center rounded-2xl border border-primary/25 bg-primary/10 text-3xl">
            🛍️
          </span>
          <div className="space-y-1">
            <p className="text-base font-semibold">Por enquanto, a wishlist está vazia 👀</p>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              Tem alguma coisa que vocês estão namorando por aí?
            </p>
          </div>
          <Button size="sm" onClick={openNew}>
            Adicionar primeira coisa
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat emoji="🛍️" label="Desejos" value={String(stats.count)} />
            <Stat emoji="💰" label="Planejados" value={formatCurrency(stats.budget)} />
            {stats.saved > 0 ? (
              <Stat emoji="🤑" label="Economizados" value={formatCurrency(stats.saved)} />
            ) : (
              <Stat emoji="🔎" label="Melhores preços" value={formatCurrency(stats.price)} />
            )}
            <Stat emoji="🔥" label="Queremos muito" value={String(stats.high)} />
          </div>


          {summary.length ? (
            <Panel className="space-y-1 p-4 text-sm text-muted-foreground">
              {summary.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </Panel>
          ) : null}

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Buscar por nome ou descrição"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-10 w-full sm:max-w-xs"
              />
              <div className="ml-auto flex items-center gap-1 rounded-lg border border-border p-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Ver em cards"
                  className={cn("size-8", view === "cards" && "bg-primary/10 text-primary")}
                  onClick={() => setView("cards")}
                >
                  <LayoutGrid className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Ver em lista"
                  className={cn("size-8", view === "list" && "bg-primary/10 text-primary")}
                  onClick={() => setView("list")}
                >
                  <List className="size-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos os status</SelectItem>
                  {PURCHASE_STATUSES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Categoria" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas as categorias</SelectItem>
                  {PURCHASE_CATEGORIES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.emoji} {item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Prioridade" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas as prioridades</SelectItem>
                  {PURCHASE_PRIORITIES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={person} onValueChange={setPerson}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Pessoa" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas as pessoas</SelectItem>
                  {PERSON_SCOPES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={contextId} onValueChange={setContextId}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Contexto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos os contextos</SelectItem>
                  {contexts.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {contextEmoji(item.type)} {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SORTS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="Nada por aqui 👀" description="Ajuste os filtros ou a busca." />

          ) : view === "cards" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((purchase) => (
                <PurchaseCard key={purchase.id} purchase={purchase} onOpen={() => setDetail(purchase)} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((purchase) => (
                <button
                  key={purchase.id}
                  type="button"
                  onClick={() => setDetail(purchase)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left transition-colors hover:border-primary/30"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                    {categoryEmoji(purchase.category)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{purchase.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[
                        categoryLabel(purchase.category),
                        `${priorityEmoji(purchase.priority)} ${priorityLabel(purchase.priority)}`,
                        `${personEmoji(purchase.person_scope)} ${personLabel(purchase.person_scope)}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="hidden text-right text-xs text-muted-foreground sm:block">
                    {purchase.budget_amount != null ? (
                      <p className="numeric">Orç. {formatCurrency(Number(purchase.budget_amount))}</p>
                    ) : null}
                    {purchase.found_price != null ? (
                      <p className="numeric font-medium text-foreground">
                        {formatCurrency(Number(purchase.found_price))}
                      </p>
                    ) : (
                      <p>Preço a definir</p>
                    )}
                  </div>

                  <Badge variant="outline" className="shrink-0 gap-1.5">
                    <span className={cn("size-1.5 rounded-full", statusDot(purchase.status))} />
                    <span className="hidden sm:inline">{statusLabel(purchase.status)}</span>
                  </Badge>
                  <span className="hidden lg:block">
                    <CreatedBy userId={purchase.created_by} />
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <PurchaseDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        purchase={editing}
      />

      <PurchaseDetail
        purchase={detail}
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
        onEdit={(purchase) => {
          setDetail(null);
          setEditing(purchase);
          setDialogOpen(true);
        }}
      />
    </div>
  );
}
