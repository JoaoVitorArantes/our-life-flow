import { beforeEach, expect, test, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { actionSchema } from "@/features/plugins/action-schema";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
vi.mock("@/features/finance/queries", () => ({ createTransaction: vi.fn() }));
vi.mock("@/features/finance/mutations", () => ({ createInstallmentPlan: vi.fn() }));
vi.mock("@/features/nos/mutations", () => ({ saveDivision: vi.fn() }));
vi.mock("@/features/purchases/queries", () => ({ createPurchase: vi.fn() }));
vi.mock("@/features/activities/queries", () => ({ createActivity: vi.fn() }));
vi.mock("@/features/records/mutations", () => ({ saveSimpleRecord: vi.fn() }));
vi.mock("@/features/plugins/plugins.functions", () => ({ authorizePluginAction: vi.fn() }));
vi.mock("@/features/contexts/execute-confirmed", () => ({ executeContextAction: vi.fn() }));
import { executeContextAction } from "@/features/contexts/execute-confirmed";
import { authorizePluginAction } from "@/features/plugins/plugins.functions";
import { saveSimpleRecord } from "@/features/records/mutations";
import { createTransaction } from "@/features/finance/queries";
import { executeAction } from "./execute";

const action = actionSchema.parse({
  intent: "note",
  description: "Nota",
  amount: null,
  date: null,
  time: null,
  card_id: null,
  account_id: null,
  category_id: null,
  context_id: null,
  installments: null,
  shared: false,
  payer_user_id: null,
  my_share_percent: null,
  content: "Conteúdo",
  duration_minutes: null,
  distance_km: null,
  activity_type: null,
  person_scope: null,
  priority: null,
  purchase_category: null,
  academic_course_id: null,
  evaluation_kind: null,
  grade: null,
  weight: null,
  attended: null,
});
const ctx = {
  workspaceId: "expected",
  userId: "untrusted-client",
  memberIds: [],
  queryClient: new QueryClient(),
};
beforeEach(() => {
  vi.resetAllMocks();
});
test("denied authorization prevents shared mutations", async () => {
  vi.mocked(authorizePluginAction).mockRejectedValue(new Error("denied"));
  await expect(executeAction(action, ctx)).rejects.toThrow("denied");
  expect(saveSimpleRecord).not.toHaveBeenCalled();
  expect(createTransaction).not.toHaveBeenCalled();
});
test("confirmed note delegates to shared mutation using server identity and preserves content", async () => {
  vi.mocked(authorizePluginAction).mockResolvedValue({
    workspaceId: "server-workspace",
    userId: "server-user",
  });
  vi.mocked(saveSimpleRecord).mockResolvedValue({ id: "saved" });
  expect(await executeAction(action, ctx)).toEqual({
    id: "saved",
    module: "Notas",
    href: "/notas",
  });
  expect(saveSimpleRecord).toHaveBeenCalledWith(
    "note",
    "server-workspace",
    "server-user",
    expect.objectContaining({ content: "Conteúdo", contextId: null }),
  );
  expect(authorizePluginAction).toHaveBeenCalledWith({
    data: expect.objectContaining({ confirmed: true, action }),
  });
});
test("failed persistence never returns success", async () => {
  vi.mocked(authorizePluginAction).mockResolvedValue({ workspaceId: "server", userId: "actor" });
  vi.mocked(saveSimpleRecord).mockRejectedValue(new Error("failed persistence"));
  await expect(executeAction(action, ctx)).rejects.toThrow("failed persistence");
});
test("shared installments are blocked instead of promising unsupported division", async () => {
  await expect(
    executeAction(
      {
        ...action,
        intent: "expense",
        date: "2026-10-18",
        amount: 42,
        card_id: "card",
        installments: 6,
        shared: true,
      },
      ctx,
    ),
  ).rejects.toThrow("parcelamento dividido");
  expect(authorizePluginAction).not.toHaveBeenCalled();
});
test("context confirmation delegates with server identity only after authorization", async () => {
  const contextAction = {
    ...action,
    intent: "create_context" as const,
    description: "Habilitação",
  };
  vi.mocked(authorizePluginAction).mockRejectedValueOnce(new Error("denied"));
  await expect(executeAction(contextAction, ctx)).rejects.toThrow("denied");
  expect(executeContextAction).not.toHaveBeenCalled();
  vi.mocked(authorizePluginAction).mockResolvedValue({
    workspaceId: "authorized",
    userId: "actor",
  });
  vi.mocked(executeContextAction).mockResolvedValue({
    id: "returned-real-id",
    module: "Contextos",
    href: "/contextos/returned-real-id",
  });
  expect(await executeAction(contextAction, ctx)).toMatchObject({ id: "returned-real-id" });
  expect(executeContextAction).toHaveBeenCalledWith(contextAction, "authorized", "actor");
});
test("invalid context proposal cannot reach authorization or persistence", async () => {
  await expect(
    executeAction(
      {
        ...action,
        intent: "create_context",
        context_data: { start_date: "2026-10-20", end_date: "2026-10-18" },
      },
      ctx,
    ),
  ).rejects.toThrow();
  expect(authorizePluginAction).not.toHaveBeenCalled();
  expect(executeContextAction).not.toHaveBeenCalled();
});
test("subsequent expense keeps verified context ID and the supplied R$120", async () => {
  vi.mocked(authorizePluginAction).mockResolvedValue({
    workspaceId: "authorized",
    userId: "actor",
  });
  vi.mocked(createTransaction).mockResolvedValue({ id: "actual-transaction-id" } as Awaited<
    ReturnType<typeof createTransaction>
  >);
  const expense = {
    ...action,
    intent: "expense" as const,
    description: "Aulas práticas",
    amount: 120,
    date: "2026-10-18",
    account_id: "actual-account-id",
    context_id: "returned-real-context-id",
  };
  expect(await executeAction(expense, ctx)).toMatchObject({ id: "actual-transaction-id" });
  expect(createTransaction).toHaveBeenCalledWith(
    expect.objectContaining({
      amount: 120,
      contextId: "returned-real-context-id",
      description: "Aulas práticas",
      workspaceId: "authorized",
      ownerId: "actor",
    }),
  );
});
