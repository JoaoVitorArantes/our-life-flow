import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { enabledIds, intentAllowed } from "./registry";

export async function loadPluginAccess(
  supabase: SupabaseClient<Database>,
  userId: string,
  workspaceId: string,
) {
  const { data: member, error: memberError } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (memberError || !member) throw new Error("Este espaço não está disponível na sua conta.");
  const { data, error } = await supabase
    .from("ai_plugin_preferences")
    .select("plugin_id, enabled")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);
  if (error) throw new Error("Não foi possível verificar os plugins. Tente novamente.");
  const enabled = enabledIds(data ?? []);
  const { data: canManage, error: permissionError } = await supabase.rpc("workspace_can", {
    _workspace_id: workspaceId,
    _action: "manage_workspace",
  });
  if (permissionError || !canManage) enabled.delete("workspace");
  return enabled;
}
export async function requirePluginIntent(
  supabase: SupabaseClient<Database>,
  userId: string,
  workspaceId: string,
  intent: string,
) {
  const enabled = await loadPluginAccess(supabase, userId, workspaceId);
  if (!intentAllowed(intent, enabled))
    throw new Error("Este plugin está desativado ou você não tem permissão para esta ação.");
}
