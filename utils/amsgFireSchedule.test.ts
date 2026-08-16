import { describe, it, expect } from 'vitest';
import {
  AMSG_FIRE_SCHEDULE_TOOL,
  EXPIRE_POLICY_DESCRIPTION,
  MIN_SCHEDULE_LEAD_MS,
  buildFireScheduleBlock,
  buildFireScheduleTool,
  buildSelfScheduleUuid,
  buildSendAtExample,
  buildTaskInstruction,
  extractFireScheduleTextCalls,
  parseFireScheduleArgs,
  resolveFireTargetTask,
} from './amsgFireSchedule';
import { shortTaskId } from './amsg2Tasks';

const NOW = Date.UTC(2026, 6, 30, 12, 0);
const inMinutes = (n: number) => new Date(NOW + n * 60_000).toISOString();
/** 角色的时间参照系是必填的（fire_pack 的 tzId）；与时区无关的用例统一给 UTC。 */
const TZ = { tzId: 'UTC' };

// 参数是模型现写的，写歪是常态。这里每一条打回都必须是「能照着改」的一句话——
// 回一个裸错误码的话，模型下一轮多半原样再试一次，白烧一轮预算。
describe('parseFireScheduleArgs', () => {
  it('只给 send_at 时其余走默认（auto / 一次性 / 遇忙作废）', () => {
    const out = parseFireScheduleArgs({ send_at: inMinutes(90) }, NOW, TZ);
    expect(out).toEqual({
      sendAt: new Date(NOW + 90 * 60_000).toISOString(),
      mode: 'auto',
      recurrence: 'none',
      expirePolicy: 'expire',
    });
  });

  it('默认是 expire 而不是 force——大多数「接着说」用户回来了就该让路', () => {
    const out = parseFireScheduleArgs({ send_at: inMinutes(90) }, NOW, TZ) as any;
    expect(out.expirePolicy).toBe('expire');
  });

  it('force 是合法选择（角色自己许下的具体承诺该照发）', () => {
    const out = parseFireScheduleArgs(
      { send_at: inMinutes(120), expire_policy: 'force', mode: 'prompted', prompt_hint: '汤炖好了叫他' },
      NOW,
      TZ,
    ) as any;
    expect(out.expirePolicy).toBe('force');
    expect(out.promptHint).toBe('汤炖好了叫他');
  });

  it('太近的时间打回：cron 一分钟一跳，排得更近等于让下一跳立刻捡走', () => {
    const justUnder = parseFireScheduleArgs({ send_at: inMinutes(0.5) }, NOW, TZ) as any;
    expect(justUnder.ok).toBe(false);
    expect(justUnder.reason).toBe('send_at_too_soon');
    // 边界：正好卡在最小提前量上要放行
    expect(parseFireScheduleArgs(
      { send_at: new Date(NOW + MIN_SCHEDULE_LEAD_MS).toISOString() },
      NOW,
      TZ,
    )).not.toHaveProperty('ok');
  });

  it('过去的时间打回', () => {
    expect((parseFireScheduleArgs({ send_at: inMinutes(-60) }, NOW, TZ) as any).ok).toBe(false);
  });

  it('send_at 缺失 / 不是时间 → 打回并给一个能照抄的裸墙钟示例（不再教 offset）', () => {
    // 文案改版理由（③）：以前教「ISO 8601（如 …+08:00）」，现在统一教裸墙钟——
    // 模型看到的钟就是角色本地的，让它别再自己猜 offset。
    const missing = (parseFireScheduleArgs({}, NOW, TZ) as any).message;
    expect(missing).toContain('墙钟');
    expect(missing).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(missing).not.toContain('+08:00');
    expect((parseFireScheduleArgs({ send_at: '明天晚上' }, NOW, TZ) as any).reason).toBe('invalid_send_at');
  });

  it('prompted 缺方向 → 打回（不然到点那条不知道该说什么）', () => {
    const out = parseFireScheduleArgs({ send_at: inMinutes(90), mode: 'prompted' }, NOW, TZ) as any;
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('missing_prompt_hint');
  });

  it('枚举写错都各自打回', () => {
    expect((parseFireScheduleArgs({ send_at: inMinutes(90), mode: 'fixed' }, NOW, TZ) as any).reason).toBe('invalid_mode');
    expect((parseFireScheduleArgs({ send_at: inMinutes(90), recurrence: 'hourly' }, NOW, TZ) as any).reason).toBe('invalid_recurrence');
    expect((parseFireScheduleArgs({ send_at: inMinutes(90), expire_policy: 'maybe' }, NOW, TZ) as any).reason).toBe('invalid_expire_policy');
  });
});

