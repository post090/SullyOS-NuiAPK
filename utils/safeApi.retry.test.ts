// 回归：重试判断曾混用入参 maxRetries 与真实上限 automaticRetryLimit（聊天补全恒为 0），
// 导致原生通道采样参数摘除重试不生效、真实 HTTP 错误被吞成“API请求失败”、
// 以及回前台补枪对付费聊天补全也生效。
import { describe, it, expect, vi, beforeEach } from 'vitest';
const m = vi.hoisted(() => ({ send: vi.fn(), fg: vi.fn(() => Infinity), native: { on: true } }));
vi.mock('./runtime/nativeChatRequest', () => ({
  canUseNativeChatRuntime: async () => m.native.on,
  isNativeSamplingError: (s: number, b: string) => s === 400 && /temperature/.test(b) && /not supported/.test(b),
  markNativeChatCompleted: () => {},
  markNativeChatFailed: () => {},
  sendNativeChatAttempt: m.send,
  stripSamplingFromNativeBody: (b: string) => { const p = JSON.parse(b); if (!('temperature' in p)) return null; delete p.temperature; return JSON.stringify(p); },
}));
vi.mock('./runtime/runtimeState', () => ({ msSinceForeground: m.fg }));
import { safeFetchJson } from './safeApi';
const U = 'https://api.test/v1/chat/completions';
const ok = { statusCode: 200, headers: {}, body: JSON.stringify({ choices: [{ message: { content: 'hi' } }] }), totalMs: 1, headersMs: 1 };
beforeEach(() => { m.send.mockReset(); m.fg.mockReturnValue(Infinity); m.native.on = true; });
describe('safeFetchJson 重试上限（原生聊天 / 回前台补枪）', () => {
  it('native sampling 400 -> strip and retry once', async () => {
    m.send.mockResolvedValueOnce({ statusCode: 400, headers: {}, body: 'temperature is not supported', requestBody: '{"temperature":1}', totalMs: 1, headersMs: 1 })
      .mockResolvedValueOnce({ ...ok, requestBody: '{}' });
    const r = await safeFetchJson(U, { method: 'POST', body: '{"temperature":1}' }, 2, 0, { appName: '消息', purpose: '聊天回复' });
    expect(r.choices[0].message.content).toBe('hi');
    expect(m.send).toHaveBeenCalledTimes(2);
  });
  it('native 503 keeps status in error', async () => {
    m.send.mockResolvedValue({ statusCode: 503, headers: {}, body: '{"error":{"message":"busy"}}', requestBody: '{}', totalMs: 1, headersMs: 1 });
    const onRetry = vi.fn();
    await expect(safeFetchJson(U, { method: 'POST', body: '{}' }, 2, 0, { appName: '消息', purpose: '聊天回复' }, { onRetry })).rejects.toThrow(/503/);
    expect(m.send).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });
  it('grace retry actually re-sends for non-billable endpoint', async () => {
    m.fg.mockReturnValue(1000); m.native.on = false;
    const f = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(new Response('{"data":[1]}', { status: 200 }));
    const r = await safeFetchJson('https://api.test/v1/models', { method: 'GET' }, 0);
    expect(r.data[0]).toBe(1);
    expect(f).toHaveBeenCalledTimes(2);
    f.mockRestore();
  });
  it('no grace toast/delay for billable chat', async () => {
    m.fg.mockReturnValue(1000); m.native.on = false;
    const f = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    const onRetry = vi.fn();
    await expect(safeFetchJson(U, { method: 'POST', body: '{}' }, 0, 0, undefined, { onRetry })).rejects.toThrow('Failed to fetch');
    expect(onRetry).not.toHaveBeenCalled();
    expect(f).toHaveBeenCalledTimes(1);
    f.mockRestore();
  });
});
