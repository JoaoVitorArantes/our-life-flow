import { supabase } from "@/integrations/supabase/client";

/**
 * Demo data lives only in workspaces flagged `is_demo` by an administrator.
 * Both operations run as database RPCs that re-check the flag and membership server-side
 * and execute atomically; the client never inserts or deletes demo rows directly.
 */
export async function seedDemoData(workspaceId: string) {
  const { error } = await supabase.rpc("prepare_demo_workspace", { _workspace_id: workspaceId });
  if (error) throw error;
}

export async function clearDemoData(workspaceId: string) {
  const { error } = await supabase.rpc("reset_demo_workspace", { _workspace_id: workspaceId });
  if (error) throw error;
}
