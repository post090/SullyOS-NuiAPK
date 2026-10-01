import type { CharacterProfile } from '../types';

export type CameraStickerGroup = '彼方' | '手办柜' | '见面立绘';
export interface CameraStickerSource { id: string; group: CameraStickerGroup; name: string; image: string; flip?: boolean }
const EMOTIONS: Record<string, string> = { normal: '日常', default: '默认', happy: '开心', angry: '生气', sad: '难过', shy: '害羞' };

export function cameraStickerSources(char?: CharacterProfile): CameraStickerSource[] {
    if (!char) return [];
    const result: CameraStickerSource[] = [];
    const add = (id: string, group: CameraStickerGroup, name: string, image?: string, flip = false) => {
        if (image?.trim()) result.push({ id, group, name, image, flip });
    };
    add('vr', '彼方', '彼方 Chibi', char.vrState?.chibi?.img, char.vrState?.chibi?.flip);
    add('room', '手办柜', '小小窝', char.sprites?.chibi);
    const record = char.specialMomentRecords?.like520_2026?.customData?.charChibi as { dataUrl?: string } | undefined;
    add('520', '手办柜', '520 大头贴', record?.dataUrl || char.chibiStudio?.like520?.img);
    const skins = [...(char.dateSkinSets || [])].sort((a, b) => Number(b.id === char.activeSkinSetId) - Number(a.id === char.activeSkinSetId));
    const addSprites = (id: string, name: string, sprites?: Record<string, string>) => {
        for (const [key, image] of Object.entries(sprites || {})) {
            if (key !== 'chibi') add(`${id}:${key}`, '见面立绘', `${name} · ${EMOTIONS[key] || key}`, image);
        }
    };
    for (const skin of skins) addSprites(`skin:${skin.id}`, skin.name, skin.sprites);
    addSprites('base', '基础立绘', char.sprites);
    return result;
}
