// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { DialogueApiConfig } from '../types';
import DialogueApiStatus from '../components/settings/DialogueApiStatus';
import { describeDialogueApiFailure } from './dialogueApiStatus';

let host: HTMLDivElement;
let root: Root;
let api: DialogueApiConfig;
let sequence = 0;
async function render(value = api, saved = api) {
    await act(async () => root.render(React.createElement(DialogueApiStatus, { value, saved, allowTest: true })));
}
async function testConnection() {
    const button = [...host.querySelectorAll('button')].find(node => node.textContent === '测试连接')!;
    await act(async () => button.click());
}
const response = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { headers: { 'Content-Type': 'application/json' } });
beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    api = { baseUrl: `https://verification-${++sequence}.test/v1`, apiKey: 'private-key', model: 'chat-model' };
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

it('keeps saving separate from validation and tests only on an explicit click', async () => {
    const network = vi.fn(async () => response('Hello'));
    vi.stubGlobal('fetch', network);
    await render();
    expect(host.textContent).toContain('已保存 · 尚未验证');
    expect(network).not.toHaveBeenCalled();
    await testConnection();
    expect(host.textContent).toContain('已保存 · 本次打开已验证');
    expect(network).toHaveBeenCalledTimes(1);
    expect(host.textContent).not.toContain('private-key');
    for (const patch of [
        { apiKey: 'different-key' }, { model: 'different-model' },
        { baseUrl: 'https://different.test/v1' }, { apiType: 'anthropic' as const }, { stream: true },
    ]) {
        await render({ ...api, ...patch });
        expect(host.textContent).toContain('有修改待保存 · 尚未验证');
        expect(host.textContent).not.toContain('连接成功');
    }
    expect(network).toHaveBeenCalledTimes(1);
});

it('does not accept an old in-flight result after the draft changes', async () => {
    let resolve!: (value: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(done => { resolve = done; })));
    await render(); await testConnection();
    await render({ ...api, apiKey: 'new-key' });
    await act(async () => resolve(response('Old response')));
    expect(host.textContent).toContain('尚未验证');
    expect(host.textContent).not.toContain('连接成功');
    await render();
    expect(host.textContent).toContain('已保存 · 尚未验证');
});

it('requires actual model output before marking an HTTP success as verified', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response('')));
    await render(); await testConnection();
    expect(host.textContent).toContain('尚未验证');
    expect(host.textContent).toContain('没有返回回复');
});

it('can validate a local service with an empty key and a streaming response', async () => {
    api = { ...api, apiKey: '', stream: true };
    const network = vi.fn(async () => new Response('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } }));
    vi.stubGlobal('fetch', network);
    await render(); await testConnection();
    expect(host.textContent).toContain('本次打开已验证');
    const init = (network.mock.calls[0] as unknown as [RequestInfo, RequestInit])[1];
    expect(JSON.parse(init.body as string)).toMatchObject({ stream: true, model: api.model, max_tokens: 5 });
});

it.each([
    ['HTTP 401', '密钥无效'], ['HTTP 403', '权限'], ['model_not_found', '模型不可用'],
    ['HTTP 404', '接口地址'], ['HTTP 429', '请求过于频繁'],
    ['HTTP 429 insufficient_quota', '余额不足'], ['Failed to fetch', '无法连接'], ['request timeout', '响应超时'],
])('explains %s without exposing provider response contents', (error, expected) => {
    expect(describeDialogueApiFailure(new Error(error))).toContain(expected);
});
