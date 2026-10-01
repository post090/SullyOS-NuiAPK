// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatAutoReply } from '../hooks/useChatAutoReply';

let root: Root;
let container: HTMLDivElement;
let options: Parameters<typeof useChatAutoReply>[0];
let controls: ReturnType<typeof useChatAutoReply>;
function Harness() {
    controls = useChatAutoReply(options);
    return React.createElement('span', null, controls.seconds);
}
const render = (patch: Partial<typeof options> = {}) => {
    options = { ...options, ...patch };
    act(() => root.render(React.createElement(Harness)));
};
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const send = (success = true) => act(() => controls.beginSend(options.conversationId)(success));

beforeEach(() => {
    vi.useFakeTimers();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    options = { enabled: true, conversationId: 'a', active: true, blocked: false, generating: false, onGenerate: vi.fn() };
    render();
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('two-second automatic reply', () => {
    it('only generates after a successful new send and exactly two ready seconds', () => {
        advance(5000);
        expect(options.onGenerate).not.toHaveBeenCalled();
        send(false);
        advance(5000);
        expect(options.onGenerate).not.toHaveBeenCalled();
        send();
        expect(controls.seconds).toBe(2);
        advance(1000);
        expect(controls.seconds).toBe(1);
        advance(999);
        expect(options.onGenerate).not.toHaveBeenCalled();
        advance(1);
        expect(options.onGenerate).toHaveBeenCalledTimes(1);
        advance(5000);
        expect(options.onGenerate).toHaveBeenCalledTimes(1);
    });

    it('waits through editing, drafts and any open panel, then starts a fresh two seconds', () => {
        render({ blocked: true });
        send();
        advance(5000);
        expect(controls.seconds).toBeNull();
        render({ blocked: false });
        advance(1500);
        render({ blocked: true });
        advance(5000);
        render({ blocked: false });
        advance(1999);
        expect(options.onGenerate).not.toHaveBeenCalled();
        advance(1);
        expect(options.onGenerate).toHaveBeenCalledTimes(1);
    });

    it('waits for every overlapping text, image or emoji save and resets on the latest completion', () => {
        send();
        advance(1500);
        let finishImage!: (sent: boolean) => void;
        let finishEmoji!: (sent: boolean) => void;
        act(() => { finishImage = controls.beginSend('a'); finishEmoji = controls.beginSend('a'); });
        advance(5000);
        act(() => finishEmoji(true));
        advance(5000);
        expect(options.onGenerate).not.toHaveBeenCalled();
        act(() => finishImage(true));
        advance(1999);
        expect(options.onGenerate).not.toHaveBeenCalled();
        advance(1);
        expect(options.onGenerate).toHaveBeenCalledTimes(1);
    });

    it('cancel stays cancelled through a late save and input changes, but a new send can re-arm', () => {
        send();
        let finish!: (sent: boolean) => void;
        act(() => { finish = controls.beginSend('a'); controls.cancel(); });
        act(() => finish(true));
        render({ blocked: true });
        render({ blocked: false });
        advance(5000);
        expect(options.onGenerate).not.toHaveBeenCalled();
        send();
        advance(2000);
        expect(options.onGenerate).toHaveBeenCalledTimes(1);
    });

    it.each([{ conversationId: 'b' }, { active: false }, { enabled: false }])('discards pending work and late completions after %o', patch => {
        send();
        let finish!: (sent: boolean) => void;
        act(() => { finish = controls.beginSend('a'); });
        render(patch);
        act(() => finish(true));
        render({ conversationId: 'a', active: true, enabled: true });
        advance(5000);
        expect(options.onGenerate).not.toHaveBeenCalled();
    });

    it('ignores a send callback captured by a different character', () => {
        render({ conversationId: 'b' });
        act(() => controls.beginSend('a')(true));
        advance(5000);
        expect(options.onGenerate).not.toHaveBeenCalled();
    });

    it('manual or external generation consumes the wait; fresh sends during generation can queue', () => {
        send();
        advance(1000);
        render({ generating: true });
        render({ generating: false });
        advance(5000);
        expect(options.onGenerate).not.toHaveBeenCalled();
        render({ generating: true });
        send();
        advance(5000);
        render({ generating: false });
        advance(2000);
        expect(options.onGenerate).toHaveBeenCalledTimes(1);
    });

    it('does not generate while the page is hidden and restarts the delay on return', () => {
        send();
        advance(1000);
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
        act(() => document.dispatchEvent(new Event('visibilitychange')));
        advance(5000);
        expect(options.onGenerate).not.toHaveBeenCalled();
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
        act(() => document.dispatchEvent(new Event('visibilitychange')));
        advance(1999);
        expect(options.onGenerate).not.toHaveBeenCalled();
        advance(1);
        expect(options.onGenerate).toHaveBeenCalledTimes(1);
    });
});
