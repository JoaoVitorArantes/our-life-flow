import { z } from "zod";

export const intentSchema = z.enum([
  "expense",
  "income",
  "task",
  "event",
  "note",
  "purchase",
  "activity",
  "goal",
  "rename_workspace",
]);
export const toolNameSchema = z.enum([
  "financial_overview",
  "transactions_summary",
  "monthly_trend",
  "cards_status",
  "upcoming_bills",
  "installments",
  "nos_balance",
  "goals",
  "tasks",
  "agenda",
  "activities",
  "purchases",
  "routines_today",
  "contexts",
  "propose_action",
]);
export type ToolName = z.infer<typeof toolNameSchema>;
export type IntentName = z.infer<typeof intentSchema>;

export const pluginSchema = z
  .object({
    id: z.string().regex(/^[a-z_]{1,80}$/),
    name: z.string().min(1).max(80),
    description: z.string().min(1).max(500),
    category: z.enum(["internal", "external"]),
    tools: z.array(toolNameSchema),
    intents: z.array(intentSchema),
    dependencies: z.array(z.string()),
    scopes: z.array(z.string()),
    access: z.enum(["read", "read_write"]),
    confirmationRequired: z.boolean(),
    defaultEnabled: z.boolean(),
    connection: z.enum(["internal", "not_connected", "coming_soon"]),
    configuration: z.object({}).strict(),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (p.intents.length && (!p.confirmationRequired || p.access !== "read_write"))
      ctx.addIssue({ code: "custom", message: "Write intents require confirmation" });
    if (
      p.category === "external" &&
      (p.tools.length || p.intents.length || p.defaultEnabled || p.connection === "internal")
    )
      ctx.addIssue({ code: "custom", message: "Unavailable external capabilities cannot execute" });
    if (p.category === "internal" && p.connection !== "internal")
      ctx.addIssue({ code: "custom", message: "Internal capabilities are not connectors" });
  });

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T12:00:00Z`);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, "Data inválida");
const range = z.object({ from: isoDateSchema, to: isoDateSchema }).strict();
const ordered = (q: { from: string; to: string }) => q.from <= q.to;
const empty = z.object({}).strict();
const text = z.string().max(200).nullable();
export const readInputSchemas = {
  financial_overview: z.object({ horizon_days: z.number().int().min(1).max(365) }).strict(),
  transactions_summary: range
    .extend({
      type: z.enum(["EXPENSE", "INCOME", "ALL"]),
      category: text,
      person_id: z.string().uuid().nullable(),
      search: text,
      status: z.enum(["PAID", "OPEN", "ANY"]),
    })
    .refine(ordered, "Período inválido"),
  monthly_trend: z
    .object({
      type: z.enum(["EXPENSE", "INCOME"]),
      months: z.number().int().min(2).max(24),
      category: text,
    })
    .strict(),
  cards_status: empty,
  upcoming_bills: z.object({ days: z.number().int().min(1).max(180) }).strict(),
  installments: empty,
  nos_balance: range.refine(ordered, "Período inválido"),
  goals: empty,
  tasks: z.object({ scope: z.enum(["overdue", "today", "upcoming", "open"]) }).strict(),
  agenda: range.refine(ordered, "Período inválido"),
  activities: range.refine(ordered, "Período inválido"),
  purchases: z.object({ include_done: z.boolean() }).strict(),
  routines_today: z.object({ date: isoDateSchema }).strict(),
  contexts: empty,
} satisfies Record<Exclude<ToolName, "propose_action">, z.ZodTypeAny>;

// Outputs are JSON DTOs, never executable objects or nonfinite numbers.
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export const jsonValueSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema),
  ]),
);
export const toolFailureSchema = z.object({ error: z.string().min(1).max(300) }).strict();
export function isToolFailure(value: unknown): boolean {
  return toolFailureSchema.safeParse(value).success;
}
export function validateToolOutput(name: ToolName, output: unknown): unknown {
  if (isToolFailure(output)) throw new Error("Não foi possível consultar esta capacidade.");
  const json = jsonValueSchema.parse(
    JSON.parse(
      JSON.stringify(output, (_key, value: unknown) => {
        if (typeof value === "number" && !Number.isFinite(value))
          throw new Error("Nonfinite output");
        if (typeof value === "function" || typeof value === "bigint")
          throw new Error("Non-JSON output");
        return value;
      }),
    ),
  );
  const arrayTools: ToolName[] = [
    "cards_status",
    "installments",
    "goals",
    "routines_today",
    "contexts",
  ];
  if (
    arrayTools.includes(name)
      ? !Array.isArray(json)
      : json === null || typeof json !== "object" || Array.isArray(json)
  )
    throw new Error("Resultado inválido da capacidade.");
  if (name === "tasks")
    return z.object({
      quantidade: z.number().int().nonnegative(),
      tarefas: z.array(z.object({
        titulo: z.string(), prazo: isoDateSchema.nullable(), status: z.string(),
        de: z.string().optional(),
      }).strict()),
    }).strict().parse(json);
  return json;
}
