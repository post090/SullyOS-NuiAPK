import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';

export interface AndroidUpdateManifest {
  schemaVersion: 1;
  versionCode: number;
  versionName: string;
  apkUrl: string;
  sha256: string;
  sizeBytes: number;
  publishedAt?: string;
  releaseNotes: string[];
}

export interface InstalledAndroidAppInfo {
  packageName: string;
  versionCode: number;
  versionName: string;
  certificateSha256: string;
  canRequestPackageInstalls: boolean;
}

interface VerifiedAndroidApk extends InstalledAndroidAppInfo {
  valid: boolean;
}

interface InstallAndroidApkResult {
  status: 'permission_required' | 'installer_opened';
}

interface ApkInstallerPlugin {
  getInstalledInfo(): Promise<InstalledAndroidAppInfo>;
  verifyApk(options: { path: string; sha256: string }): Promise<VerifiedAndroidApk>;
  installApk(options: { path: string; sha256: string }): Promise<InstallAndroidApkResult>;
  openInstallPermissionSettings(): Promise<void>;
}

const ApkInstaller = registerPlugin<ApkInstallerPlugin>('ApkInstaller');
const UPDATE_DIRECTORY = 'updates';
const UPDATE_PATH = 'updates/SullyOS-update.apk';

const isDirectoryExistsError = (error: unknown): boolean => {
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : null;
  const detail = [record?.code, record?.message, error instanceof Error ? error.message : error]
    .filter(value => typeof value === 'string')
    .join(' ');
  return /directory\s*(?:does\s+already\s*)?exists|directoryexists|\beexist\b/i.test(detail);
};

const ensureUpdateDirectory = async (): Promise<void> => {
  try {
    await Filesystem.mkdir({
      path: UPDATE_DIRECTORY,
      directory: Directory.Cache,
      recursive: true,
    });
  } catch (error) {
    // Capacitor Filesystem rejects mkdir even with recursive=true when the
    // directory already exists. A previous update attempt leaving this cache
    // directory behind is the normal repeat-download path, not a failure.
    if (!isDirectoryExistsError(error)) throw error;
  }
};

export const getAndroidUpdateManifestUrl = (): string =>
  String(import.meta.env.VITE_APK_UPDATE_MANIFEST_URL || '').trim();

export const isAndroidAppUpdateEnabled = (): boolean =>
  Capacitor.isNativePlatform()
  && Capacitor.getPlatform() === 'android'
  && /^https:\/\//i.test(getAndroidUpdateManifestUrl());

export const parseAndroidUpdateManifest = (input: unknown): AndroidUpdateManifest => {
  if (!input || typeof input !== 'object') throw new Error('更新清单格式无效');
  const value = input as Record<string, unknown>;
  const versionCode = Number(value.versionCode);
  const sizeBytes = Number(value.sizeBytes);
  const versionName = typeof value.versionName === 'string' ? value.versionName.trim() : '';
  const apkUrl = typeof value.apkUrl === 'string' ? value.apkUrl.trim() : '';
  const sha256 = typeof value.sha256 === 'string'
    ? value.sha256.trim().replace(/^sha256:/i, '').toLowerCase()
    : '';
  if (Number(value.schemaVersion) !== 1) throw new Error('暂不支持这份更新清单');
  if (!Number.isSafeInteger(versionCode) || versionCode <= 0 || !versionName) throw new Error('更新版本号无效');
  if (!/^https:\/\//i.test(apkUrl)) throw new Error('APK 下载地址必须使用 HTTPS');
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error('APK SHA-256 无效');
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) throw new Error('APK 文件大小无效');
  return {
    schemaVersion: 1,
    versionCode,
    versionName,
    apkUrl,
    sha256,
    sizeBytes,
    publishedAt: typeof value.publishedAt === 'string' ? value.publishedAt : undefined,
    releaseNotes: Array.isArray(value.releaseNotes)
      ? value.releaseNotes.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map(item => item.trim())
      : [],
  };
};

