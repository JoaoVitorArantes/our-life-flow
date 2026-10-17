import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { type ProviderSelection, validateSelection } from "./contracts";
import { providerCatalog, readCredential } from "./catalog.server";
import { createLovableAiGatewayRunIdFetch } from "./run-id.server";

export async function resolveProvider(selection: ProviderSelection, userId: string, workspaceId: string) {
  validateSelection(selection, userId, workspaceId, await providerCatalog(workspaceId));
  const apiKey = readCredential(selection.provider, workspaceId);
  if (!apiKey) throw new Error("Credenciais pendentes. Nenhum outro provedor foi usado.");
  const { provider: id, model } = selection;
  if (id === "lovable-ai") {
    const provider = createOpenAI({ baseURL: "https://ai.gateway.lovable.dev/v1", apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: createLovableAiGatewayRunIdFetch().fetch });
    return { model: provider.responses(model), providerOptions: { openai: {
      forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false,
      include: ["reasoning.encrypted_content"],
    } } };
  }
  if (id === "openai") return { model: createOpenAI({ apiKey }).responses(model), providerOptions: { openai: { store: false, reasoningEffort: "low", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] } } };
  if (id === "gemini") return { model: createGoogleGenerativeAI({ apiKey })(model), providerOptions: {} };
  if (id === "anthropic") return { model: createAnthropic({ apiKey })(model), providerOptions: {} };
  return { model: createOpenAICompatible({ name: "openrouter", baseURL: "https://openrouter.ai/api/v1", apiKey, fetch: async (input, init) => {
    // Enforce a single provider route, no silent OpenRouter fallback.
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    return fetch(input, body ? { ...init, body: JSON.stringify({ ...body, provider: { allow_fallbacks: false, require_parameters: true } }) } : init);
  } }).chatModel(model), providerOptions: {} };
}