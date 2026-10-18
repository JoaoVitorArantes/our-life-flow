import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plug, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/features/app/app-context";
import { Button } from "@/components/ui/button";
import {
  getCalendarConnection,
  startCalendarConnect,
  completeCalendarConnect,
  disconnectCalendar,
} from "./calendar.functions";
import { waitForCalendarOAuth } from "./popup";
export function CalendarConnectionControls({ workspaceId }: { workspaceId: string }) {
  const client = useQueryClient();
  const { userId } = useApp();
  const getStatus = useServerFn(getCalendarConnection);
  const start = useServerFn(startCalendarConnect);
  const complete = useServerFn(completeCalendarConnect);
  const disconnect = useServerFn(disconnectCalendar);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const status = useQuery({
    queryKey: ["google_calendar_connection", userId, workspaceId],
    queryFn: () => getStatus(),
    retry: false,
  });
  const refresh = () => Promise.all([client.invalidateQueries({ queryKey: ["google_calendar_connection"] }), client.invalidateQueries({ queryKey: ["google_calendar_events"] })]);
  const connect = useMutation({
    mutationFn: async () => {
      const popup = window.open("", "lifeos-calendar-oauth", "width=600,height=720");
      if (!popup) throw new Error("Permita janelas pop-up para conectar seu Calendar.");
      try {
        const flow = await start();
        const completion = waitForCalendarOAuth(popup, flow);
        popup.location.href = flow.authorizationUrl;
        const code = await completion;
        await complete({ data: { code, attemptId: flow.attemptId, nonce: flow.nonce } });
      } catch (error) {
        popup.close();
        throw error;
      }
    },
    onSuccess: async () => {
      await refresh();
      toast.success("Autorização do Google Calendar salva.");
    },
    onError: (error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: () => disconnect({ data: { confirmed: true } }),
    onSuccess: async () => {
      setConfirmDisconnect(false);
      await refresh();
      toast.success("Seu Google Calendar foi desconectado.");
    },
    onError: (error) => toast.error(error.message),
  });
  if (status.isPending)
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Verificando sua conexão…
      </p>
    );
  if (status.isError)
    return (
      <div className="space-y-2">
        <p role="alert" className="text-sm text-destructive">
          {status.error.message}
        </p>
        <Button variant="outline" size="sm" onClick={() => void status.refetch()}>
          <RefreshCw className="size-4" /> Tentar novamente
        </Button>
      </div>
    );
  const state = status.data.state;
  if (state === "setup_needed")
    return <p className="text-sm text-muted-foreground">Configuração do cliente pendente.</p>;
  const connected = state === "connected";
  const hasGrant = connected || state === "reconnect_required" || state === "error";
  const busy = connect.isPending || remove.isPending;
  return (
    <div className="space-y-3 border-t border-border pt-3">
      <p className="text-sm text-muted-foreground" role="status">
        {connected
          ? "Sua autorização está válida · somente leitura"
          : state === "reconnect_required"
            ? "Renove o acesso ao seu Google Calendar."
            : state === "error"
              ? "Não foi possível verificar o acesso ao Google Calendar."
              : "Sua conta Google ainda não foi conectada."}
      </p>
      {connected && (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {status.data.calendars.map((name, index) => (
            <li key={index} className="break-words">
              {name}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        {state !== "error" && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => connect.mutate()}>
            <Plug className="size-4" />
            {connect.isPending
              ? "Aguardando autorização…"
              : hasGrant
                ? "Reconectar Calendar"
                : "Conectar meu Calendar"}
          </Button>
        )}
        {state === "error" && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void status.refetch()}>
            <RefreshCw className="size-4" /> Verificar novamente
          </Button>
        )}
        {hasGrant && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => setConfirmDisconnect(true)}
          >
            <Unplug className="size-4" /> Desconectar
          </Button>
        )}
      </div>
      {confirmDisconnect && (
        <div className="space-y-2">
          <p className="text-sm">Desconectar somente sua conta Google neste espaço?</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="destructive" disabled={busy} onClick={() => remove.mutate()}>
              Confirmar desconexão
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => setConfirmDisconnect(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
