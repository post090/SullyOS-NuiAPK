import type { CharacterProfile, MountedWorldbook } from '../../types';
import { DB } from '../db';
import { VOYAGE_CONTEXT_PREFIX } from './letter';

export interface VoyageContextChoice {
    mode: 'main' | 'custom' | 'none';
    prompt: string;
    extraNote: string;
    worldbookIds: string[];
}
export const defaultContextChoice = (): VoyageContextChoice => ({ mode: 'main', prompt: '', extraNote: '', worldbookIds: [] });

export async function readContextChoice(charId: string): Promise<VoyageContextChoice> {
    const raw = await DB.getAsset(VOYAGE_CONTEXT_PREFIX + charId);
    if (!raw) return defaultContextChoice();
    const data: unknown = JSON.parse(raw);
    const extraNote = data && typeof data === 'object' && 'extraNote' in data ? data.extraNote : '';
    if (!data || typeof data !== 'object' || !('mode' in data) || (data.mode !== 'main' && data.mode !== 'custom' && data.mode !== 'none')
        || !('prompt' in data) || typeof data.prompt !== 'string' || typeof extraNote !== 'string'
        || !('worldbookIds' in data) || !Array.isArray(data.worldbookIds) || !data.worldbookIds.every((id: unknown) => typeof id === 'string')) {
        throw new Error('这位角色的策划资料选择无法读取。');
    }
    return { mode: data.mode, prompt: data.prompt, extraNote,
        worldbookIds: [...new Set<string>(data.worldbookIds)] };
}
export const saveContextChoice = (charId: string, choice: VoyageContextChoice) =>
    DB.saveAsset(VOYAGE_CONTEXT_PREFIX + charId, JSON.stringify(choice));

export function availableVoyageBooks(char: Pick<CharacterProfile, 'mountedWorldbooks'>, library: MountedWorldbook[]) {
    const books = new Map((char.mountedWorldbooks ?? []).map(book => [book.id, book]));
    for (const book of library) books.set(book.id, book);
    return books;
}
export function buildVoyageReference(mainPrompt: string, books: Map<string, MountedWorldbook>, choice: VoyageContextChoice) {
    const sections: string[] = [];
    const prompt = choice.mode === 'main' ? mainPrompt : choice.mode === 'custom' ? choice.prompt : '';
    if (prompt?.trim()) sections.push((choice.mode === 'main' ? '【角色主提示词】' : '【自定义提示词】') + '\n' + prompt);
    if (choice.mode === 'main' && choice.extraNote.trim()) sections.push('【附加叮嘱】\n' + choice.extraNote);
    for (const id of new Set(choice.worldbookIds)) {
        const book = books.get(id);
        if (book?.content?.trim()) sections.push('【世界书 · ' + book.title + '】\n' + book.content);
    }
    return sections.join('\n\n');
}
