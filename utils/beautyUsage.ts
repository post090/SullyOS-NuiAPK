import {portableCssImages} from './cssImageAssets';
import { DB } from './db';
import type { BeautyShare } from './beautyShareContract';
import { validateDecoration } from './chatDecoration';
import { readBeautyRepoStatus } from './beautyRepoStatus';

const KEY = 'sully-beauty-usage-v1';
export const BEAUTY_USAGE_EVENT = 'sully-beauty-usage-change';
export const BEAUTY_REPO_DELAY = 72 * 60 * 60 * 1000;
export interface BeautyUse { target: string; share: BeautyShare; startedAt: number }
interface UsageState { uses: BeautyUse[]; reminded: string[]; disabled: boolean; lastPromptAt: number }
export function readBeautyUsage(): UsageState {
  try {
    const state = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!state || !Array.isArray(state.uses) || !Array.isArray(state.reminded)) throw Error();
    return { uses: state.uses.filter((item: BeautyUse) => typeof item.target === 'string' && /^S-[A-F0-9]{12}$/.test(item.share?.code) && Number.isFinite(item.startedAt)), reminded: state.reminded, disabled: state.disabled === true, lastPromptAt: Number(state.lastPromptAt) || 0 };
  } catch { return { uses: [], reminded: [], disabled: false, lastPromptAt: 0 }; }
}
function write(state: UsageState) { localStorage.setItem(KEY, JSON.stringify(state)); window.dispatchEvent(new Event(BEAUTY_USAGE_EVENT)); }
export async function decorationSourceKey(preset: unknown) {
  const normalized=validateDecoration(preset);
  if(normalized.parts.css!==undefined)normalized.parts.css=await portableCssImages(normalized.parts.css);
  const content = new TextEncoder().encode(JSON.stringify(normalized));
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', content));
  return 'chat-' + Array.from(hash, b => b.toString(16).padStart(2, '0')).join('');
}
export async function rememberBeautySource(key: string, share: BeautyShare) { await DB.saveAsset('beauty_source_' + key, JSON.stringify(share)); }
export async function startBeautyUsage(key: string, target: string) {
  // A missing attribution must never interfere with applying an ordinary local preset.
  try {
    const raw = await DB.getAsset('beauty_source_' + key);
    const state = readBeautyUsage(); const previous = state.uses.find(item => item.target === target);
    state.uses = state.uses.filter(item => item.target !== target);
    if (raw) {
      const share: BeautyShare = JSON.parse(raw);
      state.uses.push({ target, share, startedAt: previous?.share.code === share.code && previous?.share.revision === share.revision ? previous.startedAt : Date.now() });
    }
    write(state);
  } catch { /* Attribution is optional local metadata. */ }
}
export function stopBeautyUsage(target: string) {
  try { const state = readBeautyUsage(); const next = state.uses.filter(item => target === 'chat:*' ? !item.target.startsWith('chat:') : item.target !== target); if (next.length !== state.uses.length) write({ ...state, uses: next }); } catch { /* Local storage unavailable. */ }
}
export function stopBeautyForThemeChange(updates: Record<string, unknown>) {
  const keys = Object.keys(updates);
  if(keys.includes('scheduleCardAppearance'))stopBeautyUsage('appearance:schedule');
  if(keys.includes('journalAppearance'))stopBeautyUsage('appearance:journal');
  if (keys.some(key => key.startsWith('chat'))) stopBeautyUsage('chat:*');
  if (keys.some(key => /^(hue|saturation|lightness|wallpaper|desktop|launcher|customFont|contentColor|icon|darkMode)/.test(key))) stopBeautyUsage('appearance');
}
export function dueBeautyRepo(state: UsageState, now: number, validTargets: string[]): BeautyUse | undefined {
  if (state.disabled || now - state.lastPromptAt < 86400_000) return;
  return state.uses.find(item => validTargets.includes(item.target) && now - item.startedAt > BEAUTY_REPO_DELAY && !state.reminded.includes(item.share.code) && !readBeautyRepoStatus(item.share.code));
}
export function markBeautyRepoPrompt(code: string) { const state = readBeautyUsage(); if (!state.reminded.includes(code)) state.reminded.push(code); state.lastPromptAt = Date.now(); write(state); }
export function setBeautyRepoDisabled(disabled: boolean) { write({ ...readBeautyUsage(), disabled }); }
export function beautyRepoDeviceId() {
  const key = 'sully-beauty-repo-device'; let id = localStorage.getItem(key);
  if (!id || !/^[a-f0-9-]{32,64}$/.test(id)) { id = crypto.randomUUID(); localStorage.setItem(key, id); }
  return id;
}
