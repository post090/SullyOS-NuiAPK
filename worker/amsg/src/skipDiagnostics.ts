/**
 * 「这一轮没发出去」时的诊断日志。
 *
 * 模型回来却没有能发的正文时（skip-push），last_skip 里只有一个 reason，而背后是好几种
 * 完全不同的情况：content 是 null（只回了工具调用 / 被审核拦了）、content 是数组、思考把
 * token 烧光被截断、正文全包在 <think> 里、只写了标签，或者中转站把报错包在 HTTP 200 里。
 * 跳过的那一刻把模型响应的**形状**记一行，到 Workers Logs（Observability）里搜
 * `[amsg:skip-diag]` 就能分清是哪一种。
 *
 * 默认只记形状（有没有、什么类型、多长、token 数），不记聊天正文。要看原文片段时，给 Worker
 * 加一个明文变量 AMSG_DEBUG_LLM_RAW=1——wrangler 部署带 keep_vars、应用内「更新 Worker」
 * 重建配置时也原样保留普通变量，所以不会被冲掉。查完删掉。
 */
import { redactCredentials, stripReasoningTags } from '@rei-standard/amsg-shared';

/** body 里那句报错最多留多少字：典型的「余额不足 / 模型不存在」一句话装得下。 */
const BODY_ERROR_MAX_CHARS = 200;
/** 以下三个只在打开原文开关时用。 */
const CONTENT_EXCERPT_CHARS = 300;
/** 思考链取末尾：被截断时要看的是它停在哪儿。 */
const REASONING_TAIL_CHARS = 200;
const BODY_EXCERPT_CHARS = 500;

export interface LlmResponseShape {
  /** 响应里自报的模型名（中转站悄悄换了模型时看得出来）。 */
  model: string | null;
  /** 有没有非空的 choices。没有就不是正常的对话补全响应，多半是中转站把报错包在了 200 里。 */
  hasChoices: boolean;
  /** stop / length / content_filter / tool_calls……length 说明被截断了。 */
  finishReason: string | null;
  /** message.content 的形态。上游只认 string，其余一律当空串。 */
  contentType: 'string' | 'array' | 'null' | 'missing' | 'other';
  /** content 原文字符数（数组时是各段 text 之和）。 */
  contentChars: number;
  /** content 是数组时有几段。 */
  contentParts?: number;
  /** 上游交给钩子的正文剥掉思考块后还剩几个字。contentChars 不为 0 而它为 0 = 正文全在 <think> 里。 */
  visibleChars: number;
  /** 原生思考字段（reasoning_content / reasoning / thinking）的字符数。 */
  reasoningChars: number;
  toolCalls: number;
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    reasoningTokens: number | null;
  } | null;
  /** body 里带的报错（error 字段，没有 choices 时也认顶层 message / msg），截断并脱敏。 */
  bodyError: string | null;
}

/** 原文片段：只在 AMSG_DEBUG_LLM_RAW 打开时出现，全部先脱敏再截断。 */
export interface LlmResponseExcerpt {
  content?: string;
  reasoningTail?: string;
  toolCalls?: string;
  /** 没有 choices 时整个 body 的开头。 */
  body?: string;
}

type AnyRecord = Record<string, unknown>;

const asRecord = (value: unknown): AnyRecord | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as AnyRecord) : null;

const numberOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const clip = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max)}…` : text;

const safeStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
};

/** 取第一个 choice 的 message；没有 choices 时为 null。 */
const readFirstMessage = (body: AnyRecord | null): { choice: AnyRecord | null; message: AnyRecord | null } => {
  const choices = Array.isArray(body?.choices) ? (body!.choices as unknown[]) : [];
  const choice = asRecord(choices[0]);
  return { choice, message: asRecord(choice?.message) };
};

/** 字段名认三个，跟 onLLMOutput 里抄思考链那处一样宽。 */
const readReasoning = (message: AnyRecord | null): string => {
  const value = message?.reasoning_content ?? message?.reasoning ?? message?.thinking;
  return typeof value === 'string' ? value : '';
};

const readBodyError = (body: AnyRecord | null, hasChoices: boolean): string | null => {
  if (!body) return null;
  let text = '';
  const error = body.error;
  if (typeof error === 'string') {
    text = error;
  } else {
    const record = asRecord(error);
    if (record) {
      const code = typeof record.code === 'string' || typeof record.code === 'number'
        ? String(record.code)
        : typeof record.type === 'string' ? record.type : '';
      const message = typeof record.message === 'string' ? record.message : '';
      text = [code && `[${code}]`, message].filter(Boolean).join(' ') || safeStringify(record);
    }
  }
  // 顶层 message / msg 只在没有 choices 时才算报错：正常响应里没有这两个字段，
  // 有 choices 时出现也不代表失败。
  if (!text && !hasChoices) {
    const topLevel = body.message ?? body.msg;
    if (typeof topLevel === 'string') text = topLevel;
  }
  return text ? clip(redactCredentials(text), BODY_ERROR_MAX_CHARS) : null;
};

export const describeLlmResponseShape = (llmResponse: unknown, llmOutputText: string): LlmResponseShape => {
  const body = asRecord(llmResponse);
  const hasChoices = Array.isArray(body?.choices) && (body!.choices as unknown[]).length > 0;
  const { choice, message } = readFirstMessage(body);
  const content = message?.content;
  const contentType: LlmResponseShape['contentType'] =
    content === undefined ? 'missing'
      : content === null ? 'null'
        : typeof content === 'string' ? 'string'
          : Array.isArray(content) ? 'array'
            : 'other';
  const contentChars = typeof content === 'string'
    ? content.length
    : Array.isArray(content)
      ? content.reduce((sum: number, part) => {
          const text = asRecord(part)?.text;
          return sum + (typeof text === 'string' ? text.length : 0);
        }, 0)
      : 0;
  const usage = asRecord(body?.usage);
  const usageDetails = asRecord(usage?.completion_tokens_details);

  return {
    model: typeof body?.model === 'string' ? body.model : null,
    hasChoices,
    finishReason: typeof choice?.finish_reason === 'string' ? choice.finish_reason : null,
    contentType,
    contentChars,
    ...(Array.isArray(content) ? { contentParts: content.length } : {}),
    visibleChars: stripReasoningTags(llmOutputText || '').trim().length,
    reasoningChars: readReasoning(message).length,
    toolCalls: Array.isArray(message?.tool_calls) ? (message!.tool_calls as unknown[]).length : 0,
    usage: usage
      ? {
          promptTokens: numberOrNull(usage.prompt_tokens),
          completionTokens: numberOrNull(usage.completion_tokens),
          reasoningTokens: numberOrNull(usageDetails?.reasoning_tokens),
        }
      : null,
    bodyError: readBodyError(body, hasChoices),
  };
};

export const excerptLlmResponse = (llmResponse: unknown): LlmResponseExcerpt => {
  const body = asRecord(llmResponse);
  const hasChoices = Array.isArray(body?.choices) && (body!.choices as unknown[]).length > 0;
  if (!hasChoices) {
    return { body: clip(redactCredentials(safeStringify(llmResponse)), BODY_EXCERPT_CHARS) };
  }
  const { message } = readFirstMessage(body);
  const excerpt: LlmResponseExcerpt = {};
  const content = message?.content;
  if (typeof content === 'string') {
    if (content) excerpt.content = clip(redactCredentials(content), CONTENT_EXCERPT_CHARS);
  } else if (content != null) {
    excerpt.content = clip(redactCredentials(safeStringify(content)), CONTENT_EXCERPT_CHARS);
  }
  const reasoning = readReasoning(message);
  if (reasoning) {
    const tail = reasoning.length > REASONING_TAIL_CHARS ? `…${reasoning.slice(-REASONING_TAIL_CHARS)}` : reasoning;
    excerpt.reasoningTail = redactCredentials(tail);
  }
  if (Array.isArray(message?.tool_calls) && (message!.tool_calls as unknown[]).length > 0) {
    excerpt.toolCalls = clip(redactCredentials(safeStringify(message!.tool_calls)), CONTENT_EXCERPT_CHARS);
  }
  return excerpt;
};

let rawExcerptEnabled = false;

/** buildWorkerConfig 的写入口（isolate 级全局，同 configureInstantErrorPush 的先例）；export 也给单测用。 */
export const configureSkipDiagnostics = (options: { rawExcerpt: boolean }): void => {
  rawExcerptEnabled = options.rawExcerpt;
};

/** 面板上填的明文变量：1 / true 算开，其余（包括没配）都算关。 */
export const isDebugFlagOn = (value: unknown): boolean =>
  typeof value === 'string' && ['1', 'true'].includes(value.trim().toLowerCase());

export interface SkipDiagnosticInput {
  sessionId: string | undefined;
  reason: string;
  /** 第几轮（0 起）。大于 0 说明前面几轮在调工具，空的是收尾那一轮。 */
  iteration: number | undefined;
  llmResponse: unknown;
  llmOutputText: string | undefined;
}

export const logSkipDiagnostic = (input: SkipDiagnosticInput): void => {
  try {
    console.warn('[amsg:skip-diag]', {
      sessionId: input.sessionId ?? null,
      reason: input.reason,
      iteration: input.iteration ?? null,
      ...describeLlmResponseShape(input.llmResponse, input.llmOutputText ?? ''),
      ...(rawExcerptEnabled ? { raw: excerptLlmResponse(input.llmResponse) } : {}),
    });
  } catch (error) {
    // 诊断是锦上添花，碰上奇形怪状的响应也不能把跳过本身弄挂。
    console.warn('[amsg:skip-diag] 诊断日志没记下来（跳过照常生效）', error);
  }
};
