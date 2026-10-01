import React, { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';

/** Fullscreen is a browser session state, not a saved theme preference. */
export default function FullscreenSettings() {
    const [active, setActive] = useState(() => !!document.fullscreenElement);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    const requesting = useRef(false);
    const available = !!document.fullscreenEnabled && typeof document.documentElement.requestFullscreen === 'function';

    useEffect(() => {
        const sync = () => setActive(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', sync);
        return () => document.removeEventListener('fullscreenchange', sync);
    }, []);

    if (Capacitor.isNativePlatform()) return null;

    const toggle = async () => {
        if (requesting.current) return;
        requesting.current = true;
        setPending(true);
        setError('');
        try {
            // Invoke immediately in the click handler, before any await or timer.
            if (document.fullscreenElement) await document.exitFullscreen();
            else await document.documentElement.requestFullscreen();
        } catch {
            setError('浏览器暂时无法切换全屏，可以继续正常使用。');
        } finally {
            setActive(!!document.fullscreenElement);
            requesting.current = false;
            setPending(false);
        }
    };

    return (
        <section className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">浏览器全屏</h2>
            <p className="text-xs leading-relaxed text-slate-500 mb-3">
                隐藏浏览器工具栏，让小手机占满屏幕。退出后不会自动重新开启。
            </p>
            <button type="button" disabled={pending || (!available && !active)} aria-pressed={active}
                onClick={() => { void toggle(); }}
                className="w-full rounded-xl bg-primary/10 text-primary py-3 text-sm font-bold disabled:opacity-50">
                {pending ? '正在切换…' : active ? '退出全屏' : '进入全屏'}
            </button>
            <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
                {available || active ? '刷新或重新打开后，可在这里再次开启。电脑上也可按 Esc 退出。' : '当前浏览器不支持此全屏方式，可尝试添加到主屏幕。'}
            </p>
            {error && <p role="status" className="mt-2 text-xs text-slate-500">{error}</p>}
        </section>
    );
}
