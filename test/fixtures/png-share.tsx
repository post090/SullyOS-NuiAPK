// Isolated browser QA. Never imported by the production app.
import React, { lazy, Suspense, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { shareOrDownloadBlob, shareOrDownloadFile } from '../../utils/shareExport';
import { SHARE_KINDS, readShareFile, type ShareKind } from '../../utils/pngShare';
import ChromeCssEditor from '../../components/chat/ChromeCssEditor';

const Character = lazy(async () => {
    const [{ OSProvider }, { default: App }] = await Promise.all([import('../../context/OSContext'), import('../../apps/Character')]);
    return { default: () => <OSProvider><App /></OSProvider> };
});
function Harness() {
    const [kind, setKind] = useState<ShareKind>('character');
    const [result, setResult] = useState('');
    const [css, setCss] = useState('.chat-chrome { color: #887799; } /* 中文 🌙 */');
    const content = kind === 'chrome-css' ? css : JSON.stringify({ type: 'sully_character_card', version: 1, name: '月光来信', avatar: '', systemPrompt: '你是月光来信。中文 🌙', bio: 'A portable character.', mountedWorldbooks: [] });
    return <main style={{ padding: 18 }}>
        <label>内容类型<select aria-label="内容类型" value={kind} onChange={e => setKind(e.target.value as ShareKind)}>{Object.entries(SHARE_KINDS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <button onClick={async () => setResult(await shareOrDownloadFile({ content, fileName: kind === 'chrome-css' ? '月光.css' : '月光.json', mimeType: kind === 'chrome-css' ? 'text/css' : 'application/json', card: { kind, title: '月光来信' } }))}>制作分享卡</button>
        <button onClick={async () => setResult(await shareOrDownloadBlob({ blob: new Blob(['zip bytes'], { type: 'application/zip' }), fileName: '外观.zip', card: { kind: 'appearance', title: '外观包' } }))}>分享外观包</button>
        <output aria-label="导出结果">{result}</output>
        <input type="file" aria-label="还原分享文件" onChange={async event => { const f = event.target.files?.[0]; event.target.value = ''; if (!f) return; try { const source = await readShareFile(f, kind); setResult(`${source.name}\n${await source.text()}`); } catch (e) { setResult((e as Error).message); } }} />
        <section aria-label="真实白框编辑器"><ChromeCssEditor value={css} onChange={setCss} /><output aria-label="CSS 内容">{css}</output></section>
    </main>;
}
createRoot(document.getElementById('root')!).render(<Suspense fallback="加载中">{new URLSearchParams(location.search).get('app') === 'character' ? <Character /> : <Harness />}</Suspense>);
