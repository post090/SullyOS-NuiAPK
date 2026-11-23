import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { MapPin } from '@phosphor-icons/react';
import { useLocalBackHandler } from '../../hooks/useLocalBackHandler';
import { readLocationPin, refreshChatLocation, subscribeLocationPin, type UserLocationSnapshot } from '../../utils/userLocation';
import './chatLocationPin.css';

const preferenceKey = 'chat_location_pin_visible';
const subscribers = new Set<() => void>();
function subscribe(listener: () => void) {
    subscribers.add(listener);
    return () => { subscribers.delete(listener); };
}
function useVisible() {
    return useSyncExternalStore(subscribe, () => localStorage.getItem(preferenceKey) !== 'off');
}

export function LocationPinPreference() {
    const visible = useVisible();
    return <label className="chat-location-preference">
        <span>聊天定位大头针<small>只控制聊天里是否显示标记</small></span>
        <input type="checkbox" checked={visible} onChange={event => {
            localStorage.setItem(preferenceKey, event.target.checked ? 'on' : 'off');
            subscribers.forEach(listener => listener());
        }} />
    </label>;
}

export function ChatLocationBadge({ status, onOpen }: {
    status: 'pending' | 'ready' | 'unavailable';
    onOpen?: () => void;
}) {
    const label = { pending: '正在定位', ready: '已获取位置', unavailable: '未取得位置' }[status];
    return <button type="button" className="sully-chat-location-pin" data-status={status}
        aria-label={label + '，查看本轮定位'} aria-haspopup="dialog" onClick={onOpen}>
        <MapPin size={14} aria-hidden="true" /><span>{label}</span>
    </button>;
}

function LocationDetails({ result, pending, refreshed, busy, onRefresh, onClose }: {
    result: UserLocationSnapshot | null | undefined;
    pending: boolean;
    refreshed: boolean;
    busy: boolean;
    onRefresh: () => void;
    onClose: () => void;
}) {
    const dialog = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const element = dialog.current;
        element?.showModal();
        return () => element?.close();
    }, []);
    useLocalBackHandler(() => { onClose(); return true; }, 60);

    return createPortal(<dialog ref={dialog} className="chat-location-dialog" aria-label="本轮定位"
        onCancel={event => { event.preventDefault(); onClose(); }}
        onClick={event => { if (event.target === dialog.current) onClose(); }}>
        <section>
            <h2><MapPin size={19} aria-hidden="true" />本轮定位</h2>
            <p role="status">{pending ? '正在定位…' : result?.description || '本轮未取得位置。'}</p>
            {result?.kind === 'place' && result.attribution && <small>Geoapify · © OpenStreetMap contributors</small>}
            {refreshed && <small>下轮回复将使用这次位置。</small>}
            <LocationPinPreference />
            <div className="chat-location-actions">
                <button type="button" disabled={busy} onClick={onRefresh}>{busy ? '正在获取…' : '重新获取定位'}</button>
                <button type="button" onClick={onClose}>关闭</button>
            </div>
        </section>
    </dialog>, document.body);
}

export function ChatLocationPin({ charId }: { charId: string }) {
    const state = useSyncExternalStore(subscribeLocationPin, () => readLocationPin(charId));
    const visible = useVisible();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [manual, setManual] = useState<UserLocationSnapshot | null>();
    if (!state) return null;
    const result = manual === undefined ? state.snapshot : manual;
    const pending = busy || result === undefined;
    const status = pending ? 'pending' : result && result.kind !== 'unavailable' ? 'ready' : 'unavailable';
    async function refresh() {
        setBusy(true);
        try { setManual(await refreshChatLocation(charId) ?? null); }
        catch { setManual(null); }
        finally { setBusy(false); }
    }
    return <>
        {visible && <ChatLocationBadge status={status} onOpen={() => setOpen(true)} />}
        {open && <LocationDetails result={result} pending={pending} refreshed={!busy && !!manual && manual.kind !== 'unavailable'}
            busy={busy} onRefresh={refresh} onClose={() => setOpen(false)} />}
    </>;
}
