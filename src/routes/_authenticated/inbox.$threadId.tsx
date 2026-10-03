import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { ChevronLeft } from "lucide-react";
import { AgentChat, AgentMark } from "@/components/agent/agent-chat";
import { ThreadList } from "@/components/agent/thread-list";
import { useConversation } from "@/features/agent/conversations";

export const Route = createFileRoute("/_authenticated/inbox/$threadId")({
  validateSearch: z.object({ q: z.string().max(2000).optional() }),
  head: () => ({
    meta: [
      { title: "Conversa — Life OS AI" },
      { name: "description", content: "Conversa com o Life OS AI sobre seus dados reais." },
      { property: "og:title", content: "Conversa — Life OS AI" },
      { property: "og:description", content: "Conversa com o assistente do Life OS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  const { q } = Route.useSearch();
  const { data, isLoading } = useConversation(threadId);

  return (
    <div className="mx-auto grid h-[calc(100dvh-10rem)] max-w-6xl gap-6 md:grid-cols-[240px_1fr]">
      <aside className="hidden min-h-0 md:flex md:flex-col">
        <ThreadList activeId={threadId} />
      </aside>
      <section className="flex min-h-0 flex-col">
        <div className="mb-2 flex items-center gap-2 md:hidden">
          <Link to="/inbox" className="grid size-11 place-items-center rounded-lg hover:bg-muted" aria-label="Voltar às conversas">
            <ChevronLeft className="size-5" />
          </Link>
          <AgentMark className="size-6" />
          <span className="truncate text-sm font-medium">{data?.conversation?.title ?? "Life OS AI"}</span>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Abrindo conversa…</p>
        ) : !data?.conversation ? (
          <p className="text-sm text-muted-foreground">Conversa não encontrada. <Link to="/inbox" className="text-primary">Voltar</Link></p>
        ) : (
          <AgentChat key={threadId} threadId={threadId} initialMessages={data.messages} initialActionStates={data.actionStates} autoSend={q} />
        )}
      </section>
    </div>
  );
}
