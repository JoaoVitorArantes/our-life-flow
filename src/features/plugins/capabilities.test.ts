import { expect, test } from "vitest";
import { CAPABILITIES, capabilityInput, discoverCapabilities } from "./capabilities";
import { toolNameSchema } from "./contracts";
import { PLUGINS, enabledIds } from "./registry";

test("every executable capability has metadata and an input contract", () => {
  expect(CAPABILITIES.map((c) => c.id).sort()).toEqual([...toolNameSchema.options].sort());
  for (const c of CAPABILITIES) expect(typeof capabilityInput(c.id).parse).toBe("function");
});
test("discovery omits disabled capabilities and their write intents", () => {
  const found = discoverCapabilities(enabledIds([{ plugin_id: "finance", enabled: false }]));
  expect(found.some((c) => c.id === "financial_overview")).toBe(false);
  expect(found.find((c) => c.id === "propose_action")?.intents).not.toContain("expense");
  expect(found.find((c) => c.id === "propose_action")?.intents).toContain("task");
});
test("discovery removes proposal tool when no effective write domain remains", () => {
  const enabled = enabledIds(PLUGINS.map((p) => ({ plugin_id: p.id, enabled: false })));
  expect(discoverCapabilities(enabled)).toEqual([]);
});