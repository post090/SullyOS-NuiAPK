import type { AiSession } from '../types';
import { phoneFieldToText } from './phoneEvidence';

/** Model output and restored backups may contain arrays/objects instead of a script. */
export function phoneTranscriptToText(input: unknown): string {
    const seen = new Set<object>();
    const render = (value: unknown): string => {
        if (typeof value === 'string') return value;
        if (!value || typeof value !== 'object') return phoneFieldToText(value);
        if (seen.has(value)) return '[循环引用]';
        seen.add(value);
        let text: string;
        if (Array.isArray(value)) {
            text = value.map(render).filter(Boolean).join('\n');
        } else {
            const record = value as Record<string, unknown>;
            const speaker = record.speaker ?? record.role;
            const isMe = typeof record.isMe === 'boolean' ? record.isMe
                : ['我', 'Me', 'me', 'user'].includes(String(speaker)) ? true
                : ['对方', 'Them', 'them', 'assistant', 'ai', 'AI'].includes(String(speaker)) ? false : undefined;
            const body = record.text ?? record.content ?? record.message;
            if (isMe !== undefined && body != null) {
                text = render(body).split('\n').filter(line => line.trim())
                    .map(line => `${isMe ? '我' : '对方'}: ${line}`).join('\n');
            } else {
                // Keep unrecognized fields readable rather than discarding historical content.
                text = phoneFieldToText(record);
            }
        }
        seen.delete(value);
        return text;
    };
    return render(input);
}

/** Used both before saving generated sessions and when opening older sessions. */
export function normalizePhoneAiSession(session: AiSession): AiSession {
    return {
        ...session,
        title: phoneFieldToText(session.title, '一段对话'),
        serviceName: phoneFieldToText(session.serviceName, session.service === 'claude' ? 'Claude' : 'AI 助手'),
        transcript: phoneTranscriptToText(session.transcript),
        archived: session.archived == null ? undefined : phoneTranscriptToText(session.archived),
        summaries: session.summaries?.map(summary => ({ ...summary, content: phoneFieldToText(summary.content) })),
    };
}
