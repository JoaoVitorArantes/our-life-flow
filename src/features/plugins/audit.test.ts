import { expect, test, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { auditMetadata } from "./audit";
import { writeCapabilityAudit } from "./audit.server";
const userId = "00000000-0000-4000-8000-000000000001";
const workspaceId = "00000000-0000-4000-8000-000000000002";
const runId = "00000000-0000-4000-8000-000000000003";
test("audit is metadata only and rejects unknown capability", () => {
  const identity = { userId, workspaceId, token: "must-not-leak", message: "private text" };
  expect(auditMetadata(identity, runId, "tasks", "success", "not_required")).toEqual({
    actor_id: userId,
    workspace_id: workspaceId,
    run_id: runId,
    capability: "tasks",
    tool: "tasks",
    outcome: "success",
    confirmation: "not_required",
  });
  expect(() =>
    auditMetadata(identity, runId, "fetch_any_url", "success", "not_required"),
  ).toThrow();
});
test("audit checks exact caller/workspace membership before privileged append", async () => {
  const eq = vi.fn(() => chain);
  const chain = { select: () => chain, eq, maybeSingle: async () => ({ data: null, error: null }) };
  const client = { from: () => chain } as unknown as SupabaseClient<Database>;
  await expect(
    writeCapabilityAudit(
      client,
      { userId, workspaceId },
      runId,
      "tasks",
      "success",
      "not_required",
    ),
  ).rejects.toThrow("verificar");
  expect(eq.mock.calls).toEqual([
    ["workspace_id", workspaceId],
    ["user_id", userId],
  ]);
});
