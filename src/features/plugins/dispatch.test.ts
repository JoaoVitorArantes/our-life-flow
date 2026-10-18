import { expect, test, vi } from "vitest";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { toolNameSchema } from "./contracts";
import { enabledIds } from "./registry";
import { guardTools } from "./dispatch.server";

function implementations() {
  const execute = vi.fn(async () => ({ ok: true }));
  const tools: ToolSet = Object.fromEntries(
    toolNameSchema.options.map((name) => [
      name,
      tool({ inputSchema: z.object({}).strict(), execute }),
    ]),
  );
  return { tools, execute };
}
const options = { toolCallId: "call", messages: [] };
test("dispatch reloads enablement: old discovery cannot execute after disable", async () => {
  const { tools, execute } = implementations();
  const audit = vi.fn(async () => {});
  const guarded = guardTools(
    tools,
    enabledIds([]),
    async () => enabledIds([{ plugin_id: "finance", enabled: false }]),
    audit,
  );
  await expect(guarded.financial_overview?.execute?.({}, options)).rejects.toThrow(
    "Não foi possível",
  );
  expect(execute).not.toHaveBeenCalled();
  expect(audit).toHaveBeenCalledWith("financial_overview", "failure");
});
test("dispatch blocks disabled dependencies and malformed input", async () => {
  const { tools, execute } = implementations();
  const audit = vi.fn(async () => {});
  const guarded = guardTools(
    tools,
    enabledIds([]),
    async () => enabledIds([{ plugin_id: "routines", enabled: false }]),
    audit,
  );
  await expect(guarded.agenda?.execute?.({}, options)).rejects.toThrow();
  await expect(guarded.tasks?.execute?.({ workspace_id: "other" }, options)).rejects.toThrow();
  expect(execute).not.toHaveBeenCalled();
});
test("missing and unknown implementations fail before discovery", () => {
  const { tools } = implementations();
  expect(() =>
    guardTools(
      { ...tools, arbitrary_url: tools.tasks } as ToolSet,
      enabledIds([]),
      async () => enabledIds([]),
      async () => {},
    ),
  ).toThrow();
  const { tasks: _removed, ...rest } = tools;
  expect(() =>
    guardTools(
      rest,
      enabledIds([]),
      async () => enabledIds([]),
      async () => {},
    ),
  ).toThrow();
});
test("a successful validated execution writes a success without content", async () => {
  const { tools } = implementations();
  const audit = vi.fn(async () => {});
  const guarded = guardTools(tools, enabledIds([]), async () => enabledIds([]), audit);
  await expect(guarded.tasks?.execute?.({}, options)).resolves.toEqual({ ok: true });
  expect(audit).toHaveBeenCalledWith("tasks", "success");
});
