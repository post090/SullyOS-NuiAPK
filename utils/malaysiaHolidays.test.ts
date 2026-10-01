import { afterEach, describe, expect, it, vi } from 'vitest';
import { HOLIDAY_COUNTRIES, getUserHolidayReminder, loadHolidayCalendar, parseHolidayCalendar, renderUserHoliday } from './userHolidays';
import { MALAYSIA_HOLIDAY_REGIONS } from './malaysiaHolidayRegions';
import { buildUserHolidayBlock } from '../worker/amsg/src/realtimeWorld';

const states = MALAYSIA_HOLIDAY_REGIONS.map(r => r.sourceCode);
const raw = { meta: { year: 2026 }, data: [
    { date: '2026-09-16', name: 'Hari Malaysia', state_codes: states },
    { date: '2026-11-08', name: 'Hari Deepavali', state_codes: states.filter(s => s !== 'SWK') },
    { date: '2026-12-24', name: 'Christmas Eve', state_codes: ['SBH'] },
] };
const config = { enabled: true, countryCode: 'MY', timeZone: 'Asia/Kuala_Lumpur' };
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('马来西亚节假日', () => {
    it('可选马来西亚，全国与州属严格分开，砂拉越不误收屠妖节', () => {
        expect(HOLIDAY_COUNTRIES.filter(c => c.countryCode === 'MY')).toHaveLength(1);
        const days = parseHolidayCalendar('MY', 2026, raw, 1)!.days;
        expect(renderUserHoliday(config, '2026-09-16', days, '小桃')).toContain('小桃所在地马来西亚');
        expect(renderUserHoliday(config, '2026-11-08', days)).toBe('');
        expect(renderUserHoliday({ ...config, subdivisionCode: 'MY-13' }, '2026-11-08', days)).toBe('');
        expect(renderUserHoliday({ ...config, subdivisionCode: 'MY-14' }, '2026-11-08', days)).toContain('（吉隆坡）');
        expect(renderUserHoliday({ ...config, subdivisionCode: 'MY-12' }, '2026-12-24', days)).toContain('Christmas Eve');
        expect(renderUserHoliday({ ...config, subdivisionCode: 'MY-14' }, '2026-12-24', days)).toBe('');
        expect(renderUserHoliday(config, '2026-09-17', days)).toBe('');
    });
    it('缺省州属、未知州属、空年度和年份不匹配不会被当成全国日历', () => {
        for (const invalid of [
            [], { ...raw, meta: { year: 2027 } }, { ...raw, data: [] },
            { ...raw, data: [{ ...raw.data[0], state_codes: undefined }] },
            { ...raw, data: [{ ...raw.data[0], state_codes: ['FED'] }] },
            { ...raw, data: [{ ...raw.data[0], state_codes: [] }] },
            { ...raw, data: [{ ...raw.data[0], date: '2027-09-16' }] },
        ]) expect(parseHolidayCalendar('MY', 2026, invalid, 1)).toBeNull();
    });
    it('实际请求走 MY 数据源，缓存复用，前后台按用户时区且关闭不取数', async () => {
        const fetcher = vi.fn(async () => new Response(JSON.stringify(raw)));
        vi.stubGlobal('fetch', fetcher);
        const cache = { read: vi.fn(async () => null), write: vi.fn(async () => {}) };
        const at = Date.parse('2026-09-15T17:00Z');
        expect(await getUserHolidayReminder({ ...config, enabled: false }, cache, at)).toBe('');
        expect(fetcher).not.toHaveBeenCalled();
        expect(await getUserHolidayReminder(config, cache, at, '小桃')).toContain('2026-09-16 为Hari Malaysia');
        expect(fetcher).toHaveBeenCalledWith('https://malaysia-holiday.dydxsoft.my/api/v1/holidays?year=2026', expect.anything());
        const args = { toolConfig: { userHolidays: config }, nowMs: at, tzId: 'America/New_York', globalRows: [], globalNamespace: 'test', timeAwarenessEnabled: true, userName: '小桃' };
        expect(await buildUserHolidayBlock(args as any)).toContain('小桃所在地马来西亚');
        expect(await buildUserHolidayBlock({ ...args, timeAwarenessEnabled: false } as any)).toBe('');
        expect(fetcher).toHaveBeenCalledTimes(1);
        expect(cache.write).toHaveBeenCalledTimes(1);
        fetcher.mockRejectedValue(new Error('offline'));
        expect(await loadHolidayCalendar('MY', 2026, cache, at + 86400001)).not.toBeNull();
        expect(await loadHolidayCalendar('MY', 2027, cache, at)).toBeNull();
    });
});
