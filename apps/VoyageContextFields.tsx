import React, { useEffect, useId, useMemo, useState } from 'react';
import { Books, CaretDown, Check, Eye, FloppyDisk, PencilSimpleLine } from '@phosphor-icons/react';
import type { CharacterProfile } from '../types';
import { DB } from '../utils/db';
import { availableVoyageBooks, buildVoyageReference, readContextChoice, restrictVoyageChoice, saveContextChoice, type VoyageContextChoice } from '../utils/voyage/characterContext';
import TokenImg from '../components/os/TokenImg';

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

type Recipient = Pick<CharacterProfile, 'id' | 'name' | 'avatar'>;

export function VoyageRecipientTicket({ characters, actor, onSelect }: {
    characters: Recipient[]; actor: Recipient; onSelect: (id: string) => void;
}) {
    const [failedAvatar, setFailedAvatar] = useState('');
    const canSwitch = characters.length > 1;
    return <div className="voyage-ticket">
        <span className="voyage-ticket-photo" aria-hidden="true">
            {Array.from(actor.name.trim())[0]}
            {actor.avatar && failedAvatar !== actor.avatar && <TokenImg value={actor.avatar} alt=""
                onError={() => setFailedAvatar(actor.avatar)}/>}
        </span>
        <div className="voyage-ticket-name"><span>旅行者</span>
            <strong>{actor.name}{canSwitch && <CaretDown size={15} weight="bold" aria-hidden="true"/>}</strong>
        </div>
        <span className="voyage-ticket-stub" aria-hidden="true"><span className="voyage-sticker"/></span>
        {canSwitch && <select aria-label="选择角色" value={actor.id} onChange={e => onSelect(e.target.value)}>
            {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>}
    </div>;
}

const promptSources = [
    { mode: 'main', title: '主提示词' },
    { mode: 'custom', title: '自定义' },
    { mode: 'none', title: '不附带' },
] as const;

export default function VoyageContextFields({ context, busy }: { context: ReturnType<typeof useVoyageContext>; busy?: boolean }) {
    const { choice, books, reference, saved, saving, error, onChange, onSave } = context;
    const sourceGroup = useId();
    if (!choice) return <p role={error ? 'alert' : 'status'} className={error ? 'voyage-error' : 'voyage-muted'}>{error || '正在读取角色资料…'}</p>;
    return <fieldset className="voyage-reference" disabled={busy || saving} aria-label="随简报发送的角色资料">
        <fieldset className="voyage-source"><legend>提示词来源</legend>
            <div className="voyage-source-tabs">{promptSources.map(({ mode, title }) =>
                <label key={mode}><input type="radio" name={sourceGroup} value={mode} checked={choice.mode === mode}
                    onChange={() => onChange({ ...choice, mode })}/>
                    <span>{choice.mode === mode && <Check size={15} weight="bold" aria-hidden="true"/>}{title}</span>
                </label>
            )}</div>
        </fieldset>
        {choice.mode !== 'none' && <label className="voyage-note">
            <span className="voyage-note-title"><PencilSimpleLine size={19} aria-hidden="true"/>
                {choice.mode === 'main' ? <>附加叮嘱<small>选填</small></> : '自定义提示词'}
            </span>
            {choice.mode === 'main'
                ? <textarea rows={3} value={choice.extraNote} placeholder="比如，留一个上午逛书店" onChange={e => onChange({ ...choice, extraNote: e.target.value })}/>
                : <textarea rows={5} value={choice.prompt} onChange={e => onChange({ ...choice, prompt: e.target.value })}/>}
        </label>}
        <div className="voyage-attachments">
            <details><summary><Books className="voyage-index-icon" size={32} aria-hidden="true"/><span>附带世界书</span>
                <small>{choice.worldbookIds.length ? '已选 ' + choice.worldbookIds.length + ' 项' : books.size ? books.size + ' 项可选' : '暂无可选'}</small>
                <CaretDown className="voyage-disclosure" size={16} aria-hidden="true"/></summary>
                {books.size > 0 ? <div className="voyage-book-list">{Array.from(books.values(), book =>
                    <label key={book.id}><input type="checkbox" checked={choice.worldbookIds.includes(book.id)} onChange={e => {
                        const worldbookIds = e.target.checked ? [...choice.worldbookIds, book.id] : choice.worldbookIds.filter(id => id !== book.id);
                        onChange({ ...choice, worldbookIds });
                    }}/><span>{book.title}{book.category && <small>{book.category}</small>}</span></label>
                )}</div> : <p className="voyage-book-empty">这位角色没有已启用的挂载世界书。</p>}
            </details>
            <details><summary><Eye className="voyage-index-icon" size={32} aria-hidden="true"/><span>发送前预览</span>
                <CaretDown className="voyage-disclosure" size={16} aria-hidden="true"/></summary>
                <pre>{reference || '只发送旅行简报'}</pre>
            </details>
        </div>
        <button type="button" className="voyage-save" disabled={saved || saving} onClick={() => void onSave()}>
            {saved ? <Check size={19} weight="bold" aria-hidden="true"/> : <FloppyDisk size={19} aria-hidden="true"/>}
            <span aria-live="polite">{saving ? '正在保存…' : saved ? '已保存' : '保存资料'}</span>
        </button>
        {error && <p role="alert" className="voyage-error">{error}</p>}
    </fieldset>;
}
