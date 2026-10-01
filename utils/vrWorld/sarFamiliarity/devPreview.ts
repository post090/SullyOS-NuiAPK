import { FAMILIARITY_SCENES } from './catalog';
import type { FamiliarityScene } from './types';
import { useSyncExternalStore } from 'react';
import { isDevDebugAvailable, readDevDebugFlags, subscribeDevDebugFlags, subscribeDevDebugAvailability } from '../../devDebug';

export const isSARExpressionReviewEnabled = () => Boolean(import.meta.env.DEV && isDevDebugAvailable() && readDevDebugFlags().sarExpressionReview);
const subscribe = (notify: () => void) => {
    const flags = subscribeDevDebugFlags(notify), availability = subscribeDevDebugAvailability(notify);
    return () => { flags(); availability(); };
};
export const useSARExpressionReviewEnabled = () => useSyncExternalStore(subscribe, isSARExpressionReviewEnabled, () => false);

/** Temporary authored-scene proofreading. Production keeps the normal collection locks. */
export const canPreviewFamiliarityEvent = (scene: FamiliarityScene | undefined) =>
    isSARExpressionReviewEnabled() && !!scene && FAMILIARITY_SCENES.some(known => known.id === scene.id && known.npc === scene.npc);
