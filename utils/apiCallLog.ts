/**
 * 全局 API 调用记录（给 设置 → API 调用记录 页面用）。
 *
 * 设计：项目里 LLM 调用分两类——走 `utils/safeApi.ts` 的 `safeFetchJson` 的，和
 * 各 App 自己写的裸 `fetch`（TRPG / 自习室 / 群聊 / 日记…）。为了一个都不漏，记录点
 * 放在 `OSContext` 里那个全局 `fetch` monkey-patch 上：所有 `/chat/completions`
 * （含 safeFetchJson 内部 fetch）都经过它，统一调 `recordApiCall`，不重复计。
 *
 * 「时间 / 哪个 API / 哪个模型 / token」从请求体 + 响应里自动解析；「哪个 App / 哪个
 * 角色 / 具体用途」靠两条来源：
 *   1. 显式 meta —— safeFetchJson 调用点通过第 5 个参数传，挂到 RequestInit 的
 *      `__sullyMeta` 上由拦截器读取（精确，含 purpose）。
 *   2. 环境兜底 ambientMeta —— OSContext 在切 App / 角色时写入「当前在哪个 App、
 *      当前角色」，裸 fetch 没有显式 meta 时用它兜底标 App / 角色。
 *
 * 只保留近 5 天，超期在 DB 层写入时丢弃。recordApiCall 是 best-effort：任何异常都
 * 吞掉，绝不影响主请求链路。
 */

/** 调用方可补充的语义信息（哪个 App / 角色 / 用途）。能填多少填多少。 */
export interface ApiCallMeta {
    /** AppID 字符串，如 'chat' / 'lifesim'，可空 */
    appId?: string;
    /** App 显示名，如 '消息' / '记忆宫殿'，列表里直接展示这个 */
    appName?: string;
    /** 角色 id，可空 */
    charId?: string;
    /** 角色名，可空 */
    charName?: string;
    /** 具体用途，如 '聊天回复' / '情绪评估' / '记忆提取'，可空 */
    purpose?: string;
    /** 本次请求向量化记忆宫殿召回了哪些条目（仅 memoryPalace 开启的聊天请求才有） */
    recalledMemories?: RecalledMemorySnapshot[];
}

/** 记忆召回快照（进 API 调用详情面板展示用，不进 prompt）。 */
export interface RecalledMemorySnapshot {
    id: string;
    room: string;
    preview: string;
    score: number;
    importance: number;
    isBox: boolean;
    isPinned: boolean;
}

/**
 * 这一次请求是谁发出去的。
 *
 * 不填 = 浏览器自己直连模型（绝大多数记录，不占存储）。带值的这几种都是主动消息 2.0
 * 交给云端跑的：本地只把活儿交上去，真正那条 `/chat/completions` 由用户自己的
 * Cloudflare Worker 在云端发出。
 *   - `cloud-instant-chat`：即时对话（用户此刻正等着的那一轮）
 *   - `cloud-plate-consolidate`：门牌整理（记忆宫殿的后台活儿，用的是副 API）
 */
export type ApiCallRoute = 'cloud-instant-chat' | 'cloud-plate-consolidate';

/** 落库的一条记录。 */
export interface ApiCallLogEntry extends ApiCallMeta {
    id: string;
    /** 调用发起（实际是响应回来）时间戳 ms */
    timestamp: number;
    /** 见 ApiCallRoute。空 = 浏览器直连。 */
    route?: ApiCallRoute;
    /**
     * 云端收下了这一轮，结果还没回来。回复落库（或云端点名说这轮没成）时回填掉。
     * 本地直连的记录没有这一档：那边是响应回来才记，天生就是终态。
     */
    pending?: boolean;
    /**
     * 这一轮被下一条消息顶掉了（还没等到回复就又发了一条，云端把两句合成一次回）。
     * 不算失败，但也等不到属于它自己的回复——不单独收尾的话，这笔会一直写着
     * 「云端生成中」，直到 5 天后被裁掉。
     */
    superseded?: boolean;
    /**
     * Token 数只覆盖这一轮里的**最后一次**模型调用，不是全部。
     *
     * 云端带工具时一轮对话会连着调好几次模型（查完东西再接着说），而回传的用量只有
     * 最后那次——不标出来的话，用户拿这个数去对供应商账单会一直对不上，还以为是被
     * 多扣了。只在确实跑过工具时才置位。
     */
    tokensPartial?: boolean;
    /** 命中的预设名；匹配不到时回退成 baseUrl 的 host */
    presetName: string;
    baseUrl: string;
    model: string;
    /**
     * 响应侧自报的模型（response.model）——实际服务这次请求的后端身份。
     * 中转的渠道名（如 `[千岛-自营]xxx`）只锁"店面"，上游内部降级/轮询时对外模型名
     * 不变，但后端会在响应里自报真身（如 `[逆-V]xxx-c`）。请求名 ≠ 自报名时，
     * 这个字段就是"被换后端了"的直接证据。拿不到（响应无 model 字段）则空。
     */
    backendModel?: string;
    /** HTTP 状态码（成功 / 失败均记，失败时可能是最后一次的状态） */
    status?: number;
    /** 请求是否成功拿到 JSON */
    ok: boolean;
    /** 输入 token（prompt_tokens），来自响应 usage，拿不到则空 */
    promptTokens?: number;
    /** 输出 token（completion_tokens） */
    completionTokens?: number;
    /** 总 token（total_tokens） */
    totalTokens?: number;
    /** 请求从发起到响应 / 报错的耗时 ms（NetworkError 类失败时 = 等了多久才断） */
    durationMs?: number;
    /**
     * 输入构成统计（每块的名字 + 字符数），回答「prompt_tokens 为什么这么大」。
     * 只存统计不存原文（原文一条就几十 KB，5 天日志会撑爆存储）；在响应回来后的
     * fire-and-forget 记录路径里扫一遍请求体算出，不占请求主链路。
     */
    promptBreakdown?: PromptBlockStat[];
}

/** 输入构成里的一块：system prompt 的一个 ### 段落，或聚合后的聊天历史。 */
export interface PromptBlockStat {
    /** 块名：### 标题 / [System: …] 行 / 无标题时取首行摘要；历史消息聚合成「聊天历史·×N」 */
    label: string;
    /** 该块字符数（含标题行与换行） */
    chars: number;
    /**
     * 块全文预览（含块头行），供详情面板点开查看具体内容。存全文不截断
     * （用户确认存储空间够）；展示层用 max-h + overflow 控制可视高度。
     * 旧记录没有这个字段，点开显示"无预览"。
     */
    preview?: string;
    /**
     * 该块归属的功能模块（构建侧按「块头结构」锚定，不用关键词 contains，
     * 所以用户核心提示词绝不会因为字面含「记忆」被误判成记忆模块）。
     * 展示层按 module 把同模块的块合并成一条。旧记录没有这个字段，展示层
     * 回退用 classifyPromptBlock(label) 兜底。
     */
    module?: PromptModule;
    /** 该模块提示词的生成位置（回答"哪来的"），如 'context.ts · 角色设定'。 */
    source?: string;
}

export type ApiRequestCaptureSectionKind =
    | 'request'
    | 'tools'
    | 'system'
    | 'memory'
    | 'worldbook'
    | 'group'
    | 'history'
    | 'context'
    | 'user'
    | 'assistant'
    | 'tool';

/** 一次性完整抓包的分区索引。正文只在 payload 中保存一份，避免大上下文重复占空间。 */
export interface ApiRequestCaptureSection {
    id: string;
    label: string;
    kind: ApiRequestCaptureSectionKind;
    chars: number;
    /** 面向用户的来源解释，例如「记忆系统召回并注入的内容」。 */
    source?: string;
    /** 在原始请求里的位置，例如 messages[0].content。 */
    path?: string;
    role?: string;
    messageIndex?: number;
    /** 字符串消息被按标题拆块时，对应 content 的起止位置。 */
    start?: number;
    end?: number;
}

