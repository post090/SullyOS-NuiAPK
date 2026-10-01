import type { FamiliarityNpc } from './types';

export interface FamiliarityCursor {
    runId: string; sceneId: string; nodeId: string; line: number; revision: number; startedAt: number;
    flags: Record<string, string | boolean>; drafts: Record<string, Record<string, unknown>>;
    userName: string; sullyId?: string; cast?: Partial<import('../sarArt').SARCastExpressions>; speaker?: FamiliarityNpc;
    /** Whether the guest was still on stage when arriving at this line. */
    guestPresent?: boolean;
    /** Reward-bearing nodes visited in this attempt; settled only when the scene ends. */
    visitedNodes?: string[];
}
export interface FamiliarityProgress {
    stars: number;
    completed: Record<string, { at: number; flags: Record<string, string | boolean> }>;
    day?: string; offerId?: string | null; pending?: FamiliarityCursor;
    /** Independently rolled scenes waiting for a later click, never a topic menu. */
    queuedSceneIds?: string[];
}
export interface FamiliaritySouvenir {
    id: string; title: string; description: string; npc: FamiliarityNpc; sceneId: string; nodeId: string;
    at: number; userName: string; flags: Record<string, string | boolean>; draft: Record<string, unknown>;
}
export interface FamiliarityState {
    version: 1; npcs: Record<FamiliarityNpc, FamiliarityProgress>; applied: string[];
    unlocks: string[]; titles: string[]; souvenirs: FamiliaritySouvenir[];
    coupons: Array<{ id: string; percent: number; createdAt: number; usedBy?: string }>;
    discounts: Array<{ id: string; percent: number; scope: 'all' | 'random-module'; moduleId?: string; expiresAt: number }>;
    outbox: Array<{ id: string; charId: string; text: string; at: number; delivered?: boolean }>;
}
export const freshFamiliarity = (): FamiliarityState => ({ version: 1,
    npcs: { caian: { stars: 0, completed: {} }, aiven: { stars: 0, completed: {} } },
    applied: [], unlocks: [], titles: [], souvenirs: [], coupons: [], discounts: [], outbox: [],
});
const record = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const flags = (value: unknown) => record(value) && Object.values(value).every(v => typeof v === 'string' || typeof v === 'boolean');
/** Fail closed: a damaged cursor must never silently reset a one-time reward. */
export const validateFamiliarity = (value: unknown): void => {
    const fail = () => { throw new Error('名册进度无法读取，请先导出备份；没有重置剧情或奖励'); };
    if (!record(value) || value.version !== 1 || !record(value.npcs)) return fail();
    for (const npc of ['caian', 'aiven']) {
        const p = value.npcs[npc];
        if (!record(p) || !Number.isInteger(p.stars) || p.stars < 0 || p.stars > 3 || !record(p.completed)
            || Object.values(p.completed).some((v: any) => !record(v) || !Number.isFinite(v.at) || !flags(v.flags))) return fail();
        if (p.day !== undefined && typeof p.day !== 'string') return fail();
        if (p.offerId !== undefined && p.offerId !== null && typeof p.offerId !== 'string') return fail();
        if (p.queuedSceneIds !== undefined && (!Array.isArray(p.queuedSceneIds) || p.queuedSceneIds.some((id: unknown) => typeof id !== 'string'))) return fail();
        const c = p.pending;
        if (c && (!record(c) || !c.runId || !c.sceneId || !c.nodeId || !Number.isInteger(c.line) || c.line < 0 || !Number.isInteger(c.revision) || c.revision < 0
            || !Number.isFinite(c.startedAt) || !flags(c.flags) || !record(c.drafts) || typeof c.userName !== 'string')) return fail();
        if (c?.visitedNodes !== undefined && (!Array.isArray(c.visitedNodes) || c.visitedNodes.some((id: unknown) => typeof id !== 'string'))) return fail();
    }
    for (const key of ['applied', 'unlocks', 'titles']) if (!Array.isArray(value[key]) || value[key].some((s: unknown) => typeof s !== 'string')) return fail();
    for (const key of ['souvenirs', 'coupons', 'discounts', 'outbox']) if (!Array.isArray(value[key])) return fail();
    if (value.coupons.some((c: any) => !record(c) || !c.id || !Number.isInteger(c.percent) || c.percent <= 0 || c.percent >= 100 || !Number.isFinite(c.createdAt) || (c.usedBy !== undefined && typeof c.usedBy !== 'string'))
        || value.discounts.some((d: any) => !record(d) || !d.id || !Number.isInteger(d.percent) || d.percent <= 0 || d.percent >= 100 || !['all','random-module'].includes(d.scope) || !Number.isFinite(d.expiresAt) || (d.scope === 'random-module' && typeof d.moduleId !== 'string'))
        || value.souvenirs.some((s: any) => !record(s) || !s.id || !s.sceneId || !s.nodeId || !['caian','aiven'].includes(s.npc) || typeof s.title !== 'string' || typeof s.description !== 'string' || !Number.isFinite(s.at) || !flags(s.flags) || !record(s.draft))
        || value.outbox.some((o: any) => !record(o) || !o.id || !o.charId || typeof o.text !== 'string' || !Number.isFinite(o.at))) return fail();
};
