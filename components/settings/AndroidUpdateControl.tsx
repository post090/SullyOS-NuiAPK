import React, { useSyncExternalStore } from 'react';
import { isAndroidAppUpdateEnabled } from '../../utils/androidAppUpdate';
import { androidUpdateSession } from '../../utils/androidUpdateSession';

const AndroidUpdateControl: React.FC = () => {
  const { phase, manifest, downloadedPath, progress, message } = useSyncExternalStore(
    androidUpdateSession.subscribe, androidUpdateSession.getSnapshot, androidUpdateSession.getSnapshot,
  );
  if (!isAndroidAppUpdateEnabled()) return null;
  const { check, download, continueInstall } = androidUpdateSession;
  const canContinue = Boolean(downloadedPath) && (phase === 'permission' || phase === 'ready' || phase === 'error');

  const busy = phase === 'checking' || phase === 'downloading' || phase === 'installing';
  const label = phase === 'checking'
    ? '检查中…'
    : phase === 'downloading'
      ? `下载中 ${Math.round(progress * 100)}%`
      : phase === 'installing'
        ? '正在打开安装器…'
        : phase === 'available'
          ? `下载并安装 ${manifest?.versionName || '新版本'}`
          : canContinue
            ? phase === 'ready' ? '再次打开安装器' : '继续安装'
            : '检查更新';
  const onClick = phase === 'available' ? download : canContinue ? continueInstall : check;

  return (
    <div className="mt-2 flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={busy}
        className="rounded-full bg-violet-100 px-4 py-2 text-[11px] font-bold text-violet-700 transition-transform active:scale-95 disabled:opacity-60"
      >
        {label}
      </button>
      {phase === 'downloading' && (
        <div className="h-1 w-40 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full bg-violet-400 transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      {message && (
        <p className={`max-w-[280px] text-center text-[10px] leading-relaxed ${phase === 'error' ? 'text-rose-500' : 'text-slate-400'}`}>
          {message}
        </p>
      )}
      {phase === 'available' && manifest?.releaseNotes.length ? (
        <ul className="max-w-[300px] list-disc space-y-0.5 pl-5 text-left text-[9px] leading-relaxed text-slate-400">
          {manifest.releaseNotes.map((note, index) => <li key={`${index}-${note}`}>{note}</li>)}
        </ul>
      ) : null}
    </div>
  );
};

export default AndroidUpdateControl;
