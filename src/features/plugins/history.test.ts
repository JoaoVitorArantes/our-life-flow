import { expect, test, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { readCapabilityHistory } from "./history.server";
vi.mock("./access.server", () => ({ loadPluginAccess: vi.fn(async () => new Set()) }));
import { loadPluginAccess } from "./access.server";

test("history resolves workspace from session profile and filters actor with a bounded metadata projection", async () => {
  const eq = vi.fn(); const select = vi.fn(); const limit = vi.fn();
  const chain = { select: (s: string) => { select(s); return chain; },
    eq: (k: string, v: string) => { eq(k, v); return chain; },
    single: async () => ({ data: { active_workspace_id: "resolved" }, error: null }),
    order: () => chain, limit: async (n: number) => { limit(n); return { data: [], error: null }; } };
  const sb = { from: () => chain } as unknown as SupabaseClient<Database>;
  expect(await readCapabilityHistory(sb, "actor")).toEqual({ workspaceId: "resolved", runs: [] });
  expect(loadPluginAccess).toHaveBeenCalledWith(sb, "actor", "resolved");
  expect(eq).toHaveBeenCalledWith("workspace_id", "resolved");
  expect(eq).toHaveBeenCalledWith("actor_id", "actor");
  expect(limit).toHaveBeenCalledWith(50);
  expect(select).toHaveBeenCalledWith("id,capability,tool,run_id,outcome,confirmation,created_at");
});