import { ActiveMsgClient } from './activeMsgClient';
import { parseNativeAmsgPayload, routeNativeAmsgPayload } from './nativeAmsgInbox';
import { addUnifiedPushListener, drainUnifiedPushMessages, isUnifiedPushPlatform } from './unifiedPushPlugin';

let initialized = false;

const openChat = (charId: unknown): void => {
  if (typeof charId !== 'string' || !charId) return;
  window.dispatchEvent(new CustomEvent('active-msg-open', { detail: { charId } }));
};

const ingest = async (payload: unknown, openAfter = false): Promise<void> => {
  try {
    const result = await routeNativeAmsgPayload(payload);
    if (openAfter) openChat(result?.charId ?? parseNativeAmsgPayload(payload)?.metadata?.charId);
  } catch (error) {
    console.warn('[amsg] UnifiedPush payload 处理失败', error);
  }
};

const reconcile = async (): Promise<void> => {
  try {
    await ActiveMsgClient.reconcilePushSubscription();
  } catch (error) {
    console.warn('[amsg] UnifiedPush 订阅重新登记失败', error);
  }
};

export const initUnifiedPushRuntime = async (): Promise<void> => {
  if (initialized || !isUnifiedPushPlatform()) return;
  initialized = true;

  await addUnifiedPushListener('pushReceived', (event) => {
    void ingest(event?.payload);
  });
  await addUnifiedPushListener('notificationTapped', (event) => {
    void ingest(event?.payload, true);
  });
  await addUnifiedPushListener('registrationChanged', () => {
    void reconcile();
  });

  const pending = await drainUnifiedPushMessages();
  for (const message of pending.messages || []) {
    await ingest(message.payload);
  }

  if (pending.launchPayload) {
    await ingest(pending.launchPayload, true);
  }

  void reconcile();
};
