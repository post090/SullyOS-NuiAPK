import {beforeEach, describe, expect, it, vi} from 'vitest';
import {DB} from './db';
import {prepareHomeSecretTask, landHomeSecrets as landHomeSecretsRaw, readHomeSecrets, buildHomeSecretsContext, markHomeSecretsSeen, HOME_SECRET_REQUEST_LEASE_MS} from './homeSecrets';
import {applyEmotionEvalRaw as applyEmotionEvalRawRaw, parseEmotionEvalOutput} from './emotionApply';
import {ChatPrompts} from './chatPrompts';
import {ContextBuilder} from './context';
import {runAmsgEmotionEval} from '../worker/amsg/src/emotionEval';
import type {CharacterProfile, UserProfile} from '../types';
import {DEFAULT_DEV_DEBUG_FLAGS, writeDevDebugFlags} from './devDebug';

const char = (id = 'secret-c', pets: any[] = []): CharacterProfile => ({id, name: '阿澄', timeAwarenessEnabled: false,
    home3D: {version: 1, activeRoomId: 'r', rooms: [{id: 'r', name: '客厅', items: []}], petLife: {pets}},
} as unknown as CharacterProfile);
const history = (text = '你好看') => [{role: 'user', content: text}, {role: 'assistant', content: '嗯。'}, {role: 'user', content: '这一轮还没答'}];
const draft = (id: string, extra = {}) => ({kind: 'character', anchorId: id, petIds: [], text: '你夸阿澄好看时，ta 偷偷照了镜子。', ...extra});
const output = (id: string, extra = {}) => ({changed: false, innerState: '心情平稳', homeSecretRequestId: id, homeSecrets: [draft(id)], ...extra});

const origins = new Map<string, number[]>();
async function origin(charId: string) {
    if (!origins.has(charId)) origins.set(charId, [await DB.saveMessage({charId, role:'assistant', type:'text', content:'本轮回复第一句'}),
        await DB.saveMessage({charId, role:'assistant', type:'text', content:'本轮回复第二句'})]);
    return {source:'chat' as const, messageIds:origins.get(charId)!};
}
const landHomeSecrets = async (charId:string, result:any, id?:string, raw?:string) => landHomeSecretsRaw(charId,result,id,raw,await origin(charId));
const applyEmotionEvalRaw = async (raw:string, c:CharacterProfile, id?:string) => applyEmotionEvalRawRaw(raw,c,id,await origin(c.id));

beforeEach(async () => {vi.restoreAllMocks(); origins.clear(); await DB.deleteDB();});

describe('home secrets probability and prompt', () => {
    it('the wrench override bypasses only randomness and stops when disabled or debug is unavailable', async () => {
        const target = new EventTarget();
        Object.defineProperty(target, 'localStorage', {value: localStorage});
        vi.stubGlobal('window', target);
        vi.stubGlobal('__BUILD_BADGE_VISIBLE__', true);
        try {
            writeDevDebugFlags({...DEFAULT_DEV_DEBUG_FLAGS, forceHomeSecretRoll: true});
            const c = char(); await DB.saveCharacter(c);
            const random = vi.fn(() => 0.99);
            const task = await prepareHomeSecretTask(c, history(), random);
            expect(task?.prompt).toContain('调试开关已强制命中');
            expect(random).not.toHaveBeenCalled();
            expect(task?.prompt).toContain('本轮没有宠物');
            expect(await prepareHomeSecretTask(c, history(), random)).toBeUndefined();
            expect(await prepareHomeSecretTask(c, [{role: 'user', content: '未回复'}], random)).toBeUndefined();
            expect(await prepareHomeSecretTask({...c, home3D: undefined}, history(), random)).toBeUndefined();
            writeDevDebugFlags({...DEFAULT_DEV_DEBUG_FLAGS, forceHomeSecretRoll: false});
            expect(await prepareHomeSecretTask(c, history('另一段'), random)).toBeUndefined();
            writeDevDebugFlags({...DEFAULT_DEV_DEBUG_FLAGS, forceHomeSecretRoll: true});
            vi.stubGlobal('__BUILD_BADGE_VISIBLE__', false);
            expect(await prepareHomeSecretTask(c, history('第三段'), random)).toBeUndefined();
        } finally {
            vi.stubGlobal('__BUILD_BADGE_VISIBLE__', true);
            writeDevDebugFlags({...DEFAULT_DEV_DEBUG_FLAGS});
            vi.unstubAllGlobals();
        }
    });
    it('samples exactly at the 20% boundary and only from a completed exchange', async () => {
        const c = char(); await DB.saveCharacter(c);
        expect(await prepareHomeSecretTask(c, history(), () => 0.2)).toBeUndefined();
        const task = await prepareHomeSecretTask(c, history(), () => 0.199999);
        expect(task?.prompt).toContain('必须给出 1 条完整秘密');
        expect(task?.prompt).toContain('你好看');
        expect(task?.prompt).not.toContain('这一轮还没答');
        const random = vi.fn(() => 0);
        expect(await prepareHomeSecretTask(c, [{role: 'user', content: '还没答'}], random)).toBeUndefined();
        expect(random).not.toHaveBeenCalled();
    });
    it('omits pet styles entirely with no actual pets, including stale caller data', async () => {
        const c = char(); await DB.saveCharacter(c);
        const stale = char(c.id, [{id: 'gone', name: '旧宠物', assetId: 'pet_cat'}]);
        const task = await prepareHomeSecretTask(stale, history(), () => 0);
        expect(task?.prompt).toContain('本轮没有宠物');
        expect(task?.prompt).not.toContain('宠物博主滤镜');
        expect(task?.prompt).not.toContain('旧宠物');
    });
    it('uses actual species/traits and reserves one request for concurrent identical anchors', async () => {
        const c = char('pet-c', [{id: 'slime', name: '年糕', assetId: 'pet_slime', traits: ['好奇']}]); await DB.saveCharacter(c);
        const tasks = await Promise.all([prepareHomeSecretTask(c, history(), () => 0), prepareHomeSecretTask(c, history(), () => 0)]);
        expect(tasks.filter(Boolean)).toHaveLength(1);
        expect(tasks.find(Boolean)?.prompt).toContain('pet_slime');
        expect(tasks.find(Boolean)?.prompt).toContain('宠物博主滤镜');
    });
});

