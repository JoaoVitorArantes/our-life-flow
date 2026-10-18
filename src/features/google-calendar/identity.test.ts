import { expect, test, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { activeIdentity } from "./connection.server";

function client(member: boolean, workspace: string | null = "casal") {
  const filters: unknown[][] = [];
  const from = vi.fn((table: string) => {
    const result = table === "profiles"
      ? { data: { active_workspace_id: workspace }, error: null }
      : { data: member ? { user_id: "joao" } : null, error: null };
    const chain = {
      select: () => chain,
      eq: (...args: unknown[]) => { filters.push(args); return chain; },
      single: async () => result,
      maybeSingle: async () => result,
    };
    return chain;
  });
  return { sb: { from } as unknown as SupabaseClient<Database>, from, filters };
}
test("resolve usuário da sessão e workspace do perfil, conferindo membership", async () => {
  const { sb, filters } = client(true);
  expect(await activeIdentity(sb, "joao")).toEqual({ userId: "joao", workspaceId: "casal" });
  expect(filters).toContainEqual(["user_id", "joao"]);
  expect(filters).toContainEqual(["workspace_id", "casal"]);
});
test("não-membro não pode começar nem concluir conexão no espaço", async () => {
  const { sb } = client(false);
  await expect(activeIdentity(sb, "renifer")).rejects.toThrow("não está disponível");
});
test("sem workspace ativo bloqueia antes de conferir membership", async () => {
  const { sb, from } = client(true, null);
  await expect(activeIdentity(sb, "joao")).rejects.toThrow("Selecione um espaço");
  expect(from).toHaveBeenCalledTimes(1);
});