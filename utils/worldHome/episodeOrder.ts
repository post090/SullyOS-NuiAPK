import type { WorldEpisode, WorldProfile } from '../../types';
import { getLocalDateKey } from '../localDate';

/** Observations are ordered by completion time, never by a possibly stale round counter. */
export function orderWorldEpisodes(episodes: WorldEpisode[]): WorldEpisode[] {
    let number = 0;
    return [...episodes].sort((a, b) => a.createdAt - b.createdAt || a.round - b.round || a.id.localeCompare(b.id))
        .map(episode => {
            number = Math.max(number + 1, episode.round);
            return { ...episode, observationNumber: number };
        }).reverse();
}

/** Recover progress from history if an old UI snapshot rolled the world's counter back. */
export function recoverWorldProgress(world: WorldProfile, episodes: WorldEpisode[]): void {
    const previousClock = world.storyClock;
    world.storyClock = Math.max(world.storyClock, ...episodes.map(episode => world.timeMode === 'sim'
        ? episode.round : (episode.observationNumber ?? episode.round)));
    if (world.timeMode === 'sim' || world.storyClock === previousClock) return;
    for (const episode of episodes) {
        const match = /^(\d{4})年(\d{1,2})月(\d{1,2})日\s+周.\s+(早上|中午|晚上|凌晨)$/.exec(episode.storyTime);
        if (!match) continue;
        const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        const seg = ['早上', '中午', '晚上', '凌晨'].indexOf(match[4]);
        if (seg === 3) date.setDate(date.getDate() - 1);
        const clock = { dayKey: getLocalDateKey(date), seg };
        if (!world.realClock || clock.dayKey > world.realClock.dayKey || (clock.dayKey === world.realClock.dayKey && clock.seg > world.realClock.seg)) world.realClock = clock;
    }
}
