// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ extract: vi.fn(), boxes: vi.fn(), compress: vi.fn(), plates: vi.fn() }));
vi.mock('./memoryPalace/autoArchive', () => ({ processNewMessagesWithAutoArchive: mocks.extract }));
vi.mock('./memoryPalace/db', () => ({ EventBoxDB: { getByCharId: mocks.boxes } }));
vi.mock('./memoryPalace/eventBoxCompression', () => ({ maybeCompressEventBoxes: mocks.compress }));
vi.mock('./memoryPalace/roomPlates', () => ({ consolidateAllPlates: mocks.plates }));
import MemoryMaintenancePanel from '../components/chat/MemoryMaintenancePanel';
const config: any = { manualMaintenance: true, embedding: { baseUrl: 'emb', apiKey: 'key' }, lightLLM: { baseUrl: 'llm', apiKey: 'key', model: 'test' } };
const char: any = { id: 'manual-test', name: '测试角色', memoryPalaceEnabled: true };
let host: HTMLDivElement, root: Root;
async function click(label: string) {
    const button = [...host.querySelectorAll('button')].find(b => b.textContent === label);
    expect(button).toBeTruthy(); await act(async () => { button!.click(); });
}
beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear(); vi.clearAllMocks();
    mocks.extract.mockResolvedValue({ stored: 1, batches: [] });
    mocks.boxes.mockResolvedValue([]); mocks.compress.mockResolvedValue({ compressed: 1 }); mocks.plates.mockResolvedValue({ updated: ['study'] });
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    await act(async () => root.render(React.createElement(MemoryMaintenancePanel, { config, update: vi.fn(), char, userName: '用户' })));
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
describe('manual maintenance dialog', () => {
    it('stops after each phase and keeps the next phase on reopening', async () => {
        await click('开始 / 继续维护'); await click('下一步');
        expect(mocks.extract).toHaveBeenCalledTimes(1); expect(mocks.compress).not.toHaveBeenCalled(); expect(mocks.plates).not.toHaveBeenCalled();
        expect(localStorage.getItem('mp_manualStep_manual-test')).toBe('1');
        await click('稍后继续'); await click('开始 / 继续维护'); await click('下一步');
        expect(mocks.plates).not.toHaveBeenCalled();
        await click('下一步'); expect(mocks.plates).toHaveBeenCalledTimes(1);
        expect(host.textContent).toContain('本轮完成');
    });
    it('failed extraction stays on its step and does not run later phases', async () => {
        mocks.extract.mockResolvedValue(null);
        await click('开始 / 继续维护'); await click('下一步');
        expect(host.textContent).toContain('提取未完成');
        expect(localStorage.getItem('mp_manualStep_manual-test')).toBeNull();
        expect(mocks.boxes).not.toHaveBeenCalled(); expect(mocks.plates).not.toHaveBeenCalled();
    });
    it('compresses one box only and defers plate requests', async () => {
        localStorage.setItem('mp_manualStep_manual-test', '1');
        mocks.boxes.mockResolvedValue([{ id: 'box-1', liveMemoryIds: ['a','b','c','d'] }, { id: 'box-2', liveMemoryIds: ['e','f','g','h'] }]);
        await click('开始 / 继续维护'); await click('下一步');
        expect(mocks.compress.mock.calls[0][0]).toEqual(['box-1']);
        expect(mocks.compress.mock.calls[0][1].deferPlateMaintenance).toBe(true);
        expect(mocks.plates).not.toHaveBeenCalled(); expect(host.textContent).toContain('继续压缩');
    });
});
