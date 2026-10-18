import { expect, test, vi } from "vitest";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { toolNameSchema } from "./contracts";
import { enabledIds } from "./registry";
import { guardTools } from "./dispatch.server";

function implementations() {
  const execute = vi.fn(async () => ({ quantidade: 0, tarefas: [] }));
  const tools: ToolSet = Object.fromEntries(
    toolNameSchema.options.map((name) => [
      name,
      tool({ inputSchema: z.object({}).strict(), execute }),
    ]),
  );
  return { tools, execute };
}
const options = { toolCallId: "call", messages: [] };
function run(tools: ToolSet, name: string, input: unknown) {
  const execute = tools[name]?.execute as
    ((input: unknown, executionOptions: typeof options) => Promise<unknown>) | undefined;
  if (!execute) throw new Error("Missing executable test tool");
  return execute(input, options);
}
test("dispatch reloads enablement: old discovery cannot execute after disable", async () => {
  const { tools, execute } = implementations();
  const audit = vi.fn(async () => {});
  const guarded = guardTools(
    tools,
    enabledIds([]),
    async () => enabledIds([{ plugin_id: "finance", enabled: false }]),
    audit,
  );
  await expect(run(guarded, "financial_overview", {})).rejects.toThrow("Não foi possível");
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
  await expect(run(guarded, "agenda", {})).rejects.toThrow();
  await expect(run(guarded, "tasks", { workspace_id: "other" })).rejects.toThrow();
  expect(execute).not.toHaveBeenCalled();
});
test("missing and unknown implementations fail before discovery", () => {
  const { tools } = implementations();
  expect(() =>
    guardTools(
      { ...tools, arbitrary_url: tools["tasks"] } as ToolSet,
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
  await expect(run(guarded, "tasks", {})).resolves.toEqual({ quantidade: 0, tarefas: [] });
  expect(audit).toHaveBeenCalledWith("tasks", "success");
});
test("wrong domain output cannot be audited as success", async () => {
  const { tools, execute } = implementations();
  execute.mockResolvedValue({ quantidade: -1, tarefas: [] });
  const audit = vi.fn(async () => {});
  const guarded = guardTools(tools, enabledIds([]), async () => enabledIds([]), audit);
  await expect(run(guarded, "tasks", {})).rejects.toThrow();
  expect(audit).toHaveBeenCalledWith("tasks", "failure");
  expect(audit).not.toHaveBeenCalledWith("tasks", "success");
});
