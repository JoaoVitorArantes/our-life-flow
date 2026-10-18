import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { auditMetadata, type AuditMetadata } from "./audit";

export async function writeCapabilityAudit(
  caller: SupabaseClient<Database>,
  identity: { userId: string; workspaceId: string },
  runId: string,
  tool: string,
  outcome: AuditMetadata["outcome"],
  confirmation: AuditMetadata["confirmation"],
) {
  const row = auditMetadata(identity, runId, tool, outcome, confirmation);
  // Reverify membership through RLS before privileged append. Admin never reads domain data.
  const { data, error } = await caller
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", identity.workspaceId)
    .eq("user_id", identity.userId)
    .maybeSingle();
  if (error || !data) throw new Error("Não foi possível verificar o espaço para esta execução.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error: auditError } = await supabaseAdmin.from("ai_capability_runs").insert(row);
  if (auditError) throw new Error("Não foi possível registrar a execução com segurança.");
}
