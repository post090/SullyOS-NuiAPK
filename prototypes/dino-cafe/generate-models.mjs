// Offline sculpting. The phone loads compact GLBs; it never runs this mesher.
import * as T from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { SimplifyModifier } from 'three/addons/modifiers/SimplifyModifier.js';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

globalThis.FileReader = class {
    readAsArrayBuffer(blob) { blob.arrayBuffer().then(value => { this.result = value; this.onloadend?.(); }); }
    readAsDataURL(blob) { blob.arrayBuffer().then(value => { this.result = `data:${blob.type};base64,${Buffer.from(value).toString('base64')}`; this.onloadend?.(); }); }
};
const output = fileURLToPath(new URL('../../public/dino-models/', import.meta.url));
// Regenerate one authored model without touching the other binary assets.
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7);
mkdirSync(output, { recursive: true });
const V = p => new T.Vector3(...p);
const smoothMin = (a,b,k=.12) => { const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25; };
const ellipsoid = (p,r) => (x,y,z) => (Math.hypot((x-p[0])/r[0],(y-p[1])/r[1],(z-p[2])/r[2])-1)*Math.min(...r);
const capsule = (a,b,ra,rb=ra) => {
    const d=b.map((n,i)=>n-a[i]), length=d.reduce((s,n)=>s+n*n,0);
    return (x,y,z) => {const p=[x-a[0],y-a[1],z-a[2]],t=T.MathUtils.clamp(p.reduce((s,n,i)=>s+n*d[i],0)/length,0,1);
        return Math.hypot(...p.map((n,i)=>n-d[i]*t))-(ra+(rb-ra)*t);};
};
function sculpt(parts, color, kind) {
    const sdf=(x,y,z)=>parts.reduce((d,part)=>smoothMin(d,part(x,y,z)),20);
    const step=.080, origin=[-2.7,-.16,-1.06], dims=[62,51,28];
    const values=new Float32Array(dims[0]*dims[1]*dims[2]);
    const key=(x,y,z)=>(x*dims[1]+y)*dims[2]+z;
    for(let x=0;x<dims[0];x++) for(let y=0;y<dims[1];y++) for(let z=0;z<dims[2];z++) values[key(x,y,z)]=sdf(origin[0]+x*step,origin[1]+y*step,origin[2]+z*step);
    const corners=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
    const tetra=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
    const edges=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
    const positions=[], normals=[], colors=[], indices=[], lookup=new Map(), paintWeights=[];
    const base=new T.Color(color), cream=new T.Color('#e8d9ba');
    const gradient=p=>new T.Vector3(sdf(p.x+.008,p.y,p.z)-sdf(p.x-.008,p.y,p.z),sdf(p.x,p.y+.008,p.z)-sdf(p.x,p.y-.008,p.z),sdf(p.x,p.y,p.z+.008)-sdf(p.x,p.y,p.z-.008)).normalize();
    function vertex(p) {
        const hash=[p.x,p.y,p.z].map(v=>Math.round(v*100000)).join('/');
        if(lookup.has(hash))return lookup.get(hash);
        const index=positions.length/3;lookup.set(hash,index);positions.push(p.x,p.y,p.z);
        const n=gradient(p);normals.push(n.x,n.y,n.z);
        const tint=base.clone();
        if(kind==='aiven-chimera')tint.lerp(new T.Color('#dcaca7'),T.MathUtils.smoothstep(p.y,1.5,2.1));
        let belly=kind==='brachiosaurus'?Math.max(0,n.x-.45)*.55:Math.max(0,-n.y-.05)*.55;
        if(kind==='tyrannosaurus')belly=Math.exp(-(((p.x-.51)/.6)**2)-((p.y-1.0)/.74)**2)*Math.max(0,n.x)*.6;
        tint.lerp(cream,belly);
        const fleck=Math.sin(p.x*18+p.y*21)*Math.sin(p.z*32+p.x*9);
        if(fleck>.68&&p.y>.65)tint.lerp(cream,.055);
        colors.push(tint.r,tint.g,tint.b);paintWeights.push(1-belly,0);return index;
    }
    for(let x=0;x<dims[0]-1;x++) for(let y=0;y<dims[1]-1;y++) for(let z=0;z<dims[2]-1;z++) {
        const ds=corners.map(c=>values[key(x+c[0],y+c[1],z+c[2])]);
        if(ds.every(d=>d>=0)||ds.every(d=>d<0))continue;
        const ps=corners.map(c=>new T.Vector3(origin[0]+(x+c[0])*step,origin[1]+(y+c[1])*step,origin[2]+(z+c[2])*step));
        for(const t of tetra) {
            const points=[];
            for(const [a,b] of edges) {const i=t[a],j=t[b];if((ds[i]<0)===(ds[j]<0))continue;points.push(ps[i].clone().lerp(ps[j],ds[i]/(ds[i]-ds[j])));}
            if(points.length<3)continue;
            const center=points.reduce((v,p)=>v.add(p),new T.Vector3()).multiplyScalar(1/points.length), normal=gradient(center);
            const u=points[0].clone().sub(center).normalize(),v=new T.Vector3().crossVectors(normal,u);
            points.sort((a,b)=>Math.atan2(a.clone().sub(center).dot(v),a.clone().sub(center).dot(u))-Math.atan2(b.clone().sub(center).dot(v),b.clone().sub(center).dot(u)));
            for(let i=1;i<points.length-1;i++)indices.push(vertex(points[0]),vertex(points[i]),vertex(points[i+1]));
        }
    }
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setAttribute('uv',new T.Float32BufferAttribute(paintWeights,2));geo.setIndex(indices);
    const simplified=new SimplifyModifier().modify(geo,Math.floor(positions.length/3*.73));
    // Retain the sculpt's smooth lighting after offline edge collapse.
    const sp=simplified.getAttribute('position'),sn=simplified.getAttribute('normal');
    for(let i=0;i<sp.count;i++){const n=gradient(new T.Vector3().fromBufferAttribute(sp,i));sn.setXYZ(i,n.x,n.y,n.z);}
    geo.dispose();return simplified;
}

