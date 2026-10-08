/** Smooth normalized padding depth; transparent pixels and joining edges stay flat. */
export function silhouetteDepth(alpha:Uint8Array,width:number,height:number){
 const d=new Float32Array(alpha.length);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=y*width+x;d[i]=alpha[i]<64||x===0||y===0||x===width-1||y===height-1?0:width+height;}
 for(let y=1;y<height;y++)for(let x=0;x<width;x++){const i=y*width+x;d[i]=Math.min(d[i],x>0?d[i-1]+1:Infinity,d[i-width]+1,x>0?d[i-width-1]+Math.SQRT2:Infinity,x<width-1?d[i-width+1]+Math.SQRT2:Infinity);}
 for(let y=height-2;y>=0;y--)for(let x=width-1;x>=0;x--){const i=y*width+x;d[i]=Math.min(d[i],x<width-1?d[i+1]+1:Infinity,d[i+width]+1,x<width-1?d[i+width+1]+Math.SQRT2:Infinity,x>0?d[i+width-1]+Math.SQRT2:Infinity);}
 // Smooth depth only: the original alpha silhouette and painted strands stay
 // untouched. Round the crest instead of amplifying pixel steps with sqrt.
 let soft=Float32Array.from(d,v=>Math.max(0,v-1));
 const kernel=[1,4,6,4,1];
 for(let pass=0;pass<2;pass++)for(const vertical of [false,true]){
  const next=new Float32Array(d.length);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   let sum=0;for(let k=-2;k<=2;k++){const sx=x+(vertical?0:k),sy=y+(vertical?k:0);if(sx>=0&&sx<width&&sy>=0&&sy<height)sum+=soft[sy*width+sx]*kernel[k+2];}
   next[y*width+x]=sum/16;
  }
  soft=next;
 }
 // The outermost opaque row joins at zero thickness. Each disconnected piece
 // gets its own maximum, so a little hair bun can be as plump as a large tail.
 const seen=new Uint8Array(alpha.length);
 for(let start=0;start<d.length;start++){if(seen[start]||alpha[start]<64)continue;const component=[start];seen[start]=1;let max=0;
  for(let k=0;k<component.length;k++){const i=component[k];max=Math.max(max,d[i]);const x=i%width,y=Math.floor(i/width);for(const n of [x>0?i-1:-1,x<width-1?i+1:-1,y>0?i-width:-1,y<height-1?i+width:-1])if(n>=0&&!seen[n]&&alpha[n]>=64){seen[n]=1;component.push(n);}}
  const peak=component.reduce((peak,i)=>Math.max(peak,d[i]>1?soft[i]:0),0);
  for(const i of component){
   const edge=Math.min(1,Math.max(0,(d[i]-1)/2));
   d[i]=max>1&&peak>0?Math.sin(Math.PI*.5*Math.min(1,soft[i]/peak))*edge*edge*(3-2*edge):0;
  }
 }
 return d;
}
