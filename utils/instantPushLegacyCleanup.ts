/**
 * 启动时清一次 Instant Push 留在本机的旧数据。
 *
 * 要清的东西：
 *  - localStorage 里的旧配置（含 Worker 地址和 client token）、Worker 更新提醒 / 版本探测 /
 *    下线通知的记账、每个角色的工具调用状态；
 *  - ActiveMsg 库里三张闲置表：outbound_sessions（存着 API key 副本和整段消息快照）、
 *    pending_tool_calls、reasoning_buffer。
 *
 * 只跑一次：清完写标记，之后启动直接返回。IDB 清表失败就不写标记，下次启动再试；
 * localStorage 那几项反正每次都能重删，不影响。任何一步出错都只 warn，不拦启动。
 */
import { ActiveMsgStore } from './activeMsgStore';

export const INSTANT_PUSH_LEGACY_CLEANUP_DONE_KEY = 'sullyos_instant_push_legacy_cleanup_v1';

const LEGACY_LOCAL_STORAGE_KEYS = [
  'instant_push_config_v1',
  'sullyos_worker_build_seen',
  'sullyos_worker_update_snooze_until',
  'sullyos_worker_version_probe_at',
  'sullyos_instant_push_sunset_seen_date',
];

const LEGACY_LOCAL_STORAGE_PREFIXES = ['instant_tool_status_'];

const removeLegacyLocalStorage = (): void => {
  for (const key of LEGACY_LOCAL_STORAGE_KEYS) localStorage.removeItem(key);
  // 先收集再删：边遍历边删会让 key(i) 的下标错位、漏掉一半。
  const prefixed: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && LEGACY_LOCAL_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      prefixed.push(key);
    }
  }
  for (const key of prefixed) localStorage.removeItem(key);
};

export async function cleanupInstantPushLegacyData(): Promise<void> {
  try {
    if (localStorage.getItem(INSTANT_PUSH_LEGACY_CLEANUP_DONE_KEY)) return;
  } catch {
    return; // localStorage 用不了，这一趟什么都做不成
  }

  try {
    removeLegacyLocalStorage();
  } catch (e) {
    console.warn('[legacy-cleanup] 清理 Instant Push 旧配置失败', e);
  }

  try {
    await ActiveMsgStore.clearLegacyInstantPushStores();
  } catch (e) {
    console.warn('[legacy-cleanup] 清理 Instant Push 旧会话表失败，下次启动再试', e);
    return;
  }

  try {
    localStorage.setItem(INSTANT_PUSH_LEGACY_CLEANUP_DONE_KEY, String(Date.now()));
  } catch { /* 写不进标记就下次再清一遍，无害 */ }
}
