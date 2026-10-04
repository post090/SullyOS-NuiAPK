import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ActiveMsgClient } from './activeMsgClient';
import { ActiveMsgStore } from './activeMsgStore';
import { flushInboxToChat, prepareInboxBeforeChat } from './activeMsgRuntime';
import { DB } from './db';
import { loadCharacterContextRange } from './chatContextRange';

beforeAll(() => {
  (globalThis as any).window ??= { dispatchEvent: () => true };
});

describe('生成前快速收件', () => {
  const saveIncoming = async (charId: string, extra: Record<string, unknown> = {}) => {
    await DB.saveCharacter({ id: charId, name: '小明' } as any);
    await ActiveMsgStore.saveInboxMessage({
      messageId: charId, charId, charName: '小明', body: '刚才说的话',
      messageType: 'text', receivedAt: Date.now(), ...extra,
    });
  };

  it('新鲜正文不等打字，读取下一轮上下文时已包含正文；其他角色不被认领，不拉云端账本', async () => {
    await saveIncoming('prepare-current');
    await saveIncoming('prepare-other');
    const outbox = vi.spyOn(ActiveMsgClient, 'listOutboxEntries').mockRejectedValue(new Error('不该拉云端'));
    vi.spyOn(ActiveMsgClient, 'ackOutboxMessages').mockResolvedValue(undefined);
    await prepareInboxBeforeChat('prepare-current');
    const context = await loadCharacterContextRange({ id: 'prepare-current', name: '小明' } as any);
    expect(context.messages.map(m => m.content)).toContain('刚才说的话');
    expect((await ActiveMsgStore.listInboxMessages()).map(m => m.charId)).toContain('prepare-other');
    expect(outbox).not.toHaveBeenCalled();
    await ActiveMsgStore.consumeInboxMessages();
  });

  it('附带数据没取完时继续等待，到 30 秒放行；迟到结果仍落库且只销账一次', async () => {
    await saveIncoming('prepare-slow', { metadata: { amsgReasoningRef: 'reasoning-slow' } });
    let release!: (value: string) => void;
    let markReadStarted!: () => void;
    const readStarted = new Promise<void>(resolve => { markReadStarted = resolve; });
    vi.spyOn(ActiveMsgClient, 'readClientStateValue').mockImplementation(() => new Promise(resolve => {
      release = resolve;
      markReadStarted();
    }));
    vi.spyOn(ActiveMsgClient, 'clearClientStateValue').mockResolvedValue(undefined);
    const ack = vi.spyOn(ActiveMsgClient, 'ackOutboxMessages').mockResolvedValue(undefined);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      let finished = false;
      const waiting = prepareInboxBeforeChat('prepare-slow').then(result => { finished = true; return result; });
      await readStarted;
      await vi.advanceTimersByTimeAsync(29_999);
      expect(finished, '不应在 200ms 就提前放弃等待').toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(await waiting).toBe('timeout');
      expect(await DB.getRecentMessagesByCharId('prepare-slow', 20)).toHaveLength(0);
      expect(ack).not.toHaveBeenCalled();
    } finally {
      release('思考');
      await flushInboxToChat('本地巡查');
      vi.useRealTimers();
    }
    expect((await DB.getRecentMessagesByCharId('prepare-slow', 20)).map(m => m.content)).toEqual(['刚才说的话']);
    expect(ack).toHaveBeenCalledTimes(1);
  });

  it('当前角色已经在慢放，生成前收件会结束正在等待的打字动画，正文不重复', async () => {
    await saveIncoming('prepare-inflight');
    vi.spyOn(ActiveMsgClient, 'ackOutboxMessages').mockResolvedValue(undefined);
    const originalTimeout = globalThis.setTimeout;
    let beganTyping!: () => void;
    const typingStarted = new Promise<void>(resolve => { beganTyping = resolve; });
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: any, delay?: number, ...args: any[]) => {
      if (delay === 500) beganTyping();
      return originalTimeout(callback, delay, ...args);
    }) as typeof setTimeout);
    const flush = flushInboxToChat('SW通知');
    await typingStarted;
    await prepareInboxBeforeChat('prepare-inflight');
    expect((await DB.getRecentMessagesByCharId('prepare-inflight', 20)).map(m => m.content)).toEqual(['刚才说的话']);
    await flush;
  });

  it('收件箱是空的：不认领、不排队，别的角色卡在取附带数据也不用等', async () => {
    await ActiveMsgStore.consumeInboxMessages();
    const consume = vi.spyOn(ActiveMsgStore, 'consumeInboxMessages');
    expect(await prepareInboxBeforeChat('prepare-empty')).toBe('completed');
    expect(consume).not.toHaveBeenCalled();
    consume.mockRestore();

    await saveIncoming('prepare-stuck-other', { metadata: { amsgReasoningRef: 'reasoning-stuck' } });
    let release!: (value: string) => void;
    let markReadStarted!: () => void;
    const readStarted = new Promise<void>(resolve => { markReadStarted = resolve; });
    vi.spyOn(ActiveMsgClient, 'readClientStateValue').mockImplementation(() => new Promise(resolve => {
      release = resolve;
      markReadStarted();
    }));
    vi.spyOn(ActiveMsgClient, 'clearClientStateValue').mockResolvedValue(undefined);
    vi.spyOn(ActiveMsgClient, 'ackOutboxMessages').mockResolvedValue(undefined);
    const flush = flushInboxToChat('SW通知');
    await readStarted;
    // 那趟冲刷还卡着；这里要是排到它后面，测试会一直挂到超时。
    expect(await prepareInboxBeforeChat('prepare-empty')).toBe('completed');
    release('思考');
    await flush;
  });

  it('别的角色正在慢放时，生成前收件让它立刻放完，当前角色的消息照常进上下文', async () => {
    const sentAt = Date.now();
    await saveIncoming('prepare-typing-other', { sentAt: sentAt - 1 });
    await saveIncoming('prepare-typing-current', { sentAt });
    vi.spyOn(ActiveMsgClient, 'ackOutboxMessages').mockResolvedValue(undefined);
    const originalTimeout = globalThis.setTimeout;
    let beganTyping!: () => void;
    const typingStarted = new Promise<void>(resolve => { beganTyping = resolve; });
    // 打字等待的定时器不放行：只有被生成前收件中止才结束得了。
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: any, delay?: number, ...args: any[]) => {
      if (delay === 500) { beganTyping(); return 0 as any; }
      return originalTimeout(callback, delay, ...args);
    }) as typeof setTimeout);
    const flush = flushInboxToChat('SW通知');
    await typingStarted;
    expect(await prepareInboxBeforeChat('prepare-typing-current')).toBe('completed');
    expect((await DB.getRecentMessagesByCharId('prepare-typing-current', 20)).map(m => m.content)).toEqual(['刚才说的话']);
    await flush;
  });

  it('后段先到、前段还没来：消息被扣在收件箱，结果如实报 pending', async () => {
    vi.spyOn(ActiveMsgClient, 'ackOutboxMessages').mockResolvedValue(undefined);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      await saveIncoming('prepare-held', {
        metadata: { sessionId: 'prepare-held-session', messageIndex: 2, totalMessages: 2 },
      });
      expect(await prepareInboxBeforeChat('prepare-held')).toBe('pending');
      expect(await DB.getRecentMessagesByCharId('prepare-held', 20)).toHaveLength(0);
    } finally {
      await ActiveMsgStore.consumeInboxMessages();
      vi.useRealTimers();
    }
  });

  it('一趟收件让人等到超时后：它跑完之前再发送不再等，跑完之后恢复正常', async () => {
    await saveIncoming('prepare-again', { metadata: { amsgReasoningRef: 'reasoning-again' } });
    let release!: (value: string) => void;
    let markReadStarted!: () => void;
    const readStarted = new Promise<void>(resolve => { markReadStarted = resolve; });
    vi.spyOn(ActiveMsgClient, 'readClientStateValue').mockImplementation(() => new Promise(resolve => {
      release = resolve;
      markReadStarted();
    }));
    vi.spyOn(ActiveMsgClient, 'clearClientStateValue').mockResolvedValue(undefined);
    vi.spyOn(ActiveMsgClient, 'ackOutboxMessages').mockResolvedValue(undefined);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let flush: Promise<unknown>;
    try {
      const first = prepareInboxBeforeChat('prepare-again');
      await readStarted;
      await vi.advanceTimersByTimeAsync(30_000);
      expect(await first).toBe('timeout');
      // 那趟收件还卡着：第二次不再等 30 秒，也不再报 timeout。
      expect(await prepareInboxBeforeChat('prepare-again')).toBe('stalled');
    } finally {
      release('思考');
      vi.useRealTimers();
      flush = flushInboxToChat('本地巡查');
    }
    await flush;
    expect((await DB.getRecentMessagesByCharId('prepare-again', 20)).map(m => m.content)).toEqual(['刚才说的话']);
    expect(await prepareInboxBeforeChat('prepare-again')).toBe('completed');
  });

  it('等重试的消息留给重试定时器：生成前收件不重跑它，也不消耗重试次数', async () => {
    vi.spyOn(ActiveMsgClient, 'ackOutboxMessages').mockResolvedValue(undefined);
    await saveIncoming('prepare-retrying', { processAttempts: 1 });
    expect(await prepareInboxBeforeChat('prepare-retrying')).toBe('pending');
    const left = (await ActiveMsgStore.listInboxMessages()).filter(m => m.charId === 'prepare-retrying');
    expect(left.map(m => m.processAttempts)).toEqual([1]);
    expect(await DB.getRecentMessagesByCharId('prepare-retrying', 20)).toHaveLength(0);
    await ActiveMsgStore.consumeInboxMessages();
  });

  it('收件箱里只有别的角色的消息、且别的角色那趟还卡着：当前角色不排队', async () => {
    await saveIncoming('prepare-busy-other', { metadata: { amsgReasoningRef: 'reasoning-busy' } });
    let release!: (value: string) => void;
    let markReadStarted!: () => void;
    const readStarted = new Promise<void>(resolve => { markReadStarted = resolve; });
    vi.spyOn(ActiveMsgClient, 'readClientStateValue').mockImplementation(() => new Promise(resolve => {
      release = resolve;
      markReadStarted();
    }));
    vi.spyOn(ActiveMsgClient, 'clearClientStateValue').mockResolvedValue(undefined);
    vi.spyOn(ActiveMsgClient, 'ackOutboxMessages').mockResolvedValue(undefined);
    const flush = flushInboxToChat('SW通知');
    await readStarted;
    // 那趟卡住之后又到了一条别的角色的消息，躺在收件箱里。
    await ActiveMsgStore.saveInboxMessage({
      messageId: 'prepare-busy-other-2', charId: 'prepare-busy-other', charName: '小明', body: '又一句',
      messageType: 'text', receivedAt: Date.now(),
    });
    expect(await prepareInboxBeforeChat('prepare-quiet')).toBe('completed');
    release('思考');
    await flush;
    await flushInboxToChat('本地巡查');
  });
});
afterEach(() => { vi.restoreAllMocks(); });

