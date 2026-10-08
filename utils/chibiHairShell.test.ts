import {describe,it,expect} from 'vitest';
import {createHairShell,hairContours} from '../apps/room3d/chibi/hairShell';

function mask(hole=false){const a=new Uint8Array(48*48);for(let y=0;y<48;y++)for(let x=0;x<48;x++){const r=((x-23.5)/18)**2+((y-23.5)/19)**2;if(r<1&&(!hole||r>.16))a[y*48+x]=255;}return a;}
describe('paired curved hair sheets',()=>{
 it('traces separate islands and holes without connecting transparent space',()=>{
  expect(hairContours(mask(true),48,48)).toHaveLength(2);
  const a=new Uint8Array(48*48);for(let y=4;y<18;y++)for(let x=4;x<18;x++){a[y*48+x]=255;a[(y+22)*48+x+22]=255;}
  expect(hairContours(a,48,48)).toHaveLength(2);
 });
 it('keeps front and rear on opposite arcs, reuses source UVs, and separates the plain rim',()=>{
  const g=createHairShell(hairContours(mask(),48,48),.18),p=g.getAttribute('position'),uv=g.getAttribute('uv'),indices=g.index!;
  const cap=new Set<number>(),rim=new Set<number>();
  for(const group of g.groups)for(let i=group.start;i<group.start+group.count;i++)(group.materialIndex===0?cap:rim).add(indices.getX(i));
  expect(rim.size).toBeGreaterThan(0);let front=0,back=0,min=1,max=0;
  for(const i of cap){
   const z=p.getZ(i);if(z>0)front++;if(z<0)back++;min=Math.min(min,Math.abs(z));max=Math.max(max,Math.abs(z));
   expect(uv.getX(i)).toBeCloseTo((p.getX(i)/1.875*325+237)/472,5);
   expect(uv.getY(i)).toBeCloseTo(1-(424-p.getY(i)*336/2)/472,5);
  }
  expect(front).toBe(back);expect(max-min).toBeGreaterThan(.12);expect(max).toBeLessThanOrEqual(.181);
  for(const i of rim){expect(uv.getX(i)).toBe(0);expect(uv.getY(i)).toBe(0);}
  for(const v of g.getAttribute('normal').array)expect(Number.isFinite(v)).toBe(true);
  g.dispose();
 });
 it('keeps holes clear in the two image surfaces',()=>{
  const g=createHairShell(hairContours(mask(true),48,48),.16),uv=g.getAttribute('uv'),index=g.index!;
  for(const group of g.groups)if(group.materialIndex===0)for(let i=group.start;i<group.start+group.count;i+=3){
   const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2),x=(uv.getX(a)+uv.getX(b)+uv.getX(c))/3,y=(uv.getY(a)+uv.getY(b)+uv.getY(c))/3;
   expect(Math.hypot(x-.5,y-.5)).toBeGreaterThan(.11);
  }
  g.dispose();
 });
 it('supports empty art and zero thickness without invalid coordinates',()=>{
  const empty=createHairShell([],0);expect(empty.getAttribute('position')).toBeUndefined();empty.dispose();
  const g=createHairShell(hairContours(mask(),48,48),0);for(const v of g.getAttribute('position').array)expect(Number.isFinite(v)).toBe(true);g.dispose();
 });
});
