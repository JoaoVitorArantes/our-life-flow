import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText, type ModelMessage } from "ai";
import { z } from "zod";

const LOVABLE_AIG_RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

function createRunIdFetch() {
  let runId: string | undefined;
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (runId && !headers.has(LOVABLE_AIG_RUN_ID_HEADER))
      headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId);
    const response = await fetch(input, { ...init, headers });
    runId ??= response.headers.get(LOVABLE_AIG_RUN_ID_HEADER)?.trim() || undefined;
    return response;
  };
}

export { actionSchema } from "@/features/plugins/action-schema";
import { proposalInputSchema, normalizeProposal } from "@/features/plugins/action-schema";

export const interpretationSchema = z.object({
  question: z.string().nullable(),
  options: z.array(z.string()),
  actions: z.array(proposalInputSchema),
});
export type Interpretation = z.infer<typeof interpretationSchema>;

export async function interpret(
  system: string,
  messages: ModelMessage[],
  signal?: AbortSignal,
): Promise<Interpretation> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("A IA não está configurada.");
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: createRunIdFetch(),
  });
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    instructions: system,
    messages,
    ...(signal ? { abortSignal: signal } : {}),
    output: Output.object({ schema: interpretationSchema }),
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  try {
    // consome o stream no servidor e devolve só o objeto final
    for await (const _ of result.textStream) void _;
    const output = (await result.output) as Interpretation;
    return { ...output, actions: output.actions.map(normalizeProposal) };
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error) && error.text) {
      const parsed = interpretationSchema.safeParse(JSON.parse(error.text));
      if (parsed.success) return { ...parsed.data, actions: parsed.data.actions.map(normalizeProposal) };
    }
    throw error;
  }
}
