import { expect, test } from "vitest";
import {
  contextCreateInput,
  contextProposalSchema,
  contextWireSchema,
  normalizeContextWire,
} from "./ai-contract";
import {
  actionSchema,
  proposalInputSchema,
  normalizeProposal,
} from "@/features/plugins/action-schema";
import { zodSchema } from "ai";
import { contextTestAction as draft } from "./test-action";
import { enabledIds, intentAllowed } from "@/features/plugins/registry";

test("Habilitação needs only a name and uses form defaults", () => {
  expect(contextCreateInput(" Habilitação ")).toMatchObject({
    name: "Habilitação",
    type: "PERSONAL",
    status: "ACTIVE",
    visibility: "SHARED",
    budget_amount: null,
  });
});
test("optional context fields preserve supplied values including zero budget", () => {
  expect(
    contextCreateInput("Habilitação", {
      type: "PROJECT",
      budget_amount: 0,
      description: "Aulas",
      visibility: "PRIVATE",
    }),
  ).toMatchObject({
    type: "PROJECT",
    budget_amount: 0,
    description: "Aulas",
    visibility: "PRIVATE",
  });
});
test("context invalid name, budget and inverted dates fail", () => {
  expect(() => contextCreateInput(" ")).toThrow();
  expect(() => contextCreateInput("Habilitação", { budget_amount: -1 })).toThrow();
  expect(() =>
    contextCreateInput("Habilitação", { start_date: "2026-10-20", end_date: "2026-10-18" }),
  ).toThrow();
  expect(contextProposalSchema.safeParse({ type: "MADE_UP" }).success).toBe(false);
});
test("omitted edit fields are not replaced with creation defaults", () => {
  expect(contextProposalSchema.parse({ description: null })).toEqual({ description: null });
});
test("all context writes fail closed when plugin or finance dependency is disabled", () => {
  for (const intent of ["create_context", "update_context", "archive_context", "delete_context"]) {
    expect(intentAllowed(intent, enabledIds([]))).toBe(true);
    expect(intentAllowed(intent, enabledIds([{ plugin_id: "contexts", enabled: false }]))).toBe(
      false,
    );
    expect(intentAllowed(intent, enabledIds([{ plugin_id: "finance", enabled: false }]))).toBe(
      false,
    );
  }
});
test("legacy proposal schema stays valid while context fields remain strict", () => {
  expect(actionSchema.safeParse(draft).success).toBe(true);
  expect(
    actionSchema.safeParse({
      ...draft,
      intent: "create_context",
      context_data: { sql: "anything" },
    }).success,
  ).toBe(false);
});
test("strict model schema requires every property and rejects extra properties at every object", async () => {
  function check(value: unknown): void {
    if (!value || typeof value !== "object") return;
    const node = value as Record<string, unknown>;
    if (node["type"] === "object") {
      expect(node["additionalProperties"]).toBe(false);
      expect(new Set(node["required"] as string[])).toEqual(
        new Set(Object.keys(node["properties"] as object)),
      );
    }
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) child.forEach(check);
      else check(child);
    }
  }
  check(await zodSchema(proposalInputSchema).jsonSchema);
});
test("model nulls preserve omitted edits and only explicit clear_fields clear values", () => {
  const wire = contextWireSchema.parse({
    type: null,
    status: null,
    description: null,
    start_date: null,
    end_date: null,
    location: null,
    budget_amount: 0,
    visibility: null,
    clear_fields: ["end_date"],
  });
  expect(normalizeContextWire(wire)).toEqual({ budget_amount: 0, end_date: null });
  expect(normalizeProposal({ ...draft, context_data: null })).toMatchObject({
    intent: "create_context",
    context_data: null,
  });
});
