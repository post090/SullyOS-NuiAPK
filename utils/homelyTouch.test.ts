import {it,expect} from 'vitest';
import {Vector3 as V} from 'three';
import {classifyHomelyTouch,homelyTouchPose} from '../apps/room3d/homelyTouch';
it('distinguishes crown, cheek, torso, and a posed arm',()=>{
 const base=new V(0,2,0),crown=new V(0,3,0),arms=[{side:1 as const,points:[new V(.4,1.8,0),new V(.6,1.5,0),new V(.6,1.2,0)]}];
 expect(classifyHomelyTouch(new V(0,2.9,.2),base,crown,arms).zone).toBe('head');
 expect(classifyHomelyTouch(new V(-.3,2.5,.2),base,crown,arms)).toEqual({zone:'cheek',side:-1});
 expect(classifyHomelyTouch(new V(0,1.5,.2),base,crown,arms).zone).toBe('body');
 expect(classifyHomelyTouch(new V(.65,1.25,.1),base,crown,arms)).toEqual({zone:'arm',side:1});
 expect(classifyHomelyTouch(new V(.85,1.45,.2),base,crown,arms).zone).toBe('arm');
});
it('uses current head orientation rather than fixed standing height',()=>{
 const base=new V(0,1,0),crown=new V(0,1,1);
 expect(classifyHomelyTouch(new V(.1,1.1,.9),base,crown).zone).toBe('head');
 expect(classifyHomelyTouch(new V(.2,1.1,.4),base,crown).zone).toBe('cheek');
});
it('mirrors cheek responses and leaves occupied hands alone',()=>{
 const left=homelyTouchPose(.25,{zone:'cheek',side:1}),right=homelyTouchPose(.25,{zone:'cheek',side:-1});
 expect(left.head[1]).toBe(-right.head[1]);expect(left.head[2]).toBe(-right.head[2]);
 expect(homelyTouchPose(.25,{zone:'arm',side:1})).toHaveProperty('L_forearm');
 expect(homelyTouchPose(.25,{zone:'arm',side:1},true)).not.toHaveProperty('L_forearm');
});
it('finishes at rest and respects reduced motion for every touch region',()=>{
 for(const zone of ['head','cheek','body','arm'] as const){
  for(const t of [0,.85,3])expect(homelyTouchPose(t,{zone,side:1})).toEqual({});
  expect(homelyTouchPose(.2,{zone,side:1},false,true)).toEqual({});
 }
});
