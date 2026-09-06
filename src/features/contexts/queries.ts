import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, Enums } from "@/integrations/supabase/types";

export type Context = Tables<"contexts">;
export type ContextType = Enums<"context_type">;
export type ContextStatus = Enums<"context_status">;

export const CONTEXT_TYPES: { value: ContextType; label: string; emoji: string }[] = [
  { value: "EVENT", label: "Evento", emoji: "🎉" },
  { value: "TRIP", label: "Viagem", emoji: "✈️" },
  { value: "PROJECT", label: "Projeto", emoji: "🛠️" },
  { value: "COLLEGE", label: "Faculdade", emoji: "🎓" },
  { value: "PERSONAL", label: "Pessoal", emoji: "🌱" },
  { value: "COUPLE", label: "Casal", emoji: "❤️" },
  { value: "OTHER", label: "Outro", emoji: "📌" },
];

export const CONTEXT_STATUSES: { value: ContextStatus; label: string }[] = [
  { value: "PLANNED", label: "Planejado" },
  { value: "ACTIVE", label: "Ativo" },
  { value: "COMPLETED", label: "Concluído" },
  { value: "ARCHIVED", label: "Arquivado" },
];

export function contextEmoji(type: ContextType) {
  return CONTEXT_TYPES.find((item) => item.value === type)?.emoji ?? "📌";
}

export function contextTypeLabel(type: ContextType) {
  return CONTEXT_TYPES.find((item) => item.value === type)?.label ?? "Outro";
}

export function contextStatusLabel(status: ContextStatus) {
  return CONTEXT_STATUSES.find((item) => item.value === status)?.label ?? status;
}

export function useContexts(workspaceId?: string) {
  return useQuery({
    queryKey: ["contexts", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contexts")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Context[];
    },
  });
}

export function useContext_(id?: string) {
  return useQuery({
    queryKey: ["context", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("contexts").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as Context | null;
    },
  });
}

export type ContextInput = {
  name: string;
  description?: string | null;
  type: ContextType;
  status: ContextStatus;
  start_date?: string | null;
  end_date?: string | null;
  location?: string | null;
  color?: string | null;
  cover_image?: string | null;
  budget_amount?: number | null;
  visibility: Enums<"visibility">;
};

export async function createContext(
  workspaceId: string,
  ownerId: string,
  input: ContextInput,
): Promise<Context> {
  const { data, error } = await supabase
    .from("contexts")
    .insert({ ...input, workspace_id: workspaceId, owner_id: ownerId })
    .select("*")
    .single();
  if (error) throw error;
  return data as Context;
}

export async function updateContext(id: string, input: Partial<ContextInput>) {
  const { error } = await supabase.from("contexts").update(input).eq("id", id);
  if (error) throw error;
}

export async function deleteContext(id: string) {
  const { error } = await supabase.from("contexts").delete().eq("id", id);
  if (error) throw error;
}
