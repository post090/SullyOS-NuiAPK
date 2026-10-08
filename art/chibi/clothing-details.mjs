import * as T from 'three';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';

const unitWeights = entries => {
 const sorted=[...entries].filter(([,w])=>w>1e-8).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=sorted.reduce((s,[,w])=>s+w,0);
 return Array.from({length:4},(_,i)=>[sorted[i]?.[0]??0,(sorted[i]?.[1]??0)/sum]);
};

// Interpolate the triangle actually touched by the garment. In particular,
// boots need the body's thigh/shin blend at the knee, not a rigid shin weight.
export function surfaceBinding(body) {
 const geometry=body.geometry,surface=new T.Mesh(geometry,new T.MeshBasicMaterial({side:T.DoubleSide})),ray=new T.Raycaster();surface.updateMatrixWorld();
 const p=geometry.attributes.position,si=geometry.attributes.skinIndex,sw=geometry.attributes.skinWeight;
 const bone=name=>body.skeleton.bones.findIndex(b=>b.name===name);
 function cast(origin,direction,far=2){ray.set(origin,direction.clone().normalize());ray.far=far;return ray.intersectObject(surface)[0];}
 function weights(hit){
  const ids=[hit.face.a,hit.face.b,hit.face.c],pts=ids.map(i=>new T.Vector3().fromBufferAttribute(p,i));
  const bary=T.Triangle.getBarycoord(hit.point,...pts,new T.Vector3()).toArray(),map=new Map();
  for(let n=0;n<3;n++)for(let k=0;k<4;k++){const j=si.array[ids[n]*4+k],w=sw.array[ids[n]*4+k]*bary[n];map.set(j,(map.get(j)??0)+w);}
  return unitWeights(map);
 }
 function leg(point,ownerSign=Math.sign(point.x)){
  const side=ownerSign<0?'R':'L',center=new T.Vector3(ownerSign*.259534,point.y,.045),dir=point.clone().sub(center);dir.y=0;
  if(dir.lengthSq()<1e-8)dir.z=1;
  const hit=cast(center,dir,.65),foot=bone(side+'_foot');
  if(!hit||point.y<.25)return [[foot,1],[0,0],[0,0],[0,0]];
  const blend=T.MathUtils.smoothstep(point.y,.25,.48),map=new Map([[foot,1-blend]]);
  for(const[j,w]of weights(hit))map.set(j,(map.get(j)??0)+blend*w);
  return unitWeights(map);
 }
 function front(x,y,clearance=.035){const hit=cast(new T.Vector3(x,y,1),new T.Vector3(0,0,-1));return {point:new T.Vector3(x,y,(hit?.point.z??.2)+clearance),weights:hit?weights(hit):[[bone('chest'),1],[0,0],[0,0],[0,0]]};}
 function bootLeg(point,ownerSign=Math.sign(point.x)){
  const side=ownerSign<0?'R':'L',shin=T.MathUtils.smoothstep(point.y,.22,.50),thigh=T.MathUtils.smoothstep(point.y,.88,1.18);
  // Every vertex on a horizontal ring has the same leg-bone blend. Sampling
  // the body's irregular source weights around the ring makes the back rim
  // serrated under flexion. Above the knee transition it follows the thigh.
  return unitWeights([[bone(side+'_foot'),1-shin],[bone(side+'_shin'),shin*(1-thigh)],[bone(side+'_thigh'),shin*thigh]]);
 }
 return {cast,weights,leg,bootLeg,front,bone,body};
}

export function bindGeometry(g,weightsAt){
 g.deleteAttribute('uv');const joints=[],weights=[],p=g.attributes.position;
 for(let i=0;i<p.count;i++)for(const[j,w]of weightsAt(new T.Vector3().fromBufferAttribute(p,i),i)){joints.push(j);weights.push(w);}
 g.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));g.computeVertexNormals();return g;
}

