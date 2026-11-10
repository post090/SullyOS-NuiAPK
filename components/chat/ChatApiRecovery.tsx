import React, { useState } from 'react';
import { useOS } from '../../context/OSContext';
import type { CharacterProfile } from '../../types';
import type { ChatApiFailure } from '../../utils/dialogueApiStatus';
import { describeDialogueApi } from '../../utils/characterApi';
import { llmApiType } from '../../utils/llmEndpoint';
import { syncAmsgLlmCredentials } from '../../utils/amsgStateSync';
import DialogueApiEditorModal from '../settings/DialogueApiEditorModal';

export default function ChatApiRecovery({ failure, character, busy, onRetry }: {
    failure: ChatApiFailure;
    character: CharacterProfile;
    busy: boolean;
    onRetry: () => void | Promise<void>;
}) {
    const { apiConfig, updateApiConfig, updateCharacter, addToast } = useOS();
    const [editing, setEditing] = useState(false);
    const roleApi = failure.scope !== 'override' && !!character.dialogueApi;
    const api = roleApi ? character.dialogueApi || apiConfig : apiConfig;
    const source = roleApi ? `${character.name}的独立 API` : failure.scope === 'override' ? '本轮指定的 API' : '全局 API';
    return <section aria-label="回复失败处理" className="mx-3 my-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-slate-700">
        <p role="alert" className="font-semibold">{failure.message}</p>
        <p className="mt-1 text-slate-500 break-words">当前使用{source}{failure.scope !== 'override' && ` · ${describeDialogueApi(api)}`}</p>
        {!failure.canRetry && <p className="mt-1 text-slate-500">本轮已经收到部分回复或执行了工具，请先查看已有结果，再决定是否重新生成。</p>}
        <div className="mt-2 flex flex-wrap gap-2">
            {failure.scope !== 'override' && <button type="button" disabled={busy} onClick={() => setEditing(true)} className="rounded-xl bg-white border border-amber-200 px-3 py-2 font-semibold disabled:opacity-40">修正 API</button>}
            {failure.canRetry && <button type="button" disabled={busy} onClick={() => { void onRetry(); }} className="rounded-xl bg-primary px-3 py-2 font-semibold text-white disabled:opacity-40">重试回复</button>}
        </div>
        {editing && <DialogueApiEditorModal value={api} title={`修正${source}`}
            description={roleApi ? `保存后用于${character.name}的回复。` : '保存到全局 API，跟随全局配置的角色都会使用这份配置。'}
            onClose={() => setEditing(false)} onSave={async next => {
                if (roleApi) await updateCharacter(character.id, { dialogueApi: next });
                else {
                    updateApiConfig({ ...next, apiType: llmApiType(next) });
                    syncAmsgLlmCredentials({ ...apiConfig, ...next, apiType: llmApiType(next) });
                }
                addToast('API 配置已保存，可以重试回复', 'success');
            }} />}
    </section>;
}
