import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useSession } from "@/features/auth/session";
import { useWorkspace, type Profile } from "@/features/workspace/queries";

export type QuickActionKind =
  | "expense"
  | "income"
  | "event"
  | "task"
  | "goal"
  | "note"
  | "workout"
  | "context";

type AppContextValue = {
  workspaceId?: string | undefined;
  workspaceName: string;
  profile: Profile | null;
  memberProfiles: Profile[];
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

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const workspaceQuery = useWorkspace(!!user);
  const [commandOpen, setCommandOpen] = useState(false);
  const [quickAction, setQuickAction] = useState<QuickActionKind | null>(null);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [activeContextId, setActiveContextId] = useState<string | null>(null);

  const value = useMemo<AppContextValue>(
    () => ({
      workspaceId: workspaceQuery.data?.workspaceId,
      workspaceName: workspaceQuery.data?.workspace?.name ?? "Life OS",
      profile: workspaceQuery.data?.profile ?? null,
      memberProfiles: workspaceQuery.data?.memberProfiles ?? [],
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
    [workspaceQuery, user?.id, commandOpen, quickAction, quickMenuOpen, activeContextId],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
