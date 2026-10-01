import React from 'react';
import { resolveSARSimulationModules, resolveSARUserMaskProfile, resolveSARWorldlineProfile, type SARIdentityCard } from '../../utils/vrWorld/sarSimulation';

/** The archive and reader expose the same opening dossier; live director facts stay private. */
export const SARIdentityDetails: React.FC<{ card: SARIdentityCard }> = ({ card }) => {
    const world = resolveSARWorldlineProfile(card);
    const mask = resolveSARUserMaskProfile(card);
    const { variant, story } = resolveSARSimulationModules(card);
    return <>
        <details className="sarc-card-fold"><summary>你们在这里的身份</summary>
            <h3>{card.charName}</h3><p>{card.profile.identity}</p>
            <h3>另一段人生</h3><p>{card.profile.lifePatch}</p>
            <h3>与你的关系</h3><p>{card.profile.relationship}</p>
            <h3>角色坚持的事</h3><p>{card.profile.steelSeal}</p>
            <h3>随之而来的代价</h3><p>{card.profile.patchCost}</p>
            <h3>表达与行为</h3><p>{card.profile.behaviorShift}</p>
            <h3>{mask.title}</h3><p>{mask.identity}</p><p>{mask.lifePatch}</p>
        </details>
        <details className="sarc-card-fold"><summary>世界与开场</summary>
            <h3>来自两枚模块</h3><p>{variant?.title || card.variantId} · {story?.title || card.storyId}</p>
            <h3>{world.worldName}</h3><p>{world.worldPremise}</p>
            <h3>已发生的前情</h3><p>{world.arrivalPoint}</p>
            <h3>开场时的状况</h3><p>{world.activeCrisis}</p>
            <h3>角色起初关心的事</h3><p>{world.sharedObjective}</p>
            <h3>故事里的时间</h3><p>{world.countdown}</p>
            <h3>故事的开头</h3><p>{card.profile.openingScene}</p><p>{card.profile.openingLine}</p>
            <h3>你可以从这里开始</h3><p>{card.profile.playerPrompt}</p>
            <small>这里是身份卡中的开场资料，后续变化以正文为准。</small>
        </details>
    </>;
};
