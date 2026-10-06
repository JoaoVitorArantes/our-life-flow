import { useEffect, useState, type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";
import { Header } from "./header";
import { CommandBar } from "@/components/command/command-bar";
import { QuickActionHost } from "@/components/quick/quick-action-host";
import { useApp } from "@/features/app/app-context";
import { useCards } from "@/features/finance/queries";
import { InvitationInbox } from "@/features/workspace/partner";
import { GlobalAgent } from "@/components/agent/global-agent";
import { useRealtimeSync } from "@/features/sync/use-realtime-sync";

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const { workspaceName, workspaceId, workspace } = useApp();
  const syncStatus = useRealtimeSync(workspaceId);
  // Mantém os ciclos de fatura carregados para o cálculo de vencimento em todas as telas.
  useCards(workspaceId);
  // Cor de destaque do espaço: só troca o tom de destaque (estados ativos, seleção, progresso).
  const accent = workspace?.accent_color;
  useEffect(() => {
    const root = document.documentElement;
    if (!accent) return;
    root.style.setProperty("--primary", accent);
    root.style.setProperty("--ring", accent);
    return () => {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--ring");
    };
  }, [accent]);

  return (
    <div className="flex min-h-dvh bg-background">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((value) => !value)}
        workspaceName={workspaceName}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {workspace?.is_demo ? (
          <div
            role="status"
            className="sticky top-0 z-30 bg-warning px-4 py-1.5 text-center text-xs font-medium text-warning-foreground"
          >
            Ambiente de demonstração — todos os dados são fictícios ·{" "}
            {syncStatus === "connected"
              ? "Sincronização ao vivo ativa"
              : syncStatus === "connecting"
                ? "Conectando sincronização…"
                : "Sincronização pausada (requer internet)"}
          </div>
        ) : null}
        <Header />
        {syncStatus === "reconnecting" || syncStatus === "unavailable" ? (
          <div
            role="status"
            className="border-b border-border bg-muted px-4 py-1 text-center text-xs text-muted-foreground"
          >
            {syncStatus === "reconnecting"
              ? "Reconectando a sincronização… os dados serão atualizados ao voltar."
              : "Sincronização em tempo real indisponível — os dados atualizam ao reabrir o app."}
          </div>
        ) : null}
        <main className="flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8">
          <div className="mx-auto w-full max-w-5xl space-y-8">{children}</div>
        </main>
      </div>
      <BottomNav />
      <CommandBar />
      <QuickActionHost />
      <GlobalAgent />
      <InvitationInbox />
    </div>
  );
}
