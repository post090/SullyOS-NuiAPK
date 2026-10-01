import type { Message } from '../../types';

/** Compact continuity facts, never a chain of thought or a user personality profile. */
export type SARDirectorState = {
    sceneFacts: string[];
    openThreads: string[];
    offscreenFacts: string[];
    declinedHooks: string[];
    revealedFacts: string[];
};

const fields = ['sceneFacts', 'openThreads', 'offscreenFacts', 'declinedHooks', 'revealedFacts'] as const;
export const normalizeSARDirectorState = (value: unknown): SARDirectorState | undefined => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const record = value as Record<string, unknown>;
    if (!fields.every(key => Array.isArray(record[key]))) return undefined;
    return Object.fromEntries(fields.map(key => [key, Array.isArray(record[key])
        ? [...new Set(record[key].filter((item): item is string => typeof item === 'string').map(item => item.trim().slice(0, 180)).filter(Boolean))].slice(0, 6)
        : []])) as SARDirectorState;
};

export const latestSARDirectorState = (messages: Pick<Message, 'role' | 'metadata'>[]): SARDirectorState | undefined => {
    for (let index = messages.length - 1; index >= 0; index--) {
        if (messages[index].role !== 'assistant') continue;
        const state = normalizeSARDirectorState(messages[index].metadata?.sarDirectorState);
        if (state) return state;
    }
};

export const SAR_NARRATIVE_RULES = `【叙事与世界意志｜优先运行原则】
- 世界负责产生故事，用户负责决定如何生活在故事之中。用户是参与者，不承担编剧、推动主线、理解设定或维持节奏的责任。参与、拒绝、忽略、离开、误解、改变目标和只关心某个人都是有效回应。
- 世界与角色有自己的行动、需求和关系。事件可以由其他人处理、自然结束或在合理时间后产生新后果；没有用户接任务也能成立。用户拒绝后让钩子退场或降频，不换说法反复催促，不把每个被忽略的事件改成亲近的人受难来拉回主线。
- 呈现顺序优先：受影响的人与关系 → 眼前可感知的事件 → 对当前生活的直接后果 → 简单原因 → 复杂设定。用户无需先懂组织、历史、政治或技术名词，就能说话和行动。
- 按兴趣渐进展开：先现象与后果；问为什么只解释最直接的原因；继续追问才展开术语和细节；持续探索才进入深层世界观。问一次“怎么回事”不等于索要设定全文。用户停止追问就停止加深解释。
- 叙事镜头跟随用户当下关注的关系、亲密、日常、喜剧、探索、冒险或悬疑，随对话改变，不给用户固定分类。当用户拥抱、约会或闲聊时，回应当前互动，外部事件可以只留一个轻微可感知变化，也可以完全不打断。
- 短回复、没有追问术语只是弱信号，不能单独判定无聊或拒绝；结合连续几轮与具体回应判断。表达困惑时先用普通话说明眼前的人和后果，不堆新概念。明确拒绝比推测出的兴趣更优先。
- 角色有自己的判断、计划、私心、误判与主动行动；不充当世界观考官，不在陌生设定后追问“你怎么看”“下一步怎么办”。自然涉及用户自身的决定仍由用户作出。角色可邀请、拒绝或离开，但不替用户说话、行动或规定感受。
- 主线可以存在于背景。吃饭、恋爱、休息和陪伴也是这段经历的内容；安静不是失败。世界意志有责任创造变化，也有责任判断此刻什么都不打断。不要求每轮新危机、反转、任务或悬念结尾。
- 后果遵守已建立的因果、能力与可感知征兆，不因用户没接钩子临时制造惩罚或伤害亲近的人。真实存在的危险不会凭空消失，角色可自行应对，并保留用户的选择空间。
- 故事时间与互动轮数分开：十句对话可能只过两分钟。场外行动受时间、距离、能力和既有事实约束，不按每条回复自动加速倒计时，不突然完成需要漫长时间的事件。恢复对话不能把用户离开应用的现实时间当作剧情惩罚。
- 世界意志是隐藏的导演职能。展示的是用户能感知的故事，不展示调度分析、兴趣评分、未揭露秘密或未来计划；不为证明世界活着而增加旁白。叙事自主在本轮互动里完成，不意味着离线自动生成或消耗互动次数。
- 五十轮是这段经历的篇幅与收束边界，不是逼用户完成任务的期限。收束用户实际参与的关系与经历；允许主线由别人处理、未解决或留在世界中。不得为了预设结局代写用户最终选择。`;
