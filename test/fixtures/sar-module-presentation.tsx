// Only used by isolated browser QA; uses the real OS store, persistence and DateSession.
import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { OSProvider, useOS } from '../../context/OSContext';
import DateSession from '../../components/date/DateSession';
import { SARModuleMonitor } from '../../components/sar/SARModuleMonitor';
import { DB } from '../../utils/db';
import type { DateState, Message } from '../../types';

function Harness() {
    const os = useOS();
    const char = os.characters.find(char => char.id === 'qa-sar-presentation');
    const [messages, setMessages] = useState<Message[]>([]);
    const [showDate, setShowDate] = useState(true);
    useEffect(() => { (window as any).moduleQA = { os, setShowDate }; });
    useEffect(() => { if (char) void DB.getRecentMessagesByCharId(char.id, 50).then(setMessages); }, [char?.id]);
    const initialState = useMemo(() => {
        const message = messages.at(-1);
        if (!message) return undefined;
        const raw: string = new URLSearchParams(location.search).has('legacy') ? message.content : message.metadata?.sarModuleSurface?.surface || message.content;
        const batch = raw.split('\n').filter(Boolean).map(text => ({ text, emotion: 'normal' }));
        return { dialogueBatch: batch, dialogueQueue: batch.slice(2), currentText: batch[1].text, currentSpriteKey: 'normal',
            isNovelMode: new URLSearchParams(location.search).has('reading'), timestamp: 1, peekStatus: '' } as DateState;
    }, [messages]);
    return <>
        <div style={{ position: 'absolute', inset: 0, isolation: 'isolate' }}>
            {char && initialState && showDate ? <DateSession char={char} userProfile={os.userProfile} messages={messages} initialState={initialState}
                peekStatus="" onSendMessage={async () => { throw Error('QA never calls model'); }} onReroll={async () => { throw Error('QA never calls model'); }}
                onExit={() => setShowDate(false)} onEditMessage={() => {}} onDeleteMessage={() => {}} onDeleteMessages={async () => {}} onSettings={() => {}}/>
                : <p style={{ color: 'white', padding: 20 }}>页面已切换</p>}
        </div>
        <SARModuleMonitor/>
    </>;
}
createRoot(document.getElementById('root')!).render(<OSProvider><Harness/></OSProvider>);
