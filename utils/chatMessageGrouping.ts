import type { Message } from '../types';

/** 消息气泡上的收发时间使用绝对时间差，和角色时区无关。 */
export function startsNewMessageGroup(previous: Pick<Message, 'role' | 'timestamp'> | null, current: Pick<Message, 'role' | 'timestamp'>): boolean {
    return !previous || previous.role !== current.role || Math.abs(current.timestamp - previous.timestamp) >= 5 * 60 * 1000;
}
