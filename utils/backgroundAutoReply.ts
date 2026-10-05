/**
 * 离开聊天后的自动回复（后台接手）。
 *
 * 聊天页里的倒计时只在页面可见时跑；用户发完消息就切走 / 回桌面 / 切到别的 App 时，
 * Chat 把这份待回复交到这里。到点后派发 `sully-auto-reply-fire`，由 OSContext 走
 * 全局生成流程（与主动消息同一套，不依赖聊天界面）。
 *
 * 省电：不轮询。每条待回复只挂一个 JS 定时器；开启了「持续运行」的 APK 额外挂一个
 * 一次性原生定时器兜底（WebView 被系统回收时也能补上），用完即清。
 */
import { scheduleNativeTimer, cancelNativeTimer } from './runtime/nativeScheduler';

export const AUTO_REPLY_FIRE_EVENT = 'sully-auto-reply-fire';
const STORE_KEY = 'sully-auto-reply-pending-v1';
/** 超过这个时间还没执行（比如手机关机一整晚）就不再补回，免得突然冒出一条。 */
const STALE_MS = 6 * 60 * 60 * 1000;

type PendingMap = Record<string, number>; // charId -> fireAt
const timers = new Map<string, ReturnType<typeof setTimeout>>();

const load = (): PendingMap => {
    try {
        const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
        const out: PendingMap = {};
        for (const [id, at] of Object.entries(raw)) {
            if (typeof at === 'number' && Number.isFinite(at)) out[id] = at;
        }
        return out;
    } catch {
        return {};
    }
};
const save = (map: PendingMap) => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(map)); } catch { /* 存储不可用时只靠内存定时器 */ }
};
const nativeTag = (charId: string) => `autoreply-${charId}`;

const arm = (charId: string, fireAt: number) => {
    const old = timers.get(charId);
    if (old) clearTimeout(old);
    timers.set(charId, setTimeout(() => { fireBackgroundAutoReply(charId); }, Math.max(0, fireAt - Date.now())));
};

/** 交接一份待回复：delayMs 后让角色回复。同一角色重复调用会刷新时间。 */
export function scheduleBackgroundAutoReply(charId: string, delayMs: number): void {
    if (!charId) return;
    const fireAt = Date.now() + Math.max(1000, delayMs);
    const map = load();
    map[charId] = fireAt;
    save(map);
    arm(charId, fireAt);
    void scheduleNativeTimer({ tag: nativeTag(charId), runAt: fireAt, kind: 'autoreply', charId }).catch(() => {});
}

/** 撤掉后台待回复（用户回到聊天又发了新消息、或手动触发了回复）。 */
export function cancelBackgroundAutoReply(charId: string): void {
    const t = timers.get(charId);
    if (t) clearTimeout(t);
    timers.delete(charId);
    const map = load();
    if (charId in map) {
        delete map[charId];
        save(map);
        void cancelNativeTimer(nativeTag(charId)).catch(() => {});
    }
}

export function hasBackgroundAutoReply(charId: string): boolean {
    return charId in load();
}

/** 到点（JS 定时器或原生定时器唤醒）时调用；只执行一次。 */
export function fireBackgroundAutoReply(charId: string): void {
    const map = load();
    const fireAt = map[charId];
    const t = timers.get(charId);
    if (t) clearTimeout(t);
    timers.delete(charId);
    if (fireAt === undefined) return;
    // 原生定时器可能比 JS 早一点点到：还没到点就重新挂上。
    if (fireAt - Date.now() > 1500) { arm(charId, fireAt); return; }
    delete map[charId];
    save(map);
    void cancelNativeTimer(nativeTag(charId)).catch(() => {});
    if (Date.now() - fireAt > STALE_MS) return;
    window.dispatchEvent(new CustomEvent(AUTO_REPLY_FIRE_EVENT, { detail: { charId } }));
}

/** 应用启动 / WebView 重建后，把还没执行的待回复重新挂上。 */
export function resumeBackgroundAutoReplies(): void {
    const map = load();
    let changed = false;
    for (const [charId, fireAt] of Object.entries(map)) {
        if (Date.now() - fireAt > STALE_MS) { delete map[charId]; changed = true; continue; }
        arm(charId, fireAt);
    }
    if (changed) save(map);
}
