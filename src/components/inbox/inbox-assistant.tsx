import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUp, Check, Loader2, Pencil, X, Users, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useApp } from "@/features/app/app-context";
import { useAccounts, useCards, useCategories } from "@/features/finance/queries";
import { formatCurrency } from "@/lib/format";
import { interpretInbox, type InboxAction } from "@/lib/inbox/inbox.functions";
import { executeAction, missingFields } from "@/features/inbox/execute";
import { useInboxHistory } from "@/features/inbox/history";

type Msg = { role: "user" | "assistant"; content: string };
export type Preview = { key: string; text: string; action: InboxAction };

export const INTENT: Record<InboxAction["intent"], { label: string; emoji: string }> = {
  expense: { label: "Despesa", emoji: "💸" },
  income: { label: "Receita", emoji: "💰" },
  task: { label: "Tarefa", emoji: "✅" },
  event: { label: "Agenda", emoji: "📅" },
  note: { label: "Nota", emoji: "📝" },
  purchase: { label: "Compra planejada", emoji: "🛍️" },
  activity: { label: "Atividade", emoji: "🏃" },
  goal: { label: "Meta", emoji: "🎯" },
};

const EXAMPLES = [
  "Gastei 38,90 de Uber no Nubank",
  "Recebi 2700 de salário",
  "Eu paguei 120 no jantar e divide com a Renifer",
  "Academia hoje 1h20",
  "Sexta 20h jantar com a Renifer",
  "Quero comprar um karaokê até 800",
];

function localToday() {
  const d = new Date();
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { iso, weekday: d.toLocaleDateString("pt-BR", { weekday: "long" }) };
}

function friendlyDate(iso: string | null) {
  if (!iso) return "—";
  const today = localToday().iso;
  if (iso === today) return "Hoje";
  const y = new Date(`${today}T12:00:00`);
  y.setDate(y.getDate() - 1);
  if (iso === y.toISOString().slice(0, 10)) return "Ontem";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}

