import type { Emoji } from '../types';

const normalize = (text: string): string => text.normalize('NFKC').trim().toLowerCase();

/** Local name matching only. Callers supply the current character's visible emoji library. */
export function findEmojiSuggestions(emojis: readonly Emoji[], input: string, limit = 8): Emoji[] {
    const query = normalize(input);
    if (!query || limit <= 0) return [];

    const matches: { emoji: Emoji; rank: number }[] = [];
    for (const emoji of emojis) {
        const name = normalize(emoji.name);
        if (!name || !emoji.url) continue;
        const rank = name === query ? 0
            : name.startsWith(query) ? 1
            : name.includes(query) ? 2
            // Short phrases such as “想要抱抱” also work; single-letter names don't match entire drafts.
            : name.length >= 2 && query.length <= 30 && query.includes(name) ? 3
            : -1;
        if (rank >= 0) matches.push({ emoji, rank });
    }
    matches.sort((a, b) => a.rank - b.rank);
    const seen = new Set<string>();
    const result: Emoji[] = [];
    for (const { emoji } of matches) {
        if (seen.has(emoji.url)) continue;
        seen.add(emoji.url);
        result.push(emoji);
        if (result.length >= limit) break;
    }
    return result;
}
