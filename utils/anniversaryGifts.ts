import type { CSSProperties } from 'react';
import type { BubbleStyle, ChatTheme } from '../types';

// Event artwork only; stable paths keep already-applied gifts working.
export const ANNIVERSARY_ARTIST = '哈基米欠我钱';
export const ANNIVERSARY_WALLPAPERS = [
  { id: 'stripes', name: '奶油星星', url: './anniversary/cake-stripes.jpg' },
  { id: 'lattice', name: '糖霜格纹', url: './anniversary/cake-lattice.jpg' },
] as const;
export const ANNIVERSARY_FRAME_URL = './anniversary/crowned-cat-frame.png';
export const ANNIVERSARY_SEEN_KEY = 'sullyos_first_anniversary_seen_v1';

// The original 1080×1440 artwork has transparent padding. Its aperture is
// centred near (514, 705), not the canvas centre (540, 720). Keep the artwork
// intact and align that aperture with the avatar; all chat renderers share this.
export const ANNIVERSARY_FRAME_STYLE = {
  avatarDecoration: ANNIVERSARY_FRAME_URL,
  avatarDecorationX: 53.9,
  avatarDecorationY: 52.2,
  avatarDecorationScale: 1.6,
  avatarDecorationRotate: 0,
} satisfies Partial<BubbleStyle>;

export function avatarDecorationImageStyle(style: Partial<BubbleStyle>, size: number): CSSProperties {
  return {
    left: `${style.avatarDecorationX ?? 50}%`,
    top: `${style.avatarDecorationY ?? 50}%`,
    width: `${size * (style.avatarDecorationScale ?? 1)}px`,
    height: 'auto',
    transform: `translate(-50%, -50%) rotate(${style.avatarDecorationRotate ?? 0}deg)`,
  };
}

export function isAnniversaryFrame(value?: string): boolean {
  return value === ANNIVERSARY_FRAME_URL;
}

/** Only the device's September 2026 matters; this is a user-facing celebration. */
export function shouldShowAnniversaryGift(now = new Date()): boolean {
  if (now.getFullYear() !== 2026 || now.getMonth() !== 8) return false;
  try { return !localStorage.getItem(ANNIVERSARY_SEEN_KEY); } catch { return true; }
}

export function markAnniversaryGiftSeen(): void {
  try { localStorage.setItem(ANNIVERSARY_SEEN_KEY, '1'); } catch { /* Session guard still prevents repeats. */ }
}

/** Copy the supplied base (the event uses default purple) without rewriting shared themes. */
export function createAnniversaryTheme(base: ChatTheme, characterId: string): ChatTheme {
  return {
    ...base,
    id: `anniversary-frame-${characterId}`,
    name: '一周年 · 尊贵猫猫',
    type: 'custom',
    user: { ...base.user, ...ANNIVERSARY_FRAME_STYLE },
    ai: { ...base.ai, ...ANNIVERSARY_FRAME_STYLE },
  };
}
