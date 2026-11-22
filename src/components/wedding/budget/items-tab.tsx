import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, Plus, Search, Settings2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bar, SectionTitle } from "@/components/wedding/shell";
import {
  byCategory,
  filterItems,
  itemTotals,
  overview,
  STATUS_LABEL,
  STATUSES,
  SUGGESTED_CATEGORIES,
  type BudgetStatus,
  type ItemFilter,
} from "@/features/wedding/budget";
import type {
  WBudgetCategory,
  WBudgetItem,
  WBudgetPayment,
  WeddingBudgetMutations,
} from "@/features/wedding/budget-api";
import type { WeddingExpense, WeddingSupplier } from "@/features/wedding/api";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { fieldCls } from "./ui-utils";
import { DueTag, PayTag } from "./tags";

type Item = WBudgetItem & { planned_amount: number | null; contracted_amount: number | null };
type Pay = WBudgetPayment & { amount: number };

const money = (v: number) => formatCurrency(v);

export function ItemsTab({
  totalBudget,
  items,
  payments,
  categories,
  suppliers,
  expenses,
  m,
  onNew,
  onOpen,
  onManageCategories,
}: {
  totalBudget: number | null;
  items: Item[];
  payments: Pay[];
  categories: WBudgetCategory[];
  suppliers: WeddingSupplier[];
  expenses: WeddingExpense[];
  m: WeddingBudgetMutations;
  onNew: (categoryId?: string | null) => void;
  onOpen: (id: string) => void;
  onManageCategories: () => void;
}) {
  const [f, setF] = useState<ItemFilter>({ q: "", category: "all", status: "all", pay: "all" });
  const o = useMemo(
    () => overview(totalBudget, items, payments, expenses),
    [totalBudget, items, payments, expenses],
  );
  const supplierName = (id: string | null) =>
    id ? (suppliers.find((s) => s.id === id)?.name ?? null) : null;
  const filtered = filterItems(items, payments, f, supplierName);
  const groups = byCategory(
    filtered,
    payments,
    categories.map((c) => c.id),
  );
  const catName = (id: string) =>
    id === "none" ? "Sem categoria" : (categories.find((c) => c.id === id)?.name ?? "Categoria");
  const filtering = f.q || f.category !== "all" || f.status !== "all" || f.pay !== "all";
  const usedPct =
    o.totalBudget && o.totalBudget > 0 ? Math.round((o.committed / o.totalBudget) * 100) : null;

  return (
    <div className="space-y-5">
      <section className="wed-card space-y-4 p-4 sm:p-5" aria-label="Resumo do orçamento">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Orçamento total</p>
            <p className="wed-display text-2xl tabular-nums sm:text-3xl">
              {o.totalBudget != null ? money(o.totalBudget) : "Não definido"}
            </p>
            {o.totalBudget == null ? (
              <p className="text-xs text-muted-foreground">
                Defina o valor em Ajustes para ver o saldo.
              </p>
            ) : null}
          </div>
          {o.remaining != null ? (
            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                {o.remaining < 0 ? "Acima do orçamento" : "Saldo restante"}
              </p>
              <p
                className={cn(
                  "wed-display text-2xl tabular-nums",
                  o.remaining < 0 ? "text-destructive" : "text-primary",
                )}
              >
                {money(Math.abs(o.remaining))}
              </p>
            </div>
          ) : null}
        </div>
        {o.totalBudget && o.totalBudget > 0 ? (
          <div className="space-y-1">
            <Bar value={usedPct ?? 0} />
            <p className="text-xs text-muted-foreground">
              {usedPct}% comprometido (contratado, pagos sem contrato e avulsas)
            </p>
          </div>
        ) : null}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4 sm:grid-cols-4">
          <Figure label="Previsto nos itens" value={money(o.planned)} />
          <Figure label="Contratado" value={money(o.contracted)} />
          <Figure
            label="Pago"
            value={money(o.paid)}
            hint={o.avulsas > 0 ? `inclui ${money(o.avulsas)} avulsas` : undefined}
          />
          <Figure label="Falta pagar" value={money(o.pending)} hint="do contratado" />
        </dl>
      </section>

      {o.overdue || o.soon || o.withoutValue ? (
        <ul className="wed-card space-y-1 p-4 text-sm" aria-label="Avisos do orçamento">
          {o.overdue ? (
            <li className="text-destructive">
              • {o.overdue} item(ns) com vencimento passado
              {o.overdueAmount > 0 ? `, faltando ${money(o.overdueAmount)}` : ""}.{" "}
              <button
                type="button"
                className="underline"
                onClick={() => setF({ ...f, pay: "overdue" })}
              >
                Ver
              </button>
            </li>
          ) : null}
          {o.soon ? <li>• {o.soon} item(ns) vencem nos próximos 14 dias.</li> : null}
          {o.withoutValue ? (
            <li className="text-muted-foreground">
              • {o.withoutValue} item(ns) ainda sem valor previsto ou contratado (ficam fora das
              somas).{" "}
              <button
                type="button"
                className="underline"
                onClick={() => setF({ ...f, pay: "novalue" })}
              >
                Ver
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}

      {!categories.length && !items.length ? (
        <section className="wed-card space-y-3 p-6 text-center">
          <Sparkles className="mx-auto size-6 text-primary" aria-hidden />
          <h2 className="wed-display text-2xl">Comecem pelo que já sabem</h2>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            Cadastrem cada gasto do casamento — buffet, fotógrafo, vestido — com o valor previsto e,
            quando fecharem, o contratado. Os totais aparecem sozinhos, só com o que vocês
            registrarem.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => onNew()}>
              <Plus className="mr-1 size-4" /> Adicionar primeiro item
            </Button>
            <Button
              variant="outline"
              disabled={m.addSuggested.isPending}
              onClick={() =>
                m.addSuggested.mutate([], {
                  onSuccess: () => toast.success("Categorias criadas. Edite ou apague à vontade."),
                  onError: (e) => toast.error(e.message),
                })
              }
            >
              Usar categorias sugeridas
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Sugestões: {SUGGESTED_CATEGORIES.join(", ")}. Nenhum valor é criado.
          </p>
        </section>
      ) : (
        <section className="space-y-3">
          <SectionTitle
            action={
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={onManageCategories}>
                  <Settings2 className="mr-1 size-4" /> Categorias
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    onNew(f.category !== "all" && f.category !== "none" ? f.category : null)
                  }
                >
                  <Plus className="mr-1 size-4" /> Novo item
                </Button>
              </div>
            }
          >
            Itens do orçamento
          </SectionTitle>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                aria-label="Buscar itens"
                className="h-11 pl-9"
                placeholder="Buscar por nome, fornecedor ou nota"
                value={f.q}
                onChange={(e) => setF({ ...f, q: e.target.value })}
              />
            </div>
            <select
              aria-label="Filtrar por categoria"
              className={fieldCls}
              value={f.category}
              onChange={(e) => setF({ ...f, category: e.target.value })}
            >
              <option value="all">Todas as categorias</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="none">Sem categoria</option>
            </select>
            <select
              aria-label="Filtrar por situação"
              className={fieldCls}
              value={f.status}
              onChange={(e) => setF({ ...f, status: e.target.value })}
            >
              <option value="all">Qualquer situação</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrar por pagamento"
              className={fieldCls}
              value={f.pay}
              onChange={(e) => setF({ ...f, pay: e.target.value as ItemFilter["pay"] })}
            >
              <option value="all">Todos os pagamentos</option>
              <option value="pending">Falta pagar</option>
              <option value="paid">Quitados</option>
              <option value="overdue">Vencidos</option>
              <option value="novalue">Sem valor</option>
            </select>
          </div>
          {filtering ? (
            <button
              type="button"
              className="text-xs text-muted-foreground underline"
              onClick={() => setF({ q: "", category: "all", status: "all", pay: "all" })}
            >
              Limpar filtros ({filtered.length} de {items.length})
            </button>
          ) : null}

          {groups.length ? (
            groups.map((g) => (
              <section key={g.id} className="wed-card overflow-hidden" aria-label={catName(g.id)}>
                <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border px-4 py-3">
                  <h3 className="wed-display min-w-0 truncate text-lg">{catName(g.id)}</h3>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {g.planned > 0 ? `Previsto ${money(g.planned)} · ` : ""}
                    {g.contracted > 0 ? `Contratado ${money(g.contracted)} · ` : ""}
                    Pago {money(g.paid)}
                  </p>
                </header>
                <ul className="divide-y divide-border">
                  {g.items.map((i) => {
                    const t = itemTotals(i, payments);
                    const ref = t.contracted ?? t.planned;
                    return (
                      <li key={i.id}>
                        <button
                          type="button"
                          onClick={() => onOpen(i.id)}
                          className="grid w-full grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 text-left transition hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={`Abrir ${i.name}`}
                        >
                          <span className="min-w-0 space-y-1">
                            <span
                              className={cn(
                                "block break-words font-medium",
                                i.status === "cancelled" && "text-muted-foreground line-through",
                              )}
                            >
                              {i.name}
                            </span>
                            <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                              <span>{STATUS_LABEL[i.status as BudgetStatus] ?? i.status}</span>
                              {supplierName(i.supplier_id) ? (
                                <span>· {supplierName(i.supplier_id)}</span>
                              ) : null}
                              <PayTag state={t.payState} cancelled={i.status === "cancelled"} />
                              <DueTag state={t.due} date={i.due_date} />
                            </span>
                          </span>
                          <span className="flex items-center gap-2 text-right">
                            <span className="text-sm tabular-nums">
                              {ref == null ? (
                                <span className="text-muted-foreground">Sem valor</span>
                              ) : (
                                <>
                                  <span className="block font-semibold">{money(ref)}</span>
                                  <span className="block text-xs text-muted-foreground">
                                    {t.contracted == null
                                      ? "previsto"
                                      : t.pending
                                        ? `falta ${money(t.pending)}`
                                        : `pago ${money(t.paid)}`}
                                  </span>
                                </>
                              )}
                            </span>
                            <ChevronRight
                              className="size-4 shrink-0 text-muted-foreground"
                              aria-hidden
                            />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {g.id !== "none" ? (
                  <div className="border-t border-border px-4 py-2">
                    <Button size="sm" variant="ghost" onClick={() => onNew(g.id)}>
                      <Plus className="mr-1 size-4" /> Item em {catName(g.id)}
                    </Button>
                  </div>
                ) : null}
              </section>
            ))
          ) : (
            <div className="wed-card p-6 text-center text-sm text-muted-foreground">
              {items.length ? (
                "Nenhum item com esses filtros."
              ) : (
                <>
                  Nenhum item ainda.{" "}
                  <button type="button" className="underline" onClick={() => onNew()}>
                    Adicionar o primeiro
                  </button>
                </>
              )}
            </div>
          )}
          {!filtering
            ? categories.filter((c) => !items.some((i) => i.category_id === c.id)).slice(0, 20)
                .length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Categorias ainda sem itens:{" "}
                  {categories
                    .filter((c) => !items.some((i) => i.category_id === c.id))
                    .map((c, idx, arr) => (
                      <span key={c.id}>
                        <button type="button" className="underline" onClick={() => onNew(c.id)}>
                          {c.name}
                        </button>
                        {idx < arr.length - 1 ? ", " : ""}
                      </span>
                    ))}
                </p>
              )
            : null}
        </section>
      )}
    </div>
  );
}

function Figure({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-[15px] font-semibold tabular-nums [overflow-wrap:anywhere] sm:text-lg">
        {value}
      </dd>
      {hint ? <p className="truncate text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
