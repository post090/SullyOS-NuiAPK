import { expect, it } from 'vitest';
import { decorationCategories, decorationContents } from './beautyCategories';
import { validateDecoration } from './chatDecoration';
it('allows overlapping categories without splitting the package', () => {
  const preset = validateDecoration({ format: 'sullyos-chat-decoration', version: 1, name: '组合', parts: {
    bubbles: { name: '气泡', user: { backgroundColor: '#fff', textColor: '#000', avatarDecoration: 'https://example.com/frame.png' }, ai: { backgroundColor: '#fff', textColor: '#000' } },
    background: { image: null, style: 'plain' }, css: '.box { color: red; }',
  } });
  expect(decorationCategories(preset)).toEqual(['chat', 'whitebox', 'bubbles', 'avatar', 'background']);
  expect(decorationContents(preset)).toContain('头像框');
  expect(preset.parts.css).toBe('.box { color: red; }');
});
it('does not guess components hidden in CSS; keeps standalone backgrounds out of bundles', () => {
  const pack = (parts: any) => validateDecoration({ format: 'sullyos-chat-decoration', version: 1, name: 'test', parts });
  expect(decorationCategories(pack({ css: '.avatar {color:red}' }))).toEqual(['chat', 'whitebox']);
  expect(decorationCategories(pack({ background: { image: null, style: 'plain' } }))).toEqual(['chat', 'background']);
});
