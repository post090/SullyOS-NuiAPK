import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
export function createDoor(door,color='#FFF2E3',trim='#A99BE8',highWall=false,ribbonTemplate=null){
 if(['oak','walnut','lattice'].includes(door.kind))return createPanelDoor(door);
 if(door.kind==='ribbon'&&ribbonTemplate){
  const root=new T.Group(),frame=ribbonTemplate.getObjectByName('ribbon-frame').clone(true),art=ribbonTemplate.getObjectByName('ribbon-leaf').clone(true),leaf=new T.Group();
  frame.scale.x=door.width;art.scale.x=door.width;leaf.position.x=-door.width/2;art.position.x=door.width/2;leaf.add(art);root.add(frame,leaf);
  root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  root.userData.doorLeaf=leaf;root.userData.doorKind='door';root.userData.doorWidth=door.width;return root;
 }
 const root=new T.Group(),frame=new T.MeshStandardMaterial({color:trim,roughness:.8}),leafMat=new T.MeshStandardMaterial({color,roughness:.9});frame.userData.owned=true;leafMat.userData.owned=true;
 const box=(parent,x,y,z,w,h,d,material=frame)=>{const geometry=new RoundedBoxGeometry(w,h,d,2,Math.min(.045,w/4,h/4,d/4));geometry.userData.owned=true;const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
 const w=door.width;
 box(root,-w/2-.055,1.1,0,.11,2.2,.28);box(root,w/2+.055,1.1,0,.11,2.2,.28);
 if(door.kind==='arch'){
  const curve=new T.EllipseCurve(0,2.2,w/2+.055,.24,0,Math.PI,false,0),points=curve.getPoints(24).map(p=>new T.Vector3(p.x,p.y,0));
  const geometry=new T.TubeGeometry(new T.CatmullRomCurve3(points),24,.07,6,false);geometry.userData.owned=true;root.add(new T.Mesh(geometry,frame));
  if(highWall){
   const shape=new T.Shape();shape.moveTo(-w/2,4.65);shape.lineTo(-w/2,2.2);
   for(let i=0;i<=24;i++){const t=Math.PI-i*Math.PI/24;shape.lineTo(Math.cos(t)*(w/2),2.2+Math.sin(t)*.24);}
   shape.lineTo(w/2,4.65);shape.closePath();const g=new T.ExtrudeGeometry(shape,{depth:.22,bevelEnabled:false});g.translate(0,0,-.11);g.userData.owned=true;root.add(new T.Mesh(g,leafMat));
   box(root,0,4.595,0,w,.11,.24);
  }
 }else box(root,0,2.25,0,w+.22,.14,.3);
 const leaf=new T.Group();root.add(leaf);
 if(door.kind==='door'){leaf.position.x=-w/2;box(leaf,w/2,1.08,0,w-.03,2.12,.07,leafMat);box(leaf,w-.18,1.03,.065,.075,.075,.08);}
 if(door.kind==='sliding'){box(leaf,0,1.08,.07,w-.03,2.12,.065,leafMat);box(leaf,w/2-.18,1.1,.13,.055,.3,.04);}
 root.userData.doorLeaf=leaf;root.userData.doorKind=door.kind;root.userData.doorWidth=w;
 return root;
}

function createPanelDoor(door){
 const root=new T.Group(),leaf=new T.Group(),sliding=door.kind==='lattice',w=door.width;
 const wood=new T.MeshStandardMaterial({color:door.kind==='walnut'?'#624336':'#ffffff',roughness:.8}),panel=new T.MeshStandardMaterial({color:sliding?'#e9e0d2':door.kind==='walnut'?'#765043':'#d9b68d',roughness:.85}),metal=new T.MeshStandardMaterial({color:'#393039',roughness:.65});
 if(door.kind!=='walnut')wood.color.setRGB(.8227857351303101,.5972017645835876,.3915724754333496);
 for(const m of [wood,panel,metal])m.userData.owned=true;
 const box=(parent,x,y,z,W,H,D,mat=wood)=>{const g=new RoundedBoxGeometry(W,H,D,1,Math.min(.018,W/3,H/3,D/3));g.userData.owned=true;const m=new T.Mesh(g,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);};
 for(const x of [-w/2-.055,w/2+.055])box(root,x,1.12,0,.11,2.24,.26);
 box(root,0,2.28,0,w+.22,.12,.29);
 const art=new T.Group();leaf.add(art);root.add(leaf);if(!sliding){leaf.position.x=-w/2;art.position.x=w/2;}
 box(art,0,1.08,0,w-.04,2.12,.08,panel);
 for(const x of [-w/2+.07,w/2-.07])box(art,x,1.08,.055,.09,2.12,.05);
 for(const y of [.065,1.00,2.09])box(art,0,y,.055,w-.10,.09,.05);
 if(sliding){for(const x of [-w*.25,0,w*.25])box(art,x,1.53,.055,.035,1.04,.05);for(const y of [1.3,1.65])box(art,0,y,.055,w-.10,.035,.05);box(art,w/2-.16,1.08,.09,.045,.24,.04,metal);}
 else{for(const x of [-w*.25,w*.25]){box(art,x,1.56,.05,w*.40,.84,.035);box(art,x,.52,.05,w*.40,.72,.035);}box(art,w/2-.18,1.06,.095,.045,.14,.04,metal);box(art,w/2-.24,1.10,.12,.19,.035,.04,metal);}
 root.userData.doorLeaf=leaf;root.userData.doorKind=sliding?'sliding':'door';root.userData.doorWidth=w;return root;
}
