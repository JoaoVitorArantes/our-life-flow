import { z } from "zod";
import { readInputSchemas, toolNameSchema, type ToolName } from "./contracts";
import { actionSchema } from "./action-schema";
import { PLUGINS, intentAllowed, toolAllowed } from "./registry";

const metadataSchema = z
  .object({
    id: toolNameSchema,
    name: z.string().min(1),
    description: z.string().min(1),
    version: z.literal(1),
    operation: z.enum(["read", "proposal"]),
    risk: z.enum(["low", "confirmation_required"]),
    scope: z.literal("authenticated_workspace"),
    confirmationRequired: z.boolean(),
    result: z.enum(["domain_data", "unpersisted_preview"]),
  })
  .strict();

const labels: Record<ToolName, [string, string]> = {
  financial_overview: ["Dinheiro Livre", "Saldo e projeção pelo cálculo do Financeiro."],
  transactions_summary: [
    "Lançamentos por período",
    "Totais, categorias e pessoas nos lançamentos acessíveis.",
  ],
  monthly_trend: ["Comparação mensal", "Evolução de receitas ou despesas."],
  cards_status: ["Cartões e faturas", "Situação dos cartões e compromissos."],
  upcoming_bills: ["Próximas contas", "Vencimentos no período solicitado."],
  installments: ["Parcelas", "Planos de parcelamento existentes."],
  nos_balance: ["Saldo do Nós", "Despesas divididas e acertos do espaço."],
  goals: ["Progresso das metas", "Objetivos, valores e prazos."],
  tasks: ["Tarefas pendentes", "Tarefas abertas, atrasadas ou com prazo próximo."],
  agenda: ["Agenda do período", "Compromissos, recorrências e rotinas derivadas."],
  activities: ["Atividades físicas", "Treinos, duração e distância registrados."],
  purchases: ["Compras planejadas", "Itens, prioridades e orçamento."],
  routines_today: ["Rotinas do dia", "Ocorrências derivadas e check-ins existentes."],
  contexts: ["Contextos e orçamento", "Viagens e projetos com despesas vinculadas."],
  propose_action: [
    "Prévia de registro",
    "Prepara uma ação sem gravar; exige confirmação explícita.",
  ],
};

export const CAPABILITIES = toolNameSchema.options.map((id) =>
  metadataSchema.parse({
    id,
    name: labels[id][0],
    description: labels[id][1],
    version: 1,
    operation: id === "propose_action" ? "proposal" : "read",
    risk: id === "propose_action" ? "confirmation_required" : "low",
    scope: "authenticated_workspace",
    confirmationRequired: id === "propose_action",
    result: id === "propose_action" ? "unpersisted_preview" : "domain_data",
  }),
);

export function discoverCapabilities(enabled: ReadonlySet<string>) {
  return CAPABILITIES.filter((c) => toolAllowed(c.id, enabled)).map((c) => ({
    ...c,
    domains: PLUGINS.filter(
      (p) =>
        p.tools.includes(c.id) ||
        (c.id === "propose_action" && p.intents.some((i) => intentAllowed(i, enabled))),
    ).map((p) => p.id),
    intents:
      c.id === "propose_action"
        ? PLUGINS.flatMap((p) => p.intents).filter((i) => intentAllowed(i, enabled))
        : [],
  }));
}

export function capabilityInput(id: ToolName) {
  return id === "propose_action" ? actionSchema : readInputSchemas[id];
}

export const INTENT_LABELS = {
  expense: "Nova despesa",
  income: "Nova receita",
  task: "Nova tarefa",
  event: "Novo compromisso",
  note: "Nova nota",
  purchase: "Nova compra planejada",
  activity: "Nova atividade",
  goal: "Nova meta",
  rename_workspace: "Renomear espaço",
} satisfies Record<z.infer<typeof actionSchema>["intent"], string>;
