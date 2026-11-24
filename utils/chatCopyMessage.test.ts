// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import CopyMessageButton from '../components/chat/CopyMessageButton';
import { trackEvent } from './analytics';

const addToast = vi.hoisted(() => vi.fn());
vi.mock('../context/OSContext', () => ({ useOS: () => ({ addToast }) }));
vi.mock('./analytics', () => ({ trackEvent: vi.fn() }));
const originalExecCommand = Object.getOwnPropertyDescriptor(document, 'execCommand');
let host: HTMLDivElement, root: Root;
beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});
afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    if (originalExecCommand) Object.defineProperty(document, 'execCommand', originalExecCommand);
    else Reflect.deleteProperty(document, 'execCommand');
    vi.unstubAllGlobals();
    vi.clearAllMocks();
});

async function mount(text: string, group = false) {
    const onClose = vi.fn();
    await act(async () => root.render(React.createElement(CopyMessageButton, { key: text, text, group, onClose })));
    return { button: host.querySelector('button')!, onClose };
}

it.each([false, true])('剪贴板写入完成后才提示成功和计数（群聊 %s）', async group => {
    let finish!: () => void;
    const writeText = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const text = '  第一行\n第二行  ';
    const { button, onClose } = await mount(text, group);
    await act(async () => button.click());
    await act(async () => button.click());
    expect(writeText.mock.calls).toEqual([[text]]);
    expect(button.disabled).toBe(true);
    expect(addToast).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => finish());
    expect(addToast).toHaveBeenCalledWith('已复制到剪贴板', 'success');
    expect(vi.mocked(trackEvent).mock.calls).toEqual([[group ? '复制一条群消息文字' : '复制一条消息']]);
    expect(onClose).toHaveBeenCalledOnce();
});

it('系统拒绝复制时可以在原菜单重试，兼容复制也按实际写入判定', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    const copiedText: string[] = [];
    const fallback = vi.fn(() => {
        copiedText.push(document.querySelector('textarea')!.value);
        return copiedText.length > 1;
    });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: fallback });
    const { button, onClose } = await mount('带\n换行的原文');
    await act(async () => button.click());
    expect(addToast).toHaveBeenCalledWith('未能写入剪贴板，请重试', 'error');
    expect(trackEvent).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(button.disabled).toBe(false);
    expect(document.querySelector('textarea')).toBeNull();
    await act(async () => button.click());
    expect(copiedText).toEqual(['带\n换行的原文', '带\n换行的原文']);
    expect(fallback).toHaveBeenCalledWith('copy');
    expect(trackEvent).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
    expect(document.querySelector('textarea')).toBeNull();
});

it('旧的复制请求完成时不会关闭后来打开的消息菜单', async () => {
    let finish!: () => void;
    vi.stubGlobal('navigator', { clipboard: { writeText: () => new Promise<void>(resolve => { finish = resolve; }) } });
    const first = await mount('第一条');
    await act(async () => first.button.click());
    const second = await mount('第二条');
    await act(async () => finish());
    expect(first.onClose).not.toHaveBeenCalled();
    expect(second.onClose).not.toHaveBeenCalled();
    expect(addToast).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledOnce();
});
