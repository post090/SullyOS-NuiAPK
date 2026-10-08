import * as T from 'three';

// Centers of the five authored digits, in unscaled right-facing bind coordinates.
// Short chibi fingers use two joints each; the thumb has its own diagonal axis.
export const BLANK_FINGERS=[
 {name:'thumb',label:'拇指',start:[.313,.079,.023],tip:[.333,.077,.050],radius:.008},
 {name:'index',label:'食指',start:[.337,.086,.025],tip:[.370,.086,.032],radius:.0075},
 {name:'middle',label:'中指',start:[.342,.086,.008],tip:[.378,.086,.010],radius:.0078},
 {name:'ring',label:'无名指',start:[.340,.086,-.009],tip:[.373,.086,-.013],radius:.0076},
 {name:'pinky',label:'小指',start:[.333,.085,-.024],tip:[.360,.085,-.033],radius:.0072},
] as const;
export type HandSide='L'|'R';

/** Restrict finger influence to its own capsule; leave the wrist/palm on hand. */
export function fingerWeights(x:number,y:number,z:number){
 if(x<.305)return null;
 let closest:typeof BLANK_FINGERS[number]|undefined,best=Infinity,along=0;
 for(const finger of BLANK_FINGERS){
  const [ax,ay,az]=finger.start,[bx,by,bz]=finger.tip,dx=bx-ax,dy=by-ay,dz=bz-az;
  const t=((x-ax)*dx+(y-ay)*dy+(z-az)*dz)/(dx*dx+dy*dy+dz*dz),tc=T.MathUtils.clamp(t,0,1);
  const distance=Math.hypot(x-ax-dx*tc,y-ay-dy*tc,z-az-dz*tc)/finger.radius;
  if(distance<best){best=distance;closest=finger;along=t;}
 }
 if(!closest)return null;
 const weight=T.MathUtils.smoothstep(along,-.12,.30)*(1-T.MathUtils.smoothstep(best,1.25,2));
 const distal=T.MathUtils.smoothstep(along,.40,.76);
 return {name:closest.name,weight,distal};
}
