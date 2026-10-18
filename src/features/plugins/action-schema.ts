import { z } from "zod";
import { intentSchema, isoDateSchema } from "./contracts";

/** Uma ação interpretada. Campos irrelevantes ao intent vêm null. Schema estrito e plano. */
export const actionSchema = z
  .object({
    intent: intentSchema,
    description: z.string().max(2000),
    amount: z.number().finite().nonnegative().nullable(),
    date: isoDateSchema.nullable(),
    time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable(),
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
  })
  .strict();