export function InboxAssistant({ compact = false }: { compact?: boolean }) {
  const { workspaceId, userId, memberProfiles } = useApp();
  const queryClient = useQueryClient();
  const interpret = useServerFn(interpretInbox);
  const { upsert, remove } = useInboxHistory(workspaceId);
  const cards = useCards(workspaceId).data ?? [];
  const accounts = useAccounts(workspaceId).data ?? [];
  const categories = useCategories(workspaceId).data ?? [];
  const [messages, setMessages] = useState<Msg[]>([]);
  const [options, setOptions] = useState<string[]>([]);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [busy]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, previews]);

  const nameOf = useMemo(() => {
    const m = new Map<string, string>();
    cards.forEach((c) => m.set(c.id, c.name));
    accounts.forEach((a) => m.set(a.id, a.name));
    categories.forEach((c) => m.set(c.id, c.name));
    memberProfiles.forEach((p) => m.set(p.id, p.name.split(" ")[0] ?? p.name));
    return (id?: string | null) => (id ? m.get(id) : undefined);
  }, [cards, accounts, categories, memberProfiles]);

  async function send(raw: string) {
    const content = raw.trim();
    if (!content || busy) return;
    const next = [...messages, { role: "user" as const, content }].slice(-14);
    setMessages(next);
    setText("");
    setOptions([]);
    setBusy(true);
    try {
      const t = localToday();
      const res = await interpret({ data: { messages: next, today: t.iso, weekday: t.weekday } });
      const firstUserText = next.filter((m) => m.role === "user").map((m) => m.content).join(" · ");
      // a nova interpretação substitui as prévias ainda não confirmadas
      previews.forEach((p) => remove(p.key));
      const fresh = res.actions.map((action) => ({ key: crypto.randomUUID(), text: firstUserText, action }));
      fresh.forEach((p) => upsert({ id: p.key, text: p.text, status: "pending", action: p.action, createdAt: new Date().toISOString() }));
      setPreviews(fresh);
      setOptions(res.options);
      const reply = res.question ?? (fresh.length ? "Entendi. Confere antes de salvar:" : "Não encontrei nada para registrar. Pode reformular?");
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Não consegui interpretar agora.";
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${msg}` }]);
    } finally {
      setBusy(false);
    }
  }

  function updatePreview(key: string, patch: Partial<InboxAction>) {
    setPreviews((ps) => ps.map((p) => (p.key === key ? { ...p, action: { ...p.action, ...patch } } : p)));
  }

  async function confirm(p: Preview) {
    if (!workspaceId || !userId) return;
    try {
      const ref = await executeAction(p.action, {
        workspaceId,
        userId,
        memberIds: memberProfiles.map((m) => m.id),
        queryClient,
      });
      upsert({ id: p.key, text: p.text, status: "confirmed", action: p.action, createdAt: new Date().toISOString(), ref });
      setPreviews((ps) => ps.filter((x) => x.key !== p.key));
      toast.success(`${INTENT[p.action.intent].label} registrada em ${ref.module}.`);
      if (previews.length <= 1) {
        setMessages([]);
        setOptions([]);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro ao salvar.";
      upsert({ id: p.key, text: p.text, status: "error", action: p.action, createdAt: new Date().toISOString(), error: msg });
      toast.error(msg);
    }
  }

  function cancel(p: Preview) {
    remove(p.key);
    setPreviews((ps) => ps.filter((x) => x.key !== p.key));
    if (previews.length <= 1) {
      setMessages([]);
      setOptions([]);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className={cn("flex min-h-0 flex-col", compact ? "h-full" : "")}>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-3">
        {empty ? (
          <div className="space-y-4 pt-2">
            <div>
              <p className="text-2xl font-semibold tracking-tight">O que aconteceu?</p>
              <p className="text-sm text-muted-foreground">Escreva do seu jeito. Nada é salvo sem sua confirmação.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => send(e)}
                  className="min-h-11 rounded-full border border-border bg-surface px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                >
                  “{e}”
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] text-sm",
                m.role === "user" ? "rounded-2xl rounded-br-md bg-primary px-3 py-2 text-primary-foreground" : "text-foreground",
              )}
            >
              {m.content}
            </div>
          </div>
        ))}

        {busy ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Entendendo…
          </div>
        ) : null}

        {options.length ? (
          <div className="flex flex-wrap gap-2">
            {options.map((o) => (
              <Button key={o} size="sm" variant="outline" className="min-h-11 rounded-full" onClick={() => send(o)}>
                {o}
              </Button>
            ))}
          </div>
        ) : null}

        {previews.map((p) => (
          <PreviewCard
            key={p.key}
            preview={p}
            nameOf={nameOf}
            cards={cards}
            accounts={accounts}
            categories={categories}
            onChange={(patch) => updatePreview(p.key, patch)}
            onConfirm={() => confirm(p)}
            onCancel={() => cancel(p)}
            userId={userId}
            hasPartner={memberProfiles.length === 2}
            partnerName={nameOf(memberProfiles.find((m) => m.id !== userId)?.id)}
          />
        ))}
        <div ref={endRef} />
      </div>

      <form
        className="flex items-end gap-2 border-t border-border pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <Textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(text);
            }
          }}
          rows={1}
          placeholder={empty ? "Digite naturalmente…" : "Responder ou complementar…"}
          className="max-h-32 min-h-11 resize-none text-base md:text-sm"
          aria-label="Mensagem para o Life OS"
        />
        <Button type="submit" size="icon" className="size-11 shrink-0 rounded-xl" disabled={busy || !text.trim()} aria-label="Enviar">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
        </Button>
      </form>
    </div>
  );
}

type Named = { id: string; name: string };

export function PreviewCard({
  preview,
  nameOf,
  cards,
  accounts,
  categories,
  onChange,
  onConfirm,
  onCancel,
  userId,
  hasPartner,
  partnerName,
}: {
  preview: Preview;
  nameOf: (id?: string | null) => string | undefined;
  cards: Named[];
  accounts: Named[];
  categories: (Named & { type: string })[];
  onChange: (patch: Partial<InboxAction>) => void;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  userId?: string | undefined;
  hasPartner: boolean;
  partnerName?: string | undefined;
}) {
  const a = preview.action;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const meta = INTENT[a.intent];
  const isMoney = a.intent === "expense" || a.intent === "income";
  const missing = missingFields(a);
  const payment = a.card_id ? `card:${a.card_id}` : a.account_id ? `account:${a.account_id}` : "";
  const shared = a.intent === "expense" && a.shared && hasPartner;
  const mine = a.amount ? Math.round(a.amount * (a.my_share_percent ?? 50)) / 100 : 0;
  const theirs = a.amount ? Math.round((a.amount - mine) * 100) / 100 : 0;
  const payerName = nameOf(a.payer_user_id) ?? "Você";

  const rows: [string, string][] = [];
  rows.push(["Quando", `${friendlyDate(a.date)}${a.time ? ` · ${a.time}` : ""}`]);
  if (isMoney || a.intent === "purchase" || a.intent === "goal") {
    if (a.category_id) rows.push(["Categoria", nameOf(a.category_id) ?? "—"]);
  }
  if (a.intent === "expense") rows.push(["Pagamento", nameOf(a.card_id) ?? nameOf(a.account_id) ?? "—"]);
  if (a.intent === "income" && a.account_id) rows.push(["Conta", nameOf(a.account_id) ?? "—"]);
  if (a.installments && a.amount) rows.push(["Parcelas", `${a.installments}x de ${formatCurrency(a.amount / a.installments)}`]);
  if (a.intent === "activity" && a.duration_minutes) rows.push(["Duração", `${Math.floor(a.duration_minutes / 60) ? `${Math.floor(a.duration_minutes / 60)}h` : ""}${a.duration_minutes % 60 ? `${a.duration_minutes % 60}min` : ""}`]);
  if (a.intent === "activity" && a.distance_km) rows.push(["Distância", `${a.distance_km} km`]);
  if (a.intent === "note" && a.content && a.content !== a.description) rows.push(["Conteúdo", a.content]);

  return (
    <div className="rounded-2xl border border-primary/30 bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">
            {meta.emoji} {meta.label}
          </p>
          <p className="truncate text-lg font-semibold">{a.description || "Sem descrição"}</p>
        </div>
        {a.amount ? (
          <p className={cn("shrink-0 text-lg font-semibold tabular-nums", a.intent === "income" && "text-success")}>
            {a.intent === "purchase" ? "até " : ""}
            {formatCurrency(a.amount)}
          </p>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Input value={a.description} onChange={(e) => onChange({ description: e.target.value })} aria-label="Descrição" />
          {isMoney || a.intent === "purchase" || a.intent === "goal" ? (
            <Input
              inputMode="decimal"
              value={a.amount ?? ""}
              onChange={(e) => onChange({ amount: Number(e.target.value.replace(",", ".")) || null })}
              aria-label="Valor"
              placeholder="Valor"
            />
          ) : null}
          <Input type="date" value={a.date ?? ""} onChange={(e) => onChange({ date: e.target.value })} aria-label="Data" />
          {a.intent === "event" ? (
            <Input type="time" value={a.time ?? ""} onChange={(e) => onChange({ time: e.target.value })} aria-label="Hora" />
          ) : null}
          {isMoney ? (
            <Select value={a.category_id ?? ""} onValueChange={(v) => onChange({ category_id: v })}>
              <SelectTrigger aria-label="Categoria"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                {categories
                  .filter((c) => c.type === (a.intent === "expense" ? "EXPENSE" : "INCOME"))
                  .map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      ) : (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="truncate">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      {a.intent === "expense" && (!payment || editing) ? (
        <div className="mt-3">
          <Select
            value={payment}
            onValueChange={(v) => {
              const [kind, id] = v.split(":");
              onChange(kind === "card" ? { card_id: id ?? null, account_id: null } : { account_id: id ?? null, card_id: null });
            }}
          >
            <SelectTrigger aria-label="Como você pagou?" className={cn(!payment && "border-warning")}>
              <SelectValue placeholder="Como você pagou?" />
            </SelectTrigger>
            <SelectContent>
              {cards.map((c) => (
                <SelectItem key={c.id} value={`card:${c.id}`}>💳 {c.name}</SelectItem>
              ))}
              {a.installments ? null : accounts.map((c) => (
                <SelectItem key={c.id} value={`account:${c.id}`}>🏦 {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {shared && a.amount ? (
        <div className="mt-3 rounded-xl bg-muted/50 p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium"><Users className="size-4" /> Dividida · pago por {payerName}</p>
          <p className="mt-1 text-muted-foreground">
            {nameOf(userId)}: {formatCurrency(mine)} · {partnerName ?? "outra parte"}: {formatCurrency(theirs)}
          </p>
          {theirs > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">O acerto será calculado pelo módulo Nós ao confirmar.</p>
          ) : null}
        </div>
      ) : null}

      {a.card_id && a.intent === "expense" ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <CreditCard className="size-3.5" /> Vence na fatura do cartão, conforme o ciclo.
        </p>
      ) : null}

      {missing.length ? <p className="mt-2 text-xs text-warning">Falta: {missing.join(", ")}</p> : null}

      <div className="mt-4 flex gap-2">
        <Button
          className="min-h-11 flex-1"
          disabled={!!missing.length || saving}
          onClick={async () => {
            setSaving(true);
            await onConfirm();
            setSaving(false);
          }}
        >
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Confirmar
        </Button>
        <Button variant="outline" className="min-h-11" onClick={() => setEditing((v) => !v)} aria-label="Editar">
          <Pencil className="size-4" /> <span className="hidden sm:inline">{editing ? "Pronto" : "Editar"}</span>
        </Button>
        <Button variant="ghost" className="min-h-11" onClick={onCancel} aria-label="Cancelar">
          <X className="size-4" /> <span className="hidden sm:inline">Cancelar</span>
        </Button>
      </div>
    </div>
  );
}

export function InboxHistoryList() {
  const { workspaceId } = useApp();
  const { entries, remove } = useInboxHistory(workspaceId);
  const [tab, setTab] = useState<"confirmed" | "pending" | "error">("confirmed");
  const list = entries.filter((e) => e.status === tab);
  const tabs = [
    { v: "confirmed" as const, l: "Confirmados" },
    { v: "pending" as const, l: "Pendentes" },
    { v: "error" as const, l: "Com erro" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-xl bg-muted/50 p-1">
        {tabs.map((t) => (
          <button
            key={t.v}
            type="button"
            onClick={() => setTab(t.v)}
            className={cn("min-h-10 flex-1 rounded-lg text-xs font-medium", tab === t.v ? "bg-surface shadow-sm" : "text-muted-foreground")}
          >
            {t.l} ({entries.filter((e) => e.status === t.v).length})
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Nada por aqui.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((e) => (
            <li key={e.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
              <span className="text-lg">{INTENT[e.action.intent].emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {e.action.description}
                  {e.action.amount ? ` · ${formatCurrency(e.action.amount)}` : ""}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  “{e.text}” · {new Date(e.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
                {e.error ? <p className="truncate text-xs text-destructive">{e.error}</p> : null}
              </div>
              {e.ref ? (
                <Button asChild size="sm" variant="ghost">
                  <Link to={e.ref.href}>{e.ref.module}</Link>
                </Button>
              ) : (
                <Button size="icon" variant="ghost" aria-label="Remover" onClick={() => remove(e.id)}>
                  <X className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
