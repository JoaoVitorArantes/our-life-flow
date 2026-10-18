/** Server-only connector gateway helpers. Import only inside server handlers. */
function requireApiKey() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("Configuração de conexão indisponível.");
  return key;
}
export interface AppUserOAuthAuthorizeParams {
  gatewayBaseUrl: string;
  connectorId: string;
  appUserId: string;
  clientAPIKey: string;
  returnUrl: string;
  connectionAPIKey?: string;
  credentialsConfiguration?: Record<string, unknown>;
}
export async function authorizeAppUserOAuth(params: AppUserOAuthAuthorizeParams) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${requireApiKey()}`,
    "Content-Type": "application/json",
    "X-Client-Api-Key": params.clientAPIKey,
  };
  if (params.connectionAPIKey) headers["X-Connection-Api-Key"] = params.connectionAPIKey;
  const res = await fetch(`${params.gatewayBaseUrl}/api/v1/app-users/oauth2/authorize`, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({
      connector_id: params.connectorId,
      app_user_id: params.appUserId,
      return_url: params.returnUrl,
      credentials_configuration: params.credentialsConfiguration,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { type?: unknown; message?: unknown } | null;
    const type = typeof body?.type === "string" && /^[a-z_]+$/.test(body.type) ? body.type : "unknown";
    const detail = JSON.stringify(body);
    const fields = ["return_url", "fragment", "scopes", "client", "app_user_id", "https", "localhost", "redirect"].filter((word) => detail.includes(word));
    console.error(`Calendar OAuth start failed: status=${res.status}, type=${type}, fields=${fields.join(",")}`);
    throw new Error(`Não foi possível iniciar a autorização (${res.status}, ${type}).`);
  }
  const body = (await res.json()) as { authorization_url?: string; session_id?: string };
  if (!body.authorization_url) throw new Error("Autorização incompleta.");
  return { authorizationUrl: body.authorization_url, sessionId: body.session_id ?? "" };
}
export interface CallAsAppUserParams {
  gatewayBaseUrl: string;
  connectionAPIKey: string;
  connectorId: string;
  path: string;
  init?: RequestInit;
  requiredScopes?: string[];
}
export async function callAsAppUser({
  gatewayBaseUrl,
  connectionAPIKey,
  connectorId,
  path,
  init,
  requiredScopes,
}: CallAsAppUserParams) {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${requireApiKey()}`);
  headers.set("X-Connection-Api-Key", connectionAPIKey);
  if (requiredScopes?.length) headers.set("X-Lovable-Required-Scopes", requiredScopes.join(" "));
  return fetch(`${gatewayBaseUrl}/${connectorId}${path.startsWith("/") ? path : `/${path}`}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(20000),
  });
}
export async function appUserReconnectRequired(res: Response) {
  if (res.status !== 401) return false;
  const body = (await res
    .clone()
    .json()
    .catch(() => null)) as { type?: unknown } | null;
  return typeof body?.type === "string" && body.type.startsWith("credential_");
}
export interface DisconnectAppUserParams {
  gatewayBaseUrl: string;
  connectionAPIKey: string;
  connectorId: string;
}
export async function disconnectAppUser({
  gatewayBaseUrl,
  connectionAPIKey,
  connectorId,
}: DisconnectAppUserParams) {
  const res = await fetch(`${gatewayBaseUrl}/api/v1/app-users/connection`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${requireApiKey()}`,
      "X-Connection-Api-Key": connectionAPIKey,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({ connector_id: connectorId }),
  });
  if (!res.ok) throw new Error(`Não foi possível desconectar (${res.status}).`);
}
export async function exchangeAppUserOAuthCode(gatewayBaseUrl: string, code: string) {
  const res = await fetch(`${gatewayBaseUrl}/api/v1/app-users/oauth2/exchange`, {
    method: "POST",
    headers: { Authorization: `Bearer ${requireApiKey()}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(20000),
    body: JSON.stringify({ code }),
  });
  if (!res.ok)
    throw new Error(`Não foi possível concluir a autorização (${res.status}). Inicie novamente.`);
  const body = (await res.json()) as { api_key?: string; connector_id?: string };
  if (!body.api_key || !body.connector_id) throw new Error("Conexão incompleta.");
  return { connectionAPIKey: body.api_key, connectorId: body.connector_id };
}
