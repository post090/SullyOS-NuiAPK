import { describe, expect, it, vi } from 'vitest';
import { buildAutoArchiveFragments, mergePalaceFragmentsIntoMemories } from './pipeline';
import { resolveLinkedArchives } from './linkedArchive';
import { MemoryNodeDB } from './db';
import type { MemoryNode } from './types';

describe('new linked archives, old archives unchanged', () => {
    const old = { id: 'old', date: '2026-09-16', summary: '旧版文本', mood: 'palace' };
    const node = { id: 'node', charId: 'char', content: '新记忆', createdAt: new Date(2026, 8, 16, 12).getTime() };
    it('adds one explicit link per new node and does not merge into old same-day snapshots', () => {
        const fragments = buildAutoArchiveFragments([node], 10, true)!.fragments;
        const merged = mergePalaceFragmentsIntoMemories([old], fragments);
        expect(merged).toHaveLength(2); expect(merged[0]).toBe(old);
        expect(merged[1]).toMatchObject({ palaceMemoryId: 'node', summary: '新记忆', date: old.date });
        expect(mergePalaceFragmentsIntoMemories(merged, fragments)).toEqual(merged);
    });
    it('keeps historical repair/import generation as plain snapshots', () => {
        expect(buildAutoArchiveFragments([node], 0)!.fragments[0].palaceMemoryId).toBeUndefined();
    });
    it('resolves only explicit links and leaves fallback text untouched in storage', async () => {
        const spy = vi.spyOn(MemoryNodeDB, 'getById').mockResolvedValue({ ...node, content: '宫殿修改后' } as MemoryNode);
        try {
            const linked = buildAutoArchiveFragments([node], 0, true)!.fragments[0];
            const resolved = await resolveLinkedArchives('char', [old, linked]);
            expect(resolved[0]).toBe(old); expect(resolved[1].summary).toBe('宫殿修改后');
            expect(linked.summary).toBe('新记忆'); expect(spy).toHaveBeenCalledTimes(1);
            expect((await resolveLinkedArchives('another-char', [linked]))[0]).toBe(linked);
            spy.mockResolvedValue(undefined);
            expect((await resolveLinkedArchives('char', [linked]))[0]).toBe(linked);
        } finally { spy.mockRestore(); }
    });
});
