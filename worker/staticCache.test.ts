import { describe, expect, it } from 'vitest';
import { webcrypto } from 'node:crypto';
import { createStaticCache, type StaticManifest } from './staticCache';

// Cache Storage is a browser boundary; responses and requests remain real Fetch objects.
class MemoryCache {
  entries = new Map<string, Response>();
  async match(key: RequestInfo | URL) { return this.entries.get(String(key instanceof Request ? key.url : key))?.clone(); }
  async put(key: RequestInfo | URL, response: Response) { this.entries.set(String(key instanceof Request ? key.url : key), response.clone()); }
  async delete(key: RequestInfo | URL) { return this.entries.delete(String(key instanceof Request ? key.url : key)); }
  async keys() { return [...this.entries.keys()].map(url => new Request(url)); }
}
class MemoryCaches {
  stores = new Map<string, MemoryCache>();
  async open(name: string) { if (!this.stores.has(name)) this.stores.set(name, new MemoryCache()); return this.stores.get(name)!; }
  async keys() { return [...this.stores.keys()]; }
  async delete(name: string) { return this.stores.delete(name); }
}
const BASE = 'https://example.com/SullyOS/';
async function fixture(buildId = 'one', storage = new MemoryCaches(), limits: { maxEntries?: number; maxBytes?: number } = {}) {
  // Every release rebuilds the entry chunk, so its hashed name is unique to the build.
  const main = `assets/build/main-${buildId}-abcdefgh.js`;
  const lazy = 'assets/build/lazy-ijklmnop.js';
  const bodies: Record<string, string> = {
    'index.html': `<html>${buildId}<script type="module" src="./${main}"></script></html>`, [main]: 'console.log(1)', [lazy]: 'lazy',
    'themes/a.webp': 'image', 'themes/b.webp': 'image b', 'themes/c.webp': 'image c',
  };
  const types: Record<string, string> = {};
  const entries = await Promise.all(Object.entries(bodies).map(async ([url, body]) => ({
    url, bytes: body.length, revision: Buffer.from(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(body))).toString('hex'),
  })));
  const manifest: StaticManifest = { buildId, appVersion: 'v3.12', entries, shell: ['index.html', main] };
  let offline = false;
  let time = 1_000_000;
  const requests: string[] = [];
  const requestModes: string[] = [];
  const pending: Promise<unknown>[] = [];
  const hooks: { respond?: (request: Request) => Response | undefined } = {};
  const engine = createStaticCache({
    manifest, scope: BASE, caches: storage as unknown as CacheStorage, ...limits, now: () => time,
    digest: async bytes => Buffer.from(await webcrypto.subtle.digest('SHA-256', bytes)).toString('hex'),
    fetch: async request => {
      requests.push(request.url);
      requestModes.push(request.cache);
      if (offline) throw new TypeError('offline');
      const custom = hooks.respond?.(request);
      if (custom) return custom;
      const path = new URL(request.url).pathname.replace('/SullyOS/', '');
      // Like hosts with clean URLs: the entry page lives at the directory URL and /index.html redirects to it.
      if (path === 'index.html') return new Response(null, { status: 307, headers: { Location: BASE } });
      const file = path || 'index.html';
      return new Response(bodies[file] ?? 'missing', { status: file in bodies ? 200 : 404, headers: { 'Content-Type': types[file] ?? (file.endsWith('.html') ? 'text/html' : 'application/octet-stream') } });
    },
    waitUntil: p => { pending.push(p); },
  });
  const settle = async () => { while (pending.length) await pending.shift(); };
  const text = async (path: string, init?: RequestInit) => (await engine.handle(new Request(BASE + path, init))!).text();
  return { engine, storage, bodies, types, hooks, main, lazy, requests, requestModes, pending, settle, text, advance: (ms: number) => { time += ms; }, offline: () => { offline = true; } };
}

