import React from 'react';
import { ArrowLeft, Star } from '@phosphor-icons/react';
import { SAR_NPC_NAMES } from '../../utils/vrWorld/sarArt';
import type { FamiliarityNpc } from '../../utils/vrWorld/sarFamiliarity/types';

/** Conversation context belongs with the speaker, leaving the stage unobstructed. */
export function SARDialogueMeta({ speaker, npc, stars, replayTitle, onClose, closeLabel = '离开对话' }: {
    speaker: string; npc: FamiliarityNpc; stars?: number; replayTitle?: string;
    onClose?: () => void; closeLabel?: string;
}) {
    return <div className="srf-meta">
        <div className="srf-meta-content">
            <div className="srf-speaker">
                <b>{speaker}</b>
                {stars !== undefined && <span className={`srf-stars srf-stars-${npc}`} aria-label={`${SAR_NPC_NAMES[npc]} ${stars} 星，共五颗星`}>
                    {[1,2,3,4,5].map(n => <Star key={n} size={13} weight={n <= stars ? 'fill' : 'regular'}/>)}
                </span>}
            </div>
            {replayTitle && <span className="srf-replay-title" title={replayTitle}>{replayTitle}<small>回顾中</small></span>}
        </div>
        {onClose && <button className="srf-close" type="button" onClick={onClose} aria-label={closeLabel}><ArrowLeft size={20}/></button>}
    </div>;
}
