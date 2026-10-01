import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {gardenGroundHeight, gardenSurfaceHeight, riverCenter, coastEdge, lavaCenter, COAST_LANDMARKS, VOLCANO_LANDMARKS} from '../../../utils/vrWorld/dinosaurTerrain';
import type {GardenTheme} from '../../../utils/vrWorld/dinosaurTypes';

/** Separate art compositions; only the geometry baker and tray are shared. */
export function makeLandscape(theme:GardenTheme) {
  const pieces:T.BufferGeometry[]=[];
  const ground=(x:number,z:number)=>gardenGroundHeight(x,z,theme);
  const surface=(x:number,z:number)=>gardenSurfaceHeight(x,z,theme);
  function add(source:T.BufferGeometry,color:string,p=[0,0,0],scale=[1,1,1],rotation=[0,0,0]) {
    const geo=source.index?source.toNonIndexed():source;if(source!==geo)source.dispose();
    geo.applyMatrix4(new T.Matrix4().compose(new T.Vector3(...p),new T.Quaternion().setFromEuler(new T.Euler(...rotation)),new T.Vector3(...scale)));
    const c=new T.Color(color),colors:number[]=[];
    for(let i=0;i<geo.getAttribute('position').count;i++)colors.push(c.r,c.g,c.b);
    geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.deleteAttribute('uv');pieces.push(geo);
  }
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:string,ry=0)=>add(new RoundedBoxGeometry(w,h,d,1,Math.min(.035,w/3,h/3,d/3)),c,[x,y,z],[1,1,1],[0,ry,0]);
  const ball=(x:number,y:number,z:number,s:number[],c:string)=>add(new T.SphereGeometry(1,10,7),c,[x,y,z],s);
  const cylinder=(x:number,y:number,z:number,r:number,h:number,c:string,rt=r)=>add(new T.CylinderGeometry(rt,r,h,12),c,[x,y,z]);
  const tube=(points:number[][],r:number,c:string)=>add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),18,r,5,false),c);
  const ring=(x:number,y:number,z:number,r:number,thick:number,c:string,flat=true)=>add(new T.TorusGeometry(r,thick,6,20),c,[x,y,z],[1,1,1],flat?[-Math.PI/2,0,0]:[0,0,0]);

  const terrain=new T.PlaneGeometry(8.3,9.25,36,40);terrain.rotateX(-Math.PI/2);
  const pos=terrain.getAttribute('position'),colors:number[]=[];
  for(let i=0;i<pos.count;i++) {
    const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,ground(x,z));
    let tone:string;
    if(theme==='grassland')tone=Math.abs(x-riverCenter(z))<.8||Math.abs(z-(1+Math.sin(x*.7)*.8))<.38?'#dec89b':z<-2?'#96ae74':'#aac188';
    else if(theme==='coast')tone=x>coastEdge(z)-.3?'#e8d9b4':z<-2.8&&x<-2.2?'#cfc399':'#e0cca0';
    else tone=Math.abs(x-lavaCenter(z))<.65?'#b9a198':Math.sin(x*2+z*3)>.7?'#b8afa2':'#a6a49b';
    const color=new T.Color(tone).multiplyScalar(1+Math.sin(x*7+z*11)*.018);colors.push(color.r,color.g,color.b);
  }
  terrain.computeVertexNormals();terrain.setAttribute('color',new T.Float32BufferAttribute(colors,3));terrain.deleteAttribute('uv');pieces.push(terrain.toNonIndexed());terrain.dispose();

  function ribbon(edge:(z:number)=>[number,number],color:string,y:(x:number,z:number)=>number,from=-4.55,to=4.55) {
    const vertices:number[]=[];
    for(let i=0;i<55;i++){
      const z=from+i*(to-from)/55,z2=z+(to-from)/55,[l,r]=edge(z),[l2,r2]=edge(z2);
      vertices.push(l,y(l,z),z,l2,y(l2,z2),z2,r,y(r,z),z,r,y(r,z),z,l2,y(l2,z2),z2,r2,y(r2,z2),z2);
    }
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();add(geo,color);
  }

  function grassland() {
    ribbon(z=>[riverCenter(z)-.44,riverCenter(z)+.44],'#83b8ac',()=>.12);
    for(let i=0;i<15;i++){
      const z=-4.1+i*.58,x=riverCenter(z);if(Math.abs(z-.25)<.6)continue;
      box(x+Math.sin(i*3)*.14,.128,z,.16+i%3*.07,.01,.025,'#d0e1cb');
      for(const side of [-1,1]){const rx=x+side*(.57+i%2*.06);ball(rx,ground(rx,z)+.04,z,[.10+i%3*.025,.07,.09],i%2?'#c4c4ab':'#a6af99');}
    }
    // The grassland alone has a footbridge over its stream.
    const bx=riverCenter(.25);
    for(let i=0;i<12;i++){const x=bx-1.1+i*.2;box(x,surface(x,.25)-.045,.25,.188,.09,.87,i%3?'#caa877':'#ddbf8e');}
    for(const side of [-1,1]){const z=.25+side*.43;for(const dx of [-1.02,1.02])box(bx+dx,.48,z,.05,.44,.05,'#ac9068');tube([[bx-1.02,.7,z],[bx,.77,z],[bx+1.02,.7,z]],.022,'#e1d0a6');}
    for(let i=0;i<9;i++){const x=-3.75+i*.44,z=-4.15,y=ground(x,z);box(x,y+.27,z,.1,.55+i%2*.04,.1,'#d2b78b');if(i<8)for(const h of [.18,.38])box(x+.22,y+h,z,.46,.062,.07,'#c4a474');}
    for(const x of [-1.3,3.3])box(x,.85,-3.93,.06,1.6,.06,'#aa8b64');
    tube([[-1.3,1.65,-3.93],[1,1.3,-3.93],[3.3,1.65,-3.93]],.014,'#a79a7a');
    for(let i=0;i<9;i++){const x=-1.08+i*.48,y=1.3+.28*((x-1)/2.3)**2;const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([x,y,-3.93,x+.23,y,-3.93,x+.11,y-.23,-3.93,x+.11,y-.23,-3.93,x+.23,y,-3.93,x,y,-3.93],3));geo.computeVertexNormals();add(geo,['#ce9b91','#e3c185','#88ad9d'][i%3]);}
    for(let i=0;i<25;i++){
      const x=i%2?-3.65+i%5*.14:3.6-i%4*.1,z=-3.6+(i*1.23)%7.5,y=ground(x,z);
      for(let j=0;j<3;j++)add(new T.ConeGeometry(.034,.2,4),'#81985f',[x+j*.055,y+.1,z+j*.035]);
      if(i%3===0){box(x,y+.16,z,.02,.27,.02,'#8b9f64');for(let j=0;j<5;j++)ball(x+Math.cos(j*1.257)*.07,y+.30,z+Math.sin(j*1.257)*.07,[.05,.023,.05],i%2?'#ecc5b0':'#f0e3b4');ball(x,y+.32,z,[.035,.022,.035],'#cba85c');}
    }
    for(let i=0;i<7;i++){const x=-.65-i*.1,z=.1-i*.4;ball(x,ground(x,z)+.03,z,[.18,.045,.14],i%2?'#cac9ad':'#b9bea3');}
    for(let i=0;i<4;i++){const x=-3.1+i*.17,z=-2.3+i%2*.19,y=ground(x,z);cylinder(x,y+.12,z,.027,.23,'#e5d8b6');ball(x,y+.25,z,[.12,.08,.11],i%2?'#be927a':'#d09e8e');}
    box(-2.6,ground(-2.6,1.9)+.035,1.9,.9,.025,.65,'#caa69a');
    for(let i=0;i<4;i++)box(-2.94+i*.22,ground(-2.6,1.9)+.05,1.9,.025,.009,.65,'#ecdec4');
    box(-2.55,ground(-2.6,1.9)+.061,1.9,.3,.017,.24,'#eee5ca');
  }

  function coast() {
    ribbon(z=>[coastEdge(z),4.10],'#82bec5',()=>.12);
    ribbon(z=>[coastEdge(z),coastEdge(z)+.20],'#b7d9cc',()=>.127);
    // Wavelets follow a crescent shore, with no stream, bridge, bunting, or railings.
    for(let i=0;i<18;i++){
      const z=-4.1+i*.49,x=coastEdge(z)+.12;
      tube([[x,.139,z],[x+.025,.139,z+.15],[x+.07,.139,z+.23]],.013,'#e5ebd6');
      const sx=2.75+Math.sin(i*2.6)*.55;box(sx,.13,z,.26+i%3*.08,.009,.022,'#b1d9d1',.12);
    }
    // Lighthouse on a raised cape, with a blue lantern and a small terracotta roof.
    const {x,z}=COAST_LANDMARKS.lighthouse,y=ground(x,z);
    cylinder(x,y+.025,z,.5,.075,'#c1baa2');cylinder(x,y+.68,z,.33,1.32,'#eee2c4',.26);
    cylinder(x,y+.35,z,.315,.16,'#a2c0b8',.308);cylinder(x,y+.95,z,.279,.16,'#a2c0b8',.27);
    cylinder(x,y+1.37,z,.36,.10,'#d7c39d');cylinder(x,y+1.57,z,.23,.33,'#7aadb5');
    for(const dx of [-.2,.2])box(x+dx,y+1.58,z,.035,.35,.04,'#e8dabe');
    add(new T.ConeGeometry(.38,.27,12),'#c58f85',[x,y+1.87,z]);ball(x,y+2.05,z,[.055,.06,.055],'#ccb888');
    box(x,y+.21,z+.33,.14,.31,.025,'#9fa590');
    // A scalloped beach umbrella, striped towel, beach ball, and a little bucket.
    const {x:ux,z:uz}=COAST_LANDMARKS.umbrella,uy=ground(ux,uz);cylinder(ux,uy+.60,uz,.035,1.15,'#c2a87e');
    for(let i=0;i<8;i++){const a=i*Math.PI/4;const geo=new T.SphereGeometry(.72,3,3,a,Math.PI/4,0,Math.PI/2.1);add(geo,i%2?'#e9d5b4':'#d7a6a0',[ux,uy+1.1,uz],[1,.28,1]);}
    ball(ux,uy+1.35,uz,[.05,.05,.05],'#ecd6ad');
    box(-2.9,ground(-2.9,2.45)+.025,2.45,.83,.02,.64,'#b9ceba',.25);
    for(let i=0;i<4;i++)box(-3.18+i*.18,ground(-2.9,2.45)+.04,2.45,.06,.007,.58,'#ede3c6',.25);
    ball(-2.1,.32,2.77,[.18,.18,.18],'#e8cf9e');ball(-2.13,.34,2.88,[.135,.12,.075],'#bd9ca7');
    cylinder(-2.1,.27,1.1,.11,.23,'#b3c6b5',.14);ring(-2.1,.43,1.1,.11,.016,'#cba77f',false);
    // Distinct shells and five-armed starfish, modelled as soft pieces of clay.
    for(let i=0;i<9;i++){
      const sz=-2.8+i*.8,sx=coastEdge(sz)-.35-(i%3)*.18,sy=ground(sx,sz)+.05;
      if(i%3===0){for(let j=0;j<5;j++)add(new T.SphereGeometry(1,7,5),'#d6a69b',[sx+Math.cos(j*1.257)*.11,sy,sz+Math.sin(j*1.257)*.11],[.16,.04,.065],[0,-j*1.257,0]);}
      else {for(let j=0;j<4;j++)ball(sx+(j-1.5)*.035,sy,sz,[.04,.065,.115-j%2*.015],i%2?'#ead9c0':'#c8bdab');}
    }
    // Toy sailboat offshore: triangle sail, rounded hull, no dock.
    const {x:bx,z:bz}=COAST_LANDMARKS.sailboat;
    ball(bx,.16,bz,[.33,.08,.15],'#d2a586');cylinder(bx,.42,bz,.016,.53,'#ab8b61');
    const sail=new T.BufferGeometry();sail.setAttribute('position',new T.Float32BufferAttribute([bx,.68,bz,bx,.23,bz,bx+.31,.26,bz,bx+.31,.26,bz,bx,.23,bz,bx,.68,bz],3));sail.computeVertexNormals();add(sail,'#f0e5c6');
    ring(2.6,.16,2.3,.22,.048,'#d6a8a4');
  }

  function volcano() {
    // A diagonal clay lava flow splits into a glowing fork, with a broad rocky basin.
    ribbon(z=>[lavaCenter(z)-.27,lavaCenter(z)+.27],'#d49978',(x,z)=>ground(x,z)+.014,-2.6);
    ribbon(z=>[lavaCenter(z)-.10,lavaCenter(z)+.07],'#e6c28f',(x,z)=>ground(x,z)+.018,-2.6);
    tube([[-1.05,ground(-1.05,-.2)+.04,-.2],[-2,ground(-2,1.0)+.04,1],[-3.8,ground(-3.8,2.8)+.04,2.8]],.08,'#d5a280');
    for(const z of [1.1,3.3]){const x=lavaCenter(z);ball(x,ground(x,z)+.018,z,[.43,.023,.27],'#d49978');ball(x+.02,ground(x,z)+.042,z,[.26,.008,.15],'#e1b68b');}
    for(let i=0;i<13;i++){
      const z=-3.8+i*.63,x=lavaCenter(z)+(i%2?-.58:.65);
      ball(x,ground(x,z)+.055,z,[.19,.11,.14],i%2?'#999794':'#b8afa4');
    }
    // Rounded basalt columns on the rim, rather than a wooden fence.
    for(let i=0;i<8;i++){
      const x=-3.8+i*.98,z=i%2?-4.08:-4.18,h=.25+(i*3%5)*.10;
      cylinder(x,ground(x,z)+h/2,z,.17,h,i%2?'#9e9c98':'#b5aca1',.15);
    }
    const crystals=[[-3.65,0.1],[-3.55,3.6],[3.65,1.6],[2.9,-3.9]];
    for(const [x,z] of crystals)for(let j=0;j<3;j++){
      const cx=x+(j-1)*.15,cz=z+j%2*.1,y=ground(cx,cz);
      add(new T.CylinderGeometry(.025,.105,.32+j*.12,5),['#a3b9b1','#b8c3bc','#91aaa3'][j],[cx,y+.20+j*.06,cz],[1,1,1],[0,j*.6,(j-1)*.22]);
    }
    // Soft smoke beads and an expedition supply corner, with a tiny listening dish.
    ball(-2.8,2.02,-3,[.14,.12,.12],'#d7c7b0');ball(-2.67,2.25,-3,[.20,.17,.16],'#e3d4bb');ball(-2.43,2.51,-3.05,[.26,.20,.20],'#ebe0ca');
    const {x:sx,z:sz}=VOLCANO_LANDMARKS.supplies,sy=ground(sx,sz);box(sx,sy+.20,sz,.51,.4,.43,'#c79c82');
    for(const dz of [-.18,.18])box(sx,sy+.22,sz+dz,.51,.06,.045,'#e1be95');box(sx+.35,sy+.13,sz-.25,.28,.25,.28,'#b4bbb1');
    box(sx,sy+.43,sz,.29,.025,.24,'#eadfc5');box(sx,sy+.45,sz,.15,.01,.025,'#9b9a84');
    const {x:dx,z:dz}=VOLCANO_LANDMARKS.dish;
    cylinder(dx,ground(dx,dz)+.36,dz,.03,.66,'#a7957d');
    add(new T.SphereGeometry(.25,12,6,0,Math.PI*2,0,Math.PI/2),'#c4c6b7',[dx,ground(dx,dz)+.68,dz],[1,.35,1],[0,0,-.45]);
    // A dotted exploration trail and two fossil impressions are pressed into the ash-coloured clay.
    for(let i=0;i<10;i++){const x=-1.7+Math.sin(i*.8)*.28,z=-1.9+i*.5;for(const side of [-1,1])ball(x+side*.09,ground(x,z)+.014,z+side*.06,[.038,.01,.065],'#d2c2ad');}
    for(const [x,z] of [[-3,2.1],[2.8,.5]]){ring(x,ground(x,z)+.025,z,.12,.023,'#ccc0a9');box(x+.18,ground(x,z)+.024,z,.23,.02,.034,'#ccc0a9',.3);}
  }

  if(theme==='coast')coast();else if(theme==='volcano')volcano();else grassland();
  // The handcrafted tray edge stays consistent across the collection of miniature worlds.
  for(const x of [-4.22,4.22])box(x,.025,0,.09,.17,9.3,'#ccb08a');
  box(-.6,-.24,4.834,1.45,.27,.025,'#e7d8b7');for(let i=0;i<5;i++)box(-1+i*.18,-.24,4.85,.08,.028+i%2*.04,.012,'#929a79');
  const mesh=new T.Mesh(mergeGeometries(pieces),new T.MeshStandardMaterial({vertexColors:true,roughness:1}));mesh.castShadow=true;mesh.receiveShadow=true;pieces.forEach(p=>p.dispose());return mesh;
}
