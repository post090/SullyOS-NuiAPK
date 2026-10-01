import type { ActiveMsg2InboxMessage } from '../types';
import { flushInboxToChat, handleInstantErrorPushMessage } from './activeMsgRuntime';
import { ActiveMsgStore } from './activeMsgStore';
import { dispatchAmsgResult } from './amsgResults';

const RECEIVED_IDS_KEY = 'amsg2_native_received_ids_v2';

const readReceivedIds = (): string[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECEIVED_IDS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
};

const rememberReceivedId = (messageId: string): void => {
  const next = [messageId, ...readReceivedIds().filter((id) => id !== messageId)].slice(0, 100);
  localStorage.setItem(RECEIVED_IDS_KEY, JSON.stringify(next));
};

export const parseNativeAmsgPayload = (raw: unknown): Record<string, any> | null => {
  if (raw && typeof raw === 'object') return raw as Record<string, any>;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, any> : null;
  } catch {
    return null;
  }
};

/** 把 UnifiedPush 收到的标准 AMSG content payload 送进 master 现有的 inbox 管线。 */
export const ingestNativeAmsgPayload = async (
  raw: unknown,
  previewOverride?: string,
): Promise<{ charId: string; messageId: string } | null> => {
  const payload = parseNativeAmsgPayload(raw);
  const charId = payload?.metadata?.charId;
  if (!payload || typeof charId !== 'string' || !charId) return null;

  const messageId = String(payload.messageId || `${charId}-${Date.now()}`);
  if (readReceivedIds().includes(messageId)) return { charId, messageId };

  const parsedSentAt = payload.timestamp ? new Date(payload.timestamp).getTime() : NaN;
  const body = String(payload.message || payload.body || '').trim();
  const notificationBody = typeof payload.notification?.body === 'string'
    ? payload.notification.body.trim()
    : '';
  const inbox: ActiveMsg2InboxMessage = {
    messageId,
    charId,
    charName: String(payload.contactName || payload.metadata?.charName || '主动消息'),
    body,
    previewBody: String(previewOverride || notificationBody || payload.previewBody || body).trim(),
    avatarUrl: payload.avatarUrl,
    source: payload.source,
    messageType: payload.messageType,
    messageSubtype: payload.messageSubtype,
    taskId: payload.taskId ?? null,
    taskUuid: payload.taskUuid ?? null,
    recurrenceType: payload.recurrenceType ?? null,
    occurrenceMs: payload.occurrenceMs ?? null,
    metadata: {
      ...(payload.metadata || {}),
      sessionId: payload.sessionId,
      messageIndex: payload.messageIndex,
      totalMessages: payload.totalMessages,
    },
    sentAt: Number.isFinite(parsedSentAt) ? parsedSentAt : Date.now(),
    receivedAt: Date.now(),
  };

  await ActiveMsgStore.saveInboxMessage(inbox);
  rememberReceivedId(messageId);
  await flushInboxToChat('原生收件箱');
  return { charId, messageId };
};

const ingestEmotionUpdate = async (payload: Record<string, any>): Promise<void> => {
  const charId = payload.metadata?.charId;
  if (typeof charId !== 'string' || !charId) return;
  const messageId = String(payload.messageId || `${charId}-emotion-${Date.now()}`);
  if (readReceivedIds().includes(messageId)) return;
  const now = Date.now();
  await ActiveMsgStore.saveInboxMessage({
    messageId,
    charId,
    charName: String(payload.contactName || ''),
    body: '',
    messageType: 'emotion_update',
    metadata: { charId, emotionRaw: payload.metadata?.emotionRaw || '' },
    sentAt: now,
    receivedAt: now,
  } as ActiveMsg2InboxMessage);
  rememberReceivedId(messageId);
  await flushInboxToChat('原生收件箱');
};

/**
 * 按 messageKind 分轨，和 Service Worker（worker/sw-keep-alive.ts saveIncomingActiveMessage）
 * 保持一致：content 进收件箱，emotion_update 静默进收件箱，error 交给即时对话收尾，
 * result 交给结果分发口，未知类型按 content 处理。只有 content 返回可跳转的角色。
 */
export const routeNativeAmsgPayload = async (
  raw: unknown,
): Promise<{ charId: string; messageId: string } | null> => {
  const payload = parseNativeAmsgPayload(raw);
  if (!payload) return null;
  const messageKind = typeof payload.messageKind === 'string' ? payload.messageKind : 'content';
  switch (messageKind) {
    case 'emotion_update':
      await ingestEmotionUpdate(payload);
      return null;
    case 'error':
      await handleInstantErrorPushMessage({
        code: payload.code,
        message: payload.message,
        charId: payload.metadata?.charId,
        metadata: payload.metadata,
      });
      return null;
    case 'result':
      await dispatchAmsgResult(payload);
      return null;
    default:
      return ingestNativeAmsgPayload(payload);
  }
};
