import { beforeEach, describe, expect, it, vi } from 'vitest';

const { filesystemMocks, installerMocks } = vi.hoisted(() => ({
  filesystemMocks: {
    mkdir: vi.fn(),
    deleteFile: vi.fn(),
    addListener: vi.fn(),
    downloadFile: vi.fn(),
    getUri: vi.fn(),
  },
  installerMocks: {
    getInstalledInfo: vi.fn(),
    verifyApk: vi.fn(),
    installApk: vi.fn(),
    openInstallPermissionSettings: vi.fn(),
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
  },
  registerPlugin: () => installerMocks,
}));

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Filesystem: filesystemMocks,
}));

import { downloadAndVerifyAndroidUpdate, parseAndroidUpdateManifest } from './androidAppUpdate';
import type { AndroidUpdateManifest } from './androidAppUpdate';

const validManifest = {
  schemaVersion: 1,
  versionCode: 30402,
  versionName: '3.4.2',
  apkUrl: 'https://github.com/example/app/releases/download/v3.4.2/app.apk',
  sha256: 'a'.repeat(64),
  sizeBytes: 37_000_000,
  releaseNotes: ['修复更新按钮', '', 123],
} as unknown as AndroidUpdateManifest;

beforeEach(() => {
  vi.resetAllMocks();
  filesystemMocks.addListener.mockResolvedValue({ remove: vi.fn().mockResolvedValue(undefined) });
  filesystemMocks.mkdir.mockResolvedValue(undefined);
  filesystemMocks.deleteFile.mockResolvedValue(undefined);
  filesystemMocks.downloadFile.mockResolvedValue(undefined);
  filesystemMocks.getUri.mockResolvedValue({ uri: 'file:///cache/updates/SullyOS-update.apk' });
  installerMocks.verifyApk.mockResolvedValue({
    valid: true,
    packageName: 'com.aetheros.simulator',
    versionCode: validManifest.versionCode,
    versionName: validManifest.versionName,
    certificateSha256: 'b'.repeat(64),
    canRequestPackageInstalls: true,
  });
});

describe('parseAndroidUpdateManifest', () => {
  it('accepts and normalizes a valid manifest', () => {
    expect(parseAndroidUpdateManifest(validManifest)).toMatchObject({
      versionCode: 30402,
      versionName: '3.4.2',
      sha256: 'a'.repeat(64),
      releaseNotes: ['修复更新按钮'],
    });
  });

  it.each([
    ['bad schema', { ...validManifest, schemaVersion: 2 }],
    ['bad version', { ...validManifest, versionCode: 0 }],
    ['insecure url', { ...validManifest, apkUrl: 'http://example.com/app.apk' }],
    ['bad digest', { ...validManifest, sha256: 'nope' }],
    ['bad size', { ...validManifest, sizeBytes: -1 }],
  ])('rejects %s', (_name, manifest) => {
    expect(() => parseAndroidUpdateManifest(manifest)).toThrow();
  });
});

