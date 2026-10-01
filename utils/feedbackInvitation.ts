import { getLocalDateKey } from './localDate';

export const FEEDBACK_INVITATION_KEY = 'sullyos_feedback_invitation_v1';
export const FEEDBACK_INVITATION_EVENT = 'sully:feedback-invitation';
const WAIT_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_DAYS = 3;

type InvitationState = { status: 'eligible'; firstSeenAt: number; days: string[] } | { status: 'suppressed' | 'shown' };

function readState(): InvitationState | null {
    try {
        const raw = localStorage.getItem(FEEDBACK_INVITATION_KEY);
        if (raw === null) return null;
        const state = JSON.parse(raw);
        if (state?.status === 'shown' || state?.status === 'suppressed') return { status: state.status };
        if (state?.status === 'eligible' && Number.isFinite(state.firstSeenAt) && state.firstSeenAt > 0 &&
            Array.isArray(state.days) && state.days.length <= MIN_DAYS &&
            state.days.every((day: unknown) => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day))) {
            return { ...state, days: [...new Set(state.days)] };
        }
    } catch { /* 无法确定的新旧状态，不邀请。 */ }
    return { status: 'suppressed' };
}

function saveState(state: InvitationState): boolean {
    try {
        localStorage.setItem(FEEDBACK_INVITATION_KEY, JSON.stringify(state));
        return true;
    } catch { return false; }
}

/** 在启动默认设置/新手引导写入前读取；任一旧痕迹都优先判为存量安装。 */
export function hasPriorFeedbackInstallEvidence(): boolean {
    try {
        return ['os_first_use_memory_guide_v1', 'sullyos_disclaimer_accepted', 'sullyos_backup_reminder',
            'os_theme', 'os_api_config', 'os_last_active_char_id'].some(key => localStorage.getItem(key) !== null);
    } catch { return true; }
}

/** 只在角色库成功读取后、插入内置角色前调用。读库失败不能被当作新安装。 */
export function initializeFeedbackInvitation(characterCount: number, hadPriorEvidence: boolean, now = Date.now()): void {
    if (readState() !== null) return;
    saveState(characterCount === 0 && !hadPriorEvidence
        ? { status: 'eligible', firstSeenAt: now, days: [] }
        : { status: 'suppressed' });
}

/** 只记前三个前台使用日期；不记录使用内容，也不向统计后台发送。 */
export function recordFeedbackVisit(now = Date.now()): void {
    const state = readState();
    if (state?.status !== 'eligible' || state.days.length >= MIN_DAYS) return;
    const day = getLocalDateKey(new Date(now));
    if (!state.days.includes(day)) saveState({ ...state, days: [...state.days, day] });
}

export function shouldShowFeedbackInvitation(now = Date.now()): boolean {
    const state = readState();
    return state?.status === 'eligible' && state.days.length >= MIN_DAYS && now - state.firstSeenAt >= WAIT_MS;
}

export function hasPendingFeedbackInvitation(): boolean {
    return readState()?.status === 'eligible';
}

/** 展示前即记为已显示；刷新、未点击按钮或关闭页面也不再次追问。写不进去就不弹。 */
export function claimFeedbackInvitation(now = Date.now()): boolean {
    return shouldShowFeedbackInvitation(now) && saveState({ status: 'shown' });
}

/** 恢复备份代表已有使用历史；不从备份重新激活邀请。 */
export function suppressFeedbackInvitation(): void {
    saveState({ status: 'suppressed' });
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(FEEDBACK_INVITATION_EVENT));
}
