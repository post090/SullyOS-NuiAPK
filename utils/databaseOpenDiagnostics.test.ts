import { afterEach, expect, it, vi } from 'vitest';

const KEY = 'sully_db_open_diagnostics_v1';
afterEach(() => { vi.restoreAllMocks(); localStorage.removeItem(KEY); });

it('keeps a bounded device-local trace across reloads without record contents', async () => {
  vi.resetModules();
  const { recordDatabaseOpen } = await import('./databaseOpenDiagnostics');
  for (let i = 0; i < 20; i++) recordDatabaseOpen('open-requested', { requestedVersion: 74 });
  recordDatabaseOpen('upgrade-started', { requestedVersion: 74, fromVersion: 72, actualVersion: 74, content: 'private-chat' } as any);
  expect(JSON.parse(localStorage.getItem(KEY)!)).toHaveLength(16);
  vi.resetModules();
  const { databaseOpenDiagnostic } = await import('./databaseOpenDiagnostics');
  const text = databaseOpenDiagnostic();
  expect(text).toContain('upgrade-started');
  expect(text).toContain('原版本 72');
  expect(text).not.toContain('private-chat');
});

it('ignores malformed stored entries and strips fields outside the diagnostic contract', async () => {
  localStorage.setItem(KEY, JSON.stringify([
    { phase: 'open-ready', at: 1e100, build: 'test', requestedVersion: 74 },
    { phase: 'unknown', at: 0, build: 'test', requestedVersion: 74 },
    { phase: 'open-ready', at: 0, build: 'test', requestedVersion: 74, actualVersion: 74, secret: 'private-chat' },
  ]));
  vi.resetModules();
  const { databaseOpenDiagnostic } = await import('./databaseOpenDiagnostics');
  const text = databaseOpenDiagnostic();
  expect(text.match(/open-ready/g)).toHaveLength(1);
  expect(text).not.toContain('unknown');
  expect(text).not.toContain('private-chat');
});

it('retains an in-memory trace when device storage is inaccessible', async () => {
  vi.spyOn(localStorage, 'getItem').mockImplementation(() => { throw new Error('denied'); });
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('full'); });
  vi.resetModules();
  const { recordDatabaseOpen, databaseOpenDiagnostic } = await import('./databaseOpenDiagnostics');
  expect(() => recordDatabaseOpen('open-error', { requestedVersion: 74 })).not.toThrow();
  expect(databaseOpenDiagnostic()).toContain('open-error');
});