export function rebuildBootShaft(geometries,binding,top){
 // The doll has straight legs. Use one constant cross-section all the way
 // down the shaft, with sock-like skinning. No calf bulge / ankle taper,
 // and no separate irregular polygon connector halfway down the boot.
 return geometries.map(foot=>{
  const p=foot.attributes.position;foot.computeBoundingBox();const sign=Math.sign(foot.boundingBox.getCenter(new T.Vector3()).x);
  const anklePoints=[];for(let i=0;i<p.count;i++)if(Math.abs(p.getY(i)-.5)<1e-5)anklePoints.push(new T.Vector3().fromBufferAttribute(p,i));
  const ankleX=(Math.min(...anklePoints.map(v=>v.x))+Math.max(...anklePoints.map(v=>v.x)))/2,ankleZ=(Math.min(...anklePoints.map(v=>v.z))+Math.max(...anklePoints.map(v=>v.z)))/2;
  const samples=[];for(const y of [.55,.8,top])for(let i=0;i<48;i++){const a=2*Math.PI*i/48,hit=binding.cast(new T.Vector3(sign*.259534,y,.045),new T.Vector3(Math.cos(a),0,Math.sin(a)),.6);if(hit)samples.push(hit.point);}
  const box=new T.Box3().setFromPoints(samples),center=box.getCenter(new T.Vector3()),cx=center.x,cz=center.z,rx0=(box.max.x-box.min.x)/2,rz0=(box.max.z-box.min.z)/2;
  const envelope=Math.max(...samples.map(v=>Math.hypot((v.x-cx)/rx0,(v.z-cz)/rz0))),rx=rx0*envelope+.012,rz=rz0*envelope+.012;
  const angle=v=>Math.atan2(v.z-ankleZ,v.x-ankleX),angles=anklePoints.map(angle).sort((a,b)=>a-b),levels=[.5,.62,.74,.86,.98,1.10,1.18].filter(y=>y<top-1e-5).concat(top);
  if(angles.length<12)throw Error('Missing boot ankle perimeter');
  // Match the foot's cut edge to exactly the SAME cross-section as the shaft.
  // Only the upper foot moves; the authored sole and toe remain in place.
  for(let i=0;i<p.count;i++){
   const v=new T.Vector3().fromBufferAttribute(p,i),a=angle(v),t=T.MathUtils.smoothstep(v.y,.18,.38);
   let x=T.MathUtils.lerp(v.x,cx+rx*Math.cos(a),t),z=T.MathUtils.lerp(v.z,cz+rz*Math.sin(a),t);
   // The imported ankle is narrower than the straight doll leg. Remove that
   // remaining inward notch before it reaches the shaft, preserving the toe.
   const radius=Math.hypot((x-cx)/rx,(z-cz)/rz);
   if(radius>1e-6&&radius<1){const fill=T.MathUtils.smoothstep(v.y,.18,.30),scale=T.MathUtils.lerp(1,1/radius,fill);x=cx+(x-cx)*scale;z=cz+(z-cz)*scale;}
   p.setX(i,x);p.setZ(i,z);
  }
  // Keep the front silhouette straight as well: the source instep moves
  // forward, so a radial fill alone can still leave its side edges pinched.
  const edgeIndices=foot.index?.array??Array.from({length:p.count},(_,i)=>i),original=p.clone(),widths=new Map();
  for(let i=0;i<p.count;i++){
   const y=original.getY(i);if(y<=.18||y>=.5-1e-5)continue;
   if(!widths.has(y)){
    let lo=Infinity,hi=-Infinity;
    for(let j=0;j<edgeIndices.length;j+=3)for(let k=0;k<3;k++){
     const a=edgeIndices[j+k],b=edgeIndices[j+(k+1)%3],ay=original.getY(a),by=original.getY(b);
     if(y<Math.min(ay,by)||y>Math.max(ay,by))continue;
     const x=Math.abs(by-ay)<1e-8?original.getX(a):T.MathUtils.lerp(original.getX(a),original.getX(b),(y-ay)/(by-ay));lo=Math.min(lo,x);hi=Math.max(hi,x);
    }
    widths.set(y,{mid:(lo+hi)/2,half:(hi-lo)/2});
   }
   const {mid,half}=widths.get(y),fill=T.MathUtils.smoothstep(y,.18,.30);
   if(half>1e-6){const target=cx+(original.getX(i)-mid)*Math.max(half,rx)/half;p.setX(i,T.MathUtils.lerp(original.getX(i),target,fill));}
  }
  bindGeometry(foot,v=>binding.bootLeg(v,sign));
  const positions=[],indices=[],n=angles.length;
  for(const y of levels)for(const a of angles)positions.push(cx+rx*Math.cos(a),y,cz+rz*Math.sin(a));
  for(const a of angles)positions.push(cx+(rx-.007)*Math.cos(a),top,cz+(rz-.007)*Math.sin(a));
  const quad=(a,b,c,d)=>indices.push(a,b,d,b,c,d);
  for(let j=0;j<levels.length-1;j++)for(let i=0;i<n;i++){const k=(i+1)%n;quad(j*n+i,(j+1)*n+i,(j+1)*n+k,j*n+k);}
  const last=(levels.length-1)*n,inner=levels.length*n;for(let i=0;i<n;i++){const k=(i+1)%n;quad(last+i,inner+i,inner+k,last+k);}
  const shaft=new T.BufferGeometry();shaft.setAttribute('position',new T.Float32BufferAttribute(positions,3));shaft.setIndex(indices);bindGeometry(shaft,v=>binding.bootLeg(v,sign));
  const base=foot.clone();base.deleteAttribute('normal');shaft.deleteAttribute('normal');const merged=mergeVertices(mergeGeometries([base,shaft],false),1e-5);merged.computeVertexNormals();
  // Non-uniform source edge spacing must not create alternating dark fans.
  // The straight elliptical surface has an exact continuous normal field.
  const mp=merged.attributes.position,mn=merged.attributes.normal;for(let i=0;i<mp.count;i++)if(mp.getY(i)>.24){const normal=new T.Vector3((mp.getX(i)-cx)/(rx*rx),0,(mp.getZ(i)-cz)/(rz*rz)).normalize(),existing=new T.Vector3().fromBufferAttribute(mn,i);existing.lerp(normal,T.MathUtils.smoothstep(mp.getY(i),.24,.38)).normalize();mn.setXYZ(i,existing.x,existing.y,existing.z);}
  merged.userData.straightShaft={cx,cz,rx,rz,low:.5,top};return merged;
 });
}

