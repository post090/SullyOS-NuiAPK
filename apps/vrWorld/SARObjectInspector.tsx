import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from '@phosphor-icons/react';
import './sar-object-inspector.css';

/** A read-only view: inspecting an object must never confirm it or advance the story. */
export function SARObjectInspector({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
    const panel = useRef<HTMLDivElement>(null), close = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        const previous = document.activeElement;
        close.current?.focus({ preventScroll: true });
        return () => { if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }); };
    }, []);
    return createPortal(<div className="sar-object-inspector" onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) onClose(); }} onKeyDown={event => {
        event.stopPropagation();
        if (event.key === 'Escape') { event.preventDefault(); onClose(); }
        if (event.key !== 'Tab') return;
        const items = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[tabindex="0"]') || []).filter(item => item.getClientRects().length);
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
        <div ref={panel} className="sar-object-inspector-panel" role="dialog" aria-modal="true" aria-label={'物品详情：' + title}>
            <header><span>{title}</span><button ref={close} type="button" aria-label="关闭物品详情" onClick={onClose}><X size={22}/></button></header>
            <div className="sar-object-inspector-content">{children}</div>
        </div>
    </div>, document.body);
}
