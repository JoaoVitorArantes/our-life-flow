import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
function key() {
  const raw = process.env["APP_USER_CONNECTION_KEY_SECRET"];
  if (!raw) throw new Error("Configuração segura de conexão indisponível.");
  const value = Buffer.from(raw, "base64");
  if (value.length !== 32) throw new Error("Configuração segura de conexão inválida.");
  return value;
}
export function encryptConnectionKey(plaintext: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}
export function decryptConnectionKey(stored: string) {
  const buf = Buffer.from(stored, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}
export function newNonce() {
  return randomBytes(32).toString("hex");
}
export function hashNonce(nonce: string) {
  return createHash("sha256").update(nonce).digest("hex");
}
