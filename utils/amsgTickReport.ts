// ─── 定时任务细账（Worker 的 GET /tick-report）───
//
// 体检里「定时任务」那一行，光靠 /debug 只拿得到两个数：几条到点没发、最老的晚了多久。
// 同样是晚了四十分钟，背后可能是：
//
//   - 在等第三次重试，失败原因明明白白记在任务行上；
//   - 每次一开跑就被 Cloudflare 掐掉，什么都没来得及记；
//   - 同一个角色另一条任务正在发，这条在排队；
//   - 每分钟那一跳一开头就挂了，一条都没碰到。
//
// 这几种该做的事完全不同，所以细账要把「现在算哪种」判出来，连同报错原文一起交给前端。
//
// 这份文件是 Worker 和前端共用的那一半：回执的形状，和「一条过期任务现在算哪种情况」的
// 判定（纯函数，测试钉在 amsgTickReport.test.ts）。读库、解密、记整轮报错那一半在
// worker/amsg/src/tickReport.ts。

/** 最老那条到点多久还没人处理，就算定时任务卡住了。cron 一分钟一跳，留足余量。 */
export const TICK_STALL_MS = 5 * 60_000;

/**
 * 「这次开跑」比「可以开跑」晚了这么久，就说明中间那段时间没被正常处理过
 * （之前开跑过又没了下文，或者那几跳根本没来）。cron 一分钟一跳，留两跳余量再加一分钟。
 */
export const LATE_START_MS = 3 * 60_000;

/**
 * 上游收尾时 last_error.at 和行的 updated_at 是前后脚写的，差几毫秒到几秒。
 * 在这个范围内的两个时刻算同一件事，不能把「记失败那一笔」误认成「后来又开跑了一次」。
 */
const SAME_WRITE_TOLERANCE_MS = 5_000;

/** 整轮报错多久没再出现，就当那一串已经停了。cron 一分钟一跳，隔两跳没再报就算停。 */
export const TICK_FAILURE_SERIES_GAP_MS = 3 * 60_000;

// ─── 判定 ───

/** 判定一条过期任务要用到的事实，全是任务行上的明文列（时刻一律 epoch 毫秒）。 */
export interface TickTaskFacts {
  nextSendAtMs: number;
  createdAtMs: number | null;
  updatedAtMs: number | null;
  retryAfterMs: number | null;
  leaseUntilMs: number | null;
  /**
   * 这一次到点留下的失败记录是什么时候写的。只认 occurrence 对得上 next_send_at 的那条：
   * 循环任务上一次到点的旧账不算这一次的事。
   */
  currentErrorAtMs: number | null;
  /** 串行分组键（同一个角色的聊天任务一组，见 worker 的 amsgSerializeKey）。解不开任务内容时为 null。 */
  serializeKey: string | null;
}

/**
 * 这条任务此刻在干什么。
 *
 * - `sending`：正在发（租约还没到期）。
 * - `retry-wait`：失败过，在等下一次重试。
 * - `ready`：随时可以开跑，等着下一跳来领。
 */
export type TickTaskState = 'sending' | 'retry-wait' | 'ready';

export interface TickTaskVerdict {
  state: TickTaskState;
  /** 最近一次开跑的时刻（晚于最后一条失败记录的那次）。这次到点还没开跑过为 null。 */
  lastStartedAtMs: number | null;
  /** 开跑过，没发完，也没留下失败原因。多半是跑到一半被平台掐掉了。 */
  unfinishedAttempt: boolean;
  /** 正在发，但这次开跑比「可以开跑」晚了好几跳：前面那段时间没被正常处理。 */
  lateStart: boolean;
  /** 同一个角色另一条任务正在发，这条在排队。 */
  queuedBehind: boolean;
  /** 真卡住了：一直没人来领，或者领了又没了下文。 */
  stuck: boolean;
}

/**
 * 给一批过期任务逐条判定现在算哪种情况。
 *
 * 要整批一起判，是因为「排队」只有放在一起才看得出来：同一个角色同时只跑一条，另一条
 * 正在发的话，这条等多久都是正常的，不能报成卡住。
 *
 * 判定只看行上的明文列，不看 last_error 的措辞。关键的几个事实：
 *
 * - `next_send_at` 在重试期间一直是名义时刻，**不会**被推后，所以「晚了多久」不能直接当
 *   「卡了多久」用；可以开跑的时刻要取它和 `retry_after` 里更晚的那个。
 * - 开跑（占位）会刷新 `updated_at`，续租不会。所以 `updated_at` 晚于创建时刻、到点时刻和
 *   最后一条失败记录，就说明那之后又开跑过一次。
 * - 正常收尾一定会写库：发完删行或推进排期，失败写 `last_error` 并放掉租约。租约自己
 *   到期、行上却什么都没留下，只能是开跑的那个进程半路没了。
 */
