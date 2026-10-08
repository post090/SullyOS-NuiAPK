import type { CharacterProfile } from '../types';

export function characterRemark(value?: string): string {
    const text = value?.trim() || '';
    return /^点击编辑设定(?:\.{3}|…)?$/.test(text) ? '' : text;
}

/** UI only: never replace the character identity used by prompts or message payloads. */
export function chatCharacterDisplayName(character: Pick<CharacterProfile, 'name'> & Partial<Pick<CharacterProfile, 'description' | 'chatShowRemark'>>): string {
    return character.chatShowRemark ? characterRemark(character.description) || character.name : character.name;
}
