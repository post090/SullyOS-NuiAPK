import { describe, it, expect } from 'vitest';
import { ContextBuilder } from './context';

// 锁住「稳定/易变分层」拆分的守恒性:
//   buildCoreContext(deferVolatile) + buildVolatileCoreState ＝ 原 buildCoreContext 的全部信息。
// 三块易变内容（分钟级时间 / 记忆宫殿召回 / 情绪 buff）必须且只能出现在 volatile 侧 ——
// 出现在 stable 侧会打断中转的 prompt 前缀缓存（TTFT 优化失效）；两侧都没有则是信息丢失。

const makeChar = () => ({
    id: 'c1',
    name: '测试角色',
    systemPrompt: '你是测试角色。',
    timeAwarenessEnabled: true,
    // 有实际长期记忆 → 「记忆系统 (Memory Bank)」节才会注入（P1：空记忆整节跳过）；
    // 这节属稳定内容，用来验证 deferVolatile 下它仍留在 core。
    refinedMemories: { '2024-01': '第一次见面的记忆' },
    memoryPalaceEnabled: true,
    memoryPalaceInjection: '### 记忆宫殿召回\n- 【召回片段】上周一起看了流星雨',
    scheduleFeatureEnabled: true,
    emotionConfig: { enabled: true },
    buffInjection: '### [当前情绪底色]\n【测试buff】甜蜜的期待 强度: ●●●○○',
    activeBuffs: [],
} as any);

const user = { name: '测试用户', bio: '' } as any;

describe('buildCoreContext deferVolatile 分层', () => {
    it('默认入口包含时间与召回，但不启用情绪', async () => {
        const core = (await ContextBuilder.buildCoreContext(makeChar(), user, true));
        expect(core).toContain('### 当前时间 (Now)');
        expect(core).toContain('【召回片段】');
        expect(core).not.toContain('【测试buff】');
    });

    it('deferVolatile：三块易变内容从 core 移除', async () => {
        const core = (await ContextBuilder.buildCoreContext(makeChar(), user, true, undefined, undefined, undefined, { deferVolatile: true }));
        expect(core).not.toContain('### 当前时间 (Now)');
        expect(core).not.toContain('【召回片段】');
        expect(core).not.toContain('【测试buff】');
        // 稳定内容仍在
        expect(core).toContain('你是测试角色。');
        expect(core).toContain('### 记忆系统 (Memory Bank)');
    });

    it('buildVolatileCoreState 恰好补齐三块，顺序为 时间→召回→buff', async () => {
        const volatile = (await ContextBuilder.buildVolatileCoreState(makeChar(), { includeDetailedMemories: true, emotion: {surface: 'chat'} }));
        const iTime = volatile.indexOf('### 当前时间 (Now)');
        const iPalace = volatile.indexOf('【召回片段】');
        const iBuff = volatile.indexOf('【测试buff】');
        expect(iTime).toBeGreaterThanOrEqual(0);
        expect(iPalace).toBeGreaterThan(iTime);
        expect(iBuff).toBeGreaterThan(iPalace);
    });

    it('各开关关闭时 volatile 对应块也不输出（与旧版内联判定一致）', async () => {
        const char = makeChar();
        char.timeAwarenessEnabled = false;
        char.memoryPalaceEnabled = false;     // 宫殿总开关关 → 残留 injection 不得注入
        char.emotionConfig = { enabled: false };
        const volatile = (await ContextBuilder.buildVolatileCoreState(char, { includeDetailedMemories: true }));
        expect(volatile).not.toContain('### 当前时间 (Now)');
        expect(volatile).not.toContain('【召回片段】');
        expect(volatile).not.toContain('【测试buff】');
    });

    it('includeDetailedMemories=false 时仍包含已有宫殿召回', async () => {
        const volatile = (await ContextBuilder.buildVolatileCoreState(makeChar(), { includeDetailedMemories: false }));
        expect(volatile).toContain('【召回片段】');
        expect(volatile).toContain('### 当前时间 (Now)');
    });
});


describe('传统详细记忆与向量召回独立', () => {
    it.each([false, true])('详细记忆开关 %s 只控制传统日志', async detailed => {
        const char = {...makeChar(), activeMemoryMonths: ['2026-10'],
            memories: [{date: '2026-10-01', summary: '传统详细标记'}],
            refinedMemories: {'2026-09': '月度标记'}};
        const core = (await ContextBuilder.buildCoreContext(char, user, detailed));
        expect(core.includes('传统详细标记')).toBe(detailed);
        expect(core).toContain('月度标记');
        expect(core.split('【召回片段】')).toHaveLength(2);
    });
    it('外部召回参数不受 false 限制，拆分后只出现一次', async () => {
        const char = {...makeChar(), memoryPalaceInjection: ''};
        const recall = '外部召回标记';
        expect((await ContextBuilder.buildCoreContext(char, user, false, recall))).toContain(recall);
        const stable = (await ContextBuilder.buildCoreContext(char, user, false, recall, undefined, undefined, {deferVolatile: true}));
        const live = (await ContextBuilder.buildVolatileCoreState(char, {includeDetailedMemories: false, memoryPalaceContext: recall}));
        expect(stable).not.toContain(recall);
        expect((stable + live).split(recall)).toHaveLength(2);
    });
    it('没有召回材料不会凭空生成；关闭宫殿不注入旧缓存', async () => {
        expect((await ContextBuilder.buildCoreContext({...makeChar(), memoryPalaceInjection: ''}, user, false))).not.toContain('【召回片段】');
        expect((await ContextBuilder.buildCoreContext({...makeChar(), memoryPalaceEnabled: false}, user, false))).not.toContain('【召回片段】');
    });
});