/**
 * 用户主动开启后，仅保存下一次 chat/completions 的完整请求体。
 * 普通 5 天日志仍然只存统计；这条记录永远覆盖上一条，避免原文长期堆积。
 */
export interface ApiRequestCapture {
    version: 1;
    id: string;
    capturedAt: number;
    baseUrl: string;
    presetName: string;
    model: string;
    meta: ApiCallMeta;
    payload: unknown;
    totalChars: number;
    /** 模型/中转响应 usage 中自报的真实输入 Token；对方不返回时为空。 */
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    usageStatus?: 'pending' | 'reported' | 'not-reported' | 'failed';
    messageCount: number;
    binaryPlaceholders: number;
    sections: ApiRequestCaptureSection[];
}

export const API_REQUEST_CAPTURE_EVENT = 'sully-api-request-capture-change';
const API_REQUEST_CAPTURE_ARMED_KEY = 'sully_api_request_capture_armed_v1';

const PRESETS_STORAGE_KEY = 'os_api_presets';

/**
 * 环境上下文（兜底用）：很多 App 走的是裸 fetch，调用点无法/来不及传 meta。
 * OSContext 会在切换 App / 角色时把「当前在哪个 App、当前角色是谁」写到这里，
 * 全局 fetch 拦截器记录裸 fetch 调用时拿它当兜底标签。
 * 注意：safeFetchJson 传了显式 meta 的调用以显式 meta 为准，不用兜底（避免后台
 * 任务被误标成用户当前所在的 App）。
 */
let ambientMeta: ApiCallMeta = {};

export function setApiCallAmbientContext(meta: ApiCallMeta): void {
    ambientMeta = meta || {};
}

/** Snapshot the current fallback context when a request starts. */
export function getApiCallAmbientContext(): ApiCallMeta {
    return { ...ambientMeta };
}

function hasMeta(meta?: ApiCallMeta): boolean {
    return !!meta && Object.values(meta).some((v) => v != null && v !== '');
}

function stripTrailingSlash(s: string): string {
    return s.replace(/\/+$/, '');
}

/** 把 `https://host/v1/chat/completions` 还原成 `https://host/v1`（预设里存的 baseUrl 形态）。 */
function deriveBaseUrl(url: string): string {
    return stripTrailingSlash(url.replace(/\/chat\/completions\/?$/i, ''));
}

function hostOf(url: string): string {
    try {
        return new URL(url).host;
    } catch {
        return url;
    }
}

/**
 * 模型名的"核心名"：剥掉渠道标签（[方括号]、(半角圆括号)、（全角圆括号））、
 * 去空白、统一小写。用于判断「请求名 vs 后端自报名」是不是同一个模型——
 * `(按次)gemini-3.1-pro-preview` 和 `gemini-3.1-pro-preview` 是同一个（只是渠道标签），
 * `gemini-3.1-pro-preview` 和 `gemini-3.1-pro-preview-c` 才是真的换了后端。
 */
/**
 * 已知模型家族开头（gemini-…/gpt-…/claude-…）。渠道前缀的花样穷举不完，
 * 但家族名是个短且稳定的清单——把它当锚点：名字开头若不是家族名、且剥掉
 * 一段裸前缀（`gcli-` / `vertex-ai/`）后就是，则认定那段是渠道标签。
 * 这样「两头贴了不同裸前缀」（gcli-X vs vertex-X）也能对上核心名。
 */
const MODEL_FAMILY_RE = /^(gemini|gemma|gpt|chatgpt|o\d|claude|deepseek|qwen|qwq|glm|llama|grok|kimi|moonshot|mistral|mixtral|doubao|hunyuan|minimax|ernie|command|nova|phi)[-_.\d]/i;

function stripBareChannelPrefixes(s: string): string {
    let cur = s;
    // 最多剥 3 层（渠道套渠道），每刀都必须让剩余部分以已知家族名开头才算数
    for (let i = 0; i < 3; i++) {
        if (MODEL_FAMILY_RE.test(cur)) return cur;
        // 非贪婪取最短首段：'chatgpt-4o' 不会被误劈成 'chatgpt-4o' + …
        const m = cur.match(/^[a-z0-9_.]{1,24}?[-/](.+)$/i);
        if (!m || !MODEL_FAMILY_RE.test(m[1])) return cur;
        cur = m[1];
    }
    return cur;
}

export function coreModelName(m: string): string {
    const stripped = (m || '')
        .replace(/\[[^\]]*\]|\([^)]*\)|（[^）]*）/g, '')
        .replace(/\s+/g, '')
        .toLowerCase();
    return stripBareChannelPrefixes(stripped);
}

/**
 * 「请求的模型」和「后端自报的模型」是否应视为同一个（＝不该报琥珀 ⚠️）。
 *
 * 贩子的渠道标签格式穷举不完（[方括号]、(按次)、gcli- 裸前缀…），所以不枚举格式，
 * 改用方向性判定——核心名归一后：
 *   - 完全相等 → 同一个
 *   - 一方是另一方**去掉开头一截**的结果（endsWith）→ 同一个。
 *     覆盖两个方向：请求带渠道前缀（gcli-X ↔ X）、后端带路径/前缀（X ↔ models/X）。
 *     「开头多一截」只是运营商贴标签，不改变模型本体。
 *   - 其余（尤其**尾巴多一截**：X ↔ X-c / X-lite）→ 不同。缩水变体都长在尾巴上，
 *     这正是要抓的降级信号，绝不放行。
 * 短名（<8 字符）不做 endsWith 宽容，防止病态短串误匹配。
 */
export function isSameCoreModel(requested: string, backend: string): boolean {
    const a = coreModelName(requested);
    const b = coreModelName(backend);
    if (!a || !b) return true;   // 有一方空：无从比较，不报警
    if (a === b) return true;
    const shorter = a.length < b.length ? a : b;
    if (shorter.length < 8) return false;
    return a.endsWith(b) || b.endsWith(a);
}

/** 从请求体里抠出 model 字段（body 可能是 JSON 字符串或对象）。 */
function extractModel(body: unknown): string {
    if (!body) return '';
    let parsed: any = body;
    if (typeof body === 'string') {
        try { parsed = JSON.parse(body); } catch { return ''; }
    }
    return typeof parsed?.model === 'string' ? parsed.model : '';
}

/**
 * 用 baseUrl + model 在用户保存的预设里反查预设名（截图里的「奇异果 / 铃兰 / 千岛2」那些）。
 * 预设结构见 types.ts ApiPreset：{ id, name, config: { baseUrl, apiKey, model } }。
 * 匹配不到（比如用的是没存成预设的临时配置）就回退成 host。
 */
function resolvePresetName(baseUrl: string, model: string): string {
    try {
        if (typeof localStorage === 'undefined') return hostOf(baseUrl);
        const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
        if (!raw) return hostOf(baseUrl);
        const presets = JSON.parse(raw);
        if (!Array.isArray(presets)) return hostOf(baseUrl);
        const normBase = stripTrailingSlash(baseUrl);
        // 优先 baseUrl + model 都对上；退而求其次只对 baseUrl
        const exact = presets.find((p: any) =>
            stripTrailingSlash(p?.config?.baseUrl || '') === normBase &&
            (p?.config?.model || '') === model);
        if (exact?.name) return exact.name;
        const byBase = presets.find((p: any) =>
            stripTrailingSlash(p?.config?.baseUrl || '') === normBase);
        if (byBase?.name) return byBase.name;
        return hostOf(baseUrl);
    } catch {
        return hostOf(baseUrl);
    }
}

