import { expect, test, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildTools } from "./tools.server";

test("real proposal handler resolves accessible IDs and never writes before confirmation", async () => {
  const from = vi.fn(() => {
    throw new Error("Proposal must not access a write path");
  });
  const rpc = vi.fn(async () => ({ data: true, error: null }));
  const tools = buildTools(
    {
      supabase: { from, rpc } as unknown as SupabaseClient<Database>,
      workspaceId: "selected-workspace",
      userId: "caller",
      today: "2026-10-17",
    },
    {
      workspace: { name: "Test", description: null, members: 1 },
      accounts: [],
      cards: [],
      categories: [],
      contexts: [],
      goals: [],
      people: [{ id: "caller", name: "Test", me: true }],
    },
  );
  const result = await tools.propose_action.execute?.(
    {
      intent: "expense",
      description: "Test proposal",
      amount: 10.125,
      date: null,
      time: null,
      card_id: "outside-workspace",
      account_id: null,
      category_id: null,
      context_id: null,
      installments: null,
      shared: false,
      payer_user_id: "outside-workspace",
      my_share_percent: null,
      content: null,
      duration_minutes: null,
      distance_km: null,
      activity_type: null,
      person_scope: null,
      priority: null,
      purchase_category: null,
    },
    { toolCallId: "proposal", messages: [], context: {} },
  );
  expect(result).toMatchObject({
    amount: 10.13,
    card_id: null,
    payer_user_id: "caller",
    date: "2026-10-17",
  });
  expect(from).not.toHaveBeenCalled();
  expect(rpc).toHaveBeenCalledWith("is_workspace_member", { _workspace_id: "selected-workspace" });
});
