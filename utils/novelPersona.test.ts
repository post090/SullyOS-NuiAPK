import {afterEach, describe, expect, it, vi} from 'vitest';
import type {CharacterProfile, MountedWorldbook, NovelBook, UserProfile} from '../types';
import {analyzeWriterPersonaSimple, buildPrompt, extractWritingTags, extractWritingTaboos, generateWriterPersonaDeep, getFewShotExamples} from './novelUtils';

const user = {name: '用户乙', bio: 'USER_PROFILE_画家'} as UserProfile;
const book = (id: string, extra: Partial<MountedWorldbook> = {}): MountedWorldbook => ({
    id, title: id, content: `WB_${id}`, constant: true, position: 1, ...extra,
});
const char = (): CharacterProfile => ({
    id: 'writer-a', name: '角色甲', avatar: '', description: '用户给的爱称：快乐小猫',
    systemPrompt: 'CHAR_CORE_角色甲是冷静的人类机械工程师', worldview: 'CHAR_WORLD_空间站', memories: [],
    mountedWorldbooks: [book('char', {content: '{{char}}擅长机械设计'}), book('user', {content: '{{user}}是温柔的画家'})],
    impression: {
        version: 3, value_map: {likes: ['USER_LIKES_绘画'], dislikes: ['USER_DISLIKES_噪音'], core_values: '用户重视自由'},
        personality_core: {observed_traits: ['温柔', '猫'], interaction_style: '亲近', summary: 'USER_SUMMARY_我觉得用户乙温柔'},
        mbti_analysis: {type: 'INFP', reasoning: '用户敏感', dimensions: {e_i: 20, s_n: 80, t_f: 80, j_p: 80}},
        behavior_profile: {tone_style: '温柔', emotion_summary: '平静', response_patterns: 'USER_HABIT_画画'},
        emotion_schema: {triggers: {positive: [], negative: []}, comfort_zone: '', stress_signals: []},
    },
});
const api = {baseUrl: 'https://test.invalid/v1/', apiKey: 'synthetic', model: 'test-model'};
function mockApi(content: unknown = '写作能力: 熟练\n语言风格: 简洁、重视事实') {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({choices: [{message: {content}}]}), {
        headers: {'Content-Type': 'application/json'},
    }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}
afterEach(() => {vi.restoreAllMocks(); vi.unstubAllGlobals();});

