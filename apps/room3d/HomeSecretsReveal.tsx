import React, {useEffect, useRef, useState} from 'react';
import {Envelope, Heart, Sparkle} from '@phosphor-icons/react';
import {markHomeSecretsSeen, readHomeSecrets, type HomeSecret} from '../../utils/homeSecrets';
import './homeSecretsReveal.css';

/** Snapshot on entry only; each paper needs explicit acknowledgement. */
export default function HomeSecretsReveal({charId, active, ready = true}: {charId: string; active: boolean; ready?: boolean}) {
    const [secrets, setSecrets] = useState<HomeSecret[]>([]);
    const [index, setIndex] = useState(0);
    const [opened, setOpened] = useState(false);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const dialog = useRef<HTMLDialogElement>(null);
    const action = useRef<HTMLButtonElement>(null);
    const entry = useRef(0);
    const writing = useRef(false);
    useEffect(() => {
        const visit = ++entry.current;
        setSecrets([]); setIndex(0); setOpened(false); setError(''); setSaving(false); writing.current = false;
        if (active) readHomeSecrets(charId).then(rows => {
            if (entry.current === visit) setSecrets(rows.filter(row => !row.seen).slice(0, 2));
        }).catch(() => {if (entry.current === visit) setError('秘密暂时没能读取，重新进入小屋可重试。');});
        return () => {++entry.current;};
    }, [charId, active]);
    const visible = active && ready && (!!secrets.length || !!error);
    useEffect(() => {
        const element = dialog.current;
        if (visible && element && !element.open) element.showModal();
        return () => {if (element?.open) element.close();};
    }, [visible]);
    useEffect(() => {if (visible) action.current?.focus();}, [visible, opened, index]);
    const acknowledge = async () => {
        const secret = secrets[index];
        if (!secret || !opened || writing.current) return;
        const visit = entry.current;
        writing.current = true; setSaving(true);
        try {
            await markHomeSecretsSeen(charId, [secret.id]);
            if (entry.current !== visit) return;
            setError('');
            if (index + 1 < secrets.length) setIndex(index + 1);
            else setSecrets([]);
        } catch {
            if (entry.current === visit) setError('阅读状态没能保存，请再试一次。');
        } finally {
            if (entry.current === visit) {writing.current = false; setSaving(false);}
        }
    };
    if (!visible) return null;
    const secret = secrets[index];
    return <dialog ref={dialog} className="home-secret-dialog" aria-labelledby="home-secret-title" aria-describedby="home-secret-hint" onCancel={event => event.preventDefault()}>
        <div className="home-secret-bundle">
            <header className="home-secret-heading">
                <span className="home-secret-tag"><Envelope size={14}/> 小屋拾遗</span>
                <h2 id="home-secret-title">一些秘密……</h2>
                <p id="home-secret-hint">{secret ? opened ? '藏在日常里的一点小心思' : '有些没说出口的小事，落在了纸上' : '纸条暂时没有送到'}</p>
            </header>
            {secret && <div className="home-secret-reading" key={secret.id}>
                {opened ? <article className="home-secret-paper" aria-label="秘密小纸条">
                    <div className="home-secret-paper-heading"><Sparkle size={17} weight="fill"/><span>秘密小纸条</span><small>{index + 1} / {secrets.length}</small></div>
                    <p>{secret.text}</p>
                    <span className="home-secret-paper-sign" aria-hidden="true"><Heart size={20}/></span>
                </article> : <div className="home-secret-envelope" aria-hidden="true"><Envelope size={110} weight="duotone"/><span><Heart size={22} weight="fill"/></span></div>}
            </div>}
            {error && <p role="alert" className="home-secret-error">{error}</p>}
            <footer className="home-secret-footer">
                {secret ? <>
                    <span className="home-secret-progress">{opened ? `第 ${index + 1} 张 / 共 ${secrets.length} 张` : `${secrets.length} 张小纸条，等你拆开`}</span>
                    <button ref={action} type="button" disabled={saving} onClick={() => opened ? void acknowledge() : setOpened(true)}>
                        {saving ? '正在收好…' : !opened ? '拆开纸条' : index + 1 < secrets.length ? '读完了，下一张' : '读完了，收好纸条'}
                    </button>
                </> : <button ref={action} type="button" onClick={() => setError('')}>回到小屋</button>}
            </footer>
        </div>
    </dialog>;
}