/**
 * 记录一次 API 调用。fire-and-forget，绝不 throw / 阻塞主链路。
 * 在 safeFetchJson 里对 `/chat/completions` 的成功与失败都会调用。
 */
/** 从 OpenAI 兼容响应里抠 usage（各家代理大多遵循这个字段）。 */
export function extractApiTokenUsage(response: unknown): { prompt?: number; completion?: number; total?: number } {
    const root = response as any;
    const usage = root?.usage || root?.usage_metadata || root?.usageMetadata;
    if (!usage || typeof usage !== 'object') return {};
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
    return {
        prompt: num(usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokenCount),
        completion: num(usage.completion_tokens ?? usage.output_tokens ?? usage.candidatesTokenCount),
        total: num(usage.total_tokens ?? usage.totalTokenCount),
    };
}

/**
 * SSE 流式响应文本的兜底解析：扫 `data: {...}` 行，抠后端自报 model（首个非空）
 * 和 usage（取最后一个非空，OpenAI 约定 usage 在末尾 chunk）。
 * 拦截器 clone 出的流式响应 JSON.parse 必然失败，之前流式调用在记录里
 * 既没有 token 数也没有后端身份——这里补上。
 */
export function scanSseForLog(text: string): { model?: string; usage?: unknown } {
    let model: string | undefined;
    let usage: unknown;
    for (const line of text.split(/\r?\n/)) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        let chunk: any;
        try { chunk = JSON.parse(payload); } catch { continue; }
        if (!model && typeof chunk?.model === 'string' && chunk.model) model = chunk.model;
        if (chunk?.usage && typeof chunk.usage === 'object') usage = chunk.usage;
    }
    return { model, usage };
}

// ── 输入构成统计（promptBreakdown） ──────────────────────────────────────

/** 多模态 content 摊平成可计数文本（图片按占位符计，与 emotion eval 的展平口径一致）。 */
function contentToText(content: unknown): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content.map((part: any) => {
            if (part?.type === 'text') return part.text || '';
            if (part?.type === 'image_url') return '[图片]';
            return '';
        }).filter(Boolean).join(' ');
    }
    if (content == null) return '';
    try { return JSON.stringify(content) ?? ''; } catch { return String(content); }
}

const BLOCK_LABEL_MAX = 40;
/**
 * 块预览存全文（用户确认存储空间够）。展示层用 max-h + overflow 控制可视高度，
 * 存储侧不再截断。
 */
const PREVIEW_MAX_CHARS = Number.MAX_SAFE_INTEGER;

