import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { webUpdateSession } from '../../utils/webUpdateSession';

export default function WebCacheControl() {
  const state = useSyncExternalStore(webUpdateSession.subscribe, webUpdateSession.getSnapshot, webUpdateSession.getSnapshot);
  const [confirmClear, setConfirmClear] = useState(false);
  useEffect(() => { if (state.supported) void webUpdateSession.refreshStats(); }, [state.supported]);
  if (!state.supported) return null;
  const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
      <h3 className="font-semibold text-slate-700">网页更新与资源缓存</h3>
      <p className="mt-2 leading-relaxed">
        {state.stats?.offlineReady ? '启动资源已缓存，断网也能打开。' : '启动资源尚未就绪，保持联网完成首次加载。'}
        {' '}AI 回复仍需联网；没加载过的功能和外部素材可能无法离线使用。
      </p>
      {state.stats && <p className="mt-2 text-slate-500">启动资源 {mb(state.stats.shellBytes)} · 按需资源 {mb(state.stats.runtimeBytes)}（{state.stats.runtimeEntries} 项）</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={state.working} onClick={() => void webUpdateSession.check()} className="rounded-xl bg-violet-100 px-3 py-2 text-violet-700 disabled:opacity-50">{state.working ? '处理中…' : '检查网页更新'}</button>
        <button type="button" disabled={state.working} onClick={() => setConfirmClear(true)} className="rounded-xl bg-white px-3 py-2 disabled:opacity-50">清理按需缓存</button>
        <button type="button" disabled={state.working} onClick={() => void webUpdateSession.refreshStats()} className="px-2 py-2 text-slate-500">刷新用量</button>
        {state.stats && !state.stats.offlineReady && <button type="button" disabled={state.working} onClick={() => void webUpdateSession.prepareOffline()} className="px-2 py-2 text-violet-700">重试下载启动资源</button>}
      </div>
      {confirmClear && <div className="mt-3 rounded-xl bg-white p-3">
        <p>只清理下载的图片、模型等按需资源，保留启动资源、聊天记录、角色和推送订阅。</p>
        <div className="mt-2 flex gap-3">
          <button type="button" onClick={() => { setConfirmClear(false); void webUpdateSession.clearRuntime(); }} className="text-violet-700">确认清理</button>
          <button type="button" onClick={() => setConfirmClear(false)}>取消</button>
        </div>
      </div>}
      {state.message && <p role="status" className="mt-2 leading-relaxed text-slate-500">{state.message}</p>}
    </div>
  );
}
