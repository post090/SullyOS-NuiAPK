import type { CharacterProfile, ChatTheme, OSTheme } from '../types';
import { decorationPatches, readBubbleDecoration, validateBubble, validateDecoration, type DecorationPart, type DecorationPreset } from './chatDecoration';
import { migrateChatThemeBlobRefs } from './blobRef';
import type { DecorationOrigin } from './decorationLibrary';

const avatarFields = ['avatarDecoration', 'avatarDecorationX', 'avatarDecorationY', 'avatarDecorationScale', 'avatarDecorationRotate'] as const;
const stable = (value: any): any => Array.isArray(value) ? value.map(stable)
    : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const originKey = (origin: DecorationOrigin) => JSON.stringify(stable(origin));
const bubbleKey = (bubble: ChatTheme) => JSON.stringify(validateBubble(bubble));

/** Prepare first; install each distinct bubble once, then assign the shared ID to every target. */
export async function prepareDecorationApplication(
    preset: DecorationPreset,
    parts: DecorationPart[],
    targets: CharacterProfile[],
    theme: OSTheme,
    availableBubbles: ChatTheme[],
    origin: DecorationOrigin,
    readBubbleOrigin: (id: string) => Promise<DecorationOrigin>,
) {
    const validated = validateDecoration(preset);
    const bubbles: ChatTheme[] = [];
    const prepared: { character: CharacterProfile; changes: Awaited<ReturnType<typeof decorationPatches>> }[] = [];
    const selected = new Map<string, ChatTheme>();
    const portable = new Map<string, Promise<ChatTheme>>();
    const retainedFrames = new Map<string, Promise<ChatTheme>>();
    const origins = new Map<string, Promise<DecorationOrigin>>();
    const portableBubble = (bubble: ChatTheme) => {
        if (!portable.has(bubble.id)) portable.set(bubble.id, readBubbleDecoration(bubble).then(p => p.parts.bubbles!));
        return portable.get(bubble.id)!;
    };
    const sourceOrigin = originKey(origin);
    const bubbleOnly = !validated.parts.css && !validated.parts.layout;
    for (const character of targets) {
        // CSS, sounds and background preservation are still computed separately for each character.
        const changes = await decorationPatches(validated, parts.filter(part => part !== 'bubbles'), 'character', character, theme);
        if (parts.includes('bubbles') && validated.parts.bubbles) {
            let desired = structuredClone(validated.parts.bubbles);
            const previous = availableBubbles.find(b => b.id === (character.bubbleStyle || theme.chatDefaultBubbleStyle));
            if (bubbleOnly && previous && (['user', 'ai'] as const).some(side => !desired[side].avatarDecoration && previous[side].avatarDecoration)) {
                for (const side of ['user', 'ai'] as const) {
                    if (!desired[side].avatarDecoration && previous[side].avatarDecoration) {
                        for (const field of avatarFields) (desired[side] as any)[field] = previous[side][field];
                    }
                }
                // Resolve only the retained frames, not unrelated images in the old bubble.
                if (!retainedFrames.has(previous.id)) retainedFrames.set(previous.id, readBubbleDecoration(desired).then(p => p.parts.bubbles!));
                desired = await retainedFrames.get(previous.id)!;
            }
            const signature = bubbleKey(desired);
            let installed = selected.get(signature);
            if (!installed) {
                // Match complete visual content and provenance, never names or imported IDs alone.
                for (const candidate of availableBubbles) {
                    if (candidate.name !== desired.name) continue;
                    try {
                        if (bubbleKey(await portableBubble(candidate)) !== signature) continue;
                        if (!origins.has(candidate.id)) origins.set(candidate.id, readBubbleOrigin(candidate.id));
                        if (originKey(await origins.get(candidate.id)!) !== sourceOrigin) continue;
                        installed = candidate;
                        break;
                    } catch { /* A broken old preset must not block installing a valid work. */ }
                }
                if (!installed) {
                    installed = await migrateChatThemeBlobRefs({ ...desired, id: 'decoration-' + crypto.randomUUID(), type: 'custom' });
                    bubbles.push(installed);
                }
                selected.set(signature, installed);
            }
            changes.character.bubbleStyle = installed.id;
        }
        prepared.push({ character, changes });
    }
    return { prepared, bubbles };
}
