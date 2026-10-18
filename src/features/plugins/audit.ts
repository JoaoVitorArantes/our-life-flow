import { z } from "zod";
import { intentSchema, toolNameSchema } from "./contracts";
import { pluginForIntent, pluginForTool } from "./registry";

const auditSchema = z.object({
  actor_id: z.string().uuid(), workspace_id: z.string().uuid(),
  capability: z.string().regex(/^[a-z_]{1,80}$/),
  tool: z.union([toolNameSchema, intentSchema]), run_id: z.string().uuid(),
  outcome: z.enum(["success", "failure"]),
  confirmation: z.enum(["not_required", "proposed", "accepted"]),
}).strict();
export type AuditMetadata = z.infer<typeof auditSchema>;
// Pick only metadata: callers cannot accidentally persist messages, results or errors.
export function auditMetadata(identity: { userId: string; workspaceId: string }, runId: string,
  tool: string, outcome: AuditMetadata["outcome"], confirmation: AuditMetadata["confirmation"]): AuditMetadata {
  const capability = pluginForTool(tool)?.id ?? pluginForIntent(tool)?.id ?? (tool === "propose_action" ? "proposal" : undefined);
  if (!capability) throw new Error("Unknown audit capability");
  return auditSchema.parse({ actor_id: identity.userId, workspace_id: identity.workspaceId,
    capability, tool, run_id: runId, outcome, confirmation });
}
