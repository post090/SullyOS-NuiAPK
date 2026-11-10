import React, { useState } from 'react';
import type { CharacterProfile, DialogueApiConfig } from '../../types';
import { useOS } from '../../context/OSContext';
import { describeDialogueApi } from '../../utils/characterApi';
import DialogueApiEditorModal from '../settings/DialogueApiEditorModal';
import DialogueApiStatus from '../settings/DialogueApiStatus';

export default function CharacterApiPanel({ character, onChange }: {
    character: CharacterProfile;
    onChange: (api: DialogueApiConfig | undefined) => void;
}) {
    const { apiConfig } = useOS();
    const [editing, setEditing] = useState(false);
    const api = character.dialogueApi || apiConfig;
    return <section className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 space-y-3">
        <h3 className="text-xs font-bold text-slate-700">独立 API</h3>
        <p className="text-xs text-slate-600 break-words" data-testid="character-api-status">
            {character.dialogueApi ? '目前使用的为：' : '目前跟随设置中的 API：'}
            {describeDialogueApi(api)}
        </p>
        <p className="text-[11px] text-slate-400 leading-relaxed">用于私聊、见面、电话、群聊逐人回复、彼方角色活动和主动消息。App 独立 API 优先；TRPG 等统一生成和记忆、情绪、识图、语音合成仍用原配置。</p>
        <DialogueApiStatus value={api} saved={api} />
        <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setEditing(true)} className="px-3 py-2 text-xs font-bold rounded-xl bg-primary/10 text-primary active:scale-95 transition-transform">
                {character.dialogueApi ? '修改独立 API' : '为角色使用独立 API'}
            </button>
            {character.dialogueApi && <button type="button" onClick={() => onChange(undefined)} className="px-3 py-2 text-xs text-slate-500 rounded-xl bg-slate-100">跟随设置中的 API</button>}
        </div>
        {editing && <DialogueApiEditorModal value={api} title="角色独立 API" onSave={onChange} onClose={() => setEditing(false)} />}
    </section>;
}
