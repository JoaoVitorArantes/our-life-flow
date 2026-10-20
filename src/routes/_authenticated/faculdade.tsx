import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useApp } from "@/features/app/app-context";

export const Route = createFileRoute("/_authenticated/faculdade")({
  head: () => ({
    meta: [
      { title: "Faculdade — Life OS" },
      {
        name: "description",
        content: "Disciplinas, avaliações, frequência e progresso acadêmico.",
      },
      { property: "og:title", content: "Faculdade — Life OS" },
      { property: "og:description", content: "Sua rotina acadêmica no Life OS." },
    ],
  }),
  component: FaculdadeRedirect,
});

/**
 * /faculdade redireciona para a visão da pessoa autenticada (/faculdade/<seu id>).
 * A autorização real acontece na rota filha (conferência da sessão) e no RLS.
 */
function FaculdadeRedirect() {
  const { userId, loading } = useApp();
  if (!userId) return loading ? null : null;
  return <Navigate to="/faculdade/$ownerId" params={{ ownerId: userId }} replace />;
}
