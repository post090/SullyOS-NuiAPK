import { expect, it } from 'vitest';
import type { CharacterProfile } from '../types';
import { cameraStickerSources } from './cameraStickerSources';

it('keeps each studio slot and all date skins, without treating room chibi as a date portrait', () => {
    const char = { vrState: { chibi: { img: 'vr', flip: true } }, sprites: { chibi: 'blobref:room', normal: 'base', custom: 'custom' },
        activeSkinSetId: 'b', dateSkinSets: [{ id: 'a', name: '春', sprites: { happy: 'spring' } }, { id: 'b', name: '冬', sprites: { sad: 'winter', chibi: 'wrong' } }],
        chibiStudio: { like520: { img: 'draft' } }, specialMomentRecords: { like520_2026: { customData: { charChibi: { dataUrl: 'saved' } } } } } as unknown as CharacterProfile;
    const sources = cameraStickerSources(char);
    expect(sources.map(s => s.image)).toEqual(['vr', 'blobref:room', 'saved', 'winter', 'spring', 'base', 'custom']);
    expect(sources[0].flip).toBe(true);
    expect(sources.filter(s => s.group === '见面立绘')).toHaveLength(4);
    expect(char.dateSkinSets![0].id).toBe('a');
});
it('uses the uncompleted 520 studio image and does not invent missing slots from avatars', () => {
    expect(cameraStickerSources({ avatar: 'avatar', chibiStudio: { like520: { img: 'draft' } } } as CharacterProfile).map(s => s.image)).toEqual(['draft']);
    expect(cameraStickerSources()).toEqual([]);
});
