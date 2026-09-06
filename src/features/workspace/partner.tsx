import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HeartHandshake, Mail, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/features/app/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function useIncomingInvitations(enabled = true) {
  return useQuery({
    queryKey: ["workspace-invitations", "incoming"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_invitations")
        .select("id, token, email, workspace_id, expires_at, workspaces(name)")
        .eq("status", "PENDING")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function InvitationInbox() {
  const { userId, refetchWorkspace } = useApp();
  const queryClient = useQueryClient();
  const invitations = useIncomingInvitations(!!userId);
  const [busy, setBusy] = useState(false);
  const [storedToken, setStoredToken] = useState<string | null>(null);
  useEffect(() => {
    setStoredToken(window.sessionStorage.getItem("lifeos-invite"));
  }, []);
  const invitation = invitations.data?.find((item) => !storedToken || item.token === storedToken) ?? invitations.data?.[0];

  async function respond(accept: boolean) {
    if (!invitation) return;
    setBusy(true);
    const { error } = await supabase.rpc("respond_partner_invitation", {
      _token: invitation.token,
      _accept: accept,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries();
    window.sessionStorage.removeItem("lifeos-invite");
    refetchWorkspace();
    toast.success(accept ? "Convite aceito. Este é agora o seu espaço ativo." : "Convite recusado.");
  }

  const workspace = invitation?.workspaces as { name?: string } | null | undefined;
  return (
    <Dialog open={!!invitation}>
      <DialogContent className="max-w-md" hideClose>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><HeartHandshake className="size-5 text-primary" /> Convite para compartilhar</DialogTitle>
          <DialogDescription>
            Você foi convidado(a) para participar de {workspace?.name ?? "um Life OS"}. Seus dados pessoais continuam separados dos outros espaços.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => void respond(false)}>Recusar</Button>
          <Button disabled={busy} onClick={() => void respond(true)}>Aceitar convite</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PartnerSettings() {
  const { workspaceId, memberProfiles, members, userId, relationship, refetchWorkspace } = useApp();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [busy, setBusy] = useState(false);
  const invitations = useQuery({
    queryKey: ["workspace-invitations", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase.from("workspace_invitations").select("*").eq("workspace_id", workspaceId ?? "").eq("status", "PENDING").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (relationship?.started_at) setStartedAt(relationship.started_at.slice(0, 16));
  }, [relationship?.started_at]);

  const isOwner = members.some((member) => member.user_id === userId && member.role === "OWNER");
  const full = memberProfiles.length >= 2;

  async function invite() {
    if (!workspaceId || !email.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("create_partner_invitation", { _workspace_id: workspaceId, _email: email.trim() });
    setBusy(false);
    if (error) return void toast.error(error.message);
    const token = data?.[0]?.invitation_token;
    if (token) {
      const link = `${window.location.origin}/auth?invite=${token}`;
      await navigator.clipboard?.writeText(link).catch(() => undefined);
    }
    setEmail("");
    await invitations.refetch();
    toast.success("Convite criado no Life OS e link copiado.");
  }

  async function saveRelationship() {
    if (!workspaceId || !startedAt) return;
    setBusy(true);
    const { error } = await supabase.from("workspace_relationships").upsert({
      workspace_id: workspaceId,
      started_at: new Date(startedAt).toISOString(),
      status: "ACTIVE",
    });
    setBusy(false);
    if (error) return void toast.error(error.message);
    await queryClient.invalidateQueries({ queryKey: ["workspace"] });
    refetchWorkspace();
    toast.success("Início do relacionamento atualizado.");
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Users className="size-4" /></span>
        <div><p className="text-sm font-medium">Parceiro(a)</p><p className="text-xs text-muted-foreground">Um espaço compartilhado comporta somente duas pessoas.</p></div>
      </div>
      {!full ? (
        <div className="space-y-2">
          <Label htmlFor="partner-email">E-mail do parceiro(a)</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input id="partner-email" type="email" placeholder="pessoa@exemplo.com" value={email} onChange={(event) => setEmail(event.target.value)} />
            <Button disabled={busy || !email.trim()} onClick={() => void invite()}><Mail className="size-4" /> Convidar</Button>
          </div>
          {invitations.data?.[0] ? <p className="text-xs text-muted-foreground">Convite pendente para {invitations.data[0].email}, válido por sete dias.</p> : null}
        </div>
      ) : null}
      {full ? (
        <div className="space-y-2">
          <Label htmlFor="relationship-start">Início do relacionamento</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input id="relationship-start" type="datetime-local" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} />
            <Button variant="outline" disabled={busy || !startedAt || !isOwner} onClick={() => void saveRelationship()}>Salvar data</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}