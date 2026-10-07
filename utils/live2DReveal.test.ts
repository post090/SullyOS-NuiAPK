import { afterEach, expect, it, vi } from 'vitest';
import { revealLive2DAfterPaint } from './live2DReveal';
afterEach(() => vi.unstubAllGlobals());
function frames() {
    let next: FrameRequestCallback | undefined;
    vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { next = fn; return 1; });
    vi.stubGlobal('cancelAnimationFrame', () => { next = undefined; });
    return () => { const fn = next; next = undefined; fn?.(0); };
}
it('keeps loading through the first framed render and reveals after its paint opportunity', () => {
    const frame = frames(), prepare = vi.fn(() => true), reveal = vi.fn();
    revealLive2DAfterPaint(prepare, reveal, vi.fn());
    expect(reveal).not.toHaveBeenCalled();
    frame(); expect(prepare).toHaveBeenCalledTimes(1); expect(reveal).not.toHaveBeenCalled();
    frame(); expect(prepare).toHaveBeenCalledTimes(2); expect(reveal).toHaveBeenCalledOnce();
    frame(); expect(reveal).toHaveBeenCalledOnce();
});
it('waits for a drawable stage and cancels cleanly when switching models', () => {
    const frame = frames(), prepare = vi.fn().mockReturnValueOnce(false).mockReturnValue(true), reveal = vi.fn();
    const cancel = revealLive2DAfterPaint(prepare, reveal, vi.fn());
    frame(); frame(); expect(reveal).not.toHaveBeenCalled();
    cancel(); frame(); expect(reveal).not.toHaveBeenCalled();
});
it('reports render failure without uncovering a partial model', () => {
    const frame = frames(), reveal = vi.fn(), error = vi.fn(), failure = new Error('GPU lost');
    revealLive2DAfterPaint(() => { throw failure; }, reveal, error);
    frame(); frame(); expect(reveal).not.toHaveBeenCalled(); expect(error).toHaveBeenCalledOnce(); expect(error).toHaveBeenCalledWith(failure);
});

