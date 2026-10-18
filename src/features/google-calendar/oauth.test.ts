import { describe, expect, test, vi, afterEach } from 'vitest';
import { completionSchema, attemptAllowed, connectionInWorkspace, GOOGLE_CALENDAR_SCOPES } from './contracts';
import { encryptConnectionKey, decryptConnectionKey, hashNonce, newNonce } from './crypto.server';
const user = 'joao'; const workspace = 'casal';
const attempt = { user_id: user, workspace_id: workspace, connector_id: 'google_calendar', nonce_hash: hashNonce('nonce'), expires_at: '2026-10-18T03:10:00Z', consumed_at: null };
const now = Date.parse('2026-10-18T03:00:00Z');
afterEach(() => vi.unstubAllEnvs());
describe('Autorização individual Calendar', () => {
  test('aceita apenas dono e espaço da tentativa', () => {
    expect(attemptAllowed(attempt, user, workspace, hashNonce('nonce'), now)).toBe(true);
    expect(attemptAllowed(attempt, 'renifer', workspace, hashNonce('nonce'), now)).toBe(false);
  });
  test('rejeita outro espaço', () => expect(attemptAllowed(attempt, user, 'outro', hashNonce('nonce'), now)).toBe(false));
  test('rejeita nonce diferente', () => expect(attemptAllowed(attempt, user, workspace, hashNonce('errado'), now)).toBe(false));
  test('rejeita autorização expirada', () => expect(attemptAllowed(attempt, user, workspace, hashNonce('nonce'), now + 600000)).toBe(false));
  test('rejeita replay', () => expect(attemptAllowed({ ...attempt, consumed_at: '2026-10-18T03:00:00Z' }, user, workspace, hashNonce('nonce'), now)).toBe(false));
  test('rejeita outro produto Google', () => expect(attemptAllowed({ ...attempt, connector_id: 'google_mail' }, user, workspace, hashNonce('nonce'), now)).toBe(false));
  test('não transfere autorização entre espaços', () => {
    expect(connectionInWorkspace({ workspace_id: workspace }, workspace)).toBe(true);
    expect(connectionInWorkspace({ workspace_id: workspace }, 'outro')).toBe(false);
  });
  test('recusa ids do usuário ou workspace enviados na conclusão', () => {
    const data = { attemptId: '853c269d-e85a-4300-8433-ba3871d1576a', nonce: newNonce(), code: 'one-time-code' };
    expect(completionSchema.safeParse(data).success).toBe(true);
    expect(completionSchema.safeParse({ ...data, userId: 'renifer' }).success).toBe(false);
    expect(completionSchema.safeParse({ ...data, workspaceId: 'outro' }).success).toBe(false);
  });
  test('escopos somente leitura, sem escrita', () => expect(GOOGLE_CALENDAR_SCOPES).toEqual(['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/calendar.readonly']));
  test('cifra credencial com integridade e IV individual', () => {
    vi.stubEnv('APP_USER_CONNECTION_KEY_SECRET', Buffer.alloc(32, 7).toString('base64'));
    const first = encryptConnectionKey('fake-test-handle'); const second = encryptConnectionKey('fake-test-handle');
    expect(first).not.toBe(second); expect(first).not.toContain('fake-test-handle');
    expect(decryptConnectionKey(first)).toBe('fake-test-handle');
    const changed = Buffer.from(first, 'base64'); changed[12] ^= 1;
    expect(() => decryptConnectionKey(changed.toString('base64'))).toThrow();
  });
  test('sem chave segura não cifra', () => { vi.stubEnv('APP_USER_CONNECTION_KEY_SECRET', ''); expect(() => encryptConnectionKey('test')).toThrow(); });
});
