import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { AgentMark, EXAMPLES } from "@/components/agent/agent-chat";
import { ThreadList, useStartConversation } from "@/components/agent/thread-list";

export const Route = createFileRoute("/_authenticated/inbox/")({
  head: () => ({
    meta: [
      { title: "Life OS AI — seu assistente pessoal" },
      { name: "description", content: "Converse com o Life OS: consulte finanças, agenda, tarefas e metas reais e registre tudo em linguagem natural." },
      { property: "og:title", content: "Life OS AI — seu assistente pessoal" },
      { property: "og:description", content: "Pergunte, analise e registre sua vida em linguagem natural." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InboxHome,
});

function InboxHome() {
  const { start, pending } = useStartConversation();
  const [text, setText] = useState("");
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:gap-10">
      <section className="min-w-0 space-y-5">
        <div className="flex min-w-0 items-center gap-3">
          <AgentMark className="size-12 shrink-0 sm:size-14" />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">Life OS AI</h1>
            <p className="text-sm text-muted-foreground">O cérebro do seu Life OS: consulta seus dados reais, analisa e registra — sempre com sua confirmação.</p>
          </div>
        </div>
        <PromptInput onSubmit={({ text: t }) => { if (t.trim()) void start(t.trim()); }}>
          <PromptInputTextarea autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Pergunte ou conte algo…" className="text-base md:text-sm" aria-label="Mensagem para o Life OS" />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={pending ? "submitted" : "ready"} disabled={pending || !text.trim()} />
          </PromptInputFooter>
        </PromptInput>
        <Suggestions>
          {EXAMPLES.map((e) => (
            <Suggestion key={e} suggestion={e} onClick={(s) => void start(s)} className="min-h-11" />
          ))}
        </Suggestions>
      </section>
      <aside className="min-w-0 lg:max-h-[75dvh]">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Conversas</p>
        <ThreadList />
      </aside>
    </div>
  );
}
