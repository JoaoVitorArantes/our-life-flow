import { useMemo, useState } from "react";
import { ArrowRight, Calculator, ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculateSafeToSpend, financialMood } from "@/features/finance/safe-to-spend";
import { daysBetween, sumBy, todayISO } from "@/features/finance/calc";
import type { Account, Category, Transaction } from "@/features/finance/queries";
import { formatCurrency, formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  payments?: import("@/features/finance/queries").InvoicePayment[];
  recurrences?: import("@/features/finance/queries").Recurring[];
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  onNavigate: (sub: string) => void;
};

const amt = (t: Transaction) => Number(t.amount) || 0;
/** Ícones de categoria guardam nomes de ícone; só exibimos quando for emoji. */
const emojiOf = (icon?: string | null) => (icon && !/^[a-z0-9-]+$/i.test(icon) ? `${icon} ` : "");

function relDay(iso: string, today: string) {
  const d = daysBetween(today, iso);
  if (d < 0) return "Atrasado";
  if (d === 0) return "Hoje";
  if (d === 1) return "Amanhã";
  return `Em ${d} dias`;
}

function kindEmoji(t: Transaction) {
  if (t.type === "INCOME") return "💰";
  if (t.card_id) return "💳";
  if (t.installment_plan_id) return "📦";
  if (t.recurring_id) return "🔁";
  if (t.financing_id) return "🏦";
  if (t.loan_id) return "🤝";
  return "🧾";
}