/** 行是块头？返回块名（`## / ### 标题` 或 `[System: …]`），否则 null。 */
const matchBlockHeader = (line: string): string | null => {
    const m = line.match(/^\s*#{2,3}\s+(.+?)\s*$/) || line.match(/^\s*(\[System:[^\]]*\])/);
    return m ? m[1].trim() : null;
};

/**
 * 计算哪些行是有效的 ``` 围栏开合线。围栏必须**成对**才生效：用户数据（记忆
 * 摘要等）里落单的半个 ``` 会把围栏状态永久翻转，后面所有块头全被吞进上一块
 * （实测：62K 的「记忆系统」行吞掉了对话历史+评估框架）。奇数个时最后一个不算。
 */
function fenceToggleLines(lines: string[]): Set<number> {
    const indices: number[] = [];
    lines.forEach((line, i) => { if (/^\s*```/.test(line)) indices.push(i); });
    if (indices.length % 2 === 1) indices.pop();
    return new Set(indices);
}

const WORLDBOOK_LABEL_RE = /世界书|world\s*book|worldbook|lore/i;

/** 世界书段的收尾：每条以 `---` 结束，整段末尾再多一个空行（见 formatWorldbookSection）。 */
const isWorldbookSectionEnd = (lines: string[], i: number): boolean =>
    lines[i].trim() === '---' && i + 1 < lines.length && lines[i + 1].trim() === '';

/**
 * 找出真正开新块的块头行（行号 → 块名）。两类标题行不算块头：
 * - ``` 围栏内的行：行为规范里的日记示例（`## 今天的小确幸` 等）都在代码块里。
 * - 世界书段里条目正文自带的标题：条目是用户写的，常带自己的 `##` 小标题，按它切会把
 *   一条设定拆成好几块，后半截还因为标题里没有「世界书」字样被归进「基础固定指令」。
 *   世界书段见到收尾才恢复切块；往后找不到收尾（不是 formatWorldbookSection 拼出来的段）
 *   就照常切，免得把后面的内容全吞进来。
 */
function findBlockHeaders(lines: string[]): Map<number, string> {
    const fenceAt = fenceToggleLines(lines);
    const headers = new Map<number, string>();
    let inFence = false;
    let worldbookEndLine = -1;
    for (let i = 0; i < lines.length; i++) {
        if (fenceAt.has(i)) inFence = !inFence;
        if (inFence || i <= worldbookEndLine) continue;
        const header = matchBlockHeader(lines[i]);
        if (!header) continue;
        headers.set(i, header);
        if (WORLDBOOK_LABEL_RE.test(header)) {
            for (let j = i + 1; j < lines.length; j++) {
                if (isWorldbookSectionEnd(lines, j)) { worldbookEndLine = j; break; }
            }
        }
    }
    return headers;
}

/**
 * 把一条 system 消息按块头切开（哪些行算块头见 findBlockHeaders）。
 * 一个块头都没有的短消息（双语 / MCP 尾部提醒等）整条算一块，取首行当名字。
 */
function splitSystemBlocks(text: string): PromptBlockStat[] {
    const out: PromptBlockStat[] = [];
    let label = '（开头·未分块部分）';
    let chars = 0;
    let buffer = ''; // 累积当前块原文，结束时存全文进 preview
    let sawHeader = false;
    // 模块：开头部分（人设）默认 character；未知块头继承上一块——这样用户在
    // 自己核心提示词里写的小标题会归到 character，不会散成 other。
    let mod: PromptModule = 'character';
    const lines = text.split('\n');
    const headers = findBlockHeaders(lines);
    const flush = () => {
        if (chars > 0) out.push({ label, chars, preview: buffer.slice(0, PREVIEW_MAX_CHARS) || undefined, module: mod, source: PROMPT_MODULE_INFO[mod].source });
        chars = 0;
        buffer = '';
    };
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const header = headers.get(i);
        if (header) {
            flush();
            label = header.slice(0, BLOCK_LABEL_MAX);
            mod = matchModuleForHeader(header) ?? mod;
            chars = line.length + 1;
            buffer = line + '\n';
            sawHeader = true;
        } else {
            chars += line.length + 1;
            // preview 还没满才追加，省得 buffer 无限增长
            if (buffer.length < PREVIEW_MAX_CHARS) {
                buffer += line + '\n';
            }
        }
    }
    flush();
    if (!sawHeader && out.length === 1) {
        const firstLine = text.trimStart().split('\n', 1)[0] || '(空 system)';
        // 无块头的短消息（MCP 尾部提醒等）：用首行当名字，并据此重新归属模块。
        const m = matchModuleForHeader(firstLine);
        out[0] = { ...out[0], label: firstLine.slice(0, BLOCK_LABEL_MAX), module: m ?? out[0].module, source: PROMPT_MODULE_INFO[m ?? out[0].module!].source };
    }
    return out;
}

/**
 * 已知的「写死的固定骨架」块名前缀（规则/格式/钢印类，内容不随用户数据变化）。
 * 构成面板的展示层把命中的块合并成一行「固定提示词」，突出真正能优化的数据块。
 * 新增固定提示词块时记得把块头加进来（漏加只是显示散一点，无功能影响）。
 */
const FIXED_PROMPT_LABEL_PREFIXES = [
    '聊天 App 行为规范',
    '表达底线',
    '🎤 语音消息功能',
    '关于对方的表达',
    '最后，回到你自己',
    '【音乐互动工具】',
    '关于《彼方》',
    '[MCP 工具 ON',
    '[Reminder:',
    // 思考链提示词（thinkingChainPrompt.ts）的章节头
    '语言铁律',
    '你不是在演',
    '起点:你本来在干嘛',
    '同时被激活的多个东西',
    '别急着安慰',
    '别造谣',
    '温度:脑内比嘴上更吵',
    'Thinking 写法总则',
];

export const isFixedPromptBlockLabel = (label: string): boolean =>
    FIXED_PROMPT_LABEL_PREFIXES.some(prefix => label.startsWith(prefix));

/**
 * 思考链提示词（thinkingChainPrompt.ts）的章节头前缀。
 * 这些块虽然是"固定写死的骨架"，但性质跟行为规范/表达底线不同——它们是
 * 引导模型做内心独白的元规则。构成面板把它们单独拆出来不合并，并打「思考链」
 * 胶囊标签，让人一眼看出 prompt 里有多少是思考链开销。
 */
const THINKING_CHAIN_LABEL_PREFIXES = [
    '语言铁律',
    '你不是在演',
    '起点:你本来在干嘛',
    '同时被激活的多个东西',
    '别急着安慰',
    '别造谣',
    '温度:脑内比嘴上更吵',
    'Thinking 写法总则',
];

export const isThinkingChainBlockLabel = (label: string): boolean =>
    THINKING_CHAIN_LABEL_PREFIXES.some(prefix => label.startsWith(prefix));

// ── 模块归属（按「块头结构」锚定，不用关键词 contains） ─────────────────────

/**
 * 提示词功能模块。每一块 system prompt 都有个结构化块头（### 标题 / [System:]），
 * 根据块头就能精确归属到哪个功能——这比“标签里含不含记忆二字”可靠得多（人设
 * 里写了“我记性很好”不会被当成记忆模块）。
 */
export type PromptModule =
    | 'character' | 'worldbook' | 'memory' | 'memo' | 'realtime' | 'schedule'
    | 'music' | 'group' | 'diary' | 'asset' | 'task' | 'jobhunt' | 'vr'
    | 'rules' | 'voice' | 'thinking' | 'recency' | 'mcp' | 'bilingual'
    | 'history_user' | 'history_assistant' | 'history_tool' | 'solo_prompt' | 'other';

/** 模块元数据：展示名 + 来源（回答"哪来的"）。 */
export const PROMPT_MODULE_INFO: Record<PromptModule, { name: string; source: string }> = {
    character:         { name: '角色人设',   source: 'context.ts · 角色设定' },
    worldbook:         { name: '世界书',     source: 'worldbook.ts' },
    memory:            { name: '记忆系统',   source: 'context.ts / memoryPalace' },
    memo:              { name: '备忘录',     source: 'memos.ts' },
    realtime:          { name: '实时状态',   source: 'RealtimeContext' },
    schedule:          { name: '日程',       source: 'context.ts · 日程' },
    music:             { name: '音乐氛围',   source: 'context.ts · 音乐' },
    group:             { name: '群聊背景',   source: 'chatPrompts · 群聊' },
    diary:             { name: '日记/笔记',  source: 'chatPrompts · 日记笔记' },
    asset:             { name: '经济直觉',   source: 'chatPrompts · 资产' },
    task:              { name: '时光契约',   source: 'taskPrompts' },
    jobhunt:           { name: '上岸计划',   source: 'jobDirectives' },
    vr:                { name: '彼方',       source: 'chatPrompts · 彼方' },
    rules:             { name: '规则/格式',  source: 'chatPrompts · 行为规范' },
    voice:             { name: '语音功能',   source: 'chatPrompts · 语音' },
    thinking:          { name: '思考链',     source: 'thinkingChainPrompt' },
    recency:           { name: '结尾钢印',   source: 'chatPrompts · 钢印' },
    mcp:               { name: 'MCP 工具',    source: 'MCP' },
    bilingual:         { name: '双语指令',   source: 'chatPrompts · 双语' },
    history_user:      { name: '历史·用户',  source: '消息历史' },
    history_assistant: { name: '历史·角色',  source: '消息历史' },
    history_tool:      { name: '历史·工具',  source: '消息历史' },
    solo_prompt:       { name: '任务提示词', source: '单条任务请求' },
    other:             { name: '其他',       source: '未归类' },
};

/**
 * 块头关键词 → 模块。注意：这里只匿配「块头」（结构化标题），不匿配正文，
 * 所以不会把正文里提到的词当成模块信号。顺序：更具体的在前。
 */
const HEADER_MODULE_TABLE: [PromptModule, string[]][] = [
    ['memory',    ['记忆宫殿', '记忆系统', '记忆摘要', '长期核心记忆', '当前激活的详细回忆', 'Memory Bank', 'Memory Palace', 'Memory Reference']],
    ['memo',      ['你的备忘录', '备忘录']],
    ['worldbook', ['世界书', '扩展设定集', 'Worldbook']],
    ['recency',   ['关于对方的表达', '最后，回到你自己']],
    ['voice',     ['语音消息功能']],
    ['vr',        ['关于《彼方》', '在《彼方》里', '彼方']],
    ['jobhunt',   ['求职工作台', '上岸计划']],
    ['task',      ['时光契约', '任务监督']],
    ['group',     ['群聊背景']],
    ['diary',     ['最近写的日记', '最近写的笔记']],
    ['asset',     ['经济与生活直觉']],
    ['music',     ['音乐互动工具', '正在听', '此刻在听']],
    ['schedule',  ['今日行程', '当前日程', '意识流']],
    ['realtime',  ['当前时间', '实时状态', 'Live Context', '今日特殊', 'Background Context']],
    ['mcp',       ['MCP 工具', 'MCP']],
    ['rules',     ['聊天 App 行为规范', '表达底线', 'Chat App Rules', 'Anti-Filler']],
    ['character', ['你的身份', '角色名', '核心指令', '内在认知', '世界观与设定', 'World Settings', 'Self Insights', '互动对象', '私密档案', 'Private Impression', 'Character', '底色认知', 'Resident Knowledge']],
];

/** 根据块头文本判定模块；认不出返回 null（由调用方决定继承/兜底）。 */
export function matchModuleForHeader(header: string): PromptModule | null {
    if (isThinkingChainBlockLabel(header)) return 'thinking';
    for (const [mod, keys] of HEADER_MODULE_TABLE) {
        if (keys.some(k => header.includes(k))) return mod;
    }
    return null;
}

/**
 * 输入构成块的分类 key（展示层用 CATEGORY_META 映射成胶囊标签 + 颜色）。
 * 判断顺序很关键：越具体的前缀匹配越要先判，contains 类（记忆/世界书/角色）放最后，
 * 否则会被"聊天历史·用户消息 ×N"这类聚合标签里的字面词带偏。
 */
export type PromptBlockCategory =
    | 'thinking' | 'rule' | 'memory' | 'worldbook' | 'character'
    | 'history_user' | 'history_assistant' | 'history_tool'
    | 'task' | 'other';

export function classifyPromptBlock(label: string): PromptBlockCategory {
    // 1. 思考链章节（最具体，先判）
    if (isThinkingChainBlockLabel(label)) return 'thinking';
    // 2. 合并后的固定块「固定提示词（规则/格式，共 N 块）」或任一 fixed 前缀
    if (label.startsWith('固定提示词（') || isFixedPromptBlockLabel(label)) return 'rule';
    // 3. 聚合历史消息（前缀精确匹配，避免 contains 误伤）
    if (label.startsWith('聊天历史·用户消息')) return 'history_user';
    if (label.startsWith('聊天历史·角色消息')) return 'history_assistant';
    if (label.startsWith('其他消息（tool')) return 'history_tool';
    // 4. 单条任务提示词
    if (label.startsWith('提示词整体「')) return 'task';
    // 5. contains 类（放最后）
    if (/记忆/.test(label)) return 'memory';
    if (/世界书|世界观/.test(label)) return 'worldbook';
    if (/角色|档案|人设|设定/.test(label)) return 'character';
    return 'other';
}

/**
 * 从 chat/completions 请求体算输入构成。解析不了 / 没有 messages 时返回 undefined。
 * system 逐块统计，历史消息按角色聚合（用户只关心"内置注入哪块肥"，不关心第几条历史）。
 */
export function buildPromptBreakdown(body: unknown): PromptBlockStat[] | undefined {
    try {
        let parsed: any = body;
        if (typeof body === 'string') {
            try { parsed = JSON.parse(body); } catch { return undefined; }
        }
        const messages = parsed?.messages;
        if (!Array.isArray(messages) || messages.length === 0) return undefined;

        const out: PromptBlockStat[] = [];
        let userChars = 0, userCount = 0, asstChars = 0, asstCount = 0, otherChars = 0, otherCount = 0;
        // 聚合消息的 preview：把多条消息原文拼起来存全文，让点开能看到实际聊了啥
        let userPreview = '', asstPreview = '', otherPreview = '';
        const appendPreview = (buf: string, text: string): string => {
            if (buf.length >= PREVIEW_MAX_CHARS) return buf;
            return buf + text.slice(0, PREVIEW_MAX_CHARS - buf.length) + '\n';
        };
        // 情绪评估等路径把「完整 system prompt + 展平历史 + 任务说明」整个打包成一条
        // user 消息发送——不拆的话构成面板只会显示「用户消息 ×1 · 100%」，看不出内里。
        // 巨型且含多个块头的 user 消息按 system 同款规则拆块；普通聊天消息不受影响。
        const HUGE_USER_MSG_SPLIT_CHARS = 8000;
        const countBlockHeaders = (text: string): number => findBlockHeaders(text.split('\n')).size;
        for (const msg of messages) {
            const text = contentToText(msg?.content);
            if (msg?.role === 'system') {
                out.push(...splitSystemBlocks(text));
            } else if (msg?.role === 'user') {
                if (text.length > HUGE_USER_MSG_SPLIT_CHARS && countBlockHeaders(text) >= 2) {
                    out.push(...splitSystemBlocks(text));
                } else {
                    userChars += text.length; userCount++;
                    userPreview = appendPreview(userPreview, text);
                }
            } else if (msg?.role === 'assistant') {
                asstChars += text.length; asstCount++;
                asstPreview = appendPreview(asstPreview, text);
            } else {
                otherChars += text.length; otherCount++;
                otherPreview = appendPreview(otherPreview, text);
            }
        }
        if (userCount) {
            // 记忆提取/日程生成/查手机等大量调用点是「单条 user 提示词」形态——
            // 标成"聊天历史"纯属误导，改用首行摘要让人一眼看出是什么任务。
            const soloPrompt = messages.length === 1 && userCount === 1;
            const firstLine = soloPrompt
                ? (contentToText(messages[0]?.content).trimStart().split('\n', 1)[0] || '').slice(0, BLOCK_LABEL_MAX)
                : '';
            out.push(soloPrompt
                ? { label: `提示词整体「${firstLine}」`, chars: userChars, preview: userPreview.trim() || undefined, module: 'solo_prompt', source: PROMPT_MODULE_INFO.solo_prompt.source }
                : { label: `聊天历史·用户消息 ×${userCount}`, chars: userChars, preview: userPreview.trim() || undefined, module: 'history_user', source: PROMPT_MODULE_INFO.history_user.source });
        }
        if (asstCount) out.push({ label: `聊天历史·角色消息 ×${asstCount}`, chars: asstChars, preview: asstPreview.trim() || undefined, module: 'history_assistant', source: PROMPT_MODULE_INFO.history_assistant.source });
        if (otherCount) out.push({ label: `其他消息（tool 等）×${otherCount}`, chars: otherChars, preview: otherPreview.trim() || undefined, module: 'history_tool', source: PROMPT_MODULE_INFO.history_tool.source });
        if (out.length === 0) return undefined;
        // 不再按块数截断成「其余 N 块合计」——展示层按模块合并成一条，块数自然收敛。
        return out;
    } catch {
        return undefined;
    }
}

function emitCaptureChange(status: 'armed' | 'idle' | 'saved' | 'error'): void {
    try {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(API_REQUEST_CAPTURE_EVENT, { detail: { status } }));
        }
    } catch { /* 诊断功能不能影响主流程 */ }
}

function readApiRequestCaptureArmed(): boolean {
    try {
        return typeof localStorage !== 'undefined' && localStorage.getItem(API_REQUEST_CAPTURE_ARMED_KEY) === '1';
    } catch {
        return false;
    }
}

// 关闭时的 LLM 热路径只读这个内存布尔值，不在每次请求上同步访问 localStorage。
let apiRequestCaptureArmed = readApiRequestCaptureArmed();

// 多标签页同步只发生在开关改变时，不给普通 API 调用增加监听或存储开销。
try {
    if (typeof window !== 'undefined') {
        window.addEventListener('storage', (event) => {
            if (event.key !== API_REQUEST_CAPTURE_ARMED_KEY) return;
            apiRequestCaptureArmed = event.newValue === '1';
            emitCaptureChange(apiRequestCaptureArmed ? 'armed' : 'idle');
        });
    }
} catch { /* 非浏览器 / 隐私模式兜底 */ }

export function isApiRequestCaptureArmed(): boolean {
    return apiRequestCaptureArmed;
}

export function setApiRequestCaptureArmed(armed: boolean): void {
    apiRequestCaptureArmed = armed;
    try {
        if (typeof localStorage !== 'undefined') {
            if (armed) localStorage.setItem(API_REQUEST_CAPTURE_ARMED_KEY, '1');
            else localStorage.removeItem(API_REQUEST_CAPTURE_ARMED_KEY);
        }
    } catch { /* localStorage 被禁用时静默失败 */ }
    emitCaptureChange(armed ? 'armed' : 'idle');
}

/** 同步抢占开关：同一页面里即使同时发出多个请求，也只有第一条能拿到抓包资格。 */
function claimApiRequestCapture(): boolean {
    if (!apiRequestCaptureArmed) return false;
    apiRequestCaptureArmed = false;
    try { localStorage.removeItem(API_REQUEST_CAPTURE_ARMED_KEY); } catch { /* 已在内存中关闭 */ }
    emitCaptureChange('idle');
    return true;
}

const INLINE_DATA_URL_LIMIT = 4096;

/**
 * 文字原样保存；超长 data URL 只保留类型和原始长度。
 * 这类内容通常是图片/音频二进制，并不是要排查的提示词正文，完整落库反而很容易触发配额上限。
 */
function sanitizeCapturePayload(value: unknown, stats: { binaryPlaceholders: number }): unknown {
    if (typeof value === 'string') {
        if (value.length > INLINE_DATA_URL_LIMIT && /^data:[^,]+,/i.test(value)) {
            stats.binaryPlaceholders++;
            const mime = value.slice(5, value.indexOf(';') > 0 ? value.indexOf(';') : value.indexOf(','));
            return `[${mime || 'binary'} data URL 正文未保存；原始 ${value.length.toLocaleString('en-US')} 字符]`;
        }
        return value;
    }
    if (Array.isArray(value)) return value.map(item => sanitizeCapturePayload(item, stats));
    if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
            out[key] = sanitizeCapturePayload(child, stats);
        }
        return out;
    }
    return value;
}

