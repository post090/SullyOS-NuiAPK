// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ check: vi.fn(), restore: vi.fn(async () => {}), register: vi.fn(), scheduler: vi.fn(), active: vi.fn(), render: vi.fn(), release: vi.fn() }));
vi.mock('./userSpaceData', () => ({ restoreSpaceCatalog: mocks.restore }));
vi.mock('../App', () => ({ default: () => null }));
vi.mock('../components/DatabaseGuard', () => ({ default: () => null }));
vi.mock('react-dom/client', () => ({ default: { createRoot: () => ({ render: mocks.render }) } }));
vi.mock('./db', () => ({ openDB: vi.fn() }));
vi.mock('./databaseHealth', () => ({ checkDatabaseReadable: mocks.check }));
vi.mock('./databaseOpenDiagnostics', () => ({ startDatabaseOpenDiagnostics: vi.fn(), recordDatabaseOpen: vi.fn(), releaseDatabaseDiagnosticPersistence: mocks.release }));
vi.mock('./keepAlive', () => ({ KeepAlive: { init: mocks.register } }));
vi.mock('./vrWorld/scheduler', () => ({ VRScheduler: { resume: mocks.scheduler } }));
vi.mock('./activeMsgRuntime', () => ({ ActiveMsgRuntime: { init: mocks.active } }));
vi.mock('./translateCrashGuard', () => ({ installTranslateCrashGuard: vi.fn() }));
vi.mock('./iosStandalone', () => ({ installIOSStandaloneWorkaround: vi.fn() }));
vi.mock('./iosStatusBarEdge', () => ({ installIOSStatusBarEdge: vi.fn(() => () => {}) }));
vi.mock('./analytics', () => ({ initAnalytics: vi.fn() }));

afterEach(() => {
  document.body.innerHTML = '';
  for (const fn of Object.values(mocks)) fn.mockReset();
  vi.restoreAllMocks();
});

async function boot() {
  vi.resetModules();
  document.body.innerHTML = '<div id="root"></div>';
  await import('../index');
}

it.each(['database', 'SW'])('prepares in parallel when %s is slow, renders immediately and gates background writers on both', async slow => {
  let readable!: () => void, registered!: () => void;
  const readiness = new Promise<void>(resolve => { readable = resolve; });
  mocks.check.mockReturnValue(readiness);
  mocks.register.mockReturnValue(new Promise<void>(resolve => { registered = resolve; }));
  await boot();
  expect(mocks.check).toHaveBeenCalledOnce();
  expect(mocks.register).toHaveBeenCalledOnce();
  expect(mocks.render).toHaveBeenCalledOnce();
  // Guard readiness includes catalog restoration, independently of the SW.
  const guardReady: Promise<unknown> = mocks.render.mock.calls[0][0].props.children.props.readiness;
  let guardSettled = false;
  void guardReady.then(() => { guardSettled = true; });
  expect(guardSettled).toBe(false);
  if (slow === 'database') registered(); else readable();
  await Promise.resolve();
  expect(mocks.scheduler).not.toHaveBeenCalled();
  if (slow === 'database') readable(); else registered();
  await guardReady;
  await vi.waitFor(() => expect(mocks.scheduler).toHaveBeenCalledOnce());
  expect(mocks.restore).toHaveBeenCalledOnce();
  expect(mocks.scheduler).toHaveBeenCalledOnce();
  expect(mocks.active).toHaveBeenCalledOnce();
  expect(mocks.release).toHaveBeenCalledOnce();
});

it('keeps SW preparation available but does not resume background writers when the archive fails to open', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.check.mockRejectedValue(new DOMException('Index with the same ID already exists', 'UnknownError'));
  await boot();
  expect(mocks.register).toHaveBeenCalledOnce();
  expect(mocks.render).toHaveBeenCalledOnce();
  expect(mocks.release).toHaveBeenCalledOnce();
  expect(mocks.scheduler).not.toHaveBeenCalled();
  expect(mocks.active).not.toHaveBeenCalled();
});

it('does not make rendering wait for a failed SW initializer', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.check.mockResolvedValue(undefined);
  mocks.register.mockRejectedValue(new Error('SW unavailable'));
  await boot();
  expect(mocks.render).toHaveBeenCalledOnce();
  expect(mocks.scheduler).not.toHaveBeenCalled();
});

it('keeps the guard and background writers waiting until the user-space catalog is restored', async () => {
  let restore!: () => void;
  mocks.check.mockResolvedValue(undefined);
  mocks.register.mockResolvedValue(undefined);
  mocks.restore.mockReturnValue(new Promise<void>(resolve => { restore = resolve; }));
  await boot();
  expect(mocks.render).toHaveBeenCalledOnce();
  const guardReady: Promise<unknown> = mocks.render.mock.calls[0][0].props.children.props.readiness;
  let settled = false;
  void guardReady.then(() => { settled = true; });
  await Promise.resolve();
  expect(settled).toBe(false);
  expect(mocks.scheduler).not.toHaveBeenCalled();
  expect(mocks.active).not.toHaveBeenCalled();
  restore();
  await guardReady;
  await vi.waitFor(() => expect(mocks.scheduler).toHaveBeenCalledOnce());
  expect(mocks.active).toHaveBeenCalledOnce();
});
