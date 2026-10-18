import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { CONNECTOR_ID, connectionInWorkspace } from "./contracts";
export async function activeIdentity(sb: SupabaseClient<Database>, userId: string) {
  const { data, error } = await sb
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", userId)
    .single();
  if (error || !data?.active_workspace_id) throw new Error("Selecione um espaço.");
  const workspaceId = data.active_workspace_id;
  const { data: member, error: memberError } = await sb
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (memberError || !member) throw new Error("Este espaço não está disponível na sua conta.");
  return { userId, workspaceId };
}
export async function loadConnection(userId: string, workspaceId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("app_user_connections")
    .select("connection_key_ciphertext,workspace_id")
    .eq("user_id", userId)
    .eq("connector_id", CONNECTOR_ID)
    .maybeSingle();
  if (error) throw new Error("Não foi possível verificar sua conexão.");
  if (!connectionInWorkspace(data, workspaceId))
    throw new Error(
      "Sua conexão pertence a outro espaço. Volte a ele para desconectar antes de conectar aqui.",
    );
  return data;
}
