// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { BUILTIN_APPEARANCE_PRESETS, readBuiltinAppearance } from './builtinAppearance';
import { validateBeautyPackage } from './beautyShareContract';
import type { OSTheme } from '../types';

afterEach(() => vi.unstubAllGlobals());
const bundled = BUILTIN_APPEARANCE_PRESETS[0];
const current: OSTheme = { hue: 10, saturation: 50, lightness: 70, wallpaper: 'old', darkMode: false,
  chatAvatarShape: 'square', chatChromeStyle: 'soft', chatCharacterSwitchAnimationEnabled: false,
  scheduleCardAppearance: { preset: 'default' as any }, customFont: 'my-font.woff' };

describe('bundled SULLY desktop theme', () => {
  it('contains both new icons and ships less than 1 MiB of local artwork', () => {
    expect(validateBeautyPackage(bundled).kind).toBe('appearance');
    expect(bundled.customIcons).toHaveProperty('vrworld');
    expect(bundled.customIcons).toHaveProperty('hot_news');
    expect(bundled.chatThemes).toBeUndefined();
    expect(Object.keys(bundled.theme).filter(key => key.startsWith('chat'))).toEqual([]);
    const paths = [bundled.theme.wallpaper, ...Object.values(bundled.theme.launcherWidgets!), ...Object.values(bundled.customIcons!)];
    expect(paths.reduce((total, path) => {
      expect(path).toMatch(/^\/themes\/sully\/[^/]+\.(webp|png)$/);
      const bytes = readFileSync('public' + path);
      if (path.endsWith('.png')) expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      else expect(bytes.subarray(8, 12).toString()).toBe('WEBP');
      return total + statSync('public' + path).size;
    }, 0)).toBeLessThan(1024 * 1024);
  });
  it('embeds assets for offline backups, preserves unrelated settings and returns a fresh copy', async () => {
    vi.stubGlobal('fetch', vi.fn(async (path: string) => ({ ok: true, blob: async () => new Blob([readFileSync('public' + path)], { type: path.endsWith('.png') ? 'image/png' : 'image/webp' }) })));
    const preset = await readBuiltinAppearance(bundled.id, current);
    expect(preset.theme.wallpaper).toMatch(/^data:image\/webp;base64,/);
    expect(Object.values(preset.customIcons!).every(image => /^data:image\/(webp|png);base64,/.test(image))).toBe(true);
    expect(preset.customIcons!.vrworld).toMatch(/^data:image\/png;base64,/);
    expect(preset.theme.launcherWidgets!.dsq).toMatch(/^data:image\/webp;base64,/);
    expect(preset.theme.chatAvatarShape).toBe('square');
    expect(preset.theme.scheduleCardAppearance).toEqual(current.scheduleCardAppearance);
    expect(preset.theme.chatCharacterSwitchAnimationEnabled).toBe(false);
    expect(preset.theme.customFont).toBe(current.customFont);
    expect(current.wallpaper).toBe('old');
    expect(bundled.theme.wallpaper).toMatch(/^\/themes/);
  });
  it('fails before applying anything when an asset is missing or returns fallback HTML', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    await expect(readBuiltinAppearance(bundled.id, current)).rejects.toThrow('未能载入');
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, blob: async () => new Blob(['fallback'], { type: 'text/html' }) })));
    await expect(readBuiltinAppearance(bundled.id, current)).rejects.toThrow('格式不正确');
    expect(current.wallpaper).toBe('old');
  });
});
