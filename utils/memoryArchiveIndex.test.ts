import { describe, expect, it } from 'vitest';
import type { MemoryFragment } from '../types';
import { buildMemoryArchiveIndex } from './memoryArchiveIndex';

const memory = (id: string, date: string, summary = id): MemoryFragment => ({
    id,
    date,
    summary,
    mood: 'rec',
});

describe('memory archive month index', () => {
    it('shows a refined-memory month even when that month has no daily logs', () => {
        const result = buildMemoryArchiveIndex(
            [memory('august-log', '2026-08-09')],
            {
                '2026-08': '八月核心摘要',
                '2026-03': '三月幽灵摘要',
            },
            [],
        );

        expect(Object.keys(result.tree['2026'])).toEqual(['08', '03']);
        expect(result.tree['2026']['08']).toHaveLength(1);
        expect(result.tree['2026']['03']).toEqual([]);
    });

    it('does not collapse to an empty archive when only a monthly summary remains', () => {
        const result = buildMemoryArchiveIndex([], { '2026-03': '仍会进入 Memory Bank' }, []);

        expect(result.stats).toEqual({ totalChars: 0, count: 0 });
        expect(result.tree).toEqual({ '2026': { '03': [] } });
    });

    it('keeps an orphaned active month visible so it can be deactivated', () => {
        const result = buildMemoryArchiveIndex([], {}, ['2026-07']);

        expect(result.tree).toEqual({ '2026': { '07': [] } });
    });

    it('keeps daily-log counts and ordering unchanged', () => {
        const result = buildMemoryArchiveIndex(
            [
                memory('older', '2026-08-02', '短'),
                memory('newer', '2026-08-09', '更长'),
            ],
            {},
            [],
        );

        expect(result.stats).toEqual({ totalChars: 3, count: 2 });
        expect(result.tree['2026']['08'].map(item => item.id)).toEqual(['newer', 'older']);
    });
});
