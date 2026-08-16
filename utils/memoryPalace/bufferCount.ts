import type { Message } from '../../types';

/**
 * 纯计算：记忆宫殿"未同步"缓冲区条数——即真正能被 pipeline 处理的历史消息数。
 *
 * 口径必须和 pipeline 的缓冲区定义一致：
 *   - 排除热区（最后 hotZoneSize 条永远留在上下文，不参与处理）
 *   - 排除已处理（id <= hwm）
 *
 * 切勿退回 "id > hwm" 裸过滤——那会把永远不处理的热区也算进未同步，
 * UI 会显示几百条待处理、用户点了却跑不出新水位，等于骗人。
 * 这个坑已经踩过一次，bufferCount.test.ts 把正确口径钉住了。
 *
 * @param semanticMessages 已过滤成"语义相关"的消息（可不排序，本函数内部按 id 排序）
 * @param hwm 当前高水位标记（id <= hwm 视为已处理）
 * @param hotZoneSize 角色档位解析出的热区大小；旧角色默认 200
 */
export function countUnprocessedBufferMessages(
    semanticMessages: Message[],
    hwm: number,
    hotZoneSize = 200,
): number {
    const sorted = [...semanticMessages].sort((a, b) => a.id - b.id);
    const normalizedHotZoneSize = Math.max(0, Math.floor(hotZoneSize));
    if (sorted.length <= normalizedHotZoneSize) return 0;
    const hotZoneStartId = normalizedHotZoneSize === 0
        ? Number.POSITIVE_INFINITY
        : sorted[sorted.length - normalizedHotZoneSize].id;
    let count = 0;
    for (const m of sorted) {
        if (m.id > hwm && m.id < hotZoneStartId) count++;
    }
    return count;
}

/**
 * 一键存入时按“用户眼里看到的聊天条数”划边界，而不是按语义消息条数划边界。
 * 这样“保留最近 10 条”会精确保留最后 10 条原文；图片、卡片等消息不会让
 * 紫色水位线与橙色原文范围错开。
 */
export function getOneShotTargetHighWaterMark(
    sourceMessages: Message[],
    retainRecentMessages: number,
): number {
    const sortedPrivateMessages = sourceMessages
        .filter(message => !message.groupId)
        .slice()
        .sort((a, b) => a.id - b.id);
    const retained = Math.max(0, Math.floor(retainRecentMessages));
    const targetIndex = sortedPrivateMessages.length - retained - 1;
    return targetIndex >= 0 ? sortedPrivateMessages[targetIndex].id : 0;
}

/** 一键存入实际会交给记忆提取管线的语义消息数。 */
export function countOneShotPendingMessages(
    semanticMessages: Message[],
    sourceMessages: Message[],
    hwm: number,
    retainRecentMessages: number,
): number {
    const targetHighWaterMark = getOneShotTargetHighWaterMark(sourceMessages, retainRecentMessages);
    return semanticMessages.filter(message => (
        message.id > hwm && message.id <= targetHighWaterMark
    )).length;
}
