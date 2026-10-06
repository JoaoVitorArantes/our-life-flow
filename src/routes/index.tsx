import { useEffect } from "react";
import { resolveHomeRoute } from "@/features/preferences/queries";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Life OS — sua vida em um só lugar" },
      {
        name: "description",
        content:
          "Finanças pessoais e do casal, agenda, tarefas, metas e notas em um sistema calmo e minimalista.",
      },
      { property: "og:title", content: "Life OS — sua vida em um só lugar" },
      {
        property: "og:description",
        content: "Um sistema pessoal para organizar dinheiro, tempo e objetivos.",
      },
    ],
  }),
  component: Landing,
});

const PILLARS = [
  { title: "Financeiro", text: "Contas, cartões, despesas compartilhadas e acertos." },
  { title: "Rotina", text: "Agenda, tarefas e faculdade em uma visão só." },
  { title: "Nós", text: "O que é privado continua privado. O resto é do casal." },
];

function Landing() {
  const { user, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) void resolveHomeRoute().then((to) => navigate({ to, replace: true }));
  }, [loading, user, navigate]);

  return (
    <div className="min-h-dvh bg-background px-6 py-20">
      <div className="mx-auto max-w-3xl space-y-16">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" /> Life OS
          </span>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Sua vida inteira,
            <br />
            em um só lugar calmo.
          </h1>
          <p className="max-w-xl text-base text-muted-foreground">
            Finanças pessoais e compartilhadas, agenda, tarefas, metas e notas — organizados com
            privacidade real e sem ruído.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">
                Entrar <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {PILLARS.map((pillar) => (
            <div key={pillar.title} className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="text-sm font-medium">{pillar.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{pillar.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
