import { expect, test } from "vitest";
import {
  selectionSchema,
  validateSelection,
  eligibleModels,
  type ProviderSelection,
  type ProviderStatus,
} from "./contracts";
import { credentialName } from "./catalog.server";

const userId = "11111111-1111-4111-8111-111111111111";
const workspaceId = "22222222-2222-4222-8222-222222222222";
const selection: ProviderSelection = {
  provider: "gemini",
  model: "documented-model",
  scope: "shared",
  consent: { userId, workspaceId, provider: "gemini", model: "documented-model", accepted: true },
};
const catalog: ProviderStatus[] = [
  {
    id: "gemini",
    name: "Gemini",
    configured: true,
    state: "configured_unverified",
    models: [{ id: "documented-model", tools: true, text: true, streaming: true }],
  },
];
test("credentials are workspace-bound and arbitrary secret names are rejected", () => {
  expect(credentialName("openai", workspaceId)).toBe(
    "LIFE_AI_OPENAI_22222222_2222_4222_8222_222222222222_API_KEY",
  );
  expect(credentialName("openai", userId)).not.toBe(credentialName("openai", workspaceId));
  expect(() => credentialName("openai", "../../other")).toThrow();
});
test("consent cannot cross users or workspaces", () => {
  expect(() => validateSelection(selection, workspaceId, workspaceId, catalog)).toThrow("Confirme");
  expect(() => validateSelection(selection, userId, userId, catalog)).toThrow("Confirme");
});
test("changed provider or model requires matching new consent", () => {
  expect(() =>
    validateSelection({ ...selection, provider: "openai" }, userId, workspaceId, catalog),
  ).toThrow("Confirme");
  expect(() =>
    validateSelection({ ...selection, model: "another" }, userId, workspaceId, catalog),
  ).toThrow("Confirme");
});
test("personal credentials cannot use project shared secrets", () => {
  expect(() =>
    validateSelection({ ...selection, scope: "personal" }, userId, workspaceId, catalog),
  ).toThrow("cofre seguro");
});
test("missing credential or unsupported model never falls back", () => {
  expect(() =>
    validateSelection(selection, userId, workspaceId, [
      { ...catalog[0], configured: false } as ProviderStatus,
    ]),
  ).toThrow("pendentes");
  expect(() =>
    validateSelection(selection, userId, workspaceId, [
      { ...catalog[0], models: [] } as ProviderStatus,
    ]),
  ).toThrow("Nenhum outro modelo");
});
test("only text streaming models with tools are eligible", () => {
  expect(
    eligibleModels([
      { id: "image", text: false, tools: false, streaming: true },
      { id: "chat-only", text: true, tools: false, streaming: true },
      { id: "nonstream", text: true, tools: true, streaming: false },
      { id: "agent", text: true, tools: true, streaming: true },
    ]).map((m) => m.id),
  ).toEqual(["agent"]);
});
test("selection accepts only identifiers and consent, never keys or URLs", () => {
  expect(selectionSchema.safeParse(selection).success).toBe(true);
  expect(selectionSchema.safeParse({ ...selection, apiKey: "not-a-credential" }).success).toBe(
    false,
  );
  expect(selectionSchema.safeParse({ ...selection, baseURL: "http://localhost" }).success).toBe(
    false,
  );
  expect(
    selectionSchema.safeParse({ ...selection, consent: { ...selection.consent, accepted: false } })
      .success,
  ).toBe(false);
});
