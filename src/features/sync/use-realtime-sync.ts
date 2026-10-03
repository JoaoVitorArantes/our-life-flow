import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SyncStatus = "connecting" | "connected" | "reconnecting" | "unavailable";

const WORKSPACE_TABLES = new Set(["workspaces", "workspace_members", "workspace_relationships"]);
const AI_TABLES = new Set(["ai_conversations", "ai_messages"]);
// Open chat threads are driven by useChat; refetching them mid-stream would reset the UI.
const NEVER_INVALIDATE = new Set(["workspace", "ai_conversation", "ai_conversations"]);

/**
 * One Realtime subscription per active workspace, listening only to `workspace_sync_events`.
 * Database triggers write one minimal row (workspace, table, operation — no record ids) for every
 * INSERT/UPDATE/DELETE on domain tables. Realtime checks the subscriber's RLS SELECT policy
 * (`is_workspace_member`) before delivering each row, so no other tenant's activity is visible.
 * Domain tables are not published to Postgres Changes. Focus/reconnect refetch remains the fallback.
 */
export function useRealtimeSync(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SyncStatus>("connecting");

  useEffect(() => {
    if (!workspaceId) return;
    const pending = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let everConnected = false;
    let active = true;

    const flush = () => {
      timer = undefined;
      if (!active) return;
      const tables = [...pending];
      pending.clear();
      if (tables.some((t) => WORKSPACE_TABLES.has(t))) void queryClient.invalidateQueries({ queryKey: ["workspace"] });
      if (tables.some((t) => AI_TABLES.has(t))) void queryClient.invalidateQueries({ queryKey: ["ai_conversations"] });
      if (tables.some((t) => !WORKSPACE_TABLES.has(t) && !AI_TABLES.has(t))) {
        void queryClient.invalidateQueries({ predicate: (q) => !NEVER_INVALIDATE.has(String(q.queryKey[0])) });
      }
    };
    const onChange = (table: string) => {
      pending.add(table);
      if (!timer) timer = setTimeout(flush, 400);
    };

    const channel = supabase
      .channel(`ws-sync:${workspaceId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "workspace_sync_events", filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          const row = payload.new as { workspace_id?: string; table_name?: string };
          if (row.workspace_id !== workspaceId || !row.table_name) return;
          onChange(row.table_name);
        },
      )
      .subscribe((state) => {
        if (!active) return;
        if (state === "SUBSCRIBED") {
          if (everConnected) onChange("*"); // catch up on anything missed while disconnected
          everConnected = true;
          setStatus("connected");
        } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
          setStatus(everConnected ? "reconnecting" : "unavailable");
        } else if (state === "CLOSED") {
          setStatus(everConnected ? "reconnecting" : "unavailable");
        }
      });

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
      setStatus("connecting");
    };
  }, [workspaceId, queryClient]);

  return status;
}
