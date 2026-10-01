import {describe,it,expect} from 'vitest';
import {BUILTIN_WHITEBOX_PRESETS} from './builtinWhitebox';
import {decorationPatches} from './chatDecoration';

describe('bundled star orbit outfits',()=>{
 it.each(BUILTIN_WHITEBOX_PRESETS)('$name is portable and applies a complete outfit without changing sounds',async item=>{
  const preset=item.read();
  expect(preset.parts.layout?.chatAvatarSize).toBe('medium');
  expect(preset.parts.css).toContain('data:image/svg+xml');
  expect(preset.parts.css).not.toMatch(/url\(["']?https?:/);
  const patch=await decorationPatches(preset,['layout','bubbles','background','psyche','css'],'character',{id:'sample',chatSound:{src:'ding'}} as any,{} as any);
  expect(patch.character.chromeCustomCss).toBe(preset.parts.css);
  expect(patch.character.chatAppearance?.chatAvatarSize).toBe('medium');
  expect(patch.character.chatSound).toEqual({src:'ding'});
 });
 it('keeps builtins unchanged when a returned copy is edited',()=>{
  const item=BUILTIN_WHITEBOX_PRESETS[0];const p=item.read();p.parts.css='changed';
  expect(item.read().parts.css).not.toBe('changed');
 });
});
