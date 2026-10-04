import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// 同一轮回复拆成多条 push，每条都会派发一次 'active-msg-received'。
// 全局提示必须按轮次合并，未读和系统通知不受影响。
describe('active message toast dedupe wiring', () => {
  it('runtime tags every landed chunk with its round key', () => {
    const source = readFileSync(path.resolve(__dirname, './activeMsgRuntime.ts'), 'utf8');
    expect(source).toContain('roundKey: message.taskUuid || getInstantSessionId(message) || undefined');
  });

  it('OSContext toasts once per round but still counts every unread chunk', () => {
    const source = readFileSync(path.resolve(__dirname, '../context/OSContext.tsx'), 'utf8');
    expect(source).toContain('const repeatRound = isRepeatRound(charId, roundKey);');
    expect(source).toContain("if (!repeatRound) addToast(`${charName} 给你发了消息`, 'success');");
    expect(source).toContain('} else if (!repeatRound) {');
    // 未读累加仍在去重判断之外，每段都 +1
    const handlerStart = source.indexOf('const repeatRound = isRepeatRound(charId, roundKey);');
    const unreadAt = source.indexOf('setUnreadMessages(prev => ({ ...prev, [charId]: (prev[charId] || 0) + 1 }));', handlerStart);
    expect(unreadAt).toBeGreaterThan(handlerStart);
  });
});
