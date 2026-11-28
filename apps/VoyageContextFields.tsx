import React, { useEffect, useMemo, useState } from 'react';
import type { CharacterProfile } from '../types';
import { DB } from '../utils/db';
import { availableVoyageBooks, buildVoyageReference, readContextChoice, restrictVoyageChoice, saveContextChoice, type VoyageContextChoice } from '../utils/voyage/characterContext';

type Actor = Pick<CharacterProfile, 'id' | 'systemPrompt' | 'mountedWorldbooks'>;
export function useVoyageContext(actor: Actor) {
    const [selection, setChoice] = useState<VoyageContextChoice | null>(null);
    const [refreshed, setRefreshed] = useState<{ from: Actor; current: Actor } | null>(null);
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const profile = refreshed?.from === actor ? refreshed.current : actor;
    const books = useMemo(() => availableVoyageBooks(profile.mountedWorldbooks), [profile.mountedWorldbooks]);
    const choice = useMemo(() => selection && restrictVoyageChoice(selection, books), [selection, books]);
    const reference = useMemo(() => choice ? buildVoyageReference(profile.systemPrompt, books, choice) : '', [profile.systemPrompt, books, choice]);
    useEffect(() => {
        let active = true;
        readContextChoice(actor.id).then(value => { if (active) setChoice(value); })
            .catch(() => { if (active) setError('未能读取此角色的资料选择。'); });
        return () => { active = false; };
    }, [actor.id]);
    function onChange(value: VoyageContextChoice) { setChoice(value); setSaved(false); setError(''); }
    async function referenceForSubmission() {
        if (!choice) throw new Error('请稍候，正在读取此角色的资料。');
        const current = await DB.getCharacter(actor.id);
        if (!current) throw new Error('收件人已不在当前用户空间。');
        const mounted = availableVoyageBooks(current.mountedWorldbooks);
        const verified = restrictVoyageChoice(choice, mounted);
        const text = buildVoyageReference(current.systemPrompt, mounted, verified);
        if (text !== reference) {
            setRefreshed({ from: actor, current });
            onChange(verified);
            throw new Error('角色设定已更新，请核对预览后再发送。');
        }
        await saveContextChoice(actor.id, verified);
        return text;
    }
    return { choice, books, reference, saved, saving, error, onChange, referenceForSubmission,
        onSave: async () => {
            if (!choice) return;
            setSaving(true);
            try { await saveContextChoice(actor.id, choice); setSaved(true); setError(''); }
            catch { setError('资料选择保存失败，请重试。'); }
            finally { setSaving(false); }
        } };
}
export function VoyageCharacterSettings({ actor }: { actor: Actor }) {
    const context = useVoyageContext(actor);
    return <VoyageContextFields context={context}/>;
}
export default function VoyageContextFields({ context, busy }: { context: ReturnType<typeof useVoyageContext>; busy?: boolean }) {
    const { choice, books, reference, saved, error, onChange, onSave } = context;
    if (!choice) return <p role={error ? 'alert' : 'status'} className={error ? 'voyage-error' : 'voyage-muted'}>{error || '正在读取角色资料…'}</p>;
    return <fieldset className="voyage-paper voyage-reference" disabled={busy || context.saving}>
        <label className="voyage-field">随简报发送的角色设定
            <select value={choice.mode} onChange={e => onChange({ ...choice, mode: e.target.value as VoyageContextChoice['mode'] })}>
                <option value="main">角色主提示词原文</option><option value="custom">自定义提示词</option><option value="none">不附提示词</option>
            </select>
        </label>
        {choice.mode === 'main' && <label className="voyage-field">附加叮嘱（选填）<textarea value={choice.extraNote} rows={3}
            onChange={e => onChange({ ...choice, extraNote: e.target.value })}/></label>}
        {choice.mode === 'custom' && <label className="voyage-field">自定义提示词<textarea value={choice.prompt} rows={5}
            onChange={e => onChange({ ...choice, prompt: e.target.value })}/></label>}
        {books.size > 0 ? <details><summary>附带世界书 <small>{choice.worldbookIds.length} 项</small></summary>
            <div className="voyage-book-list">{Array.from(books.values(), book =>
                <label key={book.id}><input type="checkbox" checked={choice.worldbookIds.includes(book.id)} onChange={e => {
                    const worldbookIds = e.target.checked ? [...choice.worldbookIds, book.id] : choice.worldbookIds.filter(id => id !== book.id);
                    onChange({ ...choice, worldbookIds });
                }}/><span>{book.title}{book.category && <small className="voyage-category">{book.category}</small>}</span></label>
            )}</div></details> : <small className="voyage-muted">这位角色没有已启用的挂载世界书</small>}
        <details><summary>预览发送的角色资料</summary><pre>{reference || '只发送旅行简报'}</pre></details>
        <button type="button" className="voyage-link" disabled={saved} onClick={() => void onSave()}>{saved ? '已保存' : '保存此角色的选择'}</button>
        {error && <p role="alert" className="voyage-error">{error}</p>}
    </fieldset>;
}