describe('static resource cache', () => {
  it('serves a complete installed shell offline under a repository subpath', async () => {
    const f = await fixture(); await f.engine.install(); f.offline();
    expect(await (await f.engine.handle(new Request('https://example.com/SullyOS/'))!).text()).toContain('<html>one');
    expect(await f.text(f.main)).toBe('console.log(1)');
  });
  it('does not intercept APIs, private requests, ranges or neighbouring projects', async () => {
    const { engine } = await fixture();
    for (const request of [
      new Request('https://example.com/SullyOS/api/chat'),
      new Request('https://example.com/Other/themes/a.webp'),
      new Request('https://example.com/SullyOS/themes/a.webp', { headers: { Authorization: 'Bearer secret' } }),
      new Request('https://example.com/SullyOS/themes/a.webp', { headers: { Range: 'bytes=0-10' } }),
      new Request('https://example.com/SullyOS/themes/a.webp', { method: 'POST' }),
      new Request('https://beauty.friedsully.com/api/shares/secret/file'),
      new Request('https://example.com/SullyOS/themes/a.webp', { cache: 'no-store' }),
    ]) expect(engine.handle(request)).toBeUndefined();
  });
  it('caches visited assets and reuses unchanged content in a later build', async () => {
    const f = await fixture(); await f.engine.install();
    await f.engine.handle(new Request('https://example.com/SullyOS/themes/a.webp')); await Promise.all(f.pending);
    const next = await fixture('two', f.storage); next.offline();
    expect(await (await next.engine.handle(new Request('https://example.com/SullyOS/themes/a.webp'))!).text()).toBe('image');
  });
  it('rejects a mixed deployment during installation without deleting the previous shell', async () => {
    const f = await fixture(); await f.engine.install();
    const next = await fixture('two', f.storage); next.bodies['index.html'] = '<html>three<script type="module" src="./assets/build/main-three-abcdefgh.js"></script></html>';
    await expect(next.engine.install()).rejects.toThrow();
    f.offline();
    expect(await (await f.engine.handle(new Request('https://example.com/SullyOS/'))!).text()).toContain('one');
  });
  it('does not cache an HTML fallback returned for a missing image', async () => {
    const f = await fixture(); f.bodies['themes/a.webp'] = '<html>wrong deployment</html>';
    await f.engine.handle(new Request('https://example.com/SullyOS/themes/a.webp')); await Promise.all(f.pending);
    f.offline();
    await expect(f.engine.handle(new Request('https://example.com/SullyOS/themes/a.webp'))).rejects.toThrow('offline');
  });
  it('clears only optional assets, retaining the shell and unrelated caches', async () => {
    const f = await fixture(); await f.engine.install();
    await f.storage.open('another-app');
    await f.engine.handle(new Request('https://example.com/SullyOS/themes/a.webp')); await Promise.all(f.pending);
    await f.engine.clearRuntime(); f.offline();
    expect(await (await f.engine.handle(new Request('https://example.com/SullyOS/'))!).text()).toContain('one');
    expect(await f.storage.keys()).toContain('another-app');
    await expect(f.engine.handle(new Request('https://example.com/SullyOS/themes/a.webp'))).rejects.toThrow('offline');
  });
  it('revalidates an unhashed file instead of trusting a stale browser HTTP cache', async () => {
    const f = await fixture();
    await f.text('themes/a.webp', { cache: 'force-cache' });
    expect(f.requestModes).toEqual(['no-cache']);
  });
  it('lets hashed files come from the browser HTTP cache', async () => {
    const f = await fixture(); await f.engine.install();
    expect(f.requestModes[f.requests.indexOf(BASE + f.main)]).toBe('default');
    expect(f.requestModes[f.requests.indexOf(BASE)]).toBe('no-cache');
    await f.text(f.lazy, { cache: 'force-cache' });
    expect(f.requestModes.at(-1)).toBe('force-cache');
  });
  it('reports which release it carries', async () => {
    expect(await (await fixture('two')).engine.stats()).toMatchObject({ buildId: 'two', appVersion: 'v3.12' });
  });
  it('installs the entry page from the directory URL, which no host redirects', async () => {
    const f = await fixture(); await f.engine.install();
    expect(f.requests).toContain(BASE);
    expect(f.requests).not.toContain(`${BASE}index.html`);
    expect((await f.engine.stats()).offlineReady).toBe(true);
  });
  it('accepts an entry page the host has added a script to', async () => {
    const f = await fixture(); f.bodies['index.html'] += '<script src="https://host.example/analytics.js"></script>';
    await f.engine.install(); f.offline();
    expect(await f.text('')).toContain('analytics.js');
  });
  it('goes back to the network for the page once the server no longer has this build', async () => {
    const f = await fixture(); await f.engine.install();
    delete f.bodies[f.lazy]; f.bodies['index.html'] = '<html>two</html>';
    expect((await f.engine.handle(new Request(BASE + f.lazy))!).status).toBe(404); await f.settle();
    expect(await f.text('')).toContain('two');
    // The decision survives a worker restart, and the old shell still starts the app offline.
    const restarted = await fixture('one', f.storage); restarted.bodies['index.html'] = '<html>two</html>';
    expect(await restarted.text('')).toContain('two');
    restarted.offline();
    expect(await restarted.text('')).toContain('one');
  });
  it('serves the newer release its own unhashed files once this build is replaced, and ours offline', async () => {
    const f = await fixture(); await f.engine.install();
    await f.text('themes/a.webp'); await f.settle();
    delete f.bodies[f.lazy]; await f.text(f.lazy); await f.settle();
    f.bodies['themes/a.webp'] = 'newer image';
    expect(await f.text('themes/a.webp')).toBe('newer image');
    f.offline();
    expect(await f.text('themes/a.webp')).toBe('image');
  });
  it('starts from the cached shell when the app is opened with query parameters', async () => {
    const f = await fixture(); await f.engine.install(); f.offline();
    expect(await f.text('?openApp=chat&activeMsgCharId=abc')).toContain('<html>one');
    expect(f.engine.handle(new Request(`${BASE}themes/a.webp?size=2`))).toBeUndefined();
  });
  it('caches readable CDN responses and leaves opaque no-cors requests to the browser', async () => {
    const f = await fixture();
    const font = 'https://fonts.gstatic.com/s/quicksand/v37/font.woff2';
    f.hooks.respond = request => request.url === font ? new Response('font') : undefined;
    expect(f.engine.handle(new Request(font, { mode: 'no-cors' }))).toBeUndefined();
    await (await f.engine.handle(new Request(font))!).text(); await f.settle();
    f.offline();
    expect(await (await f.engine.handle(new Request(font))!).text()).toBe('font');
  });
  it('refreshes a resource once when several requests use it at the same time', async () => {
    const f = await fixture();
    await f.text('themes/a.webp'); await f.settle();
    f.advance(2 * 24 * 60 * 60 * 1000);
    const runtime = [...f.storage.stores].find(([name]) => name.endsWith('-runtime'))![1];
    let writes = 0;
    const put = runtime.put.bind(runtime);
    runtime.put = async (key, response) => { writes++; return put(key, response); };
    await Promise.all([f.text('themes/a.webp'), f.text('themes/a.webp'), f.text('themes/a.webp')]); await f.settle();
    expect(writes).toBe(1);
  });
  it('hands page loads to the network once told that a newer release is ready, and still starts offline', async () => {
    const f = await fixture(); await f.engine.install();
    await f.engine.markReplaced();
    f.bodies['index.html'] = '<html>two</html>';
    expect(await f.text('')).toContain('two');
    const restarted = await fixture('one', f.storage); restarted.offline();
    expect(await restarted.text('')).toContain('one');
  });
  it('treats a fallback page served under a hashed name as a replaced build', async () => {
    const f = await fixture(); await f.engine.install();
    f.bodies[f.lazy] = '<html>two</html>'; f.types[f.lazy] = 'text/html'; f.bodies['index.html'] = '<html>two</html>';
    await f.text(f.lazy); await f.settle();
    expect(await f.text('')).toContain('two');
  });
  it('keeps the cached shell when only the browser HTTP cache held a fallback page', async () => {
    const f = await fixture(); await f.engine.install();
    f.hooks.respond = request => request.url.endsWith(f.lazy) && request.cache !== 'reload'
      ? new Response('<html>fallback</html>', { headers: { 'Content-Type': 'text/html' } }) : undefined;
    expect(await f.text(f.lazy)).toBe('lazy'); await f.settle();
    f.bodies['index.html'] = '<html>two</html>';
    expect(await f.text('')).toContain('one');
  });
  it('evicts optional resources beyond the byte budget', async () => {
    const f = await fixture('one', new MemoryCaches(), { maxBytes: 4 });
    await f.engine.handle(new Request('https://example.com/SullyOS/themes/a.webp')); await Promise.all(f.pending);
    expect((await f.engine.stats()).runtimeEntries).toBe(0);
  });
  it('evicts the resource unused for longest, not the one downloaded first', async () => {
    const f = await fixture('one', new MemoryCaches(), { maxEntries: 2 });
    await f.text('themes/a.webp'); await f.settle();
    f.advance(60 * 60 * 1000);
    await f.text('themes/b.webp'); await f.settle();
    f.advance(2 * 24 * 60 * 60 * 1000);
    await f.text('themes/a.webp'); await f.settle();
    await f.text('themes/c.webp'); await f.settle();
    f.offline();
    expect(await f.text('themes/a.webp')).toBe('image');
    await expect(f.engine.handle(new Request(`${BASE}themes/b.webp`))).rejects.toThrow('offline');
  });
  it('does not reread every cached response on each write', async () => {
    const f = await fixture();
    await f.text('themes/a.webp'); await f.settle();
    const runtime = [...f.storage.stores].find(([name]) => name.endsWith('-runtime'))![1];
    let reads = 0;
    const match = runtime.match.bind(runtime);
    runtime.match = async key => { reads++; return match(key); };
    await f.text('themes/b.webp'); await f.settle();
    await f.text('themes/c.webp'); await f.settle();
    // One lookup per request; pruning works from the sizes it already knows.
    expect(reads).toBe(2);
    expect((await f.engine.stats()).runtimeEntries).toBe(3);
  });
  it('does not reuse optional resources beyond their maximum age', async () => {
    const f = await fixture();
    await f.engine.handle(new Request('https://example.com/SullyOS/themes/a.webp')); await Promise.all(f.pending);
    f.advance(31 * 24 * 60 * 60 * 1000); f.offline();
    await expect(f.engine.handle(new Request('https://example.com/SullyOS/themes/a.webp'))).rejects.toThrow('offline');
  });
  it('retains a previous shell and does not erase a different application on activation', async () => {
    const a = await fixture('a'); await a.engine.install();
    await a.storage.open('different-app');
    const b = await fixture('b', a.storage); await b.engine.install(); await b.engine.activate();
    const c = await fixture('c', a.storage); await c.engine.install(); await c.engine.activate();
    const names = await a.storage.keys();
    expect(names.filter(name => name.includes('-shell-'))).toHaveLength(2);
    expect(names).toContain('different-app');
    expect(names.some(name => name.endsWith('-shell-a'))).toBe(false);
  });
  it('returns successful network data even if Cache Storage is unavailable', async () => {
    const f = await fixture();
    f.storage.open = async () => { throw new Error('storage disabled'); };
    expect(await (await f.engine.handle(new Request('https://example.com/SullyOS/themes/a.webp'))!).text()).toBe('image');
    await Promise.all(f.pending);
  });
  it('preserves a shell still used by a tab across multiple releases', async () => {
    const a = await fixture('a'); await a.engine.install();
    const b = await fixture('b', a.storage); await b.engine.install();
    const c = await fixture('c', a.storage); await c.engine.install();
    await c.engine.activate(['a']);
    expect((await a.storage.keys()).some(name => name.endsWith('-shell-a'))).toBe(true);
  });
});
