import { createFileRoute } from "@tanstack/react-router";
import { InboxAssistant, InboxHistoryList } from "@/components/inbox/inbox-assistant";

export const Route = createFileRoute("/_authenticated/inbox")({
  head: () => ({
    meta: [
      { title: "Inbox · Falar com o Life OS" },
      { name: "description", content: "Registre gastos, receitas, tarefas, eventos e mais escrevendo naturalmente." },
      { property: "og:title", content: "Inbox · Falar com o Life OS" },
      { property: "og:description", content: "Registre tudo no Life OS em linguagem natural, com prévia e confirmação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InboxPage,
});

function InboxPage() {
  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.3fr_1fr]">
      <section className="flex h-[calc(100dvh-12rem)] min-h-[420px] flex-col rounded-2xl border border-border bg-card p-4">
        <InboxAssistant compact />
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Histórico da Inbox</h2>
        <InboxHistoryList />
      </section>
    </div>
  );
}
