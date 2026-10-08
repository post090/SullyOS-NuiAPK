import type {Message} from '../types';
import {HOME_SECRETS_CONTEXT_RULES} from './homeSecretsPrompt';

export const SECRET_NOTES_UPDATED = 'home-secrets-updated';
export const HOME_HISTORY_COMMITTED = 'home-history-committed';
export interface SecretNoteOrigin {
    messageIds: number[];
    source: 'chat' | 'home';
    homeRecordIds?: string[];
}
export type SecretNoteOriginPromise = Promise<SecretNoteOrigin | undefined>;

export function secretNoteContext(text: string): string {
    return '[秘密小纸条 · 角色自己的幕后经历，不是发给用户的话]\n'
        + HOME_SECRETS_CONTEXT_RULES + '\n' + text;
}

export function announceSecretNotesChanged(charId?: string): void {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SECRET_NOTES_UPDATED, {detail: {charId}}));
}

/** Called inside the source deletion transaction, before removing/updating its row. */
export function deleteLinkedSecretNotes(store: IDBObjectStore, message: Message): void {
    for (const id of message.metadata?.secretNoteIds || []) {
        if (!Number.isSafeInteger(id) || id <= 0) continue;
        const get = store.get(id);
        get.onsuccess = () => {
            const note = get.result as Message | undefined;
            if (note?.charId === message.charId && !note.groupId && note.type === 'secret_note'
                && note.metadata?.sourceMessageIds?.includes(message.id)) store.delete(id);
        };
    }
}

export function deleteSecretNotesForIds(store: IDBObjectStore, ids: number[]): void {
    for (const id of ids) {
        const get = store.get(id);
        get.onsuccess = () => {if (get.result) deleteLinkedSecretNotes(store, get.result);};
    }
}
