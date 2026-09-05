import { supabase } from "@/integrations/supabase/client";
import { toDateInput } from "@/lib/format";

/**
 * Demo data is always flagged with is_demo = true so it can be removed
 * without touching real records.
 */
export async function seedDemoData(workspaceId: string, ownerId: string) {
  const { data: existing } = await supabase
    .from("accounts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("is_demo", true)
    .limit(1);
  if (existing?.length) return { skipped: true as const };

  const { data: accounts, error: accountsError } = await supabase
    .from("accounts")
    .insert([
      {
        workspace_id: workspaceId,
        owner_id: ownerId,
        name: "Nubank",
        institution: "Nubank",
        account_type: "CHECKING" as const,
        initial_balance: 3200,
        visibility: "SHARED" as const,
        is_demo: true,
      },
      {
        workspace_id: workspaceId,
        owner_id: ownerId,
        name: "Mercado Pago",
        institution: "Mercado Pago",
        account_type: "CHECKING" as const,
        initial_balance: 850,
        visibility: "SHARED" as const,
        is_demo: true,
      },
    ])
    .select("*");
  if (accountsError) throw accountsError;

  const nubank = accounts?.[0];

  const { error: cardError } = await supabase.from("cards").insert({
    workspace_id: workspaceId,
    owner_id: ownerId,
    name: "Nubank",
    institution: "Nubank",
    credit_limit: 5000,
    closing_day: 3,
    due_day: 10,
    payment_account_id: nubank?.id ?? null,
    visibility: "SHARED" as const,
    is_demo: true,
  });
  if (cardError) throw cardError;

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .eq("workspace_id", workspaceId);
  const byName = (name: string) => categories?.find((c) => c.name === name)?.id ?? null;

  const today = new Date();
  const day = (offset: number) => {
    const date = new Date(today);
    date.setDate(date.getDate() + offset);
    return toDateInput(date);
  };

  const { error: txError } = await supabase.from("transactions").insert([
    {
      workspace_id: workspaceId,
      owner_id: ownerId,
      type: "INCOME" as const,
      amount: 6200,
      description: "Salário",
      transaction_date: day(-10),
      category_id: byName("Salário"),
      account_id: nubank?.id ?? null,
      visibility: "PRIVATE" as const,
      is_demo: true,
    },
    {
      workspace_id: workspaceId,
      owner_id: ownerId,
      type: "EXPENSE" as const,
      amount: 32.9,
      description: "Almoço",
      transaction_date: day(-1),
      category_id: byName("Alimentação"),
      account_id: nubank?.id ?? null,
      visibility: "PRIVATE" as const,
      is_demo: true,
    },
    {
      workspace_id: workspaceId,
      owner_id: ownerId,
      type: "EXPENSE" as const,
      amount: 1450,
      description: "Aluguel",
      transaction_date: day(-5),
      category_id: byName("Moradia"),
      account_id: nubank?.id ?? null,
      visibility: "SHARED" as const,
      is_shared: true,
      is_demo: true,
    },
    {
      workspace_id: workspaceId,
      owner_id: ownerId,
      type: "EXPENSE" as const,
      amount: 200,
      description: "Jantar do casal",
      transaction_date: day(-2),
      category_id: byName("Casal"),
      account_id: accounts?.[1]?.id ?? null,
      visibility: "SHARED" as const,
      is_shared: true,
      is_demo: true,
    },
  ]);
  if (txError) throw txError;

  const startOfDay = (hour: number) => {
    const date = new Date(today);
    date.setHours(hour, 0, 0, 0);
    return date.toISOString();
  };

  await supabase.from("events").insert([
    {
      workspace_id: workspaceId,
      owner_id: ownerId,
      title: "Aula de Cálculo",
      starts_at: startOfDay(19),
      ends_at: startOfDay(21),
      visibility: "PRIVATE" as const,
      is_demo: true,
    },
    {
      workspace_id: workspaceId,
      owner_id: ownerId,
      title: "Cinema com a Renifer",
      starts_at: startOfDay(22),
      visibility: "SHARED" as const,
      is_demo: true,
    },
  ]);

  await supabase.from("tasks").insert([
    {
      workspace_id: workspaceId,
      owner_id: ownerId,
      title: "Entregar trabalho de Estatística",
      due_date: day(3),
      visibility: "PRIVATE" as const,
      is_demo: true,
    },
    {
      workspace_id: workspaceId,
      owner_id: ownerId,
      title: "Pagar fatura do Nubank",
      due_date: day(6),
      visibility: "SHARED" as const,
      is_demo: true,
    },
  ]);

  await supabase.from("goals").insert([
    {
      workspace_id: workspaceId,
      owner_id: ownerId,
      title: "Reserva de emergência",
      target_amount: 15000,
      current_amount: 4200,
      visibility: "SHARED" as const,
      is_demo: true,
    },
    {
      workspace_id: workspaceId,
      owner_id: ownerId,
      title: "Viagem em julho",
      target_amount: 6000,
      current_amount: 900,
      visibility: "SHARED" as const,
      is_demo: true,
    },
  ]);

  return { skipped: false as const };
}

export async function clearDemoData(workspaceId: string) {
  const tables = ["transactions", "events", "tasks", "goals", "notes", "cards", "accounts"] as const;
  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("is_demo", true);
    if (error) throw error;
  }
}
