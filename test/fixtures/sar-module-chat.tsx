import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import MessageItem from '../../components/chat/MessageItem';
import { DB } from '../../utils/db';
import { applyAssistantPostProcessing } from '../../utils/applyAssistantPostProcessing';
import { createSARModuleSurfaceMeta, getSARModuleRuntimePlan, installSARModuleOnCharacter, parseSARModuleReply } from '../../utils/vrWorld/sarModuleRuntime';
import { SAR_MODULE_CATALOG } from '../../utils/vrWorld/sarModuleShop';
import { sarStickerRawReply } from './sar-module-sticker-reply';
import type { CharacterProfile, ChatTheme, Message, UserProfile } from '../../types';

const charId = 'qa-sar-module-sticker';
const user = { name: '测试用户' } as UserProfile;
const runtime = installSARModuleOnCharacter(SAR_MODULE_CATALOG[0], 1);
const char = { id: charId, name: '测试角色', vrState: { enabled: true, sarModule: runtime } } as CharacterProfile;
const avatar = '/assets/sar/caian-chibi.png';
const theme: ChatTheme = { id: 'qa', name: 'QA', type: 'preset', ai: { backgroundColor: '#fff', textColor: '#222', borderRadius: 15, opacity: 100 }, user: { backgroundColor: '#ddd', textColor: '#222', borderRadius: 15, opacity: 100 } };
async function loadMessages() {
    const existing = await DB.getRecentMessagesByCharId(charId, 50);
    if (existing.length) return existing;
    const parsed = parseSARModuleReply(sarStickerRawReply, getSARModuleRuntimePlan(char, user));
    await applyAssistantPostProcessing(parsed.canonical, {
        char, userProfile: user, emojis: [{ name: '咬你', url: avatar }] as any,
        contextMsgs: [], fullMessages: [], initialData: {}, historyMsgCount: 0, instantRender: true,
        sarModuleSurface: createSARModuleSurfaceMeta(runtime, parsed.assistantSurface!),
        xhsCaches: { xsecTokenCache: new Map(), noteTitleCache: new Map(), commentUserIdCache: new Map(), commentAuthorNameCache: new Map(), commentParentIdCache: new Map() },
        api: { baseUrl: 'http://localhost:0', headers: {}, effectiveApi: { baseUrl: 'http://localhost:0', apiKey: '', model: 'qa' } },
        hooks: { setMessages: () => {}, addToast: () => {} },
    });
    return DB.getRecentMessagesByCharId(charId, 50);
}
function App() {
    const [messages, setMessages] = useState<Message[]>([]), [error, setError] = useState('');
    useEffect(() => { void loadMessages().then(setMessages).catch(e => setError(String(e))); }, []);
    return <main aria-label="模块消息回归">{error && <p role="alert">{error}</p>}{messages.map((msg, index) => <div className="qa-message" data-qa-index={index} key={msg.id}>
        <MessageItem msg={msg} isFirstInGroup={index === 0} isLastInGroup={index === messages.length - 1} isLatestMessage={index === messages.length - 1}
            activeTheme={theme} charAvatar={avatar} userAvatar={avatar} charName={char.name} onLongPress={() => {}} onReply={() => {}}
            selectionMode={false} isSelected={false} onToggleSelect={() => {}} showTimestamp="never" suppressEntranceAnimation/>
    </div>)}</main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
