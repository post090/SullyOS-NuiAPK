/** 续说只作用于这次请求，不伪造或持久化用户聊天记录。 */
export function withChatContinuation<T extends { role: string; content: any }>(messages: T[], userName?: string): Array<T | { role: string; content: string }> {
    const lastSpeaker = [...messages].reverse().find(message => message.role === 'user' || message.role === 'assistant');
    if (lastSpeaker?.role !== 'assistant') return messages;
    const name = userName?.trim() || '对方';
    return [...messages, {
        role: 'user',
        content: `[${name}还想听你接着说。顺着刚才的话自然继续，只写你自己的话，说完就等${name}回应。]`,
    }];
}
