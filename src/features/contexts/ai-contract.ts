import { z } from "zod";
import { isoDateSchema } from "@/features/plugins/contracts";
import { contextSchema } from "./validation";

/** Optional edits preserve existing fields; explicit null clears only nullable fields. */
export const contextProposalSchema = z
  .object({
    type: z.enum(["EVENT", "TRIP", "PROJECT", "COLLEGE", "PERSONAL", "COUPLE", "OTHER"]).optional(),
    status: z.enum(["PLANNED", "ACTIVE", "COMPLETED", "ARCHIVED"]).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    start_date: isoDateSchema.nullable().optional(),
    end_date: isoDateSchema.nullable().optional(),
    location: z.string().trim().max(500).nullable().optional(),
    budget_amount: z.number().finite().nonnegative().nullable().optional(),
    visibility: z.enum(["PRIVATE", "SHARED"]).optional(),
  })
  .strict();

/** Strict model wire contract: null means omitted; clear_fields is explicit. */
export const contextWireSchema = z
  .object({
    type: z.enum(["EVENT", "TRIP", "PROJECT", "COLLEGE", "PERSONAL", "COUPLE", "OTHER"]).nullable(),
    status: z.enum(["PLANNED", "ACTIVE", "COMPLETED", "ARCHIVED"]).nullable(),
    description: z.string().max(5000).nullable(),
    start_date: isoDateSchema.nullable(),
    end_date: isoDateSchema.nullable(),
    location: z.string().max(500).nullable(),
    budget_amount: z.number().finite().nonnegative().nullable(),
    visibility: z.enum(["PRIVATE", "SHARED"]).nullable(),
    clear_fields: z.array(
      z.enum(["description", "start_date", "end_date", "location", "budget_amount"]),
    ),
  })
  .strict();
export function normalizeContextWire(data: z.infer<typeof contextWireSchema> | null) {
  if (!data) return null;
  const { clear_fields, ...fields } = data;
  return contextProposalSchema.parse({
    ...Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== null)),
    ...Object.fromEntries(clear_fields.map((key) => [key, null])),
  });
}

export const CONTEXT_DEFAULTS = {
  type: "PERSONAL",
  status: "ACTIVE",
  visibility: "SHARED",
} as const;
export const CONTEXT_INTENTS = [
  "create_context",
  "update_context",
  "archive_context",
  "delete_context",
] as const;
export function isContextIntent(intent: string) {
  return CONTEXT_INTENTS.some((i) => i === intent);
}
export function contextCreateInput(
  name: string,
  fields?: z.infer<typeof contextProposalSchema> | null,
) {
  return contextSchema.parse({ ...CONTEXT_DEFAULTS, ...fields, name });
}
