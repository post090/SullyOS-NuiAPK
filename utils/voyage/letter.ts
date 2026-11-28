import type { VoyageItinerary } from './itinerary';

export const VOYAGE_INVITE_PREFIX = 'voyage_invitation_v1/';
export const VOYAGE_CONTEXT_PREFIX = 'voyage_context_v1/';
export const INVITATIONS_CHANGED = 'sully-voyage-invitations-changed';
export type TripDraft = {
    version: number;
    digest: string;
    content: { destination: string; outline: string; weather: string; alternatives: string; sources: string[]; itinerary?: VoyageItinerary };
};
/** The worker hashes its normalized content before versioning. Older clients may have projected away newer fields. */
export async function matchesTripDigest(draft: TripDraft): Promise<boolean | undefined> {
    if (!globalThis.crypto?.subtle) return undefined;
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(draft.content)));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('') === draft.digest;
}
export type InvitationOccasion = 'gift' | 'birthday';
export type InvitationDecision = 'accept' | 'later' | 'decline';
export const voyageMoods = ['期待', '好奇', '慢悠悠', '想静静', '有点累', '忐忑'] as const;
export type VoyageMood = typeof voyageMoods[number];
export const readVoyageMood = (value: unknown) => voyageMoods.find(mood => mood === value);
export type InvitationReply = { decision: InvitationDecision; text: string; moodSticker?: VoyageMood };
export interface TravelInvitation {
    id: string;
    charId: string;
    occasion: InvitationOccasion;
    note: string;
    sentAt: number;
    reply?: InvitationReply & { at: number };
    approvedPlan?: TripDraft;
}

export const invitationTitle = (occasion: InvitationOccasion) => occasion === 'birthday' ? '生日旅行邀请' : '旅行邀请';

export function invitationStatus(letter: TravelInvitation): string {
    if (letter.approvedPlan) return '行程已批准';
    if (!letter.reply) return '等回信';
    return { accept: '已接受', later: '晚些决定', decline: '已婉拒' }[letter.reply.decision];
}

export function invitationText(occasion: InvitationOccasion, note: string): string {
    const title = invitationTitle(occasion);
    return `[旅迹 ${title}] 送你一次旅费全免的旅行。去哪里、什么时候出发、想邀请谁同行，都由你决定。你也可以晚些再想，或者婉拒。${note ? '\n\n' + note : ''}`;
}

export function parseInvitationReply(value: unknown): InvitationReply {
    if (value && typeof value === 'object' && 'decision' in value && 'text' in value) {
        const { decision, text } = value;
        if ((decision === 'accept' || decision === 'later' || decision === 'decline')
            && typeof text === 'string' && text.trim() && text.trim().length <= 2000) {
            const moodSticker = readVoyageMood('moodSticker' in value ? value.moodSticker : undefined);
            return { decision, text: text.trim(), ...(moodSticker && { moodSticker }) };
        }
    }
    throw new Error('没有收到完整回信，邀请已保留，可以重试。');
}
