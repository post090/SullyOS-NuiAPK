import { describe, expect, it } from 'vitest';
import { isMidAutumnBoot } from './seasonalBoot';

describe('2026 中秋开屏（东八区）', () => {
  it.each([
    ['2026-09-24T15:59:59.999Z', false],
    ['2026-09-24T16:00:00.000Z', true],
    ['2026-09-27T15:59:59.999Z', true],
    ['2026-09-27T16:00:00.000Z', false],
    ['2027-09-25T00:00:00+08:00', false],
  ])('%s → %s', (time, expected) => {
    expect(isMidAutumnBoot(Date.parse(time))).toBe(expected);
  });
});
