import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {CreatorRollBridge} from '../../apps/room3d/chibi/CreatorRollBridge';
import {createVisitor,decodeParts,type ChibiVisitor} from '../../apps/room3d/chibi/visitor';
import {selectedHairAssets,type Parts} from '../../apps/room3d/chibi/types';
import {createSocialScene,socialActions,motionCategories,type SocialAction} from '../../apps/room3d/chibi/social';
import {testCharacter} from './room3d-test-character';
import {defaultFace} from '../../apps/room3d/chibi/faceAppearance';
import './room3d-social.css';
const names=['你','小栗','来访角色'],ids=['user','character','guest'];
function Social(){
 const [request,setRequest]=useState(0),[parts,setParts]=useState<Parts>(),[body,setBody]=useState<'blank'|'classic'>('blank');
 const [seated,setSeated]=useState(new URLSearchParams(location.search).get('seated')==='user'?'user':new URLSearchParams(location.search).get('seated')==='character'?'character':'');
 const [heights,setHeights]=useState([1,1.15,1]),[a,setA]=useState('user'),[b,setB]=useState('character');
 const [action,setAction]=useState<SocialAction>('home-hug'),[busy,setBusy]=useState(true),[status,setStatus]=useState('准备角色…'),[paused,setPaused]=useState(false),[time,setTime]=useState(0);
 const host=useRef<HTMLDivElement>(null),runtime=useRef<ReturnType<typeof createSocialScene>>(),pause=useRef(false);pause.current=paused;
 useEffect(()=>{
  if(!parts)return;
  let dead=false,frame=0;const visitors:ChibiVisitor[]=[];
  const scene=new T.Scene();scene.background=new T.Color('#eff2e9');
  const renderer=new T.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=T.SRGBColorSpace;host.current!.append(renderer.domElement);
  const camera=new T.PerspectiveCamera(35,1,.05,80);camera.position.set(body==='blank'?6:5,body==='blank'?4.5:2.7,7);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(.4,body==='blank'?1.3:.65,0);controls.minDistance=2;controls.maxDistance=15;controls.maxPolarAngle=Math.PI*.48;controls.update();
  scene.add(new T.HemisphereLight('#ffffff','#9ca994',2.3));const sun=new T.DirectionalLight('#fff4e2',2.4);sun.position.set(3,7,5);scene.add(sun);
  const floor=new T.Mesh(new T.CircleGeometry(5,80),new T.MeshStandardMaterial({color:'#dce2d2',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.01;scene.add(floor);
  const chair=new T.Mesh(new T.BoxGeometry(.95,.18,.85),new T.MeshStandardMaterial({color:'#71806b'}));chair.visible=!!seated&&body==='blank';chair.position.set(0,.86,seated==='user'?1.2:-1.2);scene.add(chair);
  const grid=new T.GridHelper(10,20,'#b7c2ac','#cbd3c2');grid.position.y=-.005;scene.add(grid);
  const resize=new ResizeObserver(()=>{const rect=host.current?.getBoundingClientRect();if(!rect)return;renderer.setSize(rect.width,rect.height);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();});resize.observe(host.current!);
  setBusy(true);setStatus('准备三个居民…');setTime(0);
  void(async()=>{
   try{
    for(let i=0;i<3;i++){
     const v=await createVisitor(parts,{layers:{},extras:[],assets:selectedHairAssets(testCharacter.state),bodyShape:body,bodyHeight:heights[i],headSize:1.04,face:{...defaultFace,irisColor:['#56765b','#896c49','#788099'][i]}});
     visitors.push(v);if(dead){visitors.forEach(x=>x.dispose());return;}
     v.root.position.set(i===2?2.2:0,0,i===0?1.2:i===1?-1.2:-1.8);v.root.rotation.y=i===0?Math.PI:0;if(body==='blank'&&ids[i]===seated)v.root.position.y=.95;scene.add(v.root);
     const badge=document.createElement('canvas');badge.width=256;badge.height=64;const c=badge.getContext('2d')!;c.fillStyle='#213a2b';c.textAlign='center';c.font='32px sans-serif';c.fillText(names[i],128,43);
     const texture=new T.CanvasTexture(badge),label=new T.Sprite(new T.SpriteMaterial({map:texture,depthTest:false}));label.scale.set(.9,.225,1);label.position.set(0,body==='blank'?3.3+(heights[i]-1)*1.8:1.45,0);v.root.add(label);label.userData.badge=true;
    }
    const r=createSocialScene(visitors.map((visitor,i)=>({id:ids[i],visitor})),{pinned:body==='blank'&&seated?{id:seated,pose:{kind:'seat',hands:[],seatHeight:.95/visitors[ids.indexOf(seated)].seatScale}}:undefined});runtime.current=r;
    const w=window as any;w.__social={runtime:r,visitors,camera,controls};
    w.render_game_to_text=()=>JSON.stringify({coordinates:'Y up; metres; all residents share one body type',...r.inspect()});
    w.advanceTime=(ms:number)=>{r.advance(ms/1000);setTime(r.inspect().session?.time??0);renderer.render(scene,camera);};
    let previous=performance.now(),lastStatus=0;
    const loop=(now:number)=>{if(dead)return;const dt=Math.min((now-previous)/1000,.05);previous=now;if(!pause.current)r.advance(dt);renderer.render(scene,camera);if(now-lastStatus>100){setTime(r.inspect().session?.time??0);lastStatus=now;}frame=requestAnimationFrame(loop);};frame=requestAnimationFrame(loop);
    setBusy(false);setStatus('选两位居民，拖动视角检查动作。');
   }catch(error){if(!dead){setStatus(String(error));console.error(error);}}
  })();
  return()=>{dead=true;cancelAnimationFrame(frame);resize.disconnect();controls.dispose();runtime.current?.cancel();runtime.current=undefined;visitors.forEach(v=>{v.root.traverse(o=>{if(o instanceof T.Sprite){o.material.map?.dispose();o.material.dispose();}});v.dispose();});chair.geometry.dispose();chair.material.dispose();floor.geometry.dispose();floor.material.dispose();grid.geometry.dispose();(grid.material as T.Material).dispose();renderer.dispose();renderer.domElement.remove();delete (window as any).__social;delete (window as any).advanceTime;delete (window as any).render_game_to_text;};
 },[parts,body,seated,...heights]);
 const play=async(kind=action)=>{const r=runtime.current;if(!r)return;r.reset();setAction(kind);setPaused(true);setStatus('载入动作…');try{if(await r.start(kind,a,b)){setPaused(false);setStatus(`${names[ids.indexOf(a)]}${socialActions[kind].participants===2?' → '+names[ids.indexOf(b)]:''} · ${socialActions[kind].label}`);}}catch(e){setStatus(String(e));}};
 return <main><header><div><p className="eyebrow">家园 / 动作试验场</p><h1>一起生活的小人</h1><p>全场统一体型 · 两人互动，第三人保留独立状态</p></div><div className="body-choice"><button disabled={busy} aria-pressed={body==='classic'} onClick={()=>setBody('classic')}>全 Chibi</button><button disabled={busy} aria-pressed={body==='blank'} onClick={()=>setBody('blank')}>全二号素体</button></div></header><div className="stage" ref={host}/><aside><label>拥抱姿势<select aria-label="拥抱姿势" value={seated} disabled={busy||body!=='blank'} onChange={e=>{setAction('home-hug');setA('user');setB('character');setSeated(e.target.value);}}><option value="">两人站着</option><option value="character">小栗坐着，你跪下抱</option><option value="user">你坐着，小栗跪下抱</option></select></label><div className="participants"><label>主动方<select aria-label="主动方" disabled={busy} value={a} onChange={e=>{runtime.current?.reset();setA(e.target.value);if(e.target.value===b)setB(a);}}>{ids.map((id,i)=>seated&&body==='blank'&&id==='guest'?null:<option key={id} value={id}>{names[i]}</option>)}</select></label><button disabled={busy} onClick={()=>{runtime.current?.reset();setA(b);setB(a);}}>⇄ 交换</button><label>回应方<select aria-label="回应方" disabled={busy} value={b} onChange={e=>{runtime.current?.reset();setB(e.target.value);if(e.target.value===a)setA(b);}}>{ids.map((id,i)=>seated&&body==='blank'&&id==='guest'?null:<option key={id} value={id}>{names[i]}</option>)}</select></label></div><div className="heights">{names.map((name,i)=><label key={name}>{name}身高 <output>{Math.round(heights[i]*100)}%</output><input aria-label={name+'身高'} type="range" min="80" max="125" step="5" value={heights[i]*100} disabled={busy||body==='classic'} onChange={e=>setHeights(h=>h.map((x,j)=>i===j?+e.target.value/100:x))}/></label>)}</div><nav>{Object.entries(motionCategories).map(([category,label])=><section key={category}><h3>{label}</h3>{Object.entries(socialActions).filter(([,v])=>v.category===category&&(!seated||body!=='blank'||v.id==='home-hug')&&(!['home-princess-carry','home-princess-carried'].includes(v.id)||body==='blank')).map(([key,value])=><button disabled={busy} key={key} aria-pressed={action===key} onClick={()=>play(key as SocialAction)}>{value.label}</button>)}</section>)}</nav><div className="transport"><button disabled={busy} onClick={()=>void play()}>重播</button><button disabled={busy} onClick={()=>setPaused(x=>!x)}>{paused?'继续':'暂停'}</button><button disabled={busy} onClick={()=>{runtime.current?.cancel();setTime(0);}}>停止</button><input aria-label="动作进度" type="range" min="0" max={runtime.current?.inspect().session?.duration??socialActions[action].duration} step=".01" value={time} disabled={busy} onChange={async e=>{const value=+e.target.value;setPaused(true);if(!runtime.current?.inspect().session)await runtime.current?.start(action,a,b);runtime.current?.seek(value);setTime(value);}}/><output>{time.toFixed(1)} s</output></div><p role="status">{status}</p><p><a href="./room3d-body-comparison.html?room=beds&body=blank">床上说话 / 玩手机 / 侧躺 →</a></p><p><a href="./room3d-motion-library.html">查看保留的源动作 →</a></p><p className="note">双人互动共用时间轴；亲密动作按参考视频制作，公主抱由主动方抱起回应方，仅支持二号素体。这里使用试验角色，不改家园存档。</p></aside><CreatorRollBridge savedState={testCharacter.state} request={request} onReady={()=>setRequest(1)} onResult={result=>{void decodeParts(result).then(setParts).catch(error=>setStatus(String(error)));}} onError={setStatus}/></main>;
}
createRoot(document.getElementById('root')!).render(<Social/>);
