import { describe, expect, it } from 'vitest';
import { findEmojiSuggestions } from './emojiSuggestions';

const emojis = [
    { name: '给你抱抱', url: 'a.png' },
    { name: '抱抱', url: 'b.png' },
    { name: '开心', url: 'c.png' },
    { name: '抱', url: 'd.png' },
];

describe('emoji name suggestions', () => {
    it('matches partial names and ranks exact, prefix, then contained matches', () => {
        expect(findEmojiSuggestions(emojis, '抱').map(e => e.name)).toEqual(['抱', '抱抱', '给你抱抱']);
        expect(findEmojiSuggestions(emojis, '开心')).toEqual([emojis[2]]);
    });
    it('normalizes surrounding spaces, case and full-width input', () => {
        const hug = { name: 'Big HUG', url: 'hug.png' };
        expect(findEmojiSuggestions([hug], ' ｈｕｇ ')).toEqual([hug]);
    });
    it('recognizes names in short drafts without suggesting every single-character label', () => {
        expect(findEmojiSuggestions(emojis, '想要抱抱！')).toEqual([emojis[1]]);
        expect(findEmojiSuggestions(emojis, '一大段草稿'.repeat(10) + '抱抱')).toEqual([]);
    });
    it('deduplicates shared images, limits the strip and leaves the library unchanged', () => {
        const library = Array.from({ length: 20 }, (_, i) => ({ name: `抱抱${i}`, url: `${i}.png` }));
        library.unshift({ name: '抱抱', url: '0.png' });
        const before = structuredClone(library);
        const matches = findEmojiSuggestions(library, '抱');
        expect(matches).toHaveLength(8);
        expect(new Set(matches.map(e => e.url)).size).toBe(8);
        expect(library).toEqual(before);
    });
    it('does not show an empty search, missing images or unrelated stickers', () => {
        expect(findEmojiSuggestions(emojis, ' \n ')).toEqual([]);
        expect(findEmojiSuggestions(emojis, '晚安')).toEqual([]);
        expect(findEmojiSuggestions([{ name: '', url: '1.png' }, { name: '抱', url: '' }], '抱')).toEqual([]);
        expect(findEmojiSuggestions(emojis, '抱', 0)).toEqual([]);
    });
});
