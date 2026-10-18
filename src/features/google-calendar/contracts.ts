import { z } from "zod";
export const CONNECTOR_ID = "google_calendar";
export const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/calendar.readonly",
];
export const completionSchema = z
  .object({
    attemptId: z.string().uuid(),
    nonce: z.string().regex(/^[a-f0-9]{64}$/),
    code: z.string().min(1).max(4096),
  })
  .strict();
export function attemptAllowed(
  attempt: {
    user_id: string;
    workspace_id: string;
    connector_id: string;
    nonce_hash: string;
    expires_at: string;
    consumed_at: string | null;
  },
  userId: string,
  workspaceId: string,
  nonceHash: string,
  now: number,
) {
  return (
    attempt.user_id === userId &&
    attempt.workspace_id === workspaceId &&
    attempt.connector_id === CONNECTOR_ID &&
    attempt.nonce_hash === nonceHash &&
    attempt.consumed_at === null &&
    Date.parse(attempt.expires_at) > now
  );
}
export function connectionInWorkspace(
  connection: { workspace_id: string } | null,
  workspaceId: string,
) {
  return !connection || connection.workspace_id === workspaceId;
}