export function apronStraps(binding){
 const strips=[];
 for(const sign of [-1,1]){
  const pos=[],idx=[],skin=[],rows=32,cols=4;
  // A closed, thin ribbon over the actual shoulder cross-section. Both ends
  // overlap the retained bib/back, so there is no exposed join at the chest.
  for(let layer=0;layer<2;layer++)for(let r=0;r<=rows;r++)for(let c=0;c<=cols;c++){
   const theta=-1.08+(Math.PI+2.16)*r/rows,x=sign*(.252+(c/cols-.5)*.105),origin=new T.Vector3(x,3.09,.035),dir=new T.Vector3(0,Math.sin(theta),Math.cos(theta));
   const hit=binding.cast(origin,dir,.9),point=(hit?.point??origin.clone().addScaledVector(dir,.27)).clone().addScaledVector(dir,.04+layer*.009);
   pos.push(...point.toArray());skin.push(hit?binding.weights(hit):binding.front(x,point.y).weights);
  }
  const width=cols+1,size=(rows+1)*width;
  const quad=(a,b,c,d)=>idx.push(a,b,d,b,c,d);
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const a=r*width+c;quad(a,a+width,a+width+1,a+1);quad(a+size,a+size+1,a+size+width+1,a+size+width);}
  for(let r=0;r<rows;r++)for(const c of [0,cols]){const a=r*width+c;quad(a,a+size,a+size+width,a+width);}
  for(const r of [0,rows])for(let c=0;c<cols;c++){const a=r*width+c;quad(a,a+1,a+1+size,a+size);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);strips.push(bindGeometry(g,(_,i)=>skin[i]));
 }
 return mergeGeometries(strips,false);
}