describe('home secrets end-to-end landing', () => {
    it('releases abandoned reservations but deduplicates a late cloud result against its replacement', async () => {
        const c = char(); await DB.saveCharacter(c);
        const now = Date.now(); const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
        const first = (await prepareHomeSecretTask(c, history(), () => 0))!;
        clock.mockReturnValue(now + HOME_SECRET_REQUEST_LEASE_MS - 1);
        expect(await prepareHomeSecretTask(c, history(), () => 0)).toBeUndefined();
        clock.mockReturnValue(now + HOME_SECRET_REQUEST_LEASE_MS);
        const replacement = (await prepareHomeSecretTask(c, history(), () => 0))!;
        expect(replacement.id).not.toBe(first.id);
        await landHomeSecrets(c.id, output(replacement.id));
        await markHomeSecretsSeen(c.id, [replacement.id]);
        await landHomeSecrets(c.id, output(first.id));
        expect(await readHomeSecrets(c.id)).toEqual([expect.objectContaining({id: replacement.id, seen: true})]);
    });
    it('releases legacy reservations without timestamps without losing their original output', async () => {
        const c = char(); await DB.saveCharacter(c);
        const task = (await prepareHomeSecretTask(c, history(), () => 0))!;
        const key = `home_secrets_v1_${c.id}`;
        const state = JSON.parse((await DB.getAsset(key))!);
        delete state.requests[0].createdAt;
        state.requests[0].raw = 'legacy diagnostic';
        await DB.saveAsset(key, JSON.stringify(state));
        expect(await prepareHomeSecretTask(c, history(), () => 0)).toBeDefined();
        const stored = JSON.parse((await DB.getAsset(key))!);
        expect(stored.requests.find((r: any) => r.id === task.id)).toMatchObject({raw: 'legacy diagnostic', error: expect.any(String)});
    });
    it('rejects truncated secret text instead of inventing the missing ending', async () => {
        const c = char(); await DB.saveCharacter(c);
        const task = (await prepareHomeSecretTask(c, history(), () => 0))!;
        const complete = JSON.stringify(output(task.id));
        const raw = complete.slice(0, complete.indexOf('照了镜子'));
        expect(parseEmotionEvalOutput(raw)?.homeSecrets).toBeUndefined();
        await applyEmotionEvalRaw(raw, c, task.id);
        expect(await readHomeSecrets(c.id)).toEqual([]);
        const stored = JSON.parse((await DB.getAsset(`home_secrets_v1_${c.id}`))!);
        expect(stored.requests[0]).toMatchObject({raw, error: expect.any(String)});
        expect(await prepareHomeSecretTask(c, history(), () => 0)).toBeDefined();
    });
    it('still rescues a complete secret when a later emotion field is truncated', () => {
        const raw = JSON.stringify(output('req')).slice(0, -1) + ',"injection":"剩余内容截断';
        expect(parseEmotionEvalOutput(raw)?.homeSecrets).toEqual([draft('req')]);
    });
    it('refuses a mismatched echoed request ID and a removed home at landing', async () => {
        const c = char(); await DB.saveCharacter(c);
        const task = (await prepareHomeSecretTask(c, history(), () => 0))!;
        await expect(landHomeSecrets(c.id, output(task.id, {homeSecretRequestId: 'wrong'}), task.id)).rejects.toThrow('未生成完整');
        await DB.saveCharacter({...c, home3D: undefined});
        await expect(landHomeSecrets(c.id, output(task.id), task.id)).rejects.toThrow('未生成完整');
        expect(await readHomeSecrets(c.id)).toEqual([]);
    });
    it('unchanged emotion still saves, enters real context before reveal, survives reread and replay', async () => {
        const c = char(); await DB.saveCharacter(c);
        const task = (await prepareHomeSecretTask(c, history(), () => 0))!;
        const raw = JSON.stringify(output(task.id));
        expect(parseEmotionEvalOutput(raw)?.homeSecrets).toEqual([draft(task.id)]);
        expect(await applyEmotionEvalRaw(raw, c, task.id)).toBe('心情平稳');
        expect(await readHomeSecrets(c.id)).toEqual([expect.objectContaining({seen: false, text: draft(task.id).text})]);
        const context = await ContextBuilder.buildCoreContext(c, {name: '用户'} as UserProfile);
        expect(context).not.toContain(draft(task.id).text);
        const timeline = await DB.getRecentMessagesByCharId(c.id, 20);
        const sent = ChatPrompts.buildMessageHistory(timeline,20,c,{name:'用户'} as UserProfile,[],undefined,{contextHighWaterMark:0}).apiMessages;
        expect(JSON.stringify(sent)).toContain(draft(task.id).text);
        expect(JSON.stringify(sent)).toContain('你并不知道用户看过');
        await markHomeSecretsSeen(c.id, [task.id]);
        await applyEmotionEvalRaw(raw, c);
        expect(await readHomeSecrets(c.id)).toEqual([expect.objectContaining({seen: true})]);
        expect(await buildHomeSecretsContext(c.id)).toBe('');
        expect(await readHomeSecrets('other')).toEqual([]);
    });
    it('preserves secrets through damaged JSON field salvage', () => {
        const raw = `{"changed": false, "homeSecretRequestId":"req", "homeSecrets":${JSON.stringify([draft('req')])}, "broken": invalid}`;
        const result = parseEmotionEvalOutput(raw);
        expect(result?.salvaged).toBe(true);
        expect(result?.homeSecrets).toEqual([draft('req')]);
        expect(result?.homeSecretRequestId).toBe('req');
    });
    it('rejects phantom pets and keeps the original response for diagnosis', async () => {
        const c = char(); await DB.saveCharacter(c);
        const task = (await prepareHomeSecretTask(c, history(), () => 0))!;
        const result = output(task.id, {homeSecrets: [draft(task.id, {kind: 'pet', petIds: ['invented']})]});
        await expect(landHomeSecrets(c.id, result, task.id, 'ORIGINAL_RESPONSE')).rejects.toThrow('宠物/聊天锚点不匹配');
        expect(await readHomeSecrets(c.id)).toEqual([]);
        expect(await DB.getAsset(`home_secrets_v1_${c.id}`)).toContain('ORIGINAL_RESPONSE');
    });
    it('accepts real pets, but revalidates removed pets against storage at landing', async () => {
        const c = char('pet-c', [{id: 'p', name: '年糕', assetId: 'pet_slime'}]); await DB.saveCharacter(c);
        const first = (await prepareHomeSecretTask(c, history(), () => 0))!;
        await landHomeSecrets(c.id, output(first.id, {homeSecrets: [draft(first.id, {kind: 'pet', petIds: ['p']})]}));
        expect(await readHomeSecrets(c.id)).toHaveLength(1);
        const second = (await prepareHomeSecretTask(c, history('另一个话题'), () => 0))!;
        await DB.saveCharacter(char(c.id));
        await expect(landHomeSecrets(c.id, output(second.id, {homeSecrets: [draft(second.id, {kind: 'pet', petIds: ['p']})]}))).rejects.toThrow();
        expect(await readHomeSecrets(c.id)).toHaveLength(1);
    });
    it('cloud raw transport reaches the same landing path and flags omitted mandatory output', async () => {
        const c = char(); await DB.saveCharacter(c);
        const task = (await prepareHomeSecretTask(c, history(), () => 0))!;
        vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({choices: [{message: {content: JSON.stringify(output(task.id))}}]}))));
        try {
            const result = await runAmsgEmotionEval({prompt: task.prompt, homeSecretRequestId: task.id}, {baseUrl: 'https://test.invalid', model: 'test', apiKey: ''}, history(), c.name);
            await applyEmotionEvalRaw(result.raw!, c);
            expect(await readHomeSecrets(c.id)).toHaveLength(1);
            const other = (await prepareHomeSecretTask(c, history('第二段'), () => 0))!;
            await applyEmotionEvalRaw(`HOME_SECRET_REQUEST:${other.id}\n{"changed":false}`, c);
            const stored = JSON.parse((await DB.getAsset(`home_secrets_v1_${c.id}`))!);
            expect(stored.requests.find((r: any) => r.id === other.id).error).toContain('未生成完整');
        } finally {vi.unstubAllGlobals();}
    });
    it('parallel different anchors and reveal updates never overwrite saved results', async () => {
        const c = char(); await DB.saveCharacter(c);
        const one = (await prepareHomeSecretTask(c, history('一'), () => 0))!;
        const two = (await prepareHomeSecretTask(c, history('二'), () => 0))!;
        await landHomeSecrets(c.id, output(one.id));
        await Promise.all([landHomeSecrets(c.id, output(two.id)), markHomeSecretsSeen(c.id, [one.id])]);
        const rows = await readHomeSecrets(c.id);
        expect(rows).toHaveLength(2);
        expect(rows.find(r => r.id === one.id)?.seen).toBe(true);
        expect(rows.find(r => r.id === two.id)?.seen).toBe(false);
    });
});
