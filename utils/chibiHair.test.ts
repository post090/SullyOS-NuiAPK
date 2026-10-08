import {describe,it,expect} from 'vitest';
import {hairMode,selectedHairAssets,type HairSettings} from '../apps/room3d/chibi/types';
describe('hair asset classification',()=>{
 it('distinguishes a cap and cat ears within back2',()=>{
  const h:HairSettings={layers:{},extras:[],assets:{back2:'back2_014'}};
  expect(hairMode(h,'back2')).toBe('project');
  expect(hairMode({...h,assets:{back2:'back2_01'}},'back2')).toBe('wrap');
 });
 it('keeps manual tags on their asset when switching selections',()=>{
  const h:HairSettings={layers:{},extras:[],assets:{back2:'custom-tail'},assetModes:{'custom-tail':'project','back2_014':'wrap'}};
  expect(hairMode(h,'back2')).toBe('project');
  expect(hairMode({...h,assets:{back2:'back2_014'}},'back2')).toBe('wrap');
  expect(hairMode({...h,assets:{back2:'another-upload'}},'back2')).toBe('wrap');
 });
 it('extracts stable selected IDs without treating empty or malformed selections as assets',()=>{
  expect(selectedHairAssets({selected:{back1:'back1_01',back2:null,fronthair:[],outfit:'dress'}})).toEqual({back1:'back1_01'});
  expect(selectedHairAssets(undefined)).toEqual({});
 });
});
