import { z } from "zod";
import { isoDateSchema } from "@/features/plugins/contracts";
import { contextSchema } from "./validation";

/** Optional edits preserve existing fields; explicit null clears only nullable fields. */
export const contextProposalSchema = z.object({
  type: z.enum(["EVENT", "TRIP", "PROJECT", "COLLEGE", "PERSONAL", "COUPLE", "OTHER"]).optional(),
  status: z.enum(["PLANNED", "ACTIVE", "COMPLETED", "ARCHIVED"]).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  start_date: isoDateSchema.nullable().optional(),
  end_date: isoDateSchema.nullable().optional(),
  location: z.string().trim().max(500).nullable().optional(),
  budget_amount: z.number().finite().nonnegative().nullable().optional(),
  visibility: z.enum(["PRIVATE", "SHARED"]).optional(),
}).strict();

export const CONTEXT_DEFAULTS = { type: "PERSONAL", status: "ACTIVE", visibility: "SHARED" } as const;
export const CONTEXT_INTENTS = ["create_context", "update_context", "archive_context", "delete_context"] as const;
export function isContextIntent(intent: string) {
  return CONTEXT_INTENTS.some((i) => i === intent);
}
export function contextCreateInput(name: string, fields?: z.infer<typeof contextProposalSchema> | null) {
  return contextSchema.parse({ ...CONTEXT_DEFAULTS, ...fields, name });
}