const stats=[];
async function make(id,color,build) {
    if(only&&only!==id)return;
    const parts=[], bins=new Map();
    const e=(p,r)=>parts.push(ellipsoid(p,r));
    const c=(a,b,ra,rb)=>parts.push(capsule(a,b,ra,rb));
    const tail=points=>{
        const path=new T.CatmullRomCurve3(points.map(p=>V(p.slice(0,3))),false,'catmullrom',.4);
        const segments=[],steps=32;
        const radius=t=>{const f=t*(points.length-1),i=Math.min(points.length-2,Math.floor(f));return Math.max(.060,T.MathUtils.lerp(points[i][3],points[i+1][3],f-i));};
        for(let i=1;i<=steps;i++)segments.push(capsule(path.getPoint((i-1)/steps).toArray(),path.getPoint(i/steps).toArray(),radius((i-1)/steps),radius(i/steps)));
        parts.push((x,y,z)=>Math.min(...segments.map(segment=>segment(x,y,z))));
    };
    const add=(geo,shade,at=[0,0,0],rotation=[0,0,0],scale=[1,1,1])=>{
        const matrix=new T.Matrix4().compose(V(at),new T.Quaternion().setFromEuler(new T.Euler(...rotation)),V(scale));
        if(geo.index)geo=geo.toNonIndexed();geo.applyMatrix4(matrix);geo.deleteAttribute('uv');
        if(!bins.has(shade))bins.set(shade,[]);bins.get(shade).push(geo);
    };
    const ball=(p,r,shade)=>add(new T.SphereGeometry(1,12,8),shade,p,[0,0,0],r);
    const horn=(a,b,r,shade='#f3e5c9')=>{
        const delta=V(b).sub(V(a)),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.clone().normalize());
        const geo=new T.ConeGeometry(r,delta.length(),8);geo.applyQuaternion(q);geo.translate(...V(a).add(V(b)).multiplyScalar(.5).toArray());add(geo,shade);
    };
    const line=(points,shade='#4d4544',radius=.012)=>add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(V)),12,radius,4,false),shade);
    const eyes=(x,y,z,r=.046)=>{
        for(const s of [-1,1]) {
            ball([x,y,z*s],[r,r*1.2,r*.55],'#2c302c');
            ball([x+.012,y+.023,(z+r*.47)*s],[r*.24,r*.24,r*.12],'#fff9e8');
        }
    };
    const feet=(xs,y=.29,z=.34)=>{for(const x of xs)for(const s of [-1,1]){e([x,y,s*z],[.19,y+.04,.18]);e([x+.10,.115,s*z],[.27,.12,.20]);}};
    const toes=(xs,z=.34)=>{for(const x of xs)for(const s of [-1,1])for(const dz of [-.1,0,.1])ball([x+.29,.1,s*z+dz],[.055,.035,.042],'#e4d6bf');};
    const plate=(x,y,z,w,h,shade,tilt=0)=>{
        const shape=new T.Shape();shape.moveTo(-w*.45,0);shape.lineTo(-w*.58,h*.5);shape.quadraticCurveTo(-w*.3,h*.86,0,h);shape.lineTo(w*.51,h*.61);shape.lineTo(w*.44,0);shape.closePath();
        add(new T.ExtrudeGeometry(shape,{depth:.065,steps:1,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:1}),shade,[x,y,z],[tilt,0,0]);
    };
    build({e,c,tail,ball,horn,line,eyes,feet,toes,plate,add});
    const model=new T.Group();model.name=id;
    const surfaces=[sculpt(parts,color,id).toNonIndexed()];
    for(const [shade,geos] of bins){
        const color=new T.Color(shade);
        for(const geo of geos){
            const colors=new Float32Array(geo.getAttribute('position').count*3);
            for(let i=0;i<colors.length;i+=3){colors[i]=color.r;colors[i+1]=color.g;colors[i+2]=color.b;}
            const weights=new Float32Array(geo.getAttribute('position').count*2);
            const fixed=['#2c302c','#fff9e8','#875a59','#795956','#57747e','#847149','#537f74','#668c7f','#786653','#4d4544'].includes(shade);
            for(let i=0;i<weights.length;i+=2){weights[i]=shade==='#89a7b0'?1:0;weights[i+1]=!fixed&&shade!=='#89a7b0'?1:0;}
            geo.setAttribute('uv',new T.BufferAttribute(weights,2));geo.setAttribute('color',new T.BufferAttribute(colors,3));surfaces.push(geo);
        }
    }
    const body=new T.Mesh(mergeVertices(mergeGeometries(surfaces)),new T.MeshStandardMaterial({vertexColors:true,roughness:.92,metalness:0}));body.name='clay-toy';model.add(body);
    let triangles=0;model.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?o.geometry.index.count:o.geometry.getAttribute('position').count)/3;});
    const file=await new GLTFExporter().parseAsync(model,{binary:true});
    writeFileSync(`${output}/${id}.glb`,Buffer.from(file));stats.push({id,triangles,drawCalls:model.children.length,bytes:file.byteLength});
    console.log(`${id}: ${triangles} triangles, ${model.children.length} draws, ${Math.round(file.byteLength/1024)} KB`);
}

