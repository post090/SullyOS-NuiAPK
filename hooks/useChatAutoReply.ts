import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';

export const CHAT_AUTO_REPLY_DELAY_MS = 2000;
export const CHAT_AUTO_REPLY_MIN_SECONDS = 1;
export const CHAT_AUTO_REPLY_MAX_SECONDS = 600;

/** 把任意输入收敛为合法等待秒数；非法值回落默认 2 秒。 */
export function normalizeAutoReplySeconds(value: unknown): number {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return CHAT_AUTO_REPLY_DELAY_MS / 1000;
    return Math.min(CHAT_AUTO_REPLY_MAX_SECONDS, Math.max(CHAT_AUTO_REPLY_MIN_SECONDS, Math.round(n)));
}

interface Options {
    enabled: boolean;
    conversationId: string | null;
    active: boolean;
    blocked: boolean;
    generating: boolean;
    onGenerate: () => void;
    /** 等待毫秒数，默认 CHAT_AUTO_REPLY_DELAY_MS。 */
    delayMs?: number;
}

const newWork = () => ({ pending: false, sends: new Set<symbol>(), cancelVersion: 0 });

/** 只处理本次聊天实际发送的消息；历史加载、切角色和取消都不会补触发。 */
export function useChatAutoReply(options: Options) {
    const current = useRef(options);
    useLayoutEffect(() => { current.current = options; });
    const workRef = useRef(newWork());
    const [revision, refresh] = useReducer(n => n + 1, 0);
    const [seconds, setSeconds] = useState<number | null>(null);
    const [visible, setVisible] = useState(() => !document.hidden);

    const cancel = useCallback(() => {
        const work = workRef.current;
        work.pending = false;
        work.cancelVersion++;
        setSeconds(null);
        refresh();
    }, []);

    useLayoutEffect(() => {
        workRef.current = newWork();
        setSeconds(null);
        refresh();
        return () => { workRef.current = newWork(); };
    }, [options.conversationId, options.enabled, options.active]);

    // 手动闪电、重生成或其他生成入口已经接手时，取消尚未执行的自动回复。
    useLayoutEffect(() => {
        if (options.generating) cancel();
    }, [options.generating, cancel]);

    useEffect(() => {
        const onVisibility = () => setVisible(!document.hidden);
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, []);

    // 从发送开始就暂停计时，直到图片处理、落库和聊天刷新都结束。
    // 返回的完成函数绑定本次会话；切走或取消后，晚到的结果不会重新启动倒计时。
    const beginSend = useCallback((conversationId: string | null) => {
        if (!current.current.enabled || !current.current.active || conversationId !== current.current.conversationId) {
            return (_sent: boolean) => {};
        }
        const work = workRef.current;
        const token = Symbol();
        const version = work.cancelVersion;
        work.sends.add(token);
        setSeconds(null);
        refresh();
        return (sent: boolean) => {
            if (workRef.current !== work || !work.sends.delete(token)) return;
            if (sent && version === work.cancelVersion) work.pending = true;
            refresh();
        };
    }, []);

    useEffect(() => {
        const work = workRef.current;
        const ready = () => {
            const latest = current.current;
            return workRef.current === work && work.pending && work.sends.size === 0
                && latest.enabled && latest.active && !latest.blocked && !latest.generating
                && !document.hidden;
        };
        if (!visible || !ready()) {
            setSeconds(null);
            return;
        }
        const delayMs = options.delayMs ?? CHAT_AUTO_REPLY_DELAY_MS;
        const deadline = Date.now() + delayMs;
        setSeconds(Math.max(1, Math.ceil(delayMs / 1000)));
        // 每秒刷新剩余秒数；按截止时间计算，避免定时器漂移累积。
        const tick = window.setInterval(() => {
            if (!ready()) return;
            setSeconds(Math.max(1, Math.ceil((deadline - Date.now()) / 1000)));
        }, 1000);
        const timer = window.setTimeout(() => {
            if (!ready()) return;
            cancel();
            current.current.onGenerate();
        }, delayMs);
        return () => { window.clearInterval(tick); window.clearTimeout(timer); };
    }, [revision, visible, options.enabled, options.active, options.blocked, options.generating, options.conversationId, options.delayMs, cancel]);

    return { seconds, beginSend, cancel };
}
