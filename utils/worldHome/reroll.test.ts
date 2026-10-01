import { describe, expect, it, vi } from 'vitest';
import { DB } from '../db';
import { applyRelationshipDeltas, buildOwnWorldHistory, rollbackWorldBeat, rerollWorldCharBeat } from './engine';
import { applyBeatToThreads } from './threads';
import type { WorldProfile, WorldEpisode, WorldCharBeat } from '../../types';

vi.mock('../chatContextRange', () => ({ loadCharacterContextMessages: vi.fn(async () => []) }));
vi.mock('../chatRequestPayload', () => ({ buildChatRequestPayload: vi.fn(async () => ({ systemPrompt: '', cleanedApiMessages: [] })) }));
vi.mock('../safeApi', () => ({ safeFetchJson: vi.fn() }));
import { safeFetchJson } from '../safeApi';

const members = [{ id: 'a', name: '甲' }, { id: 'b', name: '乙' }];
const beat = (text = '旧剧情'): WorldCharBeat => ({ charId: 'a', charName: '甲', location: '公园', mood: '平静', narrative: text,
    memo: [text + '备忘'], phone: { dms: [{ to: '乙', lines: [text] }] },
    relationshipDeltas: [{ withName: '乙', delta: 10, newLabel: '旧标签' }],
});
const world = (id: string): WorldProfile => ({ id, name: '镇', worldview: '', mode: 'light', timeMode: 'sim',
    storyClock: 1, memberIds: ['a', 'b'], npcs: [], houses: [], relationships: [{ fromId: 'a', toId: 'b', value: 100, label: '旧标签' }], createdAt: 0, updatedAt: 0 });
const episode = (id: string): WorldEpisode => ({ id: id + '-ep', worldId: id, round: 1, storyTime: '第1天中午', trigger: 'observe', createdAt: 1,
    summary: '旧梗概', beats: [beat()], relationshipsBefore: [{ fromId: 'a', toId: 'b', value: 98, label: '朋友' }] });

