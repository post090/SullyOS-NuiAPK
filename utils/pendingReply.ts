/**
 * 返回最后一条尚未得到助手回复的用户输入。
 *
 * 见面与通话的消息展示模型字段不同（content / text），但失败重试的判断完全相同：
 * 只有时间线最后一条仍是 user 时，才表示上一轮可能在生成回复前中断。
 */
export function getPendingReplyText(
    messages: Array<{ role?: string; content?: unknown; text?: unknown }>,
): string {
    const latest = messages[messages.length - 1];
    if (!latest || latest.role !== 'user') return '';
    const raw = latest.content ?? latest.text ?? '';
    return typeof raw === 'string' ? raw.trim() : '';
}
