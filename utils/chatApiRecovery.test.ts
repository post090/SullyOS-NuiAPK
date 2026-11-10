// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIConfig, CharacterProfile, Message, RealtimeConfig, UserProfile } from '../types';
import { useChatAI } from '../hooks/useChatAI';
import ChatApiRecovery from '../components/chat/ChatApiRecovery';
import DialogueApiStatus from '../components/settings/DialogueApiStatus';
import { DB } from './db';
import { safeFetchJson } from './safeApi';
import * as postProcessing from './applyAssistantPostProcessing';

const os = vi.hoisted(() => ({
    apiConfig: { baseUrl: 'https://global.test/v1', apiKey: 'bad-key', model: 'test-model' } as APIConfig,
    character: { id: 'api-recovery', name: '自选角色' } as CharacterProfile,
    apiPresets: [], availableModels: ['test-model'],
    updateApiConfig: vi.fn<(patch: Partial<APIConfig>) => void>(),
    updateCharacter: vi.fn<(id: string, patch: Partial<CharacterProfile> | ((previous: CharacterProfile) => Partial<CharacterProfile>)) => void>(),
    addToast: vi.fn(),
}));
vi.mock('../context/OSContext', () => ({ useOS: () => os }));
vi.mock('../context/MusicContext', () => ({ useMusic: () => ({}), loadMusicHooks: () => null }));
vi.mock('./keepAlive', () => ({ KeepAlive: { start: vi.fn(), stop: vi.fn() } }));
vi.mock('./amsgStateSync', async importOriginal => ({ ...await importOriginal<typeof import('./amsgStateSync')>(), syncAmsgLlmCredentials: vi.fn() }));
vi.mock('./safeApi', async importOriginal => ({ ...await importOriginal<typeof import('./safeApi')>(), safeFetchJson: vi.fn() }));

let current: ReturnType<typeof useChatAI>;
let pendingRetry: void | Promise<void>;
let root: Root;
let host: HTMLDivElement;
let sequence = 0;
function Probe() {
    current = useChatAI({ char: os.character, apiConfig: os.apiConfig,
        userProfile: { name: '用户' } as UserProfile, groups: [], emojis: [], categories: [],
        realtimeConfig: {} as RealtimeConfig, addToast: os.addToast, setMessages: vi.fn(),
        updateCharacter: os.updateCharacter, updateUserProfile: vi.fn(),
    });
    return React.createElement(React.Fragment, null,
        React.createElement(DialogueApiStatus, { value: os.apiConfig, saved: os.apiConfig }),
        current.apiFailure && React.createElement(ChatApiRecovery, { key: os.character.id, character: os.character, failure: current.apiFailure,
            busy: current.isTyping, onRetry: () => { pendingRetry = current.retryFailedReply(); return pendingRetry; } }));
}
async function render() { await act(async () => root.render(React.createElement(Probe))); }
async function click(text: string) {
    const button = [...host.querySelectorAll('button')].find(node => node.textContent?.trim() === text);
    expect(button, text).toBeTruthy();
    await act(async () => button!.click());
}
async function editKey(key: string) {
    const input = host.querySelector<HTMLInputElement>('input[type="password"]')!;
    await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, key);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}