describe('downloadAndVerifyAndroidUpdate', () => {
  // 下载函数只接收解析过的清单，原始的 validManifest 故意混了脏数据给解析测试用
  const manifest = parseAndroidUpdateManifest(validManifest);

  it('creates the nested cache directory before the first download', async () => {
    filesystemMocks.deleteFile.mockRejectedValueOnce(new Error('file does not exist'));

    await expect(downloadAndVerifyAndroidUpdate(manifest)).resolves.toBe(
      'file:///cache/updates/SullyOS-update.apk',
    );

    expect(filesystemMocks.mkdir).toHaveBeenCalledWith({
      path: 'updates',
      directory: 'CACHE',
      recursive: true,
    });
    expect(filesystemMocks.downloadFile).toHaveBeenCalledWith(expect.objectContaining({
      url: validManifest.apkUrl,
      path: 'updates/SullyOS-update.apk',
      directory: 'CACHE',
    }));
    expect(filesystemMocks.downloadFile.mock.calls[0]?.[0]).not.toHaveProperty('recursive');
    expect(filesystemMocks.mkdir.mock.invocationCallOrder[0]).toBeLessThan(
      filesystemMocks.downloadFile.mock.invocationCallOrder[0],
    );
  });

  it('continues when a previous update already created the cache directory', async () => {
    filesystemMocks.mkdir.mockRejectedValueOnce(Object.assign(
      new Error('Directory exists'),
      { code: 'DirectoryExists' },
    ));

    await expect(downloadAndVerifyAndroidUpdate(manifest)).resolves.toBe(
      'file:///cache/updates/SullyOS-update.apk',
    );

    expect(filesystemMocks.deleteFile).toHaveBeenCalledWith({
      path: 'updates/SullyOS-update.apk',
      directory: 'CACHE',
    });
    expect(filesystemMocks.downloadFile).toHaveBeenCalledTimes(1);
  });

  it('does not hide real cache directory creation failures', async () => {
    filesystemMocks.mkdir.mockRejectedValueOnce(new Error('Permission denied'));

    await expect(downloadAndVerifyAndroidUpdate(manifest)).rejects.toThrow('Permission denied');
    expect(filesystemMocks.downloadFile).not.toHaveBeenCalled();
  });

  it('locks synchronously before mkdir and keeps the lock until verification finishes', async () => {
    let release!: (result: unknown) => void;
    installerMocks.verifyApk.mockReturnValueOnce(new Promise(resolve => { release = resolve; }));
    const first = downloadAndVerifyAndroidUpdate(manifest);
    const second = downloadAndVerifyAndroidUpdate(manifest);
    expect(second).toBe(first);
    await vi.waitFor(() => expect(installerMocks.verifyApk).toHaveBeenCalledTimes(1));
    await expect(downloadAndVerifyAndroidUpdate({ ...manifest, versionCode: 30403 }))
      .rejects.toThrow('另一个更新正在下载或校验');
    expect(filesystemMocks.deleteFile).toHaveBeenCalledTimes(1);
    release({ valid: true, versionCode: manifest.versionCode });
    await first;
  });

  it('shares monotonic progress with a later subscriber and removes the native listener once', async () => {
    let done!: () => void;
    filesystemMocks.downloadFile.mockReturnValueOnce(new Promise<void>(resolve => { done = resolve; }));
    const remove = vi.fn().mockResolvedValue(undefined);
    filesystemMocks.addListener.mockResolvedValueOnce({ remove });
    const a = vi.fn();
    const b = vi.fn();
    const first = downloadAndVerifyAndroidUpdate(manifest, a);
    await vi.waitFor(() => expect(filesystemMocks.downloadFile).toHaveBeenCalledTimes(1));
    const progress = filesystemMocks.addListener.mock.calls[0][1];
    progress({ url: manifest.apkUrl, contentLength: 100, bytes: 60 });
    const second = downloadAndVerifyAndroidUpdate(manifest, b);
    expect(b).toHaveBeenLastCalledWith(0.6);
    progress({ url: 'https://unrelated.invalid', contentLength: 100, bytes: 90 });
    progress({ url: manifest.apkUrl, contentLength: 100, bytes: 20 });
    expect(a).toHaveBeenLastCalledWith(0.6);
    expect(b).toHaveBeenLastCalledWith(0.6);
    done();
    await Promise.all([first, second]);
    expect(filesystemMocks.downloadFile).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('releases the lock after download or verification failure, without skipping verification on cleanup errors', async () => {
    filesystemMocks.downloadFile.mockRejectedValueOnce(new Error('network failed'));
    await expect(downloadAndVerifyAndroidUpdate(manifest)).rejects.toThrow('network failed');
    expect(installerMocks.verifyApk).not.toHaveBeenCalled();
    installerMocks.verifyApk.mockRejectedValueOnce(new Error('bad signature'));
    await expect(downloadAndVerifyAndroidUpdate(manifest)).rejects.toThrow('bad signature');
    filesystemMocks.addListener.mockResolvedValueOnce({ remove: vi.fn().mockRejectedValue(new Error('cleanup failed')) });
    await expect(downloadAndVerifyAndroidUpdate(manifest)).resolves.toBe('file:///cache/updates/SullyOS-update.apk');
    expect(installerMocks.verifyApk).toHaveBeenCalledTimes(2);
    expect(filesystemMocks.downloadFile).toHaveBeenCalledTimes(3);
  });

  it('rejects an unverified or wrong-version APK', async () => {
    installerMocks.verifyApk.mockResolvedValueOnce({ valid: false, versionCode: manifest.versionCode });
    await expect(downloadAndVerifyAndroidUpdate(manifest)).rejects.toThrow('与更新清单版本不一致');
    installerMocks.verifyApk.mockResolvedValueOnce({ valid: true, versionCode: manifest.versionCode + 1 });
    await expect(downloadAndVerifyAndroidUpdate(manifest)).rejects.toThrow('与更新清单版本不一致');
  });
});
