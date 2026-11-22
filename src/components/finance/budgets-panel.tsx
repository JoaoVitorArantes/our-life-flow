import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  History,
  Pencil,
  Plus,
  Repeat,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useApp } from "@/features/app/app-context";
import { todayISO } from "@/features/finance/calc";
import type { Category, Transaction } from "@/features/finance/queries";
import { useApplyBudgetOps, useBudgetRules } from "@/features/finance/budget-api";
import {
  ALL,
  expensesOf,
  inScope,
  parseMoney,
  planEdit,
  planStop,
  resolveBudgets,
  ruleKind,
  shiftMonth,
  spentByCategory,
  toMonthDate,
  type BudgetOp,
  type BudgetRule,
  type BudgetScope,
  type MonthKey,
} from "@/features/finance/budgets";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const label = (k: MonthKey) => `${MONTHS[Number(k.slice(5, 7)) - 1]}/${k.slice(0, 4)}`;
const selectCls =
  "h-10 rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function kindText(r: BudgetRule) {
  const k = ruleKind(r);
  const s = r.start_month.slice(0, 7);
  if (k === "recurring") return `Recorrente desde ${label(s)}`;
  if (k === "once") return `Só ${label(s)}`;
  return `${label(s)} até ${label(r.end_month!.slice(0, 7))}`;
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : value > 0 ? 100 : 0;
  const tone =
    max > 0 && value > max
      ? "bg-destructive"
      : max > 0 && value / max >= 0.85
        ? "bg-warning"
        : "bg-primary";
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-elevated"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-all", tone)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function Remaining({ planned, spent }: { planned: number; spent: number }) {
  if (planned <= 0) return null;
  const left = planned - spent;
  return left >= 0 ? (
    <span className="text-success">Disponível {formatCurrency(left)}</span>
  ) : (
    <span className="text-destructive">Excedido {formatCurrency(-left)}</span>
  );
}

type Pending = { rule: BudgetRule; amount: number } | null;

