import { useQuery } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { supabase } from "@/integrations/supabase/client";

/** Conversas do Life OS AI: compartilhadas por todos do espaço (decisão do casal). */
export type ActionState = { status: "confirmed" | "cancelled" | "error"; module?: string; href?: string; error?: string };

export function useConversations(workspaceId?: string) {
  return useQuery({
    queryKey: ["ai_conversations", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_conversations")
        .select("id, title, created_by, updated_at")
        .eq("workspace_id", workspaceId!)
        .order("updated_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
}

export function useConversation(threadId: string) {
  return useQuery({
    queryKey: ["ai_conversation", threadId],
    staleTime: Infinity,
    queryFn: async () => {
      const [conv, msgs] = await Promise.all([
        supabase.from("ai_conversations").select("id, title, workspace_id, action_states").eq("id", threadId).maybeSingle(),
        supabase.from("ai_messages").select("message").eq("conversation_id", threadId).order("created_at").limit(400),
      ]);
      if (conv.error) throw conv.error;
      if (msgs.error) throw msgs.error;
      return {
        conversation: conv.data,
        messages: (msgs.data ?? []).map((m) => m.message as unknown as UIMessage),
        actionStates: (conv.data?.action_states ?? {}) as Record<string, ActionState>,
      };
    },
  });
}

export async function createConversation(workspaceId: string) {
  const { data, error } = await supabase.from("ai_conversations").insert({ workspace_id: workspaceId }).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function deleteConversation(id: string) {
  const { error } = await supabase.from("ai_conversations").delete().eq("id", id);
  if (error) throw error;
}

export async function saveActionState(threadId: string, toolCallId: string, state: ActionState) {
  const { data, error } = await supabase.from("ai_conversations").select("action_states").eq("id", threadId).single();
  if (error) throw error;
  const next = { ...((data.action_states ?? {}) as Record<string, ActionState>), [toolCallId]: state };
  const up = await supabase.from("ai_conversations").update({ action_states: next }).eq("id", threadId);
  if (up.error) throw up.error;
}
