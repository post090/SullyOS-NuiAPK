import { afterEach, expect, it, vi } from 'vitest';
import { calculateEffectiveImportance } from './consolidation';
import { hybridSearch } from './hybridSearch';
import { vectorSearch } from './vectorSearch';
import { ROOM_CONFIGS, resolveMemoryScoringRoom, type MemoryNode } from './types';

vi.mock('./vectorSearch', () => ({ vectorSearch: vi.fn() }));
afterEach(() => vi.clearAllMocks());
const now = 1791045900362;
const node = (id: string, room: unknown): MemoryNode => ({
    id, charId: 'room-test', content: '一起看花的约定', room,
    importance: 8, createdAt: now - 7 * 24 * 3600_000, lastAccessedAt: now - 24 * 3600_000,
    accessCount: 2, embedded: true, tags: [], links: [], mood: 'happy',
} as MemoryNode);

it.each([undefined, null, '', '客厅', 'unknown-room', '__proto__', 'constructor', 'toString', 42])(
    'invalid room %s uses the same finite scoring fallback without modifying the memory', async room => {
        const broken = node('broken', room);
        const valid = node('valid', 'living_room');
        expect(resolveMemoryScoringRoom(room)).toBe('living_room');
        expect(calculateEffectiveImportance(broken, now)).toBe(calculateEffectiveImportance(valid, now));
        // Remote candidate has no local row; local candidate is supplemented from prefetched rows.
        vi.mocked(vectorSearch).mockResolvedValue([{ node: broken, similarity: 0.9 }, { node: valid, similarity: 0.8 }]);
        const results = await hybridSearch('看花', 'room-test', {} as any, 15, undefined,
            { queryVector: new Float32Array([1, 0]), allNodes: [valid], allVectors: [] });
        expect(results.map(result => result.node.id).sort()).toEqual(['broken', 'valid']);
        expect(results.every(result => Number.isFinite(result.finalScore))).toBe(true);
        expect(broken.room).toBe(room);
        expect(broken.content).toBe('一起看花的约定');
        // Same guard applies when the malformed record is stored locally and reached by BM25.
        vi.mocked(vectorSearch).mockResolvedValue([]);
        const local = await hybridSearch('一起看花的约定', 'room-test', {} as any, 15, undefined,
            { queryVector: new Float32Array([1, 0]), allNodes: [broken, valid], allVectors: [] });
        expect(local).toHaveLength(2);
        expect(local.every(result => Number.isFinite(result.finalScore))).toBe(true);
    },
);

it('retains all seven valid rooms and their existing decay rules', () => {
    for (const [room, config] of Object.entries(ROOM_CONFIGS)) {
        expect(resolveMemoryScoringRoom(room)).toBe(room);
        const memory = node(room, room);
        const floor = room === 'living_room' ? 0.8 : 0.9;
        expect(calculateEffectiveImportance(memory, now)).toBe(config.decayRate === null ? 8
            : Math.max(8 * Math.pow(config.decayRate, 168), 8 * floor));
    }
});