interface CaptureTextBlock {
    label: string;
    start: number;
    end: number;
}

/** 与普通统计使用相同标题规则，但额外保留正文位置，正文无需复制第二份。 */
function splitCaptureTextBlocks(text: string): CaptureTextBlock[] {
    const lines = text.split('\n');
    const headers = findBlockHeaders(lines);
    const lineStarts: number[] = [];
    let offset = 0;
    for (const line of lines) {
        lineStarts.push(offset);
        offset += line.length + 1;
    }

    const blocks: CaptureTextBlock[] = [];
    let start = 0;
    let label = '开头 / 未分区提示词';
    let sawHeader = false;
    for (let i = 0; i < lines.length; i++) {
        const header = headers.get(i);
        if (!header) continue;
        const headerStart = lineStarts[i];
        if (headerStart > start) blocks.push({ label, start, end: headerStart });
        start = headerStart;
        label = header.slice(0, BLOCK_LABEL_MAX);
        sawHeader = true;
    }
    if (start < text.length || text.length === 0) blocks.push({ label, start, end: text.length });
    if (!sawHeader && blocks.length === 1) {
        const firstLine = text.trimStart().split('\n', 1)[0]?.slice(0, BLOCK_LABEL_MAX);
        blocks[0].label = firstLine || '未命名提示词';
    }
    return blocks.filter(block => block.end > block.start || text.length === 0);
}