export function bootLaces(bootGeometries,binding){
 const boots=new T.Mesh(mergeGeometries(bootGeometries.map(g=>{const copy=g.clone();copy.deleteAttribute('skinIndex');copy.deleteAttribute('skinWeight');return copy;}),false),new T.MeshBasicMaterial({side:T.DoubleSide}));boots.updateMatrixWorld();
 const ray=new T.Raycaster(),cords=[],eyelets=[];
 function zAt(x,y){ray.set(new T.Vector3(x,y,1),new T.Vector3(0,0,-1));return (ray.intersectObject(boots)[0]?.point.z??.20)+.014;}
 const tube=(pts,r=.009,segments=4)=>new T.TubeGeometry(new T.CatmullRomCurve3(pts),segments,r,4,false);
 for(const sign of [-1,1]){
  const cx=sign*.2595,levels=[.32,.435,.55,.665,.78,.885],half=.058;
  const at=(x,y,extra=0)=>new T.Vector3(x,y,zAt(x,y)+extra);
  for(const y of levels)for(const side of [-1,1]){const p=at(cx+side*half,y,-.008),g=new T.TorusGeometry(.016,.0045,3,6);g.translate(...p.toArray());eyelets.push(g);}
  for(let i=0;i<levels.length-1;i++)for(const direction of [-1,1]){
   const pts=[];for(let k=0;k<=4;k++){const t=k/4,x=cx+direction*half*(1-2*t),y=T.MathUtils.lerp(levels[i],levels[i+1],t);pts.push(at(x,y,.006+(direction===1?.010:0)*Math.sin(Math.PI*t)));}cords.push(tube(pts));
  }
  const y=.907,z=zAt(cx,y)+.027;
  for(const direction of [-1,1]){
   cords.push(tube([[0,0,0],[direction*.05,.035,.006],[direction*.078,.009,.002],[direction*.034,-.006,0],[0,0,0]].map(([x,dy,dz])=>new T.Vector3(cx+x,y+dy,z+dz)),.008,8));
   cords.push(tube([new T.Vector3(cx,y,z),at(cx+direction*.023,y-.045,.025),at(cx+direction*.034,y-.085,.02)],.008,4));
  }
 }
 return [cords,eyelets].map(gs=>bindGeometry(mergeGeometries(gs.map(g=>{g.deleteAttribute('uv');return g;}),false),p=>binding.bootLeg(p)));
}

// Small authored neck accessories: no source mesh, raster maps or hidden body.
export function neckwear(kind,binding){
 const pieces=[];
 function shape(points,depth=.025){const s=new T.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();const g=new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelThickness:.007,bevelSize:.007,bevelSegments:2,steps:1});
  const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);p.setZ(i,p.getZ(i)+binding.front(x,y,.048).point.z);}g.deleteAttribute('uv');return g.index?g.toNonIndexed():g;}
 if(kind==='necktie'){
  pieces.push(shape([[-.045,3.085],[.045,3.085],[.087,2.61],[0,2.52],[-.087,2.61]]));
  pieces.push(shape([[-.061,3.18],[.061,3.18],[.042,3.085],[-.042,3.085]],.038));
 }else{
  for(const sign of [-1,1]){
   const g=shape([[sign*.027,3.125],[sign*.205,3.225],[sign*.235,3.20],[sign*.235,3.045],[sign*.195,3.025],[sign*.027,3.10]],.027),p=g.attributes.position;
   for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);p.setZ(i,p.getZ(i)+.025*Math.sin(Math.PI*T.MathUtils.clamp(Math.abs(x)/.24,0,1))+.013*Math.abs(y-3.125)/.1);}pieces.push(g);
  }
  pieces.push(shape([[-.037,3.17],[.037,3.17],[.042,3.08],[-.042,3.08]],.065));
 }
 const merged=mergeGeometries(pieces,false);merged.setIndex(Array.from({length:merged.attributes.position.count},(_,i)=>i));
 return bindGeometry(merged,p=>binding.front(p.x,p.y).weights);
}