// ③ 的核心回归守卫：worker 跑在 UTC，裸 send_at 必须按角色的时区（tzId）解析。
// 旧实现 new Date('2026-08-01T09:00:00') 在 UTC 运行时会当成 09:00Z——「明早 9 点」
// 整整差一个时差。断言用与运行机器无关的 epoch 差值钉死。
describe('parseFireScheduleArgs 的时间参照系', () => {
  it('裸 datetime 按 tzId 的墙钟解析（非 UTC 时区断 epoch）', () => {
    // 2026-08-01 纽约在夏令时（EDT，-4）：09:00 墙钟 = 13:00Z。
    const out = parseFireScheduleArgs(
      { send_at: '2026-08-01T09:00:00' },
      Date.UTC(2026, 7, 1, 1, 0),
      { tzId: 'America/New_York' },
    ) as any;
    expect(out.sendAt).toBe('2026-08-01T13:00:00.000Z');
  });

  it('带 Z / offset 的照旧按标注解析，不被 tz 改写', () => {
    const withZ = parseFireScheduleArgs(
      { send_at: '2026-08-01T09:00:00Z' }, Date.UTC(2026, 7, 1, 1, 0), { tzId: 'America/New_York' },
    ) as any;
    expect(withZ.sendAt).toBe('2026-08-01T09:00:00.000Z');
    const withOffset = parseFireScheduleArgs(
      { send_at: '2026-08-01T09:00:00+08:00' }, Date.UTC(2026, 7, 1, 0, 0), { tzId: 'America/New_York' },
    ) as any;
    expect(withOffset.sendAt).toBe('2026-08-01T01:00:00.000Z');
  });

  it('too_soon 判定吃解析后的真实时刻（墙钟看着在未来、真实时刻已过 → 打回）', () => {
    // 纽约墙钟 09:00 = 13:00Z；now 已是 14:00Z → 其实是过去。
    const out = parseFireScheduleArgs(
      { send_at: '2026-08-01T09:00:00' },
      Date.UTC(2026, 7, 1, 14, 0),
      { tzId: 'America/New_York' },
    ) as any;
    expect(out.reason).toBe('send_at_too_soon');
  });

  it('打回文案里的「现在」说角色时区的人话，不再甩 UTC ISO', () => {
    const out = parseFireScheduleArgs(
      { send_at: '2026-08-01T09:00:00' },
      Date.UTC(2026, 7, 1, 14, 0),          // 纽约 10:00
      { tzId: 'America/New_York' },
    ) as any;
    expect(out.message).toContain('8月1日 10:00');
    expect(out.message).not.toContain('Z）');
  });
});

