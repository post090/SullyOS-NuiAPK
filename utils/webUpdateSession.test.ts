import { describe, expect, it, vi } from 'vitest';
import { createWebUpdateSession } from './webUpdateSession';

class FakeWorker extends EventTarget {
  state = 'installed';
  messages: unknown[] = [];
  postMessage(message: unknown) { this.messages.push(message); }
}

// Build ids start with the build time in base 36, as vite.config.ts generates them.
const PAGE_BUILD = 'mg000001-aaaaaaa';
const NEXT_BUILD = 'mg000002-bbbbbbb';
const PREVIOUS_BUILD = 'mg000000-ccccccc';
const PAGE_VERSION = 'v3.12';

function fixture(controllerBuild = PAGE_BUILD, offlineReady = true, nextVersion = 'v3.13', pageBuild = PAGE_BUILD) {
  const worker = new FakeWorker();
  const container = new EventTarget() as ServiceWorkerContainer;
  Object.defineProperty(container, 'controller', { writable: true, value: new FakeWorker() });
  Object.assign(container, { getRegistration: async () => registration });
  const registration = Object.assign(new EventTarget(), { waiting: worker, installing: null, active: container.controller, update: async () => {} });
  let reloads = 0;
  let busy = false;
  const requests: string[] = [];
  const asked: unknown[] = [];
  const session = createWebUpdateSession({
    buildId: pageBuild, appVersion: PAGE_VERSION, container, reload: () => { reloads++; }, canReload: () => !busy,
    request: async (asked_, type) => {
      requests.push(type); asked.push(asked_);
      const next = asked_ === (worker as unknown as ServiceWorker);
      return { buildId: next ? NEXT_BUILD : controllerBuild, appVersion: next ? nextVersion : PAGE_VERSION, offlineReady, shellBytes: 10, runtimeBytes: 0, runtimeEntries: 0 };
    },
  });
  return { session, worker, registration, container, requests, asked, reloads: () => reloads, setBusy: (value: boolean) => { busy = value; } };
}

