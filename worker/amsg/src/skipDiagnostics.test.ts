import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  configureSkipDiagnostics,
  describeLlmResponseShape,
  excerptLlmResponse,
  isDebugFlagOn,
  logSkipDiagnostic,
} from './skipDiagnostics';

const FAKE_KEY = 'sk-abcdefghijklmnopqrstuvwxyz123456';

// last_skip 里只有一个 empty-generation，分辨是哪一种「没说话」全靠这份形状。
// 哪个字段退化成恒定值，排障就又回到瞎猜。
describe('describeLlmResponseShape：几种「没说话」各有各的样子', () => {
  it('中转站把报错包在 200 里 → 没有 choices，报错原话进 bodyError 且脱敏', () => {
    const shape = describeLlmResponseShape({
      error: { message: `Invalid token: ${FAKE_KEY}`, code: 'invalid_api_key' },
    }, '');
    expect(shape.hasChoices).toBe(false);
    expect(shape.contentType).toBe('missing');
    expect(shape.bodyError).toContain('[invalid_api_key] Invalid token');
    expect(shape.bodyError).not.toContain(FAKE_KEY);
  });

  it('顶层 message 只在没有 choices 时才当报错', () => {
    expect(describeLlmResponseShape({ message: '余额不足' }, '').bodyError).toBe('余额不足');
    expect(describeLlmResponseShape({
      choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: '' } }],
      message: 'ok',
    }, '').bodyError).toBeNull();
  });

  it('只回了工具调用 / 被审核拦下 → content 为 null，finish_reason 和工具数照实记', () => {
    const shape = describeLlmResponseShape({
      choices: [{
        finish_reason: 'tool_calls',
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [{ id: 'c1', type: 'function', function: { name: 'x', arguments: '{}' } }],
        },
      }],
    }, '');
    expect(shape).toMatchObject({
      hasChoices: true, contentType: 'null', contentChars: 0, toolCalls: 1, finishReason: 'tool_calls',
    });
  });

  it('content 是数组 → 记下段数和字数（上游只认 string，这种会被当成空）', () => {
    const shape = describeLlmResponseShape({
      choices: [{
        finish_reason: 'stop',
        message: { role: 'assistant', content: [{ type: 'text', text: '在的' }, { type: 'text', text: '呀' }] },
      }],
    }, '');
    expect(shape).toMatchObject({ contentType: 'array', contentParts: 2, contentChars: 3, visibleChars: 0 });
  });

  it('思考把 token 烧光 → finish_reason length、思考字数和 reasoning_tokens 都在', () => {
    const shape = describeLlmResponseShape({
      model: 'deepseek-reasoner',
      choices: [{
        finish_reason: 'length',
        message: { role: 'assistant', content: '', reasoning_content: '想'.repeat(50) },
      }],
      usage: { prompt_tokens: 1000, completion_tokens: 4096, completion_tokens_details: { reasoning_tokens: 4096 } },
    }, '');
    expect(shape).toMatchObject({
      model: 'deepseek-reasoner',
      finishReason: 'length',
      contentType: 'string',
      contentChars: 0,
      reasoningChars: 50,
      usage: { promptTokens: 1000, completionTokens: 4096, reasoningTokens: 4096 },
    });
  });

  it('正文全在 <think> 里 → contentChars 有数、visibleChars 为 0', () => {
    const text = '<think>要不要回呢……算了</think>';
    const shape = describeLlmResponseShape({
      choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: text } }],
    }, text);
    expect(shape.contentChars).toBe(text.length);
    expect(shape.visibleChars).toBe(0);
  });

  it('响应根本不是对象也不抛', () => {
    expect(describeLlmResponseShape(undefined, '')).toMatchObject({
      hasChoices: false, contentType: 'missing', usage: null, bodyError: null,
    });
    expect(describeLlmResponseShape('oops', '').hasChoices).toBe(false);
  });
});

describe('excerptLlmResponse', () => {
  it('有 choices 时取正文开头、思考链末尾、工具调用，全部脱敏', () => {
    const excerpt = excerptLlmResponse({
      choices: [{
        message: {
          content: `key 是 ${FAKE_KEY} ${'字'.repeat(400)}`,
          reasoning_content: `${'前'.repeat(300)}结尾在这`,
          tool_calls: [{ function: { name: 'x' } }],
        },
      }],
    });
    expect(excerpt.content!.startsWith('key 是')).toBe(true);
    expect(excerpt.content).not.toContain(FAKE_KEY);
    expect(excerpt.content!.length).toBeLessThanOrEqual(301);
    expect(excerpt.reasoningTail!.endsWith('结尾在这')).toBe(true);
    expect(excerpt.toolCalls).toContain('"name":"x"');
    expect(excerpt.body).toBeUndefined();
  });

  it('没有 choices 时给整个 body 的开头', () => {
    expect(excerptLlmResponse({ error: { message: '模型不存在' } }).body).toContain('模型不存在');
  });
});

describe('logSkipDiagnostic', () => {
  afterEach(() => {
    configureSkipDiagnostics({ rawExcerpt: false });
    vi.restoreAllMocks();
  });

  const input = {
    sessionId: 'sess_1',
    reason: 'empty-generation',
    iteration: 0,
    llmResponse: { choices: [{ finish_reason: 'stop', message: { content: '<think>悄悄话</think>' } }] },
    llmOutputText: '<think>悄悄话</think>',
  };

  // 回归守卫：聊天正文默认不能进日志，只有用户自己打开开关才带。
  it('默认只记形状，日志里没有一个字的正文', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logSkipDiagnostic(input);
    const [tag, payload] = warn.mock.calls[0];
    expect(tag).toBe('[amsg:skip-diag]');
    expect(payload).toMatchObject({
      sessionId: 'sess_1', reason: 'empty-generation', contentType: 'string', visibleChars: 0,
    });
    expect(payload).not.toHaveProperty('raw');
    expect(JSON.stringify(payload)).not.toContain('悄悄话');
  });

  it('打开原文开关后带上片段', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    configureSkipDiagnostics({ rawExcerpt: true });
    logSkipDiagnostic(input);
    expect(warn.mock.calls[0][1].raw.content).toContain('悄悄话');
  });
});

describe('isDebugFlagOn', () => {
  it('只认 1 / true（不分大小写、容忍空白），其余一律关', () => {
    for (const on of ['1', 'true', ' TRUE ']) expect(isDebugFlagOn(on)).toBe(true);
    for (const off of [undefined, '', '0', 'false', 'yes', 1]) expect(isDebugFlagOn(off)).toBe(false);
  });
});
