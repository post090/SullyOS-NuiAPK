import {describe,it,expect} from 'vitest';
import {decorationPreviewScenes} from './decorationPreviewScenes';
const scenes=(parts:unknown)=>decorationPreviewScenes({parts}).map(scene=>scene.id);
describe('preset-specific previews',()=>{
 it('scans large embedded images once and ignores braces and selectors inside values',()=>{
  const css = `.sully-chat-avatar-wrap::after{background:url("data:image/png;base64,${'a'.repeat(2_000_000)}");content:".sully-chat-card[data-card-kind='music_card'] {"}`;
  const started = performance.now();
  expect(scenes({css})).toEqual(['conversation']);
  expect(performance.now()-started).toBeLessThan(1500);
  expect(scenes({css:'@media(max-width:600px){.sully-psyche-card{color:red}}'})).toEqual(['psyche','psyche-open']);
 });
 it('offers the full fixture catalog in the composer, even for a standalone part',()=>{
  const ids=decorationPreviewScenes({parts:{psyche:{styleId:'echo'}}},'all').map(scene=>scene.id);
  expect(ids).toEqual(expect.arrayContaining(['all','conversation','emoji','image','music_card','world_card','html_card','collaboration_file','transfer','voice','psyche']));
  expect(decorationPreviewScenes({parts:{}},'all').map(scene=>scene.id)).toEqual(ids);
 });
 it('shows only psyche states for standalone psyche',()=>{
  expect(scenes({psyche:{styleId:'echo'}})).toEqual(['psyche','psyche-open']);
  expect(scenes({css:'.sully-psyche-body{color:red}'})).toEqual(['psyche','psyche-open']);
 });
 it('keeps default whitebox to the four core categories',()=>{
  const ids=scenes({css:'.sully-chat-root{color:red}'});
  expect(ids).toContain('transfer-accepted');
  expect(ids).toContain('voice-playing');
  expect(ids).toContain('psyche-open');
  expect(ids).not.toContain('all');
  expect(ids).not.toContain('music_card');
 });
 it('only adds explicitly targeted app cards',()=>{
  expect(scenes({css:'.sully-chat-card[data-card-kind="music_card"]{color:red}'})).toEqual(['music_card']);
  expect(scenes({css:'.sully-chat-card[data-card-kind="score_card"][data-card-variant="diary_card"]{color:red}'})).toEqual(['diary']);
 });
 it('ignores card names in comments and declaration strings',()=>{
  expect(scenes({css:'/* [data-card-kind="music_card"] */ .sully-psyche-card{content:\'[data-card-kind="world_card"]\'}'})).toEqual(['psyche','psyche-open']);
 });
});
