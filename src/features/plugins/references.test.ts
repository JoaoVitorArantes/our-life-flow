import { expect, test, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { actionSchema } from "./action-schema";
import { validateActionReferences } from "./references.server";

export const draft = actionSchema.parse({
  intent: "expense", description: "Almoço", amount: 42, date: "2026-10-18", time: null,
  card_id: null, account_id: null, category_id: null, context_id: null,
  installments: null, shared: false, payer_user_id: null, my_share_percent: null,
  content: null, duration_minutes: null, distance_km: null, activity_type: null,
  person_scope: null, priority: null, purchase_category: null,
});

function client(result: unknown) {
  const filters = vi.fn();
  const chain = { select: () => chain, eq: (key: string, value: unknown) => { filters(key, value); return chain; },
    is: (key: string, value: unknown) => { filters(key, value); return chain; },
    neq: (key: string, value: unknown) => { filters(key, value); return chain; },
    maybeSingle: async () => result };
  return { sb: { from: vi.fn(() => chain) } as unknown as SupabaseClient<Database>, filters };
}
test.each(["card_id", "account_id", "category_id", "context_id", "payer_user_id"] as const)(
  "confirmation rejects unavailable %s instead of clearing it", async (field) => {
    const { sb, filters } = client({ data: null, error: null });
    await expect(validateActionReferences(sb, "workspace", { ...draft, [field]: "other-id" })).rejects.toThrow("referência");
    expect(filters).toHaveBeenCalledWith("workspace_id", "workspace");
  },
);
test("active card and unarchived context are rechecked", async () => {
  const { sb, filters } = client({ data: { id: "known" }, error: null });
  await expect(validateActionReferences(sb, "workspace", { ...draft, card_id: "known", context_id: "known" })).resolves.toBeUndefined();
  expect(filters).toHaveBeenCalledWith("is_active", true);
  expect(filters).toHaveBeenCalledWith("status", "ARCHIVED");
});
test("expense cannot use an income category", async () => {
  const { sb } = client({ data: { id: "category", type: "INCOME" }, error: null });
  await expect(validateActionReferences(sb, "workspace", { ...draft, category_id: "category" })).rejects.toThrow();
});
test("ambiguous payment rejects before any reads", async () => {
  const { sb } = client({ data: { id: "known" }, error: null });
  await expect(validateActionReferences(sb, "workspace", { ...draft, card_id: "a", account_id: "b" })).rejects.toThrow("não ambos");
  expect(sb.from).not.toHaveBeenCalled();
});