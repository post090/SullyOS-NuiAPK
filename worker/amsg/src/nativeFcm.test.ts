import { describe, expect, it, vi } from 'vitest';
import { buildFcmMessage, createHybridPushTransport, fcmTokenFromEndpoint } from './nativeFcm';

describe('AMSG2 native FCM transport', () => {
  it('普通 Web Push endpoint 原样委托旧发送器', async () => {
    const sendNotification = vi.fn().mockResolvedValue('web-ok');
    const transport = createHybridPushTransport({}, { sendNotification });
    const subscription = { endpoint: 'https://push.example/sub', keys: { p256dh: 'a', auth: 'b' } };
    await expect(transport.sendNotification(subscription, '{"message":"hi"}')).resolves.toBe('web-ok');
    expect(sendNotification).toHaveBeenCalledWith(subscription, '{"message":"hi"}');
  });

  it('只有 fcm: endpoint 才识别为原生 token', () => {
    expect(fcmTokenFromEndpoint('fcm:abc:123')).toBe('abc:123');
    expect(fcmTokenFromEndpoint('https://push.example/sub')).toBeNull();
    expect(fcmTokenFromEndpoint('fcm:   ')).toBeNull();
  });

  it('poll: endpoint 视为已送达（消息已进 outbox，App 会来拉），不走任何发送器', async () => {
    const sendNotification = vi.fn().mockResolvedValue('web-ok');
    const transport = createHybridPushTransport({}, { sendNotification });
    const result = await transport.sendNotification(
      { endpoint: 'poll:android', keys: { p256dh: 'poll', auth: 'poll' } },
      '{"message":"hi"}',
    );
    expect(result).toEqual({ statusCode: 200, poll: true });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('正文只放 notification 一份，data 保留 AMSG2 路由字段', () => {
    const request = buildFcmMessage('token', JSON.stringify({
      messageId: 'm1', message: '你好', contactName: 'Sully',
      metadata: { charId: 'char-1', activeMsg2: true },
    }));
    expect(request.message.notification).toEqual({ title: 'Sully', body: '你好' });
    expect(request.message.data.amsgHasBody).toBe('1');
    const portable = JSON.parse(request.message.data.amsgPayload);
    expect(portable.message).toBeUndefined();
    expect(portable.metadata.charId).toBe('char-1');
  });
});

