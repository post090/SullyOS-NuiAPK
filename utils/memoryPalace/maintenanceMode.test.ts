import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readMaintenanceSettings, waitForPalaceRequest } from './maintenanceMode';
describe('manual maintenance request pacing', () => {
    beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-29T00:00:00Z')); });
    afterEach(() => vi.useRealTimers());
    it('defaults off and leaves requests immediate', async () => {
        expect(readMaintenanceSettings().enabled).toBe(false);
        await waitForPalaceRequest(); expect(vi.getTimerCount()).toBe(0);
    });
    it('spaces simultaneous requests across tasks and cancels a waiting request', async () => {
        localStorage.setItem('os_memory_palace_config', JSON.stringify({ manualMaintenance: true, maintenanceIntervalSeconds: 60 }));
        const started: number[] = [];
        const first = waitForPalaceRequest().then(() => started.push(Date.now()));
        const second = waitForPalaceRequest().then(() => started.push(Date.now()));
        await vi.advanceTimersByTimeAsync(0); expect(started).toHaveLength(1);
        await vi.advanceTimersByTimeAsync(59999); expect(started).toHaveLength(1);
        await vi.advanceTimersByTimeAsync(1); await Promise.all([first, second]);
        expect(started[1] - started[0]).toBe(60000);
        const controller = new AbortController();
        const waiting = waitForPalaceRequest(controller.signal);
        const check = expect(waiting).rejects.toThrow('取消');
        await vi.advanceTimersByTimeAsync(0); controller.abort(); await check;
        expect(vi.getTimerCount()).toBe(0);
    });
});

it('manual mode prevents automatic extraction and digestion before any DB or API work', async () => {
    localStorage.setItem('os_memory_palace_config', JSON.stringify({ manualMaintenance: true }));
    const { processNewMessages } = await import('./pipeline');
    const { runCognitiveDigestion } = await import('./digestion');
    expect(await processNewMessages([], 'guard-test', '角色', {} as any, {} as any)).toMatchObject({ skipReason: 'manual', stored: 0 });
    expect(await runCognitiveDigestion('guard-test', '角色', '', {} as any)).toBeNull();
    localStorage.clear();
});
