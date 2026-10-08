import {describe,it,expect} from 'vitest';
import {automaticWallVisible} from '../apps/room3d/automaticWalls.js';
import {wallVisible} from '../apps/room3d/topology.js';

describe('camera-relative room walls',()=>{
 it.each([['front',0,1,'back'],['back',0,-1,'front'],['left',-1,0,'right'],['right',1,0,'left']])('opens the %s camera side',(near,dx,dz,far)=>{
  expect(automaticWallVisible(near,Number(dx),Number(dz))).toBe(false);
  expect(automaticWallVisible(far,Number(dx),Number(dz))).toBe(far!=='front');
 });
 it('never restores the front wall, even from behind',()=>{expect(automaticWallVisible('front',0,-1,true)).toBe(false);});
 it('keeps the previous side near a parallel camera angle',()=>{
  expect(automaticWallVisible('left',.01,1,false)).toBe(false);
  expect(automaticWallVisible('left',-.01,1,true)).toBe(true);
 });
 it('constructs all four sides for automatic mode without changing hidden mode',()=>{
  for(const edge of ['left','right','front','back']){
   expect(wallVisible('auto',edge)).toBe(true);
   expect(wallVisible('hidden',edge)).toBe(false);
  }
 });
});
