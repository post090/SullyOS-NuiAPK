import { describe, expect, it } from 'vitest';
import { applyKanataTitle, extractKanataTitle, kanataTitleActivityPrompt, normalizeKanataTitle } from './vrWorld/kanataTitle';
import { withLatestVRParticipation } from './vrWorld/participation';
import { ChatPrompts } from './chatPrompts';
import type { CharacterProfile } from '../types';

const char = { id: 'title-char', name: '阿岚', vrState: { enabled: true, intervalMinutes: 120, title: '旧称号', titleRevision: 'r1' } } as CharacterProfile;
describe('彼方称号', () => {
    it('bounds display text by Unicode characters and removes hidden formatting', () => {
        expect(normalizeKanataTitle('  湖边\n发呆\u202e <王>  ')).toBe('湖边 发呆 王');
        expect(normalizeKanataTitle('🐟'.repeat(13))).toBe('🐟'.repeat(12));
        expect(normalizeKanataTitle(undefined)).toBe('');
    });
    it('extracts an optional XML title without leaking metadata into the activity', () => {
        expect(extractKanataTitle('<ACTIVITY>散步</ACTIVITY><KANATA_TITLE>散步专家</KANATA_TITLE>', false)).toEqual({ content: '<ACTIVITY>散步</ACTIVITY>', title: '散步专家' });
        expect(extractKanataTitle('<ACTIVITY>散步</ACTIVITY>', false).title).toBeUndefined();
        expect(extractKanataTitle('<KANATA_TITLE></KANATA_TITLE>', false).title).toBe('');
    });
    it('strips JSON metadata while preserving the fishing/garden protocol', () => {
        const result = extractKanataTitle('```json\n{"disposition":"keep","reaction":"真好","shareToUser":null,"kanataTitle":"钓鱼人"}\n```', true);
        expect(result.title).toBe('钓鱼人'); expect(JSON.parse(result.content)).toEqual({ disposition: 'keep', reaction: '真好', shareToUser: null });
        expect(extractKanataTitle('{bad json}', true)).toEqual({ content: '{bad json}' });
        expect(extractKanataTitle('{"kanataTitle":null,"action":"visit"}', true)).toEqual({ content: '{"action":"visit"}', title: undefined });
    });
    it('rejects ambiguous, overly long and incomplete proposals', () => {
        expect(extractKanataTitle('<KANATA_TITLE>甲</KANATA_TITLE><KANATA_TITLE>乙</KANATA_TITLE>', false).title).toBeUndefined();
        expect(extractKanataTitle(`<KANATA_TITLE>${'长'.repeat(13)}</KANATA_TITLE>`, false).title).toBeUndefined();
        expect(extractKanataTitle('<KANATA_TITLE>未结束', false).title).toBeUndefined();
    });
    it('changes only the current actor and preserves their other state', () => {
        const current = { ...char, vrState: { ...char.vrState!, currentRoom: 'sar' as const, lastActiveAt: 200 } };
        expect(applyKanataTitle(current, char.vrState, '新称号').vrState).toMatchObject({ title: '新称号', currentRoom: 'sar', lastActiveAt: 200, enabled: true });
        expect(applyKanataTitle(current, char.vrState, '旧称号')).toEqual({});
        expect(applyKanataTitle(current, char.vrState, '').vrState?.title).toBe('');
    });
    it('manual changes, even edit-and-revert, beat an in-flight activity', () => {
        expect(applyKanataTitle({ ...char, vrState: { ...char.vrState!, title: '手改' } }, char.vrState, '自动')).toEqual({});
        expect(applyKanataTitle({ ...char, vrState: { ...char.vrState!, titleRevision: 'r2' } }, char.vrState, '自动')).toEqual({});
        expect(applyKanataTitle({ ...char, vrState: { ...char.vrState!, enabled: false } }, char.vrState, '自动')).toEqual({});
        expect(withLatestVRParticipation(char, { vrState: { enabled: true, intervalMinutes: 60, title: '过期值' } }).vrState).toMatchObject({ title: '旧称号', titleRevision: 'r1' });
    });
    it('guides optional self-edits in the correct output protocol', () => {
        expect(kanataTitleActivityPrompt('钓鱼人', false)).toContain('<KANATA_TITLE>');
        expect(kanataTitleActivityPrompt('钓鱼人', true)).toContain('"kanataTitle"');
        expect(kanataTitleActivityPrompt('钓鱼人', true)).not.toContain('<KANATA_TITLE>');
    });
    it('puts the current title into ordinary chat, but not a stale scheduled template', async () => {
        const build = (c: CharacterProfile, forFirePack = false) => ChatPrompts.buildSystemPromptParts(c, { name: '我' } as any, [], [], [], [], undefined, undefined, undefined, undefined, undefined, undefined, { forFirePack });
        expect((await build(char)).volatileState).toContain('当前彼方称号为："旧称号"');
        expect((await build(char, true)).volatileState).not.toContain('当前彼方称号为');
        expect((await build({ ...char, vrState: { ...char.vrState!, enabled: false } })).volatileState).not.toContain('当前彼方称号为');
    });
});
