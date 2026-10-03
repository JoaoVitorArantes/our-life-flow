import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText, type ModelMessage } from "ai";
import { z } from "zod";

const LOVABLE_AIG_RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

function createRunIdFetch() {
  let runId: string | undefined;
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (runId && !headers.has(LOVABLE_AIG_RUN_ID_HEADER)) headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId);
    const response = await fetch(input, { ...init, headers });
    runId ??= response.headers.get(LOVABLE_AIG_RUN_ID_HEADER)?.trim() || undefined;
    return response;
  };
}

/** Uma ação interpretada. Campos irrelevantes ao intent vêm null. Schema estrito e plano. */
const actionSchema = z.object({
  intent: z.enum(["expense", "income", "task", "event", "note", "purchase", "activity", "goal"]),
  description: z.string(),
  amount: z.number().nullable(),
  date: z.string().nullable(),
  time: z.string().nullable(),
  card_id: z.string().nullable(),
  account_id: z.string().nullable(),
  category_id: z.string().nullable(),
  context_id: z.string().nullable(),
  installments: z.number().nullable(),
  shared: z.boolean(),
  payer_user_id: z.string().nullable(),
  my_share_percent: z.number().nullable(),
  content: z.string().nullable(),
  duration_minutes: z.number().nullable(),
  distance_km: z.number().nullable(),
  activity_type: z.string().nullable(),
  person_scope: z.string().nullable(),
  priority: z.string().nullable(),
  purchase_category: z.string().nullable(),
});

export const interpretationSchema = z.object({
  question: z.string().nullable(),
  options: z.array(z.string()),
  actions: z.array(actionSchema),
});
export type Interpretation = z.infer<typeof interpretationSchema>;

export async function interpret(system: string, messages: ModelMessage[], signal?: AbortSignal): Promise<Interpretation> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("A IA não está configurada.");
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: createRunIdFetch(),
  });
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    system,
    messages,
    abortSignal: signal,
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
    return (await result.output) as Interpretation;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error) && error.text) {
      const parsed = interpretationSchema.safeParse(JSON.parse(error.text));
      if (parsed.success) return parsed.data;
    }
    throw error;
  }
}
