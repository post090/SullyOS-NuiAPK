import * as T from 'three';
import {TessellateModifier} from 'three/examples/jsm/modifiers/TessellateModifier.js';
import {mergeVertices,mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Trace all opaque islands and holes; coordinates retain the original canvas registration. */
export function hairContours(alpha:Uint8Array,width:number,height:number){
 // Subpixel contours from a lightly filtered alpha field prevent the raster
 // stair steps from turning into corrugated side walls.
 const field=new Float32Array(alpha.length),kernel=[1,2,1];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  let sum=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(x+dx>=0&&x+dx<width&&y+dy>=0&&y+dy<height)sum+=alpha[(y+dy)*width+x+dx]*kernel[dx+1]*kernel[dy+1];
  field[y*width+x]=sum/16;
 }
 const value=(x:number,y:number)=>x<0||y<0||x>=width||y>=height?0:field[y*width+x];
 const points=new Map<string,T.Vector2>(),edges=new Map<string,string[]>();
 const link=(a:string,b:string)=>{edges.set(a,[...(edges.get(a)??[]),b]);edges.set(b,[...(edges.get(b)??[]),a]);};
 const threshold=100;
 for(let y=-1;y<height;y++)for(let x=-1;x<width;x++){
  const corners=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]],values=corners.map(([cx,cy])=>value(cx,cy)),crossings:Array<{edge:number;key:string}>=[];
  for(let edge=0;edge<4;edge++){
   const next=(edge+1)%4,a=values[edge],b=values[next];if((a>=threshold)===(b>=threshold))continue;
   const t=(threshold-a)/(b-a),[ax,ay]=corners[edge],[bx,by]=corners[next],u=(ax+(bx-ax)*t+.5)/width,v=1-(ay+(by-ay)*t+.5)/height,key=u.toFixed(8)+','+v.toFixed(8);
   points.set(key,new T.Vector2(u,v));crossings.push({edge,key});
  }
  if(crossings.length===2)link(crossings[0].key,crossings[1].key);
  else if(crossings.length===4){
   const center=values.reduce((sum,v)=>sum+v,0)/4;
   const pairs=(center>=threshold)===(values[0]>=threshold)?[[0,1],[2,3]]:[[0,3],[1,2]];
   for(const [a,b] of pairs)link(crossings[a].key,crossings[b].key);
  }
 }
 const loops:T.Vector2[][]=[];
 while(edges.size){
  const start=edges.keys().next().value!,loop:T.Vector2[]=[];let at=start;
  do{
   loop.push(points.get(at)!);const choices=edges.get(at);if(!choices?.length)break;
   const next=choices.pop()!;if(!choices.length)edges.delete(at);
   const reverse=edges.get(next);if(reverse){const index=reverse.indexOf(at);if(index>=0)reverse.splice(index,1);if(!reverse.length)edges.delete(next);}
   at=next;
  }while(at!==start);
  if(at!==start||loop.length<4)continue;
  // Relax residual contour noise without adding vertices or changing registration.
  let smooth=loop;
  for(let pass=0;pass<3;pass++)smooth=smooth.map((p,i)=>p.clone().multiplyScalar(.5).addScaledVector(smooth[(i+smooth.length-1)%smooth.length],.25).addScaledVector(smooth[(i+1)%smooth.length],.25));
  loops.push(smooth);
 }
 return loops;
}

const contains=(poly:T.Vector2[],point:T.Vector2)=>{
 let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[i],b=poly[j];if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }return inside;
};

