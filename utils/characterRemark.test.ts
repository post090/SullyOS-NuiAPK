import { describe, it, expect } from 'vitest';
import { characterRemark, chatCharacterDisplayName } from './characterRemark';

describe('chat-only character remark', () => {
    it('uses a remark only when opted in and preserves identity', () => {
        const character = { name: '真实名称', description: '我的备注', chatShowRemark: true };
        expect(chatCharacterDisplayName(character)).toBe('我的备注');
        expect(character.name).toBe('真实名称');
        expect(chatCharacterDisplayName({ ...character, chatShowRemark: false })).toBe('真实名称');
    });
    it('falls back for empty remarks and legacy placeholder values', () => {
        for (const description of ['', '   ', '点击编辑设定...', '点击编辑设定…']) {
            expect(characterRemark(description)).toBe('');
            expect(chatCharacterDisplayName({ name: '真实名称', description, chatShowRemark: true })).toBe('真实名称');
        }
    });
});
