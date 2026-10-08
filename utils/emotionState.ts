export const lastInnerStateKey = (charId: string) => `sully_last_innerstate_${charId}`;
export function getLastInnerState(charId: string): string {
    try {
        return (typeof localStorage !== 'undefined' && localStorage.getItem(lastInnerStateKey(charId))) || '';
    } catch { return ''; }
}

