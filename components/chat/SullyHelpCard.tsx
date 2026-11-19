import React from 'react';
import { SULLY_HELP_DESK_AVATAR } from '../../utils/sullyIdentity';

export function SullyHelpCard({ onOpen }: { onOpen?: () => void }) {
    return (
        <button type="button" className="sully-chat-card-face flex items-center gap-3 rounded-2xl bg-white p-3 text-left text-slate-800 shadow-sm"
            onClick={onOpen} disabled={!onOpen}>
            <img src={SULLY_HELP_DESK_AVATAR} alt="" className="h-10 w-10 rounded-xl" />
            <span><strong className="block text-sm">找 Sully-11 答疑</strong>
                <span className="text-xs text-slate-500">打开使用帮助 →</span></span>
        </button>
    );
}
