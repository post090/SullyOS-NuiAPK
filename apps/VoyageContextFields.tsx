import React, { useEffect, useMemo, useState } from 'react';
import type { CharacterProfile, Worldbook } from '../types';
import { availableVoyageBooks, buildVoyageReference, readContextChoice, saveContextChoice, type VoyageContextChoice } from '../utils/voyage/characterContext';

type Actor = Pick<CharacterProfile, 'id' | 'systemPrompt' | 'mountedWorldbooks'>;
export function useVoyageContext(actor: Actor, library: Worldbook[]) {
    const [choice, setChoice] = useState<VoyageContextChoice | null>(null);
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const books = useMemo(() => availableVoyageBooks(actor, library), [actor.mountedWorldbooks, library]);
    const reference = useMemo(() => choice ? buildVoyageReference(actor.systemPrompt, books, choice) : '', [actor.systemPrompt, books, choice]);
    useEffect(() => {
        let active = true;
        readContextChoice(actor.id).then(value => { if (active) setChoice(value); })
            .catch(() => { if (active) setError('未能读取此角色的资料选择。'); });
        return () => { active = false; };
    }, [actor.id]);
    function onChange(value: VoyageContextChoice) { setChoice(value); setSaved(false); setError(''); }
    async function save() {
        if (!choice) throw new Error('请稍候，正在读取此角色的资料。');
        await saveContextChoice(actor.id, choice);
    }
    return { choice, books, reference, saved, saving, error, onChange, save,
        onSave: async () => {
            setSaving(true);
            try { await save(); setSaved(true); setError(''); }
            catch { setError('资料选择保存失败，请重试。'); }
            finally { setSaving(false); }
        } };
}
export function VoyageCharacterSettings({ actor, library }: { actor: Actor; library: Worldbook[] }) {
    const context = useVoyageContext(actor, library);
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
        {books.size > 0 && <details><summary>附带世界书 · {choice.worldbookIds.filter(id => books.has(id)).length} 项</summary>
            <div className="voyage-book-list">{Array.from(books.values(), book =>
                <label key={book.id}><input type="checkbox" checked={choice.worldbookIds.includes(book.id)} onChange={e => {
                    const worldbookIds = e.target.checked ? [...choice.worldbookIds, book.id] : choice.worldbookIds.filter(id => id !== book.id);
                    onChange({ ...choice, worldbookIds });
                }}/><span>{book.category && <small>{book.category} · </small>}{book.title}</span></label>
            )}</div></details>}
        <details><summary>预览发送的角色资料</summary><pre>{reference || '只发送旅行简报'}</pre></details>
        <button type="button" className="voyage-link" disabled={saved} onClick={() => void onSave()}>{saved ? '已保存' : '保存此角色的选择'}</button>
        {error && <p role="alert" className="voyage-error">{error}</p>}
    </fieldset>;
}
