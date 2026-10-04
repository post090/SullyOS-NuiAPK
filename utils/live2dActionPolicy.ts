import type { Live2DAction, Live2DAvatarConfig } from './live2dModelStore';

export const canPlayLive2DAction = (config: Live2DAvatarConfig, id: string, manual = false): boolean => {
    const action = config.actions.find(item => item.id === id);
    return !!action && action.permission !== 'blocked' && (manual || (action.permission === 'ai' && !action.wardrobe));
};

/** The engine's Idle randomizer does not know about the editor's permissions. */
export function installLive2DIdlePolicy(manager: {
    startRandomMotion: (...args: any[]) => Promise<boolean>;
    startMotion: (...args: any[]) => Promise<boolean>;
    state?: { isActive?: (group: string, index: number) => boolean };
}, getConfig: () => Live2DAvatarConfig, random = Math.random): void {
    manager.startRandomMotion = async (requestedGroup, priority, options) => {
        const group = requestedGroup === '__sully_permission_idle__' ? 'Idle' : requestedGroup;
        const actions = getConfig().actions.filter(action => action.kind === 'motion'
            && action.group === group && action.index !== undefined
            && canPlayLive2DAction(getConfig(), action.id)
            && !manager.state?.isActive?.(group, action.index));
        if (!actions.length) return false;
        const action = actions[Math.floor(random() * actions.length)];
        return manager.startMotion(group, action.index, priority, options);
    };
}

const faceParameters: Record<string, string[]> = {
    grin: ['ParamMouthForm'], pout: ['ParamMouthForm'], blush: ['ParamCheek'],
    'smile-eyes': ['ParamEyeLSmile', 'ParamEyeRSmile'],
    'brow-up': ['ParamBrowLY', 'ParamBrowRY'],
    'brow-sad': ['ParamBrowLY', 'ParamBrowRY', 'ParamBrowLForm', 'ParamBrowRForm', 'ParamBrowLAngle', 'ParamBrowRAngle'],
    'brow-angry': ['ParamBrowLY', 'ParamBrowRY', 'ParamBrowLForm', 'ParamBrowRForm', 'ParamBrowLAngle', 'ParamBrowRAngle'],
    'eyes-closed': ['ParamEyeLOpen', 'ParamEyeROpen'], wink: ['ParamEyeLOpen', 'ParamEyeROpen'],
};
/** Restrict the synthetic face layer, not the core model: manual expressions still work. */
export function live2DProceduralRestrictions(config: Live2DAvatarConfig, runtimeIds: Record<string, string[]> = {}) {
    const parameters = new Set<string>();
    const faces = new Set<string>();
    for (const action of config.actions) {
        if (action.permission === 'ai' && !action.wardrobe) continue;
        for (const id of action.parameterIds || runtimeIds[action.id] || []) parameters.add(id);
        for (const param of action.params || []) parameters.add(param.id);
        for (const param of action.parameterValues || []) parameters.add(param.id);
        const name = action.name + ' ' + action.file;
        if (/pout|噘嘴|撅嘴|嘟嘴|撇嘴/i.test(name)) faces.add('pout');
        if (/grin|咧嘴/i.test(name)) faces.add('grin');
    }
    for (const [face, ids] of Object.entries(faceParameters)) {
        if (ids.some(id => parameters.has(id))) faces.add(face);
    }
    return { parameters, faces };
}

export const live2DPermissionSignature = (actions: Live2DAction[]): string => JSON.stringify(
    actions.map(({ id, permission, wardrobe }) => [id, permission, !!wardrobe]),
);