function captureKindForLabel(label: string): ApiRequestCaptureSectionKind {
    if (/记忆|回忆|召回|话题盒|memory|event\s*box|topic\s*box|事件盒/i.test(label)) return 'memory';
    if (WORLDBOOK_LABEL_RE.test(label)) return 'worldbook';
    if (/群聊|群组聊天|group\s*(?:chat|scene|conversation)/i.test(label)) return 'group';
    if (/完整对话|对话历史|历史对话|聊天历史|conversation\s*history|chat\s*history|dialogue\s*history/i.test(label)) return 'history';
    if (/角色|关系|状态|上下文|character|relationship|context/i.test(label)) return 'context';
    return 'system';
}

const CAPTURE_SOURCE_DESCRIPTIONS: Record<ApiRequestCaptureSectionKind, string> = {
    request: '请求配置：模型、采样参数、输出格式等顶层字段',
    tools: '功能或 MCP 注入给模型的工具定义',
    system: '当前功能的预设、规则或系统提示词',
    memory: '记忆系统召回后注入本次请求的内容',
    worldbook: '世界书命中后注入本次请求的设定',
    group: '近期群聊、群聊场景或公共聊天背景注入的内容',
    history: '随请求发送给模型的既往用户与角色对话内容',
    context: '角色资料、关系状态或实时环境上下文',
    user: '本轮用户输入，或功能发起任务时使用的用户提示词',
    assistant: '随上下文一起发送的历史角色回复',
    tool: '上一轮工具执行后返回给模型的结果',
};

export function getApiRequestCaptureSectionSource(section: ApiRequestCaptureSection): string {
    return section.source || CAPTURE_SOURCE_DESCRIPTIONS[section.kind] || '请求中的其他内容';
}

function jsonLength(value: unknown): number {
    try { return JSON.stringify(value)?.length ?? 0; } catch { return 0; }
}

/** 纯函数，供拦截器和测试共同使用。 */
export function buildApiRequestCapture(input: {
    url: string;
    body?: unknown;
    meta?: ApiCallMeta;
    capturedAt?: number;
}): ApiRequestCapture {
    let parsed: unknown = input.body;
    if (typeof input.body === 'string') {
        try { parsed = JSON.parse(input.body); } catch { parsed = { rawBody: input.body }; }
    }
    const stats = { binaryPlaceholders: 0 };
    const payload = sanitizeCapturePayload(parsed ?? null, stats);
    const body = payload && typeof payload === 'object' && !Array.isArray(payload)
        ? payload as Record<string, unknown>
        : { rawBody: payload };
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const sections: ApiRequestCaptureSection[] = [];
    const requestOptions = Object.fromEntries(Object.entries(body).filter(([key]) => key !== 'messages' && key !== 'tools'));
    if (Object.keys(requestOptions).length > 0) {
        sections.push({
            id: 'request-options',
            label: '请求参数',
            kind: 'request',
            chars: jsonLength(requestOptions),
            source: CAPTURE_SOURCE_DESCRIPTIONS.request,
            path: '请求体顶层（messages / tools 除外）',
        });
    }
    if (body.tools !== undefined) {
        sections.push({
            id: 'tool-definitions',
            label: '工具定义（tools）',
            kind: 'tools',
            chars: jsonLength(body.tools),
            source: CAPTURE_SOURCE_DESCRIPTIONS.tools,
            path: 'tools',
        });
    }

    messages.forEach((rawMessage, messageIndex) => {
        const message = rawMessage && typeof rawMessage === 'object' ? rawMessage as Record<string, unknown> : { content: rawMessage } as Record<string, unknown>;
        const role = typeof message.role === 'string' ? message.role : 'unknown';
        const content = message.content;
        const shouldSplit = typeof content === 'string' && (
            role === 'system' || (content.length > 8000 && splitCaptureTextBlocks(content).length > 1)
        );
        if (shouldSplit) {
            splitCaptureTextBlocks(content as string).forEach((block, blockIndex) => {
                const kind = captureKindForLabel(block.label);
                sections.push({
                    id: `message-${messageIndex}-block-${blockIndex}`,
                    label: block.label,
                    kind,
                    chars: block.end - block.start,
                    source: CAPTURE_SOURCE_DESCRIPTIONS[kind],
                    path: `messages[${messageIndex}].content · 分块 ${blockIndex + 1}`,
                    role,
                    messageIndex,
                    start: block.start,
                    end: block.end,
                });
            });
            return;
        }
        const roleKind: ApiRequestCaptureSectionKind =
            role === 'user' ? 'user' : role === 'assistant' ? 'assistant' : role === 'tool' ? 'tool' : 'system';
        const roleLabel = role === 'user' ? '用户消息' : role === 'assistant' ? '角色消息' : role === 'tool' ? '工具结果' : `${role} 消息`;
        sections.push({
            id: `message-${messageIndex}`,
            label: `${roleLabel} · 第 ${messageIndex + 1} 条`,
            kind: roleKind,
            chars: typeof content === 'string' ? content.length : jsonLength(content),
            source: CAPTURE_SOURCE_DESCRIPTIONS[roleKind],
            path: `messages[${messageIndex}].content`,
            role,
            messageIndex,
        });
    });

    const baseUrl = deriveBaseUrl(input.url);
    const model = extractModel(body);
    const meta = hasMeta(input.meta) ? { ...input.meta } : { ...ambientMeta };
    const capturedAt = input.capturedAt ?? Date.now();
    return {
        version: 1,
        id: `capture-${capturedAt}-${Math.random().toString(36).slice(2, 8)}`,
        capturedAt,
        baseUrl,
        presetName: resolvePresetName(baseUrl, model),
        model,
        meta,
        payload,
        totalChars: jsonLength(payload),
        usageStatus: 'pending',
        messageCount: messages.length,
        binaryPlaceholders: stats.binaryPlaceholders,
        sections,
    };
}

