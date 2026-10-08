// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ check: vi.fn(), register: vi.fn(), proactive: vi.fn(), scheduler: vi.fn(), active: vi.fn() }));
vi.mock('../App', () => ({ default: () => null }));
vi.mock('../components/DatabaseGuard', () => ({ default: () => null }));
vi.mock('react-dom/client', () => ({ default: { createRoot: () => ({ render: vi.fn() }) } }));
vi.mock('./db', () => ({ openDB: vi.fn() }));
vi.mock('./databaseHealth', () => ({ checkDatabaseReadable: mocks.check }));
vi.mock('./keepAlive', () => ({ KeepAlive: { init: mocks.register } }));
vi.mock('./proactiveChat', () => ({ ProactiveChat: { resume: mocks.proactive } }));
vi.mock('./vrWorld/scheduler', () => ({ VRScheduler: { resume: mocks.scheduler } }));
vi.mock('./activeMsgRuntime', () => ({ ActiveMsgRuntime: { init: mocks.active } }));
vi.mock('./translateCrashGuard', () => ({ installTranslateCrashGuard: vi.fn() }));
vi.mock('./iosStandalone', () => ({ installIOSStandaloneWorkaround: vi.fn() }));
vi.mock('./proactivePushConfig', () => ({ installWakeListener: vi.fn() }));
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

it('waits for archive migration/readability before registering the SW and starting cache/background work', async () => {
  let readable!: () => void, registered!: () => void;
  mocks.check.mockReturnValue(new Promise<void>(resolve => { readable = resolve; }));
  mocks.register.mockReturnValue(new Promise<void>(resolve => { registered = resolve; }));
  await boot();
  expect(mocks.check).toHaveBeenCalledOnce();
  expect(mocks.register).not.toHaveBeenCalled();
  readable(); await Promise.resolve();
  expect(mocks.register).toHaveBeenCalledOnce();
  expect(mocks.proactive).not.toHaveBeenCalled();
  registered(); await Promise.resolve();
  expect(mocks.proactive).toHaveBeenCalledOnce();
  expect(mocks.scheduler).toHaveBeenCalledOnce();
  expect(mocks.active).toHaveBeenCalledOnce();
});

it('does not start its SW update/cache session or background writers when the archive fails to open', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.check.mockRejectedValue(new DOMException('Index with the same ID already exists', 'UnknownError'));
  await boot();
  expect(mocks.register).not.toHaveBeenCalled();
  expect(mocks.proactive).not.toHaveBeenCalled();
  expect(mocks.scheduler).not.toHaveBeenCalled();
  expect(mocks.active).not.toHaveBeenCalled();
});