describe('已发送的主动消息', () => {
  it('通知到达后用户刚好回复，已到 inbox 的三个分段仍全部落库', async () => {
    const charId = 'delivered-before-user-reply';
    const sentAt = Date.now() - 1_000;
    await DB.saveCharacter({ id: charId, name: '小明' } as any);
    await DB.saveMessage({ charId, role: 'user', type: 'text', content: '我帮你选', timestamp: sentAt + 500 });
    const ack = vi.spyOn(ActiveMsgClient, 'ackOutboxMessages').mockResolvedValue(undefined);
    const clear = vi.spyOn(ActiveMsgClient, 'clearClientStateValue').mockResolvedValue(undefined);
    for (const index of [3, 1, 2]) {
      await ActiveMsgStore.saveInboxMessage({
        messageId: `delivered-${index}`, charId, charName: '小明', body: `消息${index}`,
        source: 'scheduled', messageType: 'text', recurrenceType: 'none',
        occurrenceMs: sentAt - 10_000, receivedAt: sentAt, sentAt,
        metadata: {
          charId, amsgExpirePolicy: 'expire', amsgClientTaskId: 'delivered-task',
          sessionId: 'delivered-session', messageIndex: index, totalMessages: 3,
          amsgOutboxBackfill: true,
        },
      });
    }
    await flushInboxToChat('SW通知');
    const messages = await DB.getRecentMessagesByCharId(charId, 20);
    expect(messages.filter(m => m.role === 'assistant').map(m => m.content)).toEqual(['消息1', '消息2', '消息3']);
    expect(ack).toHaveBeenCalledWith(['delivered-1', 'delivered-2', 'delivered-3']);
    expect(clear).not.toHaveBeenCalled();
  });
});

describe('按角色认领 inbox', () => {
  it('只认领指定角色，其他角色留在 inbox；并发认领不重复', async () => {
    for (const charId of ['claim-current', 'claim-other']) {
      await ActiveMsgStore.saveInboxMessage({
        messageId: charId, charId, charName: '小明', body: '收到', receivedAt: Date.now(),
      });
    }
    const claims = await Promise.all([
      ActiveMsgStore.consumeInboxMessages('claim-current'),
      ActiveMsgStore.consumeInboxMessages('claim-current'),
    ]);
    expect(claims.flat().map(m => m.messageId)).toEqual(['claim-current']);
    expect((await ActiveMsgStore.listInboxMessages()).map(m => m.messageId)).toContain('claim-other');
    await ActiveMsgStore.consumeInboxMessages();
  });
});
