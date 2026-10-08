import * as T from 'three';
import type {bindBlankBody} from '../../apps/room3d/chibi/blankRig';
import {BLANK_FINGERS} from '../../apps/room3d/chibi/blankFingers';

type Rotations=Record<string,[number,number,number]>;
export function createPoseEditor(host:HTMLElement,rig:ReturnType<typeof bindBlankBody>,onChange:()=>void){
 const key='tiny-t-pose-editor-v1';
 let rotations:Rotations={};
 const status=document.createElement('p');status.setAttribute('role','status');
 const names:Record<string,string>={root:'整体',hips:'胯部',spine:'腰部',chest:'胸部',neck:'脖子',head:'头部',clavicle:'锁骨 / 肩膀',upperArm:'上臂',forearm:'前臂',hand:'手腕',thigh:'大腿',shin:'小腿 / 膝盖',foot:'脚踝',toe:'脚趾'};
 for(const finger of BLANK_FINGERS){names[finger.name]=`${finger.label} · 指根`;names[`${finger.name}_tip`]=`${finger.label} · 指节`;}
 const select=document.createElement('select');select.setAttribute('aria-label','选择骨骼');
 for(const name of Object.keys(rig.bones)){const option=document.createElement('option');option.value=name;option.textContent=name.includes('_')?`${name[0]==='L'?'左':'右'}${names[name.slice(2)]}`:names[name];select.append(option);}
 select.value='L_upperArm';host.append(select);
 const inputs:Array<[HTMLInputElement,HTMLInputElement]>=[];
 const current=()=>rotations[select.value]??rig.bones[select.value].rotation.toArray().slice(0,3).map(v=>T.MathUtils.radToDeg(v as number)) as [number,number,number];
 const refresh=()=>{const values=current();inputs.forEach(([slider,number],i)=>{slider.value=number.value=String(Math.round(values[i]*10)/10);});};
 const persist=()=>{try{localStorage.setItem(key,JSON.stringify({version:1,model:'tiny-t-pose',rotations}));status.textContent='动作草稿已保存在本机';}catch{status.textContent='本机保存失败，请导出动作';}};
 const update=()=>{onChange();refresh();persist();};
 for(const [i,axis] of ['X','Y','Z'].entries()){
  const label=document.createElement('label');label.textContent=axis;
  const slider=document.createElement('input'),number=document.createElement('input');slider.type='range';number.type='number';
  for(const input of [slider,number]){input.min='-180';input.max='180';input.step='0.5';input.setAttribute('aria-label',`骨骼${axis}${input===number?'角度':'旋转'}`);}
  const change=(value:number)=>{if(!Number.isFinite(value))return;const v=[...current()] as [number,number,number];v[i]=T.MathUtils.clamp(value,-180,180);rotations[select.value]=v;update();};
  slider.oninput=()=>change(slider.valueAsNumber);number.oninput=()=>change(number.valueAsNumber);
  inputs.push([slider,number]);label.append(slider,number);host.append(label);
 }
 let selectionListener=(name:string)=>{};
 select.onchange=()=>{refresh();selectionListener(select.value);};
 const button=(text:string,action:()=>void)=>{const b=document.createElement('button');b.textContent=text;b.onclick=action;host.append(b);};
 button('当前骨骼归零',()=>{rotations[select.value]=[0,0,0];update();});
 button('全部回到 T 姿势',()=>{rotations=Object.fromEntries(Object.keys(rig.bones).map(name=>[name,[0,0,0]]));update();});
 const snapshot=()=>Object.fromEntries(Object.entries(rig.bones).map(([name,bone])=>[name,bone.rotation.toArray().slice(0,3).map(v=>T.MathUtils.radToDeg(v as number))])) as Rotations;
 for(const [label,curl] of [['双手张开',0],['双手轻握',.35],['双手握拳',1]] as const)button(label,()=>{
  rig.setHandCurl('L',curl);rig.setHandCurl('R',curl);rotations=snapshot();update();
 });
 const validate=(data:any):Rotations=>{
  if(data?.version!==1||data.model!=='tiny-t-pose'||!data.rotations||typeof data.rotations!=='object')throw Error('不是当前素体的动作文件');
  const clean:Rotations={};
  for(const [name,value] of Object.entries(data.rotations)){
   if(!Object.hasOwn(rig.bones,name)||!Array.isArray(value)||value.length!==3||!value.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=180))throw Error('骨骼名称或角度无效');
   clean[name]=value as [number,number,number];
  }return clean;
 };
 button('导出动作',()=>{
  const data={version:1,model:'tiny-t-pose',rotations:snapshot()};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='tiny-figure-pose.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 const file=document.createElement('input');file.type='file';file.accept='.json,application/json';file.hidden=true;
 file.onchange=async()=>{try{if(!file.files?.[0])return;const clean=validate(JSON.parse(await file.files[0].text()));rotations=clean;update();}catch(error){status.textContent=`导入失败：${(error as Error).message}`;}finally{file.value='';}};
 button('导入动作',()=>file.click());host.append(file,status);
 try{const saved=localStorage.getItem(key);if(saved)rotations=validate(JSON.parse(saved));}catch{status.textContent='旧动作草稿不可用，已使用当前姿势';}
 refresh();
 return {
  selectBone(name:string){if(!Object.hasOwn(rig.bones,name))return;select.value=name;refresh();selectionListener(name);},
  onSelection(listener:(name:string)=>void){selectionListener=listener;},
  setRotation(name:string,rotation:T.Euler){rotations[name]=[rotation.x,rotation.y,rotation.z].map(v=>T.MathUtils.radToDeg(Math.atan2(Math.sin(v),Math.cos(v)))) as [number,number,number];update();},
  apply(target:typeof rig){for(const [name,v] of Object.entries(rotations))target.bones[name].rotation.set(...v.map(T.MathUtils.degToRad) as [number,number,number]);target.mesh.updateWorldMatrix(true,true);target.skeleton.update();},
  usePreset(){rotations=snapshot();refresh();persist();},
  snapshot,
 };
}
