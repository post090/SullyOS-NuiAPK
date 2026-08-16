import { describe, it, expect } from 'vitest';
import { isStatusBarHidden, resolveStatusBarMode } from './iosStandalone';

// 顶部时钟/电量条显隐的取值逻辑：外观开关显式值优先，没设过时跟随平台默认。
// 平台默认作为第二参注入，让用例不依赖运行环境（jsdom 非 standalone）。
describe('isStatusBarHidden', () => {
  // 回归守卫：必须用 ?? 而非 ||。显式 false（用户主动要显示）绝不能被平台默认 true 盖掉，
  // 否则 iOS 用户在外观里关掉开关想看 SullyOS 时钟，却仍被强制隐藏。旧的错误行为（||）会让本用例挂。
  it('显式 false 压过平台默认 true', () => {
    expect(isStatusBarHidden(false, true)).toBe(false);
  });

  it('显式 true 隐藏，与平台默认无关', () => {
    expect(isStatusBarHidden(true, false)).toBe(true);
  });

  it('没设过(undefined) 跟随平台默认', () => {
    expect(isStatusBarHidden(undefined, true)).toBe(true);
    expect(isStatusBarHidden(undefined, false)).toBe(false);
  });
});

describe('resolveStatusBarMode', () => {
  it('新三档设置优先于旧开关', () => {
    expect(resolveStatusBarMode('compact', true, true)).toBe('compact');
    expect(resolveStatusBarMode('standard', true, true)).toBe('standard');
    expect(resolveStatusBarMode('hidden', false, false)).toBe('hidden');
  });

  it('旧存档继续读取 hideStatusBar', () => {
    expect(resolveStatusBarMode(undefined, true, false)).toBe('hidden');
    expect(resolveStatusBarMode(undefined, false, true)).toBe('standard');
  });

  it('从未设置时沿用平台默认', () => {
    expect(resolveStatusBarMode(undefined, undefined, true)).toBe('hidden');
    expect(resolveStatusBarMode(undefined, undefined, false)).toBe('standard');
  });
});
