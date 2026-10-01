// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { useChatAI } from '../hooks/useChatAI';
import { KeepAlive } from './keepAlive';

vi.mock('../context/MusicContext', () => ({ useMusic: () => ({}), loadMusicHooks: () => null }));
vi.mock('./keepAlive', () => ({ KeepAlive: { start: vi.fn(), stop: vi.fn() } }));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let current: ReturnType<typeof useChatAI>;
const container = document.createElement('div');
let root = createRoot(container);
function Probe({ charId = 'reply-test' }: { charId?: string }) {
    current = useChatAI({
        char: { id: charId, name: '甲' } as any, userProfile: { name: '用户' } as any,
        apiConfig: { baseUrl: 'https://example.test/v1' }, groups: [], emojis: [], categories: [],
        realtimeConfig: {} as any, addToast: vi.fn(), setMessages: vi.fn(), updateCharacter: vi.fn(), updateUserProfile: vi.fn(),
    });
    return null;
}
afterEach(() => { act(() => root.unmount()); vi.restoreAllMocks(); });

describe('useChatAI 请求生命周期', () => {
    it('连点/卸载再进入只保留一轮，初始化失败后释放占位可重试', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        let rejectStart!: (error: Error) => void;
        vi.mocked(KeepAlive.start).mockImplementation(() => new Promise((_, reject) => { rejectStart = reject; }));
        await act(async () => { root.render(createElement(Probe)); });
        const sameRenderTrigger = current!.triggerAI;
        let first!: Promise<void>;
        await act(async () => {
            first = sameRenderTrigger([]);
            await sameRenderTrigger([]);
        });
        expect(KeepAlive.start).toHaveBeenCalledTimes(1);
        expect(current!.isTyping).toBe(true);
        await act(async () => { root.render(createElement(Probe, { charId: 'other' })); });
        expect(current!.isTyping).toBe(true); // 同一实例的流式状态不能同时被两个角色写
        await act(async () => { await current!.triggerAI([]); });
        expect(KeepAlive.start).toHaveBeenCalledTimes(1);
        act(() => root.unmount());
        root = createRoot(container);
        await act(async () => { root.render(createElement(Probe)); });
        expect(current!.isTyping).toBe(true);
        await act(async () => { await current!.triggerAI([]); });
        expect(KeepAlive.start).toHaveBeenCalledTimes(1);
        await act(async () => { rejectStart(new Error('初始化失败')); await first; });
        expect(current!.isTyping).toBe(false);
        vi.mocked(KeepAlive.start).mockRejectedValue(new Error('再次失败'));
        await act(async () => { await current!.triggerAI([]); });
        expect(KeepAlive.start).toHaveBeenCalledTimes(2);
        expect(current!.isTyping).toBe(false);
    });
});
