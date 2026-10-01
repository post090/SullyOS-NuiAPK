import type { CaianExpression } from './sarArt';

export type SARUpdateNotice = 'cabinet' | 'board';
type Line = { expression: CaianExpression; text: string | readonly string[]; emphasis?: string; quoted?: boolean };

/** Authored release messages; kept outside familiarity scenes and their daily/reward state. */
export const SAR_UPDATE_NOTICES: Record<SARUpdateNotice, readonly Line[]> = {
    cabinet: [
        { expression: 'happy', text: '对了！刚刚收到了优化通知。' },
        { expression: 'normal', text: ['异格回复：点「…」可复制、修改、重新生成、删除。', '删除后点生成会重试原来那一幕，不重复扣轮数；生成失败保留旧回复'], emphasis: '异格回复', quoted: true },
        { expression: 'happy', text: '——彼方的作者是这样留言的。' },
        { expression: 'normal', text: '那么，我转达到位了！' },
        { expression: 'normal2', text: '玩得开心哦。' },
    ],
    board: [
        { expression: 'happy', text: '来自2026年9月16日夜晚的更新的优化通知！' },
        { expression: 'normal', text: '我给你读一下哦！' },
        { expression: 'normal', text: '之前角色不会把鱼批量卖艾文，现在他们可以了，当他们在市场板的时候，可以这样做', quoted: true },
        { expression: 'curious', text: '诶——之前不行的吗！' },
        { expression: 'embarrassed', text: '怪不得艾文说感觉池子里的鱼越来越少了……' },
        { expression: 'normal', text: '此外，本次更新了市场板玩法，npc发布的内容可能附带了一场隐藏事件', quoted: true },
        { expression: 'normal2', text: '就是这些，感觉会很有意思！' },
        { expression: 'happy', text: '那么，玩得开心！' },
    ],
};

const acknowledged = new Set<SARUpdateNotice>();
export const sarUpdateNoticeKey = (notice: SARUpdateNotice) => notice === 'board'
    ? 'sar-feature-update-2026-09-16-bulk-fish-v1:board'
    : `sar-feature-update-september-v1:${notice}`;

export function hasReadSARUpdateNotice(notice: SARUpdateNotice): boolean {
    if (acknowledged.has(notice)) return true;
    try { return localStorage.getItem(sarUpdateNoticeKey(notice)) === 'done'; }
    catch { return false; }
}

/** Called only after the final line. Interrupted visits leave the notice unread. */
export function acknowledgeSARUpdateNotice(notice: SARUpdateNotice): void {
    acknowledged.add(notice);
    try { localStorage.setItem(sarUpdateNoticeKey(notice), 'done'); }
    catch { /* Storage unavailable: remember completion for this session. */ }
}
