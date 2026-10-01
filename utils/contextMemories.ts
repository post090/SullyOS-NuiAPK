import type { CharacterProfile } from '../types';

/** Shared with the prompt renderer: closed eyes suppress daily logs, never monthly summaries. */
export function readableContextMemories(char: CharacterProfile, includeDetails = true) {
    const monthly = Object.entries(char.refinedMemories || {}).sort().map(([date, summary]) => ({ date, summary }));
    const daily = (includeDetails ? char.activeMemoryMonths || [] : []).map(month => ({
        month,
        entries: (char.memories || []).filter(memory => {
            let date = memory.date.replace(/[\/年月]/g, '-').replace('日', '');
            const parts = date.split('-');
            if (parts.length >= 2) date = `${parts[0]}-${parts[1].padStart(2, '0')}`;
            return date.startsWith(month);
        }),
    }));
    return { monthly, daily };
}
