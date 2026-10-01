import { describe, expect, it } from 'vitest';
import {
  classifyOverdueTasks,
  judgeOverdueTasks,
  type TickTaskFacts,
} from './amsgTickReport';

const NOW = Date.parse('2026-09-18T12:00:00.000Z');
const minutesAgo = (n: number) => NOW - n * 60_000;
const minutesLater = (n: number) => NOW + n * 60_000;

/** 一条「建好就没人碰过」的任务，按需覆盖字段。 */
const task = (overrides: Partial<TickTaskFacts> = {}): TickTaskFacts => ({
  nextSendAtMs: minutesAgo(40),
  createdAtMs: minutesAgo(120),
  updatedAtMs: minutesAgo(120),
  retryAfterMs: null,
  leaseUntilMs: null,
  currentErrorAtMs: null,
  serializeKey: 'char-a',
  ...overrides,
});

const classifyOne = (facts: TickTaskFacts) => classifyOverdueTasks([facts], NOW)[0];

describe('classifyOverdueTasks — 一条过期任务现在算哪种情况', () => {
  /**
   * 回归守卫：重试期间任务的到点时刻不会往后挪，一条在正常重试的任务「晚了四十分钟」
   * 很平常。只看晚了多久的话，它会被报成「定时触发器可能没在跑」。
   */
  it('在等重试的不算卡住，哪怕到点已经很久了', () => {
    const verdict = classifyOne(task({
      retryAfterMs: minutesLater(4),
      currentErrorAtMs: minutesAgo(2),
      updatedAtMs: minutesAgo(2) + 30,
    }));
    expect(verdict.state).toBe('retry-wait');
    expect(verdict.stuck).toBe(false);
    // 记失败那一笔和 updated_at 是前后脚写的，不能当成「后来又开跑了一次」。
    expect(verdict.lastStartedAtMs).toBeNull();
  });

  it('重试时间刚到、下一跳还没来，不算卡住（要从重试时刻起算，不是从到点起算）', () => {
    const verdict = classifyOne(task({
      retryAfterMs: minutesAgo(1),
      currentErrorAtMs: minutesAgo(5),
      updatedAtMs: minutesAgo(5),
    }));
    expect(verdict.state).toBe('ready');
    expect(verdict.stuck).toBe(false);
  });

  it('到点很久一直没人领 → 卡住', () => {
    const verdict = classifyOne(task());
    expect(verdict.state).toBe('ready');
    expect(verdict.stuck).toBe(true);
    expect(verdict.unfinishedAttempt).toBe(false);
  });

  it('刚到点一两分钟不算卡住——cron 一分钟一跳', () => {
    expect(classifyOne(task({ nextSendAtMs: minutesAgo(1) })).stuck).toBe(false);
  });

  it('开跑过、租约自己到期、行上什么都没留下 → 半路没了，算卡住', () => {
    const verdict = classifyOne(task({
      updatedAtMs: minutesAgo(38),
      leaseUntilMs: minutesAgo(36),
    }));
    expect(verdict.state).toBe('ready');
    expect(verdict.unfinishedAttempt).toBe(true);
    expect(verdict.lastStartedAtMs).toBe(minutesAgo(38));
    expect(verdict.stuck).toBe(true);
  });

  it('失败过一次、重试时刻到了之后又开跑、然后没了下文 → 也认得出来', () => {
    const verdict = classifyOne(task({
      currentErrorAtMs: minutesAgo(20),
      retryAfterMs: minutesAgo(18),
      updatedAtMs: minutesAgo(17),
      leaseUntilMs: minutesAgo(15),
    }));
    expect(verdict.unfinishedAttempt).toBe(true);
    expect(verdict.stuck).toBe(true);
  });

  it('刚建好的任务（建的时刻就是到点时刻）不算开跑过', () => {
    const verdict = classifyOne(task({
      nextSendAtMs: minutesAgo(1),
      createdAtMs: minutesAgo(1) + 5,
      updatedAtMs: minutesAgo(1) + 5,
    }));
    expect(verdict.lastStartedAtMs).toBeNull();
    expect(verdict.unfinishedAttempt).toBe(false);
  });

  it('到点就开跑、正在发 → 正常', () => {
    const verdict = classifyOne(task({
      nextSendAtMs: minutesAgo(7),
      updatedAtMs: minutesAgo(7) + 20_000,
      leaseUntilMs: minutesLater(1),
    }));
    expect(verdict.state).toBe('sending');
    expect(verdict.lateStart).toBe(false);
    expect(verdict.stuck).toBe(false);
  });

  it('正在发，但到点半小时后才开跑 → 标出来开跑晚了（前面那段没被正常处理）', () => {
    const verdict = classifyOne(task({
      updatedAtMs: minutesAgo(10),
      leaseUntilMs: minutesLater(1),
    }));
    expect(verdict.state).toBe('sending');
    expect(verdict.lateStart).toBe(true);
    expect(verdict.stuck).toBe(false);
  });

  it('同一个角色另一条正在发 → 这条在排队，不算卡住', () => {
    const [sending, waiting] = classifyOverdueTasks([
      task({ nextSendAtMs: minutesAgo(9), updatedAtMs: minutesAgo(9), leaseUntilMs: minutesLater(1) }),
      task({ nextSendAtMs: minutesAgo(8) }),
    ], NOW);
    expect(sending.state).toBe('sending');
    expect(waiting.queuedBehind).toBe(true);
    expect(waiting.stuck).toBe(false);
  });

  it('正在发的是别的角色 → 不算排队，照样卡住', () => {
    const [, waiting] = classifyOverdueTasks([
      task({ serializeKey: 'char-b', updatedAtMs: minutesAgo(9), leaseUntilMs: minutesLater(1), nextSendAtMs: minutesAgo(9) }),
      task({ nextSendAtMs: minutesAgo(8) }),
    ], NOW);
    expect(waiting.queuedBehind).toBe(false);
    expect(waiting.stuck).toBe(true);
  });

  it('解不开任务内容（没有分组键）时不瞎猜排队', () => {
    const [, waiting] = classifyOverdueTasks([
      task({ serializeKey: null, updatedAtMs: minutesAgo(9), leaseUntilMs: minutesLater(1), nextSendAtMs: minutesAgo(9) }),
      task({ serializeKey: null, nextSendAtMs: minutesAgo(8) }),
    ], NOW);
    expect(waiting.queuedBehind).toBe(false);
    expect(waiting.stuck).toBe(true);
  });
});

