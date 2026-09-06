import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppProvider } from "@/features/app/app-context";
import { AppShell } from "@/components/layout/app-shell";
import { ErrorState, LoadingState } from "@/components/common/states";
import { useApp } from "@/features/app/app-context";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <AppProvider>
      <WorkspaceGate />
    </AppProvider>
  );
}

function WorkspaceGate() {
  const { loading, error, refetchWorkspace } = useApp();

  return (
    <AppShell>
      {loading ? (
        <LoadingState label="Carregando o workspace..." />
      ) : error ? (
        <ErrorState message="Não foi possível carregar o workspace." onRetry={refetchWorkspace} />
      ) : (
        <Outlet />
      )}
    </AppShell>
  );
}
