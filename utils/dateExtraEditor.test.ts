// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import DateSettings from '../components/date/DateSettings';

const state = vi.hoisted(() => ({ update: vi.fn(), back: undefined as undefined | (() => boolean), unregister: vi.fn() }));
const register = (handler: () => boolean) => { state.back = handler; return state.unregister; };
vi.mock('../context/OSContext', () => ({ useOS: () => ({ updateCharacter: state.update, addToast: vi.fn(), userProfile: { name: '用户' }, registerBackHandler: register }) }));
vi.mock('../components/date/MeetingAppearanceControl', () => ({ default: () => null }));
vi.mock('../components/date/ObserveSettings', () => ({ default: () => null }));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

it.each(['完成', '返回'])('expands outside clipping ancestors, follows the keyboard and saves via %s', async (exit) => {
    state.update.mockClear(); state.unregister.mockClear();
    const viewport = Object.assign(new EventTarget(), { scale: 1, offsetTop: 0, height: 800 });
    vi.stubGlobal('visualViewport', viewport);
    const host = document.createElement('div'); host.style.overflow = 'hidden'; document.body.append(host);
    const root = createRoot(host);
    try {
        await act(async () => root.render(React.createElement(DateSettings, { char: { id: 'test', name: '角色', dateStyleConfig: { extra: '旧内容', pov: 'first-you' } } as any, onBack: vi.fn() })));
        const expand = host.querySelector<HTMLButtonElement>('[aria-label="展开自定义补充"]')!;
        await act(async () => { expand.focus(); expand.click(); });
        const dialog = document.querySelector('[role="dialog"][aria-label="编辑自定义补充"]')!;
        expect(host.contains(dialog)).toBe(false);
        const input = dialog.querySelector('textarea')!;
        expect(document.activeElement).toBe(input);
        expect(input.value).toBe('旧内容');
        viewport.height = 340; viewport.offsetTop = 42;
        await act(async () => viewport.dispatchEvent(new Event('resize')));
        expect((dialog.parentElement as HTMLElement).style.height).toBe('340px');
        expect((dialog.parentElement as HTMLElement).style.top).toBe('42px');
        await act(async () => {
            Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, '新的文风补充');
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await act(async () => exit === '完成' ? dialog.querySelector('button')!.click() : state.back!());
        expect(document.querySelector('[aria-label="编辑自定义补充"]')).toBeNull();
        expect(host.querySelector<HTMLTextAreaElement>('[aria-label="自定义补充"]')!.value).toBe('新的文风补充');
        expect(state.update).toHaveBeenLastCalledWith('test', { dateStyleConfig: { extra: '新的文风补充', pov: 'first-you' } });
        expect(state.unregister).toHaveBeenCalled();
    } finally { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); }
});
