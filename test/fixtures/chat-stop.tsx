/** Test-only fixture: production Chat, hooks, persistence and Worker client; no generated reply mocks. */
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { OSProvider, useOS } from '../../context/OSContext';
import { MusicProvider } from '../../context/MusicContext';
import Chat from '../../apps/Chat';
import { DB } from '../../utils/db';
import { AppID } from '../../types';
import { ActiveMsgStore } from '../../utils/activeMsgStore';
import { ActiveMsgClient } from '../../utils/activeMsgClient';
import { drainOutbox, getInstantChatPending } from '../../utils/amsgInstantChat';
import { flushInboxToChat, runInstantChatStatusCheck } from '../../utils/activeMsgRuntime';
import { saveMcpServers } from '../../utils/mcpClient';

const backend = 'http://localhost:8799';
const params = new URLSearchParams(location.search);
const charId = params.get('char') || '';
let attempts = 0;
let releaseWrite: (() => void) | undefined;
const originalSave = DB.saveMessage;
DB.saveMessage = async message => {
    if (params.get('mode') === 'multi' && message.charId === charId && message.role === 'assistant') {
        attempts++;
        if (attempts === 2) await new Promise<void>(resolve => { releaseWrite = resolve; });
    }
    return originalSave(message);
};
const scenario = async (value: string) => {
    await fetch(`${backend}/__scenario`, { method: 'POST', body: JSON.stringify({ scenario: value }) });
};
async function prepare(mode: string, cloud: boolean) {
    const id = `qa-stop-${Date.now()}`;
    await scenario(mode);
    await DB.saveCharacter({ id, name: cloud ? '云端停止测试' : '本地停止测试', avatar: '', systemPrompt: '这是合成数据的本机验证，请正常回复。', showThinkingChain: false, activeMsg2Config: { enabled: false, instantChatEnabled: cloud, tasks: [] } } as any);
    await DB.saveMessage({ charId: id, role: 'user', type: 'text', content: '请回复这条测试消息' });
    localStorage.setItem('os_last_active_char_id', id);
    localStorage.setItem('os_api_config', JSON.stringify({ baseUrl: `${backend}/v1`, apiKey: 'qa-only', model: 'qa-model', stream: mode === 'stream' || mode === 'wait' }));
    localStorage.setItem('os_realtime_config', JSON.stringify({ newsEnabled: false, weatherEnabled: false }));
    localStorage.setItem('sully-chat-input-preferences-v1', JSON.stringify({ sendButtonGenerates: false }));
    saveMcpServers(mode === 'tool' ? [{ id: 'qa', name: '假工具', url: cloud ? 'https://qa-mcp.example.test/mcp' : `${backend}/mcp`, enabled: true, tools: [{ name: 'pause_test', description: '等待测试者继续', inputSchema: { type: 'object', properties: {} } }], updatedAt: Date.now() }] : []);
    const config = await (await fetch(`${backend}/__config`)).json();
    await ActiveMsgStore.saveGlobalConfig({ ...config, instantChatEnabled: cloud, instantChatSupported: true });
    if (cloud) await ActiveMsgClient.connect();
    location.href = `/test/fixtures/chat-stop.html?char=${id}&mode=${mode}`;
}
function ActualChat() {
    const { openApp, characters, activeCharacterId } = useOS();
    useEffect(() => { openApp(AppID.Chat); }, []);
    return characters.some(character => character.id === activeCharacterId) ? <Chat/> : <p>等待测试角色载入</p>;
}
function Page() {
    const [report, setReport] = useState('尚未检查');
    const [status, setStatus] = useState('请选择测试场景');
    const run = async (operation: () => Promise<unknown>) => { try { await operation(); setStatus('操作完成'); } catch (error) { setStatus(String(error)); } };
    const inspect = async () => {
        const rows = charId ? await DB.getMessagesByCharId(charId) : [];
        const pending = getInstantChatPending(charId);
        const remoteStatus = pending ? await ActiveMsgClient.getRemoteTaskStatus(pending.uuid) : null;
        const server = await (await fetch(`${backend}/__status`)).json();
        setReport(JSON.stringify({ charId, remoteStatus, waitingWrite: !!releaseWrite, attempts, pending: getInstantChatPending(charId), messages: rows.map(row => ({ id: row.id, role: row.role, content: row.content })), events: server.events.slice(-30) }, null, 2));
    };
    return <main className="qa-layout"><section className="qa-phone">{charId ? <OSProvider><MusicProvider><ActualChat/></MusicProvider></OSProvider> : <p>右侧准备场景后，使用真实聊天界面的生成和停止按钮。</p>}</section><aside className="qa-panel"><h1>停止回复 · 本机验证</h1><p>实际 Chat / useChatAI / IndexedDB；假 LLM 与 MCP，实际 Worker bundle + 内存 D1。</p><div>{[['wait', '等待'], ['stream', '流式'], ['multi', '落库交接'], ['tool', '工具'], ['error', '余额不足']].map(([mode,label]) => <React.Fragment key={mode}><button onClick={() => void run(() => prepare(mode,false))}>本地{label}</button>{mode !== 'stream' && <button onClick={() => void run(() => prepare(mode,true))}>云端{label}</button>}</React.Fragment>)}</div><div><button onClick={() => void run(() => scenario('success'))}>下一轮正常回复</button><button onClick={() => void run(async () => { releaseWrite?.(); releaseWrite = undefined; await fetch(`${backend}/__release`, { method: 'POST' }); })}>放行剩余内容</button><button onClick={() => void run(async () => { await drainOutbox({ treatBacklogAsMissed: true }); await flushInboxToChat('轮询补收'); })}>补收云端回复</button><button onClick={() => void run(runInstantChatStatusCheck)}>核对云端状态</button><button onClick={() => void run(inspect)}>检查落库与请求</button></div><p role="status">{status}</p><pre data-testid="qa-report">{report}</pre></aside></main>;
}
const root = createRoot(document.getElementById('root')!);
root.render(<Page/>);
if (import.meta.hot) import.meta.hot.dispose(() => {
    root.unmount();
    DB.saveMessage = originalSave;
    releaseWrite?.();
});
