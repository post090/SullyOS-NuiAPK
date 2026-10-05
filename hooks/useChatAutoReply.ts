import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
export const CHAT_AUTO_REPLY_DELAY_MS = 2000;
interface Options {
    enabled: boolean;
    conversationId: string | null;
    active: boolean;
    blocked: boolean;
    generating: boolean;
    onGenerate: () => void;
    /** 等待时长（毫秒），缺省 2 秒。 */
    delayMs?: number;
    /**
     * 离开聊天（切走、切角色、关掉聊天或退到后台）时还有待回复：交给全局后台接手，页面这份作废。
     * 不传则保持旧行为：切走即丢弃，退到后台回来后重新倒计时。
     */
    onHandoff?: (conversationId: string) => void;
    /** 为 true 时不交接（例如输入框里还留着草稿）。 */
    holdHandoff?: boolean;
    /** 每次新发送开始时调用（用来撤掉后台那份待回复）。 */
    onSendStart?: (conversationId: string) => void;
}
const newWork = () => ({ pending: false, sends: new Set<symbol>(), cancelVersion: 0 });
/** 只处理本次聊天实际发送的消息；历史加载、切角色和取消都不会补触发。 */
export function useChatAutoReply(options: Options) {
    // current：上一次提交的配置（effect cleanup 时仍是「离开前」的状态）；
    // rendering：本次渲染的配置，用来区分「关掉开关」和「离开会话」。
    const current = useRef(options);
    const rendering = useRef(options);
    rendering.current = options;
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
    // 只有发送成功、还没回复的那一份才交接；关掉自动回复不算离开。
    const handoff = useCallback(() => {
        const work = workRef.current;
        const left = current.current;
        if (!left.onHandoff || left.holdHandoff || !rendering.current.enabled) return;
        if (!left.enabled || !left.active || !left.conversationId || !work.pending) return;
        left.onHandoff(left.conversationId);
    }, []);
    useLayoutEffect(() => {
        workRef.current = newWork();
        setSeconds(null);
        refresh();
        return () => {
            handoff();
            workRef.current = newWork();
        };
    }, [options.conversationId, options.enabled, options.active, handoff]);
    // 手动闪电、重生成或其他生成入口已经接手时，取消尚未执行的自动回复。
    useLayoutEffect(() => {
        if (options.generating) cancel();
    }, [options.generating, cancel]);
    useEffect(() => {
        const onVisibility = () => {
            if (document.hidden && current.current.onHandoff && !current.current.holdHandoff && workRef.current.pending) {
                handoff();
                cancel();
            }
            setVisible(!document.hidden);
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, [cancel, handoff]);

    // 从发送开始就暂停计时，直到图片处理、落库和聊天刷新都结束。
    // 返回的完成函数绑定本次会话；切走或取消后，晚到的结果不会重新启动倒计时。
    const beginSend = useCallback((conversationId: string | null) => {
        if (!current.current.enabled || !current.current.active || conversationId !== current.current.conversationId) {
            return (_sent: boolean) => {};
        }
        if (conversationId) current.current.onSendStart?.(conversationId);
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
    /** 回到聊天时把后台还没执行的待回复收回页面，重新按页面规则倒计时。 */
    const resume = useCallback(() => {
        if (!current.current.enabled || !current.current.active) return;
        workRef.current.pending = true;
        refresh();
    }, []);
    const delayMs = Math.max(1000, options.delayMs ?? CHAT_AUTO_REPLY_DELAY_MS);
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
        const deadline = Date.now() + delayMs;
        setSeconds(Math.ceil(delayMs / 1000));
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
    }, [revision, visible, delayMs, options.enabled, options.active, options.blocked, options.generating, options.conversationId, cancel]);
    return { seconds, beginSend, cancel, resume };
}
