import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  History,
  MoreHorizontal,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import type { Category } from "@/features/finance/queries";
import {
  useApplyBudgetOps,
  useBudgetRules,
  useBudgetYearExpenses,
} from "@/features/finance/budget-api";
import {
  ALL,
  budgetState,
  byOwner,
  expensesOf,
  inScope,
  monthSummary,
  parseMoney,
  parseYear,
  planEdit,
  planStop,
  ruleKind,
  shiftMonth,
  toMonthDate,
  yearSummary,
  type BudgetOp,
  type BudgetRule,
  type BudgetScope,
  type BudgetState,
  type MonthKey,
} from "@/features/finance/budgets";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTHS_LONG = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const label = (k: MonthKey) => `${MONTHS[Number(k.slice(5, 7)) - 1]}/${k.slice(0, 4)}`;
const longLabel = (k: MonthKey) => `${MONTHS_LONG[Number(k.slice(5, 7)) - 1]} de ${k.slice(0, 4)}`;
const monthKey = (y: number, m: number) =>
  `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}`;
const selectCls =
  "h-9 rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const TONE: Record<BudgetState, { bar: string; text: string; label: string }> = {
  none: { bar: "bg-muted-foreground/40", text: "text-muted-foreground", label: "Sem limite" },
  ok: { bar: "bg-primary", text: "text-success", label: "No limite" },
  warn: { bar: "bg-warning", text: "text-warning", label: "Atenção" },
  over: { bar: "bg-destructive", text: "text-destructive", label: "Excedido" },
};

function kindText(r: BudgetRule) {
  const k = ruleKind(r);
  const s = r.start_month.slice(0, 7);
  if (k === "recurring") return `Todo mês desde ${label(s)}`;
  if (k === "once") return Number(r.amount) > 0 ? `Só em ${label(s)}` : `Pausado em ${label(s)}`;
  return `${label(s)} até ${label(r.end_month!.slice(0, 7))}`;
}

