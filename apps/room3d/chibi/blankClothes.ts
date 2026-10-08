import * as T from 'three';
import {BLANK_SCALE} from './blankBody';
import type {bindBlankBody} from './blankRig';

// A small, editable garment shell. All dimensions are in the source body's units.
export function dressBlankBody(rig:ReturnType<typeof bindBlankBody>){
 const positions:number[]=[],colors:number[]=[],indices:number[]=[],weights:number[]=[];
 const body=rig.mesh.geometry,p=body.attributes.position,si=body.attributes.skinIndex,sw=body.attributes.skinWeight;
 const point=(x:number,y:number,z:number)=>new T.Vector3(x,y+.5+T.MathUtils.clamp(y+.44,0,.30)*.10,z).multiplyScalar(BLANK_SCALE);
 const palette={blue:'#a8b9e8',dark:'#424354',white:'#f3ede6',hem:'#7885b5'};
 const vertex=(v:T.Vector3,color:string,bone?:string)=>{
  positions.push(v.x,v.y,v.z);const c=new T.Color(color);colors.push(c.r,c.g,c.b);
  if(bone){indices.push(rig.skeleton.bones.indexOf(rig.bones[bone]),0,0,0);weights.push(1,0,0,0);return;}
  let nearest=0,distance=Infinity;
  for(let i=0;i<p.count;i++){const d=(p.getX(i)-v.x)**2+(p.getY(i)-v.y)**2+(p.getZ(i)-v.z)**2;if(d<distance){distance=d;nearest=i;}}
  for(let j=0;j<4;j++){indices.push(si.array[nearest*4+j]);weights.push(sw.array[nearest*4+j]);}
 };
 const triangle=(a:T.Vector3,b:T.Vector3,c:T.Vector3,color:string,bone?:string)=>{for(const v of [a,b,c])vertex(v,color,bone);};
 const tube=(rings:T.Vector3[][],color:string,bone?:string)=>{
  for(let r=1;r<rings.length;r++)for(let i=0;i<rings[r].length;i++){
   const next=(i+1)%rings[r].length,a=rings[r-1][i],b=rings[r-1][next],c=rings[r][next],d=rings[r][i];
   triangle(a,b,c,color,bone);triangle(a,c,d,color,bone);
  }
 };
 const ring=(y:number,rx:number,rz:number,n=12)=>Array.from({length:n},(_,i)=>{const a=i/n*Math.PI*2;return point(Math.cos(a)*rx,y,Math.sin(a)*rz);});
 tube([ring(.067,.035,.038),ring(.034,.103,.073),ring(-.06,.094,.068),ring(-.135,.108,.073)],palette.blue,'chest');
 tube([ring(-.13,.109,.074),ring(-.143,.110,.074)],palette.hem,'chest');
 // A single hip-weighted skirt avoids pulling its centre apart between legs.
 tube([ring(-.135,.103,.066),ring(-.225,.144,.089)],palette.dark,'hips');
 tube([ring(-.213,.139,.086),ring(-.222,.143,.089)],palette.blue,'hips');
 for(const side of [-1,1]){
  const sleeve=(x:number,ry:number,rz:number)=>Array.from({length:8},(_,i)=>{const a=i/8*Math.PI*2;return point(side*x,.026+Math.cos(a)*ry,Math.sin(a)*rz);});
  tube([sleeve(.040,.034,.045),sleeve(.085,.054,.062),sleeve(.14,.046,.057),sleeve(.23,.050,.060),sleeve(.322,.060,.063)],palette.blue);
  tube([sleeve(.307,.059,.064),sleeve(.324,.060,.064)],palette.white);
  // Turn the cuff inward so its opening reads as cloth rather than a solid cap.
  tube([sleeve(.324,.060,.064),sleeve(.324,.052,.056)],palette.hem);
 }
 const patch=(coords:number[][],color:string,bone='chest')=>{coords=coords.map(([x,y,z])=>[x,y,Math.max(.083,z+.017)]);for(let i=1;i<coords.length-1;i++)triangle(point(...coords[0] as [number,number,number]),point(...coords[i] as [number,number,number]),point(...coords[i+1] as [number,number,number]),color,bone);};
 patch([[-.027,.057,.036],[-.058,.030,.052],[-.022,.004,.059],[0,.034,.058]],palette.white);
 patch([[.027,.057,.036],[0,.034,.058],[.022,.004,.059],[.058,.030,.052]],palette.white);
 patch([[0,.032,.061],[-.012,.012,.063],[0,-.004,.065],[.012,.012,.063]],palette.dark);
 patch([[0,-.003,.065],[-.011,-.083,.063],[0,-.106,.064],[.011,-.083,.063]],palette.dark);
 // Clip the fitted shells at level hems instead of exposing triangle-shaped edges.
 const originalIndex=body.index!;
 const clip=(poly:T.Vector3[],height:number,below:boolean)=>{
  const result:T.Vector3[]=[];
  for(let i=0;i<poly.length;i++){
   const a=poly[i],b=poly[(i+1)%poly.length],inside=(v:T.Vector3)=>below?v.y<=height:v.y>=height;
   if(inside(a))result.push(a);
   if(inside(a)!==inside(b))result.push(a.clone().lerp(b,(height-a.y)/(b.y-a.y)));
  }return result;
 };
 for(let i=0;i<originalIndex.count;i+=3){
  const ids=[0,1,2].map(j=>originalIndex.getX(i+j));
  if(ids.every(id=>p.getY(id)>.268*BLANK_SCALE))continue;
  const poly=ids.map(id=>{
   const x=p.getX(id),center=Math.sign(x)*.054*BLANK_SCALE,v=new T.Vector3(center+(x-center)*1.09,p.getY(id),p.getZ(id)*1.09);
   return v;
  });
  for(const [bottom,top,color] of [[-1,.054,palette.dark],[.054,.268,palette.blue]] as const){
   const clipped=clip(clip(poly,top*BLANK_SCALE,true),bottom*BLANK_SCALE,false);
   for(let j=1;j<clipped.length-1;j++)triangle(clipped[0],clipped[j],clipped[j+1],color);
  }
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));geometry.computeVertexNormals();
 const material=new T.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,side:T.DoubleSide,flatShading:true});
 const mesh=new T.SkinnedMesh(geometry,material);mesh.name='blank-lowpoly-outfit';mesh.frustumCulled=false;
 rig.mesh.parent!.add(mesh);mesh.bind(rig.skeleton,rig.mesh.bindMatrix);mesh.bindMode=rig.mesh.bindMode;
 // Keep exposed head, hands and thighs; hide covered skin to prevent poke-through.
 const savedIndex=body.index!.clone(),savedGroups=body.groups.map(g=>({...g}));
 const masked:number[]=[],groups:typeof body.groups=[];
 for(const group of savedGroups){const start=masked.length;
  for(let i=group.start;i<group.start+group.count;i+=3){const ids=[0,1,2].map(j=>savedIndex.getX(i+j));
   const covered=ids.every(id=>{const y=p.getY(id)/BLANK_SCALE-.53,x=Math.abs(p.getX(id))/BLANK_SCALE;return (y>-.20&&y<.060&&x<.10)||(x>=.082&&x<.30&&y>-.06&&y<.062);});
   if(!covered)masked.push(...ids);
  }groups.push({start,count:masked.length-start,materialIndex:group.materialIndex});
 }
 const setVisible=(visible:boolean)=>{mesh.visible=visible;body.setIndex(visible?masked:savedIndex);body.clearGroups();for(const g of visible?groups:savedGroups)body.addGroup(g.start,g.count,g.materialIndex);};
 setVisible(true);
 return {mesh,setVisible,resources:[geometry,material]};
}
