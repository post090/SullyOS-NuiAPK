import { beforeEach, afterEach, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import worker from '../worker/beauty-share/src/index';
import { passwordHash, sha256 } from '../worker/beauty-share/src/auth';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
let db: import('node:sqlite').DatabaseSync;
let env: any;
const token = 'a'.repeat(64), password = 'new-local-password-only';
beforeEach(async () => {
  db = new DatabaseSync(':memory:');
  db.exec(readFileSync('worker/beauty-share/migrations/0001_initial.sql', 'utf8'));
  const prepare = (sql: string) => {
    let args: any[] = [];
    return {
      bind(...values: any[]) { args = values; return this; },
      async first() { return db.prepare(sql).get(...args) || null; },
      async run() { return { meta: { changes: Number(db.prepare(sql).run(...args).changes) } }; },
    };
  };
  env = { AUTH_PEPPER: 'test-pepper'.repeat(4), DB: { prepare, async batch(statements: any[]) {
    db.exec('BEGIN');
    try { const result = []; for (const s of statements) result.push(await s.run()); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  } } };
  db.prepare('INSERT INTO authors VALUES(?,?,?,?)').run('admin:testadmin', 'admin', await passwordHash('old-local-password', env.AUTH_PEPPER), 0);
  db.prepare('INSERT INTO authors VALUES(?,?,?,?)').run('author', 'author', 'unchanged', 0);
  db.prepare('INSERT INTO sessions VALUES(?,?,?)').run('old-admin-session', 'admin:testadmin', Date.now() + 100000);
  db.prepare('INSERT INTO sessions VALUES(?,?,?)').run('author-session', 'author', Date.now() + 100000);
  db.prepare('INSERT INTO limits VALUES(?,?,?)').run(`admin-reset:${await sha256(token)}`, 1, Date.now() + 100000);
});
afterEach(() => db.close());
const reset = (overrides = {}) => worker.fetch(new Request('https://example.com/api/admin/reset-password', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://example.com' },
  body: JSON.stringify({ token, password, passwordConfirm: password, ...overrides }),
}), env);

it('resets only admin, revokes old admin sessions and consumes the grant', async () => {
  const response = await reset();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ username: 'testadmin' });
  const row: any = db.prepare("SELECT password_hash FROM authors WHERE role='admin'").get();
  expect(row.password_hash).toBe(await passwordHash(password, env.AUTH_PEPPER, row.password_hash.split(':')[0]));
  expect(db.prepare('SELECT * FROM sessions').all()).toHaveLength(1);
  expect(db.prepare("SELECT password_hash FROM authors WHERE role='author'").get()).toMatchObject({ password_hash: 'unchanged' });
  expect((await reset()).status).toBe(403);
});
it('rejects a wrong token without consuming the real grant', async () => {
  expect((await reset({ token: 'b'.repeat(64) })).status).toBe(403);
  expect((await reset()).status).toBe(200);
});
it('rejects expired grants', async () => {
  db.exec("UPDATE limits SET expires_at=0");
  expect((await reset()).status).toBe(403);
  expect(db.prepare('SELECT * FROM sessions').all()).toHaveLength(2);
});
it('requires matching confirmation without consuming the grant', async () => {
  expect((await reset({ passwordConfirm: 'typo' })).status).toBe(400);
  expect((await reset()).status).toBe(200);
});
it('rejects cross-origin reset requests', async () => {
  const response = await worker.fetch(new Request('https://example.com/api/admin/reset-password', { method: 'POST', headers: { Origin: 'https://evil.example' } }), env);
  expect(response.status).toBe(403);
});
