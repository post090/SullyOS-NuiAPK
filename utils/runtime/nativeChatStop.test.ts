// 回归：原生通道生成中用户点「停止」后，任务不能留在可恢复状态。
// 曾经 safeFetchJson / sendNativeChatAttempt 不看 signal，原生请求跑完后任务被标成
// native_completed，又没人消费；App 被杀重启后恢复扫描会把已停止的回复补进聊天。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
    polls: 0,
    enqueueNativeHttpJob: vi.fn(async (o: { jobId: string }) => ({ jobId: o.jobId })),
    cancelNativeJob: vi.fn(async () => {}),
    clearNativeJob: vi.fn(async () => {}),
}));

vi.mock('./nativeRuntime', () => ({
    isNativeRuntimeEnabled: () => true,
    isNativeRuntimeAvailable: async () => true,
    getNativeChatRuntimeUserEnabled: () => true,
    enqueueNativeHttpJob: native.enqueueNativeHttpJob,
    cancelNativeJob: native.cancelNativeJob,
    clearNativeJob: native.clearNativeJob,
    getNativeJob: vi.fn(async (jobId: string) => {
        native.polls += 1;
        if (native.polls < 3) return { jobId, status: 'running' };
        return {
            jobId,
            status: 'completed',
            response: { statusCode: 200, headers: {}, body: JSON.stringify({ choices: [{ message: { content: '已经停掉的回复' } }] }) },
        };
    }),
}));

import { safeFetchJson } from '../safeApi';
import { getRecoverableChatJobs } from './chatJobs';

const URL_ = 'https://api.test/v1/chat/completions';
const META = { appName: '消息', purpose: '聊天回复', charId: 'char-stop', charName: '阿澄' };

describe('原生聊天生成：用户停止', () => {
    beforeEach(() => {
        localStorage.removeItem('sully_chat_generation_jobs_v1');
        native.polls = 0;
        native.cancelNativeJob.mockClear();
    });

    it('停止后不留下可恢复的任务，并取消原生请求', async () => {
        const ac = new AbortController();
        const pending = safeFetchJson(URL_, { method: 'POST', body: '{"model":"m"}', signal: ac.signal }, 2, 0, META);
        // 等任务入队、开始轮询后再停止
        await vi.waitFor(() => expect(native.polls).toBeGreaterThanOrEqual(1));
        ac.abort();

        await expect(pending).rejects.toThrow();
        expect(getRecoverableChatJobs().filter(j => j.charId === 'char-stop')).toEqual([]);
        expect(native.cancelNativeJob).toHaveBeenCalled();
    });

    it('没有停止时照常返回结果（不误伤正常路径）', async () => {
        const data = await safeFetchJson(URL_, { method: 'POST', body: '{"model":"m"}' }, 2, 0, META);
        expect(data.choices[0].message.content).toBe('已经停掉的回复');
        expect(native.cancelNativeJob).not.toHaveBeenCalled();
    });
});
