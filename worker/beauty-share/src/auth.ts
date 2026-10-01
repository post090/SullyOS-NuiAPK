import type { Env } from './types';
const encoder = new TextEncoder();
export const randomHex = (length = 16) => Array.from(crypto.getRandomValues(new Uint8Array(length)), n => n.toString(16).padStart(2, '0')).join('');
export const sha256 = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))), n => n.toString(16).padStart(2, '0')).join('');
export function equal(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
// Workers WebCrypto supports up to 100,000 PBKDF2 iterations per call.
// A server-only pepper also protects password records independently of D1.
export async function passwordHash(password: string, pepper: string, salt = randomHex()): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password + '\0' + pepper), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: 100000 }, key, 256);
  return salt + ':' + Array.from(new Uint8Array(bits), n => n.toString(16).padStart(2, '0')).join('');
}
export async function newSession(env: Env, code: string, admin = false) {
  const token = randomHex(32);
  const expiresAt = Date.now() + (admin ? 8 * 3600_000 : 30 * 86400_000);
  await env.DB.prepare('INSERT INTO sessions(token_hash,author_code,expires_at) VALUES(?,?,?)').bind(await sha256(token), code, expiresAt).run();
  return { token, authorCode: code, expiresAt };
}
export async function identity(request: Request, env: Env): Promise<{ code: string; role: 'author' | 'admin' } | null> {
  const token = request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token) return null;
  return env.DB.prepare('SELECT a.code,a.role FROM sessions s JOIN authors a ON a.code=s.author_code WHERE s.token_hash=? AND s.expires_at>?')
    .bind(await sha256(token), Date.now()).first();
}
