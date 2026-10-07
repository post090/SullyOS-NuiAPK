import {useMemo, useState} from 'react';
import type {Emoji} from '../types';

export const EMOJI_THUMBNAIL_CACHE_LIMIT = 120;

/** Retain recently viewed img nodes, not a second copy of the image library.
 * The current page comes first; hidden entries retain their decoded image and
 * object URL. Eviction/unmount lets TokenImg release its own Blob URL as usual.
 */
export function useEmojiThumbnailCache(visible: Emoji[], library: Emoji[]): Emoji[] {
    const [retained, setRetained] = useState<Emoji[]>([]);
    const currentNames = new Set(visible.map(emoji => emoji.name));
    const available = useMemo(() => new Map(library.map(emoji => [emoji.name, emoji])), [library]);
    const next = [...visible];
    for (const previous of retained) {
        if (next.length >= EMOJI_THUMBNAIL_CACHE_LIMIT) break;
        if (currentNames.has(previous.name)) continue;
        const current = available.get(previous.name);
        // Drop removed/replaced images even while their category is hidden.
        // A replacement is loaded only when its page is actually visited.
        if (current?.url === previous.url) next.push(current);
    }
    if (next.length === retained.length && next.every((emoji, index) => emoji === retained[index])) return retained;
    // Adjust during render so a deleted or replaced image cannot appear for one
    // committed frame while an effect catches up. No reads/URL creation here.
    setRetained(next);
    return next;
}
