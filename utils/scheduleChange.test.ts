import { describe, expect, it } from 'vitest';
import type { DailySchedule } from '../types';
import { applyFutureScheduleChanges, extractScheduleChangeDirectives } from './scheduleChange';

const schedule: DailySchedule = {
    id: 'char-1_2026-08-15',
    charId: 'char-1',
    date: '2026-08-15',
    generatedAt: new Date(2026, 7, 15, 8).getTime(),
    slots: [
        { startTime: '08:00', activity: '起床', location: '家' },
        { startTime: '14:00', activity: '写稿', description: '完成第三章', innerThought: '别再拖稿了' },
        { startTime: '18:30', activity: '健身', location: '健身房', theater: { generatedAt: 1, lines: [{ text: '跑步' }] } },
        { startTime: '22:00', activity: '看电影' },
    ],
    flowNarrative: { afternoon: '晚上还得去健身。' },
};

const at = (hour: number, minute = 0) => new Date(2026, 7, 15, hour, minute);

describe('extractScheduleChangeDirectives', () => {
    it('识别规范格式并把控制标签从聊天正文隐藏', () => {
        const result = extractScheduleChangeDirectives('那今晚就不练啦。\n[[ACTION:CHANGE_SCHEDULE | 18:30 | 去超市]]');
        expect(result.cleanedText).toBe('那今晚就不练啦。');
        expect(result.directives).toEqual([{ startTime: '18:30', activity: '去超市' }]);
        expect(result.malformedCount).toBe(0);
    });

    it.each([
        '【【修改日程：18:30：去超市】】',
        '[[change schedule: (18:30): 去超市]]',
        '【change schedue：（18：30）：去超市】',
        '【【修改日程：18点30分：去超市】】',
        'change_schedule：18时30分：去超市',
        '[[ACTION:CHANGE_SCHEDULE | 18:30 | 去超市]',
        '[ACTION:CHANGE_SCHEDULE | 18:30 | 去超市]]',
        '[ACTION:CHANGE_SCHEDULE | 18:30 | 去超市]',
        '[[ACTION:CHANGE_SCHEDULE | 18:30 | 去超市',
        'ACTION:CHANGE_SCHEDULE | 18:30 | 去超市]]',
        'ACTION:CHANGE_SCHEDULE | 18:30 | 去超市',
    ])('容错括号、标点、中文别名与 schedue 拼写：%s', (raw) => {
        const result = extractScheduleChangeDirectives(raw);
        expect(result.cleanedText).toBe('');
        expect(result.directives).toEqual([{ startTime: '18:30', activity: '去超市' }]);
    });

    it('无法确定时段时只隐藏控制标签并记为 malformed，不猜测目标', () => {
        const result = extractScheduleChangeDirectives('好。\n[[ACTION:CHANGE_SCHEDULE | 晚一点 | 去超市]]');
        expect(result.cleanedText).toBe('好。');
        expect(result.directives).toEqual([]);
        expect(result.malformedCount).toBe(1);
    });
});

describe('applyFutureScheduleChanges', () => {
    it('只改未来已有时段，并清掉围绕旧活动生成的冲突信息', () => {
        const result = applyFutureScheduleChanges(
            schedule,
            [{ startTime: '18:30', activity: '去超市' }],
            null,
            at(14, 5),
        );
        expect(result.changes).toEqual([{ startTime: '18:30', before: '健身', after: '去超市' }]);
        expect(result.schedule.slots[2]).toEqual({ startTime: '18:30', activity: '去超市' });
        expect(result.schedule.flowNarrative).toBeUndefined();
        expect(schedule.slots[2].activity).toBe('健身');
    });

    it('拒绝过去、当前、表里不存在的时段', () => {
        const result = applyFutureScheduleChanges(schedule, [
            { startTime: '08:00', activity: '睡懒觉' },
            { startTime: '14:00', activity: '摸鱼' },
            { startTime: '19:00', activity: '散步' },
        ], null, at(14));
        expect(result.changes).toEqual([]);
        expect(result.rejectedCount).toBe(3);
        expect(result.schedule).toBe(schedule);
    });

    it('同一时段重复输出时折叠为“最初计划 → 最终计划”', () => {
        const result = applyFutureScheduleChanges(schedule, [
            { startTime: '22:00', activity: '看书' },
            { startTime: '22:00', activity: '早点睡' },
        ], null, at(18));
        expect(result.changes).toEqual([{ startTime: '22:00', before: '看电影', after: '早点睡' }]);
        expect(result.schedule.slots[3].activity).toBe('早点睡');
    });
});
