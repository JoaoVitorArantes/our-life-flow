import {
  pluginSchema,
  toolNameSchema,
  intentSchema,
  type ToolName,
  type IntentName,
} from "./contracts";

export type PluginState =
  | "enabled"
  | "disabled"
  | "connected"
  | "not_connected"
  | "permission_required"
  | "coming_soon"
  | "error";
export type Plugin = {
  id: string;
  name: string;
  description: string;
  category: "internal" | "external";
  tools: readonly ToolName[];
  intents: readonly IntentName[];
  dependencies: readonly string[];
  scopes: readonly string[];
  access: "read" | "read_write";
  confirmationRequired: boolean;
  defaultEnabled: boolean;
  connection: "internal" | "not_connected" | "coming_soon";
  configuration: Record<string, never>;
};
const internal = (
  id: string,
  name: string,
  description: string,
  tools: ToolName[],
  intents: IntentName[] = [],
  dependencies: string[] = [],
): Plugin => ({
  id,
  name,
  description,
  category: "internal",
  tools,
  intents,
  dependencies,
  scopes: ["workspace:member", ...(id === "workspace" ? ["workspace:manage"] : [])],
  access: intents.length ? "read_write" : "read",
  confirmationRequired: intents.length > 0,
  defaultEnabled: true,
  connection: "internal",
  configuration: {},
});
const external = (id: string, name: string, description: string, scopes: string[]): Plugin => ({
  id,
  name,
  description,
  category: "external",
  tools: [],
  intents: [],
  dependencies: [],
  scopes,
  access: "read",
  confirmationRequired: true,
  defaultEnabled: false,
  connection: "not_connected",
  configuration: {},
});
const definitions: readonly Plugin[] = [
  internal(
    "finance",
    "Financeiro",
    "Dinheiro Livre, despesas, receitas, cartões, parcelas e saldo compartilhado.",
    [
      "financial_overview",
      "transactions_summary",
      "monthly_trend",
      "cards_status",
      "upcoming_bills",
      "installments",
      "nos_balance",
    ],
    ["expense", "income"],
  ),
  internal(
    "agenda",
    "Agenda",
    "Compromissos, recorrências e rotinas no período consultado.",
    ["agenda"],
    ["event"],
    ["routines"],
  ),
  internal(
    "tasks",
    "Tarefas",
    "Prazos, pendências e novas tarefas com confirmação.",
    ["tasks"],
    ["task"],
  ),
  internal(
    "goals",
    "Metas",
    "Progresso, valores e prazos dos seus objetivos.",
    ["goals"],
    ["goal"],
  ),
  internal(
    "contexts",
    "Contextos",
    "Viagens e projetos com orçamento e despesas vinculadas.",
    ["contexts"],
    [],
    ["finance"],
  ),
  internal(
    "purchases",
    "Compras",
    "Lista de desejos, prioridades e orçamento planejado.",
    ["purchases"],
    ["purchase"],
  ),
  internal("routines", "Rotinas", "Hábitos e check-ins do dia, sem duplicar a agenda.", [
    "routines_today",
  ]),
  internal(
    "activities",
    "Esporte",
    "Atividades, duração e distância, com novos registros confirmados.",
    ["activities"],
    ["activity"],
  ),
  internal("notes", "Notas", "Novas anotações a partir de uma prévia confirmada.", [], ["note"]),
  internal(
    "workspace",
    "Meu espaço",
    "Propor um novo nome para o espaço, respeitando suas permissões.",
    [],
    ["rename_workspace"],
  ),
  external(
    "google_calendar",
    "Google Calendar",
    "Agenda externa pessoal. Requer um cliente OAuth configurado e consentimento individual; ainda indisponível neste app.",
    ["calendar.events.readonly"],
  ),
  external(
    "google_mail",
    "Gmail",
    "E-mail pessoal. Requer configuração e autorização individual separadas do login Google; ainda indisponível neste app.",
    ["gmail.readonly"],
  ),
  external(
    "google_sheets",
    "Google Sheets",
    "Planilhas pessoais. Requer configuração e autorização individual; ainda indisponível neste app.",
    ["spreadsheets.readonly"],
  ),
];
export function validateRegistry(plugins: readonly Plugin[]) {
  const ids = new Set(plugins.map((p) => p.id));
  if (ids.size !== plugins.length) throw new Error("Duplicate plugin id");
  for (const p of plugins) {
    pluginSchema.parse(p);
    if (p.dependencies.some((id) => !ids.has(id) || id === p.id))
      throw new Error("Invalid dependency");
  }
  const tools = plugins.flatMap((p) => p.tools);
  const intents = plugins.flatMap((p) => p.intents);
  if (new Set(tools).size !== tools.length || new Set(intents).size !== intents.length)
    throw new Error("Duplicate capability mapping");
  const expected = toolNameSchema.options.filter((n) => n !== "propose_action");
  if (
    expected.some((n) => !tools.includes(n)) ||
    intentSchema.options.some((n) => !intents.includes(n))
  )
    throw new Error("Missing capability mapping");
}
validateRegistry(definitions);
export const PLUGINS = definitions;
export function pluginForTool(name: string) {
  return PLUGINS.find((p) => p.tools.some((n) => n === name));
}
export type Preference = { plugin_id: string; enabled: boolean };
export function enabledIds(rows: readonly Preference[]): Set<string> {
  const states = new Map(rows.map((r) => [r.plugin_id, r.enabled]));
  return new Set(
    PLUGINS.filter((p) => p.category === "internal" && (states.get(p.id) ?? p.defaultEnabled)).map(
      (p) => p.id,
    ),
  );
}
export function pluginForIntent(intent: string) {
  return PLUGINS.find((p) => p.intents.some((n) => n === intent));
}
export function intentAllowed(intent: string, enabled: ReadonlySet<string>): boolean {
  const plugin = pluginForIntent(intent);
  return !!plugin && enabled.has(plugin.id) && plugin.dependencies.every((id) => enabled.has(id));
}
export function toolAllowed(name: string, enabled: ReadonlySet<string>): boolean {
  if (name === "propose_action")
    return PLUGINS.some((p) => enabled.has(p.id) && p.intents.length > 0);
  const plugin = PLUGINS.find((p) => p.tools.some((n) => n === name));
  return !!plugin && enabled.has(plugin.id) && plugin.dependencies.every((id) => enabled.has(id));
}

export function catalogState(
  p: Plugin,
  enabled: ReadonlySet<string>,
  preferences: readonly Preference[],
): PluginState {
  if (p.category === "external")
    return p.connection === "coming_soon" ? "coming_soon" : "not_connected";
  const requested = preferences.find((r) => r.plugin_id === p.id)?.enabled ?? p.defaultEnabled;
  if (!requested) return "disabled";
  if (!enabled.has(p.id) || p.dependencies.some((id) => !enabled.has(id)))
    return "permission_required";
  return "enabled";
}
