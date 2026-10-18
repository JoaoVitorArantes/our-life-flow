import { beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), remove: vi.fn(), read: vi.fn(), filters: vi.fn() }));
vi.mock("./queries", () => ({ createContext: mocks.create, updateContext: mocks.update, deleteContext: mocks.remove }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => {
  const chain = { select: () => chain, eq: (key: string, value: string) => { mocks.filters(key, value); return chain; }, single: mocks.read, maybeSingle: mocks.read };
  return chain;
} } }));
import { executeContextAction } from "./execute-confirmed";
import { draft } from "@/features/plugins/references.test";
beforeEach(() => vi.resetAllMocks());
test("creates via existing form service and reads back server scoped id", async () => {
  mocks.create.mockResolvedValue({ id: "actual-id" });
  mocks.read.mockResolvedValue({ data: { id: "actual-id" }, error: null });
  const result = await executeContextAction({ ...draft, intent: "create_context", description: "Habilitação", amount: null }, "authorized-workspace", "authorized-user");
  expect(result).toEqual({ id: "actual-id", module: "Contextos", href: "/contextos/actual-id" });
  expect(mocks.create).toHaveBeenCalledWith("authorized-workspace", "authorized-user", expect.objectContaining({ name: "Habilitação", type: "PERSONAL", status: "ACTIVE" }));
  expect(mocks.filters).toHaveBeenCalledWith("workspace_id", "authorized-workspace");
  expect(mocks.filters).toHaveBeenCalledWith("id", "actual-id");
});
test("read back failure cannot be presented as success", async () => {
  mocks.create.mockResolvedValue({ id: "saved" });
  mocks.read.mockResolvedValue({ data: null, error: null });
  await expect(executeContextAction({ ...draft, intent: "create_context", description: "Habilitação" }, "workspace", "user")).rejects.toThrow("Não foi possível");
});
test("edit delegates only requested fields to existing mutation", async () => {
  mocks.update.mockResolvedValue({ id: "actual-id" });
  mocks.read.mockResolvedValue({ data: { id: "actual-id" }, error: null });
  await executeContextAction({ ...draft, intent: "update_context", context_id: "actual-id", description: "Habilitação", context_data: { budget_amount: 120 } }, "workspace", "user");
  expect(mocks.update).toHaveBeenCalledWith("actual-id", { name: "Habilitação", budget_amount: 120 }, "workspace");
  expect(mocks.create).not.toHaveBeenCalled();
});
test("archive preserves other fields", async () => {
  mocks.read.mockResolvedValue({ data: { id: "actual-id" }, error: null });
  await executeContextAction({ ...draft, intent: "archive_context", context_id: "actual-id" }, "workspace", "user");
  expect(mocks.update).toHaveBeenCalledWith("actual-id", { status: "ARCHIVED" }, "workspace");
});
test("deletion uses existing trash service and requires disappearance", async () => {
  mocks.read.mockResolvedValue({ data: null, error: null });
  expect(await executeContextAction({ ...draft, intent: "delete_context", context_id: "actual-id" }, "workspace", "user")).toMatchObject({ href: "/configuracoes/dados" });
  expect(mocks.remove).toHaveBeenCalledWith("actual-id");
  mocks.read.mockResolvedValue({ data: { id: "actual-id" }, error: null });
  await expect(executeContextAction({ ...draft, intent: "delete_context", context_id: "actual-id" }, "workspace", "user")).rejects.toThrow();
});