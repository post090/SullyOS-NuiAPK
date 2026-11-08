import PhotoLookLibrary from './PhotoFilterPresets';
import PhotoLetteringControls from './PhotoLetteringControls';
import {defaultPhotoLettering,loadPhotoFont,readPhotoLettering,writePhotoLettering,type PhotoLettering} from './photoLettering';
import {PhotoActions} from './PhotoActions';
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Camera,X,DownloadSimple,ArrowCounterClockwise,ShareNetwork,SlidersHorizontal,Users,PersonSimpleRun,Sparkle,CaretDown,CaretLeft,Eye} from '@phosphor-icons/react';
import type {HomeEditor} from './editor';
import {photoLooks,type PhotoLook} from './photoEffects';
import {savePhotoToGallery,shareOrDownloadBlob} from '../../utils/shareExport';
import {useOSOptional} from '../../context/OSContext';
import './homePhoto.css';
import {useLocalBackHandler} from '../../hooks/useLocalBackHandler';
import {photoFrames,photoDrag,type PhotoFrame} from './photoFrame';
import {composePhoto,photoCaptureAspect,photoWindows,isPhotoPaper} from './photoComposition';

type PhotoFace=Parameters<HomeEditor['setPhotoFace']>[1];
const expressions={original:'原表情',neutral:'自然',smile:'微笑',happy:'开心',closed:'闭眼笑',surprised:'惊讶'} as const;
const names={natural:'原片',neon:'霓虹失眠',dream:'粉蓝梦游',afterglow:'末班余光',watercolor:'夏日手绘',daylight:'晴空物语'};
// 家具灯光色调：与画质面板共用同一份持久化设置；「跟随房间」只取消拍照内的强开。
const lampColors=[['#ff5f56','红'],['#ffd090','橙'],['#ffe663','黄'],['#8fe08a','绿'],['#6fd9e8','青'],['#8aa9ff','蓝'],['#c99cff','紫']] as const;
// 拍照时段：与 roomLighting.js 的 ROOM_LIGHT_PHASES 保持一致（无类型声明故硬编码）。
const photoTimes=[['auto','跟随房间'],['morning','清晨'],['day','白天'],['sunset','夕阳'],['night','夜晚']] as const;
const photoTabs=[['镜头',SlidersHorizontal,'构图与焦距'],['人物',Users,'表情与位置'],['动作',PersonSimpleRun,'姿势与互动'],['氛围',Sparkle,'光线与色调']] as const;
type PhotoTab=typeof photoTabs[number][0];
export default function HomePhotoMode({editor,onClose}:{editor:HomeEditor;onClose:()=>void}){
 const addToast=useOSOptional()?.addToast??(()=>{});
 const canvas=useRef<HTMLCanvasElement>(null),[actors,setActors]=useState<Array<{id:string;label:string}>>([]),[actor,setActor]=useState('');
 const [tab,setTab]=useState<PhotoTab>('镜头'),[look,setLook]=useState<PhotoLook>({...photoLooks.daylight}),[camera,setCamera]=useState({yaw:0,pitch:4,zoom:1,height:1.2,pan:0,roll:0});
 const [gap,setGap]=useState(.85),[poses,setPoses]=useState<Record<string,{motion:string;time:number;turn:number}>>({}),[revision,refresh]=useState(0),[shot,setShot]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false),[hidden,setHidden]=useState(false);
 const [compactActions,setCompactActions]=useState(false),[panelOpen,setPanelOpen]=useState(false),[advanced,setAdvanced]=useState(false);
 const shell=useRef<HTMLDivElement>(null),stage=useRef<HTMLDivElement>(null),[bounds,setBounds]=useState({w:0,h:0}),[stageBounds,setStageBounds]=useState({w:0,h:0}),[sideways,setSideways]=useState(false);
 const [format,setFormat]=useState<PhotoFrame>('screen'),[shotFormat,setShotFormat]=useState<PhotoFrame>('screen'),[shotAspect,setShotAspect]=useState(3/4),[grid,setGrid]=useState(false),[moving,setMoving]=useState(false),[shooting,setShooting]=useState(false);
 const [letteringLibrary,setLetteringLibrary]=useState(readPhotoLettering);
 const lettering=letteringLibrary[format]||defaultPhotoLettering(format);
 const changeLettering=(value:PhotoLettering)=>{const next={...letteringLibrary,[format]:value};setLetteringLibrary(next);try{writePhotoLettering(next);}catch{setError('文字已应用，但未能记住，下次打开需要重新设置');}};
 const applyLook=(value:PhotoLook)=>{setLook(value);setOriginal(false);};
 const previewSource=useRef<HTMLCanvasElement>();
 const settle=useRef<ReturnType<typeof setTimeout>>();
 const rotated=sideways&&bounds.h>bounds.w,viewW=rotated?bounds.h:bounds.w,viewH=rotated?bounds.w:bounds.h,frameAspect=photoFrames[format].aspect,aspect=format==='screen'&&viewW>0&&viewH>0?viewW/viewH:frameAspect;
 const sidePanel=viewW>=800||viewW>viewH,stageW=stageBounds.w||viewW,stageH=stageBounds.h||viewH;
 const frameW=Math.max(1,Math.min(stageW,stageH*aspect)),frameH=frameW/aspect;
 const frameStyle={width:frameW,height:frameH};
 const [faces,setFaces]=useState<Record<string,PhotoFace>>({});
 const face=faces[actor]||{};
 const changeFace=(value:PhotoFace)=>{setFaces(prev=>({...prev,[actor]:{...prev[actor],...value}}));editor.setPhotoFace(actor,value);refresh(n=>n+1);};
 const [dragMode,setDragMode]=useState<'orbit'|'pan'>('orbit');
 const [original,setOriginal]=useState(false);
 const [dof,setDof]=useState({enabled:false,aperture:.6,range:3,strength:1,bokeh:0}),[focusDot,setFocusDot]=useState<{x:number;y:number}|null>(null);
 const [focusMode,setFocusMode]=useState<'head'|'body'|'free'>('free'),[focusActor,setFocusActor]=useState(''),[lampChoice,setLampChoice]=useState(''),[photoTime,setPhotoTime]=useState<string|null>(null);
 const activePhotoTime=()=>photoTime??editor.getLightingMode();
 const applyFocusMode=(mode:'head'|'body'|'free')=>{setFocusMode(mode);if(mode==='free'){setFocusDot(null);editor.setPhotoFocusPart(null,null);}else editor.setPhotoFocusPart(focusActor,mode);refresh(n=>n+1);};
 useEffect(()=>{if(focusMode!=='free'&&dof.enabled)editor.setPhotoFocusPart(focusActor,focusMode);},[focusActor]);
 const focusDrag=useRef(false);
 const changeDof=(v:Partial<typeof dof>)=>{const next={...dof,...v};setDof(next);editor.setPhotoDof(next);if(next.enabled){if(focusMode==='free'){if(!focusDot){setFocusDot({x:.5,y:.42});editor.setPhotoFocusAt(0,.16);}}else editor.setPhotoFocusPart(focusActor,focusMode);}refresh(n=>n+1);};
 const applyFocus=(e:React.PointerEvent)=>{
  // 横屏取景先逆旋转指针，再换算 object-fit:contain 的实际画面区域。
  const el=canvas.current!,rect=el.getBoundingClientRect();if(!el.width||!el.height||!rect.width||!rect.height)return;
  const layoutW=rotated?rect.height:rect.width,layoutH=rotated?rect.width:rect.height;
  const screenX=e.clientX-(rect.left+rect.width/2),screenY=e.clientY-(rect.top+rect.height/2);
  const localX=rotated?layoutW/2+screenY:e.clientX-rect.left,localY=rotated?layoutH/2-screenX:e.clientY-rect.top;
  const scale=Math.min(layoutW/el.width,layoutH/el.height)||1,dispW=el.width*scale,dispH=el.height*scale,ox=(layoutW-dispW)/2,oy=(layoutH-dispH)/2;
  const px=Math.min(dispW,Math.max(0,localX-ox)),py=Math.min(dispH,Math.max(0,localY-oy));
  setFocusDot({x:(ox+px)/layoutW,y:(oy+py)/layoutH});
  if(editor.setPhotoFocusAt(px/dispW*2-1,-(py/dispH*2-1)))refresh(n=>n+1);
 };
 const cameraRef=useRef(camera);cameraRef.current=camera;const pointers=useRef(new Map<number,{x:number;y:number}>());
 const shotRef=useRef(''),alive=useRef(true),shotRequest=useRef(0);
 const clearShot=useCallback(()=>{if(shotRef.current)URL.revokeObjectURL(shotRef.current);shotRef.current='';setShot('');},[]);
 const handleBack=useCallback(()=>{if(shot){clearShot();return;}if(advanced){setAdvanced(false);return;}if(panelOpen){setPanelOpen(false);setCompactActions(false);return;}onClose();},[shot,advanced,panelOpen,onClose,clearShot]);
 useLocalBackHandler(()=>{handleBack();return true;},60);
 useEffect(()=>{alive.current=true;const a=editor.beginPhotoMode();setActors(a);setActor(a[0]?.id||'');setFocusActor(a[0]?.id||'');setLampChoice('');setPhotoTime(null);editor.setPhotoCamera(camera);refresh(n=>n+1);return()=>{alive.current=false;shotRequest.current++;editor.endPhotoMode();if(shotRef.current)URL.revokeObjectURL(shotRef.current);};},[editor]);
 useEffect(()=>editor.subscribePhoto?.(()=>refresh(n=>n+1)),[editor]);
 useEffect(()=>{const element=shell.current!;const measure=()=>setBounds({w:element.clientWidth,h:element.clientHeight});measure();const observer=new ResizeObserver(measure);observer.observe(element);return()=>{observer.disconnect();clearTimeout(settle.current);};},[]);
 useEffect(()=>{const element=stage.current;if(!element)return;const measure=()=>setStageBounds({w:element.clientWidth,h:element.clientHeight});measure();const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();},[]);
 useEffect(()=>{if(shot||hidden)pointers.current.clear();},[shot,hidden]);
 useEffect(()=>{const frame=requestAnimationFrame(()=>{if(canvas.current)try{
  const source=previewSource.current ||= document.createElement('canvas'),quality=moving?'moving':'preview';
  editor.renderPhoto(source,original?photoLooks.natural:look,{aspect:photoCaptureAspect(format,aspect),quality});composePhoto(source,canvas.current,format,quality,lettering,aspect);
 }catch{setError('取景暂时失败，请调整镜头重试');}});return()=>cancelAnimationFrame(frame);},[editor,look,camera,revision,original,format,aspect,moving,letteringLibrary]);
 useEffect(()=>{if(!isPhotoPaper(format))return;let active=true;loadPhotoFont(lettering).then(()=>{if(active)refresh(n=>n+1);}).catch(()=>{if(active)setError('所选字体未能加载，请换一种字体重试');});return()=>{active=false;};},[format,letteringLibrary]);
 useEffect(()=>{const resize=()=>refresh(n=>n+1);window.addEventListener('resize',resize);const esc=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();handleBack();}};window.addEventListener('keydown',esc);return()=>{window.removeEventListener('resize',resize);window.removeEventListener('keydown',esc);};},[handleBack]);
 const pose=poses[actor]||{motion:'original',time:1,turn:0};
 const changePose=(v:Partial<typeof pose>)=>{const next={...pose,...v};setPoses(p=>({...p,[actor]:next}));editor.setPhotoTurn(actor,next.turn);refresh(n=>n+1);};
 const movingPreview=()=>{setMoving(true);clearTimeout(settle.current);settle.current=setTimeout(()=>setMoving(false),160);};
 const applyCamera=(next:typeof camera)=>{cameraRef.current=next;setCamera(next);editor.setPhotoCamera(next);};
 const cameraChange=(key:keyof typeof camera,value:number)=>{movingPreview();applyCamera({...cameraRef.current,[key]:value});};
 const bringTogether=()=>{if(actors.length>1){editor.setPhotoTogether(gap);setPoses({});refresh(n=>n+1);}};
 const compose=(pan:number)=>{applyCamera({...cameraRef.current,pan,zoom:pan===0?1:.78,pitch:2,height:1.25});};
 const chooseFormat=(value:PhotoFrame)=>{setFormat(value);if(value==='sticker'||value==='collage')applyCamera({...cameraRef.current,pan:0,zoom:1.65,pitch:2,height:1.75});else if(value==='tall'||format==='sticker'||format==='collage')applyCamera({...cameraRef.current,pan:0,zoom:1,pitch:4,height:1.2});};
 const moveCamera=(e:React.PointerEvent<HTMLCanvasElement>)=>{const old=pointers.current.get(e.pointerId);if(!old)return;const next={x:e.clientX,y:e.clientY},delta=photoDrag(next.x-old.x,next.y-old.y,rotated),others=[...pointers.current.entries()].filter(([id])=>id!==e.pointerId);let c={...cameraRef.current};if(others.length){const other=others[0][1],before=Math.hypot(old.x-other.x,old.y-other.y),after=Math.hypot(next.x-other.x,next.y-other.y);if(before>1)c.zoom=Math.max(.4,Math.min(3,c.zoom*after/before));}else if(dragMode==='pan'){c.pan=Math.max(-5,Math.min(5,c.pan-delta.dx*.012/c.zoom));c.height=Math.max(.2,Math.min(3,c.height+delta.dy*.008/c.zoom));}else{c.yaw=((c.yaw-delta.dx*.35+540)%360)-180;c.pitch=Math.max(-20,Math.min(55,c.pitch+delta.dy*.2));}pointers.current.set(e.pointerId,next);movingPreview();applyCamera(c);};
 const shoot=async()=>{
  const request=++shotRequest.current,captureFormat=format,captureFrameAspect=aspect,captureLook=original?photoLooks.natural:{...look},captureLettering={...lettering};
  setError('');setShooting(true);const output=document.createElement('canvas'),source=document.createElement('canvas');
  try{
   // 先同步定格场景，再等待字体，避免等待期间的操作混入这张照片。
   editor.renderPhoto(source,captureLook,{aspect:photoCaptureAspect(captureFormat,captureFrameAspect),quality:'export'});
   if(isPhotoPaper(captureFormat))await loadPhotoFont(captureLettering);
   if(!alive.current||request!==shotRequest.current){source.width=source.height=1;return;}
   composePhoto(source,output,captureFormat,'export',captureLettering,captureFrameAspect);source.width=source.height=1;
   output.toBlob(blob=>{output.width=output.height=1;if(!alive.current||request!==shotRequest.current)return;setShooting(false);if(!blob){setError('照片生成失败，请重试');return;}if(shotRef.current)URL.revokeObjectURL(shotRef.current);shotRef.current=URL.createObjectURL(blob);setShotFormat(captureFormat);setShotAspect(captureFrameAspect);setShot(shotRef.current);},'image/png');
  }catch{output.width=output.height=source.width=source.height=1;if(alive.current&&request===shotRequest.current){setShooting(false);setError('照片生成失败，请检查字体或调整镜头重试');}}
 };
 const selectTab=(next:PhotoTab)=>{setAdvanced(false);if(next!==tab){setTab(next);setPanelOpen(true);setCompactActions(false);}else setPanelOpen(open=>!open);};
 const toggleHidden=()=>{pointers.current.clear();setPanelOpen(false);setAdvanced(false);setHidden(value=>!value);};
 const slider=(label:string,value:number,min:number,max:number,step:number,onChange:(v:number)=>void,disabled=false)=><label className="photo-slider" data-disabled={disabled}><span>{label}</span><input aria-label={label} type="range" disabled={disabled} min={min} max={max} step={step} value={value} onChange={e=>{movingPreview();onChange(Number(e.target.value));}}/><output>{value.toFixed(step<1?2:0)}</output></label>;
 return <div ref={shell} className="photo-shell"><section className="home-photo-mode" data-sideways={rotated} data-wide={sidePanel} data-short={viewH<520} data-clean={hidden} aria-label="合影模式" style={{'--photo-height':`${viewH}px`,...(rotated?{width:bounds.h,height:bounds.w,left:'50%',top:'50%',right:'auto',bottom:'auto',transform:'translate(-50%, -50%) rotate(90deg)'}:{})} as React.CSSProperties}>
  <div ref={stage} className="photo-stage" aria-hidden={!!shot} style={format==='screen'?{inset:0}:undefined}>
   <div className="photo-frame" data-fullscreen={format==='screen'} style={frameStyle}>
    <canvas ref={canvas} className="photo-view" aria-label="照片取景画面" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});}} onPointerMove={moveCamera} onPointerUp={e=>pointers.current.delete(e.pointerId)} onPointerCancel={e=>pointers.current.delete(e.pointerId)} onLostPointerCapture={e=>pointers.current.delete(e.pointerId)} onWheel={e=>{cameraChange('zoom',Math.max(.4,Math.min(3,cameraRef.current.zoom*Math.exp(-e.deltaY*.001))));}}/>
    {dof.enabled&&focusMode==='free'&&focusDot&&!shot&&<div className="photo-focus-dot" role="slider" aria-label="对焦位置" style={{left:`${focusDot.x*100}%`,top:`${focusDot.y*100}%`}} onPointerDown={e=>{e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);focusDrag.current=true;applyFocus(e);}} onPointerMove={e=>{if(focusDrag.current)applyFocus(e);}} onPointerUp={()=>{focusDrag.current=false;}} onPointerCancel={()=>{focusDrag.current=false;}} onLostPointerCapture={()=>{focusDrag.current=false;}}/>}
    {grid&&photoWindows(format).map((r,i)=><div key={i} className="photo-thirds" style={{left:r.x*100+'%',top:r.y*100+'%',width:r.w*100+'%',height:r.h*100+'%'}} aria-hidden="true"/>)}
    <span className="photo-format-label">{photoFrames[format].label}</span>
   </div>
  </div>
  <header>
   <button className="photo-exit" aria-label="退出拍照" onClick={onClose}><X size={18}/><span>退出</span></button>
   <div className="photo-title"><small>HOME / PHOTO</small><strong>{shot?'这一刻，已收藏':'把此刻留下'}</strong></div>
   <div className="photo-header-actions">{!shot&&!hidden&&<button className="photo-original" aria-pressed={original} onClick={()=>{setOriginal(!original);refresh(n=>n+1);}}>{original?'原片已开':'暂看原片'}</button>}</div>
  </header>
  {shot&&<div className="photo-result" data-orientation={shotAspect>=1?'landscape':'portrait'}>
   <div className="photo-result-media"><img src={shot} alt="拍好的合影"/></div>
   <div className="photo-result-caption"><strong>{photoFrames[shotFormat].label}</strong><span>PNG · 保留原始比例</span></div>
   <div className="photo-result-actions">
    <button disabled={saving} onClick={clearShot}><ArrowCounterClockwise/>继续拍</button>
    <button className="photo-primary-action" disabled={saving} onClick={async()=>{setSaving(true);try{const blob=await (await fetch(shot)).blob();const result=await savePhotoToGallery({blob,fileName:'家园合影.png'});if(result==='gallery')addToast('已保存到系统相册','success');else if(result==='documents')addToast('已保存到 文档/SullyOS，可在文件管理器查看','success');}catch{setError('保存失败，请重试');}finally{if(alive.current)setSaving(false);}}}><DownloadSimple/>{saving?'保存中…':'保存照片'}</button>
    <button disabled={saving} onClick={()=>{void (async()=>{try{const blob=await (await fetch(shot)).blob();await shareOrDownloadBlob({blob,fileName:'家园合影.png',shareTitle:'家园合影',preferDownloadOnWeb:true});}catch{setError('分享失败，请重试');}})();}}><ShareNetwork/>分享</button>
   </div>
  </div>}
  {!shot&&hidden&&<button className="photo-restore" onClick={toggleHidden}><Eye size={17}/>显示控制</button>}
  <div className="photo-dock" hidden={!!shot||hidden} data-preview={tab==='动作'&&compactActions}>
   {panelOpen&&<div className="photo-controls">
    <div className="photo-panel-heading">
     {advanced&&tab==='镜头'?<button className="photo-panel-back" onClick={()=>setAdvanced(false)}><CaretLeft size={15}/>镜头设置</button>:<div><strong>{tab}</strong><small>{photoTabs.find(([id])=>id===tab)?.[2]}</small></div>}
     <button className="photo-panel-close" aria-label="收起调节" onClick={()=>{setPanelOpen(false);setAdvanced(false);setCompactActions(false);}}><CaretDown size={18}/></button>
    </div>
    {advanced&&tab==='镜头'?<div className="photo-settings">
     {slider('左右平移',camera.pan,-5,5,.05,v=>cameraChange('pan',v))}
     {slider('左右环绕',camera.yaw,-180,180,1,v=>cameraChange('yaw',v))}
     {slider('俯仰',camera.pitch,-20,55,1,v=>cameraChange('pitch',v))}
     {slider('镜头倾斜',camera.roll,-180,180,1,v=>cameraChange('roll',v))}
     {slider('取景高度',camera.height,.2,3,.05,v=>cameraChange('height',v))}
     <div className="photo-options"><button aria-pressed={dof.enabled} onClick={()=>changeDof({enabled:!dof.enabled})}>景深：{dof.enabled?'开':'关'}</button></div>
     {dof.enabled&&<>{slider('光圈',dof.aperture,.2,1,.05,v=>changeDof({aperture:v}))}{slider('虚化范围',dof.range,1,8,.5,v=>changeDof({range:v}))}{slider('虚化程度',dof.strength,.5,3,.1,v=>changeDof({strength:v}))}{slider('光斑',dof.bokeh,0,1,.05,v=>changeDof({bokeh:v}))}{actors.length>1&&<div className="photo-options" aria-label="对焦人物">{actors.map(a=><button key={a.id} aria-pressed={focusActor===a.id} onClick={()=>{setFocusActor(a.id);if(focusMode!=='free')editor.setPhotoFocusPart(a.id,focusMode);refresh(n=>n+1);}}>{a.label}</button>)}</div>}<div className="photo-options" aria-label="对焦部位">{([['head','对焦：脸'],['body','对焦：全身'],['free','自由拖动']] as const).map(([mode,label])=><button key={mode} aria-pressed={focusMode===mode} onClick={()=>applyFocusMode(mode)}>{label}</button>)}</div><p>{focusMode==='free'?'拖动取景画面上的圆点，选择要对焦的位置。':'焦点钉在对焦选中的人身上，怎么转镜头都不会丢。'}</p></>}
    </div>:<div className="photo-settings">
     {tab==='镜头'&&<>
      <span className="photo-section-label">画幅与相纸</span>
      <div className="photo-options photo-formats" aria-label="照片构图">{Object.entries(photoFrames).map(([id,f])=><button key={id} aria-pressed={format===id} onClick={()=>chooseFormat(id as PhotoFrame)}>{f.label}</button>)}</div>
      {isPhotoPaper(format)&&<PhotoLetteringControls value={lettering} onChange={changeLettering} onReset={()=>changeLettering(defaultPhotoLettering(format))}/>}
      {(format==='sticker'||format==='collage')&&actors.length>1&&<button className="photo-standing-reset" onClick={bringTogether}><span><strong>双人并排站位</strong><small>会重置当前动作</small></span><span aria-hidden="true">›</span></button>}
      <span className="photo-section-label">快速构图</span>
      <div className="photo-options" aria-label="留白构图"><button onClick={()=>compose(0)}>居中同框</button><button onClick={()=>compose(-2)}>左侧留白</button><button onClick={()=>compose(2)}>右侧留白</button><button aria-pressed={grid} onClick={()=>setGrid(!grid)}>三分线</button></div>
      {slider('拉近',camera.zoom,.4,3,.05,v=>cameraChange('zoom',v))}
      <button className="photo-advanced-entry" onClick={()=>setAdvanced(true)}><span><strong>精细调整</strong><small>环绕、俯仰、倾斜、高度与景深</small></span><span aria-hidden="true">›</span></button>
     </>}
     {tab==='人物'&&<>
      <div className="photo-options"><button disabled={actors.length<2} onClick={bringTogether}>并排站位（重置动作）</button>{actors.map(a=><button key={a.id} aria-pressed={actor===a.id} onClick={()=>setActor(a.id)}>{a.label}</button>)}</div>
      <p className="photo-hint">{actors.length<2?'同房的两个人都在场时，可以并排站位。':'并排站位与站距调整会回到默认站姿；切换画幅不会改变当前动作。'}</p>
      {slider('两人站距',gap,.55,2,.05,v=>{setGap(v);editor.setPhotoTogether(v);setPoses({});refresh(n=>n+1);},actors.length<2)}
      {slider('人物转向',pose.turn,-180,180,1,v=>changePose({turn:v}))}
      <div className="photo-options" aria-label="拍照表情">{Object.entries(expressions).map(([key,label])=><button key={key} aria-pressed={(face.expression||'original')===key} onClick={()=>changeFace({expression:key as NonNullable<PhotoFace['expression']>})}>{label}</button>)}</div>
      <div className="photo-options"><button aria-pressed={face.lookCamera===true} onClick={()=>changeFace({lookCamera:!face.lookCamera})}>看镜头：{face.lookCamera?'开':'关'}</button></div>
     </>}
    <div hidden={tab!=='动作'}><PhotoActions editor={editor} actors={actors} refresh={()=>refresh(n=>n+1)} compact={compactActions} onPreview={()=>setCompactActions(true)} onExpand={()=>setCompactActions(false)}/></div>
     {tab==='氛围'&&<>
      <span className="photo-section-label">光线</span>
      <div className="photo-options photo-times" aria-label="拍照时段">{photoTimes.map(([id,label])=><button key={id} aria-pressed={activePhotoTime()===id} onClick={()=>{setPhotoTime(id);editor.setPhotoLighting(id);refresh(n=>n+1);}}>{label}</button>)}</div>
      <div className="photo-options photo-lamp-colors" aria-label="灯光色调"><button aria-pressed={lampChoice===''} onClick={()=>{setLampChoice('');editor.setPhotoLampColor('');refresh(n=>n+1);}}>灯光跟随房间</button>{lampColors.map(([value,label])=><button key={value} aria-pressed={lampChoice===value} onClick={()=>{setLampChoice(value);editor.setPhotoLampColor(value);refresh(n=>n+1);}}><i style={{display:'inline-block',width:'10px',height:'10px',borderRadius:'50%',background:value,marginRight:'6px',verticalAlign:'middle'}}/>{label}</button>)}</div>
      <p className="photo-hint">灯池只在天黑后点亮；选了颜色则无视时段点亮，退出拍照即还原。</p>
      <span className="photo-section-label">色调预设</span>
      <div className="photo-options photo-presets">{Object.entries(names).map(([key,label])=><button key={key} aria-pressed={look.preset===key} onClick={()=>applyLook({...photoLooks[key as PhotoLook['preset']]})}>{label}</button>)}</div>
      <details className="photo-tone-controls"><summary>滤镜微调<span>光晕、色差、暗角与曝光</span></summary><div>{slider('光晕',look.glow,0,3,.05,v=>applyLook({...look,glow:v}))}{slider('色差',look.fringe,0,1,.05,v=>applyLook({...look,fringe:v}))}{slider('暗角',look.vignette,0,1,.05,v=>applyLook({...look,vignette:v}))}{slider('曝光',look.exposure,.5,1.6,.05,v=>applyLook({...look,exposure:v}))}</div></details>
      <PhotoLookLibrary look={look} onApply={applyLook}/>
     </>}
    </div>}
   </div>}
   <nav className="photo-tabbar" aria-label="拍照功能">{photoTabs.map(([id,Icon,description])=><button key={id} aria-pressed={tab===id&&panelOpen} aria-label={`${id}：${description}`} onClick={()=>selectTab(id)}><Icon size={19}/><span>{id}</span></button>)}</nav>
  </div>
  <footer hidden={!!shot||hidden}>
   <div className="photo-drag-switch" role="group" aria-label="拖动模式"><button aria-pressed={dragMode==='orbit'} onClick={()=>setDragMode('orbit')}>旋转</button><button aria-pressed={dragMode==='pan'} onClick={()=>setDragMode('pan')}>平移</button></div>
   <button className="photo-shutter" disabled={shooting} aria-busy={shooting} aria-label="拍下合影" onClick={shoot}>{shooting?<span className="photo-shutter-spinner"/>:<Camera size={27}/>}</button>
   <div className="photo-footer-actions">{bounds.h>bounds.w&&<button className="photo-orientation" aria-pressed={rotated} onClick={()=>{pointers.current.clear();setSideways(!sideways);}}>{rotated?'竖屏':'横屏'}</button>}<button className="photo-clean" onClick={toggleHidden}><Eye size={16}/><span>纯净</span></button></div>
  </footer>
  {error&&<p role="alert" className="photo-error"><span>{error}</span><button aria-label="关闭错误提示" onClick={()=>setError('')}>×</button></p>}
 </section></div>;
}
