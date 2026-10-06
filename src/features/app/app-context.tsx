import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/session";
import { useWorkspace, type Member, type Profile, type Relationship, type Workspace } from "@/features/workspace/queries";

export type QuickActionKind =
  | "expense"
  | "income"
  | "event"
  | "task"
  | "goal"
  | "note"
  | "workout"
  | "context"
  | "transfer"
  | "installment"
  | "recurring"
  | "loan"
  | "financing"
  | "inbox";

type AppContextValue = {
  workspaceId?: string | undefined;
  workspaceName: string;
  workspace: Workspace | null;
  profile: Profile | null;
  memberProfiles: Profile[];
  members: Member[];
  relationship: Relationship | null;
  availableWorkspaces: Workspace[];
  switchWorkspace: (workspaceId: string) => Promise<void>;
  userId?: string | undefined;
  loading: boolean;
  error: unknown;
  refetchWorkspace: () => void;
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  quickAction: QuickActionKind | null;
  openQuickAction: (kind: QuickActionKind | null) => void;
  quickMenuOpen: boolean;
  setQuickMenuOpen: (open: boolean) => void;
  /** Context the user is currently browsing; new records inherit it. */
  activeContextId: string | null;
  setActiveContextId: (id: string | null) => void;
};

// Um único contexto mesmo após recarga parcial do código (evita "useApp must be used inside AppProvider").
const globalStore = globalThis as { __lifeosAppContext?: React.Context<AppContextValue | null> };
const AppContext = (globalStore.__lifeosAppContext ??= createContext<AppContextValue | null>(null));

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const workspaceQuery = useWorkspace(!!user);
  const queryClient = useQueryClient();
  const [commandOpen, setCommandOpen] = useState(false);
  const [quickAction, setQuickAction] = useState<QuickActionKind | null>(null);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [activeContextId, setActiveContextId] = useState<string | null>(null);

  const value = useMemo<AppContextValue>(
    () => ({
      workspaceId: workspaceQuery.data?.workspaceId,
      workspaceName: workspaceQuery.data?.workspace?.name ?? "Life OS",
      workspace: workspaceQuery.data?.workspace ?? null,
      profile: workspaceQuery.data?.profile ?? null,
      memberProfiles: workspaceQuery.data?.memberProfiles ?? [],
      members: workspaceQuery.data?.members ?? [],
      relationship: workspaceQuery.data?.relationship ?? null,
      availableWorkspaces: workspaceQuery.data?.availableWorkspaces ?? [],
      switchWorkspace: async (workspaceId) => {
        const { error } = await import("@/integrations/supabase/client").then(({ supabase }) =>
          supabase.rpc("set_active_workspace", { _workspace_id: workspaceId }),
        );
        if (error) throw error;
        // Drop every cached query from the previous workspace before loading the new one.
        await queryClient.cancelQueries();
        queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "workspace" });
        setActiveContextId(null);
        await workspaceQuery.refetch();
      },
      userId: user?.id,
      loading: workspaceQuery.isLoading,
      error: workspaceQuery.error,
      refetchWorkspace: () => void workspaceQuery.refetch(),
      commandOpen,
      setCommandOpen,
      quickAction,
      openQuickAction: (kind) => {
        setQuickMenuOpen(false);
        setQuickAction(kind);
      },
      quickMenuOpen,
      setQuickMenuOpen,
      activeContextId,
      setActiveContextId,
    }),
    [workspaceQuery, queryClient, user?.id, commandOpen, quickAction, quickMenuOpen, activeContextId],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
