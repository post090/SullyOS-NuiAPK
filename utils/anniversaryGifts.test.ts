import { afterEach, describe, expect, it, vi } from 'vitest';
import { ANNIVERSARY_FRAME_STYLE, ANNIVERSARY_SEEN_KEY, avatarDecorationImageStyle, createAnniversaryTheme, markAnniversaryGiftSeen, shouldShowAnniversaryGift } from './anniversaryGifts';
import type { ChatTheme } from '../types';

afterEach(() => vi.unstubAllGlobals());

describe('一周年赠礼', () => {
  it('整个设备当地九月可见，不绑定某一天，也不会每年重弹', () => {
    vi.stubGlobal('localStorage', { getItem: () => null });
    expect(shouldShowAnniversaryGift(new Date(2026, 7, 31, 23, 59))).toBe(false);
    expect(shouldShowAnniversaryGift(new Date(2026, 8, 1))).toBe(true);
    expect(shouldShowAnniversaryGift(new Date(2026, 8, 30, 23, 59))).toBe(true);
    expect(shouldShowAnniversaryGift(new Date(2026, 9, 1))).toBe(false);
    expect(shouldShowAnniversaryGift(new Date(2027, 8, 1))).toBe(false);
  });

  it('只有处理弹窗才标记已读，刷新后不重复', () => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key), setItem: (key: string, value: string) => values.set(key, value) });
    const now = new Date(2026, 8, 10);
    expect(shouldShowAnniversaryGift(now)).toBe(true);
    expect(values.has(ANNIVERSARY_SEEN_KEY)).toBe(false);
    markAnniversaryGiftSeen();
    expect(shouldShowAnniversaryGift(now)).toBe(false);
  });

  it('已读存储不可用时不崩溃', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); } });
    expect(shouldShowAnniversaryGift(new Date(2026, 8, 10))).toBe(true);
    expect(() => markAnniversaryGiftSeen()).not.toThrow();
  });

  it('只给所选角色创建头像框副本，保留气泡和 CSS，不修改共用主题', () => {
    const original: ChatTheme = { id: 'shared', name: '旧装扮', type: 'custom', customCss: '.sully-bubble-ai { padding: 12px; }', user: { textColor: 'pink', backgroundColor: 'navy', borderRadius: 9, opacity: .8, voiceBarBg: 'gold' }, ai: { textColor: 'blue', backgroundColor: 'white', borderRadius: 23, opacity: .9, decoration: 'my-sticker', avatarDecoration: 'old-frame' } };
    const before = structuredClone(original);
    const gift = createAnniversaryTheme(original, 'alice');
    expect(original).toEqual(before);
    expect(gift.id).not.toBe(original.id);
    expect(gift.id).not.toBe(createAnniversaryTheme(original, 'bob').id);
    expect(gift.user).toEqual({ ...original.user, ...ANNIVERSARY_FRAME_STYLE });
    expect(gift.ai).toEqual({ ...original.ai, ...ANNIVERSARY_FRAME_STYLE });
    expect(gift.customCss).toBe(original.customCss);
    expect(createAnniversaryTheme(gift, 'alice').id).toBe(gift.id);
  });

  it('开口中心在所有头像尺寸上对齐，普通上传的挂件仍沿用旧默认值', () => {
    for (const size of [28, 36, 48, 86]) {
      const style = avatarDecorationImageStyle(ANNIVERSARY_FRAME_STYLE, size);
      const ratio = parseFloat(String(style.width)) / 1080;
      const centreX = size * ANNIVERSARY_FRAME_STYLE.avatarDecorationX / 100 + (514 - 540) * ratio;
      const centreY = size * ANNIVERSARY_FRAME_STYLE.avatarDecorationY / 100 + (705 - 720) * ratio;
      expect(Math.abs(centreX - size / 2)).toBeLessThan(.1);
      expect(Math.abs(centreY - size / 2)).toBeLessThan(.1);
    }
    expect(avatarDecorationImageStyle({}, 36)).toEqual({ left: '50%', top: '50%', width: '36px', height: 'auto', transform: 'translate(-50%, -50%) rotate(0deg)' });
  });
});
