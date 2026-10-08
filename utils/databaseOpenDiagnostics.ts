import { BUILD_LABEL } from './buildInfo';

const KEY = 'sully_db_open_diagnostics_v1';
const LIMIT = 16;
const phases = ['open-requested', 'versionless-fallback', 'upgrade-started', 'upgrade-committed', 'upgrade-aborted', 'open-ready', 'open-error', 'open-blocked', 'open-timeout', 'connection-closed', 'version-change'] as const;
type Phase = typeof phases[number];
type Entry = { phase: Phase; at: number; build: string; requestedVersion: number; fromVersion?: number; actualVersion?: number };
type Versions = Pick<Entry, 'requestedVersion' | 'fromVersion' | 'actualVersion'>;
let entries: Entry[] | undefined;

function read(): Entry[] {
  if (entries) return entries;
  entries = [];
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (Array.isArray(saved)) for (const item of saved.slice(-LIMIT)) {
      if (!item || !phases.includes(item.phase) || !Number.isFinite(item.at) || Math.abs(item.at) > 8.64e15 ||
          typeof item.build !== 'string' || item.build.length > 160 ||
          !Number.isInteger(item.requestedVersion) || item.requestedVersion < 1) continue;
      // Only these fixed fields may enter the diagnostic; never copy arbitrary storage data.
      const entry: Entry = { phase: item.phase, at: item.at, build: item.build, requestedVersion: item.requestedVersion };
      for (const field of ['fromVersion', 'actualVersion'] as const) {
        if (Number.isInteger(item[field]) && item[field] >= 0) entry[field] = item[field];
      }
      entries.push(entry);
    }
  } catch { /* Diagnostics cannot block database access when localStorage is unavailable. */ }
  return entries;
}

/** Device-local lifecycle breadcrumbs, independent of the database that may fail to open.
 * No record contents, character IDs, API settings or uploads. Times are absolute device timestamps.
 */
export function recordDatabaseOpen(phase: Phase, versions: Versions): void {
  const entry: Entry = { phase, at: Date.now(), build: BUILD_LABEL, requestedVersion: versions.requestedVersion };
  if (versions.fromVersion !== undefined) entry.fromVersion = versions.fromVersion;
  if (versions.actualVersion !== undefined) entry.actualVersion = versions.actualVersion;
  entries = [...read(), entry].slice(-LIMIT);
  try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch { /* Keep this page's in-memory trace. */ }
}

export function databaseOpenDiagnostic(): string {
  const lines = read().map(entry => {
    const from = entry.fromVersion === undefined ? '' : `，原版本 ${entry.fromVersion}`;
    const actual = entry.actualVersion === undefined ? '' : `，实际版本 ${entry.actualVersion}`;
    return `${new Date(entry.at).toISOString()} ${entry.build} ${entry.phase}（目标 ${entry.requestedVersion}${from}${actual}）`;
  });
  return lines.length ? `数据库打开记录（本机时间，UTC）：\n${lines.join('\n')}` : '';
}