/** Two matching curved textured faces joined by an untextured rounded rim. */
export function createHairShell(contours:T.Vector2[][],halfDepth:number,maxEdge=.055){
 const loops=contours.map(points=>points.map(p=>new T.Vector2((p.x*472-237)/325*1.875,(424-(1-p.y)*472)/336*2)));
 const entries=loops.map(points=>({points,area:Math.abs(T.ShapeUtils.area(points)),parent:-1,depth:0})).sort((a,b)=>b.area-a.area);
 for(let i=0;i<entries.length;i++){
  for(let j=i-1;j>=0;j--)if(contains(entries[j].points,entries[i].points[0])){entries[i].parent=j;entries[i].depth=entries[j].depth+1;break;}
 }
 const pieces:T.BufferGeometry[]=[];
 entries.forEach((entry,index)=>{
  if(entry.depth%2)return;
  const shape=new T.Shape(entry.points);entries.forEach(hole=>{if(hole.parent===index)shape.holes.push(new T.Path(hole.points));});
  const bounds=new T.Box2().setFromPoints(entry.points),height=bounds.max.y-bounds.min.y;
  // Elliptical horizontal sections follow the tuft's centerline (including a
  // narrow tail below a bun). This is the same paired half-surface construction
  // as the scalp, rather than a silhouette distance/pillow displacement.
  const sections=Array.from({length:129},(_,row)=>{
   const y=bounds.min.y+height*Math.max(.00001,Math.min(.99999,row/128)),xs:number[]=[];
   for(let i=0;i<entry.points.length;i++){const a=entry.points[i],b=entry.points[(i+1)%entry.points.length];if((a.y>y)!==(b.y>y))xs.push(a.x+(b.x-a.x)*(y-a.y)/(b.y-a.y));}
   const min=xs.length?Math.min(...xs):bounds.min.x,max=xs.length?Math.max(...xs):bounds.max.x;
   return {center:(min+max)/2,radius:Math.max(.001,(max-min)/2)};
  });
  const maxRadius=Math.max(...sections.map(s=>s.radius));
  const depth=Math.max(0,halfDepth)*2,bevel=Math.min(.018,depth/4);
  const raw=new T.ExtrudeGeometry(shape,{depth:Math.max(0,depth-2*bevel),steps:1,bevelEnabled:bevel>0,bevelThickness:bevel,bevelSize:bevel,bevelSegments:4,curveSegments:1});
  raw.translate(0,0,-depth/2+bevel);
  for(const group of raw.groups){
   const part=new T.BufferGeometry();
   for(const key of ['position','uv']){const attribute=raw.getAttribute(key);part.setAttribute(key,new T.Float32BufferAttribute(Array.from(attribute.array).slice(group.start*attribute.itemSize,(group.start+group.count)*attribute.itemSize),attribute.itemSize));}
   // Curved faces need interior samples, not just a triangulated boundary.
   const dense=new TessellateModifier(maxEdge,10).modify(part);part.dispose();
   const p=dense.getAttribute('position'),uv=dense.getAttribute('uv');
   for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),row=T.MathUtils.clamp((y-bounds.min.y)/Math.max(.001,height)*128,0,128),low=Math.floor(row),high=Math.min(128,low+1),t=row-low;
    const center=T.MathUtils.lerp(sections[low].center,sections[high].center,t),radius=T.MathUtils.lerp(sections[low].radius,sections[high].radius,t),nx=(x-center)/radius;
    // One smooth ellipsoidal arc per tuft, independent of alpha-edge distances.
    // The two original-image faces share this curve; the plain rim closes them.
    const arc=Math.sqrt(Math.max(.025,1-.975*nx*nx))*radius/maxRadius;
    p.setZ(i,p.getZ(i)*arc);
    if(group.materialIndex===0)uv.setXY(i,(x/1.875*325+237)/472,1-(424-y*336/2)/472);
    else uv.setXY(i,0,0);
   }
   dense.addGroup(0,p.count,group.materialIndex);pieces.push(dense);
  }
  raw.dispose();
 });
 if(!pieces.length)return new T.BufferGeometry();
 const raw=mergeGeometries(pieces,false)!;let start=0;
 for(const piece of pieces){const count=piece.getAttribute('position').count;raw.addGroup(start,count,piece.groups[0].materialIndex);start+=count;piece.dispose();}
 const geometry=mergeVertices(raw,1e-5);raw.dispose();geometry.computeVertexNormals();return geometry;
}