describe('家园重演', () => {
    it.each([0, 1, 3])('重演保留私信和群聊位置，新消息数量 %s，支持连续重演', async (count) => {
        const w = world(`reroll-order-${count}`), ep = episode(w.id);
        const a = { ...beat(), phone: { dms: [{ to: '乙', lines: ['旧一', '旧二'] }], group: ['旧一', '旧二'] } };
        const b = { ...beat('乙的回复'), charId: 'b', charName: '乙', phone: { dms: [{ to: '甲', lines: ['乙的回复'] }], group: ['乙的回复'] } };
        ep.beats = [a, b];
        applyBeatToThreads(w, { ...a, phone: { dms: [{ to: '乙', lines: ['历史消息'] }], group: ['历史消息'] } }, members, 0, '前一轮');
        applyBeatToThreads(w, a, members, 1, ep.storyTime);
        applyBeatToThreads(w, b, members, 1, ep.storyTime);
        const replies = w.threads!.map(t => t.messages[t.messages.length - 1]);
        await DB.saveWorld(w); await DB.saveWorldEpisode(ep);
        for (let attempt = 0; attempt < 2; attempt++) {
            const lines = Array.from({ length: count }, (_, i) => `新消息-${attempt}-${i}`);
            vi.mocked(safeFetchJson).mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ narrative: '新剧情', location: '家', mood: '开心', phone: { dms: [{ to: '乙', lines }], group: lines } }) } }] });
            const result = await rerollWorldCharBeat({ world: w, characters: members as any, apiConfig: { baseUrl: 'https://test.invalid', model: 'test' } as any, userProfile: { name: '我' } as any, groups: [], trigger: 'observe', episodeId: ep.id, charId: 'a' });
            expect(result.ok).toBe(true);
            const saved = (await DB.getWorld(w.id))!;
            for (const [index, thread] of saved.threads!.entries()) {
                expect(thread.messages.map(m => m.text)).toEqual(['历史消息', ...lines, '乙的回复']);
                expect(thread.messages[thread.messages.length - 1]).toEqual(replies[index]);
            }
        }
    });
    it('恢复饱和前数值和原标签，重复重演不累计，保留其他角色消息及伏笔', () => {
        const w = world('rollback'), ep = episode(w.id);
        applyBeatToThreads(w, beat(), members, 1, ep.storyTime);
        applyBeatToThreads(w, { ...beat('他人发言'), charId: 'b', charName: '乙', phone: { group: ['他人发言'] } }, members, 1, ep.storyTime);
        w.seeds = ['a', 'b'].map(charId => ({ id: charId, charId, charName: charId, text: '秘密', hideFrom: [], round: 1, storyTime: ep.storyTime, status: 'pending' }));
        for (let i = 0; i < 2; i++) {
            rollbackWorldBeat(w, ep, 'a', members);
            expect(w.relationships[0]).toMatchObject({ value: 98, label: '朋友' });
            applyRelationshipDeltas(w, [{ ...beat(), relationshipDeltas: [{ withName: '乙', delta: -5, newLabel: '新标签' }] }], members);
            expect(w.relationships[0]).toMatchObject({ value: 93, label: '新标签' });
        }
        expect(w.threads!.flatMap(t => t.messages).map(m => m.text)).toEqual(['他人发言']);
        expect(w.seeds.map(s => s.charId)).toEqual(['b']);
    });
    it('旧存档撤销已知变化且不保留失效标签', () => {
        const w = world('legacy'), ep = episode(w.id); delete ep.relationshipsBefore;
        rollbackWorldBeat(w, ep, 'a', members);
        expect(w.relationships[0]).toEqual({ fromId: 'a', toId: 'b', value: 90 });
    });
    it('本人最新正文和备忘进入后续上下文，不泄露其他角色私人叙事', () => {
        const w = world('history'), ep = episode(w.id);
        ep.beats = [beat('新剧情'), { ...beat('他人秘密'), charId: 'b' }];
        const context = buildOwnWorldHistory(w, [ep], 'a');
        expect(context).toContain('新剧情备忘'); expect(context).not.toContain('旧剧情'); expect(context).not.toContain('他人秘密');
        expect(buildOwnWorldHistory({ ...w, simSummarizedClock: 1 }, [ep], 'a')).toBe('');
    });
    it('原子替换已注入卡片的正文和 metadata，保留 ID 和时间', async () => {
        const w = world('atomic'), ep = episode(w.id);
        await DB.saveWorld(w); await DB.saveWorldEpisode(ep);
        await DB.saveMessage({ charId: 'a', role: 'assistant', type: 'world_card', content: '旧正文', metadata: { worldId: w.id, round: 1, storyTime: ep.storyTime } as any });
        const old = (await DB.getMessagesByCharId('a', true)).find(m => (m.metadata as any)?.worldId === w.id)!;
        await DB.replaceWorldBeat({ ...w, relationships: [] }, { ...ep, beats: [beat('新剧情')] }, 'a', {
            content: '新正文', metadata: { worldId: w.id, round: 1, storyTime: ep.storyTime, narrative: '新剧情' } as any, insertIfMissing: true,
        }, w, ep);
        expect(await DB.getMessageById(old.id)).toMatchObject({ id: old.id, timestamp: old.timestamp, content: '新正文', metadata: { narrative: '新剧情' } });
        expect((await DB.getWorld(w.id))!.relationships).toEqual([]);
    });
    it('并发关系编辑使整次提交回滚，保留原剧情与卡片', async () => {
        const w = world('conflict'), ep = episode(w.id);
        await DB.saveWorld(w); await DB.saveWorldEpisode(ep);
        await DB.updateWorld(w.id, { relationships: [] });
        await expect(DB.replaceWorldBeat(w, { ...ep, beats: [beat('新剧情')] }, 'a', { content: '新正文', metadata: {}, insertIfMissing: true }, w, ep)).rejects.toThrow();
        expect((await DB.getWorldEpisodes(w.id))[0].beats[0].narrative).toBe('旧剧情');
        expect((await DB.getMessagesByCharId('a', true)).some(m => (m.metadata as any)?.worldId === w.id)).toBe(false);
    });
    it.each([true, false])('完整重演保存剧情、私信、关系、伏笔（已有剧情：%s）', async (hadBeat) => {
        const w = world(`reroll-${hadBeat}`), ep = episode(w.id);
        if (hadBeat) applyBeatToThreads(w, beat(), members, 1, ep.storyTime);
        else {
            ep.beats = [];
            ep.failedCharIds = ['a'];
            w.relationships = ep.relationshipsBefore!.map(r => ({ ...r }));
        }
        await DB.saveWorld(w); await DB.saveWorldEpisode(ep);
        vi.mocked(safeFetchJson).mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ narrative: '新剧情', location: '家', mood: '开心', phone: { dms: [{ to: '乙', lines: ['新私信'] }] }, secrets: [{ text: '新伏笔' }], relationships: [{ with: '乙', delta: -3, relabel: '新标签' }] }) } }] });
        const result = await rerollWorldCharBeat({ world: { ...w, relationships: [] }, characters: members as any, apiConfig: { baseUrl: 'https://test.invalid', model: 'test' } as any, userProfile: { name: '我' } as any, groups: [], trigger: 'observe', episodeId: ep.id, charId: 'a' });
        expect(result.ok).toBe(true);
        const savedEpisode = (await DB.getWorldEpisodes(w.id))[0];
        expect(savedEpisode.beats).toHaveLength(1);
        expect(savedEpisode.beats[0].narrative).toBe('新剧情');
        expect(savedEpisode.failedCharIds).toBeUndefined();
        const saved = (await DB.getWorld(w.id))!;
        expect(saved.threads!.flatMap(t => t.messages).map(m => m.text)).toEqual(['新私信']);
        expect(saved.relationships[0]).toMatchObject({ value: 95, label: '新标签' });
        expect(saved.seeds!.some(s => s.text === '新伏笔')).toBe(true);
    });
});
