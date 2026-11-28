import { clearStaleMemoryMirror, openDB } from '../db';
import { invitationText, INVITATIONS_CHANGED, VOYAGE_INVITE_PREFIX, type InvitationOccasion, type InvitationReply, type TravelInvitation, type TripDraft } from './letter';
import type { Message } from '../../types';

const letterRange = () => IDBKeyRange.bound(VOYAGE_INVITE_PREFIX, VOYAGE_INVITE_PREFIX + '\uffff');
type Change = { letter: TravelInvitation; message?: Pick<Message, 'role' | 'content'> };

export async function listInvitations(): Promise<TravelInvitation[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const request = db.transaction('assets').objectStore('assets').getAll(letterRange());
        request.onsuccess = () => {
            try {
                const letters: TravelInvitation[] = request.result.map(row => JSON.parse(row.data));
                resolve(letters.sort((a, b) => b.sentAt - a.sentAt));
            } catch { reject(new Error('邀请记录读取失败')); }
        };
        request.onerror = () => reject(request.error);
    });
}

/** A letter and its corresponding chat message commit together, including after a retry or a second tab. */
async function writeLetter(id: string, charId: string, change: (current?: TravelInvitation) => Change | undefined): Promise<TravelInvitation> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['characters', 'assets', 'messages'], 'readwrite');
        const assets = tx.objectStore('assets');
        const key = VOYAGE_INVITE_PREFIX + id;
        let result: TravelInvitation;
        let failure: unknown;
        let messageId: number | undefined;
        let changed = false;
        const character = tx.objectStore('characters').getKey(charId);
        const get = assets.get(key);
        get.onsuccess = () => {
            try {
                if (!character.result) throw new Error('收件角色已不存在。');
                const current: TravelInvitation | undefined = get.result && JSON.parse(get.result.data);
                if (current && current.charId !== charId) throw new Error('邀请与收件角色不匹配。');
                const next = change(current);
                if (!next && current) { result = current; return; }
                if (!next) throw new Error('邀请已不存在。');
                result = next.letter;
                changed = true;
                const reply = result.reply;
                assets.put({ id: key, data: JSON.stringify(result) });
                if (!next.message) return;
                const save = tx.objectStore('messages').add({
                    charId, type: 'text', ...next.message, timestamp: reply?.at ?? result.sentAt,
                    metadata: { voyageInvitationId: id, voyageOccasion: result.occasion, deliveryId: `voyage/${id}/${reply ? 'reply/' + reply.at : 'gift'}` }
                });
                save.onsuccess = () => {
                    messageId = Number(save.result);
                    clearStaleMemoryMirror(tx, charId, messageId);
                };
            } catch (error) { failure = error; tx.abort(); }
        };
        tx.onabort = tx.onerror = () => reject(failure || tx.error || new Error('邀请未能保存。'));
        tx.oncomplete = () => {
            if (messageId !== undefined) {
                try {
                    const watermark = 'mp_lastMsgId_' + charId;
                    if (Number(localStorage.getItem(watermark)) >= messageId) localStorage.removeItem(watermark);
                } catch { /* IndexedDB has already committed. */ }
            }
            if (changed && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(INVITATIONS_CHANGED, { detail: { charId, messageId } }));
            resolve(result);
        };
    });
}

export function sendInvitation(id: string, charId: string, occasion: InvitationOccasion, rawNote: string) {
    const note = rawNote.trim();
    if (!id || !charId || note.length > 600) throw new Error('请选择收件角色，留言限 600 字。');
    return writeLetter(id, charId, current => {
        if (current) {
            if (current.note !== note || current.occasion !== occasion) throw new Error('这封邀请已送出，请重新写一封。');
            return undefined;
        }
        return { letter: { id, charId, occasion, note, sentAt: Date.now() }, message: { role: 'user', content: invitationText(occasion, note) } };
    });
}

export function saveInvitationReply(id: string, charId: string, reply: InvitationReply, reconsiderAt?: number) {
    return writeLetter(id, charId, current => {
        if (!current || current.reply && (current.reply.decision !== 'later' || current.reply.at !== reconsiderAt)) return undefined;
        const at = Math.max(Date.now(), (current.reply?.at ?? 0) + 1);
        return { letter: { ...current, reply: { ...reply, at } }, message: { role: 'assistant', content: reply.text } };
    });
}

export function saveApprovedPlan(id: string, charId: string, approved: TripDraft) {
    return writeLetter(id, charId, current => {
        if (current?.reply?.decision !== 'accept') throw new Error('这封邀请尚未被接受。');
        const previous = current.approvedPlan;
        if (previous && approved.version <= previous.version) {
            if (previous.version === approved.version && previous.digest !== approved.digest) throw new Error('行程版本不一致，请核对连接的服务。');
            return undefined;
        }
        return { letter: { ...current, approvedPlan: approved } };
    });
}