export const getInstalledAndroidAppInfo = (): Promise<InstalledAndroidAppInfo> =>
  ApkInstaller.getInstalledInfo();

export const fetchAndroidUpdateManifest = async (): Promise<AndroidUpdateManifest> => {
  const manifestUrl = getAndroidUpdateManifestUrl();
  if (!/^https:\/\//i.test(manifestUrl)) throw new Error('当前安装包没有配置更新地址');
  const url = new URL(manifestUrl);
  url.searchParams.set('_', String(Date.now()));
  const response = await fetch(url.toString(), { cache: 'no-store' });
  if (!response.ok) throw new Error(`检查更新失败（HTTP ${response.status}）`);
  return parseAndroidUpdateManifest(await response.json());
};

interface ActiveDownload {
  key: string;
  promise: Promise<string>;
  progress: number;
  listeners: Set<(fraction: number) => void>;
}

let activeDownload: ActiveDownload | null = null;

// The native transfer outlives React pages. Acquire this lock synchronously,
// before mkdir/deleteFile, and hold it through signature/version verification.
export const downloadAndVerifyAndroidUpdate = (
  manifest: AndroidUpdateManifest,
  onProgress?: (fraction: number) => void,
): Promise<string> => {
  const key = JSON.stringify([manifest.versionCode, manifest.apkUrl, manifest.sha256, manifest.sizeBytes]);
  if (activeDownload) {
    if (activeDownload.key !== key) return Promise.reject(new Error('另一个更新正在下载或校验，请等待完成'));
    if (onProgress) {
      activeDownload.listeners.add(onProgress);
      try { onProgress(activeDownload.progress); } catch { /* UI cannot interrupt a transfer. */ }
    }
    return activeDownload.promise;
  }
  const listeners = new Set<(fraction: number) => void>();
  if (onProgress) listeners.add(onProgress);
  const promise = Promise.resolve().then(() => performDownload(manifest, fraction => {
    if (!Number.isFinite(fraction)) return;
    task.progress = Math.max(task.progress, Math.min(1, Math.max(0, fraction)));
    for (const listener of task.listeners) {
      try { listener(task.progress); } catch { /* Keep other subscribers and verification alive. */ }
    }
  })).finally(() => {
    if (activeDownload === task) activeDownload = null;
    task.listeners.clear();
  });
  const task: ActiveDownload = { key, promise, progress: 0, listeners };
  activeDownload = task;
  return promise;
};

const performDownload = async (
  manifest: AndroidUpdateManifest,
  onProgress?: (fraction: number) => void,
): Promise<string> => {
  await ensureUpdateDirectory();

  try {
    await Filesystem.deleteFile({ path: UPDATE_PATH, directory: Directory.Cache });
  } catch {
    // The first download has no stale file to remove.
  }

  let progressHandle: PluginListenerHandle | null = null;
  try {
    if (onProgress) {
      progressHandle = await Filesystem.addListener('progress', event => {
        if (event.url !== manifest.apkUrl || !event.contentLength) return;
        onProgress(Math.max(0, Math.min(1, event.bytes / event.contentLength)));
      });
    }
    await Filesystem.downloadFile({
      url: manifest.apkUrl,
      path: UPDATE_PATH,
      directory: Directory.Cache,
      progress: Boolean(onProgress),
    });
  } finally {
    // A listener cleanup failure must not skip APK verification or strand the lock.
    await progressHandle?.remove().catch(() => undefined);
  }

  const { uri } = await Filesystem.getUri({ path: UPDATE_PATH, directory: Directory.Cache });
  const verified = await ApkInstaller.verifyApk({ path: uri, sha256: manifest.sha256 });
  if (!verified.valid || verified.versionCode !== manifest.versionCode) {
    throw new Error('下载的 APK 与更新清单版本不一致');
  }
  return uri;
};

export const installVerifiedAndroidUpdate = (
  path: string,
  manifest: AndroidUpdateManifest,
): Promise<InstallAndroidApkResult> => ApkInstaller.installApk({ path, sha256: manifest.sha256 });
