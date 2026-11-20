// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enqueueAndWaitNativeHttp } from './nativeJobQueue';
import { clearAllNativeTimers, drainNativeTimers, scheduleNativeProactiveTimer } from './nativeScheduler';
import { watchNativeQueue } from './nativeQueueWake';
import type { NativeJobRecord } from './nativeRuntime';

const native = vi.hoisted(() => ({
  isNativeRuntimePlatform: () => true,
  getPersistentNativeRuntimeUserEnabled: () => true,
  listNativeJobs: vi.fn<() => Promise<NativeJobRecord[]>>(),
  enqueueNativeTimer: vi.fn(),
  clearNativeJob: vi.fn(),
  enqueueNativeHttpJob: vi.fn(),
  getNativeJob: vi.fn<() => Promise<NativeJobRecord>>(),
  cancelNativeJob: vi.fn(),
}));
vi.mock('./nativeRuntime', () => native);

describe('APK idle delivery', () => {
  beforeEach(async () => {
    native.listNativeJobs.mockResolvedValue([]);
    await clearAllNativeTimers();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('arms the same persisted deadline once and acknowledges only the completed occurrence on rearm', async () => {
    const first = Date.now() + 60_000;
    await Promise.all([scheduleNativeProactiveTimer('c', first), scheduleNativeProactiveTimer('c', first)]);
    expect(native.enqueueNativeTimer).toHaveBeenCalledTimes(1);
    expect(native.enqueueNativeTimer.mock.calls[0][0]).not.toHaveProperty('url');
    const done: NativeJobRecord = { jobId: 'sully-timer-proactive-c', status: 'completed', updatedAt: first,
      createdAt: first - 60_000, enqueueToken: 'first', meta: { type: 'native-timer', kind: 'proactive', charId: 'c' } };
    native.listNativeJobs.mockResolvedValue([done]);
    window.addEventListener('sully-native-timer', () => { void scheduleNativeProactiveTimer('c', first + 60_000); }, { once: true });
    expect(await drainNativeTimers()).toBe(1);
    expect(native.enqueueNativeTimer).toHaveBeenCalledTimes(2);
    expect(native.clearNativeJob).toHaveBeenCalledWith(done.jobId, done);
  });

  it('wakes on media controls including signals received during a drain, and does no idle polling', async () => {
    let release!: () => void;
    const firstDrain = new Promise<void>(resolve => { release = resolve; });
    const drain = vi.fn().mockReturnValueOnce(firstDrain).mockResolvedValue(undefined);
    const stop = watchNativeQueue('sully-native-music-action', drain);
    window.dispatchEvent(new Event('sully-native-music-action'));
    window.dispatchEvent(new Event('sully-native-music-action'));
    expect(drain).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(drain).toHaveBeenCalledTimes(2);
    stop();
    window.dispatchEvent(new Event('sully-native-music-action'));
    expect(drain).toHaveBeenCalledTimes(2);
  });

  it('returns the reply saved while the WebView was frozen past the request deadline', async () => {
    const job: NativeJobRecord = { jobId: 'reply', status: 'running', createdAt: Date.now(), updatedAt: Date.now() };
    native.getNativeJob.mockResolvedValueOnce(job).mockResolvedValueOnce({ ...job, status: 'completed',
      response: { statusCode: 200, headers: {}, body: 'saved reply' } });
    const pending = enqueueAndWaitNativeHttp({ jobId: job.jobId, url: 'https://api.example.test/chat/completions', timeoutMs: 15_000 });
    await vi.advanceTimersByTimeAsync(0);
    expect(native.getNativeJob).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 600_000);
    window.dispatchEvent(new Event('sully-native-job-finished'));
    await expect(pending).resolves.toMatchObject({ body: 'saved reply' });
    expect(native.enqueueNativeHttpJob).toHaveBeenCalledTimes(1);
  });
});
