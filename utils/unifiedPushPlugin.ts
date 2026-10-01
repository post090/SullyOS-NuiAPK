import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { BrowserPushState } from './pushSubscribeShared';
import { ActiveMsgStore } from './activeMsgStore';

export interface UnifiedPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  distributor: string;
  temporary: boolean;
  vapidPublicKey: string;
}

export interface UnifiedPushStatus {
  native: boolean;
  distributors: string[];
  distributor: string | null;
  subscription: UnifiedPushSubscription | null;
  lastError: string | null;
  permission: 'granted' | 'denied' | 'prompt';
}

export interface UnifiedPushStoredMessage {
  payload: string;
  receivedAt: number;
}

interface UnifiedPushNativePlugin {
  getStatus(): Promise<Omit<UnifiedPushStatus, 'permission'>>;
  register(options: { vapidPublicKey: string }): Promise<{ pending: boolean }>;
  unregister(): Promise<void>;
  drainPendingPushes(): Promise<{ messages: UnifiedPushStoredMessage[]; launchPayload?: string }>;
  configurePoll(options: {
    workerUrl?: string;
    serverToken?: string;
    userId?: string;
    masterKey?: string;
  }): Promise<void>;
  getPollStatus(): Promise<{ enabled: boolean; cursor: number; adopted: boolean; lastRunAt: number; lastError: string | null }>;
  addListener(
    eventName: 'pushReceived' | 'notificationTapped' | 'registrationChanged',
    listener: (event: any) => void,
  ): Promise<PluginListenerHandle>;
}

const NativeUnifiedPush = registerPlugin<UnifiedPushNativePlugin>('AmsgUnifiedPush');

export const isUnifiedPushPlatform = (): boolean =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

const readPermission = async (): Promise<UnifiedPushStatus['permission']> => {
  const result = await LocalNotifications.checkPermissions();
  if (result.display === 'granted') return 'granted';
  if (result.display === 'denied') return 'denied';
  return 'prompt';
};

export const getUnifiedPushStatus = async (): Promise<UnifiedPushStatus> => {
  if (!isUnifiedPushPlatform()) {
    return {
      native: false,
      distributors: [],
      distributor: null,
      subscription: null,
      lastError: null,
      permission: 'denied',
    };
  }

  const [status, permission] = await Promise.all([
    NativeUnifiedPush.getStatus(),
    readPermission(),
  ]);
  return { ...status, permission };
};

const requireNotificationPermission = async (): Promise<void> => {
  const current = await LocalNotifications.checkPermissions();
  const result = current.display === 'prompt'
    ? await LocalNotifications.requestPermissions()
    : current;
  if (result.display !== 'granted') {
    throw new Error('通知权限未授予，UnifiedPush 收到消息后无法显示系统通知。');
  }
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 获取一条标准 Web Push 订阅，可直接交给 AMSG Worker。 */
export const ensureUnifiedPushSubscription = async (
  vapidPublicKey: string,
): Promise<{ endpoint: string; keys: { p256dh: string; auth: string } }> => {
  if (!isUnifiedPushPlatform()) throw new Error('UnifiedPush 仅用于 Android 原生 App。');
  await requireNotificationPermission();

  const before = await NativeUnifiedPush.getStatus();
  if (!before.distributor && before.distributors.length === 0) {
    throw new Error('没有检测到 UnifiedPush 服务。请先安装并打开 ntfy 的无 Firebase 版本，允许它后台运行后再试。');
  }

  await NativeUnifiedPush.register({ vapidPublicKey });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const status = await NativeUnifiedPush.getStatus();
    const subscription = status.subscription;
    if (
      subscription?.endpoint
      && subscription.keys?.p256dh
      && subscription.keys?.auth
      && subscription.vapidPublicKey === vapidPublicKey
    ) {
      return { endpoint: subscription.endpoint, keys: subscription.keys };
    }
    if (status.lastError) throw new Error(`UnifiedPush 注册失败：${status.lastError}`);
    await delay(250);
  }

  throw new Error('UnifiedPush 注册超时。请确认 ntfy 已打开并允许它在后台运行。');
};

