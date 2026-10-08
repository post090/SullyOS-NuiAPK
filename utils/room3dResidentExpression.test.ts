import {describe,it,expect} from 'vitest';
import {residentBlinkSeed,residentFaceFrame} from '../apps/room3d/chibi/residentExpression';
describe('home resident expression clock',()=>{
 it('blinks briefly and returns to the same open face at the scheduled boundaries',()=>{
  for(const id of ['owner','user','visitor']){
   const seed=residentBlinkSeed(id),start=residentFaceFrame(0,seed),closedAt=start.nextIn+.001,closed=residentFaceFrame(closedAt,seed);
   if(start.blinking)continue;
   expect(closed.eyes).toBe('closed');expect(closed.nextIn).toBeLessThanOrEqual(.16);
   expect(residentFaceFrame(closedAt+closed.nextIn+.001,seed).eyes).toBe('open');
  }
 });
 it('offsets residents and keeps a paused render loop asleep until the next blink',()=>{
  const a=residentFaceFrame(0,residentBlinkSeed('owner')),b=residentFaceFrame(0,residentBlinkSeed('guest'));
  expect(a.nextIn).not.toBe(b.nextIn);expect(a.nextIn).toBeGreaterThan(.2);
 });
 it('keeps authored sleeping and happy eyes, and disables timers for fixed eyes / reduced motion',()=>{
  for(const eyes of ['closed','happy'] as const){
   expect(residentFaceFrame(3,2,{},eyes)).toEqual({eyes,blinking:false,nextIn:Infinity});
   expect(residentFaceFrame(3,2,{eyes})).toEqual({eyes,blinking:false,nextIn:Infinity});
  }
  expect(residentFaceFrame(3,2,{blink:false}).nextIn).toBe(Infinity);
  expect(residentFaceFrame(3,2,{},'open',false).nextIn).toBe(Infinity);
 });
});
