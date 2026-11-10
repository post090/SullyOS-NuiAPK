import React, { useEffect, useRef, useState } from 'react';
import type { DialogueApiConfig } from '../../types';
import { describeDialogueApiFailure, dialogueApiIdentity, markDialogueApiVerified, testDialogueApi, useDialogueApiVerified } from '../../utils/dialogueApiStatus';

export default function DialogueApiStatus({ value, saved, allowTest = false }: { value: DialogueApiConfig; saved: DialogueApiConfig; allowTest?: boolean }) {
    const verified = useDialogueApiVerified(value);
    const identity = dialogueApiIdentity(value);
    const isSaved = identity === dialogueApiIdentity(saved)
        && (value.temperature ?? 0.85) === (saved.temperature ?? 0.85)
        && (value.maxTokens ?? 8000) === (saved.maxTokens ?? 8000);
    const [testing, setTesting] = useState(false);
    const [result, setResult] = useState<{ identity: string; text: string } | null>(null);
    const abort = useRef<AbortController>();
    useEffect(() => {
        setTesting(false);
        return () => { abort.current?.abort(); };
    }, [identity]);
    const test = async () => {
        abort.current?.abort();
        const controller = new AbortController();
        abort.current = controller;
        setTesting(true); setResult(null);
        try {
            await testDialogueApi(value, controller.signal);
            if (controller.signal.aborted) return;
            markDialogueApiVerified(value);
            setResult({ identity, text: '连接成功，已验证当前配置' });
        } catch (error) {
            if (!controller.signal.aborted) setResult({ identity, text: `连接失败，${describeDialogueApiFailure(error)}` });
        } finally { if (!controller.signal.aborted) setTesting(false); }
    };
    return <div className="space-y-2">
        <p role="status" className="text-xs leading-relaxed text-slate-500">
            {!value.baseUrl || !value.model ? '尚未配置完整' : isSaved ? '已保存' : '有修改待保存'} · {verified ? '本次打开已验证' : '尚未验证'}
            {allowTest && <span className="block mt-1 text-[10px] text-slate-400">测试连接会发送一条简短请求，可能按服务商规则计费。聊天成功也会验证当前配置。</span>}
        </p>
        {allowTest && <button type="button" onClick={test} disabled={testing || !value.baseUrl.trim() || !value.model.trim()}
            className="w-full py-2.5 rounded-xl border border-primary/30 text-primary text-xs font-bold disabled:opacity-40">
            {testing ? '测试中…' : '测试连接'}
        </button>}
        {result?.identity === identity && <p role="status" className="text-xs text-slate-500 break-words">{result.text}</p>}
    </div>;
}
