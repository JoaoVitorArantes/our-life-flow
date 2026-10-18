import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { CONNECTOR_ID, GATEWAY_BASE_URL, GOOGLE_CALENDAR_SCOPES, completionSchema, attemptAllowed } from './contracts';

export const getCalendarConnection = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { activeIdentity, loadConnection } = await import('./connection.server');
  const identity = await activeIdentity(context.supabase, context.userId);
  const configured = Boolean(process.env['GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY'] && process.env['APP_USER_CONNECTION_KEY_SECRET'] && process.env['LOVABLE_API_KEY']);
  if (!configured) return { state: 'setup_needed' as const, calendars: [] as string[] };
  const connection = await loadConnection(identity.userId, identity.workspaceId);
  if (!connection) return { state: 'not_connected' as const, calendars: [] as string[] };
  const { decryptConnectionKey } = await import('./crypto.server');
  const { callAsAppUser, appUserReconnectRequired } = await import('@/integrations/lovable/appUserConnector');
  const response = await callAsAppUser({ gatewayBaseUrl: GATEWAY_BASE_URL, connectorId: CONNECTOR_ID, connectionAPIKey: decryptConnectionKey(connection.connection_key_ciphertext), path: '/calendar/v3/users/me/calendarList?maxResults=100', requiredScopes: GOOGLE_CALENDAR_SCOPES });
  if (await appUserReconnectRequired(response)) return { state: 'reconnect_required' as const, calendars: [] as string[] };
  if (!response.ok) return { state: 'error' as const, calendars: [] as string[] };
  const result = z.object({ items: z.array(z.object({ summary: z.string().optional() })).optional() }).parse(await response.json());
  return { state: 'connected' as const, calendars: (result.items ?? []).map((c) => c.summary ?? 'Calendário') };
});

export const startCalendarConnect = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { activeIdentity, loadConnection } = await import('./connection.server');
  const identity = await activeIdentity(context.supabase, context.userId);
  const clientAPIKey = process.env['GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY'];
  if (!clientAPIKey) throw new Error('Cliente Google Calendar não configurado.');
  const { decryptConnectionKey, newNonce, hashNonce } = await import('./crypto.server');
  const connection = await loadConnection(identity.userId, identity.workspaceId);
  const nonce = newNonce(); const attemptId = crypto.randomUUID();
  const request = getRequest(); const url = new URL(request.url);
  const forwarded = url.hostname === 'localhost' ? request.headers.get('x-forwarded-host') : null;
  const origin = forwarded ? new URL(`https://${forwarded}`).origin : url.origin;
  const returnUrl = new URL('/api/public/oauth/google-calendar/return', origin);
  returnUrl.searchParams.set('attempt', attemptId);
  returnUrl.hash = nonce;
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { error } = await supabaseAdmin.from('app_user_oauth_attempts').insert({ id: attemptId, user_id: identity.userId, workspace_id: identity.workspaceId, connector_id: CONNECTOR_ID, nonce_hash: hashNonce(nonce), return_url: `${returnUrl.origin}${returnUrl.pathname}`, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
  if (error) throw new Error('Não foi possível preparar a autorização.');
  const { authorizeAppUserOAuth } = await import('@/integrations/lovable/appUserConnector');
  const result = await authorizeAppUserOAuth({ gatewayBaseUrl: GATEWAY_BASE_URL, connectorId: CONNECTOR_ID, appUserId: identity.userId, clientAPIKey, returnUrl: returnUrl.toString(), ...(connection ? { connectionAPIKey: decryptConnectionKey(connection.connection_key_ciphertext) } : {}), credentialsConfiguration: { scopes: GOOGLE_CALENDAR_SCOPES } });
  return { authorizationUrl: result.authorizationUrl, attemptId, nonce };
});

export const completeCalendarConnect = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => completionSchema.parse(input)).handler(async ({ context, data }) => {
  const { activeIdentity, loadConnection } = await import('./connection.server');
  const identity = await activeIdentity(context.supabase, context.userId);
  await loadConnection(identity.userId, identity.workspaceId);
  const { hashNonce, encryptConnectionKey } = await import('./crypto.server');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: attempt, error } = await supabaseAdmin.from('app_user_oauth_attempts').select('*').eq('id', data.attemptId).eq('user_id', identity.userId).maybeSingle();
  if (error || !attempt || !attemptAllowed(attempt, identity.userId, identity.workspaceId, hashNonce(data.nonce), Date.now())) throw new Error('Autorização expirada ou inválida. Inicie novamente.');
  const { data: claimed, error: claimError } = await supabaseAdmin.from('app_user_oauth_attempts').update({ consumed_at: new Date().toISOString() }).eq('id', attempt.id).eq('user_id', identity.userId).is('consumed_at', null).gt('expires_at', new Date().toISOString()).select('id').maybeSingle();
  if (claimError || !claimed) throw new Error('Esta autorização já foi utilizada. Inicie novamente.');
  const { exchangeAppUserOAuthCode, disconnectAppUser } = await import('@/integrations/lovable/appUserConnector');
  const grant = await exchangeAppUserOAuthCode(GATEWAY_BASE_URL, data.code);
  if (grant.connectorId !== CONNECTOR_ID) throw new Error('A autorização não pertence ao Calendar.');
  try {
    const current = await activeIdentity(context.supabase, context.userId);
    if (current.workspaceId !== identity.workspaceId) throw new Error('O espaço ativo mudou durante a autorização.');
    const { error: saveError } = await supabaseAdmin.from('app_user_connections').upsert({ user_id: identity.userId, workspace_id: identity.workspaceId, connector_id: CONNECTOR_ID, connection_key_ciphertext: encryptConnectionKey(grant.connectionAPIKey), updated_at: new Date().toISOString() }, { onConflict: 'user_id,connector_id' });
    if (saveError) throw new Error('Não foi possível salvar a conexão. Inicie novamente.');
  } catch (error) {
    await disconnectAppUser({ gatewayBaseUrl: GATEWAY_BASE_URL, connectorId: CONNECTOR_ID, connectionAPIKey: grant.connectionAPIKey }).catch(() => undefined);
    throw error;
  }
  return { ok: true };
});

export const disconnectCalendar = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => z.object({ confirmed: z.literal(true) }).strict().parse(input)).handler(async ({ context }) => {
  const { activeIdentity, loadConnection } = await import('./connection.server');
  const identity = await activeIdentity(context.supabase, context.userId);
  const connection = await loadConnection(identity.userId, identity.workspaceId);
  if (!connection) return { ok: true };
  const { decryptConnectionKey } = await import('./crypto.server');
  const { disconnectAppUser } = await import('@/integrations/lovable/appUserConnector');
  await disconnectAppUser({ gatewayBaseUrl: GATEWAY_BASE_URL, connectorId: CONNECTOR_ID, connectionAPIKey: decryptConnectionKey(connection.connection_key_ciphertext) });
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { error } = await supabaseAdmin.from('app_user_connections').delete().eq('user_id', identity.userId).eq('connector_id', CONNECTOR_ID).eq('workspace_id', identity.workspaceId);
  if (error) throw new Error('A autorização foi revogada, mas a limpeza local falhou. Tente novamente.');
  return { ok: true };
});
