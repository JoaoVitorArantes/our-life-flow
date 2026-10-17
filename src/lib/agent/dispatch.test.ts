import { expect, test, vi } from "vitest";
import { tool } from "ai";
import { z } from "zod";
import { registerAgentTools } from "./dispatch";
import { TOOL_CONTRACTS } from "./contracts";

const options = { toolCallId: "test", messages: [], context: undefined };
test("only registered current tools can be exposed", () => {
  expect(() =>
    registerAgentTools(
      { arbitrary_url: tool({ inputSchema: z.object({}), execute: async () => 1 }) },
      async () => {},
    ),
  ).toThrow();
  expect(TOOL_CONTRACTS).toHaveLength(15);
  expect(TOOL_CONTRACTS.filter((t) => t.effect === "propose").map((t) => t.id)).toEqual([
    "propose_action",
  ]);
});
test("denied membership never executes a tool", async () => {
  const execute = vi.fn(async () => "data");
  const tools = registerAgentTools(
    { goals: tool({ inputSchema: z.object({}), execute }) },
    async () => {
      throw new Error("Acesso negado");
    },
  );
  await expect(tools.goals.execute?.({}, options)).rejects.toThrow("Acesso negado");
  expect(execute).not.toHaveBeenCalled();
});
test("invalid parameters fail before executing; valid parameters keep existing results", async () => {
  const execute = vi.fn(async ({ days }: { days: number }) => ({ days }));
  const authorize = vi.fn(async () => {});
  const tools = registerAgentTools(
    { upcoming_bills: tool({ inputSchema: z.object({ days: z.number() }), execute }) },
    authorize,
  );
  await expect(
    tools.upcoming_bills.execute?.({ days: "invalid" } as unknown as { days: number }, options),
  ).rejects.toThrow("Parâmetros inválidos");
  expect(execute).not.toHaveBeenCalled();
  await expect(tools.upcoming_bills.execute?.({ days: 30 }, options)).resolves.toEqual({
    days: 30,
  });
  expect(authorize).toHaveBeenCalledTimes(2);
});
