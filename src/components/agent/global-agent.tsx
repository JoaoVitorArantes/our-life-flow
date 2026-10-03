import { useEffect, useMemo, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronLeft, ExternalLink, History, Plus, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AgentChat, AgentMark, EXAMPLES } from "./agent-chat";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { useApp } from "@/features/app/app-context";
import { createConversation, deleteConversation, useConversation, useConversations } from "@/features/agent/conversations";
import { cn } from "@/lib/utils";

const ROUTE_LABELS: Record<string, string> = {
  "/meu-dia": "Meu Dia",
  "/dashboard": "Dashboard",
  "/agenda": "Agenda",
  "/tarefas": "Tarefas",
  "/rotinas": "Rotinas & Hábitos",
  "/contextos": "Contextos",
  "/financeiro": "Financeiro",
  "/compras": "Compras",
  "/faculdade": "Faculdade",
  "/esporte": "Esporte & Atividades",
  "/metas": "Metas",
  "/notas": "Notas",
  "/configuracoes": "Configurações",
  "/nos": "Nós",
  "/inbox": "Life OS AI",
};

function pageContext(pathname: string) {
  const root = `/${pathname.split("/").filter(Boolean)[0] ?? "dashboard"}`;
  const module = ROUTE_LABELS[root] ?? "Life OS";
  const id = pathname.split("/").filter(Boolean)[1];
  return id ? `${module}; item aberto: ${id}; rota: ${pathname}` : `${module}; rota: ${pathname}`;
}

