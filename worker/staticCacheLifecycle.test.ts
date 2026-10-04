import { buildSync } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { workerBundleOptions } from '../scripts/worker-bundle-options.mjs';

// Execute the actual bundled SW so changes to the push worker's install/activate wiring
// cannot silently bypass the resource engine's tests.
const source = buildSync({
  ...workerBundleOptions, entryPoints: ['worker/sw-keep-alive.ts'], write: false,
  define: { __STATIC_CACHE_MANIFEST__: JSON.stringify({ buildId: 'test', appVersion: 'v0', entries: [{ url: 'index.html', bytes: 4, revision: 'abcd' }], shell: ['index.html'] }) },
}).outputFiles[0].text;

function worker(previouslyInstalled: boolean) {
  const handlers = new Map<string, ((event: any) => void)[]>();
  let skipCount = 0;
  let claimCount = 0;
  let cacheOpens = 0;
  let clientQueries = 0;
  const toActive: unknown[] = [];
  const self = {
    registration: { scope: 'https://example.com/SullyOS/', active: previouslyInstalled ? { postMessage: (message: unknown) => { toActive.push(message); } } : null },
    caches: { open: async () => { cacheOpens++; throw new Error('quota unavailable'); }, delete: async () => true, keys: async () => [] },
    addEventListener: (type: string, handler: (event: any) => void) => handlers.set(type, [...handlers.get(type) || [], handler]),
    skipWaiting: async () => { skipCount++; },
    clients: { claim: async () => { claimCount++; }, matchAll: async () => { clientQueries++; return []; } },
  };
  runInNewContext(source, {
    self, console: { ...console, warn: () => {} }, crypto: webcrypto,
    Request, Response, Headers, URL, AbortController, MessageChannel, TextEncoder, TextDecoder,
    setTimeout, clearTimeout, setInterval, clearInterval, fetch: async () => new Response('html'),
  });
  async function dispatch(type: string, fields: Record<string, unknown> = {}) {
    const jobs: Promise<unknown>[] = [];
    for (const handler of handlers.get(type) || []) handler({ ...fields, waitUntil: (job: Promise<unknown>) => jobs.push(job) });
    await Promise.all(jobs);
  }
  return { dispatch, skipCount: () => skipCount, claimCount: () => claimCount, cacheOpens: () => cacheOpens, clientQueries: () => clientQueries, toActive, handlers };
}

describe('cache integration with the existing push service worker', () => {
  it('becomes ready on first installation without waiting for the offline shell', async () => {
    const sw = worker(false);
    await expect(sw.dispatch('install')).resolves.toBeUndefined();
    expect(sw.cacheOpens()).toBe(0);
    await sw.dispatch('activate');
    expect(sw.claimCount()).toBe(1);
    expect(sw.handlers.has('push')).toBe(true);
  });
  it('installs an update even when its offline shell cannot be stored, and still waits for consent', async () => {
    const sw = worker(true);
    await expect(sw.dispatch('install')).resolves.toBeUndefined();
    expect(sw.cacheOpens()).toBeGreaterThan(0);
    expect(sw.skipCount()).toBe(0);
  });
  it('tells the worker it will replace that a release is ready, and steps aside when told so itself', async () => {
    const sw = worker(true);
    await sw.dispatch('install');
    expect(sw.toActive).toEqual([{ type: 'SULLY_RELEASE_READY', appVersion: 'v0' }]);
    const opens = sw.cacheOpens();
    await sw.dispatch('message', { data: { type: 'SULLY_RELEASE_READY', appVersion: 'v1' }, ports: [] });
    expect(sw.cacheOpens()).toBe(opens);
    await sw.dispatch('message', { data: { type: 'SULLY_RELEASE_READY', appVersion: 'v0' }, ports: [] });
    expect(sw.cacheOpens()).toBe(opens + 1);
  });
  it('takes control of open pages without waiting for them or for cache cleanup', async () => {
    const sw = worker(true);
    await sw.dispatch('activate');
    expect(sw.claimCount()).toBe(1);
    expect(sw.clientQueries()).toBe(0);
    await sw.dispatch('message', { data: { type: 'SULLY_CACHE_TIDY' }, ports: [] });
    expect(sw.clientQueries()).toBe(1);
  });
  it('only skips waiting after receiving the explicit activation message', async () => {
    const sw = worker(true);
    expect(sw.skipCount()).toBe(0);
    await sw.dispatch('message', { data: { type: 'SULLY_ACTIVATE_UPDATE' }, ports: [] });
    expect(sw.skipCount()).toBe(1);
  });
  it('leaves API fetch events untouched', async () => {
    const sw = worker(true);
    let intercepted = false;
    await sw.dispatch('fetch', { request: new Request('https://example.com/SullyOS/api/chat'), respondWith: () => { intercepted = true; } });
    expect(intercepted).toBe(false);
  });
});