export const classifyOverdueTasks = (tasks: TickTaskFacts[], nowMs: number): TickTaskVerdict[] => {
  const verdicts = tasks.map((task): TickTaskVerdict & { readySinceMs: number } => {
    const state: TickTaskState = task.leaseUntilMs !== null && task.leaseUntilMs > nowMs
      ? 'sending'
      : task.retryAfterMs !== null && task.retryAfterMs > nowMs
        ? 'retry-wait'
        : 'ready';

    const readySinceMs = Math.max(task.nextSendAtMs, task.retryAfterMs ?? -Infinity);
    const lastSettledMs = Math.max(
      task.nextSendAtMs,
      (task.createdAtMs ?? -Infinity) + SAME_WRITE_TOLERANCE_MS,
      (task.currentErrorAtMs ?? -Infinity) + SAME_WRITE_TOLERANCE_MS,
    );
    const lastStartedAtMs = task.updatedAtMs !== null && task.updatedAtMs > lastSettledMs
      ? task.updatedAtMs
      : null;

    const unfinishedAttempt = state === 'ready' && lastStartedAtMs !== null;
    const lateStart = state === 'sending'
      && lastStartedAtMs !== null
      && lastStartedAtMs - readySinceMs > LATE_START_MS;
    const waitedTooLong = state === 'ready' && nowMs - readySinceMs >= TICK_STALL_MS;

    return {
      state,
      readySinceMs,
      lastStartedAtMs,
      unfinishedAttempt,
      lateStart,
      queuedBehind: false,
      stuck: unfinishedAttempt || waitedTooLong,
    };
  });

  return verdicts.map(({ readySinceMs: _readySinceMs, ...verdict }, index) => {
    // 半路没了的那种不算排队：它自己就开跑过，等的不是别人。
    if (verdict.state !== 'ready' || verdict.unfinishedAttempt) return verdict;
    const key = tasks[index].serializeKey;
    if (!key) return verdict;
    const blocked = verdicts.some((other, otherIndex) =>
      otherIndex !== index && other.state === 'sending' && tasks[otherIndex].serializeKey === key);
    return blocked ? { ...verdict, queuedBehind: true, stuck: false } : verdict;
  });
};

/**
 * 整批任务合起来，定时任务这一项算什么状态。
 *
 * - `stalled`：有任务卡住了（没人领 / 领了没下文）。
 * - `failing`：没卡住，但有任务在失败重试，或者这次开跑晚得不正常。
 * - `healthy`：都在正常处理（正在发、刚到点等下一跳、排队）。
 */
export const judgeOverdueTasks = (
  tasks: { verdict: TickTaskVerdict; hasCurrentError: boolean }[],
): 'stalled' | 'failing' | 'healthy' => {
  if (tasks.some((task) => task.verdict.stuck)) return 'stalled';
  if (tasks.some((task) => task.hasCurrentError || task.verdict.lateStart)) return 'failing';
  return 'healthy';
};

// ─── 回执形状 ───

/** 任务行上 last_error 的内容（上游写的，reason 已脱敏、最长 500 字）。 */
export interface AmsgTaskErrorRecord {
  /** 这条记录写下的时刻（ISO）。 */
  at: string | null;
  /** 记的是哪一次到点（ISO）。 */
  occurrence: string | null;
  /** 报错原文（脱敏后）。过期跳过时是字面量 `stale`。 */
  reason: string;
  /** 底层错误的稳定 code，如 `LLM_CALL_FAILED`。 */
  errorCode: string | null;
  /** 推送服务回的 HTTP 状态码。 */
  pushStatus: number | null;
}

/** 一条到点还没发出去的任务。 */
export interface AmsgTickReportTask {
  uuid: string;
  /** 解不开任务内容（主密钥不对之类）时为 null，下同。 */
  charId: string | null;
  contactName: string | null;
  /** 后台任务的种类（metadata.amsgKind）；聊天任务为 null。 */
  kind: string | null;
  /** `instant` = 即时对话的回复，其余是定时 / 主动消息。 */
  messageType: string | null;
  nextSendAt: string;
  state: TickTaskState;
  stuck: boolean;
  retryCount: number;
  retryAfter: string | null;
  lastStartedAt: string | null;
  unfinishedAttempt: boolean;
  lateStart: boolean;
  queuedBehind: boolean;
  /** 这一次到点留下的失败记录；还没失败过为 null。 */
  lastError: AmsgTaskErrorRecord | null;
}

/** 最近彻底没发出去的一次（一次性任务标成失败，或循环任务跳过了这一次）。 */
export interface AmsgTickReportFailure {
  uuid: string;
  charId: string | null;
  contactName: string | null;
  kind: string | null;
  messageType: string | null;
  /** `failed` = 一次性任务不会再发了；`skipped` = 循环任务跳过这一次，下次照常。 */
  outcome: 'failed' | 'skipped';
  error: AmsgTaskErrorRecord;
}