// 用户的中转拒 tools 时走这层。认得太宽会把「我等下用 schedule_active_message 提醒你」
// 这种叙述当成真调用，直接排出一条任务。
describe('extractFireScheduleTextCalls', () => {
  it('认括号带 JSON 的写法', () => {
    const calls = extractFireScheduleTextCalls(
      `好，我等下再找你\n${AMSG_FIRE_SCHEDULE_TOOL}({"send_at":"2026-07-30T23:30:00Z","prompt_hint":"接着说猫"})`,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].args).toEqual({ send_at: '2026-07-30T23:30:00Z', prompt_hint: '接着说猫' });
  });

  it('叙述里提到工具名但没有括号调用 → 不算', () => {
    expect(extractFireScheduleTextCalls(`我等下用 ${AMSG_FIRE_SCHEDULE_TOOL} 提醒你`)).toHaveLength(0);
    expect(extractFireScheduleTextCalls(`${AMSG_FIRE_SCHEDULE_TOOL}: 两小时后`)).toHaveLength(0);
  });

  it('参数写坏了仍算一次调用（交给 parse 回一句该怎么写，别把语法漏进正文）', () => {
    const calls = extractFireScheduleTextCalls(`${AMSG_FIRE_SCHEDULE_TOOL}({送两小时后})`);
    expect(calls).toHaveLength(1);
    expect(calls[0].args).toEqual({});
  });

  it('matched 是原始串，剥语法时靠它', () => {
    const text = `晚安\n${AMSG_FIRE_SCHEDULE_TOOL}({"send_at":"x"})`;
    const [call] = extractFireScheduleTextCalls(text);
    expect(text.split(call.matched).join('').trim()).toBe('晚安');
  });
});

describe('工具与说明块', () => {
  const timeOpts = { nowMs: NOW, tz: TZ };

  it('工具名与前台一致（角色不用学第二套）', () => {
    expect(buildFireScheduleTool(timeOpts).function.name).toBe('schedule_active_message');
  });

  it('native 模式不教正文语法，text 模式才教', () => {
    expect(buildFireScheduleBlock('native', timeOpts)).not.toContain('({"send_at"');
    expect(buildFireScheduleBlock('text', timeOpts)).toContain('({"send_at"');
  });

  it('expire_policy 描述把「角色自己许下的承诺」算进 force', () => {
    expect(EXPIRE_POLICY_DESCRIPTION).toContain('你自己许下的');
    expect(buildFireScheduleTool(timeOpts).function.parameters).toMatchObject({
      properties: { expire_policy: { description: EXPIRE_POLICY_DESCRIPTION } },
    });
  });

  // ③：示例从写死的 `2026-07-30T23:30:00+08:00` 改成按 nowMs+tz 现算的「明天这个点」
  // 裸墙钟——教模型写 offset 的话，它写的 offset 和角色时区对不上时又是一笔糊涂账。
  it('send_at 示例是「明天这个点」的裸墙钟，随 tz 走、不带 offset', () => {
    const tool = buildFireScheduleTool({ nowMs: NOW, tz: { tzId: 'Asia/Tokyo' } });
    const desc = (tool.function.parameters as any).properties.send_at.description as string;
    // NOW = 2026-07-30T12:00Z → 东京 21:00，明天这个点 = 07-31T21:00:00
    expect(desc).toContain('2026-07-31T21:00:00');
    expect(desc).not.toContain('+08:00');
    expect(desc).not.toContain('+09:00');
    expect(buildSendAtExample(NOW, { tzId: 'Asia/Tokyo' })).toBe('2026-07-31T21:00:00');
  });

  it('text 模式说明块里的示例同样是裸墙钟', () => {
    const block = buildFireScheduleBlock('text', { nowMs: NOW, tz: { tzId: 'Asia/Shanghai' } });
    expect(block).toContain('"send_at":"2026-07-31T20:00:00"');
    expect(block).not.toContain('+08:00');
  });
});

// 排程有三个入口（面板 / 前台工具 / fire 里的工具），指令必须一模一样，
// 否则同一个 mode 在不同入口生成出来的消息方向会不一样。
describe('buildTaskInstruction', () => {
  it('prompted 带上方向', () => {
    expect(buildTaskInstruction('prompted', '问问吃了没')).toContain('额外提示：问问吃了没');
  });

  it('auto 无灵感时写「无」，不留空', () => {
    expect(buildTaskInstruction('auto')).toContain('可选灵感补充：无');
  });
});

