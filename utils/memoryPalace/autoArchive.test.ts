import { describe, expect, it } from 'vitest';
import type { CharacterProfile, MemoryFragment } from '../../types';
import { DB } from '../db';
import type { MemoryNode } from './types';
import { buildConservativeRepairFragments, persistAutoArchiveResult } from './autoArchive';

const noon = (year: number, month: number, day: number) => new Date(year, month - 1, day, 12).getTime();

function node(
    id: string,
    year: number,
    month: number,
    day: number,
    overrides: Partial<MemoryNode> = {},
): MemoryNode {
    const createdAt = noon(year, month, day);
    return {
        id,
        charId: 'char-1',
        content: `记忆-${id}`,
        room: 'living_room',
        tags: [],
        importance: 5,
        mood: 'neutral',
        embedded: true,
        createdAt,
        lastAccessedAt: createdAt,
        accessCount: 0,
        origin: 'extraction',
        ...overrides,
    };
}

describe('全自动记忆双写缺口修复', () => {
    it('统一持久化入口会写入神经链接，并在开关关闭后停止写入', async () => {
        const enabled = {
            id: 'auto-archive-enabled',
            name: '已开启角色',
            memories: [],
            memoryPalaceEnabled: true,
            autoArchiveEnabled: true,
        } as unknown as CharacterProfile;
        const disabled = {
            ...enabled,
            id: 'auto-archive-disabled',
            name: '已关闭角色',
            autoArchiveEnabled: false,
        } as CharacterProfile;
        await DB.saveCharacter(enabled);
        await DB.saveCharacter(disabled);

        const result = {
            stored: 1,
            skipped: 0,
            processedMessages: 20,
            memories: [],
            batches: [],
            autoArchive: {
                fragments: [{ id: 'fragment-1', date: '2026-07-22', summary: '- 已双写', mood: 'palace' }],
                hideBeforeMessageId: 123,
            },
        };
        await persistAutoArchiveResult(enabled.id, result);
        await persistAutoArchiveResult(disabled.id, result);

        const characters = await DB.getAllCharacters();
        const savedEnabled = characters.find(character => character.id === enabled.id)!;
        const savedDisabled = characters.find(character => character.id === disabled.id)!;
        expect(savedEnabled.memories).toEqual(result.autoArchive.fragments);
        expect(savedEnabled.hideBeforeMessageId).toBe(123);
        expect(savedDisabled.memories).toEqual([]);
        expect(savedDisabled.hideBeforeMessageId).toBeUndefined();
    });

    it('只补最后一条 palace 日志之后、神经链接整天为空的聊天提取节点', () => {
        const existing: MemoryFragment[] = [
            { id: 'old', date: '2026-07-21', mood: 'palace', summary: '- 已同步' },
            { id: 'manual', date: '2026-07-26', mood: 'calm', summary: '用户手动写过的记忆' },
        ];
        const nodes = [
            node('before', 2026, 7, 20),
            node('missing-a', 2026, 7, 22),
            node('missing-b', 2026, 7, 22),
            node('digestion', 2026, 7, 23, { origin: 'digestion' }),
            node('group', 2026, 7, 24, { groupId: 'group-1' }),
            node('box-summary', 2026, 7, 25, { isBoxSummary: true }),
            node('occupied-day', 2026, 7, 26),
        ];

        const repaired = buildConservativeRepairFragments(existing, nodes);

        expect(repaired).toHaveLength(1);
        expect(repaired[0].date).toBe('2026-07-22');
        expect(repaired[0].mood).toBe('palace');
        expect(repaired[0].summary).toContain('记忆-missing-a');
        expect(repaired[0].summary).toContain('记忆-missing-b');
        expect(repaired[0].summary).not.toContain('digestion');
        expect(repaired[0].summary).not.toContain('occupied-day');
    });

    it('没有历史 palace 双写证据时不猜测回填', () => {
        const repaired = buildConservativeRepairFragments(
            [{ id: 'manual', date: '2026-07-21', mood: 'calm', summary: '手动记忆' }],
            [node('later', 2026, 7, 22)],
        );
        expect(repaired).toEqual([]);
    });
});
