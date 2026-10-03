import { useCallback, useEffect, useState } from "react";
import type { InboxAction } from "@/lib/inbox/inbox.functions";

/** Histórico leve da Inbox (neste aparelho). Referencia o registro criado; não duplica dados. */
export type InboxEntry = {
  id: string;
  text: string;
  status: "confirmed" | "pending" | "error";
  action: InboxAction;
  createdAt: string;
  ref?: { id: string; module: string; href: string } | undefined;
  error?: string | undefined;
};

const key = (ws?: string) => `lifeos.inbox.${ws ?? "none"}`;

export function useInboxHistory(workspaceId?: string) {
  const [entries, setEntries] = useState<InboxEntry[]>([]);
  useEffect(() => {
    try {
      setEntries(JSON.parse(localStorage.getItem(key(workspaceId)) ?? "[]"));
    } catch {
      setEntries([]);
    }
    const sync = (e: StorageEvent) => {
      if (e.key === key(workspaceId)) setEntries(JSON.parse(e.newValue ?? "[]"));
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [workspaceId]);

  const upsert = useCallback(
    (entry: InboxEntry) => {
      setEntries((prev) => {
        const next = [entry, ...prev.filter((e) => e.id !== entry.id)].slice(0, 100);
        localStorage.setItem(key(workspaceId), JSON.stringify(next));
        return next;
      });
    },
    [workspaceId],
  );
  const remove = useCallback(
    (id: string) => {
      setEntries((prev) => {
        const next = prev.filter((e) => e.id !== id);
        localStorage.setItem(key(workspaceId), JSON.stringify(next));
        return next;
      });
    },
    [workspaceId],
  );
  return { entries, upsert, remove };
}
