import { useMemo, useState } from "react";
import { ArrowRight, Copy, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { todayISO, isOpen } from "@/features/finance/calc";
import { simulate, type Base, type Scenario, type ScenarioKind, type SimResult } from "@/features/finance/simulator";
import type { Card, Category, Recurring } from "@/features/finance/queries";

type Ctx = { id: string; name: string; budget_amount: number | null };
export type WhatIfPrefill = { title?: string; amount?: number; categoryId?: string; contextId?: string; person?: string };

const KINDS: { value: ScenarioKind | "other"; label: string; emoji: string }[] = [
  { value: "purchase", label: "Nova compra", emoji: "🛍️" },
  { value: "expense", label: "Nova despesa", emoji: "💸" },
  { value: "income", label: "Nova receita", emoji: "💰" },
  { value: "installment", label: "Nova parcela", emoji: "🧾" },
  { value: "cancel", label: "Cancelar despesa", emoji: "✂️" },
  { value: "change", label: "Alterar valor", emoji: "🔁" },
  { value: "other", label: "Outro", emoji: "✨" },
];

const NONE = "none";
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v: string) => Number(v.replace(/\./g, "").replace(",", ".")) || 0;
const monthLabel = (m: string) => new Date(`${m}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");

type Draft = {
  kind: ScenarioKind;
  description: string;
  amount: string;
  date: string;
  mode: "cash" | "split";
  parts: string;
  recurringIncome: boolean;
  cardId: string;
  accountId: string;
  categoryId: string;
  contextId: string;
  person: string;
  targetKey: string;
  newAmount: string;
};

const emptyDraft = (p?: WhatIfPrefill): Draft => ({
  kind: "purchase",
  description: p?.title ?? "",
  amount: p?.amount ? String(p.amount).replace(".", ",") : "",
  date: todayISO(),
  mode: "cash",
  parts: "10",
  recurringIncome: false,
  cardId: NONE,
  accountId: NONE,
  categoryId: p?.categoryId ?? NONE,
  contextId: p?.contextId ?? NONE,
  person: p?.person ?? "COUPLE",
  targetKey: "",
  newAmount: "",
});

function toScenario(d: Draft): Scenario {
  const split = d.kind === "installment" || (d.kind === "purchase" && d.mode === "split");
  return {
    kind: d.kind,
    description: d.description,
    amount: num(d.amount),
    date: d.date || todayISO(),
    parts: split ? Math.max(1, Number(d.parts) || 1) : 1,
    recurringIncome: d.recurringIncome,
    cardId: d.cardId === NONE ? null : d.cardId,
    accountId: d.accountId === NONE ? null : d.accountId,
    categoryId: d.categoryId === NONE ? null : d.categoryId,
    contextId: d.contextId === NONE ? null : d.contextId,
    targetKey: d.targetKey || null,
    newAmount: num(d.newAmount),
  };
}

type Props = Base & {
  cards: Card[];
  categories: Category[];
  contexts: Ctx[];
  members: { id: string; name: string }[];
  prefill?: WhatIfPrefill;
};

export function WhatIf(props: Props) {
  const { accounts, transactions, recurrences, payments, cards, categories, contexts, members, prefill } = props;
  const [drafts, setDrafts] = useState<Draft[]>(() => [emptyDraft(prefill)]);
  const [ran, setRan] = useState(false);
  const base: Base = { accounts, transactions, recurrences, payments };

  const targets = useMemo(() => {
    const today = todayISO();
    return [
      ...recurrences.filter((r) => r.is_active && r.type === "EXPENSE").map((r: Recurring) => ({ key: `rec:${r.id}`, label: `${r.description} · ${brl(Number(r.amount))}/mês`, amount: Number(r.amount) })),
      ...transactions
        .filter((t) => t.type === "EXPENSE" && isOpen(t) && !t.recurring_id && (t.due_date ?? t.transaction_date) >= today)
        .slice(0, 40)
        .map((t) => ({ key: `tx:${t.id}`, label: `${t.description} · ${brl(Number(t.amount))}`, amount: Number(t.amount) })),
    ];
  }, [recurrences, transactions]);

  const results: (SimResult | null)[] = useMemo(
    () => (ran ? drafts.map((d) => simulate(base, toScenario(d))) : drafts.map(() => null)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ran, drafts, accounts, transactions, recurrences, payments],
  );

  const update = (i: number, patch: Partial<Draft>) => setDrafts((all) => all.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card to-card p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">Simulador</p>
        <h2 className="mt-1 text-2xl font-semibold sm:text-3xl">E se...?</h2>
        <p className="mt-1 text-sm text-muted-foreground">Veja como uma decisão pode mudar o dinheiro de vocês.</p>
        <p className="mt-3 text-xs text-muted-foreground">Só uma projeção: nada é gravado e tudo some quando vocês saem da tela.</p>
      </div>

      <div className={`grid gap-4 ${drafts.length > 1 ? "lg:grid-cols-2" : ""} [&>*]:min-w-0`}>
        {drafts.map((d, i) => (
          <ScenarioForm
            key={i}
            index={i}
            total={drafts.length}
            draft={d}
            onChange={(patch) => { update(i, patch); }}
            onRemove={() => setDrafts((all) => all.filter((_, j) => j !== i))}
            cards={cards}
            accounts={accounts}
            categories={categories}
            contexts={contexts}
            members={members}
            targets={targets}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setRan(true)}><Sparkles className="mr-1 size-4" /> Simular</Button>
        {drafts.length < 2 ? (
          <Button variant="outline" onClick={() => setDrafts((all) => [...all, { ...all[0]!, mode: all[0]!.mode === "cash" ? "split" : "cash" }])}>
            <Copy className="mr-1 size-4" /> Comparar com outra opção
          </Button>
        ) : null}
        {ran ? <Button variant="ghost" onClick={() => { setDrafts([emptyDraft()]); setRan(false); }}>Recomeçar</Button> : null}
      </div>

      {ran && results[0] ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {drafts.length > 1 ? (
            <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
              {results.map((r, i) => r ? <OptionSummary key={i} label={`Opção ${String.fromCharCode(65 + i)}`} r={r} /> : null)}
            </div>
          ) : null}
          {results.map((r, i) =>
            r ? (
              <ResultView
                key={i}
                title={drafts.length > 1 ? `Opção ${String.fromCharCode(65 + i)}` : undefined}
                r={r}
                draft={drafts[i]!}
                contexts={contexts}
                transactions={transactions}
              />
            ) : null,
          )}
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5 min-w-0"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}

function Pick({ value, onChange, items, placeholder }: { value: string; onChange: (v: string) => void; items: { value: string; label: string }[]; placeholder: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{placeholder}</SelectItem>
        {items.map((it) => <SelectItem key={it.value} value={it.value}>{it.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function ScenarioForm({ index, total, draft: d, onChange, onRemove, cards, accounts, categories, contexts, members, targets }: {
  index: number; total: number; draft: Draft; onChange: (p: Partial<Draft>) => void; onRemove: () => void;
  cards: Card[]; accounts: Base["accounts"]; categories: Category[]; contexts: Ctx[]; members: { id: string; name: string }[];
  targets: { key: string; label: string; amount: number }[];
}) {
  const isSpend = d.kind === "purchase" || d.kind === "expense" || d.kind === "installment";
  const isTarget = d.kind === "cancel" || d.kind === "change";
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{total > 1 ? `Opção ${String.fromCharCode(65 + index)}` : "O que vocês estão pensando em fazer?"}</p>
        {total > 1 && index > 0 ? <Button size="icon" variant="ghost" aria-label="Remover opção" onClick={onRemove}><X className="size-4" /></Button> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => {
          const active = k.value === d.kind;
          return (
            <button
              key={k.value}
              type="button"
              onClick={() => onChange({ kind: k.value === "other" ? "expense" : (k.value as ScenarioKind), targetKey: "" })}
              className={`min-h-11 rounded-full border px-3 py-2 text-sm transition-all ${active ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"}`}
            >
              <span className="mr-1">{k.emoji}</span>{k.label}
            </button>
          );
        })}
      </div>

      {isTarget ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Qual despesa?">
            <Select value={d.targetKey || NONE} onValueChange={(v) => onChange({ targetKey: v === NONE ? "" : v, newAmount: String(targets.find((t) => t.key === v)?.amount ?? "").replace(".", ",") })}>
              <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Escolha</SelectItem>
                {targets.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          {d.kind === "change" ? (
            <Field label="Novo valor"><Input inputMode="decimal" placeholder="1.500,00" value={d.newAmount} onChange={(e) => onChange({ newAmount: e.target.value })} /></Field>
          ) : null}
          {!targets.length ? <p className="text-xs text-muted-foreground sm:col-span-2">Nenhuma despesa futura ou recorrente para escolher ainda.</p> : null}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Descrição"><Input placeholder={d.kind === "income" ? "Freela, bônus…" : "Ex.: Sofá novo"} value={d.description} onChange={(e) => onChange({ description: e.target.value })} /></Field>
          <Field label="Valor"><Input inputMode="decimal" placeholder="3.000,00" value={d.amount} onChange={(e) => onChange({ amount: e.target.value })} /></Field>
          <Field label="Data"><Input type="date" value={d.date} onChange={(e) => onChange({ date: e.target.value })} /></Field>
          {d.kind === "income" ? (
            <Field label="Frequência">
              <Select value={d.recurringIncome ? "rec" : "once"} onValueChange={(v) => onChange({ recurringIncome: v === "rec" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="once">Uma vez</SelectItem><SelectItem value="rec">Todo mês</SelectItem></SelectContent>
              </Select>
            </Field>
          ) : null}
          {d.kind === "purchase" ? (
            <Field label="Pagamento">
              <Select value={d.mode} onValueChange={(v) => onChange({ mode: v as Draft["mode"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="cash">À vista</SelectItem><SelectItem value="split">Parcelado</SelectItem></SelectContent>
              </Select>
            </Field>
          ) : null}
          {d.kind === "installment" || (d.kind === "purchase" && d.mode === "split") ? (
            <Field label="Parcelas"><Input inputMode="numeric" value={d.parts} onChange={(e) => onChange({ parts: e.target.value })} /></Field>
          ) : null}
          {isSpend ? (
            <Field label="Cartão"><Pick value={d.cardId} onChange={(v) => onChange({ cardId: v })} placeholder="Sem cartão" items={cards.filter((c) => c.is_active).map((c) => ({ value: c.id, label: c.name }))} /></Field>
          ) : null}
          <Field label="Conta"><Pick value={d.accountId} onChange={(v) => onChange({ accountId: v })} placeholder="Qualquer conta" items={accounts.filter((a) => a.is_active).map((a) => ({ value: a.id, label: a.name }))} /></Field>
          <Field label="Categoria"><Pick value={d.categoryId} onChange={(v) => onChange({ categoryId: v })} placeholder="Sem categoria" items={categories.map((c) => ({ value: c.id, label: c.name }))} /></Field>
          <Field label="Contexto"><Pick value={d.contextId} onChange={(v) => onChange({ contextId: v })} placeholder="Sem contexto" items={contexts.map((c) => ({ value: c.id, label: c.name }))} /></Field>
          <Field label="Pessoa">
            <Select value={d.person} onValueChange={(v) => onChange({ person: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="COUPLE">Nós 👥</SelectItem>
                {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
      )}
    </div>
  );
}

function Delta({ v }: { v: number }) {
  if (Math.abs(v) < 0.005) return <span className="text-muted-foreground">sem mudança</span>;
  return <span className={v > 0 ? "text-success" : "text-destructive"}>{v > 0 ? "+" : "−"}{brl(Math.abs(v))}</span>;
}

function OptionSummary({ label, r }: { label: string; r: SimResult }) {
  const lowest = Math.min(...r.series.map((p) => p.after), r.after.lowest);
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-sm">
      <p className="mb-2 font-medium">{label}</p>
      <dl className="space-y-1.5">
        <Row k="Dinheiro livre" v={brl(r.after.spendable)} />
        <Row k="Impacto mensal" v={r.monthlyDelta ? `${r.monthlyDelta > 0 ? "+" : "−"}${brl(Math.abs(r.monthlyDelta))}/mês` : "—"} />
        <Row k="Impacto total (12 meses)" v={<Delta v={r.totalImpact} />} />
        <Row k="Menor saldo projetado" v={brl(lowest)} />
        <Row k="Período comprometido" v={r.affectedMonths ? `${r.affectedMonths} ${r.affectedMonths === 1 ? "mês" : "meses"}` : "—"} />
      </dl>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium tabular-nums">{v}</dd></div>;
}

function ResultView({ title, r, draft, contexts, transactions }: { title?: string; r: SimResult; draft: Draft; contexts: Ctx[]; transactions: Base["transactions"] }) {
  const ctx = draft.contextId !== NONE ? contexts.find((c) => c.id === draft.contextId) : undefined;
  const ctxSpent = ctx ? transactions.filter((t) => t.context_id === ctx.id && t.type === "EXPENSE" && t.status !== "CANCELLED").reduce((s, t) => s + Number(t.amount), 0) : 0;
  const simAmount = num(draft.amount);
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      {title ? <p className="font-medium">{title}</p> : null}
      <div className="space-y-2">
        {r.conclusions.map((c) => (
          <p key={c} className="rounded-xl bg-primary/10 px-3 py-2 text-sm">{c}</p>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
        <Compare label="Sem a decisão" s={r.before} muted />
        <Compare label="Com a decisão" s={r.after} />
      </div>
      <p className="text-sm">Diferença no dinheiro livre: <Delta v={r.after.spendable - r.before.spendable} />
        {r.monthlyDelta ? <> · {r.monthlyDelta > 0 ? "+" : "−"}{brl(Math.abs(r.monthlyDelta))}/mês</> : null}</p>
      {draft.kind === "cancel" && r.monthlyDelta > 0 ? (
        <p className="text-sm text-muted-foreground">Economia mensal {brl(r.monthlyDelta)} · em 12 meses {brl(r.monthlyDelta * 12)}</p>
      ) : null}

      <div>
        <p className="mb-2 text-sm font-medium">Próximos meses</p>
        <SimChart series={r.series} />
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {r.series.slice(0, 4).map((p, i) => (
            <li key={p.month} className="rounded-xl bg-elevated px-3 py-2 text-xs">
              <p className="text-muted-foreground">{i === 0 ? "Este mês" : monthLabel(p.month)}</p>
              <p className="font-medium tabular-nums">{brl(p.after)}</p>
              <p className="tabular-nums"><Delta v={p.after - p.before} /></p>
            </li>
          ))}
        </ul>
      </div>

      {ctx ? (
        <div className="rounded-xl border border-border p-3 text-sm">
          <p className="font-medium">Contexto: {ctx.name}</p>
          <p className="text-muted-foreground">
            Já gasto {brl(ctxSpent)}{ctx.budget_amount != null ? ` de ${brl(Number(ctx.budget_amount))}` : ""} · com a simulação {brl(ctxSpent + simAmount)}
            {ctx.budget_amount != null && ctxSpent + simAmount > Number(ctx.budget_amount) ? " — passaria do orçamento do contexto." : ""}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Compare({ label, s, muted }: { label: string; s: SimResult["before"]; muted?: boolean }) {
  return (
    <div className={`rounded-xl p-3 text-sm ${muted ? "bg-elevated" : "border border-primary/40 bg-primary/5"}`}>
      <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <dl className="space-y-1">
        <Row k="Dinheiro livre" v={<span className={s.spendable <= 0 ? "text-destructive" : ""}>{brl(s.spendable)}</span>} />
        <Row k="Saldo projetado (30 dias)" v={brl(s.safe)} />
        <Row k="Menor ponto" v={<span className={s.lowest < 0 ? "text-destructive" : ""}>{brl(s.lowest)}</span>} />
        <Row k="Comprometimento" v={brl(s.commitments)} />
      </dl>
    </div>
  );
}

function SimChart({ series }: { series: SimResult["series"] }) {
  const W = 600, H = 180, P = 24;
  const vals = series.flatMap((p) => [p.before, p.after]);
  const min = Math.min(0, ...vals), max = Math.max(1, ...vals);
  const x = (i: number) => P + (i * (W - 2 * P)) / Math.max(1, series.length - 1);
  const y = (v: number) => H - P - ((v - min) / (max - min || 1)) * (H - 2 * P);
  const path = (k: "before" | "after") => series.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(" ");
  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" role="img" aria-label="Projeção atual versus projeção com a simulação">
        {min < 0 ? <line x1={P} x2={W - P} y1={y(0)} y2={y(0)} className="stroke-destructive/40" strokeDasharray="4 4" /> : null}
        <path d={path("before")} fill="none" className="stroke-muted-foreground" strokeWidth={2} strokeDasharray="5 5" />
        <path d={path("after")} fill="none" className="stroke-primary" strokeWidth={2.5} />
        {series.map((p, i) => (i % 2 === 0 ? <text key={p.month} x={x(i)} y={H - 4} textAnchor="middle" className="fill-muted-foreground text-[11px]">{monthLabel(p.month)}</text> : null))}
      </svg>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-0.5 w-4 border-t-2 border-dashed border-muted-foreground" /> Projeção atual</span>
        <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-primary" /> Com a simulação <ArrowRight className="size-3" /></span>
      </div>
    </div>
  );
}
