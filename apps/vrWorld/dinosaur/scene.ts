import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { GardenMap, GardenProp } from '../../../utils/vrWorld/dinosaurTypes';
import { makeLandscape } from './landscape';
import { gardenSurfaceHeight } from '../../../utils/vrWorld/dinosaurTerrain';

export function makeGardenScene(garden:GardenMap, propsOnly=false) {
  const root=new T.Group(), pieces:T.BufferGeometry[]=[];const coast=garden.theme==='coast';
  const add=(geo:T.BufferGeometry,color:string,p:number[],rotation=[0,0,0],scale=[1,1,1])=>{
    if(geo.index){const source=geo;geo=geo.toNonIndexed();source.dispose();}geo.applyMatrix4(new T.Matrix4().compose(new T.Vector3(...p),new T.Quaternion().setFromEuler(new T.Euler(...rotation)),new T.Vector3(...scale)));
    const c=new T.Color(color),a=new Float32Array(geo.getAttribute('position').count*3);for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}geo.setAttribute('color',new T.BufferAttribute(a,3));pieces.push(geo);
  };
  const box=(p:number[],s:number[],c:string,r=.04,ry=0)=>add(new RoundedBoxGeometry(s[0],s[1],s[2],1,Math.min(r,...s.map(v=>v/2))),c,p,[0,ry,0]);
  const ball=(p:number[],s:number[],c:string)=>add(new T.SphereGeometry(1,10,7),c,p,[0,0,0],s);
  const cylinder=(p:number[],r:number,h:number,c:string,rt=r)=>add(new T.CylinderGeometry(rt,r,h,12),c,p);
  if(!propsOnly){
  box([0,-.29,0],[8.6,.58,9.65],'#b39977',.19);box([0,.015,0],[8.45,.12,9.5],coast?'#d6c097':garden.theme==='volcano'?'#a5a196':'#91a673',.18);
  box([0,-.50,0],[8.1,.10,9.2],'#826d55',.08);
  root.add(makeLandscape(garden.theme));
  }
  for(const p of garden.props){const x=p.x,z=p.z;const before=pieces.length;
    if(p.kind==='tree'&&!coast){cylinder([x,.57,z],.13,1.0,'#9f805e',.105);ball([x,1.25,z],[.61,.49,.5],'#81a077');ball([x-.32,1.19,z+.03],[.35,.32,.31],'#a1b67c');ball([x+.24,1.52,z],[.40,.34,.32],'#93ad7b');}
    if(p.kind==='tree'&&coast){
      const curve=new T.CatmullRomCurve3([new T.Vector3(x,.1,z),new T.Vector3(x+.06,.8,z),new T.Vector3(x+.22,1.52,z)]);add(new T.TubeGeometry(curve,10,.085,7,false),'#b39870',[0,0,0]);
      for(let i=0;i<7;i++){const a=i*Math.PI*2/7;add(new T.SphereGeometry(1,10,6),i%2?'#97b597':'#7da68d',[x+.22+Math.cos(a)*.38,1.52,z+Math.sin(a)*.38],[0,-a,.10],[.62,.09,.18]);}
      for(const dx of [-.08,.08])ball([x+.22+dx,1.4,z+.03],[.10,.12,.095],'#c5aa7c');
    }
    if(p.kind==='rock'){ball([x,.3,z],[.54,.27,.42],'#aeb5a2');ball([x+.24,.18,z+.27],[.23,.13,.20],'#c3c3ac');}
    if(p.kind==='stump'){cylinder([x,.32,z],.36,.44,'#a48663',.31);cylinder([x,.546,z],.28,.016,'#ddc49a');add(new T.TorusGeometry(.17,.012,4,16),'#b89870',[x,.56,z],[-Math.PI/2,0,0]);}
    if(p.kind==='tent'){
      // An open cloth A-frame: the dinosaur can actually fit inside, with its tail outside.
      box([x,.12,z],[1.18,.055,1.45],'#a2ad88',.03);
      for(const side of [-1,1])add(new RoundedBoxGeometry(1.04,.055,1.48,1,.02),side<0?'#d4ad82':'#e2c59d',[x+side*.29,.56,z],[0,0,-side*1.0]);
      for(const end of [-.70,.70])add(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(x-.57,.14,z+end),new T.Vector3(x,1,z+end),new T.Vector3(x+.57,.14,z+end)]),2,.022,5,false),'#987c5c',[0,0,0]);
      ball([x+.72,.12,z+.67],[.08,.05,.09],'#a6ad98');
    }
    if(p.kind==='picnic'){
      box([x,.12,z],[1.38,.035,1.04],'#e6c5ad',.09);
      for(const d of [-.42,0,.42]){box([x+d,.143,z],[.055,.008,.98],'#f8ead4',.003);box([x,.144,z+d*.8],[1.3,.008,.045],'#f8ead4',.003);}
      cylinder([x+.40,.17,z],.23,.035,'#f8eed5');
      for(const d of [-.07,.07]){cylinder([x+.4+d,.205,z+d],.10,.035,'#cfa56d');for(let k=0;k<3;k++)ball([x+.4+d+Math.cos(k*2)*.05,.227,z+d+Math.sin(k*2)*.05],[.012,.008,.012],'#927651');}
      box([x-.45,.23,z-.35],[.26,.19,.23],'#b59b75',.04);
    }
    if(p.kind==='puddle'){
      ball([x,.12,z],[.75,.055,.58],'#b5c7b2');ball([x,.16,z],[.65,.018,.48],'#98c8c8');
      for(const d of [-1,1])ball([x+d*.45,.18,z+d*.32],[.08,.04,.065],'#d8d4b9');
    }
    if(p.kind==='flowers'){
      ball([x,.16,z],[.55,.08,.45],'#96ae7e');
      for(let k=0;k<7;k++){const a=k*2.4,fx=x+Math.cos(a)*(.18+k*.035),fz=z+Math.sin(a)*(.14+k*.025),h=.29+(k%3)*.06;
        cylinder([fx,h/2+.15,fz],.018,h,'#78986f');
        for(let j=0;j<5;j++)ball([fx+Math.cos(j*1.257)*.073,h+.15,fz+Math.sin(j*1.257)*.073],[.065,.028,.052],k%2?'#efd4a4':'#dbafa8');
        ball([fx,h+.177,fz],[.033,.018,.033],'#cfa971');
      }
    }
    if(p.kind==='volcano'){cylinder([x,.63,z],.72,1.06,'#a58c83',.27);cylinder([x,1.17,z],.24,.025,'#795f59');cylinder([x,1.18,z],.17,.018,'#dd9b78');ball([x+.02,1.26,z],[.11,.12,.1],'#dfb395');}
    if(p.kind==='volcano')add(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(x+.1,1.18,z+.17),new T.Vector3(x+.25,.66,z+.45),new T.Vector3(x+.45,.13,z+.70)]),12,.055,6,false),'#d49b76',[0,0,0]);
    if(p.kind==='sign'){box([x,.45,z],[.08,.73,.08],'#b29167');box([x,.80,z],[.70,.25,.09],'#e5d1a4',.045);box([x+.1,.80,z+.05],[.27,.026,.009],'#849a79',.006);}
    if(p.kind==='fence'){for(const a of [-.46,.46])box([x+a,.35,z],[.09,.56,.09],'#ddc6a0');for(const h of [.27,.49])box([x,h,z],[1,.075,.075],'#d6b78f');}
    if(p.kind==='house'){box([x,.41,z],[.83,.65,.74],coast?'#e7dfc5':'#e8d1aa',.04);add(new T.ConeGeometry(.77,.46,4),coast?'#9cbfb7':'#b48784',[x,.95,z],[0,Math.PI/4,0],[1,1,.9]);box([x,.28,z+.377],[.20,.37,.018],'#899e8b',.018);box([x-.24,.52,z+.379],[.12,.15,.018],'#b5cace',.01);}
    const matrix=new T.Matrix4().makeTranslation(x,gardenSurfaceHeight(x,z,garden.theme)-.1,z).multiply(new T.Matrix4().makeRotationY(p.rotation)).multiply(new T.Matrix4().makeTranslation(-x,0,-z));
    if(p.kind==='volcano')matrix.multiply(new T.Matrix4().makeTranslation(x,0,z)).multiply(new T.Matrix4().makeScale(1.25,1.45,1.25)).multiply(new T.Matrix4().makeTranslation(-x,0,-z));
    const propPieces=pieces.splice(before);
    const height=gardenSurfaceHeight(x,z,garden.theme);
    for(const geo of propPieces)geo.applyMatrix4(matrix).translate(-x,-height,-z);
    const mesh=new T.Mesh(mergeGeometries(propPieces),new T.MeshStandardMaterial({vertexColors:true,roughness:1}));
    mesh.position.set(x,height,z);mesh.userData={propId:p.id,propKind:p.kind};mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);propPieces.forEach(g=>g.dispose());
  }
  if(pieces.length){const mesh=new T.Mesh(mergeGeometries(pieces),new T.MeshStandardMaterial({vertexColors:true,roughness:1}));mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);pieces.forEach(g=>g.dispose());}return root;
}

/** Editable geometry is local to its anchor: changing a pose only updates a transform. */
export function makeGardenProp(prop:GardenProp,theme:GardenMap['theme']):T.Mesh {
  const group=makeGardenScene({id:'prop',name:'',theme,props:[{...prop,x:0,z:0,rotation:0}]},true);
  const mesh=group.children[0] as T.Mesh;group.remove(mesh);
  mesh.position.set(prop.x,gardenSurfaceHeight(prop.x,prop.z,theme),prop.z);
  mesh.rotation.y=prop.rotation;return mesh;
}
