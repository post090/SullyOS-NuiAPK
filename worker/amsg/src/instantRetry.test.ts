import { afterEach, describe, expect, it, vi } from 'vitest';
import { deriveUserEncryptionKey, encryptForStorage, runTask } from '@rei-standard/amsg-server/cloudflare';
import { amsgFireSettled, buildWorkerConfig } from './index';

// 跑真实上游调度器，验证正式重试配置决定任务终态，不靠收尾 hook 修改错误对象。
const runFailedTurn = async (instant: boolean, status: number | 'network' | 'before-fire') => {
  const masterKey = 'a'.repeat(64);
  const userId = 'c6a804ad-46ea-4e4d-a26a-13c29e23bc55';
  const userKey = await deriveUserEncryptionKey(userId, masterKey);
  const task = {
    id: 1, user_id: userId, uuid: '3637dae1-1461-4444-a747-34e406f67acc',
    next_send_at: new Date().toISOString(), retry_after: null, retry_count: 0,
    status: 'pending', message_type: 'auto',
    encrypted_payload: await encryptForStorage(JSON.stringify({
      messageType: 'auto', recurrenceType: 'none',
      apiUrl: 'https://mock.invalid/v1/chat/completions', apiKey: 'mock', primaryModel: 'mock',
      metadata: { charId: 'test-char', amsgInstantChat: instant },
    }), userKey),
  };
  const db = {
    getTaskByUuidOnly: async () => task.status === 'pending' ? { ...task } : null,
    claimTask: async () => true,
    updateTaskById: async (_id: number, fields: Partial<typeof task>) => Object.assign(task, fields),
  };
  let modelCalls = 0;
  vi.stubGlobal('fetch', async () => {
    modelCalls++;
    if (status === 'network') throw new TypeError('fetch failed');
    return new Response(JSON.stringify({ error: { message: '中转自定义错误，没有标准错误码' } }), {
      status: typeof status === 'number' ? status : 500,
    });
  });
  const onFireSettled = vi.fn(amsgFireSettled);
  const ctx = {
    db, masterKey, leaseHeartbeatMs: 0,
    maxGenerationRetries: buildWorkerConfig({ AMSG_MASTER_KEY: masterKey } as any).maxGenerationRetries,
    hooks: {
      onBeforeFire: async () => {
        if (status === 'before-fire') throw new Error('读取云端上下文失败');
        return [{ role: 'user', content: '你好，小明' }];
      },
      onLLMOutput: async () => ({ decision: 'skip-push' }),
    },
    onFireSettled,
  };
  const result = await runTask(ctx as any, task.uuid);
  return { task, result, ctx, onFireSettled, modelCalls: () => modelCalls };
};

afterEach(() => vi.unstubAllGlobals());

describe('instant 生成失败不进入定时任务重试', () => {
  it.each([200, 429, 500, 'network', 'before-fire'] as const)('%s 失败首次就结束任务', async (status) => {
    const { task, result, ctx, onFireSettled, modelCalls } = await runFailedTurn(true, status);
    expect(task.status).toBe('failed');
    expect(task.retry_count).toBe(0);
    expect(task.retry_after).toBeNull();
    expect(result).toMatchObject({ ran: true, summary: { failedCount: 1 } });
    expect(onFireSettled).toHaveBeenCalledWith(expect.objectContaining({
      willRetry: false, failureStage: 'generation',
    }));
    await runTask(ctx as any, task.uuid);
    expect(modelCalls()).toBe(status === 'before-fire' ? 0 : 1);
  });

  it('定时消息的同类生成失败仍可重试', async () => {
    const { task, onFireSettled } = await runFailedTurn(false, 500);
    expect(task.status).toBe('pending');
    expect(task.retry_count).toBe(1);
    expect(task.retry_after).not.toBeNull();
    expect(onFireSettled).toHaveBeenCalledWith(expect.objectContaining({
      willRetry: true, failureStage: 'generation',
    }));
  });

  it('instant 整批已入收件箱的推送失败不标成永久失败', async () => {
    const error = new Error('push 503');
    await amsgFireSettled({
      status: 'failed', outboxed: true, error,
      metadata: { amsgInstantChat: true }, scratch: {}, writeState: vi.fn(),
    } as any);
    expect((error as Error & { permanent?: boolean }).permanent).not.toBe(true);
  });
});
