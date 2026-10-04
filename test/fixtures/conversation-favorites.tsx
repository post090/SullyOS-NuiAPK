import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import FavoritesPortal from '../../components/chat/VoiceFavoritesPortal';
import ChatInputArea from '../../components/chat/ChatInputArea';
import { saveConversationContentFavorite } from '../../utils/contentFavorites';
import type { Message } from '../../types';
const messages: Message[] = [
    { id: 910001, charId: 'favorite-preview', role: 'user', type: 'text', content: '等明年春天，我们再一起看花吧。', timestamp: 1791000000000 },
    { id: 910002, charId: 'favorite-preview', role: 'assistant', type: 'text', content: '好，我记住了。到时候我们走慢一点。', timestamp: 1791000060000 },
    { id: 910003, charId: 'favorite-preview', role: 'user', type: 'text', content: '那就说定了。', timestamp: 1791000120000 },
];
function Preview() {
    const [selected, setSelected] = useState(new Set(messages.map(m => m.id)));
    const [open, setOpen] = useState(false);
    return <div className="h-full max-w-md mx-auto flex flex-col bg-slate-50 text-slate-800">
        <header className="p-5 font-bold">对话合并收藏 · 预览</header>
        <div className="flex-1 p-4 space-y-4">{messages.map(message => <label key={message.id} className="flex gap-3 items-start bg-white rounded-xl p-4">
            <input type="checkbox" checked={selected.has(message.id)} onChange={() => setSelected(previous => { const next = new Set(previous); next.has(message.id) ? next.delete(message.id) : next.add(message.id); return next; })} />
            <span><b className="block text-xs mb-2">{message.role === 'user' ? '我' : 'Sully'}</b>{message.content}</span>
        </label>)}</div>
        <ChatInputArea {...({ input: '', setInput: () => {}, selectionMode: true, showPanel: 'none', setShowPanel: () => {}, onSend: () => {}, isTyping: false,
            emojis: [], selectedCount: selected.size, onDeleteSelected: () => {}, onForwardSelected: () => {}, favoriteSelectedCount: selected.size,
            onFavoriteSelected: async () => { await saveConversationContentFavorite(messages.filter(m => selected.has(m.id)), 'favorite-preview', 'Sully', '我'); setOpen(true); },
        } as any)} />
        {open && <FavoritesPortal onClose={() => setOpen(false)} />}
    </div>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
