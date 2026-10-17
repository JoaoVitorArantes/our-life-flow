import type { ToolSet } from "ai";
import { z } from "zod";
import { toolIdSchema } from "./contracts";

/** Receives authorization from the authenticated server caller, never from model arguments. */
export function registerAgentTools<T extends ToolSet>(
  definitions: T,
  authorize: () => Promise<void>,
): T {
  return Object.fromEntries(Object.entries(definitions).map(([name, definition]) => {
    toolIdSchema.parse(name);
    const schema = definition.inputSchema;
    const execute = definition.execute;
    if (!(schema instanceof z.ZodType) || !execute) {
      throw new Error("Ferramenta interna sem contrato válido.");
    }
    return [name, {
      ...definition,
      execute: async (input: unknown, options: Parameters<typeof execute>[1]) => {
        await authorize();
        const parsed = schema.safeParse(input);
        if (!parsed.success) throw new Error("Parâmetros inválidos para esta consulta.");
        return execute(parsed.data, options);
      },
    }];
  })) as T;
}