/** 把 UnifiedPush 现状翻成「推送订阅状态」面板吃的那份读数。只读，不弹权限框。 */
export const readUnifiedPushPanelState = async (): Promise<BrowserPushState> => {
  const base: BrowserPushState = {
    supported: false,
    capabilityGap: null,
    permission: 'unavailable',
    swScope: null,
    swState: 'none',
    endpoint: null,
    endpointDead: false,
    channel: 'UnifiedPush',
    iosNeedsPwa: false,
    capacitorNative: true,
    transport: 'unified-push',
    distributor: null,
    distributorCount: 0,
    nativeError: null,
    lastSubscribeFailure: null,
  };
  try {
    const status = await getUnifiedPushStatus();
    const poll = await getNativePollStatus().catch(() => null);
    const distributor = status.distributor || status.subscription?.distributor || null;
    // 没装 ntfy 但内置拉取在跑：endpoint 用占位订阅，面板据此把「云端登记」比对出来。
    const usingPoll = !status.subscription?.endpoint && Boolean(poll?.enabled);
    return {
      ...base,
      transport: usingPoll ? 'native-poll' as const : 'unified-push' as const,
      supported: Boolean(distributor) || status.distributors.length > 0 || usingPoll,
      permission: status.permission === 'prompt' ? 'default' : status.permission,
      endpoint: status.subscription?.endpoint || (usingPoll ? NATIVE_POLL_SUBSCRIPTION.endpoint : null),
      channel: status.subscription?.endpoint
        ? `UnifiedPush（${distributor || 'ntfy'}）`
        : usingPoll
          ? '内置定时拉取（每 15 分钟左右）'
          : 'UnifiedPush（未选推送服务）',
      distributor,
      distributorCount: status.distributors.length,
      nativeError: status.lastError || poll?.lastError,
    };
  } catch (error) {
    return { ...base, nativeError: `原生推送桥不可用：${(error as Error)?.message || error}` };
  }
};

export const readUnifiedPushSubscription = async () =>
  (await getUnifiedPushStatus()).subscription;

// ─── 内置拉取（native poll）：没装 ntfy 时的兜底 ──────────────────────────────
// App 自己不带推送服务时，由原生侧 WorkManager 每隔约 15 分钟去 Worker 的
// GET /outbox 拉一次。Worker 对 poll: 订阅把推送视为已送达（nativeFcm.ts），所以
// 消息一定在 outbox 里等着。这里只负责：把凭据交给原生侧排班，以及给 worker
// 登记一份能过闸门的订阅（shape 只要 endpoint 非空即可）。

/** 登记到 Worker 用的占位订阅：endpoint 带 poll: 前缀，Worker 那侧按已送达处理。 */
export const NATIVE_POLL_SUBSCRIPTION = {
  endpoint: 'poll:android',
  keys: { p256dh: 'poll', auth: 'poll' },
} as const;

export const getNativePollStatus = () => NativeUnifiedPush.getPollStatus();

/** 开启内置拉取（要通知权限，要已连上 Worker 且本地存有主密钥）。 */
export const enableNativePollPull = async (): Promise<
  { endpoint: string; keys: { p256dh: string; auth: string } }
> => {
  if (!isUnifiedPushPlatform()) throw new Error('内置拉取仅用于 Android 原生 App。');
  await requireNotificationPermission();
  const config = await ActiveMsgStore.getGlobalConfig();
  const workerUrl = config.workerUrl?.trim();
  const masterKey = config.masterKey?.trim();
  if (!workerUrl) throw new Error('内置拉取需要先在主动消息 2.0 里连上 Worker。');
  if (!masterKey) throw new Error('本地没有存主密钥（AMSG_MASTER_KEY）。手动部署 Worker 且没存过密钥的话，重新走一遍「连接」，或改用 ntfy。');
  const userId = await ActiveMsgStore.ensureUserId();
  await NativeUnifiedPush.configurePoll({
    workerUrl,
    serverToken: config.serverToken?.trim() || '',
    userId,
    masterKey,
  });
  return { endpoint: NATIVE_POLL_SUBSCRIPTION.endpoint, keys: { ...NATIVE_POLL_SUBSCRIPTION.keys } };
};

/**
 * 内置拉取的总开关，跟着 ntfy 的有无走：ntfy 有活订阅就停掉拉取（免得双通道重复弹），
 * 没有 ntfy 且 Worker 已连上（含主密钥）就排上。返回「现在是否在用内置拉取」。
 */
export const syncNativePollMode = async (): Promise<boolean> => {
  if (!isUnifiedPushPlatform()) return false;
  try {
    const status = await NativeUnifiedPush.getStatus();
    if (status.subscription?.endpoint) {
      await NativeUnifiedPush.configurePoll({});
      return false;
    }
    const config = await ActiveMsgStore.getGlobalConfig();
    const workerUrl = config.workerUrl?.trim();
    const masterKey = config.masterKey?.trim();
    if (workerUrl && masterKey) {
      const userId = await ActiveMsgStore.ensureUserId();
      await NativeUnifiedPush.configurePoll({
        workerUrl,
        serverToken: config.serverToken?.trim() || '',
        userId,
        masterKey,
      });
      return true;
    }
    await NativeUnifiedPush.configurePoll({});
    return false;
  } catch (error) {
    console.warn('[amsg] 内置拉取开关没设成（下次启动/回连再试）', error);
    return false;
  }
};

export const drainUnifiedPushMessages = () => NativeUnifiedPush.drainPendingPushes();

export const addUnifiedPushListener = (
  eventName: 'pushReceived' | 'notificationTapped' | 'registrationChanged',
  listener: (event: any) => void,
) => NativeUnifiedPush.addListener(eventName, listener);
