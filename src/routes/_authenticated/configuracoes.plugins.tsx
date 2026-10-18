import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  CalendarDays,
  Check,
  Compass,
  FileText,
  Flag,
  ListChecks,
  Mail,
  Plug,
  RefreshCw,
  Repeat,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Table2,
  Wallet,
  Home,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getPluginCatalog,
  setPluginEnabled,
  getCapabilityHistory,
} from "@/features/plugins/plugins.functions";
import { INTENT_LABELS, CAPABILITIES } from "@/features/plugins/capabilities";
import { useApp } from "@/features/app/app-context";
import { CalendarConnectionControls } from "@/features/google-calendar/connection-controls";

const catalogOptions = () => ({ queryKey: ["ai_plugins"], queryFn: () => getPluginCatalog() });
export const Route = createFileRoute("/_authenticated/configuracoes/plugins")({
  head: () => ({
    meta: [
      { title: "Plugins por IA — Life OS" },
      { name: "description", content: "Suas ferramentas e conexões autorizadas para o Life AI." },
      { property: "og:title", content: "Plugins por IA — Life OS" },
      { property: "og:description", content: "Controle as capacidades do Life AI no seu espaço." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogOptions()),
  component: PluginsPage,
  errorComponent: ({ reset }) => (
    <div className="space-y-4">
      <PageHeader title="Plugins por IA" />
      <p role="alert" className="text-sm text-destructive">
        Erro ao carregar os plugins. Confira sua conexão e tente novamente.
      </p>
      <Button variant="outline" onClick={reset}>
        <RefreshCw className="size-4" /> Tentar novamente
      </Button>
    </div>
  ),
});
const ICONS = {
  finance: Wallet,
  agenda: CalendarDays,
  tasks: ListChecks,
  goals: Flag,
  contexts: Compass,
  purchases: ShoppingBag,
  routines: Repeat,
  activities: Activity,
  notes: FileText,
  workspace: Home,
  google_calendar: CalendarDays,
  google_mail: Mail,
  google_sheets: Table2,
};
const LABELS: Record<string, string> = {
  enabled: "Ativado",
  disabled: "Desativado",
  connected: "Conectado",
  not_connected: "Não conectado",
  permission_required: "Permissão necessária",
  coming_soon: "Em breve",
  error: "Erro",
};

function PluginsPage() {
  const { workspaceName } = useApp();
  const { data } = useSuspenseQuery(catalogOptions());
  const [showHistory, setShowHistory] = useState(false);
  const history = useQuery({
    queryKey: ["ai_capability_history", data.workspaceId],
    queryFn: () => getCapabilityHistory(),
    enabled: showHistory,
  });
  const queryClient = useQueryClient();
  const update = useServerFn(setPluginEnabled);
  const [category, setCategory] = useState("internal");
  const [search, setSearch] = useState("");
  const mutation = useMutation({
    mutationFn: (v: { pluginId: string; enabled: boolean }) => update({ data: v }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ai_plugins"] });
      toast.success("Preferência do Life AI atualizada.");
    },
    onError: () => toast.error("Não foi possível atualizar o plugin. Tente novamente."),
  });
  const plugins = data.plugins.filter(
    (p) =>
      p.category === category &&
      `${p.name} ${p.description}`
        .toLocaleLowerCase("pt-BR")
        .includes(search.toLocaleLowerCase("pt-BR")),
  );
  return (
    <div className="space-y-6">
      <PageHeader title="Plugins por IA" subtitle={`Seu Life AI · ${workspaceName}`} />
      <div className="flex items-center gap-3 border-y border-border py-4 text-sm text-muted-foreground">
        <ShieldCheck className="size-5 shrink-0 text-primary" />
        <p>
          Suas preferências neste espaço. O acesso da outra pessoa não muda. Registros continuam
          exigindo confirmação.
        </p>
      </div>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Tabs value={category} onValueChange={setCategory}>
          <TabsList>
            <TabsTrigger value="internal">
              <Sparkles className="mr-1.5 size-4" /> Life OS
            </TabsTrigger>
            <TabsTrigger value="external">
              <Plug className="mr-1.5 size-4" /> Conexões externas
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative xl:w-60">
          <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input
            aria-label="Buscar plugins"
            placeholder="Buscar plugins"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-base md:text-sm"
          />
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {plugins.map((p) => {
          const Icon = ICONS[p.id as keyof typeof ICONS] ?? Plug;
          const failed = mutation.isError && mutation.variables?.pluginId === p.id;
          return (
            <article
              key={p.id}
              className="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-surface p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <h2 className="text-base font-semibold">{p.name}</h2>
                </div>
                {p.category === "internal" ? (
                  <Switch
                    aria-label={`Ativar ${p.name}`}
                    checked={p.requestedEnabled}
                    disabled={
                      mutation.isPending ||
                      (p.state === "permission_required" && p.dependencies.length === 0)
                    }
                    onCheckedChange={(enabled) => mutation.mutate({ pluginId: p.id, enabled })}
                  />
                ) : (
                  <Plug className="size-4 shrink-0 text-muted-foreground" />
                )}
              </div>
              <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                {p.description}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {p.id !== "google_calendar" && (
                  <Badge
                    variant="outline"
                    className={
                      failed
                        ? "text-destructive"
                        : p.enabled
                          ? "text-success"
                          : "text-muted-foreground"
                    }
                  >
                    {p.enabled && <Check className="mr-1 size-3" />}
                    {LABELS[failed ? "error" : p.state]}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {p.intents.length && !p.tools.length
                    ? "Proposta"
                    : p.access === "read_write"
                      ? "Consulta e proposta"
                      : p.intents.length
                        ? "Proposta"
                        : "Consulta"}
                </span>
              </div>
              {p.dependencies.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Consulta integrada:{" "}
                  {p.dependencies
                    .map((id) => data.plugins.find((other) => other.id === id)?.name ?? id)
                    .join(", ")}
                  {p.dependencies.some(
                    (id) => !data.plugins.find((other) => other.id === id)?.enabled,
                  )
                    ? " · ative também essa capacidade"
                    : ""}
                </p>
              )}
              {p.id === "google_calendar" && (
                <CalendarConnectionControls workspaceId={data.workspaceId} />
              )}
              {p.category === "external" && p.id !== "google_calendar" && (
                <span className="text-xs text-muted-foreground">
                  Configuração do provedor pendente · Não executável
                </span>
              )}
              <details className="border-t border-border pt-3 text-sm">
                <summary className="cursor-pointer text-primary">Capacidades e permissões</summary>
                <ul className="mt-3 space-y-2 text-muted-foreground">
                  {p.capabilities.map((c) => (
                    <li key={c.id}>
                      <span className="font-medium text-foreground">{c.name}</span> ·{" "}
                      {c.description}
                    </li>
                  ))}
                  {p.intents.map((intent) => (
                    <li key={intent}>{INTENT_LABELS[intent]} · confirmação obrigatória</li>
                  ))}
                  {p.category === "external" ? (
                    <li>
                      {p.id === "google_calendar"
                        ? "Conta pessoal · somente leitura · ferramentas do Life AI ainda indisponíveis"
                        : "Autorização não concedida · conexão indisponível"}
                    </li>
                  ) : (
                    <li>
                      {p.scopes.includes("workspace:manage")
                        ? "Administração do espaço"
                        : "Dados acessíveis no espaço"}
                    </li>
                  )}
                </ul>
              </details>
            </article>
          );
        })}
      </div>
      {plugins.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhum plugin encontrado.</p>
      )}
      <section className="border-t border-border pt-5">
        <Button
          variant="outline"
          onClick={() => setShowHistory((v) => !v)}
          aria-expanded={showHistory}
        >
          Suas execuções recentes
        </Button>
        {showHistory && (
          <div className="mt-4" aria-live="polite">
            {history.isPending ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : history.isError ? (
              <div className="flex items-center gap-3">
                <p role="alert" className="text-sm text-destructive">
                  Não foi possível carregar as execuções.
                </p>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Recarregar execuções"
                  onClick={() => void history.refetch()}
                >
                  <RefreshCw className="size-4" />
                </Button>
              </div>
            ) : !history.data?.runs.length ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma execução registrada neste espaço.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {history.data.runs.map((run) => (
                  <li
                    key={run.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p>
                        {CAPABILITIES.find((c) => c.id === run.tool)?.name ??
                          INTENT_LABELS[run.tool as keyof typeof INTENT_LABELS] ??
                          "Capacidade interna"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(run.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        run.outcome === "failure" ? "text-destructive" : "text-muted-foreground"
                      }
                    >
                      {run.outcome === "failure"
                        ? "Falhou"
                        : run.confirmation === "accepted"
                          ? "Confirmação autorizada"
                          : run.confirmation === "proposed"
                            ? "Prévia preparada"
                            : "Consulta concluída"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
