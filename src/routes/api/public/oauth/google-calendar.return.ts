import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/oauth/google-calendar/return")({
  server: {
    handlers: {
      GET: async () =>
        new Response(
          `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Autorização Calendar — Life OS</title></head><body><p id="status">Concluindo autorização…</p><script>
const params = new URLSearchParams(location.search);
const nonce = location.hash.slice(1);
const success = params.get('success') === 'true' && params.get('offline_access_allowed') !== 'false' && Boolean(params.get('code'));
const message = { type: success ? 'appUserConnectorOAuthComplete' : 'appUserConnectorOAuthFailed', connectorId: params.get('connector_id'), attemptId: params.get('attempt'), nonce, code: success ? params.get('code') : null };
history.replaceState(null, '', location.pathname);
if (window.opener && window.opener !== window) window.opener.postMessage(message, location.origin);
document.getElementById('status').textContent = success ? 'Retorne ao Life OS para concluir a conexão.' : 'Autorização não concluída. Retorne ao Life OS.';
</script></body></html>`,
          {
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-store",
              "Referrer-Policy": "no-referrer",
              "Content-Security-Policy":
                "default-src 'none'; script-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'",
            },
          },
        ),
    },
  },
});