// 排程清单里印给角色看的短 id 取的是 uuid 前 8 个字符（amsg2Tasks.shortTaskId）。
// 自排任务的 uuid 要是以固定字样开头，同一次 fire 排下的两条就印成一模一样的短 id，
// 角色说「取消晚上那条」时随便命中一条 —— 删掉的很可能是早上那条，而且两边都回 ok。
describe('buildSelfScheduleUuid（自排任务的 uuid）', () => {
  it('同一次 fire 的两条，前 8 个字符不一样（清单里印出来的短 id 不撞车）', () => {
    const a = buildSelfScheduleUuid('preset-nyah', 1_785_000_000_000, 0);
    const b = buildSelfScheduleUuid('preset-nyah', 1_785_000_000_000, 1);
    expect(shortTaskId(a)).not.toBe(shortTaskId(b));
  });

  it('不同角色 / 不同触发时刻同样分得开', () => {
    const base = buildSelfScheduleUuid('preset-nyah', 1_785_000_000_000, 0);
    expect(shortTaskId(buildSelfScheduleUuid('preset-other', 1_785_000_000_000, 0)))
      .not.toBe(shortTaskId(base));
    expect(shortTaskId(buildSelfScheduleUuid('preset-nyah', 1_785_000_060_000, 0)))
      .not.toBe(shortTaskId(base));
  });

  // 幂等的根：fire 抛错整条重跑时算出同一个 uuid，上游才认得出撞车、不会每重试一次多排一条。
  it('同样的入参永远算出同一个 uuid（重跑对得上号）', () => {
    expect(buildSelfScheduleUuid('preset-nyah', 1_785_000_000_000, 0))
      .toBe(buildSelfScheduleUuid('preset-nyah', 1_785_000_000_000, 0));
  });

  it('uuid 里仍看得出是自排的那一族（排障时一眼认出来）', () => {
    expect(buildSelfScheduleUuid('preset-nyah', 1_785_000_000_000, 0)).toContain('amsgself');
  });
});

// 取消 / 改期会真的动 D1 行。短 id 撞车时静默取第一条 = 删掉另一条任务，而角色和用户
// 都只看到一句 ok —— 说好的那条到点照响，被删的那条无声无息地没了。
describe('resolveFireTargetTask 的短 id 撞车', () => {
  const NOW_MS = Date.UTC(2026, 6, 30, 12, 0);
  const task = (uuid: string, hoursFromNow: number) => ({
    taskUuid: uuid,
    clientTaskId: `${uuid}-c`,
    mode: 'auto',
    firstSendTime: new Date(NOW_MS + hoursFromNow * 3600_000).toISOString(),
    recurrenceType: 'none',
    expirePolicy: 'expire',
    source: 'character',
    status: 'scheduled',
    createdAt: NOW_MS,
  }) as any;

  const morning = task('amsgself-c1-1000-0', 1);
  const evening = task('amsgself-c1-1000-1', 9);

  it('一个短 id 命中两条 → 打回 ambiguous_task，不静默挑第一条', () => {
    const out = resolveFireTargetTask([morning, evening], 'amsgself', NOW_MS, TZ) as any;
    expect(out.ok).toBe(false);
    expect(out.reason).toBe('ambiguous_task');
  });

  it('打回的话里带得走：两条各自的触发时间 + 完整 task_id', () => {
    const out = resolveFireTargetTask([morning, evening], 'amsgself', NOW_MS, TZ) as any;
    expect(out.message).toContain(morning.taskUuid);
    expect(out.message).toContain(evening.taskUuid);
    expect(out.message).toContain('7月30日 13:00');
    expect(out.message).toContain('7月30日 21:00');
  });

  it('带完整 uuid 重来一次就指得准', () => {
    const out = resolveFireTargetTask([morning, evening], evening.taskUuid, NOW_MS, TZ) as any;
    expect(out.task).toBe(evening);
  });

  it('短 id 只命中一条时照常选它，没命中还是 task_not_found', () => {
    expect((resolveFireTargetTask([morning], 'amsgself', NOW_MS, TZ) as any).task).toBe(morning);
    expect((resolveFireTargetTask([morning], 'nothere1', NOW_MS, TZ) as any).reason)
      .toBe('task_not_found');
  });
});
