import { expect, it, vi } from 'vitest';

const { fs, installer } = vi.hoisted(() => ({
  fs: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    deleteFile: vi.fn().mockResolvedValue(undefined),
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn().mockResolvedValue(undefined) }),
    downloadFile: vi.fn(),
    getUri: vi.fn().mockResolvedValue({ uri: 'file:///cache/updates/SullyOS-update.apk' }),
  },
  installer: { verifyApk: vi.fn().mockResolvedValue({ valid: true, versionCode: 30504 }) },
}));
vi.mock('@capacitor/core', () => ({ Capacitor: {}, registerPlugin: () => installer }));
vi.mock('@capacitor/filesystem', () => ({ Directory: { Cache: 'CACHE' }, Filesystem: fs }));
import { downloadAndVerifyAndroidUpdate } from './androidAppUpdate';

// Regression for the user-provided inode/size log: one pending native transfer only.
it('shares a pending download instead of deleting its file on a second invocation', async () => {
  let release!: () => void;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  fs.downloadFile.mockReturnValue(blocked);
  const manifest = {
    schemaVersion: 1 as const, versionCode: 30504, versionName: '3.5.4',
    apkUrl: 'https://example.invalid/update.apk', sha256: 'a'.repeat(64),
    sizeBytes: 50_000_000, releaseNotes: [],
  };
  const first = downloadAndVerifyAndroidUpdate(manifest);
  await vi.waitFor(() => expect(fs.downloadFile).toHaveBeenCalledTimes(1));
  const second = downloadAndVerifyAndroidUpdate(manifest);
  try {
    expect(second).toBe(first);
    expect(fs.downloadFile).toHaveBeenCalledTimes(1);
    expect(fs.deleteFile).toHaveBeenCalledTimes(1);
    expect(installer.verifyApk).not.toHaveBeenCalled();
  } finally {
    release();
    await Promise.all([first, second]);
  }
});
