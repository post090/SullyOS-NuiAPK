import React from 'react';
import { useOS } from '../context/OSContext';
import { hasGuideApi, setGuideStep, setVectorGuideSkipped, useFirstUseGuideStep } from '../utils/firstUseGuide';

export function MainApiMemoryChoice() {
    const step = useFirstUseGuideStep();
    const { apiConfig, updateMemoryPalaceConfig } = useOS();
    if (step !== 1) return null;
    return <div className="mb-3 rounded-xl bg-white/80 p-3 text-xs leading-relaxed text-emerald-800">
        <button data-guide="use-main-api" type="button" disabled={!hasGuideApi(apiConfig)} className="font-bold underline disabled:opacity-40" onClick={() => updateMemoryPalaceConfig({
            lightLLM: { baseUrl: apiConfig.baseUrl, apiKey: apiConfig.apiKey, model: apiConfig.model },
        })}>我想暂时只用主 API</button>
        <p className="mt-1">将刚才保存的主 API 配置复制给副 API，用它整理记忆。无需另买服务；后续整理会消耗主 API 额度，也可以随时换成便宜的聊天模型。</p>
    </div>;
}

export function SkipVectorMemoryChoice() {
    const step = useFirstUseGuideStep();
    const { memoryPalaceConfig } = useOS();
    if (step !== 1) return null;
    return <div className="mt-3 border-t border-violet-200 pt-3 text-xs leading-relaxed text-slate-600">
        <button type="button" disabled={!hasGuideApi(memoryPalaceConfig.lightLLM)} className="font-bold text-violet-700 underline disabled:opacity-40" onClick={() => {
            setVectorGuideSkipped(true);
            setGuideStep(3);
        }}>暂时跳过向量记忆</button>
        <p className="mt-1">先完成上方副 API 的选择即可跳过。跳过后继续学习聊天，不开启向量记忆和全自动记忆；之后可在「记忆宫殿」补配。</p>
    </div>;
}
