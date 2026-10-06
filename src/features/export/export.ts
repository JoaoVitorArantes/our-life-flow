import { supabase } from "@/integrations/supabase/client";

/** Tables exported for the active workspace. RLS limits rows to what the signed-in person can read. */
export const EXPORT_TABLES = [
  ["contexts", "Contextos"],
  ["transactions", "Lançamentos"],
  ["transaction_splits", "Divisões"],
  ["transaction_payers", "Quem pagou"],
  ["accounts", "Contas"],
  ["cards", "Cartões"],
  ["card_invoice_payments", "Pagamentos de fatura"],
  ["categories", "Categorias"],
  ["installment_plans", "Parcelamentos"],
  ["recurring_transactions", "Recorrências"],
  ["loans", "Empréstimos"],
  ["financings", "Financiamentos"],
  ["settlements", "Acertos"],
  ["events", "Eventos"],
  ["tasks", "Tarefas"],
  ["notes", "Notas"],
  ["goals", "Metas"],
  ["goal_contributions", "Movimentações de metas"],
  ["purchases", "Compras"],
  ["physical_activities", "Atividades físicas"],
  ["routines", "Rotinas"],
  ["routine_logs", "Registros de rotina"],
] as const;

export type ExportTable = (typeof EXPORT_TABLES)[number][0];

async function fetchAll(table: ExportTable, workspaceId: string) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table as never)
      .select("*")
      .eq("workspace_id", workspaceId)
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as Record<string, unknown>[]));
    if (!data || data.length < 1000) return rows;
  }
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const columns = Object.keys(rows[0]!);
  const cell = (value: unknown) => {
    if (value === null || value === undefined) return "";
    const text = typeof value === "object" ? JSON.stringify(value) : String(value);
    return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [columns.join(","), ...rows.map((row) => columns.map((c) => cell(row[c])).join(","))].join(
    "\n",
  );
}

const stamp = () => new Date().toISOString().slice(0, 10);

export async function exportWorkspaceJson(workspaceId: string, workspaceName: string) {
  const data: Record<string, unknown> = {};
  for (const [table] of EXPORT_TABLES) data[table] = await fetchAll(table, workspaceId);
  const payload = {
    exported_at: new Date().toISOString(),
    workspace: { id: workspaceId, name: workspaceName },
    data,
  };
  download(`life-os-${stamp()}.json`, JSON.stringify(payload, null, 2), "application/json");
}

export async function exportTableCsv(workspaceId: string, table: ExportTable) {
  const rows = await fetchAll(table, workspaceId);
  download(`life-os-${table}-${stamp()}.csv`, "\uFEFF" + toCsv(rows), "text/csv;charset=utf-8");
  return rows.length;
}
