import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  saveInboxMessage: vi.fn().mockResolvedValue(undefined),
  flushInboxToChat: vi.fn().mockResolvedValue(undefined),
  handleInstantErrorPushMessage: vi.fn().mockResolvedValue(undefined),
  dispatchAmsgResult: vi.fn().mockResolvedValue(true),
}));

vi.mock('./activeMsgStore', () => ({
  ActiveMsgStore: { saveInboxMessage: mocks.saveInboxMessage },
}));
vi.mock('./activeMsgRuntime', () => ({
  flushInboxToChat: mocks.flushInboxToChat,
  handleInstantErrorPushMessage: mocks.handleInstantErrorPushMessage,
}));
vi.mock('./amsgResults', () => ({
  dispatchAmsgResult: mocks.dispatchAmsgResult,
}));

import { ingestNativeAmsgPayload, parseNativeAmsgPayload, routeNativeAmsgPayload } from './nativeAmsgInbox';

describe('UnifiedPush payload 入库桥', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.values(mocks).forEach((fn) => fn.mockClear());
  });

  it('接受对象或 JSON 字符串，拒绝无效内容', () => {
    expect(parseNativeAmsgPayload({ message: 'hi' })).toEqual({ message: 'hi' });
    expect(parseNativeAmsgPayload('{"message":"hi"}')).toEqual({ message: 'hi' });
    expect(parseNativeAmsgPayload('not-json')).toBeNull();
  });

  it('把标准 AMSG payload 交给现有 inbox 管线并按 messageId 去重', async () => {
    const payload = {
      messageId: 'msg-up-1',
      message: '该醒啦',
      contactName: '小明',
      timestamp: '2026-08-09T08:00:00.000Z',
      metadata: { charId: 'char-1', charName: '小明' },
    };

    await ingestNativeAmsgPayload(payload);
    await ingestNativeAmsgPayload(payload);

    expect(mocks.saveInboxMessage).toHaveBeenCalledTimes(1);
    expect(mocks.saveInboxMessage).toHaveBeenCalledWith(expect.objectContaining({
      messageId: 'msg-up-1',
      charId: 'char-1',
      body: '该醒啦',
      sentAt: Date.parse('2026-08-09T08:00:00.000Z'),
    }));
    expect(mocks.flushInboxToChat).toHaveBeenCalledTimes(1);
  });

  it('content 与未知类型进收件箱并返回可跳转的角色', async () => {
    const content = await routeNativeAmsgPayload(JSON.stringify({
      messageKind: 'content', messageId: 'c-1', message: '在吗', metadata: { charId: 'char-1' },
    }));
    const unknown = await routeNativeAmsgPayload({
      messageKind: 'something_new', messageId: 'c-2', message: '嗨', metadata: { charId: 'char-2' },
    });

    expect(content).toEqual({ charId: 'char-1', messageId: 'c-1' });
    expect(unknown).toEqual({ charId: 'char-2', messageId: 'c-2' });
    expect(mocks.saveInboxMessage).toHaveBeenCalledTimes(2);
  });

  it('emotion_update 静默写入收件箱，不当成聊天正文', async () => {
    const result = await routeNativeAmsgPayload({
      messageKind: 'emotion_update',
      messageId: 'e-1',
      contactName: '小明',
      message: '不该被当正文',
      metadata: { charId: 'char-1', emotionRaw: '{"mood":"happy"}' },
    });

    expect(result).toBeNull();
    expect(mocks.saveInboxMessage).toHaveBeenCalledWith(expect.objectContaining({
      messageId: 'e-1',
      charId: 'char-1',
      body: '',
      messageType: 'emotion_update',
      metadata: { charId: 'char-1', emotionRaw: '{"mood":"happy"}' },
    }));
    expect(mocks.flushInboxToChat).toHaveBeenCalledTimes(1);
  });

  it('error 交给即时对话收尾，result 交给结果分发口，都不写收件箱', async () => {
    const meta = { charId: 'char-1', taskUuid: 't-1', reason: 'llm_failed' };
    await routeNativeAmsgPayload({ messageKind: 'error', code: 'X', message: '失败', metadata: meta });
    const resultPayload = { messageKind: 'result', resultKind: 'demo', data: { a: 1 } };
    await routeNativeAmsgPayload(resultPayload);

    expect(mocks.handleInstantErrorPushMessage).toHaveBeenCalledWith({
      code: 'X', message: '失败', charId: 'char-1', metadata: meta,
    });
    expect(mocks.dispatchAmsgResult).toHaveBeenCalledWith(resultPayload);
    expect(mocks.saveInboxMessage).not.toHaveBeenCalled();
  });
});
