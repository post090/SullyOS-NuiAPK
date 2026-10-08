import {describe,it,expect} from 'vitest';
import * as T from 'three';
import {createHairSeam} from '../apps/room3d/chibi/hairSeam';
describe('mirrored hair seam lighting',()=>{
 for(const side of [-1,1] as const)it(`keeps all nondegenerate triangles outward on side ${side}`,()=>{
  const g=createHairSeam(side,.82),p=g.getAttribute('position'),index=g.index!;
  let inward=0,triangles=0,earCovered=0;
  for(let i=0;i<index.count;i+=3){
   const a=new T.Vector3().fromBufferAttribute(p,index.getX(i)),b=new T.Vector3().fromBufferAttribute(p,index.getX(i+1)),c=new T.Vector3().fromBufferAttribute(p,index.getX(i+2));
   const cross=b.clone().sub(a).cross(c.clone().sub(a));if(cross.lengthSq()<1e-15)continue;
   const center=a.clone().add(b).add(c).multiplyScalar(1/3);
   const outward=new T.Vector3(center.x/(.984*.984),Math.max(0,center.y-1.25)/(.95*.95),center.z/(.854*.82)**2);
   if(cross.dot(outward)<=0)inward++;triangles++;
   if(((center.y-1.045)/.175)**2+(center.z/(.205*.82))**2<1)earCovered++;
  }
  expect(triangles).toBeGreaterThan(4000);expect(inward).toBe(0);expect(earCovered).toBe(0);g.dispose();
 });
});