describe('web update consent', () => {
  it('reports a waiting update without activating or refreshing it', async () => {
    const f = fixture(); await f.session.attach(f.registration as unknown as ServiceWorkerRegistration);
    expect(f.session.getSnapshot().available).toBe(true);
    expect(f.worker.messages).toEqual([]);
    expect(f.reloads()).toBe(0);
    f.session.dismiss(); expect(f.session.getSnapshot().dismissed).toBe(true);
  });
  it('activates only after consent and reloads only the consenting page', async () => {
    const f = fixture(); await f.session.attach(f.registration as unknown as ServiceWorkerRegistration);
    await f.session.apply();
    expect(f.worker.messages).toEqual([{ type: 'SULLY_ACTIVATE_UPDATE' }]);
    expect(f.reloads()).toBe(0);
    Object.assign(f.container, { controller: f.worker });
    f.container.dispatchEvent(new Event('controllerchange'));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(f.reloads()).toBe(1);
  });
  it('does not refresh a second tab when another tab activates an update', async () => {
    const f = fixture(); await f.session.attach(f.registration as unknown as ServiceWorkerRegistration);
    Object.assign(f.container, { controller: f.worker });
    Object.assign(f.registration, { waiting: null });
    f.container.dispatchEvent(new Event('controllerchange'));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(f.reloads()).toBe(0);
    expect(f.session.getSnapshot().available).toBe(true);
  });
  it('does not offer an update when the page is ahead of its worker and nothing is waiting', async () => {
    const f = fixture(PREVIOUS_BUILD);
    Object.assign(f.registration, { waiting: null });
    await f.session.attach(f.registration as unknown as ServiceWorkerRegistration);
    expect(f.session.getSnapshot().available).toBe(false);
    await f.session.apply();
    expect(f.reloads()).toBe(0);
  });
  it('asks its own worker to clear older shells once the app has started', async () => {
    const f = fixture();
    Object.assign(f.registration, { waiting: null });
    await f.session.attach(f.registration as unknown as ServiceWorkerRegistration);
    await f.session.attach(f.registration as unknown as ServiceWorkerRegistration);
    expect((f.container.controller as unknown as FakeWorker).messages).toEqual([{ type: 'SULLY_CACHE_TIDY' }]);
    // A page that is ahead of its worker leaves that to the release that matches it.
    const ahead = fixture(PREVIOUS_BUILD);
    await ahead.session.attach(ahead.registration as unknown as ServiceWorkerRegistration);
    expect((ahead.container.controller as unknown as FakeWorker).messages).toEqual([]);
  });
  it('leaves a downloaded same-version release for the next page load', async () => {
    const f = fixture(PAGE_BUILD, true, PAGE_VERSION);
    await f.session.attach(f.registration as unknown as ServiceWorkerRegistration);
    expect(f.session.getSnapshot().available).toBe(false);
    expect(f.worker.messages).toEqual([]);
  });
  it('lets the waiting worker follow quietly when the page already runs its release', async () => {
    const f = fixture(PREVIOUS_BUILD, true, PAGE_VERSION, NEXT_BUILD);
    await f.session.attach(f.registration as unknown as ServiceWorkerRegistration);
    expect(f.session.getSnapshot().available).toBe(false);
    expect(f.worker.messages).toEqual([{ type: 'SULLY_ACTIVATE_UPDATE' }]);
    // The old worker is left idle so the new one can take over at once: only the waiting worker was asked.
    expect(f.asked).toEqual([f.worker]);
    Object.assign(f.container, { controller: f.worker });
    Object.assign(f.registration, { waiting: null });
    f.container.dispatchEvent(new Event('controllerchange'));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(f.reloads()).toBe(0);
    expect(f.session.getSnapshot().available).toBe(false);
  });
  it('does not switch workers under a running reply', async () => {
    const f = fixture(PREVIOUS_BUILD, true, PAGE_VERSION, NEXT_BUILD);
    f.setBusy(true);
    await f.session.attach(f.registration as unknown as ServiceWorkerRegistration);
    expect(f.worker.messages).toEqual([]);
  });
  it('neither announces nor applies a same-version update that arrives while the app is in use', async () => {
    const f = fixture(PAGE_BUILD, true, PAGE_VERSION);
    Object.assign(f.registration, { waiting: null });
    await f.session.attach(f.registration as unknown as ServiceWorkerRegistration);
    f.worker.state = 'installing';
    Object.assign(f.registration, { installing: f.worker });
    f.registration.dispatchEvent(new Event('updatefound'));
    f.worker.state = 'installed'; Object.assign(f.registration, { installing: null, waiting: f.worker });
    f.worker.dispatchEvent(new Event('statechange'));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(f.session.getSnapshot()).toMatchObject({ available: false, working: false });
    expect(f.worker.messages).toEqual([]);
    // Asking for it in settings still offers it.
    await f.session.check();
    expect(f.session.getSnapshot().available).toBe(true);
    expect(f.worker.messages).toEqual([]);
  });
  it('announces an update with a new version number that arrives while the app is in use', async () => {
    const f = fixture();
    Object.assign(f.registration, { waiting: null });
    await f.session.attach(f.registration as unknown as ServiceWorkerRegistration);
    f.worker.state = 'installing';
    Object.assign(f.registration, { installing: f.worker });
    f.registration.dispatchEvent(new Event('updatefound'));
    f.worker.state = 'installed'; Object.assign(f.registration, { installing: null, waiting: f.worker });
    f.worker.dispatchEvent(new Event('statechange'));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(f.session.getSnapshot().available).toBe(true);
    expect(f.worker.messages).toEqual([]);
  });
  it('does not interrupt a second tab when another tab applied a same-version update', async () => {
    const f = fixture(PAGE_BUILD, true, PAGE_VERSION);
    Object.assign(f.registration, { waiting: null });
    await f.session.attach(f.registration as unknown as ServiceWorkerRegistration);
    Object.assign(f.container, { controller: f.worker });
    f.container.dispatchEvent(new Event('controllerchange'));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(f.reloads()).toBe(0);
    expect(f.session.getSnapshot().available).toBe(false);
  });
  it('keeps the notice dismissed when a background check finds the same waiting update', async () => {
    const f = fixture(); await f.session.attach(f.registration as unknown as ServiceWorkerRegistration);
    f.session.dismiss();
    await f.session.check(false);
    expect(f.session.getSnapshot()).toMatchObject({ available: true, dismissed: true, working: false });
    await f.session.check();
    expect(f.session.getSnapshot().dismissed).toBe(false);
  });
  it('downloads the offline shell in the background after a first installation', async () => {
    const f = fixture(PAGE_BUILD, false);
    Object.assign(f.registration, { waiting: null });
    await f.session.attach(f.registration as unknown as ServiceWorkerRegistration);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(f.requests).toContain('SULLY_CACHE_PREPARE');
    expect(f.session.getSnapshot().available).toBe(false);
  });
  it('reports a failed download only for a worker that never finished installing', async () => {
    const f = fixture();
    Object.assign(f.registration, { waiting: null });
    await f.session.attach(f.registration as unknown as ServiceWorkerRegistration);
    const replaced = new FakeWorker(); replaced.state = 'installing';
    Object.assign(f.registration, { installing: replaced });
    f.registration.dispatchEvent(new Event('updatefound'));
    replaced.state = 'installed'; replaced.dispatchEvent(new Event('statechange'));
    replaced.state = 'redundant'; replaced.dispatchEvent(new Event('statechange'));
    expect(f.session.getSnapshot().message).not.toContain('未完成');
    const failed = new FakeWorker(); failed.state = 'installing';
    Object.assign(f.registration, { installing: failed });
    f.registration.dispatchEvent(new Event('updatefound'));
    failed.state = 'redundant'; failed.dispatchEvent(new Event('statechange'));
    expect(f.session.getSnapshot().message).toContain('未完成');
  });
  it('starts where reading the service worker container is denied', async () => {
    vi.resetModules();
    vi.stubGlobal('navigator', Object.defineProperty({}, 'serviceWorker', { get() { throw new DOMException('denied', 'SecurityError'); } }));
    try { expect((await import('./webUpdateSession')).webUpdateSession.getSnapshot().supported).toBe(false); }
    finally { vi.unstubAllGlobals(); }
  });
  it('refuses activation while a reply or data operation is running', async () => {
    const f = fixture(); await f.session.attach(f.registration as unknown as ServiceWorkerRegistration);
    f.setBusy(true); await f.session.apply();
    expect(f.worker.messages).toEqual([]);
    expect(f.session.getSnapshot().message).toContain('完成');
  });
  it('does not reload if work starts while the approved worker is activating', async () => {
    const f = fixture(); await f.session.attach(f.registration as unknown as ServiceWorkerRegistration);
    await f.session.apply(); f.setBusy(true);
    Object.assign(f.container, { controller: f.worker });
    f.container.dispatchEvent(new Event('controllerchange'));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(f.reloads()).toBe(0);
    expect(f.session.getSnapshot().working).toBe(false);
  });
  it('leaves the page usable when the waiting worker cannot receive activation', async () => {
    const f = fixture(); await f.session.attach(f.registration as unknown as ServiceWorkerRegistration);
    f.worker.postMessage = () => { throw new Error('worker terminated'); };
    await expect(f.session.apply()).resolves.toBeUndefined();
    expect(f.session.getSnapshot().working).toBe(false);
    expect(f.reloads()).toBe(0);
  });
});
