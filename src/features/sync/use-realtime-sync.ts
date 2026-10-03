import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SyncStatus = "connecting" | "connected" | "reconnecting" | "unavailable";

/** Tables published to Realtime (see migration 0006). All carry workspace_id except `workspaces`. */
const TABLES = [
  "workspace_members", "workspace_relationships", "accounts", "cards", "card_invoice_payments",
  "categories", "transactions", "transaction_splits", "transaction_payers", "installments",
  "installment_plans", "recurring_transactions", "loans", "financings", "settlements", "events",
  "tasks", "goals", "goal_contributions", "notes", "contexts", "purchases", "physical_activities",
  "routines", "routine_logs", "ai_conversations", "ai_messages",
] as const;

const WORKSPACE_TABLES = new Set(["workspaces", "workspace_members", "workspace_relationships"]);
const AI_TABLES = new Set(["ai_conversations", "ai_messages"]);
// Open chat threads are driven by useChat; refetching them mid-stream would reset the UI.
const NEVER_INVALIDATE = new Set(["workspace", "ai_conversation", "ai_conversations"]);

/**
 * One Realtime channel per (user, active workspace). RLS remains the authorization boundary:
 * the browser client uses the signed-in session, so only rows the user can read are delivered.
 * Changes are batched and turned into React Query invalidations; focus/reconnect refetch stays as fallback.
 */
export function useRealtimeSync(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SyncStatus>("connecting");

  useEffect(() => {
    if (!workspaceId) return;
    const pending = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let everConnected = false;

    const flush = () => {
      timer = undefined;
      const tables = [...pending];
      pending.clear();
      if (tables.some((t) => WORKSPACE_TABLES.has(t))) void queryClient.invalidateQueries({ queryKey: ["workspace"] });
      if (tables.some((t) => AI_TABLES.has(t))) void queryClient.invalidateQueries({ queryKey: ["ai_conversations"] });
      if (tables.some((t) => !WORKSPACE_TABLES.has(t) && !AI_TABLES.has(t))) {
        void queryClient.invalidateQueries({
          predicate: (q) => !NEVER_INVALIDATE.has(String(q.queryKey[0])),
        });
      }
    };
    const onChange = (table: string) => {
      pending.add(table);
      if (!timer) timer = setTimeout(flush, 400);
    };

    let channel = supabase.channel(`ws-sync:${workspaceId}`);
    channel = channel.on("postgres_changes", { event: "*", schema: "public", table: "workspaces", filter: `id=eq.${workspaceId}` }, () => onChange("workspaces"));
    for (const table of TABLES) {
      channel = channel
        .on("postgres_changes", { event: "INSERT", schema: "public", table, filter: `workspace_id=eq.${workspaceId}` }, () => onChange(table))
        .on("postgres_changes", { event: "UPDATE", schema: "public", table, filter: `workspace_id=eq.${workspaceId}` }, () => onChange(table))
        // DELETE events cannot be filtered by Realtime and carry only the primary key.
        .on("postgres_changes", { event: "DELETE", schema: "public", table }, () => onChange(table));
    }
    channel.subscribe((state) => {
      if (state === "SUBSCRIBED") {
        if (everConnected) onChange("transactions"); // catch up on anything missed while offline
        everConnected = true;
        setStatus("connected");
      } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
        setStatus(everConnected ? "reconnecting" : "unavailable");
      } else if (state === "CLOSED") {
        setStatus("reconnecting");
      }
    });

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
      setStatus("connecting");
    };
  }, [workspaceId, queryClient]);

  return status;
}
