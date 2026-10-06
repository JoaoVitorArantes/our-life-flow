import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader, Panel } from "@/components/common/page";
import { LoadingState } from "@/components/common/states";
import { MemberAvatar } from "@/components/profile/member-avatar";
import { useApp } from "@/features/app/app-context";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/configuracoes/atividade")({
  head: () => ({
    meta: [
      { title: "Atividade — Life OS" },
      { name: "description", content: "As ações importantes feitas no espaço." },
      { property: "og:title", content: "Atividade — Life OS" },
      { property: "og:description", content: "Histórico do seu espaço no Life OS." },
    ],
  }),
  component: Atividade,
});

const ENTITY: Record<string, string> = {
  workspace: "o espaço",
  category: "a categoria",
  member: "o membro",
  tasks: "a tarefa",
  notes: "a nota",
  goals: "a meta",
  contexts: "o contexto",
  events: "o evento",
  purchases: "a compra",
};

const ACTION: Record<string, string> = {
  renamed: "renomeou",
  updated: "editou",
  created: "criou",
  deleted: "excluiu",
  archived: "arquivou",
  unarchived: "reativou",
  trashed: "moveu para a lixeira",
  restored: "restaurou",
  purged: "excluiu definitivamente",
  member_added: "adicionou",
  member_removed: "removeu",
  role_changed: "mudou o papel de",
};

function describe(action: string, type: string, label: string | null) {
  if (action === "renamed") return `renomeou o espaço para “${label}”`;
  if (action === "updated" && type === "workspace") return "atualizou a identidade do espaço";
  const verb = ACTION[action] ?? action;
  const what = ENTITY[type] ?? type;
  return `${verb} ${what}${label ? ` “${label}”` : ""}`;
}

function Atividade() {
  const { workspaceId, memberProfiles } = useApp();
  const { data = [], isLoading } = useQuery({
    queryKey: ["workspace_activity", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_activity")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Atividade" subtitle="As ações importantes do espaço, sem detalhes sensíveis." />
      <Panel>
        {isLoading ? <LoadingState /> : data.length ? (
          <ol className="space-y-4">
            {data.map((entry) => {
              const person = memberProfiles.find((p) => p.id === entry.actor_id);
              const when = new Date(entry.created_at);
              return (
                <li key={entry.id} className="flex gap-3">
                  <MemberAvatar name={person?.name} email={person?.email} src={person?.avatar_url} className="size-8 shrink-0" fallbackClassName="text-[10px]" />
                  <div className="min-w-0 text-sm">
                    <p>
                      <span className="font-medium">{person?.name?.split(" ")[0] ?? "Alguém"}</span>{" "}
                      <span className="text-muted-foreground">{describe(entry.action, entry.entity_type, entry.entity_label)}</span>
                    </p>
                    <time dateTime={entry.created_at} title={format(when, "dd/MM/yyyy HH:mm")} className="text-xs text-muted-foreground">
                      {formatDistanceToNow(when, { addSuffix: true, locale: ptBR })} · {format(when, "dd/MM/yyyy HH:mm")}
                    </time>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">Nada registrado ainda. Renomear o espaço, mexer em categorias ou usar a lixeira aparece aqui.</p>
        )}
      </Panel>
    </div>
  );
}
