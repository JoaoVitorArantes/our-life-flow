import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Monitor, Moon, Sun } from "lucide-react";
import { PageHeader, Panel, PanelTitle } from "@/components/common/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/features/app/app-context";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { clearDemoData, seedDemoData } from "@/features/demo/seed";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Life OS" },
      { name: "description", content: "Perfil, tema, workspace e dados de demonstração." },
      { property: "og:title", content: "Configurações — Life OS" },
      { property: "og:description", content: "Ajustes do seu Life OS." },
    ],
  }),
  component: Configuracoes,
});

const THEMES: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "light", label: "Claro", icon: Sun },
  { value: "system", label: "Sistema", icon: Monitor },
];

function Configuracoes() {
  const { profile, workspaceId, workspaceName, memberProfiles, userId, refetchWorkspace } = useApp();
  const { mode, setMode } = useTheme();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState(profile?.name ?? "");
  const [busy, setBusy] = useState(false);

  async function saveProfile() {
    if (!userId) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ name }).eq("id", userId);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    refetchWorkspace();
    toast.success("Perfil atualizado.");
  }

  async function loadDemo() {
    if (!workspaceId || !userId) return;
    setBusy(true);
    try {
      const result = await seedDemoData(workspaceId, userId);
      await queryClient.invalidateQueries();
      toast.success(result.skipped ? "Os dados de demonstração já existem." : "Dados de demonstração criados.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar.");
    } finally {
      setBusy(false);
    }
  }

  async function removeDemo() {
    if (!workspaceId) return;
    setBusy(true);
    try {
      await clearDemoData(workspaceId);
      await queryClient.invalidateQueries();
      toast.success("Dados de demonstração removidos.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível remover.");
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
    <div className="space-y-8">
      <PageHeader title="Configurações" subtitle="Perfil, aparência e workspace" />

      <Panel className="space-y-4">
        <PanelTitle>Perfil</PanelTitle>
        <div className="space-y-2">
          <Label htmlFor="name">Nome</Label>
          <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <p className="text-xs text-muted-foreground">{profile?.email}</p>
        <Button size="sm" disabled={busy} onClick={saveProfile}>
          Salvar
        </Button>
      </Panel>

      <Panel>
        <PanelTitle>Aparência</PanelTitle>
        <div className="flex flex-wrap gap-2">
          {THEMES.map((theme) => (
            <Button
              key={theme.value}
              size="sm"
              variant={mode === theme.value ? "default" : "outline"}
              onClick={() => setMode(theme.value)}
            >
              <theme.icon className="size-4" />
              {theme.label}
            </Button>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelTitle>Workspace</PanelTitle>
        <p className="text-sm font-medium">{workspaceName}</p>
        <ul className="mt-3 divide-y divide-border">
          {memberProfiles.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span>{member.name || member.email}</span>
              {member.id === userId ? <Badge variant="outline">Você</Badge> : null}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          A estrutura já suporta mais de duas pessoas — os convites entram em uma próxima etapa.
        </p>
      </Panel>

      <Panel className="space-y-3">
        <PanelTitle>Dados de demonstração</PanelTitle>
        <p className="text-sm text-muted-foreground">
          Todo registro de demonstração fica marcado e pode ser removido sem afetar seus dados reais.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={loadDemo}>
            Criar dados de exemplo
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={removeDemo}>
            Remover
          </Button>
        </div>
      </Panel>

      <Panel>
        <PanelTitle>Conta</PanelTitle>
        <Button size="sm" variant="outline" onClick={signOut}>
          Sair
        </Button>
      </Panel>
    </div>
  );
}
