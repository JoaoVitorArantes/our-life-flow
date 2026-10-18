import type { ToolSet } from "ai";
import { toolNameSchema, validateToolOutput, type ToolName } from "./contracts";
import { toolAllowed } from "./registry";

export function assertToolImplementations(tools: ToolSet) {
  const names = Object.keys(tools);
  if (names.length !== toolNameSchema.options.length || toolNameSchema.options.some((n) => !tools[n]?.execute))
    throw new Error("Incomplete executable tool registry");
  for (const name of names) toolNameSchema.parse(name);
}
export function guardTools(tools: ToolSet, initialEnabled: ReadonlySet<string>,
  reloadAccess: () => Promise<ReadonlySet<string>>,
  audit: (name: ToolName, outcome: "success" | "failure") => Promise<void>,
): ToolSet {
  assertToolImplementations(tools);
  return Object.fromEntries(Object.entries(tools).filter(([name]) => toolAllowed(name, initialEnabled)).map(([name, definition]) => {
    const toolName = toolNameSchema.parse(name);
    const execute = definition.execute;
    return [name, { ...definition, execute: async (input: unknown, options: Parameters<NonNullable<typeof execute>>[1]) => {
      try {
        const enabled = await reloadAccess();
        if (!toolAllowed(name, enabled) || !execute) throw new Error("Capability unavailable");
        const schema = definition.inputSchema;
        if (!schema || !("parse" in schema) || typeof schema.parse !== "function") throw new Error("Invalid contract");
        const valid = schema.parse(input);
        const result = validateToolOutput(toolName, await execute(valid, options));
        await audit(toolName, "success");
        return result;
      } catch {
        await audit(toolName, "failure");
        throw new Error("Não foi possível executar esta capacidade. Confira os plugins e permissões e tente novamente.");
      }
    } }];
  }));
}
