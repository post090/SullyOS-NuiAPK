/** Opt-in local maintenance controls; defaults preserve existing automation. */
export function readMaintenanceSettings(): { enabled: boolean; intervalSeconds: number } {
    try {
        const config = JSON.parse(localStorage.getItem('os_memory_palace_config') || '{}');
        return { enabled: config.manualMaintenance === true, intervalSeconds: Math.max(1, Math.min(3600, Number(config.maintenanceIntervalSeconds) || 60)) };
    } catch { return { enabled: false, intervalSeconds: 60 }; }
}
// All palace requests on this page share a start-time queue, including embeddings/retries.
let queue: Promise<void> = Promise.resolve();
let nextStart = 0;
export function waitForPalaceRequest(signal?: AbortSignal): Promise<void> {
    if (!readMaintenanceSettings().enabled) return Promise.resolve();
    const turn = queue.catch(() => undefined).then(async () => {
        if (signal?.aborted) throw new Error('已取消等待');
        const delay = Math.max(0, nextStart - Date.now());
        if (delay) await new Promise<void>((resolve, reject) => {
            const abort = () => { clearTimeout(timer); reject(new Error('已取消等待')); };
            const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, delay);
            signal?.addEventListener('abort', abort, { once: true });
        });
        nextStart = Date.now() + readMaintenanceSettings().intervalSeconds * 1000;
    });
    queue = turn;
    return turn;
}
