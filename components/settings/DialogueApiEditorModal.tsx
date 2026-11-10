import React, { useEffect, useRef, useState } from 'react';
import type { DialogueApiConfig } from '../../types';
import { useOS } from '../../context/OSContext';
import { pickDialogueApi } from '../../utils/characterApi';
import { configFromPreset, findActivePresetId } from '../../utils/apiPresetSwitch';
import { extractModelIds } from '../../utils/modelList';
import { fetchLlm } from '../../utils/anthropicApi';
import { nativeFetch } from '../../utils/nativeFetch';
import { describeDialogueApiFailure } from '../../utils/dialogueApiStatus';
import Modal from '../os/Modal';
import DialogueApiFields from './DialogueApiFields';
import DialogueApiStatus from './DialogueApiStatus';
import ModelPicker from './ModelPicker';
import ApiPresetGroups from './ApiPresetGroups';

export default function DialogueApiEditorModal({ value, title, description, onSave, onClose }: {
    value: DialogueApiConfig;
    title: string;
    description?: string;
    onSave: (api: DialogueApiConfig) => void | Promise<void>;
    onClose: () => void;
}) {
    const { apiPresets, availableModels, apiConfig } = useOS();
    const [draft, setDraft] = useState(() => pickDialogueApi(value));
    const [models, setModels] = useState(() => value.baseUrl === apiConfig.baseUrl && value.apiKey === apiConfig.apiKey ? availableModels : []);
    const [picker, setPicker] = useState(false);
    const [pickerModel, setPickerModel] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState('');
    const requestVersion = useRef(0);
    useEffect(() => () => { requestVersion.current += 1; }, []);
    const changeDraft = (patch: Partial<DialogueApiConfig>) => {
        requestVersion.current += 1;
        setLoading(false); setStatus('');
        if (patch.baseUrl !== undefined || patch.apiKey !== undefined || patch.apiType !== undefined) setModels([]);
        setDraft(previous => ({ ...previous, ...patch }));
    };
    const fetchModels = async () => {
        const api = pickDialogueApi(draft);
        if (!api.baseUrl) { setStatus('请先填写 API URL'); return; }
        const version = ++requestVersion.current;
        setLoading(true); setStatus('');
        try {
            const response = await fetchLlm(`${api.baseUrl}/models`, { headers: { Authorization: `Bearer ${api.apiKey || 'sk-none'}` } }, nativeFetch);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const next = extractModelIds(await response.json());
            if (version !== requestVersion.current) return;
            setModels(next);
            setStatus(next.length ? `获取到 ${next.length} 个模型` : '模型列表为空，可手动输入');
            setPickerModel(api.model || next[0] || ''); setPicker(true);
        } catch (error) {
            if (version === requestVersion.current) setStatus(`获取失败，${describeDialogueApiFailure(error)}`);
        } finally { if (version === requestVersion.current) setLoading(false); }
    };
    const save = async () => {
        const api = pickDialogueApi(draft);
        if (!api.baseUrl || !api.model) { setStatus('请填写 API URL 和模型'); return; }
        try {
            const url = new URL(api.baseUrl);
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error();
        } catch { setStatus('请填写有效的 HTTP / HTTPS API URL'); return; }
        setSaving(true);
        try { await onSave(api); onClose(); }
        catch { setStatus('配置保存失败，请重试'); setSaving(false); }
    };
    const activePreset = findActivePresetId(apiPresets, draft);
    return <>
        <Modal isOpen={!picker} title={title} onClose={onClose} footer={<>
            <button type="button" disabled={saving} onClick={onClose} className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-2xl">取消</button>
            <button type="button" disabled={saving} onClick={save} className="flex-1 py-3 bg-primary text-white font-bold rounded-2xl">{saving ? '保存中…' : '确定'}</button>
        </>}>
            <div className="space-y-4">
                {description && <p className="text-xs text-slate-500 leading-relaxed">{description}</p>}
                {apiPresets.length > 0 && <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-slate-400 tracking-widest">API 预设</h4>
                    <ApiPresetGroups presets={apiPresets}>{preset => <button key={preset.id} type="button"
                        onClick={() => changeDraft(configFromPreset(preset))}
                        className={`rounded-lg px-3 py-2 text-xs border ${activePreset === preset.id ? 'bg-primary/5 border-primary/30 text-primary' : 'bg-white border-slate-200 text-slate-600'}`}>
                        {preset.name}{activePreset === preset.id ? ' · 已选' : ''}
                    </button>}</ApiPresetGroups>
                    <p className="text-[10px] text-slate-400">选预设后，点确定保存到当前配置。</p>
                </div>}
                <DialogueApiFields value={draft} onChange={changeDraft} fetchModels={fetchModels} isLoadingModels={loading}
                    openModelPicker={() => { setPickerModel(draft.model); setPicker(true); }} />
                <DialogueApiStatus value={draft} saved={value} allowTest />
                {status && <p role="status" className="text-xs text-slate-500 break-words">{status}</p>}
            </div>
        </Modal>
        <Modal isOpen={picker} title="选择模型" onClose={() => setPicker(false)}>
            <ModelPicker availableModels={models} localModel={pickerModel} setLocalModel={setPickerModel}
                confirmModelPicker={model => { changeDraft({ model }); setPicker(false); }} />
        </Modal>
    </>;
}
