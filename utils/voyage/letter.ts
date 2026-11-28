export const VOYAGE_INVITE_PREFIX = 'voyage_invitation_v1/';
export const INVITATIONS_CHANGED = 'sully-voyage-invitations-changed';
export type TripDraft = {
    version: number;
    digest: string;
    content: { destination: string; outline: string; weather: string; alternatives: string; sources: string[] };
};
export type InvitationOccasion = 'gift' | 'birthday';
export type InvitationDecision = 'accept' | 'later' | 'decline';
export type InvitationReply = { decision: InvitationDecision; text: string };
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
    return `[旅迹 · ${title}] 送你一次旅费全免的旅行。去哪里、什么时候出发、想邀请谁同行，都由你决定。你也可以晚些再想，或者婉拒。${note ? '\n\n' + note : ''}`;
}

export function parseInvitationReply(value: unknown): InvitationReply {
    if (value && typeof value === 'object' && 'decision' in value && 'text' in value) {
        const { decision, text } = value;
        if ((decision === 'accept' || decision === 'later' || decision === 'decline')
            && typeof text === 'string' && text.trim() && text.trim().length <= 2000) {
            return { decision, text: text.trim() };
        }
    }
    throw new Error('没有收到完整回信，邀请已保留，可以重试。');
}
