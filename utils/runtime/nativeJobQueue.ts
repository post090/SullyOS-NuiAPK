import { cancelNativeJob, enqueueNativeHttpJob, getNativeJob, type NativeJobRecord } from './nativeRuntime';
export interface NativeHttpRequest {
  jobId: string;
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  runAt?: number;
  responseType?: 'text' | 'json';
  title?: string;
  text?: string;
  meta?: Record<string, unknown>;
  /** 调用方停止（用户点停止 / 切走取消）时取消原生任务并立即抛 AbortError。 */
  signal?: AbortSignal | null;
}
export interface NativeHttpResult {
  jobId: string;
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  job: NativeJobRecord;
}

const abortError = () => new DOMException('Native job aborted', 'AbortError');

/** 可被 signal 打断的等待：轮询间隔里点了停止，不必等满这一拍。 */
const sleep = (ms: number, signal?: AbortSignal | null) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) { reject(abortError()); return; }
  const onAbort = () => { clearTimeout(timer); reject(abortError()); };
  const timer = setTimeout(() => { signal?.removeEventListener('abort', onAbort); resolve(); }, ms);
  signal?.addEventListener('abort', onAbort, { once: true });
});

export async function enqueueAndWaitNativeHttp(request: NativeHttpRequest): Promise<NativeHttpResult> {
  const { signal, ...jobInput } = request;
  if (signal?.aborted) throw abortError();
  await enqueueNativeHttpJob(jobInput);
  try {
    return await waitNativeHttp(request, signal);
  } catch (error) {
    // 停止后原生请求还会在后台跑完；不取消的话结果会落盘，被当成可恢复回复。
    if (signal?.aborted) {
      try { await cancelNativeJob(request.jobId); } catch { /* best-effort */ }
      throw abortError();
    }
    throw error;
  }
}

async function waitNativeHttp(request: NativeHttpRequest, signal?: AbortSignal | null): Promise<NativeHttpResult> {
  const startedAt = Date.now();
  const timeoutMs = Math.max(15_000, request.timeoutMs ?? 120_000);
  let delay = 350;
  while (Date.now() - startedAt <= timeoutMs + 5_000) {
    if (signal?.aborted) throw abortError();
    const job = await getNativeJob(request.jobId);
    // 轮询返回前点了停止：即使已经完成也不交付。
    if (signal?.aborted) throw abortError();
    if (!job) throw new Error(`Native job not found: ${request.jobId}`);
    if (job.status === 'completed') {
      return {
        jobId: request.jobId,
        statusCode: job.response?.statusCode ?? 0,
        headers: normalizeHeaders(job.response?.headers),
        body: job.response?.body ?? '',
        job,
      };
    }
    if (job.status === 'failed' || job.status === 'cancelled') {
      throw new Error(job.error || `Native job ${job.status}`);
    }
    await sleep(delay, signal);
    delay = Math.min(1500, Math.round(delay * 1.25));
  }

  throw new Error(`Native job timeout: ${request.jobId}`);
}

function normalizeHeaders(headers: unknown): Record<string, string> {
  if (!headers || typeof headers !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    if (!key) continue;
    out[key.toLowerCase()] = String(value ?? '');
  }
  return out;
}