function GlobalAgentHome({ onOpenThread }: { onOpenThread: (id: string, firstMessage?: string) => void }) {
  const { workspaceId, memberProfiles } = useApp();
  const { data = [], isLoading } = useConversations(workspaceId);
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const firstName = (id: string) => memberProfiles.find((profile) => profile.id === id)?.name.split(" ")[0];

  async function start(message?: string) {
    if (!workspaceId || pending) return;
    setPending(true);
    try {
      const id = await createConversation(workspaceId);
      await queryClient.invalidateQueries({ queryKey: ["ai_conversations"] });
      onOpenThread(id, message?.trim() || undefined);
      setText("");
    } catch {
      toast.error("Não consegui abrir uma conversa agora.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="shrink-0 space-y-3">
        <div className="flex items-center gap-3">
          <AgentMark className="size-10" />
          <div className="min-w-0">
            <p className="font-semibold">Como posso ajudar?</p>
            <p className="truncate text-xs text-muted-foreground">Pergunte sobre qualquer área do seu Life OS.</p>
          </div>
        </div>
        <PromptInput onSubmit={({ text: value }) => void start(value)}>
          <PromptInputTextarea autoFocus value={text} onChange={(event) => setText(event.target.value)} placeholder="Pergunte qualquer coisa…" aria-label="Mensagem para o Life OS AI" className="text-base md:text-sm" />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={pending ? "submitted" : "ready"} disabled={pending || !text.trim()} />
          </PromptInputFooter>
        </PromptInput>
        <Suggestions>
          {EXAMPLES.slice(0, 3).map((example) => <Suggestion key={example} suggestion={example} onClick={(value) => void start(value)} className="min-h-10" />)}
        </Suggestions>
      </div>

      <div className="flex min-h-0 flex-1 flex-col border-t border-border pt-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground"><History className="size-3.5" /> Conversas recentes</p>
          <Button size="sm" variant="ghost" onClick={() => void start()} disabled={pending}><Plus /> Nova</Button>
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain">
          {isLoading ? <p className="px-2 py-3 text-sm text-muted-foreground">Carregando…</p> : null}
          {!isLoading && data.length === 0 ? <p className="px-2 py-3 text-sm text-muted-foreground">Nenhuma conversa ainda.</p> : null}
          {data.slice(0, 20).map((conversation) => (
            <div key={conversation.id} className="group flex items-center rounded-lg hover:bg-muted">
              <Button variant="ghost" className="h-auto min-h-11 min-w-0 flex-1 justify-start px-3 py-2 text-left" onClick={() => onOpenThread(conversation.id)}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{conversation.title}</span>
                  <span className="block text-[11px] font-normal text-muted-foreground">{firstName(conversation.created_by) ?? ""} · {new Date(conversation.updated_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
                </span>
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Excluir conversa"
                className="mr-1 text-muted-foreground opacity-60 hover:text-destructive group-hover:opacity-100"
                onClick={async () => {
                  if (!confirm("Excluir esta conversa?")) return;
                  try {
                    await deleteConversation(conversation.id);
                    await queryClient.invalidateQueries({ queryKey: ["ai_conversations"] });
                  } catch {
                    toast.error("Não consegui excluir.");
                  }
                }}
              >
                <X />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GlobalAgentThread({ threadId, firstMessage, context, onBack }: { threadId: string; firstMessage?: string; context: string; onBack: () => void }) {
  const { data, isLoading } = useConversation(threadId);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex shrink-0 items-center gap-2">
        <Button size="icon" variant="ghost" onClick={onBack} aria-label="Voltar às conversas"><ChevronLeft /></Button>
        <AgentMark className="size-6" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{data?.conversation?.title ?? "Nova conversa"}</span>
        <Button asChild size="icon" variant="ghost">
          <Link to="/inbox/$threadId" params={{ threadId }} search={{}} aria-label="Abrir conversa completa"><ExternalLink /></Link>
        </Button>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Abrindo conversa…</p> : !data?.conversation ? <p className="text-sm text-muted-foreground">Conversa não encontrada.</p> : (
        <AgentChat key={threadId} threadId={threadId} initialMessages={data.messages} initialActionStates={data.actionStates} autoSend={firstMessage} pageContext={context} />
      )}
    </div>
  );
}

function GlobalAgentPanel({ context }: { context: string }) {
  const [thread, setThread] = useState<{ id: string; firstMessage?: string | undefined } | null>(null);
  return thread ? (
    <GlobalAgentThread threadId={thread.id} firstMessage={thread.firstMessage} context={context} onBack={() => setThread(null)} />
  ) : (
    <GlobalAgentHome onOpenThread={(id, firstMessage) => setThread({ id, firstMessage })} />
  );
}

export function GlobalAgent() {
  const isMobile = useIsMobile();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const context = useMemo(() => pageContext(pathname), [pathname]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const trigger = (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            aria-label="Falar com o Life OS AI"
            onClick={() => setOpen(true)}
            className={cn(
              "fixed z-40 border border-primary/30 bg-primary text-primary-foreground shadow-[0_8px_28px_var(--color-primary)/0.28] transition-[transform,box-shadow] duration-200 hover:scale-[1.03] hover:bg-primary hover:shadow-[0_10px_34px_var(--color-primary)/0.38] motion-reduce:transform-none motion-reduce:transition-none",
              "bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] right-4 size-11 rounded-full p-0 md:bottom-6 md:right-6 md:h-10 md:w-auto md:rounded-lg md:px-3",
            )}
          >
            <span aria-hidden className="text-lg leading-none">✦</span>
            <span className="hidden text-sm md:inline">Life AI</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left" className="hidden md:block">Falar com o Life OS AI</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  if (isMobile) {
    return (
      <>
        {trigger}
        <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
          <DrawerContent className="h-[92dvh] max-h-[92dvh]">
            <DrawerHeader className="shrink-0 border-b border-border px-4 pb-3 pt-2 text-left">
              <DrawerTitle className="flex items-center gap-2"><AgentMark className="size-7" /> Life OS AI</DrawerTitle>
              <DrawerDescription>Seu Life OS, sempre por perto.</DrawerDescription>
            </DrawerHeader>
            <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-3">{open ? <GlobalAgentPanel context={context} /> : null}</div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <>
      {trigger}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex h-dvh w-[min(460px,92vw)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
          <SheetHeader className="shrink-0 border-b border-border px-5 py-4 pr-14 text-left">
            <SheetTitle className="flex items-center gap-2"><AgentMark className="size-7" /> Life OS AI</SheetTitle>
            <SheetDescription>Seu Life OS, sempre por perto.</SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col px-5 pb-5 pt-4">{open ? <GlobalAgentPanel context={context} /> : null}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}