/** 展示层按索引从唯一 payload 中取正文，避免保存时把大提示词复制两份。 */
export function getApiRequestCaptureSectionContent(
    capture: ApiRequestCapture,
    section: ApiRequestCaptureSection,
): string {
    try {
        const body = capture.payload && typeof capture.payload === 'object' && !Array.isArray(capture.payload)
            ? capture.payload as Record<string, unknown>
            : { rawBody: capture.payload };
        if (section.kind === 'request') {
            return JSON.stringify(Object.fromEntries(Object.entries(body).filter(([key]) => key !== 'messages' && key !== 'tools')), null, 2);
        }
        if (section.kind === 'tools') return JSON.stringify(body.tools, null, 2);
        const messages = Array.isArray(body.messages) ? body.messages : [];
        const message = messages[section.messageIndex ?? -1] as any;
        if (!message) return '';
        const content = message?.content;
        if (typeof content === 'string') {
            if (section.start != null && section.end != null) return content.slice(section.start, section.end);
            return content;
        }
        return JSON.stringify(content, null, 2);
    } catch {
        return '';
    }
}

export interface ApiRequestCaptureDuplicateSummary {
    groups: number;
    repeatedSections: number;
    extraChars: number;
    examples: Array<{ label: string; occurrences: number; chars: number }>;
}

/**
 * 检查客户端实际请求里是否有完全相同的长文本被重复塞入。
 * 只比较正文分区，忽略请求参数/tools 和短句，避免把常见短提醒误报成提示词重复。
 */
export function summarizeApiRequestCaptureDuplicates(
    capture: ApiRequestCapture,
    minChars = 160,
): ApiRequestCaptureDuplicateSummary {
    const byContent = new Map<string, Array<ApiRequestCaptureSection>>();
    capture.sections.forEach(section => {
        if (section.kind === 'request' || section.kind === 'tools' || section.chars < minChars) return;
        const content = getApiRequestCaptureSectionContent(capture, section)
            .replace(/\r\n/g, '\n')
            .replace(/[ \t]+$/gm, '')
            .trim();
        if (content.length < minChars) return;
        const matches = byContent.get(content) || [];
        matches.push(section);
        byContent.set(content, matches);
    });

    const duplicates = [...byContent.entries()]
        .filter(([, sections]) => sections.length > 1)
        .map(([content, sections]) => ({
            label: sections[0].label,
            occurrences: sections.length,
            chars: content.length,
        }))
        .sort((a, b) => (b.chars * (b.occurrences - 1)) - (a.chars * (a.occurrences - 1)));

    return {
        groups: duplicates.length,
        repeatedSections: duplicates.reduce((sum, item) => sum + item.occurrences, 0),
        extraChars: duplicates.reduce((sum, item) => sum + item.chars * (item.occurrences - 1), 0),
        examples: duplicates.slice(0, 3),
    };
}

/** 生成适合用户直接发给开发者排查的可读 TXT；不额外落库，只在复制/下载时即时拼装。 */
export function formatApiRequestCaptureTxt(capture: ApiRequestCapture): string {
    const fmt = (value: number) => value.toLocaleString('en-US');
    const time = new Date(capture.capturedAt).toLocaleString('zh-CN', { hour12: false });
    const grouped = new Map<ApiRequestCaptureSectionKind, { chars: number; count: number }>();
    capture.sections.forEach(section => {
        const current = grouped.get(section.kind) || { chars: 0, count: 0 };
        current.chars += section.chars;
        current.count++;
        grouped.set(section.kind, current);
    });
    const classifiedChars = [...grouped.values()].reduce((sum, item) => sum + item.chars, 0) || 1;
    const duplicateSummary = summarizeApiRequestCaptureDuplicates(capture);
    const sourceRows = [...grouped.entries()]
        .sort((a, b) => b[1].chars - a[1].chars)
        .map(([kind, item], index) => {
            const pct = item.chars / classifiedChars * 100;
            return `${index + 1}. ${CAPTURE_SOURCE_DESCRIPTIONS[kind]}\n   ${fmt(item.chars)} 字符 · ${pct < 1 ? '<1' : Math.round(pct)}% · ${item.count} 个分区`;
        });

    const sectionRows = capture.sections.map((section, index) => {
        const content = getApiRequestCaptureSectionContent(capture, section);
        return [
            `===== 分区 ${index + 1}/${capture.sections.length} · ${section.label} =====`,
            `类型：${section.kind}`,
            `来源：${getApiRequestCaptureSectionSource(section)}`,
            `位置：${section.path || (section.messageIndex != null ? `messages[${section.messageIndex}]` : '请求体')}`,
            `大小：${fmt(section.chars)} 字符`,
            '',
            content || '（空内容）',
        ].join('\n');
    });

    return [
        'SullyOS·糯米机 · LLM 本次发送统计',
        '================================',
        `抓取时间：${time}`,
        `App：${capture.meta.appName || '—'}`,
        `用途：${capture.meta.purpose || '—'}`,
        `角色：${capture.meta.charName || '—'}`,
        `API：${capture.presetName || capture.baseUrl || '—'}`,
        `模型：${capture.model || '—'}`,
        `输入 Token（模型响应自报）：${capture.promptTokens != null ? fmt(capture.promptTokens) : capture.usageStatus === 'pending' ? '等待响应' : capture.usageStatus === 'failed' ? '请求失败，无法取得' : '接口未返回 usage'}`,
        `输出 Token：${capture.completionTokens != null ? fmt(capture.completionTokens) : '—'}`,
        `总 Token：${capture.totalTokens != null ? fmt(capture.totalTokens) : '—'}`,
        `请求体总字符（不是 Token）：${fmt(capture.totalChars)}`,
        `消息数：${capture.messageCount}`,
        `分区数：${capture.sections.length}`,
        capture.binaryPlaceholders > 0
            ? `二进制占位：${capture.binaryPlaceholders} 个（图片/音频正文未保存，已保留原始长度）`
            : '二进制占位：0',
        '',
        '===== 客户端发出前重复检查 =====',
        duplicateSummary.groups === 0
            ? '未发现完全相同的长文本被客户端重复发送。'
            : `发现 ${duplicateSummary.groups} 组完全相同的长文本；重复部分额外 ${fmt(duplicateSummary.extraChars)} 字符。`,
        '说明：这里只能证明客户端实际发出了什么，无法检查中转站收到请求后的二次拼接。',
        '',
        '===== 来源体积排行（按正文字符统计，不是 Token） =====',
        ...sourceRows,
        '',
        '===== 分区正文（按实际发送顺序） =====',
        ...sectionRows.flatMap(row => [row, '']),
        '===== 完整原始请求 JSON =====',
        JSON.stringify(capture.payload, null, 2),
        '',
        '提示：内容可能包含聊天、记忆和角色隐私，分享前请检查。',
    ].join('\n');
}

/** 抢占并保存下一次请求；成功时返回抓包 ID，未开启时返回 null。 */
let captureSaveInFlight: { id: string; promise: Promise<void> } | null = null;

export function captureApiRequestOnce(input: { url: string; body?: unknown; meta?: ApiCallMeta }): string | null {
    if (!claimApiRequestCapture()) return null;
    try {
        const capture = buildApiRequestCapture(input);
        const savePromise = import('./db').then(({ DB }) => DB.saveApiRequestCapture(capture));
        captureSaveInFlight = { id: capture.id, promise: savePromise };
        savePromise.then(
            () => emitCaptureChange('saved'),
            () => emitCaptureChange('error'),
        );
        return capture.id;
    } catch {
        emitCaptureChange('error');
        return null;
    }
}

