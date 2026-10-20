import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  X,
  ArrowUpRight,
  Wallet,
  CalendarDays,
  ListChecks,
  Target,
  Dumbbell,
  ShoppingBag,
  CreditCard,
  Heart,
  Layers,
  Repeat,
  GraduationCap,
} from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Tool, ToolHeader } from "@/components/ai-elements/tool";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/features/app/app-context";
import { useAccounts, useCards, useCategories } from "@/features/finance/queries";
import { executeAction } from "@/features/inbox/execute";
import { PreviewCard, INTENT } from "@/components/inbox/inbox-assistant";
import { saveActionState, type ActionState } from "@/features/agent/conversations";
import type { InboxAction } from "@/lib/inbox/inbox.functions";
import aiMark from "@/assets/lifeos-ai.png";
import { cn } from "@/lib/utils";
import { isToolFailure } from "@/features/plugins/contracts";
import { actionSchema } from "@/features/plugins/action-schema";

/** Rótulos amigáveis: o usuário vê o que está sendo consultado, nunca nomes técnicos. */
const TOOL_UI: Record<string, { label: string; done: string; icon: typeof Wallet }> = {
  financial_overview: {
    label: "Consultando seu Financeiro…",
    done: "Dinheiro Livre consultado",
    icon: Wallet,
  },
  transactions_summary: {
    label: "Analisando seus lançamentos…",
    done: "Lançamentos analisados",
    icon: Wallet,
  },
  monthly_trend: {
    label: "Comparando com meses anteriores…",
    done: "Histórico comparado",
    icon: Wallet,
  },
  cards_status: { label: "Olhando seus cartões…", done: "Cartões consultados", icon: CreditCard },
  upcoming_bills: {
    label: "Vendo suas próximas contas…",
    done: "Próximas contas consultadas",
    icon: Wallet,
  },
  installments: { label: "Conferindo parcelas…", done: "Parcelas consultadas", icon: CreditCard },
  nos_balance: { label: "Consultando o Nós…", done: "Nós consultado", icon: Heart },
  goals: { label: "Vendo suas metas…", done: "Metas consultadas", icon: Target },
  tasks: { label: "Conferindo suas tarefas…", done: "Tarefas consultadas", icon: ListChecks },
  agenda: { label: "Consultando sua agenda…", done: "Agenda consultada", icon: CalendarDays },
  activities: { label: "Olhando seus treinos…", done: "Atividades consultadas", icon: Dumbbell },
  purchases: {
    label: "Abrindo sua lista de compras…",
    done: "Compras consultadas",
    icon: ShoppingBag,
  },
  routines_today: { label: "Vendo suas rotinas…", done: "Rotinas consultadas", icon: Repeat },
  contexts: { label: "Consultando contextos…", done: "Contextos consultados", icon: Layers },
  context_details: { label: "Conferindo o contexto…", done: "Contexto verificado", icon: Layers },
  notes: { label: "Consultando notas…", done: "Notas consultadas", icon: Layers },
  academics: {
    label: "Consultando sua vida acadêmica…",
    done: "Faculdade consultada",
    icon: GraduationCap,
  },
};

const FOLLOW_UPS: Record<string, string[]> = {
  financial_overview: ["Onde está comprometido?", "Quais as próximas contas?"],
  transactions_summary: ["Comparar com o mês passado", "Quais as maiores despesas?"],
  cards_status: ["Quando vence cada fatura?", "Quanto falta pagar das parcelas?"],
  tasks: ["O que tenho hoje na agenda?"],
  agenda: ["Quais tarefas estão atrasadas?"],
  goals: ["Quanto posso guardar este mês?"],
  nos_balance: ["Quais despesas dividimos este mês?"],
};

export const EXAMPLES = [
  "Como estão minhas finanças?",
  "Quanto gastei este mês?",
  "Quanto posso gastar?",
  "O que tenho hoje?",
  "Gastei 38,90 no Uber",
  "Como está minha vida?",
];

export function AgentMark({ className }: { className?: string }) {
  return (
    <img
      src={aiMark}
      alt="Life OS AI"
      width={816}
      height={816}
      className={cn("size-8 shrink-0 object-contain", className)}
    />
  );
}

