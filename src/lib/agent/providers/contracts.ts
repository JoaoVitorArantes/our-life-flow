import { z } from "zod";

export const providerIdSchema = z.enum(["lovable-ai", "openai", "gemini", "anthropic", "openrouter"]);
export type ProviderId = z.infer<typeof providerIdSchema>;
export const selectionSchema = z.object({
  provider: providerIdSchema,
  model: z.string().min(1).max(150),
  scope: z.enum(["shared", "personal"]),
  consent: z.object({
    userId: z.string().uuid(), workspaceId: z.string().uuid(),
    provider: providerIdSchema, model: z.string().min(1).max(150),
    accepted: z.literal(true),
  }).strict(),
}).strict();
export type ProviderSelection = z.infer<typeof selectionSchema>;
export type ModelChoice = { id: string; tools: boolean; text: boolean; streaming: boolean };
export type ProviderStatus = {
  id: ProviderId; name: string; configured: boolean;
  state: "pending_credentials" | "configured_unverified" | "catalog_error";
  models: ModelChoice[];
};
export const PROVIDER_NAMES: Record<ProviderId, string> = {
  "lovable-ai": "Lovable AI", openai: "OpenAI", gemini: "Gemini",
  anthropic: "Anthropic", openrouter: "OpenRouter",
};
/** Capability references: AI SDK provider documentation; not account availability or key validation. */
export const DOCUMENTED_MODELS: Record<Exclude<ProviderId, "openrouter">, ModelChoice[]> = {
  "lovable-ai": [{ id: "openai/gpt-6-astra", text: true, tools: true, streaming: true }],
  openai: [{ id: "gpt-6-astra", text: true, tools: true, streaming: true }],
  gemini: [{ id: "gemini-4-argon", text: true, tools: true, streaming: true }],
  anthropic: [{ id: "claude-sonnet-5", text: true, tools: true, streaming: true }],
};
export function eligibleModels(models: ModelChoice[]) {
  return models.filter((m) => m.text && m.tools && m.streaming);
}
export function validateSelection(selection: ProviderSelection, userId: string, workspaceId: string, catalog: ProviderStatus[]) {
  if (selection.scope !== "shared") throw new Error("Credenciais pessoais aguardam um cofre seguro por usuário.");
  const c = selection.consent;
  if (c.userId !== userId || c.workspaceId !== workspaceId || c.provider !== selection.provider || c.model !== selection.model || c.accepted !== true)
    throw new Error("Confirme o envio de dados para este provedor e modelo neste espaço.");
  const entry = catalog.find((p) => p.id === selection.provider);
  if (!entry?.configured) throw new Error("Credenciais compartilhadas pendentes para este espaço.");
  if (!eligibleModels(entry.models).some((m) => m.id === selection.model))
    throw new Error("Modelo não habilitado para texto, transmissão e ferramentas. Nenhum outro modelo foi usado.");
  return entry;
}