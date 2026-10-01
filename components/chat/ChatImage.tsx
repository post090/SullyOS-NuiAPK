import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, DownloadSimple, MagnifyingGlassPlus, MagnifyingGlassMinus } from '@phosphor-icons/react';
import TokenImg from '../os/TokenImg';
import { useBlobRefUrl } from '../../utils/blobRef';
import './ChatImage.css';

export function ImageViewer({ value, fallback, name, onClose }: { value: string; fallback: string; name?: string; onClose: () => void }) {
    const [failed, setFailed] = useState(false), [zoom, setZoom] = useState(false);
    const src = useBlobRefUrl(failed ? fallback : value);
    const close = useRef<HTMLButtonElement>(null);
    useEffect(() => { const previous = document.activeElement as HTMLElement; close.current?.focus(); return () => previous?.focus(); }, []);
    return createPortal(<div className="chat-image-viewer" role="dialog" aria-modal="true" aria-label="图片预览"
        onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} onPointerMove={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()} onContextMenu={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()} onKeyDown={e => {
            e.stopPropagation();
            if (e.key === 'Escape') onClose();
            if (e.key === 'Tab') {
                const controls = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button,a[href]'));
                const first = controls[0], last = controls[controls.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        }}>
        <header><button ref={close} onClick={onClose} aria-label="关闭图片预览" title="关闭"><X size={24} /></button><div>
            <button onClick={() => setZoom(v => !v)} aria-label={zoom ? '缩小图片' : '放大图片'} title={zoom ? '缩小' : '放大'}>{zoom ? <MagnifyingGlassMinus size={24} /> : <MagnifyingGlassPlus size={24} />}</button>
            {src && <a href={src} download={name || 'photo'} aria-label="保存图片" title="保存图片"><DownloadSimple size={24} /></a>}
        </div></header>
        <div className={`chat-image-stage ${zoom ? 'is-zoomed' : ''}`} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            {src ? <img src={src} alt="聊天图片预览" onError={() => setFailed(true)} /> : <span role="status">正在读取图片…</span>}
        </div>
    </div>, document.body);
}

export default function ChatImage({ value, original, name, selectionMode, eager, onLoad }: { value: string; original?: string; name?: string; selectionMode: boolean; eager?: boolean; onLoad?: () => void }) {
    const [open, setOpen] = useState(false);
    return <><button className="chat-image-thumbnail" type="button" aria-label="查看大图" onClick={e => { if (selectionMode) return; e.stopPropagation(); setOpen(true); }}>
        <TokenImg value={value} className="max-w-[200px] max-h-[300px] rounded-2xl" alt="聊天图片" loading={eager ? 'eager' : 'lazy'} decoding="async" onLoad={onLoad} />
    </button>{open && <ImageViewer value={original || value} fallback={value} name={name} onClose={() => setOpen(false)} />}</>;
}
