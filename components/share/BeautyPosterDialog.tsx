import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { beautyRequest, downloadBeauty } from '../../utils/beautyShareClient';
import type { BeautyShare } from '../../utils/beautyShareContract';
import { beautyPoster } from '../../utils/beautyPreview';
import { safeShareFileName } from '../../utils/pngShare';
import { shareOrDownloadBlob } from '../../utils/shareExport';
import BeautyPresetPreview, { type BeautyPreviewHandle } from './BeautyPresetPreview';
import './BeautySharePanel.css';

function BeautyPosterDialog({ code, close }: { code: string; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const preview = useRef<BeautyPreviewHandle>(null);
  const [share, setShare] = useState<BeautyShare | null>(null);
  const [pack, setPack] = useState<unknown>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true; dialog.current?.showModal();
    void (async () => {
      try {
        const approved = await beautyRequest<BeautyShare>(`/shares/${code}`);
        const data = await downloadBeauty(approved, approved.kind);
        if (alive) { setShare(approved); setPack(data); }
      } catch (e) { if (alive) setError(e instanceof Error ? e.message : '预览读取失败'); }
    })();
    return () => { alive = false; };
  }, [code]);
  const save = async () => {
    if (!share || !preview.current) return;
    setBusy(true); setError('');
    try {
      const current = await beautyRequest<BeautyShare>(`/shares/${code}`);
      if (current.revision !== share.revision) throw Error('作者刚刚发布了新版本，请关闭后重新生成预览图');
      const canvas = await preview.current.capture();
      const blob = await beautyPoster(canvas, share);
      await shareOrDownloadBlob({ blob, fileName: `${safeShareFileName(share.metadata.name)}-${code}.png`, shareTitle: share.metadata.name });
    } catch (e) { setError(e instanceof Error ? e.message : '预览图生成失败'); }
    finally { setBusy(false); }
  };
  return <dialog ref={dialog} className="beauty-poster-dialog" onCancel={e => { e.preventDefault(); if (!busy) close(); }}>
    <div className="beauty-share-panel"><header className="beauty-share-actions"><h2>分享预览图</h2><button disabled={busy} onClick={close}>关闭</button></header>
      <p>使用当前审核通过的版本，图片带有署名和美化码。</p>
      {error && <p role="alert" className="beauty-share-error">{error}</p>}
      {!!pack && <BeautyPresetPreview ref={preview} data={pack}/>}
      {!pack && !error && <p role="status">正在读取已发布预设…</p>}
      {share && <><p><strong>{share.metadata.name}</strong> · {share.metadata.credit}</p><p className="beauty-share-code">{share.code}</p><button disabled={busy || !pack} onClick={save}>{busy ? '正在生成…' : '一键生成并分享预览图'}</button></>}
    </div>
  </dialog>;
}
export function openBeautyPoster(code: string): Promise<void> {
  return new Promise(resolve => {
    const host = document.createElement('div'); document.body.append(host);
    const root = createRoot(host);
    root.render(<BeautyPosterDialog code={code} close={() => { root.unmount(); host.remove(); resolve(); }}/>);
  });
}