/**
 * 每分钟那一跳自己出的错（不落在任何一条任务上的那种）。
 *
 * 连着出现的同一种错合并成一串，只记第一次、最后一次和次数——每分钟挂一次的话，
 * 用户要知道的是「从几点开始一直在挂」，不是一千四百条一样的记录。
 */
export interface AmsgTickFailureRecord {
  /**
   * 挂在哪一步：`config` 读配置、`tick` 整轮处理；任务写库失败时是上游的收尾状态
   * （`claim_failed` / `retry_update_failed` / `stale_update_failed` / `post_send_cleanup_failed…`）。
   */
  stage: string;
  name: string;
  /** 报错原文（上游同一套脱敏，最长 500 字）。 */
  message: string;
  code: string | null;
  firstAt: string;
  lastAt: string;
  count: number;
  /** 最后一次离现在不到两跳：多半还在挂。 */
  ongoing: boolean;
}

export interface AmsgTickReport {
  now: string;
  /** 到点还没发出去的任务，按该发的时刻从早到晚。 */
  tasks: AmsgTickReportTask[];
  /** 最近 24 小时彻底没发出去的，最近的在前。即时对话的不在这里（聊天界面自己会说）。 */
  recentFailures: AmsgTickReportFailure[];
  tickFailure: AmsgTickFailureRecord | null;
  /** 过期任务太多、没列全。 */
  truncated: boolean;
}

// ─── 前端认回执 ───

const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);
const finiteOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const parseErrorRecord = (raw: unknown): AmsgTaskErrorRecord | null => {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const reason = str(value.reason);
  if (!reason) return null;
  return {
    at: str(value.at),
    occurrence: str(value.occurrence),
    reason,
    errorCode: str(value.errorCode),
    pushStatus: finiteOrNull(value.pushStatus),
  };
};

const TASK_STATES: TickTaskState[] = ['sending', 'retry-wait', 'ready'];

/**
 * 认一份 GET /tick-report 回执，形状对不上返回 null。
 *
 * 单条任务形状不对就跳过那一条，不整份作废：列表里有一条读不懂，不该连带把
 * 整轮报错那段原文也吞掉——那恰恰是用户最需要的。
 */
export const parseAmsgTickReport = (body: unknown): AmsgTickReport | null => {
  const data = (body as { success?: unknown; data?: Record<string, unknown> } | null)?.data;
  if (!data || typeof data !== 'object') return null;
  if (!Array.isArray(data.tasks) || !Array.isArray(data.recentFailures)) return null;

  const tasks = data.tasks.flatMap((raw): AmsgTickReportTask[] => {
    const value = raw as Record<string, unknown> | null;
    const uuid = str(value?.uuid);
    const nextSendAt = str(value?.nextSendAt);
    const state = value?.state as TickTaskState;
    if (!value || !uuid || !nextSendAt || !TASK_STATES.includes(state)) return [];
    return [{
      uuid,
      charId: str(value.charId),
      contactName: str(value.contactName),
      kind: str(value.kind),
      messageType: str(value.messageType),
      nextSendAt,
      state,
      stuck: value.stuck === true,
      retryCount: finiteOrNull(value.retryCount) ?? 0,
      retryAfter: str(value.retryAfter),
      lastStartedAt: str(value.lastStartedAt),
      unfinishedAttempt: value.unfinishedAttempt === true,
      lateStart: value.lateStart === true,
      queuedBehind: value.queuedBehind === true,
      lastError: parseErrorRecord(value.lastError),
    }];
  });

  const recentFailures = data.recentFailures.flatMap((raw): AmsgTickReportFailure[] => {
    const value = raw as Record<string, unknown> | null;
    const uuid = str(value?.uuid);
    const error = parseErrorRecord(value?.error);
    const outcome = value?.outcome;
    if (!value || !uuid || !error || (outcome !== 'failed' && outcome !== 'skipped')) return [];
    return [{
      uuid,
      charId: str(value.charId),
      contactName: str(value.contactName),
      kind: str(value.kind),
      messageType: str(value.messageType),
      outcome,
      error,
    }];
  });

  const rawFailure = data.tickFailure as Record<string, unknown> | null | undefined;
  const tickFailure: AmsgTickFailureRecord | null = rawFailure
    && str(rawFailure.stage) && str(rawFailure.message) && str(rawFailure.firstAt) && str(rawFailure.lastAt)
    ? {
      stage: rawFailure.stage as string,
      name: str(rawFailure.name) || 'Error',
      message: rawFailure.message as string,
      code: str(rawFailure.code),
      firstAt: rawFailure.firstAt as string,
      lastAt: rawFailure.lastAt as string,
      count: finiteOrNull(rawFailure.count) ?? 1,
      ongoing: rawFailure.ongoing === true,
    }
    : null;

  return {
    now: str(data.now) || new Date().toISOString(),
    tasks,
    recentFailures,
    tickFailure,
    truncated: data.truncated === true,
  };
};
