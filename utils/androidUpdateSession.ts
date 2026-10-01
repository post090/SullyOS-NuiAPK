import {
  downloadAndVerifyAndroidUpdate, fetchAndroidUpdateManifest, getInstalledAndroidAppInfo,
  installVerifiedAndroidUpdate, type AndroidUpdateManifest,
} from './androidAppUpdate';
import { trackEvent } from './analytics';

type Phase = 'idle' | 'checking' | 'available' | 'downloading' | 'permission' | 'installing' | 'ready' | 'latest' | 'error';
interface UpdateState {
  phase: Phase;
  manifest: AndroidUpdateManifest | null;
  downloadedPath: string;
  progress: number;
  message: string;
}
interface Dependencies {
  getInstalled: typeof getInstalledAndroidAppInfo;
  fetchManifest: typeof fetchAndroidUpdateManifest;
  download: typeof downloadAndVerifyAndroidUpdate;
  install: typeof installVerifiedAndroidUpdate;
  track: typeof trackEvent;
}

const errorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error || '未知错误');
  return /Failed to fetch|NetworkError|timeout/i.test(message)
    ? '网络连接失败，请稍后重试' : message || '检查更新失败，请稍后重试';
};

// One in-memory session per WebView, independent of page mounts. This is not
// resumable downloading across app termination; native verification is still required.
export const createAndroidUpdateSession = (deps: Dependencies) => {
  let state: UpdateState = { phase: 'idle', manifest: null, downloadedPath: '', progress: 0, message: '' };
  const listeners = new Set<() => void>();
  const update = (patch: Partial<UpdateState>) => {
    state = { ...state, ...patch };
    listeners.forEach(listener => listener());
  };
  const busy = () => ['checking', 'downloading', 'installing'].includes(state.phase);
  const check = async () => {
    if (busy()) return;
    update({ phase: 'checking', message: '', manifest: null, downloadedPath: '', progress: 0 });
    try {
      const [installed, latest] = await Promise.all([deps.getInstalled(), deps.fetchManifest()]);
      if (latest.versionCode <= installed.versionCode) {
        update({ phase: 'latest', message: `当前 ${installed.versionName || installed.versionCode} 已是最新版` });
        deps.track('Android 检查更新', { result: 'latest', versionCode: installed.versionCode });
      } else {
        update({ phase: 'available', manifest: latest, message: `发现新版本 ${latest.versionName}` });
        deps.track('Android 检查更新', { result: 'available', versionCode: latest.versionCode });
      }
    } catch (error) {
      update({ phase: 'error', message: errorMessage(error) });
      deps.track('Android 检查更新', { result: 'failed' });
    }
  };
  const install = async (path: string, manifest: AndroidUpdateManifest) => {
    update({ phase: 'installing' });
    const result = await deps.install(path, manifest);
    update(result.status === 'permission_required'
      ? { phase: 'permission', message: '请允许“安装未知应用”，返回后点“继续安装”' }
      : { phase: 'ready', message: '已打开 Android 系统安装器；若取消，可再次打开安装器' });
    return result;
  };
  const download = async () => {
    if (state.phase !== 'available' || !state.manifest) return;
    const manifest = state.manifest;
    update({ phase: 'downloading', progress: 0, downloadedPath: '', message: '正在下载并校验正式安装包' });
    try {
      const path = await deps.download(manifest, progress => {
        if (state.phase === 'downloading' && Number.isFinite(progress)) {
          update({ progress: Math.max(state.progress, Math.min(1, Math.max(0, progress))) });
        }
      });
      update({ downloadedPath: path, progress: 1 });
      const result = await install(path, manifest);
      // Preserve existing analytics; permission settings are not an opened installer.
      if (result.status === 'installer_opened') {
        deps.track('Android 下载更新', { result: 'installer-opened', versionCode: manifest.versionCode });
      }
    } catch (error) {
      update({ phase: 'error', message: errorMessage(error) });
      deps.track('Android 下载更新', { result: 'failed', versionCode: manifest.versionCode });
    }
  };
  const continueInstall = async () => {
    if (busy() || !state.manifest || !state.downloadedPath) return;
    try {
      await install(state.downloadedPath, state.manifest);
    } catch (error) {
      // A missing/corrupt cache file must permit an explicit fresh check/download.
      update({ phase: 'error', downloadedPath: '', message: errorMessage(error) });
    }
  };
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    check, download, continueInstall,
  };
};

export const androidUpdateSession = createAndroidUpdateSession({
  getInstalled: getInstalledAndroidAppInfo, fetchManifest: fetchAndroidUpdateManifest,
  download: downloadAndVerifyAndroidUpdate, install: installVerifiedAndroidUpdate, track: trackEvent,
});
