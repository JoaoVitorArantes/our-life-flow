import { z } from "zod";

/** Provider generates responses; it is neither a data connection nor an executable tool. */
export const CURRENT_PROVIDER = {
  id: "lovable-ai",
  model: "openai/gpt-6-astra",
  protocol: "responses",
  execution: "server",
} as const;

/** Future connectors carry non-secret capabilities, never tokens or account credentials. */
export type ConnectorContract = {
  id: string;
  mode: "workspace" | "app_user";
  state: "not_configured" | "consent_required" | "connected";
  scopes: readonly string[];
};

export const toolIdSchema = z.enum([
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
export type AgentToolId = z.infer<typeof toolIdSchema>;
export type ToolContract = {
  id: AgentToolId;
  source: "life_os";
  permission: "workspace_member_rls";
  effect: "read" | "propose";
  confirmation: "none" | "existing_client_flow";
  externalConsent: "not_applicable";
};

export const TOOL_CONTRACTS: readonly ToolContract[] = toolIdSchema.options.map((id) => ({
  id,
  source: "life_os",
  permission: "workspace_member_rls",
  effect: id === "propose_action" ? "propose" : "read",
  confirmation: id === "propose_action" ? "existing_client_flow" : "none",
  externalConsent: "not_applicable",
}));
