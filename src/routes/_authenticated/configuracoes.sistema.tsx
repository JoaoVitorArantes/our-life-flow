import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader, Panel, PanelTitle } from "@/components/common/page";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/features/app/app-context";
import { clearDemoData, seedDemoData } from "@/features/demo/seed";

export const Route = createFileRoute("/_authenticated/configuracoes/sistema")({
  head: () => ({
    meta: [
      { title: "Sistema — Life OS" },
      { name: "description", content: "Demonstração e sessão." },
      { property: "og:title", content: "Sistema — Life OS" },
      { property: "og:description", content: "Ajustes do sistema do Life OS." },
    ],
  }),
  component: Sistema,
});

function Sistema() {
  const { workspace, workspaceId } = useApp();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function runDemo(action: "seed" | "clear") {
    if (!workspaceId || !workspace?.is_demo) return;
    setBusy(true);
    try {
      if (action === "seed") await seedDemoData(workspaceId);
      else await clearDemoData(workspaceId);
      await queryClient.invalidateQueries();
      toast.success(action === "seed" ? "Dados fictícios recriados." : "Dados fictícios removidos.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Sistema" subtitle="Sessão e ambiente." />
      {workspace?.is_demo ? (
        <Panel className="space-y-3 border-warning/40">
          <PanelTitle>Dados de demonstração</PanelTitle>
          <p className="text-sm text-muted-foreground">
            Este é um workspace de demonstração. "Preparar" apaga os registros fictícios e recria o conjunto completo; "Remover" apaga somente os registros fictícios.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void runDemo("seed")}>Preparar / resetar demonstração</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void runDemo("clear")}>Remover dados fictícios</Button>
          </div>
        </Panel>
      ) : null}
      <Panel>
        <PanelTitle>Conta</PanelTitle>
        <Button size="sm" variant="outline" onClick={() => void signOut()}>Sair</Button>
      </Panel>
    </div>
  );
}