export function AgentChat({
  threadId,
  initialMessages,
  initialActionStates,
  autoSend,
  pageContext,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  initialActionStates: Record<string, ActionState>;
  autoSend?: string | undefined;
  pageContext?: string | undefined;
}) {
  const { workspaceId, userId, memberProfiles } = useApp();
  const queryClient = useQueryClient();
  const cards = useCards(workspaceId).data ?? [];
  const accounts = useAccounts(workspaceId).data ?? [];
  const categories = useCategories(workspaceId).data ?? [];
  const [text, setText] = useState("");
  const [states, setStates] = useState(initialActionStates);
  const [edits, setEdits] = useState<Record<string, InboxAction>>({});
  const sentAuto = useRef(false);
  const confirming = useRef(new Set<string>());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/agent",
        body: { threadId, pageContext },
        headers: async (): Promise<Record<string, string>> => {
          const { data } = await supabase.auth.getSession();
          return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
        },
      }),
    [pageContext, threadId],
  );

  const { messages, sendMessage, status, stop } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (e) => toast.error(e.message || "Não consegui responder agora."),
    onFinish: () => {
      void queryClient.invalidateQueries({ queryKey: ["ai_conversations"] });
      void queryClient.invalidateQueries({ queryKey: ["ai_conversation", threadId] });
    },
  });
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (!busy) textareaRef.current?.focus();
  }, [busy]);

  useEffect(() => {
    if (!autoSend || sentAuto.current || initialMessages.length > 0) return;
    // adiado: em modo estrito o primeiro efeito é desmontado antes do envio
    const t = window.setTimeout(() => {
      sentAuto.current = true;
      void sendMessage({ text: autoSend });
    }, 60);
    return () => window.clearTimeout(t);
  }, [autoSend, initialMessages.length, sendMessage]);

  const nameOf = useMemo(() => {
    const m = new Map<string, string>();
    cards.forEach((c) => m.set(c.id, c.name));
    accounts.forEach((a) => m.set(a.id, a.name));
    categories.forEach((c) => m.set(c.id, c.name));
    memberProfiles.forEach((p) => m.set(p.id, p.name.split(" ")[0] ?? p.name));
    return (id?: string | null) => (id ? m.get(id) : undefined);
  }, [cards, accounts, categories, memberProfiles]);

  function send(value: string) {
    const t = value.trim();
    if (!t || busy) return;
    setText("");
    void sendMessage({ text: t });
  }

  async function record(id: string, state: ActionState) {
    setStates((s) => ({ ...s, [id]: state }));
    try {
      await saveActionState(threadId, id, state);
    } catch {
      toast.warning(
        "O estado da prévia não foi sincronizado. Confira o módulo antes de repetir a ação após recarregar.",
      );
    }
  }

  async function confirm(id: string, action: InboxAction) {
    if (!workspaceId || !userId || confirming.current.has(id) || states[id]?.status === "confirmed")
      return;
    confirming.current.add(id);
    try {
      const ref = await executeAction(action, {
        workspaceId,
        userId,
        memberIds: memberProfiles.map((m) => m.id),
        queryClient,
        threadId,
      });
      await record(id, { status: "confirmed", module: ref.module, href: ref.href });
      toast.success(`Operação confirmada em ${ref.module}.`);
      // Advisory continuation; server reads verify records before subsequent proposals.
      if (action.intent === "create_context" && !busy)
        void sendMessage({
          text: `Confirmei a prévia do contexto “${action.description}”. Verifique o contexto salvo e continue o pedido anterior, sem repetir etapas concluídas; qualquer próxima escrita precisa de nova confirmação.`,
        });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro ao salvar.";
      await record(id, { status: "error", error: msg });
      toast.error(msg);
    } finally {
      confirming.current.delete(id);
      void queryClient.invalidateQueries({ queryKey: ["ai_capability_history"] });
    }
  }

  const last = messages[messages.length - 1];
  const followUps =
    !busy && last?.role === "assistant"
      ? [
          ...new Set(
            last.parts.flatMap((p) =>
              p.type.startsWith("tool-") ? (FOLLOW_UPS[p.type.slice(5)] ?? []) : [],
            ),
          ),
        ].slice(0, 2)
      : [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-5 px-0 pb-6">
          {messages.length === 0 && !autoSend ? (
            <div className="flex flex-col items-start gap-4 pt-6">
              <AgentMark className="size-14" />
              <div>
                <p className="text-2xl font-semibold tracking-tight">Oi! Eu conheço seu Life OS.</p>
                <p className="text-sm text-muted-foreground">
                  Pergunte sobre dinheiro, agenda, tarefas, metas, treinos… ou conte o que
                  aconteceu. Nada é salvo sem sua confirmação.
                </p>
              </div>
              <Suggestions>
                {EXAMPLES.map((e) => (
                  <Suggestion key={e} suggestion={e} onClick={send} className="min-h-11" />
                ))}
              </Suggestions>
            </div>
          ) : null}

          {messages.map((m) => (
            <Message key={m.id} from={m.role}>
              {m.role === "assistant" ? <AgentMark className="mb-1 size-6" /> : null}
              <MessageContent
                className={cn(m.role === "user" && "bg-primary text-primary-foreground")}
              >
                {m.parts.map((part, i) => {
                  if (part.type === "text") {
                    return m.role === "user" ? (
                      <p key={i} className="whitespace-pre-wrap">
                        {part.text}
                      </p>
                    ) : (
                      <MessageResponse key={i}>{part.text}</MessageResponse>
                    );
                  }
                  if (part.type === "tool-propose_action") {
                    if (part.state === "output-error" || part.state === "output-denied")
                      return (
                        <Tool key={i} defaultOpen={false} className="w-fit">
                          <ToolHeader
                            type="tool-propose_action"
                            state="output-error"
                            title="Não foi possível preparar a prévia"
                          />
                        </Tool>
                      );
                    if (part.state !== "output-available")
                      return <Shimmer key={i}>Preparando a prévia…</Shimmer>;
                    if (!actionSchema.safeParse(part.output).success)
                      return (
                        <p key={i} className="text-sm text-destructive">
                          Prévia indisponível.
                        </p>
                      );
                    const id = part.toolCallId;
                    const action = edits[id] ?? (part.output as InboxAction);
                    const st = states[id];
                    if (st?.status === "confirmed") {
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm"
                        >
                          <Check className="size-4 text-success" /> {INTENT[action.intent].emoji}{" "}
                          {action.description} —{" "}
                          {action.intent === "delete_context"
                            ? "movido para lixeira"
                            : action.intent === "archive_context"
                              ? "arquivado"
                              : "salvo"}{" "}
                          em {st.module}
                          {st.href ? (
                            <Link
                              to={st.href}
                              className="ml-auto inline-flex items-center gap-1 text-xs text-primary"
                            >
                              Ver <ArrowUpRight className="size-3" />
                            </Link>
                          ) : null}
                        </div>
                      );
                    }
                    if (st?.status === "cancelled") {
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-2 text-sm text-muted-foreground"
                        >
                          <X className="size-4" /> {action.description} — cancelado
                        </div>
                      );
                    }
                    return (
                      <PreviewCard
                        key={i}
                        preview={{ key: id, text: "", action }}
                        nameOf={nameOf}
                        cards={cards}
                        accounts={accounts}
                        categories={categories}
                        onChange={(patch) =>
                          setEdits((e) => ({ ...e, [id]: { ...action, ...patch } }))
                        }
                        onConfirm={() => confirm(id, action)}
                        onCancel={() => void record(id, { status: "cancelled" })}
                        userId={userId}
                        hasPartner={memberProfiles.length === 2}
                        partnerName={nameOf(memberProfiles.find((p) => p.id !== userId)?.id)}
                        error={st?.status === "error" ? st.error : undefined}
                      />
                    );
                  }
                  if (part.type.startsWith("tool-") && "state" in part) {
                    const ui = TOOL_UI[part.type.slice(5)];
                    const failed =
                      part.state === "output-error" ||
                      ("output" in part && isToolFailure(part.output));
                    const running =
                      part.state === "input-streaming" || part.state === "input-available";
                    if (running) {
                      return (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          {ui ? <ui.icon className="size-4 text-primary" /> : null}
                          <Shimmer>{ui?.label ?? "Consultando…"}</Shimmer>
                        </div>
                      );
                    }
                    return (
                      <Tool
                        key={i}
                        defaultOpen={false}
                        className="mb-0 w-fit border-border/60 bg-transparent"
                      >
                        <ToolHeader
                          type={part.type as `tool-${string}`}
                          state={failed ? "output-error" : (part.state as "output-available")}
                          title={failed ? "Não consegui consultar" : (ui?.done ?? "Consulta feita")}
                        />
                      </Tool>
                    );
                  }
                  return null;
                })}
              </MessageContent>
            </Message>
          ))}

          {status === "submitted" ? (
            <div className="flex items-center gap-2">
              <AgentMark className="size-6" />
              <Shimmer>Pensando…</Shimmer>
            </div>
          ) : null}

          {followUps.length ? (
            <Suggestions>
              {followUps.map((s) => (
                <Suggestion key={s} suggestion={s} onClick={send} className="min-h-11" />
              ))}
            </Suggestions>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <PromptInput onSubmit={({ text: t }) => send(t)} className="mt-2">
        <PromptInputTextarea
          ref={textareaRef}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Pergunte ou conte algo ao Life OS…"
          aria-label="Mensagem para o Life OS"
          className="text-base md:text-sm"
        />
        <PromptInputFooter className="justify-end">
          <PromptInputSubmit status={status} onStop={stop} disabled={!busy && !text.trim()} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