describe('judgeOverdueTasks — 合起来算什么状态', () => {
  const verdictOf = (facts: TickTaskFacts) => classifyOne(facts);

  it('有卡住的就是 stalled', () => {
    expect(judgeOverdueTasks([
      { verdict: verdictOf(task()), hasCurrentError: false },
      { verdict: verdictOf(task({ retryAfterMs: minutesLater(2), currentErrorAtMs: minutesAgo(1) })), hasCurrentError: true },
    ])).toBe('stalled');
  });

  it('只是在失败重试 → failing（有问题，但跟定时触发器无关）', () => {
    expect(judgeOverdueTasks([
      { verdict: verdictOf(task({ retryAfterMs: minutesLater(2), currentErrorAtMs: minutesAgo(1) })), hasCurrentError: true },
    ])).toBe('failing');
  });

  it('开跑晚得不正常 → failing', () => {
    expect(judgeOverdueTasks([
      { verdict: verdictOf(task({ updatedAtMs: minutesAgo(10), leaseUntilMs: minutesLater(1) })), hasCurrentError: false },
    ])).toBe('failing');
  });

  it('都在正常处理 → healthy', () => {
    expect(judgeOverdueTasks([])).toBe('healthy');
    expect(judgeOverdueTasks([
      { verdict: verdictOf(task({ nextSendAtMs: minutesAgo(1) })), hasCurrentError: false },
    ])).toBe('healthy');
  });
});
