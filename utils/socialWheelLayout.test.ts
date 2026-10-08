import {it,expect} from 'vitest';
import {socialWheelLayout} from '../apps/room3d/socialWheelLayout';
it.each([[320,568],[390,844],[844,390],[390,500]])('keeps controls apart and inside a %sx%s viewport',(w,h)=>{
 const n=h<560?3:4;
 for(const x of [0,w/2,w])for(const y of [0,h/2,h]){
  const {points,center}=socialWheelLayout(x,y,w,h,n);
  for(const p of [...points,center]){expect(p.x).toBeGreaterThanOrEqual(45.9);expect(p.x).toBeLessThanOrEqual(w-45.9);expect(p.y).toBeGreaterThanOrEqual(h<560?51.9:95.9);expect(p.y).toBeLessThanOrEqual(h-(h<560?99.9:219.9));}
  for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)expect(Math.abs(points[i].x-points[j].x)>=76||Math.abs(points[i].y-points[j].y)>=76).toBe(true);
 }
});

