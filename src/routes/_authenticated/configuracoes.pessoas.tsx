import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, PanelTitle } from "@/components/common/page";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useApp } from "@/features/app/app-context";
import { MemberAvatar } from "@/components/profile/member-avatar";
import { PartnerSettings } from "@/features/workspace/partner";

export const Route = createFileRoute("/_authenticated/configuracoes/pessoas")({
  head: () => ({
    meta: [
      { title: "Pessoas — Life OS" },
      { name: "description", content: "Membros e papéis do espaço." },
      { property: "og:title", content: "Pessoas — Life OS" },
      { property: "og:description", content: "Quem participa do seu espaço no Life OS." },
    ],
  }),
  component: Pessoas,
});

const ROLE_LABEL: Record<string, string> = { OWNER: "Proprietário", MEMBER: "Membro" };
const ROLE_HINT: Record<string, string> = {
  OWNER: "Tudo de um membro, mais convidar e remover pessoas.",
  MEMBER: "Cria, edita e personaliza os dados compartilhados.",
};

function Pessoas() {
  const { members, memberProfiles, userId, availableWorkspaces, workspaceId, switchWorkspace } =
    useApp();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pessoas"
        subtitle="Quem participa deste espaço e o que cada papel permite."
      />
      <Panel>
        <PanelTitle>Membros</PanelTitle>
        <ul className="divide-y divide-border">
          {members.map((member) => {
            const person = memberProfiles.find((p) => p.id === member.user_id);
            return (
              <li key={member.id} className="flex items-center justify-between gap-3 py-3">
                <span className="flex min-w-0 items-center gap-3">
                  <MemberAvatar
                    name={person?.name}
                    email={person?.email}
                    src={person?.avatar_url}
                    className="size-9 shrink-0"
                    fallbackClassName="text-[11px]"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {person?.name || person?.email || "Pessoa"}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {ROLE_LABEL[member.role] ?? member.role} · Ativo
                    </span>
                  </span>
                </span>
                {member.user_id === userId ? <Badge variant="outline">Você</Badge> : null}
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel>
        <PanelTitle>Papéis</PanelTitle>
        <dl className="space-y-3 text-sm">
          {Object.entries(ROLE_LABEL).map(([role, label]) => (
            <div key={role}>
              <dt className="font-medium">{label}</dt>
              <dd className="text-muted-foreground">{ROLE_HINT[role]}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel>
        <PanelTitle>Convite</PanelTitle>
        <PartnerSettings />
      </Panel>

      {availableWorkspaces.length > 1 ? (
        <Panel className="space-y-2">
          <PanelTitle>Espaço ativo</PanelTitle>
          <Label className="sr-only">Espaço ativo</Label>
          <Select value={workspaceId ?? ""} onValueChange={(value) => void switchWorkspace(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableWorkspaces.map((ws) => (
                <SelectItem key={ws.id} value={ws.id}>
                  {ws.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Panel>
      ) : null}
    </div>
  );
}
