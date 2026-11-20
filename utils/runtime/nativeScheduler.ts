/**
 * SullyOS Native Scheduler - bridges JS timers (Proactive/VR/Task) to Android native recoverable queue.
 *
 * Why this file exists:
 * - WebView JS timers are throttled in background / killed when Android reclaims WebView.
 * - Android persists the timer locally and signals the WebView when it comes due.
 *   If the WebView was reclaimed, the completed record is recovered on return.
 *
 * This does NOT run LLM in native - it just makes the *trigger* durable. The actual
 * generation still happens in JS via existing OSContext runProactive/runVR flows,
 * but now with a fallback that fires even after WebView was killed.
 */

import {
  enqueueNativeTimer,
  listNativeJobs,
  clearNativeJob,
  isNativeRuntimePlatform,
  getPersistentNativeRuntimeUserEnabled,
} from './nativeRuntime';

const TIMER_TAG_PREFIX = 'sully-timer-';
const TIMER_JOB_PREFIX = 'sully-timer-';
const scheduledTimes = new Map<string, number>();

export type NativeTimerKind = 'proactive' | 'vr' | 'world' | 'task' | 'generic';

export interface NativeTimerMeta {
  kind: NativeTimerKind;
  charId?: string;
  worldId?: string;
  taskId?: string;
  tag: string;
}

function isTimerJobId(jobId: string): boolean {
  return jobId.startsWith(TIMER_JOB_PREFIX);
}

function toJobId(tag: string): string {
  const safe = tag.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  return `${TIMER_JOB_PREFIX}${safe}`;
}

/**
 * Schedule a durable native timer. If runAt is in the past, it fires ASAP.
 * Overwrites any previous timer with same tag (idempotent).
 */
export async function scheduleNativeTimer(input: {
  tag: string;
  runAt: number;
  kind: NativeTimerKind;
  charId?: string;
  worldId?: string;
  taskId?: string;
  title?: string;
}): Promise<void> {
  if (!isNativeRuntimePlatform()) return;
  if (!getPersistentNativeRuntimeUserEnabled()) return; // only when always-on enabled
  const jobId = toJobId(input.tag);
  if (scheduledTimes.get(jobId) === input.runAt) return;
  scheduledTimes.set(jobId, input.runAt);
  const runAt = Math.max(Date.now() + 1000, input.runAt);

  try {
    await enqueueNativeTimer({
      jobId,
      runAt,
      title: input.title || 'SullyOS 正在运行',
      meta: {
        type: 'native-timer',
        kind: input.kind,
        charId: input.charId,
        worldId: input.worldId,
        taskId: input.taskId,
        tag: input.tag,
      },
    });
  } catch (e) {
    if (scheduledTimes.get(jobId) === input.runAt) scheduledTimes.delete(jobId);
    console.warn('[NativeScheduler] schedule failed', { tag: input.tag, error: e });
  }
}

export async function cancelNativeTimer(tag: string): Promise<void> {
  if (!isNativeRuntimePlatform()) return;
  const jobId = toJobId(tag);
  scheduledTimes.delete(jobId);
  try {
    await clearNativeJob(jobId);
  } catch { /* ignore */ }
}

/**
 * Clear ALL durable native timer jobs regardless of status or the enabled flag.
 * Called when the user turns OFF always-on so completed/pending timer jobs do not
 * leak in the native queue (they would never be drained again while disabled).
 * Returns the number of timer jobs cleared.
 */
export async function clearAllNativeTimers(): Promise<number> {
  scheduledTimes.clear();
  if (!isNativeRuntimePlatform()) return 0;
  let cleared = 0;
  try {
    const jobs = await listNativeJobs(true);
    for (const job of jobs) {
      if (!isTimerJobId(job.jobId)) continue;
      await clearNativeJob(job.jobId, job);
      cleared += 1;
    }
  } catch (e) {
    console.warn('[NativeScheduler] clearAll failed', e);
  }
  return cleared;
}

/**
 * Poll native jobs for completed timers, dispatch events, and clean up.
 * Returns number of timers drained.
 */
export async function drainNativeTimers(): Promise<number> {
  if (!isNativeRuntimePlatform()) return 0;
  if (!getPersistentNativeRuntimeUserEnabled()) return 0;
  let drained = 0;
  try {
    const jobs = await listNativeJobs(true);
    for (const job of jobs) {
      if (!getPersistentNativeRuntimeUserEnabled()) break;
      if (!isTimerJobId(job.jobId) || job.status === 'queued' || job.status === 'running') continue;
      scheduledTimes.delete(job.jobId);
      const meta = job.meta;
      if (meta?.type === 'native-timer') {
        const detail = {
          kind: meta.kind ?? 'generic',
          charId: meta.charId, worldId: meta.worldId, taskId: meta.taskId,
          tag: meta.tag ?? job.jobId,
          jobId: job.jobId,
          failed: job.status !== 'completed',
        };
        window.dispatchEvent(new CustomEvent('sully-native-timer', { detail }));
        drained += 1;
      }
      // Dispatch may have already armed the next occurrence under the same ID.
      await clearNativeJob(job.jobId, job);
    }
  } catch (e) {
    console.warn('[NativeScheduler] drain failed', e);
  }
  return drained;
}

/**
 * Convenience: schedule proactive next-fire. Called from ProactiveChat after computing next interval.
 */
export async function scheduleNativeProactiveTimer(charId: string, nextFireAt: number): Promise<void> {
  await scheduleNativeTimer({
    tag: `proactive-${charId}`,
    runAt: nextFireAt,
    kind: 'proactive',
    charId,
    title: 'SullyOS 正在运行',
  });
}

export async function scheduleNativeVrTimer(charId: string, nextFireAt: number): Promise<void> {
  await scheduleNativeTimer({
    tag: `vr-${charId}`,
    runAt: nextFireAt,
    kind: 'vr',
    charId,
    title: 'SullyOS 正在运行',
  });
}

export async function scheduleNativeWorldTimer(worldId: string, nextFireAt: number): Promise<void> {
  await scheduleNativeTimer({
    tag: `world-${worldId}`,
    runAt: nextFireAt,
    kind: 'world',
    worldId,
    title: 'SullyOS 正在运行',
  });
}