async function send(): Promise<Message> {
    const id = await DB.saveMessage({ charId: os.character.id, role: 'user', type: 'text', content: '给我回个消息' });
    const original = (await DB.getRecentMessagesByCharId(os.character.id, 20)).find(message => message.id === id)!;
    await act(async () => { await current.triggerAI([original]); });
    return original;
}
beforeEach(async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    os.apiConfig = { baseUrl: 'https://global.test/v1', apiKey: `bad-key-${++sequence}`, model: 'test-model' };
    os.character = { id: `api-recovery-${sequence}`, name: '自选角色', emotionConfig: { enabled: false } } as CharacterProfile;
    os.updateApiConfig.mockImplementation(patch => { os.apiConfig = { ...os.apiConfig, ...patch }; });
    os.updateCharacter.mockImplementation((_, patch) => {
        os.character = { ...os.character, ...(typeof patch === 'function' ? patch(os.character) : patch) };
    });
    vi.mocked(safeFetchJson).mockReset().mockRejectedValue(new Error('HTTP 401 invalid_api_key'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    await render();
});
afterEach(async () => {
    await act(async () => root.unmount()); host.remove();
    vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals();
});

describe('chat API recovery through the real reply hook', () => {
    it('repairs the global API in chat and retries the same turn without duplicating user messages', async () => {
        const original = await send();
        expect(host.textContent).toContain('API 密钥无效');
        expect(host.textContent).toContain('当前使用全局 API');
        expect(host.textContent).not.toContain(os.apiConfig.apiKey);
        await click('修正 API'); await editKey('fixed-global-key'); await click('确定'); await render();
        expect(os.updateApiConfig).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'fixed-global-key' }));
        expect(os.updateCharacter).not.toHaveBeenCalled();
        await click('重试回复');
        await act(async () => { await pendingRetry; });
        expect(current.isTyping).toBe(false);
        const requests = vi.mocked(safeFetchJson).mock.calls;
        expect(requests).toHaveLength(2);
        expect(requests[1][1]?.headers).toMatchObject({ Authorization: 'Bearer fixed-global-key' });
        const body = JSON.parse(requests[1][1]!.body as string) as { messages: { role: string; content: string }[] };
        expect(body.messages.some(message => message.role === 'user' && message.content.includes(original.content))).toBe(true);
        const stored = await DB.getRecentMessagesByCharId(os.character.id, 20);
        expect(stored.filter(message => message.role === 'user').map(message => message.id)).toEqual([original.id]);
    });

    it('repairs only the character override when that is the selected source', async () => {
        const global = { ...os.apiConfig };
        os.character.dialogueApi = { baseUrl: 'https://role.test/v1', apiKey: 'bad-role-key', model: 'role-model' };
        await render(); await send();
        expect(host.textContent).toContain('自选角色的独立 API');
        await click('修正 API'); await editKey('fixed-role-key'); await click('确定'); await render();
        expect(os.updateCharacter).toHaveBeenCalledWith(os.character.id, { dialogueApi: expect.objectContaining({ apiKey: 'fixed-role-key', model: 'role-model' }) });
        expect(os.updateApiConfig).not.toHaveBeenCalled();
        expect(os.apiConfig).toEqual(global);
        await act(async () => { await current.retryFailedReply(); });
        expect(vi.mocked(safeFetchJson).mock.lastCall?.[0]).toBe('https://role.test/v1/chat/completions');
        expect(vi.mocked(safeFetchJson).mock.lastCall?.[1]?.headers).toMatchObject({ Authorization: 'Bearer fixed-role-key' });
    });

    it('offers setup for a missing API and keeps a different character free of the previous failure', async () => {
        os.apiConfig = { ...os.apiConfig, baseUrl: '' };
        await render(); await send();
        expect(host.textContent).toContain('还没有配置聊天 API');
        expect(safeFetchJson).not.toHaveBeenCalled();
        os.character = { ...os.character, id: 'another-character' };
        await render();
        expect(current.apiFailure).toBeNull();
        await act(async () => { await current.retryFailedReply(); });
        expect(safeFetchJson).not.toHaveBeenCalled();
    });

    it('verifies a successful model response and keeps a subsequent processing failure separate', async () => {
        vi.mocked(safeFetchJson).mockResolvedValue({ choices: [{ message: { content: '你好' } }] });
        vi.spyOn(postProcessing, 'applyAssistantPostProcessing').mockRejectedValue(new Error('落库失败'));
        await send();
        expect(host.textContent).toContain('本次打开已验证');
        expect(current.apiFailure).toBeNull();
        const stored = await DB.getRecentMessagesByCharId(os.character.id, 20);
        expect(stored.some(message => message.content.includes('回复处理失败'))).toBe(true);
    });
});
