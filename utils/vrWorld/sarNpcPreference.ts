/** Shared opt-out gate. Keep progress and assets intact when NPC content is disabled. */
export const SAR_NPC_PREFERENCE_EVENT = 'sar-npc-preference-changed';
export function sarNpcContentEnabled(storage?: Pick<Storage, 'getItem'>): boolean {
    try { return JSON.parse((storage || localStorage).getItem('vr_sar_club_state_v1') || 'null')?.npcPreference !== 'hide'; }
    catch { return true; }
}
