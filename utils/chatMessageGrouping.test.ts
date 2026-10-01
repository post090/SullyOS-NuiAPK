import { expect, it } from 'vitest';
import { startsNewMessageGroup } from './chatMessageGrouping';

it('保留相隔十四分钟的头像和时间边界，同批短消息仍合组', () => {
    const first = { role: 'assistant' as const, timestamp: 1_000_000 };
    expect(startsNewMessageGroup(first, { ...first, timestamp: first.timestamp + 14 * 60_000 })).toBe(true);
    expect(startsNewMessageGroup(first, { ...first, timestamp: first.timestamp + 5 * 60_000 })).toBe(true);
    expect(startsNewMessageGroup(first, { ...first, timestamp: first.timestamp + 30_000 })).toBe(false);
    expect(startsNewMessageGroup(first, { ...first, role: 'user' })).toBe(true);
    expect(startsNewMessageGroup(null, first)).toBe(true);
});
