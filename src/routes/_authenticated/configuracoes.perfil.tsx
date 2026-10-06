import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Monitor, Moon, Sun } from "lucide-react";
import { PageHeader, Panel, PanelTitle } from "@/components/common/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/features/app/app-context";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { AvatarMenu } from "@/components/profile/avatar-menu";
import {
  DEFAULT_PREFERENCES,
  usePreferences,
  useSavePreferences,
} from "@/features/preferences/queries";

export const Route = createFileRoute("/_authenticated/configuracoes/perfil")({
  head: () => ({
    meta: [
      { title: "Meu perfil — Life OS" },
      { name: "description", content: "Nome, foto, tema e preferências pessoais." },
      { property: "og:title", content: "Meu perfil — Life OS" },
      { property: "og:description", content: "Suas preferências pessoais no Life OS." },
    ],
  }),
  component: Perfil,
});

const THEMES: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "light", label: "Claro", icon: Sun },
  { value: "system", label: "Sistema", icon: Monitor },
];

function Perfil() {
  const { profile, userId, refetchWorkspace } = useApp();
  const { mode, setMode } = useTheme();
  const prefs = usePreferences().data ?? DEFAULT_PREFERENCES;
  const savePrefs = useSavePreferences();
  const [name, setName] = useState(profile?.name ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => setName(profile?.name ?? ""), [profile?.name]);

  async function saveProfile() {
    if (!userId || !name.trim()) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ name: name.trim() })
      .eq("id", userId);
    setBusy(false);
    if (error) return void toast.error(error.message);
    refetchWorkspace();
    toast.success("Perfil atualizado.");
  }

  function setPref(patch: Parameters<typeof savePrefs.mutate>[0]) {
    savePrefs.mutate(patch, {
      onSuccess: () => toast.success("Preferência salva."),
      onError: (error) => toast.error(error.message),
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Meu perfil" subtitle="Só você vê e altera estas informações." />
      <Panel className="space-y-4">
        <PanelTitle>Identidade</PanelTitle>
        <div className="flex items-center gap-3">
          <AvatarMenu />
          <p className="text-xs text-muted-foreground">Toque na foto para trocar ou remover.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Nome</Label>
          <Input id="name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>E-mail</Label>
          <p className="text-sm text-muted-foreground">{profile?.email}</p>
          <p className="text-xs text-muted-foreground">
            O e-mail é gerenciado pelo login e não pode ser alterado aqui.
          </p>
        </div>
        <Button size="sm" disabled={busy || !name.trim()} onClick={saveProfile}>
          {busy ? "Salvando..." : "Salvar"}
        </Button>
      </Panel>

      <Panel className="space-y-4">
        <PanelTitle>Aparência</PanelTitle>
        <div className="flex flex-wrap gap-2">
          {THEMES.map((theme) => (
            <Button
              key={theme.value}
              size="sm"
              variant={mode === theme.value ? "default" : "outline"}
              onClick={() => setMode(theme.value)}
            >
              <theme.icon className="size-4" /> {theme.label}
            </Button>
          ))}
        </div>
      </Panel>

      <Panel className="space-y-4">
        <PanelTitle>Formatos</PanelTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Moeda</Label>
            <Select value={prefs.currency} onValueChange={(currency) => setPref({ currency })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BRL">Real (R$)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Formato de data</Label>
            <Select
              value={prefs.date_format}
              onValueChange={(date_format) => setPref({ date_format })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dd/MM/yyyy">31/12/2026</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Hoje o Life OS usa real e datas no padrão brasileiro. Outras opções chegam em uma próxima
          etapa.
        </p>
      </Panel>
    </div>
  );
}
