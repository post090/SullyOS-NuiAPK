/** Local synthetic QA: real Chat, inbox pipeline and IndexedDB; held sidecar + fake LLM. */
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { OSProvider, useOS } from '../../context/OSContext';
import { MusicProvider } from '../../context/MusicContext';
import Chat from '../../apps/Chat';
import { DB } from '../../utils/db';
import { AppID } from '../../types';
import { ActiveMsgStore } from '../../utils/activeMsgStore';
import { ActiveMsgClient } from '../../utils/activeMsgClient';

const charId = new URLSearchParams(location.search).get('char') || '';
let release: (() => void) | undefined;
let requests: unknown[] = [];
const originalRead = ActiveMsgClient.readClientStateValue;
const originalAck = ActiveMsgClient.ackOutboxMessages;
const originalClear = ActiveMsgClient.clearClientStateValue;
const originalFetch = window.fetch;
ActiveMsgClient.readClientStateValue = async (...args) => {
    if (args.includes('qa-held-reasoning')) {
        await new Promise<void>(resolve => { release = resolve; });
        return '合成测试思考';
    }
    return originalRead(...args);
};
ActiveMsgClient.ackOutboxMessages = async () => {};
ActiveMsgClient.clearClientStateValue = async () => {};
window.fetch = async (input, init) => {
    if (String(input).includes('/qa-inbox-api/')) {
        requests.push(JSON.parse(String(init?.body || '{}')));
        return Response.json({ choices: [{ message: { role: 'assistant', content: '收到，我已经看到刚才的消息。' }, finish_reason: 'stop' }], usage: {} });
    }
    return originalFetch(input, init);
};
async function prepare() {
    const id = `qa-inbox-${Date.now()}`;
    await DB.saveCharacter({ id, name: '收件测试角色', avatar: '', systemPrompt: '合成数据本机测试。', activeMsg2Config: { enabled: false, instantChatEnabled: false, tasks: [] } } as any);
    localStorage.setItem('os_last_active_char_id', id);
    localStorage.setItem('os_api_config', JSON.stringify({ baseUrl: `${location.origin}/qa-inbox-api/v1`, apiKey: 'qa-only', model: 'qa-model', stream: false }));
    localStorage.setItem('os_realtime_config', JSON.stringify({ newsEnabled: false, weatherEnabled: false }));
    localStorage.setItem('sully-chat-input-preferences-v1', JSON.stringify({ sendButtonGenerates: true }));
    location.href = `/test/fixtures/inbox-qa.html?char=${id}`;
}
function ActualChat() {
    const { openApp, characters, activeCharacterId } = useOS();
    useEffect(() => { openApp(AppID.Chat); }, []);
    return characters.some(c => c.id === activeCharacterId) ? <Chat/> : <p>载入角色</p>;
}
function Page() {
    const [report, setReport] = useState('');
    const [status, setStatus] = useState('');
    const inspect = async () => setReport(JSON.stringify({ waiting: !!release, messages: (await DB.getMessagesByCharId(charId)).map(m => ({ role: m.role, content: m.content })), requests }, null, 2));
    return <main className="qa-layout"><section className="qa-phone">{charId && <OSProvider><MusicProvider><ActualChat/></MusicProvider></OSProvider>}</section><aside className="qa-panel"><h1>生成前收件 · 本机验证</h1><p>只使用合成消息与本机假 API。</p><button onClick={() => void prepare()}>准备新角色</button><button onClick={async () => {
        await ActiveMsgStore.saveInboxMessage({ messageId: `qa-${Date.now()}`, charId, charName: '收件测试角色', body: '我手里还剩两枚游戏币', receivedAt: Date.now(), messageType: 'text', metadata: { amsgReasoningRef: 'qa-held-reasoning' } });
        setStatus('消息已入本地 inbox；附带数据会等手动放行');
    }}>放入待收消息</button><button onClick={() => { release?.(); release = undefined; setStatus('已放行'); }}>放行收件</button><button onClick={() => void inspect()}>检查上下文</button><p>{status}</p><pre>{report}</pre></aside></main>;
}
const root = createRoot(document.getElementById('root')!);
root.render(<Page/>);
if (import.meta.hot) import.meta.hot.dispose(() => {
    root.unmount(); release?.();
    ActiveMsgClient.readClientStateValue = originalRead;
    ActiveMsgClient.ackOutboxMessages = originalAck;
    ActiveMsgClient.clearClientStateValue = originalClear;
    window.fetch = originalFetch;
});
