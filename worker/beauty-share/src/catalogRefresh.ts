import type { Env } from './types';
import { rebuildCatalog } from './catalog';

interface Job {
  tickets: Record<string, number>; sequence: number; attempts: number;
  firstAt: number; lastPublished?: number; error?: string;
}
interface Storage {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  getAlarm(): Promise<number | null>;
  setAlarm(time: number): Promise<void>;
}
const DELAY = 20_000, RESERVATION_TTL = 120_000;
const emptyJob = (): Job => ({ tickets: {}, sequence: 0, attempts: 0, firstAt: 0 });

/** One durable, one-shot job per catalog. Idle objects do not wake periodically. */
export class CatalogRefresh {
  constructor(private state: { storage: Storage }, private env: Env) {}
  async fetch(request: Request) {
    const storage = this.state.storage;
    const job = await storage.get<Job>('job') || emptyJob();
    if (request.method === 'GET') return Response.json({
      pending: (await storage.getAlarm()) !== null, lastPublished: job.lastPublished || null,
      error: job.error || '', attempts: job.attempts,
    });
    const { action, ticket } = await request.json() as { action: string; ticket: string };
    if (!['prepare', 'finish'].includes(action) || !/^[a-f0-9-]{36}$/.test(ticket)) return new Response('Invalid job', { status: 400 });
    const now = Date.now();
    if (action === 'prepare') {
      job.tickets[ticket] = now + RESERVATION_TTL;
      job.sequence++; job.firstAt ||= now; job.attempts = 0; job.error = '';
    } else delete job.tickets[ticket];
    await storage.put('job', job);
    await storage.setAlarm(Math.max(now + 1000, Math.min(now + DELAY, job.firstAt + 60_000)));
    return Response.json({ queued: true });
  }
  async alarm() {
    const storage = this.state.storage;
    let job = await storage.get<Job>('job') || emptyJob();
    const now = Date.now();
    job.tickets = Object.fromEntries(Object.entries(job.tickets).filter(([, expiry]) => expiry > now));
    await storage.put('job', job);
    // A reservation is created BEFORE the D1 mutation. If its request crashes,
    // expiry still wakes the durable job to include any committed changes.
    if (Object.keys(job.tickets).length) {
      await storage.setAlarm(Math.min(now + DELAY, ...Object.values(job.tickets))); return;
    }
    const sequence = job.sequence;
    try {
      const complete = await rebuildCatalog(this.env);
      job = await storage.get<Job>('job') || job;
      if (!complete || job.sequence !== sequence || Object.keys(job.tickets).length) {
        await storage.setAlarm(Date.now() + DELAY); return;
      }
      job.lastPublished = Date.now(); job.firstAt = 0; job.attempts = 0; job.error = '';
      await storage.put('job', job);
    } catch {
      job = await storage.get<Job>('job') || job;
      job.attempts++; job.error = '快照更新失败，旧目录仍可用。请检查后重试。';
      await storage.put('job', job);
      if (job.attempts <= 6) await storage.setAlarm(Date.now() + Math.min(300_000, 5000 * 2 ** job.attempts));
    }
  }
}

export function catalogJob(env: Env, request: Request) {
  if (!env.CATALOG_REFRESH) throw Error('Catalog refresh binding missing');
  return env.CATALOG_REFRESH.get(env.CATALOG_REFRESH.idFromName('public-catalog')).fetch(request);
}
export async function catalogMutation<T>(env: Env, mutate: () => Promise<T>): Promise<T> {
  if (!env.CATALOG) return mutate();
  const ticket = crypto.randomUUID();
  const send = (action: string) => catalogJob(env, new Request('https://catalog.internal/job', {
    method: 'POST', body: JSON.stringify({ action, ticket }),
  }));
  const ready = await send('prepare');
  if (!ready.ok) throw Error('Catalog refresh unavailable');
  try { return await mutate(); }
  finally {
    // Failure here does not turn a committed approval into a misleading error;
    // the durable reservation expires and guarantees a later refresh attempt.
    try { await send('finish'); } catch { /* Reservation handles recovery. */ }
  }
}
