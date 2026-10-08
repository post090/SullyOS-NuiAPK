import {describe, expect, it} from 'vitest';
import {ContextBuilder} from './context';
import type {CharacterProfile, UserProfile} from '../types';
import type {HomeDefinitionKind} from '../apps/room3d/homeDefinition';

const user = {name: '小雨'} as UserProfile;
const char = {id: 'home-context', name: '角色', systemPrompt: '保持原有身份。', timeAwarenessEnabled: false} as CharacterProfile;
const build = async (value: unknown, deferred = false) => (await ContextBuilder.buildCoreContext(
    {...char, homeDefinition: value} as CharacterProfile, user, true, undefined, undefined, undefined, {deferVolatile: deferred},
));

describe('shared home background', () => {
    it('omits unset and invalid definitions, without interpreting a layout as a definition', async () => {
        for (const value of [undefined, null, {kind: 'unknown', notes: ''}, {kind: 'real'}]) {
            expect((await build(value))).not.toContain('你们的家园');
        }
    });
    it.each(['real', 'between-worlds', 'virtual'] as HomeDefinitionKind[])('injects %s once in normal and deferred context', async kind => {
        for (const deferred of [false, true]) {
            const context = (await build({kind, notes: '每逢周末在这里相见。'}, deferred));
            expect(context.match(/### 你们的家园/g)).toHaveLength(1);
            expect(context).toContain('你与小雨有一个');
            expect(context).toContain('每逢周末在这里相见。');
            expect(context).toContain('不代表你们此刻正在家园内');
            expect(context.includes('你知道自己的 AI 身份')).toBe(kind === 'virtual');
        }
    });
    it('uses updated settings next time and never leaks another character’s definition', async () => {
        expect((await build({kind: 'real', notes: '旧设定'}))).toContain('旧设定');
        const updated = (await build({kind: 'between-worlds', notes: '新设定'}));
        expect(updated).toContain('新设定');
        expect(updated).not.toContain('旧设定');
        expect(updated).toContain('无需解释两个世界为何相通');
        expect(updated).not.toContain('AI');
        expect((await ContextBuilder.buildCoreContext({...char, id: 'other'}, user))).not.toContain('你们的家园');
    });
});
