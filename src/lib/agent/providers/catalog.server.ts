import { z } from "zod";
import {
  DOCUMENTED_MODELS,
  eligibleModels,
  PROVIDER_NAMES,
  providerIdSchema,
  type ProviderId,
  type ProviderStatus,
} from "./contracts";

const envPrefixes: Record<Exclude<ProviderId, "lovable-ai">, string> = {
  openai: "LIFE_AI_OPENAI",
  gemini: "LIFE_AI_GEMINI",
  anthropic: "LIFE_AI_ANTHROPIC",
  openrouter: "LIFE_AI_OPENROUTER",
};
/** Shared secrets are assigned to one workspace; no global custom-key fallback. */
export function credentialName(provider: Exclude<ProviderId, "lovable-ai">, workspaceId: string) {
  z.string().uuid().parse(workspaceId);
  return `${envPrefixes[provider]}_${workspaceId.replaceAll("-", "_")}_API_KEY`;
}
export function readCredential(provider: ProviderId, workspaceId: string) {
  return process.env[
    provider === "lovable-ai" ? "LOVABLE_API_KEY" : credentialName(provider, workspaceId)
  ];
}
export async function providerCatalog(workspaceId: string): Promise<ProviderStatus[]> {
  const entries: ProviderStatus[] = [];
  for (const id of providerIdSchema.options) {
    const configured = Boolean(readCredential(id, workspaceId));
    let models = id === "openrouter" ? [] : eligibleModels(DOCUMENTED_MODELS[id]);
    let state: ProviderStatus["state"] = configured
      ? "configured_unverified"
      : "pending_credentials";
    if (id === "openrouter" && configured) {
      try {
        // Fixed public model metadata endpoint; no user data or credentials are sent.
        const response = await fetch("https://openrouter.ai/api/v1/models");
        if (!response.ok) throw new Error("Catalog unavailable");
        const body = (await response.json()) as {
          data?: {
            id?: unknown;
            supported_parameters?: unknown;
            architecture?: { input_modalities?: unknown; output_modalities?: unknown };
          }[];
        };
        models = (body.data ?? [])
          .filter(
            (m) =>
              typeof m.id === "string" &&
              Array.isArray(m.supported_parameters) &&
              m.supported_parameters.includes("tools") &&
              Array.isArray(m.architecture?.output_modalities) &&
              m.architecture.output_modalities.includes("text") &&
              Array.isArray(m.architecture?.input_modalities) &&
              m.architecture.input_modalities.includes("text"),
          )
          .map((m) => ({ id: String(m.id), tools: true, text: true, streaming: true }));
      } catch {
        state = "catalog_error";
      }
    }
    entries.push({ id, name: PROVIDER_NAMES[id], configured, state, models });
  }
  return entries;
}
