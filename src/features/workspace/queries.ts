import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;
export type Workspace = Tables<"workspaces">;
export type Member = Tables<"workspace_members">;
export type Relationship = Tables<"workspace_relationships">;

async function withAvatarUrls(profiles: Profile[]) {
  return Promise.all(
    profiles.map(async (profile) => {
      if (!profile.avatar_url || profile.avatar_url.startsWith("http")) return profile;
      const { data } = await supabase.storage.from("avatars").createSignedUrl(profile.avatar_url, 60 * 60);
      return {
        ...profile,
        avatar_url: data?.signedUrl ? `${data.signedUrl}#avatar-path=${profile.avatar_url}` : null,
      };
    }),
  );
}

async function signWorkspacePath(path: string | null) {
  if (!path || path.startsWith("http")) return path;
  const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ? `${data.signedUrl}#avatar-path=${path}` : null;
}

async function withWorkspaceAvatar(workspace: Workspace) {
  const [avatar_url, cover_url] = await Promise.all([
    signWorkspacePath(workspace.avatar_url),
    signWorkspacePath(workspace.cover_url),
  ]);
  return { ...workspace, avatar_url, cover_url };
}

/** Creates profile + "Life OS" workspace + default categories when missing. */
export async function bootstrapAccount(name?: string) {
  const { data, error } = await supabase.rpc("bootstrap_account", { _name: name ?? "" });
  if (error) throw error;
  return data as string;
}

export function useWorkspace(enabled: boolean) {
  return useQuery({
    queryKey: ["workspace"],
    enabled,
    queryFn: async () => {
      const workspaceId = await bootstrapAccount();
      if (!workspaceId) throw new Error("Não foi possível identificar o workspace.");

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw authError ?? new Error("Usuário não autenticado.");

      const [workspaceResult, profileResult, membersResult, relationshipResult, membershipsResult] = await Promise.all([
        supabase.from("workspaces").select("*").eq("id", workspaceId).maybeSingle(),
        supabase.from("profiles").select("*").eq("id", authData.user.id).maybeSingle(),
        supabase.from("workspace_members").select("*").eq("workspace_id", workspaceId),
        supabase.from("workspace_relationships").select("*").eq("workspace_id", workspaceId).maybeSingle(),
        supabase.from("workspace_members").select("workspace_id, role, workspaces(*)").eq("user_id", authData.user.id),
      ]);

      if (workspaceResult.error) throw workspaceResult.error;
      if (profileResult.error) throw profileResult.error;
      if (membersResult.error) throw membersResult.error;
      if (relationshipResult.error) throw relationshipResult.error;
      if (membershipsResult.error) throw membershipsResult.error;

      const workspace = workspaceResult.data;
      const profile = profileResult.data;
      const members = membersResult.data;
      if (!workspace) throw new Error("Workspace não encontrado.");

      const memberIds = (members ?? []).map((m) => m.user_id);
      const profilesResult = memberIds.length
        ? await supabase.from("profiles").select("*").in("id", memberIds)
        : { data: [], error: null };
      if (profilesResult.error) throw profilesResult.error;

      const resolvedProfiles = await withAvatarUrls((profilesResult.data ?? []) as Profile[]);
      const resolvedProfile = resolvedProfiles.find((item) => item.id === profile?.id) ?? profile;
      const resolvedWorkspace = await withWorkspaceAvatar(workspace as Workspace);

      return {
        workspaceId,
        workspace: resolvedWorkspace,
        profile: resolvedProfile as Profile | null,
        members: (members ?? []) as Member[],
        memberProfiles: resolvedProfiles,
        relationship: relationshipResult.data as Relationship | null,
        availableWorkspaces: (membershipsResult.data ?? []).map((membership) => membership.workspaces).filter(Boolean) as Workspace[],
      };
    },
  });
}
