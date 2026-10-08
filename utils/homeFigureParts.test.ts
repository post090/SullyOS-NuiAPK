import {describe,it,expect} from 'vitest';
import {selectHomeFigurePart} from './homeFigureParts';
import type {CustomCreatorPart} from '../types';
const part=(categoryKey:string,id='custom'):CustomCreatorPart=>({categoryKey,id,name:'自绘',src:'data:image/png;base64,test',createdAt:0});
describe('custom home figure parts',()=>{
 it('preserves custom eyes and mouth independently from split facial presets',()=>{
  const eyes=selectHomeFigurePart({selected:{eyes:'old',mouth:'old-mouth'}},undefined,part('eyes'));
  expect(eyes.state.selected).toEqual({eyes:'custom',mouth:'old-mouth'});expect(eyes.face.useBaseEyes).toBe(true);
  const mouth=selectHomeFigurePart(eyes.state,eyes.face,part('mouth','my-mouth'));
  expect(mouth.face.useBaseEyes).toBe(true);expect(mouth.face.useBaseMouth).toBe(true);
 });
 it('changes only the selected hair layer and preserves tint, flip and face settings',()=>{
  const state={selected:{fronthair:'old',back1:'back'},itemColor:{back:'#112233'},flipped:{back:true}};
  const next=selectHomeFigurePart(state,{useBaseEyes:true},part('fronthair'));
  expect(next.state.selected.back1).toBe('back');expect(next.state.itemColor).toEqual(state.itemColor);expect(next.state.flipped).toEqual(state.flipped);expect(state.selected.fronthair).toBe('old');expect(next.face.useBaseEyes).toBe(true);
 });
 it.each(['decor','facemark'])('toggles multiple %s without mutating the original selection',category=>{
  const state={selected:{[category]:['first']}};
  const added=selectHomeFigurePart(state,undefined,part(category));expect(added.state.selected[category]).toEqual(['first','custom']);
  expect(selectHomeFigurePart(added.state,added.face,part(category)).state.selected[category]).toEqual(['first']);expect(state.selected[category]).toEqual(['first']);
 });
});
