import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import type { Message } from '../types';
import { DB } from './db';

export const DATE_MESSAGE_PAGE_SIZE = 50;
const merge = (older: Message[], newer: Message[]) =>
    [...new Map([...older, ...newer].map(row => [row.id, row])).values()].sort((a, b) => a.id - b.id);

/** UI history only: encounters and model context limits do not hide saved records. */
export function useDateMessageHistory(charId: string | undefined, encounterId: string, active: boolean) {
    const key = active && charId ? `${charId}:${encounterId}` : '';
    const currentKey = useRef(key);
    currentKey.current = key;
    const generation = useRef(0);
    const refreshVersion = useRef(0);
    const olderBusy = useRef(false);
    const rows = useRef<Message[]>([]);
    const [messages, updateMessages] = useState<Message[]>([]);
    const [reachedEnd, setReachedEnd] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const setMessages = useCallback((update: SetStateAction<Message[]>) => {
        rows.current = typeof update === 'function' ? update(rows.current) : update;
        updateMessages(rows.current);
    }, []);
    const refresh = useCallback(async () => {
        if (!key || !charId) return;
        const run = ++refreshVersion.current, epoch = generation.current;
        try {
            const page = await DB.getRecentMessagesByCharIdAndSource(charId, 'date', DATE_MESSAGE_PAGE_SIZE + 1);
            if (currentKey.current !== key || generation.current !== epoch || run !== refreshVersion.current) return;
            const latest = page.slice(-DATE_MESSAGE_PAGE_SIZE);
            const older = latest.length ? rows.current.filter(row => row.id < latest[0].id) : [];
            setMessages(merge(older, latest));
            if (!older.length) setReachedEnd(page.length <= DATE_MESSAGE_PAGE_SIZE);
            setError('');
        } catch {
            if (currentKey.current === key && generation.current === epoch) setError('见面记录读取失败，请重试');
        }
    }, [key, charId, setMessages]);
    useEffect(() => {
        generation.current++;
        olderBusy.current = false;
        setLoading(false); setError(''); setMessages([]); setReachedEnd(false);
        void refresh();
        return () => { generation.current++; };
    }, [refresh, setMessages]);
    const loadOlder = useCallback(async () => {
        if (!key || !charId || reachedEnd || olderBusy.current) return;
        if (!rows.current.length) { await refresh(); return; }
        olderBusy.current = true; setLoading(true); setError('');
        const epoch = generation.current, beforeId = rows.current[0].id;
        try {
            const page = await DB.getRecentMessagesByCharIdAndSource(charId, 'date', DATE_MESSAGE_PAGE_SIZE + 1, beforeId);
            if (currentKey.current !== key || generation.current !== epoch) return;
            setMessages(merge(page.slice(-DATE_MESSAGE_PAGE_SIZE), rows.current));
            setReachedEnd(page.length <= DATE_MESSAGE_PAGE_SIZE);
        } catch {
            if (currentKey.current === key && generation.current === epoch) setError('更早记录读取失败，请重试');
        } finally {
            if (currentKey.current === key && generation.current === epoch) {
                olderBusy.current = false; setLoading(false);
            }
        }
    }, [key, charId, reachedEnd, refresh, setMessages]);
    return { messages, setMessages, refresh, loadOlder, reachedEnd, loading, error };
}
