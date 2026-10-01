import { expect, it } from 'vitest';
import { sarExclusiveKeepsakes } from './sarKeepsakes';
import { createFishingMarketState, addCatchToState } from './fishingMarket';
import { freshFamiliarity } from './sarFamiliarity/storageTypes';
import { FAMILIARITY_SCENES } from './sarFamiliarity/catalog';
it('shows only actually earned keepsakes, retaining their original scene, draft and photo data', () => {
    const scene = FAMILIARITY_SCENES.find(s => Object.values(s.nodes).some(n => n.rewards?.some(r => r.kind === 'souvenir' && r.id === 'caian-photo')))!;
    const node = Object.entries(scene.nodes).find(([, n]) => n.rewards?.some(r => r.kind === 'souvenir' && r.id === 'caian-photo'))!;
    const state = { ...createFishingMarketState(), sarFamiliarity: freshFamiliarity() };
    expect(sarExclusiveKeepsakes(state)).toEqual([]);
    const souvenir = { id: 'caian-photo', title: '第一次 SAR 会议', description: '合照', npc: 'caian' as const, sceneId: scene.id, nodeId: node[0], at: 10, userName: '雨眠', flags: {}, draft: { photo: 'blob:local-photo' } };
    state.sarFamiliarity.souvenirs.push(souvenir);
    const [entry] = sarExclusiveKeepsakes(state);
    expect(entry.souvenir).toBe(souvenir); expect(entry.source).toContain(scene.title); expect(entry.source).toContain('★');
    expect(state.sarFamiliarity.applied).toEqual([]);
});
it('also remembers exclusive dinosaurs after transfer, without adding ordinary duplicates to this shelf', () => {
    let state = createFishingMarketState();
    const caught = { id: 'gift', speciesId: 'aiven-chimera', ownerId: 'user', ownerName: '雨眠', caughtAt: 10, sizeCm: 12, quality: 3 as const, weather: 'clear' as const, weatherLabel: '晴朗', weatherSource: 'simulated' as const };
    state = addCatchToState(state, caught);
    state = addCatchToState(state, { ...caught, id: 'ordinary', speciesId: 'brachiosaurus' });
    expect(sarExclusiveKeepsakes(state)).toHaveLength(1);
    const transferred = { ...state, inventory: state.inventory.map(c => c.id === 'gift' ? { ...c, ownerId: 'friend' } : c) };
    expect(sarExclusiveKeepsakes(transferred)[0]).toMatchObject({ speciesId: 'aiven-chimera', owned: 0, npc: 'aiven' });
    expect(sarExclusiveKeepsakes({ ...state, inventory: [], collectionEntries: [] })).toEqual([]);
});
