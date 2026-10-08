import {bodyOutsideBand} from './body-occlusion.js';
import {pleatedSkirtData} from './pleated-skirt.js';

const smooth = t => {t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const radiusCaches=new WeakMap();
// Rest-space horizontal body section. Cache the safe radius before any sliders
// alter the garment, so repeated edits neither drift nor squeeze through skin.
function bodyRadius(geometry,x,y,z){
 let cache=radiusCaches.get(geometry);if(!cache){cache=new Map();radiusCaches.set(geometry,cache);}const key=[x,y,z].map(n=>n.toFixed(6)).join(',');if(cache.has(key))return cache.get(key);
 const p=geometry.attributes.position,ix=geometry.index,center=.055,r=Math.hypot(x,z-center);
 if(r<1e-6)return 0;
 const dx=x/r,dz=(z-center)/r;let nearest=Infinity;
 for(let i=0;i<ix.count;i+=3){const hits=[];
  for(let e=0;e<3;e++){const a=ix.getX(i+e),b=ix.getX(i+(e+1)%3),ya=p.getY(a),yb=p.getY(b);if((ya<y)===(yb<y))continue;const t=(y-ya)/(yb-ya);hits.push([p.getX(a)+(p.getX(b)-p.getX(a))*t,p.getZ(a)+(p.getZ(b)-p.getZ(a))*t-center]);}
  if(hits.length!==2)continue;const [[ax,az],[bx,bz]]=hits,ex=bx-ax,ez=bz-az,denom=dx*ez-dz*ex;if(Math.abs(denom)<1e-8)continue;
  const distance=(ax*ez-az*ex)/denom,u=(ax*dz-az*dx)/denom;
  if(distance>0&&u>=-1e-6&&u<=1+1e-6)nearest=Math.min(nearest,distance);
 }
 const result=Number.isFinite(nearest)?nearest:0;cache.set(key,result);return result;
}

export function setupLowerwear({model}) {
 let meta;model.traverse(o=>{if(o.userData.lowerwear)meta=o.userData.lowerwear;});if(!meta)return;
 const body=model.getObjectByName('Mesh_0'),originalBody=body.geometry,fullIndex=Array.from(body.geometry.index.array),bodySurface=body.geometry.clone();
 const clothing=[];model.traverse(o=>{if(o.isMesh&&o.name.startsWith('Lowerwear_'))clothing.push(o);});
 const key='sully-lowerwear-'+meta.id+'-v1',defaults={length:100,waist:meta.id==='shorts'?90:100,...(meta.pleats?{pleats:meta.pleats.count}:{})};let fit={...defaults};
 try{const saved=JSON.parse(localStorage.getItem(key));if(Number.isFinite(saved?.length))fit.length=Math.max(85,Math.min(105,saved.length));if(Number.isFinite(saved?.waist))fit.waist=Math.max(80,Math.min(120,saved.waist));}catch{}
 if(meta.pleats)try{const saved=JSON.parse(localStorage.getItem(key));if(Number.isFinite(saved?.pleats))fit.pleats=Math.max(12,Math.min(24,Math.round(saved.pleats/2)*2));}catch{}
 const snapshot=m=>{const p=m.geometry.attributes.position.array.slice(),safe=new Float32Array(p.length/3);for(let i=0;i<safe.length;i++)if(p[i*3+1]>2.10)safe[i]=bodyRadius(bodySurface,p[i*3],p[i*3+1],p[i*3+2])+.018;return {m,p,n:m.geometry.attributes.normal.array.slice(),safe};};
 let snapshots=clothing.map(snapshot),builtPleats=meta.pleats?.count;
 const pleatTemplate=meta.pleats?clothing[0].geometry.clone():null,pleatSpec=meta.pleats?structuredClone(meta.pleats):null;
 function rebuildPleats(){
  if(!meta.pleats||builtPleats===fit.pleats)return;
  const data=pleatedSkirtData({...pleatSpec,count:fit.pleats}),g=new pleatTemplate.constructor(),oldVertices=pleatSpec.vertexCount,newVertices=data.position.length/3;
  for(const [name,attribute]of Object.entries(pleatTemplate.attributes)){
   const field={position:'position',skinIndex:'skinIndex',skinWeight:'skinWeight'}[name],values=field?data[field]:new Array(newVertices*attribute.itemSize).fill(0),tail=attribute.array.slice(oldVertices*attribute.itemSize);
   g.setAttribute(name,new attribute.constructor(new attribute.array.constructor([...values,...tail]),attribute.itemSize,attribute.normalized));
  }
  const index=[...data.index,...Array.from(pleatTemplate.index.array.slice(pleatSpec.indexCount),i=>i-oldVertices+newVertices)];g.setIndex(index);g.computeVertexNormals();
  clothing[0].geometry.dispose();clothing[0].geometry=g;snapshots=clothing.map(snapshot);builtPleats=fit.pleats;
  meta.pleats={...pleatSpec,count:fit.pleats,vertexCount:newVertices,indexCount:data.index.length};meta.triangles=index.length/3;
 }
 const panel=document.createElement('section');panel.id='garment-fit';panel.innerHTML=`<h2>下装版型</h2><p>${meta.label} · ${meta.triangles.toLocaleString()} 三角面</p><div class="fit-control"><label for="lower-length">${meta.skirt?'裙长':'裤长'}</label><output id="lower-length-value"></output><input id="lower-length" type="range" min="85" max="105" step="1"><div class="fit-endpoints"><span>短一些</span><span>长一些</span></div></div><div class="fit-control"><label for="lower-waist">腰部松紧</label><output id="lower-waist-value"></output><input id="lower-waist" type="range" min="80" max="120" step="1"><div class="fit-endpoints"><span>贴合</span><span>宽松</span></div></div><div class="row"><button id="lower-undo">撤销</button><button id="lower-redo">重做</button><button id="lower-reset">恢复默认</button></div><p class="fit-note">自动保存 · 导出模型保留调整</p>`;
 if(meta.pleats){const extra=document.createElement('div');extra.className='fit-control';extra.innerHTML='<label for="lower-pleats">褶子数量</label><output id="lower-pleats-value"></output><input id="lower-pleats" type="range" min="12" max="24" step="2"><div class="fit-endpoints"><span>宽褶</span><span>细褶</span></div>';panel.querySelector('.row').before(extra);}
 document.getElementById('presets').before(panel);let undo=[],redo=[],editing=null;
 function apply(){
  rebuildPleats();
  const scale=fit.length/100;
  for(const {m,p,n,safe}of snapshots){const g=m.geometry,pos=g.attributes.position,normal=g.attributes.normal;pos.array.set(p);normal.array.set(n);
   for(let i=0;i<pos.count;i++){
    const x=p[i*3],y=p[i*3+1],z=p[i*3+2],radius=Math.hypot(x,z-.055),blend=smooth((y-2.10)/.32);
    if(radius>1e-6&&blend>0){const target=Math.max(safe[i],radius*fit.waist/100),factor=1+(target/radius-1)*blend;pos.setX(i,x*factor);pos.setZ(i,.055+(z-.055)*factor);}
    if(y<2.30)pos.setY(i,2.30+(y-2.30)*scale);
   }
   if(fit.length!==100||fit.waist!==100)g.computeVertexNormals();pos.needsUpdate=true;normal.needsUpdate=true;g.computeBoundingBox();g.computeBoundingSphere();
  }
  const on=document.getElementById('clothing').checked;clothing.forEach(m=>m.visible=on);const pos=originalBody.attributes.position,kept=[],hem=2.30+(meta.hem-2.30)*scale;
  if(meta.id==='shorts'){if(body.geometry!==originalBody)body.geometry.dispose();body.geometry=on?bodyOutsideBand(originalBody,hem+.10,meta.waist-.14):originalBody;}
  else {for(let i=0;i<fullIndex.length;i+=3){const ids=fullIndex.slice(i,i+3);if(!on||!ids.every(v=>pos.getY(v)>hem+.14&&pos.getY(v)<2.46))kept.push(...ids);}body.geometry.setIndex(kept);}
  for(const name of Object.keys(defaults)){panel.querySelector('#lower-'+name).value=fit[name];panel.querySelector('#lower-'+name+'-value').textContent=fit[name]+(name==='pleats'?' 道':'%');}
  panel.querySelector('p').textContent=meta.label+' · '+clothing.reduce((n,m)=>n+m.geometry.index.count/3,0).toLocaleString()+' 三角面';
  panel.querySelector('#lower-undo').disabled=!undo.length;panel.querySelector('#lower-redo').disabled=!redo.length;
  try{localStorage.setItem(key,JSON.stringify(fit));}catch{panel.querySelector('.fit-note').textContent='本次调整有效；浏览器未允许保存';}
 }
 const record=()=>{undo.push({...fit});if(undo.length>40)undo.shift();redo=[];};
 for(const name of Object.keys(defaults)){const slider=panel.querySelector('#lower-'+name);slider.onpointerdown=()=>{if(editing!==name){record();editing=name;}};slider.oninput=()=>{if(editing!==name){record();editing=name;}fit[name]=Number(slider.value);apply();};slider.onchange=slider.onblur=()=>editing=null;}
 panel.querySelector('#lower-undo').onclick=()=>{if(undo.length){redo.push({...fit});fit=undo.pop();editing=null;apply();}};
 panel.querySelector('#lower-redo').onclick=()=>{if(redo.length){undo.push({...fit});fit=redo.pop();editing=null;apply();}};
 panel.querySelector('#lower-reset').onclick=()=>{if(Object.keys(defaults).some(k=>fit[k]!==defaults[k])){record();fit={...defaults};editing=null;apply();}};
 document.getElementById('clothing').onchange=apply;document.getElementById('handles').checked=false;document.getElementById('handles').dispatchEvent(new Event('change'));apply();
 window.lowerwear={meta,getLength:()=>fit.length,getWaist:()=>fit.waist,getPleats:()=>fit.pleats};window.render_game_to_text=()=>JSON.stringify({outfit:meta.id,...fit,visible:document.getElementById('clothing').checked});
}
