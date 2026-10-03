import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  accountBalance,
  addMonths,
  dueDateOf,
  isOpen,
  isSettled,
  sumBy,
  todayISO,
} from "@/features/finance/calc";
import type {
  Account,
  Card,
  Category,
  Financing,
  Loan,
  Transaction,
} from "@/features/finance/queries";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";

const monthKey = (iso: string) => iso.slice(0, 7);
const currentMonth = () => todayISO().slice(0, 7);
const shiftMonth = (key: string, n: number) => addMonths(`${key}-01`, n).slice(0, 7);
const monthName = (key: string) =>
  new Date(`${key}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
const amt = (t: Transaction) => Number(t.amount) || 0;
const active = (list: Transaction[]) => list.filter((t) => t.status !== "CANCELLED");

/** Despesas do mês por competência (data da compra), excluindo canceladas. */
function expensesIn(list: Transaction[], key: string) {
  return active(list).filter((t) => t.type === "EXPENSE" && monthKey(t.transaction_date) === key);
}
function incomeIn(list: Transaction[], key: string) {
  return active(list).filter((t) => t.type === "INCOME" && monthKey(t.transaction_date) === key);
}

function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: string | undefined; tone?: "good" | "bad" | "accent" | undefined }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "numeric mt-2 text-xl font-semibold",
          tone === "good" && "text-success",
          tone === "bad" && "text-destructive",
          tone === "accent" && "text-primary",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Bar({ value, max, danger }: { value: number; max: number; danger?: boolean }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-elevated">
      <div className={cn("h-full rounded-full bg-primary transition-all", danger && "bg-destructive")} style={{ width: `${pct}%` }} />
    </div>
  );
}

type Props = {
  transactions: Transaction[];
  accounts: Account[];
  cards: Card[];
  categories: Category[];
  loans: Loan[];
  financings: Financing[];
};

export function FinanceOverview({ transactions, accounts, cards, categories, loans, financings }: Props) {
  const today = todayISO();
  const key = currentMonth();
  const prevKey = shiftMonth(key, -1);
  const balance = sumBy(accounts.filter((a) => a.is_active), (a) => accountBalance(a, transactions));
  const open = active(transactions).filter((t) => t.type === "EXPENSE" && isOpen(t));
  const openIncome = active(transactions).filter((t) => t.type === "INCOME" && isOpen(t));
  const monthEnd = `${key}-31`;
  const dueThisMonth = open.filter((t) => dueDateOf(t) <= monthEnd);
  const committed = sumBy(dueThisMonth, amt);
  const incomingThisMonth = sumBy(openIncome.filter((t) => dueDateOf(t) <= monthEnd), amt);
  const projected = balance + incomingThisMonth - committed;

  const income = sumBy(incomeIn(transactions, key), amt);
  const expense = sumBy(expensesIn(transactions, key), amt);
  const prevExpense = sumBy(expensesIn(transactions, prevKey), amt);
  const saved = income - expense;
  const committedPct = income > 0 ? (committed / income) * 100 : null;
  const onCards = sumBy(open.filter((t) => t.card_id), amt);
  const installmentsLeft = sumBy(open.filter((t) => t.installment_plan_id), amt);
  const fixed = sumBy(expensesIn(transactions, key).filter((t) => t.recurring_id || t.financing_id || t.loan_id), amt);
  const variable = expense - fixed;
  const lent = sumBy(open.filter((t) => t.loan_id && loans.find((l) => l.id === t.loan_id)?.type === "LENT"), amt);
  const borrowed = sumBy(open.filter((t) => t.loan_id && loans.find((l) => l.id === t.loan_id)?.type === "BORROWED"), amt);
  const financingLeft = sumBy(open.filter((t) => t.financing_id && financings.some((f) => f.id === t.financing_id)), amt);
  const diff = expense - prevExpense;

  const byCategory = new Map<string, number>();
  for (const t of expensesIn(transactions, key)) {
    const id = t.category_id ?? "none";
    byCategory.set(id, (byCategory.get(id) ?? 0) + amt(t));
  }
  const ranking = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "Sem categoria";
  const over = categories
    .filter((c) => Number(c.monthly_budget) > 0)
    .map((c) => ({ c, spent: byCategory.get(c.id) ?? 0, budget: Number(c.monthly_budget) }))
    .filter((x) => x.spent > x.budget);

  const next = open
    .filter((t) => dueDateOf(t) >= today)
    .sort((a, b) => dueDateOf(a).localeCompare(dueDateOf(b)))
    .slice(0, 6);
  const overdueCount = open.filter((t) => dueDateOf(t) < today).length;

  const alerts: string[] = [];
  if (overdueCount) alerts.push(`${overdueCount} conta${overdueCount > 1 ? "s" : ""} atrasada${overdueCount > 1 ? "s" : ""}.`);
  if (projected < 0) alerts.push("O saldo projetado do mês fica negativo depois dos compromissos.");
  for (const x of over) alerts.push(`${x.c.name} passou ${formatCurrency(x.spent - x.budget)} do orçamento.`);
  if (prevExpense > 0 && diff > prevExpense * 0.2) alerts.push(`Gastos ${Math.round((diff / prevExpense) * 100)}% acima do mês passado.`);
  for (const card of cards) {
    const used = sumBy(open.filter((t) => t.card_id === card.id), amt);
    if (Number(card.credit_limit) > 0 && used / Number(card.credit_limit) > 0.85)
      alerts.push(`Cartão ${card.name} com mais de 85% do limite usado.`);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Quanto temos" value={formatCurrency(balance)} hint={`${accounts.filter((a) => a.is_active).length} contas ativas`} />
        <Tile label="Comprometido no mês" value={formatCurrency(committed)} hint={committedPct !== null ? `${committedPct.toFixed(0)}% das receitas do mês` : "Sem receitas no mês"} tone="bad" />
        <Tile label="Saldo projetado" value={formatCurrency(projected)} hint="Fim do mês, após compromissos" tone={projected < 0 ? "bad" : "accent"} />
        <Tile label="Guardado no mês" value={formatCurrency(saved)} hint="Receitas − despesas do mês" tone={saved >= 0 ? "good" : "bad"} />
        <Tile label="Entrou" value={formatCurrency(income)} tone="good" />
        <Tile
          label="Gastamos"
          value={formatCurrency(expense)}
          hint={prevExpense > 0 ? `${diff >= 0 ? "+" : "−"}${formatCurrency(Math.abs(diff))} vs ${monthName(prevKey)}` : undefined}
        />
        <Tile label="No cartão (em aberto)" value={formatCurrency(onCards)} />
        <Tile label="Parcelas a pagar" value={formatCurrency(installmentsLeft)} />
        <Tile label="Fixas no mês" value={formatCurrency(fixed)} hint="Recorrentes, financiamentos e empréstimos" />
        <Tile label="Variáveis no mês" value={formatCurrency(variable)} />
        <Tile label="Emprestamos / devemos" value={`${formatCurrency(lent)} / ${formatCurrency(borrowed)}`} hint="Parcelas em aberto" />
        <Tile label="Financiamentos restantes" value={formatCurrency(financingLeft)} />
      </div>

      {alerts.length ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="mb-2 text-sm font-semibold">Atenção</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {alerts.map((a) => (
              <li key={a}>• {a}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="mb-3 text-sm font-semibold">Gastos por categoria · {monthName(key)}</p>
          {ranking.length ? (
            <ul className="space-y-3">
              {ranking.map(([id, value]) => {
                const budget = Number(categories.find((c) => c.id === id)?.monthly_budget) || 0;
                return (
                  <li key={id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{catName(id)}</span>
                      <span className="numeric">
                        {formatCurrency(value)}
                        {budget ? <span className="text-muted-foreground"> / {formatCurrency(budget)}</span> : null}
                      </span>
                    </div>
                    <Bar value={value} max={budget || expense} danger={budget > 0 && value > budget} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma despesa neste mês.</p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="mb-3 text-sm font-semibold">Próximos compromissos</p>
          {next.length ? (
            <ul className="divide-y divide-border">
              {next.map((t) => (
                <li key={t.id} className="flex justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate">{t.description}</span>
                  <span className="flex shrink-0 gap-3">
                    <span className="text-muted-foreground">{formatDateShort(dueDateOf(t))}</span>
                    <span className="numeric">{formatCurrency(amt(t))}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nada pendente pela frente.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Fluxo de caixa: 3 meses anteriores, atual e 3 futuros (lançamentos já existentes). */
export function CashFlow({ transactions, accounts }: { transactions: Transaction[]; accounts: Account[] }) {
  const key = currentMonth();
  const months = Array.from({ length: 7 }, (_, i) => shiftMonth(key, i - 3));
  const balanceNow = sumBy(accounts.filter((a) => a.is_active), (a) => accountBalance(a, transactions));
  const list = active(transactions);
  const flowMonth = (m: string) => {
    const inc = list.filter((t) => t.type === "INCOME" && monthKey(dueDateOf(t)) === m);
    const exp = list.filter((t) => t.type === "EXPENSE" && monthKey(dueDateOf(t)) === m);
    return { inc: sumBy(inc, amt), exp: sumBy(exp, amt), openInc: sumBy(inc.filter((t) => !isSettled(t)), amt), openExp: sumBy(exp.filter((t) => !isSettled(t)), amt) };
  };
  let running = balanceNow;
  const rows = months.map((m) => {
    const f = flowMonth(m);
    const projected = m >= key ? (running = running + f.openInc - f.openExp) : null;
    return { m, ...f, projected };
  });
  const max = Math.max(1, ...rows.map((r) => Math.max(r.inc, r.exp)));
  const overdueOpen = list.filter((t) => !isSettled(t) && monthKey(dueDateOf(t)) < shiftMonth(key, -3));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Entradas e saídas por mês de vencimento. O saldo previsto parte do saldo atual das contas e soma o que ainda está pendente.
      </p>
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-3">Mês</th>
              <th className="p-3">Entradas</th>
              <th className="p-3">Saídas</th>
              <th className="p-3">Resultado</th>
              <th className="p-3">Saldo previsto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.m} className={cn(r.m === key && "bg-primary/5")}>
                <td className="p-3 capitalize">{monthName(r.m)}</td>
                <td className="p-3">
                  <span className="numeric text-success">{formatCurrency(r.inc)}</span>
                  <Bar value={r.inc} max={max} />
                </td>
                <td className="p-3">
                  <span className="numeric text-destructive">{formatCurrency(r.exp)}</span>
                  <Bar value={r.exp} max={max} danger />
                </td>
                <td className={cn("numeric p-3", r.inc - r.exp < 0 ? "text-destructive" : "text-success")}>{formatCurrency(r.inc - r.exp)}</td>
                <td className={cn("numeric p-3", r.projected !== null && r.projected < 0 && "text-destructive")}>
                  {r.projected === null ? "—" : formatCurrency(r.projected)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {overdueOpen.length ? (
        <p className="text-xs text-muted-foreground">{overdueOpen.length} pendência(s) antigas não aparecem nesta janela.</p>
      ) : null}
    </div>
  );
}

/** Orçamento mensal por categoria (salvo na própria categoria). */
export function BudgetPanel({ transactions, categories, workspaceId }: { transactions: Transaction[]; categories: Category[]; workspaceId: string }) {
  const queryClient = useQueryClient();
  const key = currentMonth();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const expenseCats = categories.filter((c) => c.type !== "INCOME");
  const spentOf = (id: string) => sumBy(expensesIn(transactions, key).filter((t) => t.category_id === id), amt);
  const totalBudget = sumBy(expenseCats, (c) => Number(c.monthly_budget) || 0);
  const totalSpent = sumBy(expenseCats.filter((c) => Number(c.monthly_budget) > 0), (c) => spentOf(c.id));

  async function save(cat: Category) {
    const raw = draft[cat.id];
    if (raw === undefined) return undefined;
    const value = raw.trim() === "" ? null : Number(raw.replace(",", "."));
    if (value !== null && (Number.isNaN(value) || value < 0)) { toast.error("Valor inválido"); return undefined; }
    const { error } = await supabase.from("categories").update({ monthly_budget: value }).eq("id", cat.id).eq("workspace_id", workspaceId);
    if (error) { toast.error("Não foi possível salvar"); return undefined; }
    toast.success(`Orçamento de ${cat.name} salvo`);
    setDraft(({ [cat.id]: _, ...rest }) => rest);
    await queryClient.invalidateQueries({ queryKey: ["categories", workspaceId] });
    return undefined;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="Orçado no mês" value={formatCurrency(totalBudget)} />
        <Tile label="Gasto nas categorias orçadas" value={formatCurrency(totalSpent)} tone={totalSpent > totalBudget && totalBudget > 0 ? "bad" : undefined} />
        <Tile label="Ainda disponível" value={formatCurrency(Math.max(0, totalBudget - totalSpent))} tone="accent" />
      </div>
      <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
        {expenseCats.map((cat) => {
          const spent = spentOf(cat.id);
          const budget = Number(cat.monthly_budget) || 0;
          const pct = budget ? (spent / budget) * 100 : 0;
          return (
            <li key={cat.id} className="grid gap-2 p-3 sm:grid-cols-[1fr_160px] sm:items-center">
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{cat.name}</span>
                  <span className="numeric text-muted-foreground">
                    {formatCurrency(spent)}
                    {budget ? ` · ${pct.toFixed(0)}%` : ""}
                  </span>
                </div>
                {budget ? <Bar value={spent} max={budget} danger={spent > budget} /> : <p className="text-xs text-muted-foreground">Sem orçamento definido</p>}
              </div>
              <Input
                inputMode="decimal"
                placeholder="Limite mensal"
                aria-label={`Orçamento de ${cat.name}`}
                value={draft[cat.id] ?? (cat.monthly_budget ?? "").toString()}
                onChange={(e) => setDraft((d) => ({ ...d, [cat.id]: e.target.value }))}
                onBlur={() => save(cat)}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Relatórios: comparação mensal, médias, categorias e quem lançou (6 meses). */
export function ReportsPanel({
  transactions,
  categories,
  accounts,
  memberName,
}: {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  memberName: (id: string) => string;
}) {
  const key = currentMonth();
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(key, i - 5));
  const rows = months.map((m) => ({
    m,
    inc: sumBy(incomeIn(transactions, m), amt),
    exp: sumBy(expensesIn(transactions, m), amt),
  }));
  const closed = rows.slice(0, -1).filter((r) => r.exp > 0 || r.inc > 0);
  const avgExp = closed.length ? sumBy(closed, (r) => r.exp) / closed.length : 0;
  const avgInc = closed.length ? sumBy(closed, (r) => r.inc) / closed.length : 0;
  const current = rows[rows.length - 1]!;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.inc, r.exp)));
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "Sem categoria";

  const catAvg = new Map<string, { now: number; past: number }>();
  for (const r of rows) {
    for (const t of expensesIn(transactions, r.m)) {
      const id = t.category_id ?? "none";
      const e = catAvg.get(id) ?? { now: 0, past: 0 };
      if (r.m === key) e.now += amt(t);
      else e.past += amt(t);
      catAvg.set(id, e);
    }
  }
  const pastMonths = Math.max(1, closed.length);
  const catRows = [...catAvg.entries()]
    .map(([id, v]) => ({ id, now: v.now, avg: v.past / pastMonths }))
    .sort((a, b) => b.now - a.now);

  const byPerson = new Map<string, { inc: number; exp: number }>();
  for (const t of [...incomeIn(transactions, key), ...expensesIn(transactions, key)]) {
    const e = byPerson.get(t.owner_id) ?? { inc: 0, exp: 0 };
    if (t.type === "INCOME") e.inc += amt(t);
    else e.exp += amt(t);
    byPerson.set(t.owner_id, e);
  }
  const patrimony = accounts
    .filter((a) => a.is_active)
    .map((a) => ({ a, value: accountBalance(a, transactions) }))
    .sort((x, y) => y.value - x.value);
  const totalPatrimony = sumBy(patrimony, (p) => p.value);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Média de gastos" value={formatCurrency(avgExp)} hint={`Últimos ${closed.length || 0} meses`} />
        <Tile label="Média de receitas" value={formatCurrency(avgInc)} hint={`Últimos ${closed.length || 0} meses`} />
        <Tile
          label="Este mês vs média"
          value={avgExp ? `${current.exp >= avgExp ? "+" : "−"}${formatCurrency(Math.abs(current.exp - avgExp))}` : "—"}
          tone={avgExp && current.exp > avgExp ? "bad" : "good"}
          hint="Gastos do mês comparados à média"
        />
        <Tile label="Patrimônio em contas" value={formatCurrency(totalPatrimony)} tone="accent" />
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="mb-4 text-sm font-semibold">Comparação mensal</p>
        <div className="flex h-40 items-end gap-3">
          {rows.map((r) => (
            <div key={r.m} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-32 w-full items-end justify-center gap-1">
                <div className="w-1/3 rounded-t bg-success/70" style={{ height: `${(r.inc / max) * 100}%` }} title={formatCurrency(r.inc)} />
                <div className="w-1/3 rounded-t bg-destructive/70" style={{ height: `${(r.exp / max) * 100}%` }} title={formatCurrency(r.exp)} />
              </div>
              <span className={cn("text-[11px] capitalize text-muted-foreground", r.m === key && "font-semibold text-foreground")}>{monthName(r.m)}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Verde: receitas · Vermelho: despesas (pela data do lançamento)</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="mb-3 text-sm font-semibold">Categorias: este mês vs média</p>
          {catRows.length ? (
            <ul className="divide-y divide-border text-sm">
              {catRows.map((c) => (
                <li key={c.id} className="flex justify-between gap-3 py-2">
                  <span className="truncate">{catName(c.id)}</span>
                  <span className="numeric shrink-0">
                    {formatCurrency(c.now)}
                    <span className={cn("ml-2 text-xs", c.avg && c.now > c.avg * 1.2 ? "text-destructive" : "text-muted-foreground")}>
                      média {formatCurrency(c.avg)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Sem despesas no período.</p>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="mb-1 text-sm font-semibold">Quem lançou este mês</p>
            <p className="mb-3 text-xs text-muted-foreground">Só identificação — o dinheiro é do Nós.</p>
            {byPerson.size ? (
              <ul className="divide-y divide-border text-sm">
                {[...byPerson.entries()].map(([id, v]) => (
                  <li key={id} className="flex justify-between py-2">
                    <span>{memberName(id)}</span>
                    <span className="numeric">
                      <span className="text-success">{formatCurrency(v.inc)}</span> · <span className="text-destructive">{formatCurrency(v.exp)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum lançamento no mês.</p>
            )}
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="mb-3 text-sm font-semibold">Patrimônio por conta</p>
            <ul className="space-y-2 text-sm">
              {patrimony.map(({ a, value }) => (
                <li key={a.id} className="space-y-1">
                  <div className="flex justify-between">
                    <span>{a.name}</span>
                    <span className="numeric">{formatCurrency(value)}</span>
                  </div>
                  <Bar value={Math.max(0, value)} max={Math.max(1, totalPatrimony)} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Calendário financeiro: lançamentos pelo vencimento, mês a mês. */
export function FinanceCalendar({ transactions }: { transactions: Transaction[] }) {
  const [key, setKey] = useState(currentMonth());
  const [selected, setSelected] = useState<string | null>(null);
  const today = todayISO();
  const list = active(transactions).filter((t) => t.type !== "TRANSFER" && monthKey(dueDateOf(t)) === key);
  const byDay = new Map<string, Transaction[]>();
  for (const t of list) {
    const d = dueDateOf(t);
    byDay.set(d, [...(byDay.get(d) ?? []), t]);
  }
  const [y, m] = key.split("-").map(Number);
  const first = new Date(y!, m! - 1, 1);
  const days = new Date(y!, m!, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${key}-${String(i + 1).padStart(2, "0")}`)];
  const dayItems = selected ? (byDay.get(selected) ?? []) : [];
  const total = (items: Transaction[], type: string) => sumBy(items.filter((t) => t.type === type), amt);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button type="button" aria-label="Mês anterior" className="rounded-lg border border-border px-3 py-1.5 text-sm" onClick={() => setKey(shiftMonth(key, -1))}>‹</button>
        <p className="text-sm font-semibold capitalize">
          {new Date(`${key}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        </p>
        <button type="button" aria-label="Próximo mês" className="rounded-lg border border-border px-3 py-1.5 text-sm" onClick={() => setKey(shiftMonth(key, 1))}>›</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="Entradas no mês" value={formatCurrency(total(list, "INCOME"))} tone="good" />
        <Tile label="Saídas no mês" value={formatCurrency(total(list, "EXPENSE"))} tone="bad" />
        <Tile label="Ainda pendente" value={formatCurrency(sumBy(list.filter((t) => t.type === "EXPENSE" && isOpen(t)), amt))} />
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) =>
          d ? (
            <button
              type="button"
              key={d}
              onClick={() => setSelected(d === selected ? null : d)}
              className={cn(
                "flex min-h-14 flex-col items-start rounded-lg border border-border bg-surface p-1.5 text-left text-xs transition-colors hover:border-primary/50",
                d === today && "border-primary",
                d === selected && "bg-primary/10",
              )}
            >
              <span className="font-medium">{Number(d.slice(8))}</span>
              {byDay.get(d)?.length ? (
                <span className="mt-auto flex flex-wrap gap-0.5">
                  {total(byDay.get(d)!, "INCOME") > 0 ? <span className="size-1.5 rounded-full bg-success" /> : null}
                  {byDay.get(d)!.some((t) => t.type === "EXPENSE" && isOpen(t) && d < today) ? (
                    <span className="size-1.5 rounded-full bg-destructive" />
                  ) : total(byDay.get(d)!, "EXPENSE") > 0 ? (
                    <span className="size-1.5 rounded-full bg-primary" />
                  ) : null}
                  <span className="hidden text-[10px] text-muted-foreground sm:inline">{byDay.get(d)!.length}</span>
                </span>
              ) : null}
            </button>
          ) : (
            <span key={`e${i}`} />
          ),
        )}
      </div>
      <p className="text-xs text-muted-foreground">Verde: entrada · Roxo: saída · Vermelho: atrasada</p>
      {selected ? (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="mb-2 text-sm font-semibold">{formatDateShort(selected)}</p>
          {dayItems.length ? (
            <ul className="divide-y divide-border text-sm">
              {dayItems.map((t) => (
                <li key={t.id} className="flex justify-between gap-3 py-2">
                  <span className="truncate">{t.description}</span>
                  <span className={cn("numeric shrink-0", t.type === "INCOME" ? "text-success" : "")}>
                    {t.type === "INCOME" ? "+" : "−"}
                    {formatCurrency(amt(t))}
                    <span className="ml-2 text-xs text-muted-foreground">{isSettled(t) ? "pago" : "pendente"}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nada neste dia.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Busca rápida em todo o Financeiro: descrição, observações, categoria ou valor. */
export function FinanceSearch({ transactions, categories }: { transactions: Transaction[]; categories: Category[] }) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "";
  const results = term.length < 2 ? [] : transactions
    .filter((t) => {
      const value = amt(t).toFixed(2).replace(".", ",");
      return [t.description, t.notes ?? "", catName(t.category_id), value].some((s) => s.toLowerCase().includes(term));
    })
    .slice(0, 12);
  return (
    <div className="relative">
      <Input
        type="search"
        placeholder="Buscar em todo o Financeiro (descrição, categoria, valor…)"
        aria-label="Buscar no Financeiro"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {term.length >= 2 ? (
        <div className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg">
          {results.length ? (
            results.map((t) => (
              <div key={t.id} className="flex justify-between gap-3 rounded-lg px-3 py-2 text-sm hover:bg-elevated">
                <span className="min-w-0">
                  <span className="block truncate">{t.description}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateShort(t.transaction_date)} · {catName(t.category_id) || "Sem categoria"} · {isSettled(t) ? "pago" : t.status === "CANCELLED" ? "cancelado" : "pendente"}
                  </span>
                </span>
                <span className={cn("numeric shrink-0", t.type === "INCOME" && "text-success")}>
                  {t.type === "INCOME" ? "+" : t.type === "EXPENSE" ? "−" : ""}
                  {formatCurrency(amt(t))}
                </span>
              </div>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-muted-foreground">Nada encontrado.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
