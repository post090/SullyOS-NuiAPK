// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./runtime/nativeScheduler', () => ({
    scheduleNativeTimer: vi.fn(async () => {}),
    cancelNativeTimer: vi.fn(async () => {}),
}));

import { useChatAutoReply } from '../hooks/useChatAutoReply';
import {
    AUTO_REPLY_FIRE_EVENT,
    cancelBackgroundAutoReply,
    fireBackgroundAutoReply,
    hasBackgroundAutoReply,
    resumeBackgroundAutoReplies,
    scheduleBackgroundAutoReply,
} from './backgroundAutoReply';
import { normalizeAutoReplySeconds } from './chatInputPreferences';
import { resolveScheduleHue } from './scheduleAppearance';

describe('background auto reply store', () => {
    let fired: string[];
    const onFire = (e: Event) => fired.push((e as CustomEvent).detail.charId);
    beforeEach(() => {
        vi.useFakeTimers();
        localStorage.clear();
        fired = [];
        window.addEventListener(AUTO_REPLY_FIRE_EVENT, onFire);
    });
    afterEach(() => {
        window.removeEventListener(AUTO_REPLY_FIRE_EVENT, onFire);
        vi.useRealTimers();
    });

    it('fires once after the delay and clears itself', () => {
        scheduleBackgroundAutoReply('a', 5000);
        expect(hasBackgroundAutoReply('a')).toBe(true);
        vi.advanceTimersByTime(4999);
        expect(fired).toEqual([]);
        vi.advanceTimersByTime(1);
        expect(fired).toEqual(['a']);
        expect(hasBackgroundAutoReply('a')).toBe(false);
        fireBackgroundAutoReply('a');
        expect(fired).toEqual(['a']);
    });

    it('cancel prevents firing; early native wake re-arms instead of firing', () => {
        scheduleBackgroundAutoReply('a', 10_000);
        cancelBackgroundAutoReply('a');
        vi.advanceTimersByTime(20_000);
        expect(fired).toEqual([]);
        scheduleBackgroundAutoReply('b', 10_000);
        fireBackgroundAutoReply('b');
        expect(fired).toEqual([]);
        vi.advanceTimersByTime(10_000);
        expect(fired).toEqual(['b']);
    });

    it('resumes persisted entries and drops stale ones', () => {
        const now = Date.now();
        localStorage.setItem('sully-auto-reply-pending-v1', JSON.stringify({ fresh: now + 3000, stale: now - 7 * 3600_000, bad: 'x' }));
        resumeBackgroundAutoReplies();
        expect(hasBackgroundAutoReply('stale')).toBe(false);
        vi.advanceTimersByTime(3000);
        expect(fired).toEqual(['fresh']);
    });
});

describe('auto reply seconds and schedule hue', () => {
    it('normalizes seconds into 1–600, defaulting to 2', () => {
        expect(normalizeAutoReplySeconds(undefined)).toBe(2);
        expect(normalizeAutoReplySeconds('abc')).toBe(2);
        expect(normalizeAutoReplySeconds(0)).toBe(1);
        expect(normalizeAutoReplySeconds('15')).toBe(15);
        expect(normalizeAutoReplySeconds(9999)).toBe(600);
    });
    it('prefers the character manual color, then themeColor, then the global hue', () => {
        expect(resolveScheduleHue({ companionThemeColor: '#ff0000' }, 200)).toBe(0);
        expect(resolveScheduleHue({ companionThemeColor: '#00ff00', themeColor: 30 }, 200)).toBe(120);
        expect(resolveScheduleHue({ themeColor: 400 }, 200)).toBe(40);
        expect(resolveScheduleHue({ companionThemeColor: '#808080' }, 200)).toBe(200);
        expect(resolveScheduleHue(null, 200)).toBe(200);
    });
});

describe('useChatAutoReply handoff', () => {
    let root: Root;
    let container: HTMLDivElement;
    let options: Parameters<typeof useChatAutoReply>[0];
    let controls: ReturnType<typeof useChatAutoReply>;
    function Harness() {
        controls = useChatAutoReply(options);
        return null;
    }
    const render = (patch: Partial<typeof options> = {}) => {
        options = { ...options, ...patch };
        act(() => root.render(React.createElement(Harness)));
    };
    beforeEach(() => {
        vi.useFakeTimers();
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
        container = document.createElement('div');
        document.body.append(container);
        root = createRoot(container);
        options = {
            enabled: true, conversationId: 'a', active: true, blocked: false, generating: false,
            onGenerate: vi.fn(), onHandoff: vi.fn(), delayMs: 10_000,
        };
        render();
    });
    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });
    const send = () => act(() => controls.beginSend(options.conversationId)(true));

    it('uses the configured delay', () => {
        send();
        expect(controls.seconds).toBe(10);
        act(() => vi.advanceTimersByTime(9999));
        expect(options.onGenerate).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(1));
        expect(options.onGenerate).toHaveBeenCalledTimes(1);
    });

    it('hands off when leaving the chat, but not when turning the switch off or with nothing pending', () => {
        render({ active: false });
        expect(options.onHandoff).not.toHaveBeenCalled();
        render({ active: true });
        send();
        render({ active: false });
        expect(options.onHandoff).toHaveBeenCalledWith('a');
        render({ active: true, onHandoff: vi.fn() });
        send();
        render({ enabled: false });
        expect(options.onHandoff).not.toHaveBeenCalled();
    });

    it('hands off and drops its own countdown when the page goes to background', () => {
        send();
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
        act(() => document.dispatchEvent(new Event('visibilitychange')));
        expect(options.onHandoff).toHaveBeenCalledWith('a');
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
        act(() => document.dispatchEvent(new Event('visibilitychange')));
        act(() => vi.advanceTimersByTime(20_000));
        expect(options.onGenerate).not.toHaveBeenCalled();
        act(() => controls.resume());
        act(() => vi.advanceTimersByTime(10_000));
        expect(options.onGenerate).toHaveBeenCalledTimes(1);
    });

    it('holds the handoff while a draft is in the input', () => {
        send();
        render({ holdHandoff: true });
        render({ conversationId: 'b' });
        expect(options.onHandoff).not.toHaveBeenCalled();
    });
});