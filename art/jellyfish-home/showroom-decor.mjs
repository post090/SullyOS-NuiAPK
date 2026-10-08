import fs from 'node:fs/promises';
import * as T from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeGeometries,mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {saveGlb} from './asset-geometry.mjs';
// Reconstructed from the room references, using authored geometry and solid
// colors only. No source image, sampled pixel, UV or vertex-color payload.
const colors={woodLight:'#ffffff',walnut:'#624336',cream:'#e9e0d2',sage:'#82917d',lavender:'#a39cb6',ink:'#393039',glass:'#c8dce0',paper:'#f4ecdf',gold:'#b79b6a'};
const mats=Object.fromEntries(Object.entries(colors).map(([name,color])=>{const m=new T.MeshStandardMaterial({color,roughness:.8});m.name=name;return [name,m];}));
mats.woodLight.color.setRGB(.8227857351303101,.5972017645835876,.3915724754333496);
mats.glass.emissive.set('#fff1ce');mats.glass.emissiveIntensity=.15;
let root;
function mesh(g,mat,x=0,y=0,z=0,rz=0){g.deleteAttribute('uv');g.rotateZ(rz);g.translate(x,y,z);root.add(new T.Mesh(mergeVertices(g),mats[mat]));}
function box(w,h,d,x,y,z,mat='woodLight',r=.018){mesh(new RoundedBoxGeometry(w,h,d,1,Math.min(r,w/3,h/3,d/3)),mat,x,y,z);}
function ball(rx,ry,rz,x,y,z,mat){const g=new T.SphereGeometry(1,12,8);g.scale(rx,ry,rz);mesh(g,mat,x,y,z);}
function cylinder(rt,rb,h,x,y,z,mat){mesh(new T.CylinderGeometry(rt,rb,h,12),mat,x,y,z);}
function plant(x,y,z,scale=1){cylinder(.13*scale,.10*scale,.24*scale,x,y+.12*scale,z,'cream');mats.sage.side=T.DoubleSide;for(let i=0;i<5;i++){const a=i*2.4,g=new T.PlaneGeometry(1,1,4,8),p=g.attributes.position;for(let j=0;j<p.count;j++){const t=p.getY(j)+.5,u=p.getX(j),width=Math.sin(t*Math.PI)*.20*scale,r=t*.22*scale;const X=u*width,Z=r; p.setXYZ(j,x+X*Math.cos(a)+Z*Math.sin(a),y+(.23+t*.18+Math.sin(t*Math.PI)*.07-Math.abs(u)*.04)*scale,z-X*Math.sin(a)+Z*Math.cos(a));}g.computeVertexNormals();mesh(g,'sage');}}
function curtain(x,w,h){const g=new T.PlaneGeometry(w,h,24,6),p=g.attributes.position;for(let i=0;i<p.count;i++){const u=p.getX(i)/w+.5,v=p.getY(i)/h+.5;p.setXYZ(i,p.getX(i)+x*(.95+.05*v),p.getY(i)+h/2,.12+Math.cos(u*Math.PI*8)*.065);}g.computeVertexNormals();mats.cream.side=T.DoubleSide;mesh(g,'cream');}
const catalog=JSON.parse(await fs.readFile('public/room3d/catalog.json','utf8')),report=[];
async function save(id,name,surface,collection,paintMaterials,extra={}){
 root.updateMatrixWorld(true);let b=new T.Box3().setFromObject(root),c=b.getCenter(new T.Vector3());
 const groups=new Map();for(const o of root.children){o.geometry.translate(-c.x,-b.min.y,-c.z);if(!groups.has(o.material))groups.set(o.material,[]);groups.get(o.material).push(o.geometry);}
 const merged=new T.Group();for(const [m,gs]of groups)merged.add(new T.Mesh(mergeGeometries(gs),m));
 b=new T.Box3().setFromObject(merged);const s=b.getSize(new T.Vector3()).toArray();let triangles=0;merged.traverse(o=>{if(o.isMesh)triangles+=o.geometry.index.count/3;});if(triangles>=4000)throw Error(id+' exceeds budget '+triangles);
 const a={id,name,surface,collection,url:id+'.glb',size:s,default:[0,surface==='wall'?2:.15,0],boxes:[[-s[0]/2,0,-s[2]/2,s[0]/2,s[1],s[2]/2]],paintMaterials,revision:'showroom-decor-1',...extra};
 const i=catalog.findIndex(a=>a.id===id);if(i<0)catalog.push(a);else catalog[i]=a;
 const bytes=await saveGlb(merged,'public/room3d/'+id+'.glb');report.push({id,triangles,bytes});
}
for(const [kind,name,collection,w,h,frame]of [
 ['spa','温泉木格横窗','bathroom',2.55,1.55,'walnut'],
 ['study','奶油卷帘窗','gaming',2.2,1.65,'woodLight'],
 ['kitchen','黑框厨房窗','kitchen',2.1,1.55,'ink'],
 ['living','深木百叶长窗','living',2.1,2.35,'walnut'],
 ['bedroom','暖木布帘窗','bedroom',2.65,1.9,'walnut'],
]){
 root=new T.Group();box(w-.12,h-.12,.035,0,h/2,-.04,'glass',.002);
 for(const x of [-w/2,w/2])box(.09,h,.15,x,h/2,0,frame);
 for(const y of [.045,h-.045])box(w+.08,.09,.15,0,y,0,frame);
 box(.065,h-.1,.13,0,h/2,.01,frame);box(w+.26,.07,.31,0,.025,.055,'woodLight');
 if(kind==='spa'){box(w,.055,.12,0,h*.76,.02,frame);for(const x of [-.9,-.45,.45,.9])box(.04,h*.24,.1,x,h*.88,.03,frame);}
 if(kind==='study'){box(w+.12,.11,.18,0,h+.03,.04,'cream');box(w-.06,.4,.07,0,h-.2,.09,'cream');box(w,.055,.1,0,h-.40,.1,'woodLight');}
 if(kind==='living'){for(let i=0;i<6;i++)box(w-.1,.09,.15,0,h-.17-i*.115,.10,'woodLight',.009);box(.018,.85,.018,w*.43,h-.55,.18,'cream',.003);ball(.03,.06,.03,w*.43,h-.98,.18,'walnut');}
 if(kind==='bedroom'){box(w+.36,.045,.045,0,h+.08,.15,'walnut');curtain(-w*.40,w*.27,h);curtain(w*.40,w*.27,h);}
 await save('suite_window_'+kind,name,'wall',collection,[kind==='bedroom'||kind==='study'?'cream':frame],{daylight:true});
}
// Wall art uses simple relief shapes rather than copying generated pictures.
for(const [kind,name,col]of [['moon','月相木框画','bathroom'],['botanical','灰绿叶片装饰画','bedroom'],['abstract','奶油几何装饰画','living']]){
 root=new T.Group();box(.86,1.05,.055,0,.525,0,'paper');for(const x of [-.45,.45])box(.045,1.12,.09,x,.54,.02,'walnut');for(const y of [0,1.08])box(.94,.045,.09,0,y,.02,'walnut');
 if(kind==='moon'){ball(.23,.23,.018,0,.59,.05,'gold');ball(.20,.20,.019,.09,.64,.07,'paper');box(.35,.025,.02,0,.24,.055,'lavender');}
 if(kind==='botanical'){box(.018,.60,.02,0,.51,.05,'walnut',.003);for(const [x,y]of [[-.11,.43],[.11,.63],[-.10,.78]])ball(.14,.08,.015,x,y,.07,'sage');}
 if(kind==='abstract'){box(.34,.54,.022,-.15,.45,.06,'lavender',.025);ball(.21,.21,.018,.16,.69,.075,'sage');}
 await save('suite_art_'+kind,name,'wall',col,['walnut']);
}
root=new T.Group();box(1.12,.065,.32,0,.04,0);plant(-.32,.072,0,.8);box(.31,.38,.045,.22,.26,-.055,'walnut');box(.24,.30,.012,.22,.27,-.025,'paper');ball(.085,.085,.01,.22,.29,-.015,'sage');
await save('suite_wall_shelf','小绿植与相框壁架','wall','bedroom',['cream']);
root=new T.Group();box(.7,.035,.40,0,.02,0,'woodLight',.012);for(const x of [-.19,.18]){cylinder(.085,.07,.14,x,.10,0,'cream');const g=new T.TorusGeometry(.065,.016,4,10);mesh(g,'cream',x+.08,.11,0);cylinder(.072,.072,.006,x,.168,0,'walnut');}
await save('suite_tea_tray','双杯木托盘','tabletop','living',['cream']);
root=new T.Group();for(let i=0;i<2;i++)box(.35,.065,.28,-.16,.04+i*.067,0,i?'cream':'lavender',.009);plant(.20,0,0,.70);
await save('suite_books_plant','书本与小盆栽','tabletop','gaming',['lavender']);
for(const [kind,name]of [['grid','奶油细格地毯'],['border','暖白包边地毯']]){
 root=new T.Group();box(5.4,.025,4.2,0,.014,0,'cream',.012);
 if(kind==='grid'){for(let x=-2.4;x<2.5;x+=.8)box(.018,.005,4.10,x,.028,0,'woodLight',.001);for(let z=-1.6;z<1.7;z+=.8)box(5.28,.005,.018,0,.028,z,'woodLight',.001);}
 else{for(const x of [-2.55,2.55])box(.03,.005,3.94,x,.028,0,'woodLight',.001);for(const z of [-1.96,1.96])box(5.12,.005,.03,0,.028,z,'woodLight',.001);}
 await save('suite_rug_'+kind,name,'rug',kind==='grid'?'living':'bedroom',['cream']);
}
await fs.writeFile('public/room3d/catalog.json',JSON.stringify(catalog,null,2)+'\n');
await fs.writeFile('art/jellyfish-home/sources/showrooms/decor-report.json',JSON.stringify(report,null,2)+'\n');console.log(report);
// The bedroom keeps extracted curtain folds instead of the generic preview.
await import('./showroom-window-source.mjs');
