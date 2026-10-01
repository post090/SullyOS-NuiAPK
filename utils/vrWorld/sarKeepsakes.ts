import { STORY_CATCH_CATALOG, type FishingMarketState } from './fishingMarket';
import { familiarityScene, FAMILIARITY_SCENES } from './sarFamiliarity/catalog';
import type { FamiliaritySouvenir } from './sarFamiliarity/storageTypes';
import type { FamiliarityEffect, FamiliarityNpc } from './sarFamiliarity/types';

export interface SARExclusiveKeepsake {
    id: string; title: string; description: string; npc: FamiliarityNpc; source: string; at: number;
    souvenir?: FamiliaritySouvenir; artifactKind?: FamiliarityEffect['kind']; speciesId?: string; owned?: number;
}
/** A view over earned records. Opening this shelf never grants or duplicates an event reward. */
export function sarExclusiveKeepsakes(state: FishingMarketState): SARExclusiveKeepsake[] {
    const entries: SARExclusiveKeepsake[] = (state.sarFamiliarity?.souvenirs || []).map(item => {
        const scene = familiarityScene(item.sceneId);
        return { id: item.id, title: item.title, description: item.description, npc: item.npc, at: item.at, souvenir: item,
            artifactKind: scene?.nodes[item.nodeId]?.effect?.kind || 'memory-card',
            source: scene ? `${'★'.repeat(scene.rank)} · ${scene.title}` : '一起留下的回忆' };
    });
    for (const species of STORY_CATCH_CATALOG) {
        const record = state.collectionEntries?.find(item => item.actorId === 'user' && item.speciesId === species.id);
        const owned = state.inventory.filter(item => item.ownerId === 'user' && item.speciesId === species.id);
        if (!record && !owned.length) continue;
        const scene = FAMILIARITY_SCENES.find(scene => Object.values(scene.nodes).some(node => node.rewards?.some(reward => reward.kind === 'dinosaur' && reward.speciesId === species.id)));
        entries.push({ id: `special:${species.id}`, title: species.name, description: species.blurb, speciesId: species.id,
            npc: scene?.npc || 'aiven', source: scene ? `${'★'.repeat(scene.rank)} · ${scene.title}` : '星级专属赠礼',
            at: record?.firstObtainedAt || owned[0]?.caughtAt || 0, owned: owned.length });
    }
    return entries.sort((a, b) => b.at - a.at);
}
