export type BeautyRepoStatus = 'manual' | 'submitted';
const KEY = 'sully-beauty-repo-status-v1';
export const BEAUTY_REPO_STATUS_EVENT = 'sully-beauty-repo-status-change';
export function readBeautyRepoStatus(code: string): BeautyRepoStatus | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '{}')[code];
    return value === 'manual' || value === 'submitted' ? value : null;
  } catch { return null; }
}
export function setBeautyRepoStatus(code: string, status: BeautyRepoStatus | null) {
  if (!/^S-[A-F0-9]{12}$/.test(code)) throw Error('美化码无效');
  let records: Record<string, BeautyRepoStatus> = {};
  try { const raw = JSON.parse(localStorage.getItem(KEY) || '{}'); if (raw && typeof raw === 'object' && !Array.isArray(raw)) records = raw; } catch { /* Restore an invalid local record. */ }
  if (status) records[code] = status; else delete records[code];
  localStorage.setItem(KEY, JSON.stringify(records));
  window.dispatchEvent(new Event(BEAUTY_REPO_STATUS_EVENT));
}