await make('tyrannosaurus','#cd8f8b',({e,c,tail,eyes,ball,line,toes})=>{
    e([-.12,1.02,0],[.65,.72,.47]);e([.35,1.53,0],[.43,.54,.39]);
    e([.62,1.98,0],[.57,.46,.40]);e([1.04,1.80,0],[.49,.28,.36]);
    e([.94,1.62,0],[.42,.17,.32]);
    for(const s of [-1,1]) {e([-.25,.56,s*.38],[.31,.45,.25]);c([-.24,.48,s*.4],[-.17,.18,s*.43],.19,.14);e([.025,.12,s*.43],[.31,.12,.21]);
        c([.40,1.3,s*.4],[.67,1.11,s*.48],.095,.072);c([.67,1.11,s*.48],[.81,1.19,s*.49],.074,.043);
        line([[1.4,1.68,s*.25],[1.17,1.61,s*.34],[.91,1.64,s*.36]],'#875a59',.012);
        ball([1.31,1.9,s*.27],[.021,.032,.018],'#795956');
    }
    tail([[-.53,1,0,.36],[-1.16,.78,0,.26],[-1.72,.93,0,.14],[-2.03,1.35,0,.07],[-2.12,1.71,0,.018]]);
    eyes(.82,2.07,.378,.049);toes([-.17],.43);
});
await make('triceratops','#85a6b2',({e,tail,feet,eyes,horn,line,toes,add})=>{
    e([-.29,.73,0],[.84,.52,.47]);e([.56,.68,0],[.5,.38,.4]);e([1.0,.49,0],[.39,.25,.27]);
    feet([-.72,.44],.27,.37);tail([[-.86,.68,0,.24],[-1.42,.48,0,.16],[-1.86,.47,0,.018]]);
    const frill=new T.Shape();
    for(let i=0;i<24;i++){const a=i/24*Math.PI*2,r=1+(i%2?.035:-.035);const x=Math.cos(a)*.58*r,y=Math.sin(a)*.61*r;if(i===0)frill.moveTo(x,y);else frill.lineTo(x,y);}frill.closePath();
    add(new T.ExtrudeGeometry(frill,{depth:.08,steps:1,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:1}),'#89a7b0',[.25,1.05,-.04],[0,Math.PI/2,.13]);
    for(const s of [-1,1]) {horn([.59,1.06,s*.26],[.94,1.69,s*.32],.105);line([[1.30,.41,s*.15],[1.13,.36,s*.23],[.96,.40,s*.26]],'#57747e',.011);}
    horn([1.19,.68,0],[1.39,.94,0],.09);eyes(.9,.79,.302,.042);toes([-.72,.44],.37);
});
await make('stegosaurus','#c9b477',({e,tail,feet,eyes,horn,line,plate,toes})=>{
    e([-.25,.77,0],[.98,.57,.46]);e([.67,.59,0],[.41,.31,.29]);e([1.06,.47,0],[.33,.22,.22]);e([1.28,.44,0],[.19,.17,.19]);
    feet([-.77,.51],.26,.34);tail([[-1.01,.67,0,.25],[-1.55,.47,0,.16],[-2.15,.52,0,.018]]);
    for(let i=0;i<6;i++){const x=-1.1+i*.33,h=[.32,.5,.67,.72,.55,.31][i],y=.96+Math.sin(i/5*Math.PI)*.33;for(const s of [-1,1])plate(x,y,s*.12,.37,h,s>0?'#c18a89':'#b78081',s*.2);}
    for(const s of [-1,1]){horn([-1.7,.54,s*.07],[-1.85,.93,s*.19],.067);horn([-1.94,.54,s*.045],[-2.03,.79,s*.18],.055);line([[1.39,.39,s*.13],[1.19,.33,s*.19]],'#847149',.01);}
    eyes(1.19,.55,.193,.035);toes([-.77,.51],.34);
});
await make('brachiosaurus','#87b3a5',({e,tail,feet,eyes,line,ball,toes})=>{
    e([-.42,.83,0],[.79,.48,.44]);feet([-.87,.12],.38,.32);
    tail([[.12,1.0,0,.28],[.31,1.49,0,.22],[.39,2.03,0,.17],[.59,2.58,0,.15],[.77,2.96,0,.20]]);
    e([.97,3.07,0],[.34,.245,.23]);e([1.2,2.99,0],[.25,.17,.195]);
    tail([[-1.03,.78,0,.25],[-1.47,.50,0,.13],[-1.89,.55,0,.022]]);
    eyes(1.12,3.15,.203,.036);
    for(const s of [-1,1]) {line([[1.38,2.95,s*.10],[1.20,2.91,s*.185],[1.03,2.94,s*.20]],'#537f74',.01);ball([1.36,3.03,s*.10],[.015,.016,.012],'#668c7f');}
    toes([-.87,.12],.32);
});
await make('ankylosaurus','#b6a18c',({e,tail,feet,eyes,horn,ball,line,toes})=>{
    e([-.25,.62,0],[.98,.43,.55]);e([.79,.42,0],[.44,.27,.30]);e([1.06,.35,0],[.28,.17,.24]);feet([-.78,.48],.20,.4);
    tail([[-1.0,.58,0,.21],[-1.58,.46,0,.10],[-1.95,.61,0,.08]]);e([-2.05,.7,0],[.28,.26,.24]);
    for(let i=0;i<4;i++)for(let j=0;j<3;j++){const x=-.9+i*.43,z=(j-1)*.31,y=.78+Math.sqrt(Math.max(0,1-(x+.25)**2))*.2-Math.abs(z)*.15;
        ball([x,y,z],[.15,.095,.14],'#a48f7b');if(j!==1)horn([x,y,z],[x-.08,y+.19,z*1.24],.095,'#c6b29b');}
    eyes(.99,.49,.261,.033);toes([-.78,.48],.4);
    for(const s of [-1,1])line([[1.26,.31,s*.13],[1.09,.27,s*.22]],'#786653',.01);
});
await make('velociraptor','#aaa5b2',({e,tail,c,eyes,line,ball})=>{
    e([-.2,.95,0],[.57,.48,.32]);tail([[.13,1.12,0,.24],[.42,1.55,0,.14],[.55,1.8,0,.18]]);e([.85,1.85,0],[.4,.23,.23]);e([1.12,1.78,0],[.32,.15,.18]);
    tail([[-.53,1,0,.22],[-1.22,1.03,0,.13],[-2.1,1.33,0,.045]]);
    for(const s of [-1,1]){e([-.25,.65,s*.3],[.24,.37,.21]);c([-.3,.48,s*.31],[-.04,.19,s*.34],.10);e([.14,.1,s*.34],[.30,.1,.17]);c([.36,1.22,s*.24],[.69,1.05,s*.37],.07);c([.69,1.05,s*.37],[.9,1.15,s*.40],.055);line([[1.35,1.73,s*.1],[1.02,1.68,s*.19]],'#4d4544',.01);ball([.33,.18,s*.4],[.045,.1,.04],'#e8d9ba');}
    eyes(1.0,1.92,.206,.04);
});
await make('spinosaurus','#9685a6',({e,tail,c,eyes,line,plate})=>{
    e([-.3,.88,0],[.72,.50,.39]);e([.28,1.08,0],[.45,.40,.31]);e([.69,1.27,0],[.35,.25,.25]);e([1.08,1.13,0],[.48,.16,.18]);
    tail([[-.82,.84,0,.27],[-1.45,.54,0,.14],[-2.1,.35,0,.04]]);
    for(const s of [-1,1]){e([-.56,.49,s*.33],[.29,.39,.24]);e([-.37,.11,s*.4],[.3,.11,.20]);c([.35,.87,s*.30],[.52,.57,s*.39],.09);c([.52,.57,s*.39],[.75,.63,s*.39],.07);line([[1.46,1.06,s*.1],[1.1,1.0,s*.18],[.76,1.07,s*.2]],'#4d4544',.01);}
    for(let i=0;i<7;i++){const x=-1+i*.23,h=.36+Math.sin(i/6*Math.PI)*.58;plate(x,1.10,0,.34,h,'#786889');}eyes(.84,1.37,.22,.04);
});
await make('parasaurolophus','#d3a6a4',({e,tail,c,eyes,line})=>{
    e([-.15,.88,0],[.62,.58,.4]);tail([[.15,1.13,0,.3],[.47,1.65,0,.22],[.65,1.91,0,.19]]);e([.88,1.94,0],[.43,.27,.29]);e([1.11,1.85,0],[.29,.17,.22]);
    tail([[.56,2.1,0,.2],[.22,2.49,0,.16],[-.4,2.7,0,.12],[-.92,2.52,0,.08]]);tail([[-.65,.8,0,.28],[-1.28,.52,0,.15],[-1.86,.5,0,.04]]);
    for(const s of [-1,1]){e([-.4,.44,s*.35],[.27,.36,.21]);e([-.2,.1,s*.4],[.30,.1,.2]);c([.41,1.15,s*.33],[.63,.78,s*.40],.07);line([[1.35,1.79,s*.1],[1.12,1.73,s*.2]],'#4d4544',.01);}eyes(.99,2.04,.253,.04);
});
await make('pteranodon','#a5bac5',({e,c,tail,eyes,add})=>{
    e([0,.72,0],[.4,.42,.26]);tail([[.16,.89,0,.2],[.43,1.33,0,.16]]);e([.57,1.43,0],[.29,.22,.22]);tail([[.68,1.42,0,.15],[1.23,1.36,0,.03]]);tail([[.38,1.53,0,.14],[-.32,1.83,0,.035]]);
    for(const s of [-1,1]){c([-.08,.45,s*.15],[.05,.10,s*.24],.07);e([.19,.08,s*.25],[.22,.08,.12]);c([0,.98,s*.20],[-.05,1.33,s*.66],.085);c([-.05,1.33,s*.66],[-.48,.83,s*.96],.05);
      const shape=new T.Shape();shape.moveTo(.25,.75);shape.quadraticCurveTo(.05,1.15,-.05,1.33);shape.lineTo(-1.0,1.11);shape.quadraticCurveTo(-.56,.6,-.25,.45);shape.closePath();
      add(new T.ExtrudeGeometry(shape,{depth:.025,bevelEnabled:true,bevelSize:.025,bevelThickness:.018,bevelSegments:1,steps:1}),'#ddd2b9',[0,0,s*.23],[0,s*1.07,0]);}
    eyes(.66,1.51,.197,.035);
});
await make('plesiosaur','#95b6c8',({e,tail,eyes,line})=>{
    e([-.45,.43,0],[.78,.30,.44]);tail([[.03,.50,0,.22],[.4,.96,0,.16],[.69,1.65,0,.13],[.93,1.91,0,.17]]);e([1.1,1.99,0],[.32,.2,.20]);tail([[-1.0,.42,0,.22],[-1.63,.27,0,.08]]);
    for(const x of [-.87,-.08])for(const s of [-1,1]){e([x-.16,.16,s*.58],[.38,.09,.30]);e([x-.34,.1,s*.77],[.25,.07,.23]);}
    eyes(1.2,2.05,.183,.031);for(const s of [-1,1])line([[1.37,1.94,s*.10],[1.15,1.90,s*.18]],'#4d4544',.01);
});
await make('dinosaur-egg','#e5dcc5',({e,ball})=>{
    e([0,.62,0],[.54,.61,.48]);e([0,.98,0],[.40,.49,.36]);
    for(let i=0;i<7;i++){const a=i*2.399,y=.38+(i%3)*.3;ball([Math.cos(a)*.45,y,Math.sin(a)*.40],[.13,.12,.07],'#98ad8b');}
});
await make('dinosaur-fossil','#dfd2b4',({e,c,tail,ball,eyes,line})=>{
    c([-.52,.87,0],[.38,1.17,0],.095);c([.38,1.17,0],[.6,1.7,0],.11);e([.89,1.85,0],[.43,.29,.27]);e([1.08,1.64,0],[.33,.08,.22]);
    tail([[-.53,.88,0,.12],[-1.2,.52,0,.08],[-1.85,.61,0,.025]]);
    for(const s of [-1,1]){c([-.4,.83,0],[-.38,.50,s*.30],.095);c([-.38,.5,s*.3],[-.1,.15,s*.34],.07);c([-.1,.1,s*.34],[.24,.1,s*.34],.065);c([.32,1.15,s*.1],[.6,.91,s*.35],.06);
      ball([1.0,1.87,s*.251],[.12,.12,.035],'#4d4544');for(let i=0;i<4;i++){const x=-.45+i*.20;line([[x,.94,0],[x+.09,.82,s*.29],[x+.10,.58,s*.22]],'#dfd2b4',.048);}for(let i=0;i<4;i++)c([.83+i*.12,1.70,s*.20],[.83+i*.12,1.58,s*.20],.028);}
});
await make('aiven-chimera','#b784b5',({e,c,tail,eyes,ball,line,toes,horn,plate})=>{
    // Aiven's impossible three-star catch: a T. rex torso and tiny arms,
    // brachiosaur neck, three ceratopsian horns and paired stegosaur plates.
    e([-.20,.98,0],[.69,.71,.48]);e([.26,1.29,0],[.40,.48,.37]);
    tail([[.19,1.24,0,.29],[.36,1.76,0,.23],[.39,2.26,0,.18],[.59,2.75,0,.18],[.75,2.94,0,.22]]);
    e([.88,3.02,0],[.43,.30,.29]);e([1.21,2.93,0],[.34,.20,.25]);e([1.12,2.79,0],[.29,.12,.22]);
    for(const s of [-1,1]){
        e([-.32,.51,s*.39],[.32,.42,.26]);c([-.30,.45,s*.4],[-.18,.17,s*.44],.18,.14);e([.04,.12,s*.44],[.33,.12,.22]);
        c([.40,1.24,s*.37],[.62,1.02,s*.48],.094,.07);c([.62,1.02,s*.48],[.77,1.11,s*.49],.07,.043);
        horn([.84,3.20,s*.19],[1.02,3.66,s*.25],.095,'#e4ca83');
        line([[1.49,2.86,s*.13],[1.29,2.78,s*.225],[1.03,2.81,s*.25]],'#4d4544',.01);
        ball([1.44,3.00,s*.14],[.018,.026,.015],'#795956');
    }
    horn([1.38,3.07,0],[1.55,3.35,0],.076,'#e4ca83');
    tail([[-.64,.92,0,.34],[-1.24,.66,0,.25],[-1.82,.74,0,.13],[-2.13,1.08,0,.065],[-2.22,1.40,0,.02]]);
    for(let i=0;i<5;i++){
        const x=-1.53+i*.31,y=[.87,1.04,1.34,1.55,1.63][i],h=[.27,.38,.47,.54,.40][i];
        for(const s of [-1,1])plate(x,y,s*.13,.33,h,s>0?'#9ebdc9':'#89a9bd',s*.20);
    }
    eyes(1.04,3.09,.269,.043);toes([-.16],.44);
});
if(only&&!stats.length)throw new Error(`Unknown dinosaur model: ${only}`);
const previous=only&&existsSync(`${output}/manifest.json`)?JSON.parse(readFileSync(`${output}/manifest.json`,'utf8')):[];
writeFileSync(`${output}/manifest.json`,JSON.stringify([...previous.filter(entry=>!stats.some(item=>item.id===entry.id)),...stats],null,2));
