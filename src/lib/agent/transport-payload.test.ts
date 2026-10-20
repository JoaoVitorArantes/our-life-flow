import { expect, test } from "vitest";
import { DefaultChatTransport, type UIMessage } from "ai";
import { agentBodySchema, currentUserMessage } from "./history";

/**
 * Captura o corpo REAL que o DefaultChatTransport da versão instalada do AI SDK
 * envia para /api/agent. O fetch stub apenas registra o body e falha depois —
 * o objetivo é provar o formato do envelope, não a resposta.
 */
async function captureRealPayload() {
  let captured: unknown;
  const transport = new DefaultChatTransport({
    api: "/api/agent",
    body: { threadId: crypto.randomUUID(), pageContext: "/dashboard" },
    fetch: async (_input, init) => {
      captured = JSON.parse(String(init?.body));
      return new Response("erro proposital após captura", { status: 500 });
    },
  });
  const messages: UIMessage[] = [
    { id: "m1", role: "user", parts: [{ type: "text", text: "oi" }] },
  ];
  await expect(
    transport.sendMessages({
      chatId: "chat-1",
      messages,
      trigger: "submit-message",
      messageId: "m1",
      abortSignal: new AbortController().signal,
    }),
  ).rejects.toThrow();
  return captured;
}

test("o payload real do SDK instalado é aceito pelo contrato do endpoint", async () => {
  const captured = (await captureRealPayload()) as Record<string, unknown>;
  // Envelope comprovado: além de threadId/pageContext/messages, o SDK envia id, trigger e messageId.
  expect(captured).toHaveProperty("id");
  expect(captured).toHaveProperty("trigger", "submit-message");
  expect(captured).toHaveProperty("messageId", "m1");
  expect(captured).toHaveProperty("threadId");
  expect(agentBodySchema.safeParse(captured).success).toBe(true);
});

test("mensagem simples 'oi' passa pela validação completa", () => {
  const body = {
    threadId: crypto.randomUUID(),
    messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "oi" }] }],
  };
  const parsed = agentBodySchema.parse(body);
  const current = currentUserMessage(parsed.messages);
  expect(current.parts).toEqual([{ type: "text", text: "oi" }]);
});

test("campos desconhecidos continuam rejeitados (contrato estrito)", () => {
  const body = {
    threadId: crypto.randomUUID(),
    messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "oi" }] }],
    workspaceId: "forjado",
  };
  expect(agentBodySchema.safeParse(body).success).toBe(false);
});

test("envelope com valores inválidos é rejeitado", () => {
  const base = {
    threadId: crypto.randomUUID(),
    messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "oi" }] }],
  };
  expect(agentBodySchema.safeParse({ ...base, id: 123 }).success).toBe(false);
  expect(agentBodySchema.safeParse({ ...base, trigger: "inject" }).success).toBe(false);
  expect(agentBodySchema.safeParse({ ...base, threadId: "nao-uuid" }).success).toBe(false);
  expect(agentBodySchema.safeParse({ ...base, messages: [] }).success).toBe(false);
});
