import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { loadPluginAccess } from "./access.server";

export async function readCapabilityHistory(sb: SupabaseClient<Database>, userId: string) {
  const { data: profile, error } = await sb
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", userId)
    .single();
  if (error || !profile?.active_workspace_id) throw new Error("Selecione um espaço.");
  const workspaceId = profile.active_workspace_id;
  await loadPluginAccess(sb, userId, workspaceId);
  const { data, error: readError } = await sb
    .from("ai_capability_runs")
    .select("id,capability,tool,run_id,outcome,confirmation,created_at")
    .eq("workspace_id", workspaceId)
    .eq("actor_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (readError) throw new Error("Não foi possível carregar suas execuções.");
  return { workspaceId, runs: data ?? [] };
}