/** 响应完整读完后，把同一次请求的真实 usage 回填到一次性抓包。 */
export function updateApiRequestCaptureUsage(input: {
    captureId: string | null;
    ok: boolean;
    response?: unknown;
    responseText?: string;
}): void {
    if (!input.captureId) return;
    try {
        let responseForUsage = input.response;
        if (responseForUsage === undefined && typeof input.responseText === 'string') {
            const scanned = scanSseForLog(input.responseText);
            if (scanned.usage) responseForUsage = { usage: scanned.usage };
        }
        const usage = extractApiTokenUsage(responseForUsage);
        const patch: Partial<ApiRequestCapture> = {
            promptTokens: usage.prompt,
            completionTokens: usage.completion,
            totalTokens: usage.total,
            usageStatus: !input.ok ? 'failed' : usage.prompt != null ? 'reported' : 'not-reported',
        };
        const pending = captureSaveInFlight?.id === input.captureId
            ? captureSaveInFlight.promise.catch(() => {})
            : Promise.resolve();
        pending
            .then(() => import('./db'))
            .then(({ DB }) => DB.patchApiRequestCapture(input.captureId!, patch))
            .then(updated => { if (updated) emitCaptureChange('saved'); })
            .catch(() => emitCaptureChange('error'));
    } catch {
        emitCaptureChange('error');
    }
}

export function recordApiCall(input: {
    /** 同一条 HTTP 请求在显式记录与全局 fetch 兜底间共享的 ID，用于原子去重。 */
    requestId?: string;
    url: string;
    body?: unknown;
    status?: number;
    ok: boolean;
    response?: unknown;
    /** 响应原始文本（JSON.parse 失败时传入，供 SSE 兜底解析 model / usage） */
    responseText?: string;
    meta?: ApiCallMeta;
    durationMs?: number;
}): void {
    try {
        const baseUrl = deriveBaseUrl(input.url);
        const model = extractModel(input.body);
        // 显式 meta 优先（safeFetchJson 各调用点传的精确信息）；没有就用环境兜底（裸 fetch）。
        const meta = hasMeta(input.meta) ? input.meta! : ambientMeta;
        // 整包 JSON 直接读；流式响应（response 为空但有原始文本）走 SSE 兜底扫描
        let responseForExtract: unknown = input.response;
        let backendModel: string | undefined =
            typeof (input.response as any)?.model === 'string' && (input.response as any).model
                ? (input.response as any).model : undefined;
        if (input.response === undefined && typeof input.responseText === 'string' && input.responseText.trimStart().startsWith('data:')) {
            const scanned = scanSseForLog(input.responseText);
            backendModel = scanned.model;
            if (scanned.usage) responseForExtract = { usage: scanned.usage };
        }
        const usage = extractApiTokenUsage(responseForExtract);
        const entry: ApiCallLogEntry = {
            id: input.requestId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: Date.now(),
            presetName: resolvePresetName(baseUrl, model),
            baseUrl,
            model,
            backendModel,
            status: input.status,
            ok: input.ok,
            promptTokens: usage.prompt,
            completionTokens: usage.completion,
            totalTokens: usage.total,
            durationMs: input.durationMs,
            promptBreakdown: buildPromptBreakdown(input.body),
            appId: meta.appId,
            appName: meta.appName,
            charId: meta.charId,
            charName: meta.charName,
            purpose: meta.purpose,
            recalledMemories: meta.recalledMemories,
        };
        // 动态 import 避开 safeApi ↔ db 的潜在加载顺序问题；写库失败静默吞掉。
        import('./db')
            .then(({ DB }) => DB.appendApiCallLog(entry))
            .catch(() => {});
    } catch {
        // best-effort：任何异常都不影响主请求
    }
}

// ── 交给云端跑的那一轮 ────────────────────────────────────────────────
//
// 这条路上本地只发一个 POST 给用户自己的 Worker，真正那条 `/chat/completions` 是云端
// 发的——全局 fetch 拦截器只认 `/chat/completions`，够不着它。不专门记的话，开了即时
// 对话之后「API 调用记录」里聊天这一格就是空的，看着像调用凭空消失了。
//
// 同一条记录分两笔写（DB 层按 id 合并非空字段，见 appendApiCallLog）：
//   1. 云端受理时先落一笔——那会儿只知道「发给谁、用哪个模型、发过去些什么」；
//   2. 回复回来时把 Token 补上（云端随最后一条推送捎回来）。
// 中间这段时间记录是 pending，界面上写「云端生成中」。

/** 云端那一轮在本地日志里的记录 id。两笔写入靠它对上号，所以两边都从 uuid 现算。 */
export const cloudApiCallLogId = (uuid: string): string => `cloud-${uuid}`;

/** 第一笔：云端收下了这一轮。 */
export function recordCloudApiCall(input: {
    id: string;
    route: ApiCallRoute;
    /** 预设里存的那个形态（`https://host/v1`），云端就用这份凭据去发请求。 */
    baseUrl: string;
    model: string;
    /** 交上去的消息数组，用来算输入构成。 */
    messages: unknown;
    meta?: ApiCallMeta;
    timestamp?: number;
    /**
     * 这一轮连交都没交上去（POST 就失败了）。这种记录当场就是终态，不等回填——
     * 云端根本没收下，不会有回复也不会有用量。输入构成照记：上传超时这类失败正是
     * 「这次包太大了」的直接线索。
     */
    sendFailed?: boolean;
}): void {
    try {
        const baseUrl = stripTrailingSlash(input.baseUrl || '');
        const meta = hasMeta(input.meta) ? input.meta! : ambientMeta;
        const entry: ApiCallLogEntry = {
            id: input.id,
            timestamp: input.timestamp ?? Date.now(),
            route: input.route,
            pending: !input.sendFailed,
            presetName: resolvePresetName(baseUrl, input.model),
            baseUrl,
            model: input.model,
            // 受理成功本身没出错；这一轮的成败等回填那一笔改写。
            ok: !input.sendFailed,
            promptBreakdown: buildPromptBreakdown({ messages: input.messages }),
            appId: meta.appId,
            appName: meta.appName,
            charId: meta.charId,
            charName: meta.charName,
            purpose: meta.purpose,
        };
        import('./db')
            .then(({ DB }) => DB.appendApiCallLog(entry))
            .catch(() => {});
    } catch {
        // 同 recordApiCall：记日志不能反过来影响这一轮对话
    }
}

/**
 * 第二笔：云端那一轮有结论了。
 *
 * 只写这次才知道的字段，`timestamp` 一个字都不带——记录的时间要停在「发起那一刻」，
 * 不然列表顺序会随着回复先后跳来跳去。第一笔已经被 5 天裁剪掉时这一笔会落空（合并不
 * 上、又没有时间戳，写库时当场被裁掉），正是想要的收场。
 */
export function settleCloudApiCall(input: {
    id: string;
    ok: boolean;
    promptTokens?: number;
    completionTokens?: number;
    /** 见 ApiCallLogEntry.tokensPartial。 */
    tokensPartial?: boolean;
    /** 见 ApiCallLogEntry.superseded。 */
    superseded?: boolean;
}): void {
    try {
        const { promptTokens, completionTokens } = input;
        const patch: Partial<ApiCallLogEntry> & { id: string } = {
            id: input.id,
            pending: false,
            ok: input.ok,
            superseded: input.superseded || undefined,
            promptTokens,
            completionTokens,
            // 云端只报入和出两个数，总数这边自己加——列表顶上的合计读的是这个字段。
            totalTokens: promptTokens != null && completionTokens != null
                ? promptTokens + completionTokens
                : undefined,
            tokensPartial: input.tokensPartial || undefined,
        };
        import('./db')
            .then(({ DB }) => DB.appendApiCallLog(patch))
            .catch(() => {});
    } catch {
        // 同上
    }
}