function Bar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const state = budgetState(value, max);
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-elevated", className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-all", TONE[state].bar)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  label: aria,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly (readonly [T, string])[];
  label: string;
}) {
  return (
    <div
      className="inline-grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-elevated p-1"
      role="tablist"
      aria-label={aria}
    >
      {options.map(([v, t]) => (
        <button
          key={v}
          role="tab"
          aria-selected={value === v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors",
            value === v ? "bg-surface font-medium shadow-sm" : "text-muted-foreground",
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

/** Seletor de mês/ano: setas de ano + campo para digitar qualquer ano, sem faixa fixa. */
function PeriodPicker({
  month,
  today,
  onPick,
}: {
  month: MonthKey;
  today: MonthKey;
  onPick: (k: MonthKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(month.slice(0, 4)));
  const [typed, setTyped] = useState(month.slice(0, 4));
  const go = (y: number) => {
    setYear(y);
    setTyped(String(y));
  };
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) go(Number(month.slice(0, 4)));
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 min-w-0 flex-1 justify-center gap-2 px-1 text-[15px] font-semibold sm:flex-none sm:px-3 sm:text-base"
          aria-label={`Escolher mês e ano (atual: ${longLabel(month)})`}
        >
          <CalendarDays
            className="hidden size-4 shrink-0 text-muted-foreground sm:block"
            aria-hidden
          />
          <span className="truncate">{longLabel(month)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="center">
        <div className="mb-3 flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            className="size-9"
            aria-label="Ano anterior"
            onClick={() => go(Math.max(1900, year - 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Input
            aria-label="Ano"
            inputMode="numeric"
            className="h-9 flex-1 text-center font-semibold"
            value={typed}
            maxLength={4}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "");
              setTyped(v);
              const y = parseYear(v);
              if (y) setYear(y);
            }}
          />
          <Button
            size="icon"
            variant="outline"
            className="size-9"
            aria-label="Próximo ano"
            onClick={() => go(Math.min(9999, year + 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {MONTHS.map((m, i) => {
            const k = monthKey(year, i + 1);
            return (
              <Button
                key={m}
                size="sm"
                variant={k === month ? "default" : k === today ? "secondary" : "ghost"}
                onClick={() => {
                  onPick(k);
                  setOpen(false);
                }}
              >
                {m}
              </Button>
            );
          })}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="mt-3 w-full"
          onClick={() => {
            onPick(today);
            setOpen(false);
          }}
        >
          Ir para hoje ({label(today)})
        </Button>
      </PopoverContent>
    </Popover>
  );
}

type Draft = {
  categoryId: string;
  amount: string;
  mode: "recurring" | "once" | "range";
  until: MonthKey;
  shared: boolean;
};

export function BudgetsPanel({ categories }: { categories: Category[] }) {
  const { workspaceId, userId, memberProfiles } = useApp();
  const today = todayISO().slice(0, 7);
  const [month, setMonth] = useState<MonthKey>(today);
  const [view, setView] = useState<"month" | "year">("month");
  const [scope, setScope] = useState<BudgetScope>("SHARED");
  const [who, setWho] = useState<string>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [choice, setChoice] = useState<{ rule: BudgetRule; amount: number } | null>(null);
  const [stopping, setStopping] = useState<BudgetRule | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState<Draft | null>(null);

  const year = Number(month.slice(0, 4));
  const rulesQ = useBudgetRules(workspaceId);
  const txQ = useBudgetYearExpenses(workspaceId, year);
  const apply = useApplyBudgetOps(workspaceId, userId);
  const me = userId ?? "";
  const rules = useMemo(() => rulesQ.data ?? [], [rulesQ.data]);
  const ownerFilter = scope === "SHARED" && who !== "all" ? who : null;
  const txs = useMemo(() => byOwner(txQ.data ?? [], ownerFilter), [txQ.data, ownerFilter]);

  const expenseCats = categories.filter((c) => c.type !== "INCOME");
  const activeCats = expenseCats.filter((c) => !c.archived_at);
  const s = useMemo(
    () => monthSummary(rules, txs, month, scope, me),
    [rules, txs, month, scope, me],
  );
  const ys = useMemo(
    () => (view === "year" ? yearSummary(rules, txs, year, scope, me) : null),
    [view, rules, txs, year, scope, me],
  );
  const overall = s.budgets.get(ALL);
  const catRows = expenseCats
    .map((c) => ({ c, b: s.budgets.get(c.id), spent: s.spent.byCategory.get(c.id) ?? 0 }))
    .filter((x) => !!x.b)
    .sort((a, b) => b.spent / (b.b!.amount || 1) - a.spent / (a.b!.amount || 1));
  const free = activeCats.filter((c) => !s.budgets.get(c.id));
  const scopeRules = rules.filter((r) => inScope(r, scope, me));
  const nameOf = (id: string) =>
    id === me ? "você" : (memberProfiles.find((p) => p.id === id)?.name || "Membro").split(" ")[0]!;
  const catName = (id: string | null) =>
    id ? (categories.find((c) => c.id === id)?.name ?? "Categoria") : "Orçamento geral";
  const byPerson =
    scope === "SHARED" && !ownerFilter && memberProfiles.length > 1
      ? memberProfiles
          .map((p) => ({
            name: nameOf(p.id),
            total: expensesOf(txs, month, "SHARED", me)
              .filter((t) => t.owner_id === p.id)
              .reduce((t, x) => t + (Number(x.amount) || 0), 0),
          }))
          .filter((x) => x.total > 0)
      : [];
  const alerts: { tone: "over" | "warn"; text: string }[] = [];
  if (overall && overall.amount > 0 && s.spentTotal > overall.amount)
    alerts.push({
      tone: "over",
      text: `O orçamento geral passou ${formatCurrency(s.spentTotal - overall.amount)}.`,
    });
  for (const x of catRows) {
    const st = budgetState(x.spent, x.b!.amount);
    if (st === "over")
      alerts.push({
        tone: "over",
        text: `${x.c.name} passou ${formatCurrency(x.spent - x.b!.amount)} do limite.`,
      });
    else if (st === "warn")
      alerts.push({
        tone: "warn",
        text: `${x.c.name} já usou ${Math.round((x.spent / x.b!.amount) * 100)}% do limite.`,
      });
  }

  async function run(ops: BudgetOp[], ok: string) {
    setBusy(true);
    try {
      await apply(ops);
      toast.success(ok);
      setEditing(null);
      setChoice(null);
      setStopping(null);
      setCreating(null);
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

  const openCreate = (categoryId: string = ALL) =>
    setCreating({
      categoryId,
      amount: "",
      mode: "recurring",
      until: shiftMonth(month, 2),
      shared: scope === "SHARED",
    });

  function create() {
    if (!creating) return;
    const v = parseMoney(creating.amount);
    if (v === null || Number.isNaN(v) || v <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    if (creating.mode === "range" && !(creating.until > month)) {
      toast.error("O mês final deve ser depois do mês inicial.");
      return;
    }
    const visibility = creating.shared ? "SHARED" : "PRIVATE";
    const target = creating.shared ? "SHARED" : "MINE";
    const categoryId = creating.categoryId === ALL ? null : creating.categoryId;
    if (resolveExisting(target, creating.categoryId)) {
      toast.error("Essa categoria já tem limite neste mês. Edite o valor na lista.");
      return;
    }
    const end =
      creating.mode === "recurring"
        ? null
        : creating.mode === "once"
          ? toMonthDate(month)
          : toMonthDate(creating.until);
    void run(
      [
        {
          type: "insert",
          row: {
            category_id: categoryId,
            visibility,
            amount: v,
            start_month: toMonthDate(month),
            end_month: end,
          },
        },
      ],
      "Orçamento criado.",
    );
  }
  function resolveExisting(target: BudgetScope, categoryId: string) {
    const m = monthSummary(rules, [], month, target, me);
    const hit = m.budgets.get(categoryId);
    return !!hit && hit.amount > 0;
  }

  const renderRow = (
    title: string,
    b: { rule: BudgetRule; amount: number },
    value: number,
    id: string,
  ) => {
    const state = budgetState(value, b.amount);
    const isOnceHere = ruleKind(b.rule) === "once" && b.rule.start_month.slice(0, 7) === month;
    return (
      <li key={id} className="space-y-2 px-4 py-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{title}</p>
            <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
              {ruleKind(b.rule) === "recurring" ? (
                <Repeat className="size-3" aria-hidden />
              ) : (
                <CalendarRange className="size-3" aria-hidden />
              )}
              <span>{kindText(b.rule)}</span>
              <span aria-hidden>·</span>
              <span>
                {b.rule.visibility === "SHARED"
                  ? `do casal, criado por ${nameOf(b.rule.owner_id)}`
                  : "pessoal, só você vê"}
              </span>
              {b.rule.from_legacy ? <span>· limite antigo da categoria</span> : null}
            </p>
          </div>
          {editing === id ? null : (
            <div className="flex shrink-0 items-center">
              <Button
                size="icon"
                variant="ghost"
                className="size-9"
                onClick={() => {
                  setEditing(id);
                  setDraft(String(b.amount).replace(".", ","));
                }}
                aria-label={`Editar limite de ${title}`}
              >
                <Pencil className="size-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-9"
                    aria-label={`Mais ações de ${title}`}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isOnceHere ? (
                    <DropdownMenuItem
                      onSelect={() =>
                        void run(
                          [{ type: "delete", id: b.rule.id }],
                          `Exceção de ${label(month)} removida.`,
                        )
                      }
                    >
                      Remover exceção de {label(month)}
                    </DropdownMenuItem>
                  ) : (
                    <>
                      <DropdownMenuItem
                        onSelect={() => {
                          setEditing(id);
                          setDraft(String(b.amount).replace(".", ","));
                        }}
                      >
                        Mudar valor…
                      </DropdownMenuItem>
                      {b.amount > 0 ? (
                        <DropdownMenuItem
                          onSelect={() =>
                            void run(
                              planEdit(b.rule, month, 0, "month"),
                              `Limite pausado só em ${label(month)}.`,
                            )
                          }
                        >
                          Pausar só em {label(month)}
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => setStopping(b.rule)}
                      >
                        Encerrar a partir de {label(month)}…
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
        {editing === id ? (
          <div className="flex items-center gap-2">
            <Input
              aria-label={`Novo limite de ${title}`}
              inputMode="decimal"
              className="h-9 flex-1 sm:max-w-40"
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit(b.rule);
                if (e.key === "Escape") setEditing(null);
              }}
            />
            <Button size="sm" disabled={busy} onClick={() => saveEdit(b.rule)}>
              Salvar
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-9"
              onClick={() => setEditing(null)}
              aria-label="Cancelar"
            >
              <X className="size-4" />
            </Button>
          </div>
        ) : null}
        {b.amount > 0 ? (
          <>
            <Bar value={value} max={b.amount} />
            <div className="flex flex-wrap justify-between gap-x-3 text-xs">
              <span className="numeric text-muted-foreground">
                {formatCurrency(value)} de {formatCurrency(b.amount)}
              </span>
              <span className={cn("numeric", TONE[state].text)}>
                {state === "over"
                  ? `Excedido ${formatCurrency(value - b.amount)}`
                  : `Disponível ${formatCurrency(b.amount - value)}`}
              </span>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Sem limite em {label(month)}. Gasto: {formatCurrency(value)}
          </p>
        )}
      </li>
    );
  };

  const loading = rulesQ.isLoading || txQ.isLoading;
  const noRulesAtAll = !rulesQ.isLoading && scopeRules.length === 0;

  return (
    <div className="space-y-4">
      {/* Cabeçalho: período, visão e filtros */}
      <div className="space-y-3 rounded-2xl border border-border bg-surface p-3">
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="outline"
            className="size-10 shrink-0"
            aria-label={view === "year" ? "Ano anterior" : "Mês anterior"}
            onClick={() => setMonth((m) => shiftMonth(m, view === "year" ? -12 : -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          {view === "year" ? (
            <p className="flex h-10 flex-1 items-center justify-center text-base font-semibold sm:flex-none sm:px-3">
              Ano de {year}
            </p>
          ) : (
            <PeriodPicker month={month} today={today} onPick={setMonth} />
          )}
          <Button
            size="icon"
            variant="outline"
            className="size-10 shrink-0"
            aria-label={view === "year" ? "Próximo ano" : "Próximo mês"}
            onClick={() => setMonth((m) => shiftMonth(m, view === "year" ? 12 : 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            size="sm"
            variant={month === today ? "secondary" : "outline"}
            className="ml-1 hidden h-10 shrink-0 sm:inline-flex"
            onClick={() => setMonth(today)}
          >
            Hoje
          </Button>
          <div className="ml-auto hidden sm:block">
            <Segmented
              label="Visão"
              value={view}
              onChange={setView}
              options={[
                ["month", "Mês"],
                ["year", "Ano"],
              ]}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={month === today ? "secondary" : "outline"}
            className="h-9 sm:hidden"
            onClick={() => setMonth(today)}
          >
            Hoje
          </Button>
          <div className="sm:hidden">
            <Segmented
              label="Visão"
              value={view}
              onChange={setView}
              options={[
                ["month", "Mês"],
                ["year", "Ano"],
              ]}
            />
          </div>
          <Segmented
            label="De quem é o orçamento"
            value={scope}
            onChange={(v) => {
              setScope(v);
              setWho("all");
            }}
            options={[
              ["SHARED", "Do casal"],
              ["MINE", "Só meu"],
            ]}
          />
          {scope === "SHARED" && memberProfiles.length > 1 ? (
            <select
              aria-label="Gastos de quem"
              className={selectCls}
              value={who}
              onChange={(e) => setWho(e.target.value)}
            >
              <option value="all">Gastos de todos</option>
              {memberProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  Gastos de {p.id === me ? "você" : nameOf(p.id)}
                </option>
              ))}
            </select>
          ) : null}
          <Button size="sm" className="ml-auto h-9" onClick={() => openCreate()}>
            <Plus className="mr-1 size-4" />
            Novo orçamento
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {scope === "SHARED"
          ? ownerFilter
            ? `Limites do casal comparados só com os gastos compartilhados de ${nameOf(ownerFilter)}.`
            : "Limites do casal comparados com os gastos compartilhados."
          : "Seus limites pessoais, comparados só com seus lançamentos privados. O outro não vê."}{" "}
        Orçamento é quanto planejam gastar; para juntar dinheiro, use{" "}
        <Link to="/metas" className="underline">
          Metas
        </Link>
        .
      </p>

      {rulesQ.isError || txQ.isError ? (
        <p className="text-sm text-destructive">
          Não foi possível carregar os orçamentos. Tente de novo em instantes.
        </p>
      ) : null}

      {view === "year" && ys ? (
        <YearView
          ys={ys}
          year={year}
          today={today}
          loading={loading}
          onOpen={(k) => {
            setMonth(k);
            setView("month");
          }}
          onCreate={() => openCreate()}
        />
      ) : (
        <>
          {/* Resumo do mês */}
          <section
            className="rounded-2xl border border-border bg-surface p-4"
            aria-label={`Resumo de ${longLabel(month)}`}
          >
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <Stat
                title="Orçado"
                value={s.planned > 0 ? formatCurrency(s.planned) : "—"}
                hint={
                  s.hasOverall
                    ? "Teto geral do mês"
                    : `${catRows.filter((x) => x.b!.amount > 0).length} categoria(s)`
                }
              />
              <Stat
                title="Realizado"
                value={formatCurrency(s.spentTotal)}
                hint={
                  byPerson.length
                    ? byPerson.map((p) => `${p.name} ${formatCurrency(p.total)}`).join(" · ")
                    : "Sem cancelados"
                }
              />
              <Stat
                title={s.left >= 0 ? "Disponível" : "Excedido"}
                value={s.planned > 0 ? formatCurrency(Math.abs(s.left)) : "—"}
                tone={s.planned > 0 ? (s.left >= 0 ? "text-primary" : "text-destructive") : ""}
                hint={
                  s.unbudgeted > 0
                    ? `${formatCurrency(s.unbudgeted)} fora dos limites`
                    : s.planned > 0
                      ? "Do que foi orçado"
                      : "Defina um limite"
                }
              />
              <Stat
                title="Usado"
                value={s.pct === null ? "—" : `${s.pct}%`}
                tone={TONE[s.state].text}
                hint={TONE[s.state].label}
              />
            </div>
            {s.planned > 0 ? <Bar value={s.used} max={s.planned} className="mt-4" /> : null}
          </section>

          {alerts.length ? (
            <ul
              className="space-y-1 rounded-2xl border border-border bg-surface p-3 text-sm"
              aria-label="Alertas do orçamento"
            >
              {alerts.map((a) => (
                <li key={a.text} className={TONE[a.tone].text}>
                  • {a.text}
                </li>
              ))}
            </ul>
          ) : null}

          {noRulesAtAll ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center">
              <p className="font-medium">
                {scope === "SHARED"
                  ? "Nenhum orçamento do casal ainda"
                  : "Nenhum orçamento pessoal ainda"}
              </p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Defina quanto querem gastar por mês numa categoria, ou um teto geral. Um limite
                “todo mês” continua valendo nos próximos meses e anos até vocês mudarem ou
                encerrarem.
              </p>
              <Button className="mt-4" onClick={() => openCreate()}>
                <Plus className="mr-1 size-4" />
                Criar primeiro orçamento
              </Button>
            </div>
          ) : (
            <>
              {overall ? (
                <section className="rounded-2xl border border-border bg-surface">
                  <ul>{renderRow("Orçamento geral do mês", overall, s.spentTotal, ALL)}</ul>
                </section>
              ) : null}

              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Por categoria · {label(month)}
                </h3>
                {catRows.length ? (
                  <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
                    {catRows.map((x) => renderRow(x.c.name, x.b!, x.spent, x.c.id))}
                  </ul>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                    Nenhum limite por categoria vale em {label(month)}.{" "}
                    <button type="button" className="underline" onClick={() => openCreate()}>
                      Criar um
                    </button>
                  </div>
                )}
              </section>
            </>
          )}

          {free.length && !noRulesAtAll ? (
            <Collapsible defaultOpen={!catRows.length}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  Categorias sem limite em {label(month)} ({free.length})
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="mt-1 divide-y divide-border rounded-2xl border border-border bg-surface">
                  {free.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <span className="min-w-0 truncate text-sm">{c.name}</span>
                      <span className="flex shrink-0 items-center gap-1">
                        <span className="numeric text-xs text-muted-foreground">
                          {formatCurrency(s.spent.byCategory.get(c.id) ?? 0)}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openCreate(c.id)}
                          aria-label={`Definir limite de ${c.name}`}
                        >
                          <Plus className="mr-1 size-4" />
                          Limite
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          ) : null}
          {!activeCats.length ? (
            <p className="text-sm text-muted-foreground">
              Para limites por categoria, crie categorias de despesa em Configurações → Categorias.
            </p>
          ) : null}
        </>
      )}

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
                    <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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

      {/* Novo orçamento */}
      <Dialog open={!!creating} onOpenChange={(o) => !o && setCreating(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo orçamento</DialogTitle>
            <DialogDescription>
              Começa em {longLabel(month)}. Não cria nenhum lançamento.
            </DialogDescription>
          </DialogHeader>
          {creating ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="budget-cat">O quê</Label>
                <select
                  id="budget-cat"
                  className={cn(selectCls, "h-10 w-full")}
                  value={creating.categoryId}
                  onChange={(e) => setCreating({ ...creating, categoryId: e.target.value })}
                >
                  <option value={ALL}>Orçamento geral (todas as despesas)</option>
                  {activeCats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="budget-amount">Limite por mês</Label>
                <Input
                  id="budget-amount"
                  inputMode="decimal"
                  placeholder="R$ 0,00"
                  value={creating.amount}
                  autoFocus
                  onChange={(e) => setCreating({ ...creating, amount: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && create()}
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-sm font-medium">Vale para</span>
                <div className="grid gap-2">
                  {(
                    [
                      [
                        "recurring",
                        `Todo mês a partir de ${label(month)}`,
                        "Continua nos anos seguintes até vocês mudarem.",
                      ],
                      ["once", `Só ${label(month)}`, "Um limite pontual para este mês."],
                      ["range", "Um período", "De " + label(month) + " até o mês que escolher."],
                    ] as const
                  ).map(([m, t, h]) => (
                    <label
                      key={m}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm",
                        creating.mode === m ? "border-primary bg-primary/5" : "border-border",
                      )}
                    >
                      <input
                        type="radio"
                        name="budget-mode"
                        className="mt-1 accent-primary"
                        checked={creating.mode === m}
                        onChange={() => setCreating({ ...creating, mode: m })}
                      />
                      <span>
                        <span className="block font-medium">{t}</span>
                        <span className="text-xs text-muted-foreground">{h}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {creating.mode === "range" ? (
                  <Input
                    type="month"
                    aria-label="Mês final"
                    className="mt-2"
                    min={shiftMonth(month, 1)}
                    value={creating.until}
                    onChange={(e) => setCreating({ ...creating, until: e.target.value })}
                  />
                ) : null}
              </div>
              <div className="space-y-1.5">
                <span className="text-sm font-medium">De quem</span>
                <div>
                  <Segmented
                    label="De quem é o novo orçamento"
                    value={creating.shared ? "s" : "p"}
                    onChange={(v) => setCreating({ ...creating, shared: v === "s" })}
                    options={[
                      ["s", "Do casal"],
                      ["p", "Só meu"],
                    ]}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {creating.shared
                    ? "Os dois veem e comparam com os gastos compartilhados."
                    : "Só você vê, comparado com seus lançamentos privados."}
                </p>
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setCreating(null)}>
              Cancelar
            </Button>
            <Button disabled={busy} onClick={create}>
              Salvar orçamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              {stopping && stopping.start_month.slice(0, 7) >= month
                ? `Este limite começa em ${label(stopping.start_month.slice(0, 7))} e será removido.`
                : `Deixa de valer a partir de ${label(month)}. Os meses anteriores continuam no histórico.`}{" "}
              Nenhum lançamento é apagado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                if (stopping) void run(planStop(stopping, month), "Limite encerrado.");
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

function Stat({
  title,
  value,
  hint,
  tone,
}: {
  title: string;
  value: string;
  hint: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </p>
      <p className={cn("numeric mt-1 truncate text-lg font-semibold sm:text-xl", tone)}>{value}</p>
      <p className="truncate text-xs text-muted-foreground" title={hint}>
        {hint}
      </p>
    </div>
  );
}

function YearView({
  ys,
  year,
  today,
  loading,
  onOpen,
  onCreate,
}: {
  ys: ReturnType<typeof yearSummary>;
  year: number;
  today: MonthKey;
  loading: boolean;
  onOpen: (k: MonthKey) => void;
  onCreate: () => void;
}) {
  const diff = ys.planned - ys.used;
  return (
    <div className="space-y-3">
      <section
        className="rounded-2xl border border-border bg-surface p-4"
        aria-label={`Resumo de ${year}`}
      >
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Stat
            title={`Orçado em ${year}`}
            value={ys.planned > 0 ? formatCurrency(ys.planned) : "—"}
            hint={`${ys.monthsWithBudget} de 12 meses com limite`}
          />
          <Stat title="Realizado" value={formatCurrency(ys.spent)} hint="Despesas do ano" />
          <Stat
            title={diff >= 0 ? "Sobrou" : "Passou"}
            value={ys.planned > 0 ? formatCurrency(Math.abs(diff)) : "—"}
            tone={ys.planned > 0 ? (diff >= 0 ? "text-primary" : "text-destructive") : ""}
            hint="Nos meses com limite"
          />
          <Stat
            title="Usado"
            value={ys.planned > 0 ? `${Math.round((ys.used / ys.planned) * 100)}%` : "—"}
            tone={TONE[budgetState(ys.used, ys.planned)].text}
            hint={TONE[budgetState(ys.used, ys.planned)].label}
          />
        </div>
      </section>
      {loading ? <p className="text-sm text-muted-foreground">Carregando {year}…</p> : null}
      {ys.monthsWithBudget === 0 && !loading ? (
        <div className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
          Nenhum limite vale em {year} ainda.{" "}
          <button type="button" className="underline" onClick={onCreate}>
            Criar um orçamento
          </button>
        </div>
      ) : null}
      <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
        {ys.months.map((m, i) => (
          <li key={m.key}>
            <button
              type="button"
              onClick={() => onOpen(m.key)}
              className="grid w-full grid-cols-[3.25rem_1fr] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-elevated/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Abrir ${MONTHS_LONG[i]} de ${year}`}
            >
              <span className={cn("text-sm font-medium", m.key === today && "text-primary")}>
                {MONTHS[i]}
              </span>
              <span className="min-w-0 space-y-1">
                {m.planned > 0 ? (
                  <Bar value={m.used} max={m.planned} />
                ) : (
                  <span className="block h-2 rounded-full bg-elevated" aria-hidden />
                )}
                <span className="flex flex-wrap justify-between gap-x-2 text-xs">
                  <span className="numeric text-muted-foreground">
                    {formatCurrency(m.spentTotal)}
                    {m.planned > 0 ? ` de ${formatCurrency(m.planned)}` : " · sem limite"}
                  </span>
                  {m.planned > 0 ? (
                    <span className={cn("numeric", TONE[m.state].text)}>
                      {m.left >= 0
                        ? `Disponível ${formatCurrency(m.left)}`
                        : `Excedido ${formatCurrency(-m.left)}`}
                    </span>
                  ) : null}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
