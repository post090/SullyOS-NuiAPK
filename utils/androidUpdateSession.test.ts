import { describe, expect, it, vi } from 'vitest';
vi.mock('./analytics', () => ({ trackEvent: vi.fn() }));
import { createAndroidUpdateSession } from './androidUpdateSession';

const manifest = {
  schemaVersion: 1 as const, versionCode: 30504, versionName: '3.5.4',
  apkUrl: 'https://example.invalid/update.apk', sha256: 'a'.repeat(64), sizeBytes: 50_000_000,
  releaseNotes: ['test'],
};
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const setup = () => {
  const deps = {
    getInstalled: vi.fn().mockResolvedValue({ versionCode: 30503 }),
    fetchManifest: vi.fn().mockResolvedValue(manifest),
    download: vi.fn().mockResolvedValue('file:///cache/updates/SullyOS-update.apk'),
    install: vi.fn().mockResolvedValue({ status: 'installer_opened' }),
    track: vi.fn(),
  };
  return { deps, session: createAndroidUpdateSession(deps) };
};

describe('Android update session survives page lifetimes', () => {
  it('keeps progress without subscribers and rejects repeated actions until download and install finish', async () => {
    const { deps, session } = setup();
    const transfer = deferred<string>();
    const install = deferred<{ status: 'installer_opened' }>();
    deps.download.mockReturnValue(transfer.promise);
    deps.install.mockReturnValue(install.promise);
    await session.check();
    const oldPage = vi.fn();
    const unsubscribe = session.subscribe(oldPage);
    const pending = session.download();
    const progress = deps.download.mock.calls[0][1];
    progress(0.3);
    unsubscribe();
    const oldCalls = oldPage.mock.calls.length;
    progress(0.6);
    progress(0.2);
    expect(oldPage).toHaveBeenCalledTimes(oldCalls);
    expect(session.getSnapshot()).toMatchObject({ phase: 'downloading', progress: 0.6, manifest });
    const newPage = vi.fn();
    const detach = session.subscribe(newPage);
    await Promise.all([session.check(), session.download(), session.continueInstall()]);
    expect(deps.download).toHaveBeenCalledTimes(1);
    expect(deps.fetchManifest).toHaveBeenCalledTimes(1);
    transfer.resolve('file:///verified.apk');
    await vi.waitFor(() => expect(session.getSnapshot().phase).toBe('installing'));
    await session.download();
    await session.check();
    expect(deps.download).toHaveBeenCalledTimes(1);
    install.resolve({ status: 'installer_opened' });
    await pending;
    expect(session.getSnapshot()).toMatchObject({ phase: 'ready', progress: 1, downloadedPath: 'file:///verified.apk' });
    expect(newPage).toHaveBeenCalled();
    expect(deps.install).toHaveBeenCalledTimes(1);
    detach();
  });

  it('blocks double checks and download while a manifest check is pending', async () => {
    const { deps, session } = setup();
    const check = deferred<typeof manifest>();
    deps.fetchManifest.mockReturnValue(check.promise);
    const first = session.check();
    await session.check();
    await session.download();
    expect(deps.fetchManifest).toHaveBeenCalledTimes(1);
    expect(deps.download).not.toHaveBeenCalled();
    check.resolve(manifest);
    await first;
    expect(session.getSnapshot().phase).toBe('available');
  });

  it('retains the verified path across install permission settings and installer cancellation', async () => {
    const { deps, session } = setup();
    deps.install.mockResolvedValueOnce({ status: 'permission_required' });
    await session.check();
    await session.download();
    expect(session.getSnapshot().phase).toBe('permission');
    await session.continueInstall();
    expect(session.getSnapshot().phase).toBe('ready');
    await session.continueInstall();
    expect(deps.install).toHaveBeenCalledTimes(3);
    expect(deps.download).toHaveBeenCalledTimes(1);
  });

  it('does not install after a failed download and permits an explicit retry', async () => {
    const { deps, session } = setup();
    deps.download.mockRejectedValueOnce(new Error('checksum mismatch'));
    await session.check();
    await session.download();
    expect(session.getSnapshot()).toMatchObject({ phase: 'error', downloadedPath: '' });
    expect(deps.install).not.toHaveBeenCalled();
    await session.check();
    await session.download();
    expect(session.getSnapshot().phase).toBe('ready');
    expect(deps.download).toHaveBeenCalledTimes(2);
  });

  it('drops a missing cached path after failed installation retry so users can download again', async () => {
    const { deps, session } = setup();
    await session.check();
    await session.download();
    deps.install.mockRejectedValueOnce(new Error('APK file missing'));
    await session.continueInstall();
    expect(session.getSnapshot()).toMatchObject({ phase: 'error', downloadedPath: '' });
    await session.check();
    await session.download();
    expect(session.getSnapshot().phase).toBe('ready');
  });

  it('reports latest or check failure without enabling a download', async () => {
    const { deps, session } = setup();
    deps.getInstalled.mockResolvedValue({ versionCode: manifest.versionCode });
    await session.check();
    expect(session.getSnapshot().phase).toBe('latest');
    await session.download();
    expect(deps.download).not.toHaveBeenCalled();
    deps.fetchManifest.mockRejectedValue(new Error('Failed to fetch'));
    await session.check();
    expect(session.getSnapshot()).toMatchObject({ phase: 'error', message: '网络连接失败，请稍后重试' });
  });
});
