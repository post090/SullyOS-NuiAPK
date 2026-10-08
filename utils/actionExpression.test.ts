import {describe,it,expect} from 'vitest';
import {actionExpression,actionMouthFrame} from '../apps/room3d/chibi/actionExpression';
describe('action mouth expressions',()=>{
 it('speaks in syllables with closed-mouth pauses',()=>{
  expect(actionMouthFrame('speaking',.1).mouth).toBe('open');
  expect(actionMouthFrame('speaking',.25).mouth).toBe('closed');
  expect(actionMouthFrame('speaking',2.2).mouth).toBe('closed');
 });
 it('distinguishes speakers, listeners, intimacy and conflict',()=>{
  expect(actionExpression('x','talk','聊天手势 1')).toBe('speaking');
  expect(actionExpression('x','talk','认真倾听')).toBe('neutral');
  expect(actionExpression('home-hug','close','拥抱')).toBe('smiling');
  expect(actionExpression('x','conflict','不太高兴')).toBe('neutral');
  expect(actionExpression('bed-talk')).toBe('speaking');
 });
 it('restores the authored mouth after stopping and closes it for sleep',()=>{
  expect(actionMouthFrame(actionExpression('idle'),0)).toEqual({mouth:'base',nextIn:Infinity});
  expect(actionMouthFrame(actionExpression('sleep'),0).mouth).toBe('closed');
  expect(actionMouthFrame(actionExpression('wave-cute'),0).mouth).toBe('smile');
 });
});
