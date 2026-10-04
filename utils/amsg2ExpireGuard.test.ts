// utils/amsg2ExpireGuard.test.ts
import { describe, it, expect } from 'vitest';
import { getLastRealUserMessageAt, recurrencePeriodMs } from './amsg2ExpireGuard';

const user = (timestamp: number, proactiveHint = false) => ({
  role: 'user', timestamp, metadata: proactiveHint ? { proactiveHint: true } : undefined,
});
const assistantPush = (timestamp: number, taskId: string | null = 't1') => ({
  role: 'assistant', timestamp, metadata: { source: 'active_msg_2', activeMsg2: { taskId } },
});

describe('共用叶子', () => {
  it('getLastRealUserMessageAt 跳过 proactiveHint 和 assistant', () => {
    expect(getLastRealUserMessageAt([user(1), assistantPush(2), user(3, true)])).toBe(1);
    expect(getLastRealUserMessageAt([assistantPush(2)])).toBe(null);
  });

  it('recurrencePeriodMs：每日 / 每周有周期，一次性没有', () => {
    expect(recurrencePeriodMs('daily')).toBe(24 * 3600_000);
    expect(recurrencePeriodMs('weekly')).toBe(7 * 24 * 3600_000);
    expect(recurrencePeriodMs('none')).toBeNull();
    expect(recurrencePeriodMs(undefined)).toBeNull();
  });
});
