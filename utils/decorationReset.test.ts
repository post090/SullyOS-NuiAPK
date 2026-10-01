import { describe, it, expect } from 'vitest';
import { resetChatDecoration } from './decorationReset';
import { PRESET_THEMES } from '../components/chat/ChatConstants';
import { resolveActiveSound } from './whiteboxSound';
import type { CharacterProfile, OSTheme } from '../types';

const char = { id: 'c', chromeCustomCss: '/* @sully-sound {"src":"ding"} */' } as CharacterProfile;
const theme = { chatSound: { src: 'chime' }, chatBackground: 'global-image' } as OSTheme;
describe('分类恢复默认', () => {
    it('removes legacy bubble frames without altering the saved bubble or its colors', () => {
        const bubble = structuredClone(PRESET_THEMES.default);
        bubble.user.avatarDecoration = 'old-frame';
        bubble.ai.avatarDecoration = 'old-frame';
        const result = resetChatDecoration('avatar', char, theme, bubble);
        expect(result.bubble?.user.avatarDecoration).toBeUndefined();
        expect(result.bubble?.ai.avatarDecoration).toBeUndefined();
        expect(result.bubble?.user.backgroundColor).toBe(bubble.user.backgroundColor);
        expect(bubble.user.avatarDecoration).toBe('old-frame');
        expect(result.character.chromeCustomCss).not.toContain('sully-composer:avatar');
    });
    it('explicitly disables inherited sound and background', () => {
        const sound = { ...char, ...resetChatDecoration('sound', char, theme, PRESET_THEMES.default).character };
        expect(resolveActiveSound(sound.chromeCustomCss, sound.chatSound, undefined, theme.chatSound)?.src).toBe('none');
        expect(resetChatDecoration('background', char, theme, PRESET_THEMES.default).character.chatBackground).toBe('');
    });
    it('whitebox reset preserves the bound sound and resets layout', () => {
        const result = resetChatDecoration('whitebox', char, theme, PRESET_THEMES.default).character;
        expect(result.chatSound?.src).toBe('ding');
        expect(result.chatAppearance?.chatAvatarShape).toBe('circle');
        expect(result.chromeCustomCss).toBe('');
        expect(result.chatDecorationCssIsolated).toBe(true);
    });
});
