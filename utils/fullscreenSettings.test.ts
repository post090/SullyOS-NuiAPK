// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import FullscreenSettings from '../components/appearance/FullscreenSettings';

let host: HTMLDivElement, root: Root;
const setFullscreen = (element: Element | null) => {
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: element });
    document.dispatchEvent(new Event('fullscreenchange'));
};
beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: true });
    setFullscreen(null);
    Object.defineProperty(document.documentElement, 'requestFullscreen', { configurable: true, value: vi.fn(async () => setFullscreen(document.documentElement)) });
    Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: vi.fn(async () => setFullscreen(null)) });
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
const render = () => act(async () => root.render(React.createElement(FullscreenSettings)));

it('仅主动点击请求整页全屏，外部退出后不会重新进入', async () => {
    await render();
    expect(document.documentElement.requestFullscreen).not.toHaveBeenCalled();
    await act(async () => {
        host.querySelector('button')!.click();
        expect(document.documentElement.requestFullscreen).toHaveBeenCalledTimes(1);
    });
    expect(host.querySelector('button')!.textContent).toBe('退出全屏');
    await act(async () => setFullscreen(null));
    await act(async () => document.body.click());
    expect(host.querySelector('button')!.textContent).toBe('进入全屏');
    expect(document.documentElement.requestFullscreen).toHaveBeenCalledTimes(1);
});
it('拒绝请求时保留真实状态并允许重试', async () => {
    vi.mocked(document.documentElement.requestFullscreen).mockRejectedValueOnce(new Error('denied'));
    await render();
    await act(async () => host.querySelector('button')!.click());
    expect(host.querySelector('[role="status"]')).not.toBeNull();
    expect(host.querySelector('button')!.getAttribute('aria-pressed')).toBe('false');
    expect(host.querySelector('button')!.disabled).toBe(false);
});
it('支持从设置退出其他入口已开启的全屏', async () => {
    setFullscreen(document.documentElement);
    await render();
    await act(async () => host.querySelector('button')!.click());
    expect(document.exitFullscreen).toHaveBeenCalledTimes(1);
    expect(host.querySelector('button')!.textContent).toBe('进入全屏');
});
it('不支持时禁用入口，原生壳不显示', async () => {
    Object.defineProperty(document, 'fullscreenEnabled', { configurable: true, value: false });
    await render();
    expect(host.querySelector('button')!.disabled).toBe(true);
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    await render();
    expect(host.textContent).toBe('');
});
