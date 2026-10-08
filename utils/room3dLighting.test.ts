import {describe,it,expect} from 'vitest';
import {roomLightBudget} from '../apps/room3d/renderQuality.js';

describe('room lighting work limits',()=>{
 it('keeps a window shadow in power-saving mode without the extra outline scene pass',()=>{
  for(const touch of [false,true])expect(roomLightBudget('eco',touch)).toMatchObject({windows:1,keyShadow:false,outline:false});
 });
 it('caps all touch presets at one shadowed source, even when Clear is restored from storage',()=>{
  for(const quality of ['eco','balanced','clear'])expect(roomLightBudget(quality,true)).toMatchObject({windows:1,keyShadow:false,outline:false});
 });
 it('spends additional passes only on desktop quality modes and skips them in overview',()=>{
  expect(roomLightBudget('balanced')).toMatchObject({windows:1,keyShadow:true,outline:true,shadowSize:1024});
  expect(roomLightBudget('clear')).toMatchObject({windows:2,keyShadow:true,outline:true,shadowSize:2048});
  for(const quality of ['eco','balanced','clear'])expect(roomLightBudget(quality,false,true)).toMatchObject({windows:0,keyShadow:false,outline:false});
 });
});