function Section({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-3xl border border-border bg-surface p-5", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Curva do dinheiro: passado real (linha contínua) e projeção (tracejada). */
function MoneyCurve({ past, future }: { past: { date: string; value: number }[]; future: { date: string; value: number }[] }) {
  const all = [...past, ...future];
  if (all.length < 2) return <p className="text-sm text-muted-foreground">Ainda não há movimentos suficientes para desenhar a curva.</p>;
  const W = 600;
  const H = 160;
  const values = all.map((p) => p.value);
  const min = Math.min(0, ...values);
  const max = Math.max(...values, 1);
  const x = (i: number) => (i / (all.length - 1)) * W;
  const y = (v: number) => H - ((v - min) / (max - min || 1)) * (H - 16) - 8;
  const path = (pts: { value: number }[], offset: number) =>
    pts.map((p, i) => `${i ? "L" : "M"}${x(i + offset).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const pastPath = path(past, 0);
  const futurePath = path([past[past.length - 1]!, ...future], past.length - 1);
  const zeroY = y(0);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full overflow-visible" role="img" aria-label="Curva do saldo">
        {min < 0 ? <line x1="0" x2={W} y1={zeroY} y2={zeroY} className="stroke-destructive/40" strokeDasharray="2 4" /> : null}
        <path d={pastPath} fill="none" className="stroke-primary" strokeWidth="2.5" strokeLinejoin="round" />
        <path d={futurePath} fill="none" className="stroke-primary/60" strokeWidth="2.5" strokeDasharray="6 6" strokeLinejoin="round" />
        <circle cx={x(past.length - 1)} cy={y(past[past.length - 1]!.value)} r="5" className="fill-primary" />
      </svg>
      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
        <span>{formatDateShort(all[0]!.date)}</span>
        <span className="font-medium text-foreground">Hoje</span>
        <span>{formatDateShort(all[all.length - 1]!.date)}</span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">Linha contínua: saldo real · tracejada: projeção</p>
    </div>
  );
}

export function FinanceCockpit({ accounts, transactions, categories, recurrences = [], payments = [], onNavigate }: Props) {
  const today = todayISO();
  const s = useMemo(() => calculateSafeToSpend(accounts, transactions, 30, undefined, recurrences, payments), [accounts, transactions, recurrences, payments]);
  const mood = financialMood(s);
  const [showCalc, setShowCalc] = useState(false);
  const [simOpen, setSimOpen] = useState(false);
  const [simAmount, setSimAmount] = useState("");
  const [simParts, setSimParts] = useState("1");
  const [simIncome, setSimIncome] = useState(false);

  // Passado real: saldo das contas líquidas 4 semanas atrás até hoje.
  const liquidIds = new Set(accounts.filter((a) => a.is_active && a.account_type !== "INVESTMENT").map((a) => a.id));
  const settled = transactions.filter((t) => t.status === "PAID");
  const netAfter = (iso: string) =>
    sumBy(settled, (t) => {
      const when = t.paid_at ?? t.transaction_date;
      if (when <= iso) return 0;
      if (t.type === "INCOME" && t.account_id && liquidIds.has(t.account_id)) return amt(t);
      if (t.type === "EXPENSE" && t.account_id && liquidIds.has(t.account_id)) return -amt(t);
      return 0;
    });
  const past = [28, 21, 14, 7, 0].map((n) => {
    const [y, m, d] = today.split("-").map(Number);
    const dt = new Date(y!, m! - 1, d! - n);
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    return { date: iso, value: s.available - netAfter(iso) };
  });
  const future = s.timeline.map((e) => ({ date: e.date, value: e.balance }));

  // Comprometido, agrupado sem duplicar (cada lançamento cai em um único grupo).
  const groups = [
    { label: "Cartões", sub: "cartoes", pick: (t: Transaction) => !!t.card_id },
    { label: "Parcelas", sub: "parcelas", pick: (t: Transaction) => !!t.installment_plan_id },
    { label: "Recorrentes", sub: "recorrentes", pick: (t: Transaction) => !!t.recurring_id },
    { label: "Financiamentos", sub: "financiamentos", pick: (t: Transaction) => !!t.financing_id },
    { label: "Empréstimos", sub: "emprestimos", pick: (t: Transaction) => !!t.loan_id },
    { label: "Contas avulsas", sub: "pagar", pick: () => true },
  ];
  const committed = groups.map((g) => ({ ...g, value: 0 }));
  for (const t of s.expenses) {
    const idx = groups.findIndex((g) => g.pick(t));
    committed[idx]!.value += amt(t);
  }

  // Insights (máx. 3)
  const next7 = s.expenses.filter((t) => daysBetween(today, s.timeline.find((e) => e.t.id === t.id)?.date ?? today) <= 7);
  const monthKey = today.slice(0, 7);
  const spentMonth = (key: string) =>
    sumBy(transactions.filter((t) => t.type === "EXPENSE" && t.status !== "CANCELLED" && t.transaction_date.startsWith(key)), amt);
  const prevKeys = [1, 2, 3].map((n) => {
    const [y, m] = monthKey.split("-").map(Number);
    const dt = new Date(y!, m! - 1 - n, 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
  });
  const avg3 = sumBy(prevKeys, spentMonth) / 3;
  const insights: { icon: string; text: string }[] = [];
  if (next7.length) insights.push({ icon: "⚠️", text: `Nos próximos 7 dias vocês terão ${formatCurrency(sumBy(next7, amt))} em compromissos.` });
  if (s.timeline.length && s.lowest >= 0)
    insights.push({ icon: "💡", text: `Depois dos próximos pagamentos, vocês terão ${formatCurrency(s.timeline[s.timeline.length - 1]!.balance)} livres.` });
  if (avg3 > 0) {
    const now = spentMonth(monthKey);
    insights.push(
      now <= avg3
        ? { icon: "📈", text: "Vocês estão gastando menos que a média dos últimos 3 meses." }
        : { icon: "📉", text: `Este mês já passou ${formatCurrency(now - avg3)} da média dos últimos 3 meses.` },
    );
  }

  // Gastos do mês
  const byCat = new Map<string, number>();
  for (const t of transactions)
    if (t.type === "EXPENSE" && t.status !== "CANCELLED" && t.transaction_date.startsWith(monthKey))
      byCat.set(t.category_id ?? "none", (byCat.get(t.category_id ?? "none") ?? 0) + amt(t));
  const cat = (id: string) => categories.find((c) => c.id === id);
  const top = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const budgets = categories
    .filter((c) => Number(c.monthly_budget) > 0)
    .map((c) => ({ c, spent: byCat.get(c.id) ?? 0, budget: Number(c.monthly_budget) }))
    .sort((a, b) => b.spent / b.budget - a.spent / a.budget)
    .slice(0, 3);

  // Simulação (não cria lançamento)
  const simValue = Number(simAmount.replace(/\./g, "").replace(",", ".")) || 0;
  const parts = Math.max(1, Math.min(48, Number(simParts) || 1));
  const firstImpact = simIncome ? -simValue : simValue / parts;
  const afterSafe = s.spendable - firstImpact;
  const afterLowest = s.lowest - firstImpact;

  const moodClass = mood.tone === "calm" ? "text-success" : mood.tone === "tight" ? "text-warning" : "text-destructive";

  return (
    <div className="space-y-5">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-surface to-surface p-6 sm:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Dinheiro livre</p>
        <p className={cn("numeric mt-3 text-4xl font-semibold tracking-tight sm:text-5xl", s.spendable <= 0 && "text-destructive")}>
          {formatCurrency(s.spendable)}
        </p>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Quanto vocês podem gastar sem comprometer os próximos compromissos.
        </p>
        <p className={cn("mt-4 text-base font-medium", moodClass)}>{mood.text}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowCalc((v) => !v)}>
            Ver cálculo <ChevronDown className={cn("ml-1 size-4 transition-transform", showCalc && "rotate-180")} />
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onNavigate("simular")}>
            <Sparkles className="mr-1 size-4" /> Simular
          </Button>
          <Button size="sm" onClick={() => setSimOpen((v) => !v)}>
            <Calculator className="mr-1 size-4" /> Simular gasto
          </Button>
        </div>

        {showCalc ? (
          <div className="mt-5 max-w-sm space-y-2 rounded-2xl border border-border bg-background/60 p-4 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Disponível agora</span><span className="numeric">{formatCurrency(s.available)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Próximas entradas{s.projectedIncome ? ` (${formatCurrency(s.projectedIncome)} previstas)` : ""}</span><span className="numeric text-success">+{formatCurrency(s.income)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Compromissos</span><span className="numeric text-destructive">−{formatCurrency(s.commitments)}</span></div>
            <div className="flex justify-between border-t border-border pt-2 font-medium"><span>Saldo após 30 dias</span><span className="numeric">{formatCurrency(s.safe)}</span></div>
            <div className="flex justify-between font-medium"><span>Menor saldo projetado ({s.lowestDate === today ? "hoje" : formatDateShort(s.lowestDate)})</span><span className={cn("numeric", s.lowest < 0 && "text-destructive")}>{formatCurrency(s.lowest)}</span></div>
            <div className="flex justify-between font-semibold"><span>Dinheiro livre</span><span className="numeric">{formatCurrency(s.spendable)}</span></div>
            {s.timeline.length ? (
              <ol className="space-y-1 border-t border-border pt-2 text-xs">
                <li className="flex justify-between gap-2"><span className="text-muted-foreground">Hoje · saldo atual</span><span className="numeric">{formatCurrency(s.available)}</span></li>
                {s.timeline
                  .filter((e) => e.date <= (s.lowestDate > today ? s.lowestDate : s.timeline[Math.min(5, s.timeline.length - 1)]!.date))
                  .slice(0, 8)
                  .map((e) => (
                    <li key={e.t.id} className={cn("flex justify-between gap-2", e.date === s.lowestDate && s.lowestDate !== today && "font-medium text-foreground")}>
                      <span className="truncate text-muted-foreground">{formatDateShort(e.date)} · {e.t.description}{e.projected ? " (previsto)" : ""} <span className={e.t.type === "INCOME" ? "text-success" : ""}>{e.t.type === "INCOME" ? "+" : "−"}{formatCurrency(amt(e.t))}</span></span>
                      <span className="numeric shrink-0">{formatCurrency(e.balance)}</span>
                    </li>
                  ))}
              </ol>
            ) : null}
            {s.lowest < 0 ? (
              <p className="text-xs text-warning">Vocês podem ficar {formatCurrency(-s.lowest)} abaixo do necessário antes da próxima entrada.</p>
            ) : null}
            <p className="pt-1 text-xs text-muted-foreground">
              Considera contas (sem investimentos), receitas e despesas pendentes até {formatDateShort(s.horizon)}. Limite de cartão e acertos entre vocês não contam como dinheiro. O dinheiro livre é o menor valor entre o saldo final e o ponto mais baixo do período.
            </p>
          </div>
        ) : null}

        {simOpen ? (
          <div className="mt-5 max-w-md space-y-4 rounded-2xl border border-border bg-background/60 p-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <Button size="sm" variant={simIncome ? "outline" : "secondary"} onClick={() => setSimIncome(false)}>E se gastarmos…</Button>
              <Button size="sm" variant={simIncome ? "secondary" : "outline"} onClick={() => setSimIncome(true)}>E se entrar…</Button>
            </div>
            <div className="grid grid-cols-[1fr_96px] gap-3">
              <div className="space-y-1">
                <Label htmlFor="sim-amount">Valor</Label>
                <Input id="sim-amount" inputMode="decimal" placeholder="500,00" value={simAmount} onChange={(e) => setSimAmount(e.target.value)} />
              </div>
              {!simIncome ? (
                <div className="space-y-1">
                  <Label htmlFor="sim-parts">Parcelas</Label>
                  <Input id="sim-parts" inputMode="numeric" value={simParts} onChange={(e) => setSimParts(e.target.value)} />
                </div>
              ) : null}
            </div>
            {simValue > 0 ? (
              <div className="space-y-2 text-sm">
                {!simIncome && parts > 1 ? (
                  <p className="text-muted-foreground">Parcela de <span className="numeric text-foreground">{formatCurrency(simValue / parts)}</span> por mês durante {parts} meses.</p>
                ) : null}
                <div className="flex items-center gap-3">
                  <span className="numeric text-muted-foreground">{formatCurrency(s.spendable)}</span>
                  <ArrowRight className="size-4 text-muted-foreground" />
                  <span className={cn("numeric text-lg font-semibold", afterSafe < 0 && "text-destructive")}>{formatCurrency(afterSafe)}</span>
                </div>
                <p className={cn(afterLowest < 0 ? "text-destructive" : afterSafe < s.spendable * 0.3 ? "text-warning" : "text-success")}>
                  {simIncome
                    ? "Isso aumentaria o espaço de vocês."
                    : afterLowest < 0
                      ? `Esse gasto faria o saldo ficar negativo por volta de ${formatDateShort(s.lowestDate)}.`
                      : afterSafe < s.spendable * 0.3
                        ? "Cabe, mas deixa pouco espaço até os próximos recebimentos."
                        : "Esse gasto cabe no planejamento atual."}
                </p>
                <p className="text-xs text-muted-foreground">Só uma simulação — nenhum lançamento é criado.</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {insights.length ? (
        <div className="grid gap-2 sm:grid-cols-3">
          {insights.slice(0, 3).map((i) => (
            <div key={i.text} className="flex gap-2 rounded-2xl border border-border bg-surface p-3 text-sm">
              <span>{i.icon}</span><span className="text-muted-foreground">{i.text}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid min-w-0 grid-cols-1 gap-5 [&>*]:min-w-0 lg:grid-cols-[1.4fr_1fr]">
        <Section title="O que vai acontecer com o dinheiro">
          <MoneyCurve past={past} future={future} />
        </Section>

        <Section
          title="Próximos movimentos"
          action={<Button size="sm" variant="ghost" onClick={() => onNavigate("pagar")}>Ver tudo</Button>}
        >
          <ol className="relative space-y-3 border-l border-border pl-4">
            <li className="relative">
              <span className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-primary" />
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Hoje</p>
              <p className="numeric text-sm font-medium">{formatCurrency(s.available)}</p>
            </li>
            {s.timeline.slice(0, 6).map((e) => (
              <li key={e.t.id} className="relative">
                <span className={cn("absolute -left-[21px] top-1 size-2.5 rounded-full", e.t.type === "INCOME" ? "bg-success" : e.date < today ? "bg-destructive" : "bg-muted-foreground/50")} />
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{relDay(e.date, today)} · {formatDateShort(e.date)}</p>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="truncate">{kindEmoji(e.t)} {e.t.description}{e.projected ? <span className="ml-1 text-xs text-muted-foreground">(previsto)</span> : null}</span>
                  <span className={cn("numeric shrink-0", e.t.type === "INCOME" && "text-success")}>
                    {e.t.type === "INCOME" ? "+" : "−"}{formatCurrency(amt(e.t))}
                  </span>
                </div>
              </li>
            ))}
            {!s.timeline.length ? <li className="text-sm text-muted-foreground">Nenhum compromisso nos próximos 30 dias.</li> : null}
          </ol>
        </Section>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-5 [&>*]:min-w-0 lg:grid-cols-3">
        <Section title="Dinheiro já comprometido">
          <p className="numeric mb-3 text-2xl font-semibold">{formatCurrency(s.commitments)}</p>
          <ul className="space-y-1 text-sm">
            {committed.filter((c) => c.value > 0).map((c) => (
              <li key={c.label}>
                <button type="button" onClick={() => onNavigate(c.sub)} className="flex w-full justify-between rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-elevated">
                  <span className="text-muted-foreground">{c.label}</span>
                  <span className="numeric">{formatCurrency(c.value)}</span>
                </button>
              </li>
            ))}
            {!s.commitments ? <li className="text-muted-foreground">Nada comprometido nos próximos 30 dias.</li> : null}
          </ul>
        </Section>

        <Section title="Como estamos gastando?" action={<Button size="sm" variant="ghost" onClick={() => onNavigate("orcamento")}>Orçamento</Button>}>
          {budgets.length ? (
            <ul className="space-y-3 text-sm">
              {budgets.map(({ c, spent, budget }) => (
                <li key={c.id} className="space-y-1">
                  <div className="flex justify-between"><span>{emojiOf(c.icon)}{c.name}</span><span className="numeric text-muted-foreground">{formatCurrency(spent)} / {formatCurrency(budget)}</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
                    <div className={cn("h-full rounded-full bg-primary", spent > budget && "bg-destructive")} style={{ width: `${Math.min(100, (spent / budget) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Definam limites por categoria para acompanhar aqui.</p>
              <Button size="sm" variant="outline" onClick={() => onNavigate("orcamento")}><Sparkles className="mr-1 size-4" /> Criar orçamento</Button>
            </div>
          )}
        </Section>

        <Section title="Para onde está indo o dinheiro?" action={<Button size="sm" variant="ghost" onClick={() => onNavigate("relatorios")}>Analisar</Button>}>
          {top.length ? (
            <ul className="space-y-2 text-sm">
              {top.map(([id, value]) => (
                <li key={id} className="flex justify-between">
                  <span>{emojiOf(cat(id)?.icon)}{cat(id)?.name ?? "Sem categoria"}</span>
                  <span className="numeric">{formatCurrency(value)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum gasto neste mês ainda.</p>
          )}
        </Section>
      </div>
    </div>
  );
}
