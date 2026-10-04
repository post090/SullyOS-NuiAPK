// utils/amsg2ExpireGuard.ts
/**
 * amsg2 到点策略的共用叶子：策略类型、触发时刻的宽限、「真实用户消息」的判定。
 *
 * ⚠️ 叶子模块：会被 worker/amsg 打进 Cloudflare bundle，同时被浏览器侧复用——不得
 * import 浏览器 / DB / React 依赖（与 utils/agenticTools.ts 同一约束）。
 *
 * 两种策略（任务 metadata.amsgExpirePolicy）：
 *   - expire（默认）：到点时如果有一轮回复正在生成，等它结束再生成这条；生成时角色看着
 *     最新的对话自己决定说不说（提示词里那段「开口之前」）。没发的那次由云端回一条结果，
 *     客户端记进回执台账，下一轮聊天时告诉角色（见 amsgFireSkipResult）。
 *   - force：闹钟型，准点照发，不等。
 */

export type AmsgExpirePolicy = 'expire' | 'force';

/** 触发时刻附近的推理/送达宽限（fire 后 10-30s 才送达，判定窗口向后放这么多）。 */
export const FIRE_GRACE_MS = 90_000;

const DAY_MS = 24 * 3600_000;

/** 循环任务两次触发之间隔多久；一次性任务没有周期，返回 null。 */
export const recurrencePeriodMs = (recurrenceType: string | undefined): number | null =>
  recurrenceType === 'daily' ? DAY_MS
    : recurrenceType === 'weekly' ? 7 * DAY_MS
      : null;

export interface RealUserMessageLike {
  role: string;
  timestamp: number;
  metadata?: Record<string, unknown> | null;
}

/** 「真实用户消息」定义与 activeMsgClient.buildTimeGapHint 保持一致。 */
const isRealUserMessage = (m: RealUserMessageLike): boolean =>
  m.role === 'user' && !(m.metadata as { proactiveHint?: unknown } | null | undefined)?.proactiveHint;

export function getLastRealUserMessageAt(messages: RealUserMessageLike[]): number | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (isRealUserMessage(messages[i])) return messages[i].timestamp;
  }
  return null;
}
