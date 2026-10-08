import {describe,it,expect} from 'vitest';
import {createRearHairLiner} from '../apps/room3d/chibi/rearHairLiner';
import {defaultHairLayer} from '../apps/room3d/chibi/types';
import {BufferGeometry,Float32BufferAttribute} from 'three';
describe('rear hair inner cloth',()=>{
 it('keeps the authored curl tip above the crown while hiding its cap root',()=>{
  // Sully back1: curl tip around source row 42, main cap around row 49.
  const rows=[35,42,49],surface=new BufferGeometry();
  surface.setAttribute('position',new Float32BufferAttribute(rows.flatMap(y=>[.1,(424-y)/168,0]),3));
  const g=createRearHairLiner(defaultHairLayer,.82,surface,true),p=g.getAttribute('position');
  expect(p.getY(0)).toBeGreaterThan(2.2);
  expect(p.getY(1)).toBeGreaterThan(2.2);
  expect(p.getY(2)).toBeLessThan(2.2);
  g.dispose();
 });
 it('tucks the cap root while preserving top and side wisps',()=>{
  const g=createRearHairLiner(defaultHairLayer,.82),p=g.getAttribute('position'),uv=g.getAttribute('uv');
  for(let i=0;i<p.count;i++){
   const sourceY=(424-(1-uv.getY(i))*472)/336*2;
   expect(p.getZ(i)).toBeLessThanOrEqual(0);
   if(sourceY<1.62){expect(p.getY(i)).toBeCloseTo(sourceY,5);expect(p.getX(i)).toBeCloseTo((uv.getX(i)*472-237)/325*1.875,5);}
   if(sourceY>=1.96&&sourceY<=2.12){const crown=Math.sqrt(1-((p.getY(i)-1.25)/.95)**2);expect(Math.abs(p.getX(i))/crown).toBeLessThan(.881);expect((p.getX(i)/(.99*crown))**2+(p.getZ(i)/(.86*.82*crown))**2).toBeLessThan(1);}
   if(sourceY>2.34){expect(p.getY(i)).toBeCloseTo(sourceY-.14,5);expect(p.getY(i)).toBeGreaterThan(2.2);expect(p.getX(i)).toBeCloseTo((uv.getX(i)*472-237)/325*1.875,5);}
  }
  g.dispose();
 });
 it('shares the outer layer length/width/height/distance transforms without altering UVs',()=>{
  const a=createRearHairLiner(defaultHairLayer,.82),b=createRearHairLiner({...defaultHairLayer,length:1.4,width:.7,offsetY:.15,distance:.2},.82);
  const p=a.getAttribute('position'),q=b.getAttribute('position');
  for(let i=0;i<p.count;i++){expect(q.getX(i)).toBeCloseTo(p.getX(i)*.7*1.2,5);expect(q.getY(i)).toBeCloseTo(2.2+(p.getY(i)-2.2)*1.4+.15,5);expect(q.getZ(i)).toBeCloseTo(p.getZ(i)*1.2,5);}
  expect(Array.from(b.getAttribute('uv').array)).toEqual(Array.from(a.getAttribute('uv').array));a.dispose();b.dispose();
 });
});
