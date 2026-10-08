import {describe,it,expect} from 'vitest';
import {silhouetteDepth} from '../apps/room3d/chibi/puff';
describe('padded hair silhouette',()=>{
 it('does not introduce a directional ridge on mirrored rounded tufts',()=>{
  const width=49,height=49,alpha=new Uint8Array(width*height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(((x-24)/19)**2+((y-24)/16)**2<1)alpha[y*width+x]=255;
  const depth=silhouetteDepth(alpha,width,height);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   expect(depth[y*width+x]).toBeCloseTo(depth[y*width+width-1-x],5);
   expect(depth[y*width+x]).toBeGreaterThanOrEqual(0);
   expect(depth[y*width+x]).toBeLessThanOrEqual(1);
  }
  expect(depth[24*width+24]-depth[24*width+23]).toBeLessThan(.01);
 });
 it('keeps the edge thin and raises the opaque center',()=>{
  const a=new Uint8Array(81);for(let y=1;y<8;y++)for(let x=1;x<8;x++)a[y*9+x]=255;
  const d=silhouetteDepth(a,9,9);expect(d[4*9+4]).toBeCloseTo(1);expect(d[9+1]).toBe(0);expect(d[0]).toBe(0);
 });
 it('inflates separate small and large tufts independently and preserves holes',()=>{
  const a=new Uint8Array(20*12);for(let y=1;y<6;y++)for(let x=1;x<6;x++)a[y*20+x]=255;for(let y=1;y<10;y++)for(let x=9;x<18;x++)a[y*20+x]=255;
  const d=silhouetteDepth(a,20,12);expect(d[3*20+3]).toBe(1);expect(d[5*20+13]).toBe(1);expect(d[5*20+7]).toBe(0);
  a[5*20+13]=0;expect(silhouetteDepth(a,20,12)[5*20+13]).toBe(0);
 });
});
