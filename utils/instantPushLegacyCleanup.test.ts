import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActiveMsgStore } from './activeMsgStore';
import {
  INSTANT_PUSH_LEGACY_CLEANUP_DONE_KEY,
  cleanupInstantPushLegacyData,
} from './instantPushLegacyCleanup';

// fake-indexeddb 由 test-setup.ts 注入。先让 ActiveMsgStore 把库建到 v2（三张闲置表都在），
// 再绕过它直接往表里塞旧数据——生产代码里已经没有写这几张表的入口了。
const LEGACY_STORES = ['outbound_sessions', 'pending_tool_calls', 'reasoning_buffer'] as const;

async function withActiveMsgDb<T>(fn: (db: IDBDatabase) => Promise<T>): Promise<T> {
  await ActiveMsgStore.getGlobalConfig();
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('ActiveMsg', 2);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  try {
    return await fn(db);
  } finally {
    db.close();
  }
}

async function seedLegacyStores(): Promise<void> {
  await withActiveMsgDb((db) => new Promise<void>((resolve, reject) => {
    const tx = db.transaction([...LEGACY_STORES], 'readwrite');
    tx.objectStore('outbound_sessions').put({
      sessionId: 's1', charId: 'c1', messages: [{ role: 'user', content: 'hi' }],
      apiCredentials: { baseUrl: 'https://api.example.com', apiKey: 'sk-secret', model: 'm' },
      createdAt: 1,
    });
    tx.objectStore('pending_tool_calls').put({ sessionId: 's1', charId: 'c1', toolCalls: [], createdAt: 1 });
    tx.objectStore('reasoning_buffer').put({ sessionId: 's1', charId: 'c1', reasoningContent: 'x', receivedAt: 1 });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

async function countLegacyRows(): Promise<number> {
  return withActiveMsgDb((db) => new Promise<number>((resolve, reject) => {
    const tx = db.transaction([...LEGACY_STORES], 'readonly');
    let total = 0;
    for (const name of LEGACY_STORES) {
      const req = tx.objectStore(name).count();
      req.onsuccess = () => { total += req.result; };
    }
    tx.oncomplete = () => resolve(total);
    tx.onerror = () => reject(tx.error);
  }));
}

describe('cleanupInstantPushLegacyData', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('清掉旧配置、提醒记账、工具状态和三张闲置表，要留的 key 不碰', async () => {
    localStorage.setItem('instant_push_config_v1', JSON.stringify({ enabled: true, clientToken: 't' }));
    localStorage.setItem('sullyos_worker_build_seen', '2026-08-19');
    localStorage.setItem('sullyos_worker_update_snooze_until', '1');
    localStorage.setItem('sullyos_worker_version_probe_at', '1');
    localStorage.setItem('sullyos_instant_push_sunset_seen_date', '2026-08-20');
    localStorage.setItem('instant_tool_status_char-a', '{}');
    localStorage.setItem('instant_tool_status_char-b', '{}');
    localStorage.setItem('push_vapid_v1', '{"vapidPublicKey":"k"}');
    localStorage.setItem('instant_push_trace_log_v1', '[]');
    await seedLegacyStores();
    expect(await countLegacyRows()).toBe(3);

    await cleanupInstantPushLegacyData();

    for (const key of [
      'instant_push_config_v1',
      'sullyos_worker_build_seen',
      'sullyos_worker_update_snooze_until',
      'sullyos_worker_version_probe_at',
      'sullyos_instant_push_sunset_seen_date',
      'instant_tool_status_char-a',
      'instant_tool_status_char-b',
    ]) {
      expect(localStorage.getItem(key)).toBeNull();
    }
    expect(localStorage.getItem('push_vapid_v1')).toBe('{"vapidPublicKey":"k"}');
    expect(localStorage.getItem('instant_push_trace_log_v1')).toBe('[]');
    expect(await countLegacyRows()).toBe(0);
    expect(localStorage.getItem(INSTANT_PUSH_LEGACY_CLEANUP_DONE_KEY)).not.toBeNull();
  });

  it('清过一次之后不再动：之后出现的同名 key 留着', async () => {
    await cleanupInstantPushLegacyData();
    localStorage.setItem('instant_push_config_v1', 'later');
    const clearSpy = vi.spyOn(ActiveMsgStore, 'clearLegacyInstantPushStores');

    await cleanupInstantPushLegacyData();

    expect(localStorage.getItem('instant_push_config_v1')).toBe('later');
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('IDB 清表失败不写标记，下次启动重试', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(ActiveMsgStore, 'clearLegacyInstantPushStores').mockRejectedValueOnce(new Error('boom'));

    await expect(cleanupInstantPushLegacyData()).resolves.toBeUndefined();
    expect(localStorage.getItem(INSTANT_PUSH_LEGACY_CLEANUP_DONE_KEY)).toBeNull();
    expect(warn).toHaveBeenCalled();

    await cleanupInstantPushLegacyData();
    expect(localStorage.getItem(INSTANT_PUSH_LEGACY_CLEANUP_DONE_KEY)).not.toBeNull();
  });
});
