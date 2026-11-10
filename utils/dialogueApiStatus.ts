import { useSyncExternalStore } from 'react';
import type { DialogueApiConfig } from '../types';
import { pickDialogueApi } from './characterApi';
import { llmApiType } from './llmEndpoint';
import { fetchLlm } from './anthropicApi';
import { nativeFetch } from './nativeFetch';
import { extractContent, safeResponseJson } from './safeApi';

// Verification belongs to this exact connection, and lasts for this app session.
// Credentials stay in memory and are never copied into a status record or log.
const verified = new Set<string>();
const listeners = new Set<() => void>();

export interface ChatApiFailure {
    charId: string;
    scope: 'global' | 'character' | 'override';
    message: string;
    canRetry: boolean;
}

export function dialogueApiIdentity(config: DialogueApiConfig): string {
    const api = pickDialogueApi(config);
    return JSON.stringify([api.baseUrl, api.apiKey, api.model, llmApiType(api), api.stream ?? false]);
}

export function markDialogueApiVerified(config: DialogueApiConfig) {
    const identity = dialogueApiIdentity(config);
    if (verified.has(identity)) return;
    verified.add(identity);
    listeners.forEach(notify => notify());
}

export function useDialogueApiVerified(config: DialogueApiConfig): boolean {
    const identity = dialogueApiIdentity(config);
    return useSyncExternalStore(subscribe, () => verified.has(identity), () => false);
}

function subscribe(notify: () => void) {
    listeners.add(notify);
    return () => { listeners.delete(notify); };
}

export function describeDialogueApiFailure(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    if (/insufficient_quota|余额不足|欠费|quota.*exceed|credit.*balance/i.test(message)) return 'API 额度或余额不足，请到服务商检查账户。';
    if (/\b401\b|invalid[_ ]api[_ ]key|authentication_error/i.test(message)) return 'API 密钥无效或已过期，请检查 Key。';
    if (/\b403\b|permission_denied|permission_error/i.test(message)) return 'API 拒绝访问，请检查密钥权限和模型使用权限。';
    if (/model_not_found|invalid_model|model.*not (?:found|exist)|模型不存在/i.test(message)) return '模型不可用，请检查模型名称及账户权限。';
    if (/\b404\b/.test(message)) return '接口地址或模型未找到，请核对 URL 和模型名称。';
    if (/\b429\b|rate_limit/i.test(message)) return 'API 请求过于频繁或额度受限，请稍后重试并检查服务商额度。';
    if (/timeout|timed out|超时/i.test(message)) return 'API 响应超时，可以检查网络后重试。';
    if (/fetch|network|网络|Failed to load|Load failed/i.test(message)) return '无法连接 API，请检查网络及接口地址后重试。';
    if (/回复为空/.test(message)) return '接口已响应，但没有返回回复，请检查模型或稍后重试。';
    return '回复请求失败，可以检查 API 配置后重试。';
}

export async function testDialogueApi(config: DialogueApiConfig, signal?: AbortSignal): Promise<string> {
    const api = pickDialogueApi(config);
    const response = await fetchLlm(`${api.baseUrl}/chat/completions`, {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${api.apiKey || 'sk-none'}` },
        body: JSON.stringify({ model: api.model, messages: [{ role: 'user', content: 'Hi' }], max_tokens: 5, stream: api.stream ?? false }),
    }, nativeFetch);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`);
    const content = extractContent(await safeResponseJson(response));
    if (!content.trim()) throw new Error('接口已响应，但回复为空');
    return content;
}
