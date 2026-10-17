import { expect, test, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { loadPluginAccess, requirePluginIntent } from "./access.server";

function client(member: boolean, enabled = true, manage = true) {
  const builder = (value: unknown) => {
    const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => value, then: (resolve: (value: unknown) => unknown) => Promise.resolve(value).then(resolve) };
    return chain;
  };
  const from = vi.fn((table: string) => builder(table === "workspace_members" ? { data: member ? { user_id: "caller" } : null, error: null } : { data: [{ plugin_id: "finance", enabled }], error: null }));
  return { supabase: { from, rpc: vi.fn(async () => ({ data: manage, error: null })) } as unknown as SupabaseClient<Database>, from };
}
test("a nonmember cannot discover or execute another workspace's plugins", async () => {
  const { supabase, from } = client(false);
  await expect(loadPluginAccess(supabase, "caller", "other-workspace")).rejects.toThrow("não está disponível");
  expect(from).toHaveBeenCalledTimes(1);
});
test("confirmation reloads persisted enablement instead of trusting a previous proposal", async () => {
  const { supabase } = client(true, false);
  await expect(requirePluginIntent(supabase, "caller", "workspace", "expense")).rejects.toThrow("desativado");
});
test("rename proposals and confirmations respect workspace_can", async () => {
  const { supabase } = client(true, true, false);
  await expect(requirePluginIntent(supabase, "caller", "workspace", "rename_workspace")).rejects.toThrow("permissão");
});