describe('writer persona identity and worldbook request', () => {
    it('keeps character identity, user profile and private impression in their own sections', async () => {
        const fetchMock = mockApi();
        const update = vi.fn();
        await generateWriterPersonaDeep(char(), user, api, update, true);
        const request = JSON.parse(fetchMock.mock.calls[0][1].body);
        const core = request.messages[0].content as string;
        const identity = core.split('### 你的身份 (Character)')[1].split('### 世界观与设定')[0];
        expect(identity).toContain('CHAR_CORE_');
        expect(identity).not.toContain('USER_');
        expect(identity).not.toContain('INFP');
        const impression = core.split('### [私密档案: 我眼中的用户乙]')[1].split('### 记忆系统')[0];
        expect(impression).toContain('USER_LIKES_绘画');
        expect(core).toContain('USER_PROFILE_画家');
        expect(core).toContain('角色甲擅长机械设计');
        expect(core).toContain('用户乙是温柔的画家');
        expect(core).toContain('挂载给角色不等于全部描述角色本人');
        expect(core).toContain('不能移植为作者特征');
        expect(core.split('CHAR_CORE_')).toHaveLength(2);
        expect(request.messages.at(-1).content).toBe('请分析角色甲本人的写作风格；用户乙是共创搭档。');
        expect(update).toHaveBeenCalledWith('writer-a', expect.objectContaining({writerPersona: expect.stringContaining('写作能力: 熟练')}));
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('respects worldbook activation, roles and depth without scanning analysis instructions', async () => {
        const fetchMock = mockApi();
        const character = {...char(), mountedWorldbooks: [
            book('before', {position: 4, depth: 4, role: 2}),
            book('after', {position: 4, depth: 0, role: 1}),
            book('disabled', {disable: true}), book('zero', {useProbability: true, probability: 0}),
            book('untriggered', {constant: false, key: ['未发送的关键词']}),
            book('instructions-only', {constant: false, key: ['专业术语']}),
            book('triggered', {constant: false, key: ['写作风格']}),
        ]};
        await generateWriterPersonaDeep(character, user, api, vi.fn(), true);
        const {messages} = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(messages[1]).toEqual({role: 'assistant', content: 'WB_before'});
        expect(messages[2].content).toContain('请分析角色甲');
        expect(messages[3]).toEqual({role: 'user', content: 'WB_after'});
        const all = JSON.stringify(messages);
        expect(all).toContain('WB_triggered');
        for (const missing of ['WB_disabled', 'WB_zero', 'WB_untriggered', 'WB_instructions-only']) expect(all).not.toContain(missing);
    });

    it('reads the currently selected character worldbooks when regenerating an existing report', async () => {
        const fetchMock = mockApi();
        const update = vi.fn();
        const character = {...char(), writerPersona: 'OLD_REPORT', writerPersonaGeneratedAt: Date.now()};
        await generateWriterPersonaDeep(character, user, api, update, true);
        await generateWriterPersonaDeep({...character, mountedWorldbooks: [book('changed-user')]}, user, api, update, true);
        const second = JSON.stringify(JSON.parse(fetchMock.mock.calls[1][1].body).messages);
        expect(second).toContain('WB_changed-user');
        expect(second).not.toContain('用户乙是温柔的画家');
        expect(second).not.toContain('OLD_REPORT');
        expect(character.writerPersona).toBe('OLD_REPORT');
        expect(update).toHaveBeenCalledTimes(2);
    });

    it('leaves a cached or hand-edited profile intact until regeneration is requested', async () => {
        const fetchMock = mockApi();
        const update = vi.fn();
        const character = {...char(), writerPersona: '手动保留的风格', writerPersonaGeneratedAt: Date.now()};
        expect(await generateWriterPersonaDeep(character, user, api, update)).toBe('手动保留的风格');
        expect(fetchMock).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });

    it.each(['', null, undefined])('does not overwrite a saved profile with an empty analysis (%s)', async content => {
        mockApi(content === undefined ? undefined : content);
        // The helper has a default argument, so explicitly replace it for a missing field.
        if (content === undefined) vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({choices: [{message: {}}]}))));
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const update = vi.fn();
        await expect(generateWriterPersonaDeep({...char(), writerPersona: '保留'}, user, api, update, true)).rejects.toThrow('未返回有效内容');
        expect(update).not.toHaveBeenCalled();
    });

    it('surfaces API failure instead of reporting a successful local fallback', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('offline', {status: 502})));
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const update = vi.fn();
        await expect(generateWriterPersonaDeep(char(), user, api, update, true)).rejects.toThrow('API Error: 502');
        expect(update).not.toHaveBeenCalled();
    });
});

describe('local writing defaults', () => {
    it.each([extractWritingTags, analyzeWriterPersonaSimple, extractWritingTaboos, getFewShotExamples])('%s does not derive author traits from user impressions or mixed world settings', helper => {
        const character = char();
        const result = helper(character);
        expect(result).toEqual(helper({...character, impression: undefined}));
        expect(result).toEqual(helper({...character, description: '用户爱称改为小狗', worldview: 'user是热血的猫妖', mountedWorldbooks: []}));
        for (const marker of ['USER_LIKES_', 'USER_DISLIKES_', 'USER_HABIT_', '你是猫', 'INFP']) expect(JSON.stringify(result)).not.toContain(marker);
    });

    it('keeps saved writing profiles in the generation prompt and labels the user as a coauthor', () => {
        const character = {...char(), writerPersona: '我的手写风格：诗意、动作'};
        const prompt = buildPrompt(character, user, {title: '测试小说', worldSetting: '', protagonists: []} as unknown as NovelBook,
            '继续', '', {write: true, comment: true, analyze: true}, [], [character]);
        expect(prompt).toContain(character.writerPersona);
        expect(prompt).toContain('用户乙是本次共创搭档');
        expect(prompt).not.toContain('USER_SUMMARY_');
        expect(prompt).toContain('不能移植为作者特征');
        expect(extractWritingTags(character)).toContain('诗意');
        expect(extractWritingTags({...character, writerPersona: '惜字如金'})).toEqual(['自定义风格']);
        expect(extractWritingTags({...character, writerPersona: undefined})).toEqual(['待分析']);
    });
});
