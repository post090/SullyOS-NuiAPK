// 按角色同步占位，跨 Chat 卸载保留：异步回复仍会在后台继续落库。
// React state 要等下一次 render 才更新，不能拿来挡同一帧的重复点击。
const activeReplies = new Set<string>();
const listeners = new Set<() => void>();

export const isChatReplyActive = (charId?: string): boolean => !!charId && activeReplies.has(charId);

export function subscribeChatReplies(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export function acquireChatReply(charId: string): (() => void) | null {
    if (activeReplies.has(charId)) return null;
    activeReplies.add(charId);
    listeners.forEach(listener => listener());
    let released = false;
    return () => {
        if (released) return;
        released = true;
        activeReplies.delete(charId);
        listeners.forEach(listener => listener());
    };
}