export function BudgetsPanel({
  transactions,
  categories,
}: {
  transactions: Transaction[];
  categories: Category[];
}) {
  const { workspaceId, userId, memberProfiles } = useApp();
  const rulesQ = useBudgetRules(workspaceId);
  const apply = useApplyBudgetOps(workspaceId, userId);
  const today = todayISO().slice(0, 7);
  const [month, setMonth] = useState<MonthKey>(today);
  const [scope, setScope] = useState<BudgetScope>("SHARED");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [choice, setChoice] = useState<Pending>(null);
  const [stopping, setStopping] = useState<BudgetRule | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [form, setForm] = useState({
    amount: "",
    mode: "recurring" as "recurring" | "once" | "range",
    until: shiftMonth(today, 2),
  });

  const me = userId ?? "";
  const rules = useMemo(() => rulesQ.data ?? [], [rulesQ.data]);
  const expenseCats = categories.filter((c) => c.type !== "INCOME");
  const activeCats = expenseCats.filter((c) => !c.archived_at);
  const budgets = useMemo(() => resolveBudgets(rules, month, scope, me), [rules, month, scope, me]);
  const spent = useMemo(
    () => spentByCategory(transactions, month, scope, me),
    [transactions, month, scope, me],
  );
  const overall = budgets.get(ALL);
  const catRows = expenseCats
    .map((c) => ({ c, b: budgets.get(c.id), spent: spent.byCategory.get(c.id) ?? 0 }))
    .filter((x) => !!x.b);
  const budgeted = catRows.filter((x) => x.b!.amount > 0);
  const planned = budgeted.reduce((t, x) => t + x.b!.amount, 0);
  const spentBudgeted = budgeted.reduce((t, x) => t + x.spent, 0);
  const unbudgetedSpend = spent.total - spentBudgeted;
  const free = activeCats.filter((c) => !budgets.get(c.id));
  const alerts: { tone: "bad" | "warn"; text: string }[] = [];
  if (overall && overall.amount > 0 && spent.total > overall.amount)
    alerts.push({
      tone: "bad",
      text: `O orçamento geral passou ${formatCurrency(spent.total - overall.amount)}.`,
    });
  for (const x of budgeted) {
    const ratio = x.spent / x.b!.amount;
    if (ratio > 1)
      alerts.push({
        tone: "bad",
        text: `${x.c.name} passou ${formatCurrency(x.spent - x.b!.amount)} do limite.`,
      });
    else if (ratio >= 0.85)
      alerts.push({
        tone: "warn",
        text: `${x.c.name} já usou ${Math.round(ratio * 100)}% do limite.`,
      });
  }
  const years = useMemo(() => {
    const ys = new Set<number>();
    const now = Number(today.slice(0, 4));
    for (let y = now - 5; y <= now + 5; y++) ys.add(y);
    ys.add(Number(month.slice(0, 4)));
    for (const r of rules) ys.add(Number(r.start_month.slice(0, 4)));
    for (const t of transactions) ys.add(Number(t.transaction_date.slice(0, 4)));
    return [...ys].filter((y) => y > 1900).sort();
  }, [today, month, rules, transactions]);
  const byPerson =
    scope === "SHARED"
      ? memberProfiles
          .map((p) => ({
            name: p.name || "Membro",
            total: expensesOf(transactions, month, "SHARED", me)
              .filter((t) => t.owner_id === p.id)
              .reduce((s, t) => s + (Number(t.amount) || 0), 0),
          }))
          .filter((x) => x.total > 0)
      : [];
  const scopeRules = rules.filter((r) => inScope(r, scope, me));
  const catName = (id: string | null) =>
    id ? (categories.find((c) => c.id === id)?.name ?? "Categoria") : "Orçamento geral";

  async function run(ops: BudgetOp[], ok: string) {
    setBusy(true);
    try {
      await apply(ops);
      toast.success(ok);
      setEditing(null);
      setChoice(null);
      setStopping(null);
      setAdding(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  function saveEdit(rule: BudgetRule) {
    const v = parseMoney(draft);
    if (v === null || Number.isNaN(v)) {
      toast.error("Informe um valor válido.");
      return;
    }
    if (v === Number(rule.amount)) {
      setEditing(null);
      return;
    }
    if (ruleKind(rule) === "once" && rule.start_month.slice(0, 7) === month) {
      void run(planEdit(rule, month, v, "month"), "Orçamento atualizado.");
      return;
    }
    setChoice({ rule, amount: v });
  }

  function create(categoryId: string | null) {
    const v = parseMoney(form.amount);
    if (v === null || Number.isNaN(v) || v <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    if (form.mode === "range" && form.until < month) {
      toast.error("O mês final deve ser depois do inicial.");
      return;
    }
    const end =
      form.mode === "recurring"
        ? null
        : form.mode === "once"
          ? toMonthDate(month)
          : toMonthDate(form.until);
    void run(
      [
        {
          type: "insert",
          row: {
            category_id: categoryId,
            visibility: scope === "SHARED" ? "SHARED" : "PRIVATE",
            amount: v,
            start_month: toMonthDate(month),
            end_month: end,
          },
        },
      ],
      "Orçamento criado.",
    );
  }

  const renderAdd = (categoryId: string | null) => (
    <div className="mt-3 grid gap-3 rounded-xl border border-border bg-elevated/40 p-3 sm:grid-cols-[140px_1fr_auto] sm:items-end">
      <div className="space-y-1">
        <Label htmlFor={`amt-${categoryId ?? "all"}`} className="text-xs">
          Limite
        </Label>
        <Input
          id={`amt-${categoryId ?? "all"}`}
          inputMode="decimal"
          placeholder="R$ 0,00"
          value={form.amount}
          autoFocus
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
        />
      </div>
      <div className="space-y-1">
        <span className="text-xs font-medium">Vale para</span>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["recurring", `Todo mês desde ${label(month)}`],
              ["once", `Só ${label(month)}`],
              ["range", "Até…"],
            ] as const
          ).map(([m, t]) => (
            <Button
              key={m}
              type="button"
              size="sm"
              variant={form.mode === m ? "default" : "outline"}
              onClick={() => setForm((f) => ({ ...f, mode: m }))}
            >
              {t}
            </Button>
          ))}
          {form.mode === "range" ? (
            <Input
              type="month"
              aria-label="Mês final"
              className="h-9 w-40"
              min={month}
              value={form.until}
              onChange={(e) => setForm((f) => ({ ...f, until: e.target.value }))}
            />
          ) : null}
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={() => create(categoryId)}>
          Salvar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setAdding(null)} aria-label="Cancelar">
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );

  const renderRow = (
    title: string,
    b: { rule: BudgetRule; amount: number },
    value: number,
    id: string,
  ) => (
    <li key={id} className="space-y-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{title}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {ruleKind(b.rule) === "recurring" ? (
              <Repeat className="size-3" aria-hidden />
            ) : (
              <CalendarRange className="size-3" aria-hidden />
            )}
            {kindText(b.rule)}
            {b.rule.from_legacy ? " · limite antigo da categoria" : ""}
          </p>
        </div>
        {editing === id ? (
          <div className="flex items-center gap-2">
            <Input
              aria-label={`Novo limite de ${title}`}
              inputMode="decimal"
              className="h-9 w-32"
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit(b.rule);
                if (e.key === "Escape") setEditing(null);
              }}
            />
            <Button size="sm" disabled={busy} onClick={() => saveEdit(b.rule)}>
              OK
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditing(null)}
              aria-label="Cancelar"
            >
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(id);
                setDraft(String(b.amount).replace(".", ","));
              }}
              aria-label={`Editar limite de ${title}`}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setStopping(b.rule)}
              aria-label={`Encerrar orçamento de ${title}`}
            >
              <X className="size-4" />
            </Button>
          </div>
        )}
      </div>
      {b.amount > 0 ? (
        <>
          <Bar value={value} max={b.amount} />
          <div className="flex flex-wrap justify-between gap-x-3 text-xs">
            <span className="numeric text-muted-foreground">
              {formatCurrency(value)} de {formatCurrency(b.amount)}
            </span>
            <Remaining planned={b.amount} spent={value} />
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Sem limite neste mês (exceção). Gasto: {formatCurrency(value)}
        </p>
      )}
    </li>
  );

  return (
    <div className="space-y-5">
      {/* Período e escopo */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            aria-label="Mês anterior"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <select
            aria-label="Mês"
            className={selectCls}
            value={month.slice(5, 7)}
            onChange={(e) => setMonth(`${month.slice(0, 4)}-${e.target.value}`)}
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={String(i + 1).padStart(2, "0")}>
                {m}
              </option>
            ))}
          </select>
          <select
            aria-label="Ano"
            className={selectCls}
            value={month.slice(0, 4)}
            onChange={(e) => setMonth(`${e.target.value}-${month.slice(5, 7)}`)}
          >
            {years.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
          <Button
            size="icon"
            variant="outline"
            aria-label="Próximo mês"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            size="sm"
            variant={month === today ? "secondary" : "outline"}
            onClick={() => setMonth(today)}
          >
            Hoje
          </Button>
        </div>
        <div
          className="grid grid-cols-2 gap-1 rounded-xl bg-elevated p-1"
          role="tablist"
          aria-label="De quem é o orçamento"
        >
          {(
            [
              ["SHARED", "Do casal"],
              ["MINE", "Só meu"],
            ] as const
          ).map(([s, t]) => (
            <button
              key={s}
              role="tab"
              aria-selected={scope === s}
              type="button"
              onClick={() => setScope(s)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm transition-colors",
                scope === s ? "bg-surface font-medium shadow-sm" : "text-muted-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {scope === "SHARED"
          ? "Limites do casal, comparados com os lançamentos compartilhados."
          : "Seus limites pessoais, comparados só com seus lançamentos privados — o outro não vê."}{" "}
        Orçamento é quanto planejam gastar; para juntar dinheiro, use{" "}
        <Link to="/metas" className="underline">
          Metas
        </Link>
        .
      </p>

      {rulesQ.isError ? (
        <p className="text-sm text-destructive">Não foi possível carregar os orçamentos.</p>
      ) : null}

      {alerts.length ? (
        <ul
          className="space-y-1 rounded-2xl border border-border bg-surface p-3 text-sm"
          aria-label="Alertas do orçamento"
        >
          {alerts.map((a) => (
            <li key={a.text} className={a.tone === "bad" ? "text-destructive" : "text-warning"}>
              • {a.text}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Resumo */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Planejado · {label(month)}
          </p>
          <p className="numeric mt-2 text-xl font-semibold">
            {formatCurrency(overall && overall.amount > 0 ? overall.amount : planned)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {overall && overall.amount > 0
              ? `Geral · categorias somam ${formatCurrency(planned)}`
              : `${budgeted.length} categoria(s) com limite`}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Realizado
          </p>
          <p className="numeric mt-2 text-xl font-semibold">{formatCurrency(spent.total)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {byPerson.length
              ? byPerson
                  .map((p) => `${p.name.split(" ")[0]} ${formatCurrency(p.total)}`)
                  .join(" · ")
              : "Despesas do mês, sem canceladas"}
          </p>
        </div>
        {(() => {
          const cap = overall && overall.amount > 0 ? overall.amount : planned;
          const used = overall && overall.amount > 0 ? spent.total : spentBudgeted;
          const left = cap - used;
          return (
            <div className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {left >= 0 ? "Disponível" : "Excedido"}
              </p>
              <p
                className={cn(
                  "numeric mt-2 text-xl font-semibold",
                  cap > 0 && (left >= 0 ? "text-primary" : "text-destructive"),
                )}
              >
                {cap > 0 ? formatCurrency(Math.abs(left)) : "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {unbudgetedSpend > 0 && !(overall && overall.amount > 0)
                  ? `${formatCurrency(unbudgetedSpend)} em categorias sem limite`
                  : cap > 0
                    ? `${Math.round((used / cap) * 100)}% usado`
                    : "Defina um limite abaixo"}
              </p>
            </div>
          );
        })()}
      </div>

      {/* Geral */}
      <section className="rounded-2xl border border-border bg-surface">
        {overall ? (
          <ul>{renderRow("Orçamento geral do mês", overall, spent.total, ALL)}</ul>
        ) : (
          <div className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">Orçamento geral (opcional)</p>
                <p className="text-xs text-muted-foreground">
                  Um teto para todas as despesas do mês, além dos limites por categoria.
                </p>
              </div>
              {adding !== ALL ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setAdding(ALL);
                    setForm((f) => ({ ...f, amount: "" }));
                  }}
                >
                  <Plus className="mr-1 size-4" />
                  Definir
                </Button>
              ) : null}
            </div>
            {adding === ALL ? renderAdd(null) : null}
          </div>
        )}
      </section>

      {/* Categorias */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Por categoria
        </h3>
        {catRows.length ? (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {catRows.map((x) => renderRow(x.c.name, x.b!, x.spent, x.c.id))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center">
            <p className="font-medium">Nenhum limite em {label(month)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Escolha uma categoria abaixo e defina quanto querem gastar. Um limite recorrente
              continua valendo nos próximos meses e anos.
            </p>
          </div>
        )}
        {free.length ? (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {free.map((c) => (
              <li key={c.id} className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm">{c.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="numeric text-xs text-muted-foreground">
                      {formatCurrency(spent.byCategory.get(c.id) ?? 0)}
                    </span>
                    {adding !== c.id ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setAdding(c.id);
                          setForm((f) => ({ ...f, amount: "" }));
                        }}
                      >
                        <Plus className="mr-1 size-4" />
                        Limite
                      </Button>
                    ) : null}
                  </span>
                </div>
                {adding === c.id ? renderAdd(c.id) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {!activeCats.length ? (
          <p className="text-sm text-muted-foreground">
            Crie categorias de despesa em Configurações → Categorias para orçar.
          </p>
        ) : null}
      </section>

      {/* Histórico */}
      {scopeRules.length ? (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <History className="mr-1 size-4" />
              Histórico de limites ({scopeRules.length})
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="mt-2 divide-y divide-border rounded-2xl border border-border bg-surface text-sm">
              {[...scopeRules]
                .sort((a, b) => b.start_month.localeCompare(a.start_month))
                .map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                    <span className="min-w-0 truncate">{catName(r.category_id)}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{kindText(r)}</Badge>
                      <span className="numeric">
                        {Number(r.amount) > 0 ? formatCurrency(Number(r.amount)) : "sem limite"}
                      </span>
                    </span>
                  </li>
                ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      {/* Escolha: só este mês ou daqui em diante */}
      <AlertDialog open={!!choice} onOpenChange={(o) => !o && setChoice(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Mudar para {choice ? formatCurrency(choice.amount) : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Escolha até quando vale. Os meses anteriores a {label(month)} continuam como estavam.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                choice &&
                run(
                  planEdit(choice.rule, month, choice.amount, "month"),
                  `Limite alterado só em ${label(month)}.`,
                )
              }
            >
              Só em {label(month)}
            </Button>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                if (choice)
                  void run(
                    planEdit(choice.rule, month, choice.amount, "forward"),
                    `Limite alterado a partir de ${label(month)}.`,
                  );
              }}
            >
              De {label(month)} em diante
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!stopping} onOpenChange={(o) => !o && setStopping(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar este limite?</AlertDialogTitle>
            <AlertDialogDescription>
              {stopping && ruleKind(stopping) === "once"
                ? `A exceção de ${label(month)} será removida e volta a valer a regra anterior, se houver.`
                : stopping && stopping.start_month.slice(0, 7) >= month
                  ? `Este limite começa em ${label(stopping.start_month.slice(0, 7))} e será removido.`
                  : `Deixa de valer a partir de ${label(month)}. Meses anteriores continuam no histórico.`}{" "}
              Nenhum lançamento é apagado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                if (stopping)
                  void run(
                    ruleKind(stopping) === "once"
                      ? [{ type: "delete", id: stopping.id }]
                      : planStop(stopping, month),
                    "Limite encerrado.",
                  );
              }}
            >
              Encerrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
