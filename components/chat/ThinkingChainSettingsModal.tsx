import React, { useEffect, useState } from 'react';
import type {ThinkingChainStyleId} from '../../utils/psycheAppearance';

interface ThinkingChainSettingsValue {
    enabled: boolean;
    styleId: ThinkingChainStyleId;
    customColors: { bg: string; accent: string; text: string };
    customPrompt: string;
    /** 叠加在任意风格之上的自定义 CSS，选择器限定 .sully-psyche 开头 */
    customCss: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    value: ThinkingChainSettingsValue;
    onChange: (next: Partial<ThinkingChainSettingsValue>) => void;
}

const ThinkingChainSettingsModal: React.FC<Props> = ({ isOpen, onClose, value, onChange }) => {
    const [draftPrompt, setDraftPrompt] = useState(value.customPrompt || '');
    useEffect(() => { if (isOpen) setDraftPrompt(value.customPrompt || ''); }, [isOpen, value.customPrompt]);
    if (!isOpen) return null;

    const commitPrompt = () => onChange({ customPrompt: draftPrompt });

    return (
        <div
            className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[1px]"
            style={{ paddingBottom: 'var(--safe-bottom)' }}
            onClick={onClose}
        >
            <div
                className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl max-h-[85vh] overflow-y-auto no-scrollbar shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="sticky top-0 z-10 bg-white px-5 pt-5 pb-3 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-bold text-slate-800">心象 · 设置</h2>
                            <p className="text-[11px] text-slate-400 mt-0.5">显示与追加提示词；卡片风格在「个性装扮 → 心象」调整</p>
                        </div>
                        <button
                            onClick={() => { commitPrompt(); onClose(); }}
                            className="text-[12px] font-bold text-indigo-500 active:scale-95 transition"
                        >
                            完成
                        </button>
                    </div>
                </div>

                <div className="p-5 space-y-6">
                    {/* 0. 这是什么 / 看不见怎么办 */}
                    <section className="rounded-2xl bg-amber-50/70 border border-amber-200/70 px-3.5 py-3 text-[11px] leading-[1.7] text-slate-600">
                        <div className="font-bold text-amber-700 mb-1 text-[11.5px]">⚠ 先看这里：「心象」到底是什么</div>
                        <p>
                            这是 AI 模型**自己原生输出的思考链**——模型自带的思考过程。
                        </p>
                        <p className="mt-2">
                            正因如此——**它的本质决定了它不会像角色台词那样鲜活**，更像看一个演员在化妆间的喃喃自语，而不是舞台上的台词。这个功能本来就是给"喜欢看大模型思维链"的用户准备的彩蛋，**不一定适合每个人**。
                        </p>
                        <p className="mt-2">
                            还有一点同样由这个本质决定:思维链**不进入上下文**,也**不会成为角色真实回复的一部分**——它只反映当前模型这一轮的思考瞬间。所以**下一轮,角色不会记得自己上一轮在想什么**,ta 只会基于真正发出去的那段回复(以及对话历史)往下走。
                        </p>
                        <p className="mt-2">
                            如果你看到思考链觉得跳戏 / 影响沉浸感 / 觉得太"AI"——直接关掉就好，不会有任何损失，角色回复本身完全不受影响。
                        </p>
                        <p className="mt-2 text-slate-500">看不太懂上面在说啥？去问给你 API 的人，他/她会比这里讲得清楚。</p>
                        <div className="mt-2.5 pt-2.5 border-t border-amber-200/60">
                            <div className="font-bold text-amber-700 mb-1 text-[11.5px]">开了但没看到「心象」卡片？</div>
                            <ul className="list-disc pl-4 space-y-0.5">
                                <li><b>你的模型不带思考链</b> → 请问你 API 提供者哪些模型支持 thinking，或自己查找</li>
                                <li><b>这一轮模型没思考</b>（短回复 / 模型自己判断不需要） → 正常现象，下一轮可能就有</li>
                                <li><b>代理拒绝转发 thinking 字段</b> → 跟 API 提供方确认对应模型是否启用了 extended thinking</li>
                            </ul>
                        </div>
                        <div className="mt-2.5 pt-2.5 border-t border-amber-200/60">
                            <div className="font-bold text-amber-700 mb-1 text-[11.5px]">思考链一直是英文怎么办？</div>
                            <p>
                                这通常**不是模型本身的问题**——同一个模型走官方渠道（Anthropic / OpenAI / 智谱直连等）能正常保持中文，是中转 API 把 system prompt 截短或改写造成的。可以试：
                            </p>
                            <ul className="list-disc pl-4 space-y-0.5 mt-1">
                                <li>下面「追加提示词」里再加一条肘击：「thinking 必须中文，禁止英文」</li>
                                <li>直接在聊天里跟角色说一句「用中文想」</li>
                                <li>换一个跑得动官克的渠道</li>
                            </ul>
                        </div>
                    </section>

                    {/* 1. 总开关 */}
                    <section>
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => onChange({ enabled: !value.enabled })}>
                            <div>
                                <div className="text-[13px] font-bold text-slate-700">显示思考过程</div>
                                <div className="text-[10.5px] text-slate-400 mt-0.5">关闭后角色回复不再带「心象」卡片，已存的旧消息保留。</div>
                            </div>
                            <div className={`shrink-0 ml-3 w-10 h-6 rounded-full p-1 transition-colors flex items-center ${value.enabled ? 'bg-indigo-500' : 'bg-slate-200'}`}>
                                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${value.enabled ? 'translate-x-4' : ''}`} />
                            </div>
                        </div>
                    </section>

                    {/* 3. 追加提示词 */}
                    <section>
                        <h3 className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider mb-2">追加提示词</h3>
                        <p className="text-[10.5px] text-slate-400 mb-2 leading-relaxed">
                            原生提示词（让模型用角色第一人称、中文意识流思考）保持不变；这里写的内容**追加在最后**作为「用户对内心独白的额外要求」。
                        </p>
                        <textarea
                            value={draftPrompt}
                            onChange={e => setDraftPrompt(e.target.value)}
                            onBlur={commitPrompt}
                            placeholder="比如：思考时偶尔切到日语 / 多写一些感官细节 / 想到用户时用昵称…"
                            className="w-full h-28 bg-slate-50 rounded-xl p-3 text-[12px] resize-none border border-slate-200 focus:outline-none focus:border-indigo-300"
                        />
                        <div className="text-[9.5px] text-slate-400 mt-1">留空 = 仅使用原生提示词。</div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default ThinkingChainSettingsModal;
export type { ThinkingChainSettingsValue };
