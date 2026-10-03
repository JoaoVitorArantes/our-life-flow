import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { AgentMark, EXAMPLES } from "./agent-chat";
import { useStartConversation } from "./thread-list";

/** Entrada rápida do "+": abre uma conversa nova já com a mensagem. */
export function AgentLauncher({ onStarted }: { onStarted: () => void }) {
  const { start, pending } = useStartConversation();
  const [text, setText] = useState("");
  const go = async (t: string) => {
    if (!t.trim()) return;
    await start(t.trim());
    onStarted();
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <AgentMark className="size-10" />
        <div>
          <p className="font-semibold">Falar com o Life OS</p>
          <p className="text-xs text-muted-foreground">Pergunte ou conte o que aconteceu.</p>
        </div>
        <Link to="/inbox" onClick={onStarted} className="ml-auto text-xs text-primary">Conversas</Link>
      </div>
      <PromptInput onSubmit={({ text: t }) => void go(t)}>
        <PromptInputTextarea autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Ex.: Quanto posso gastar?" className="text-base md:text-sm" aria-label="Mensagem para o Life OS" />
        <PromptInputFooter className="justify-end">
          <PromptInputSubmit status={pending ? "submitted" : "ready"} disabled={pending || !text.trim()} />
        </PromptInputFooter>
      </PromptInput>
      <Suggestions>
        {EXAMPLES.map((e) => (
          <Suggestion key={e} suggestion={e} onClick={(s) => void go(s)} className="min-h-11" />
        ))}
      </Suggestions>
    </div>
  );
}
