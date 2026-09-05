import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;
export type Workspace = Tables<"workspaces">;
export type Member = Tables<"workspace_members">;

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
      const [{ data: workspace }, { data: profile }, { data: members }] = await Promise.all([
        supabase.from("workspaces").select("*").eq("id", workspaceId).maybeSingle(),
        supabase
          .from("profiles")
          .select("*")
          .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
          .maybeSingle(),
        supabase.from("workspace_members").select("*").eq("workspace_id", workspaceId),
      ]);

      const memberIds = (members ?? []).map((m) => m.user_id);
      const { data: profiles } = await supabase.from("profiles").select("*").in("id", memberIds);

      return {
        workspaceId,
        workspace: workspace as Workspace | null,
        profile: profile as Profile | null,
        members: (members ?? []) as Member[],
        memberProfiles: (profiles ?? []) as Profile[],
      };
    },
  });
}
