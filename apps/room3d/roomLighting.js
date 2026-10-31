import * as T from 'three';
import {nowInTimeZone} from '../../utils/timezone';

// Art-directed time bands, not astronomical sunrise/sunset. Preserve readable
// local colours in every phase; use the sky and light colour for atmosphere.
export const ROOM_LIGHT_PHASES={
 morning:{directSun:true,sunPower:4.8,label:'清晨',sky:'#e6f0ff',ground:'#e4d6e2',ambient:1.3,key:'#ffedd2',keyPower:1.85,fill:'#dcecff',fillPower:.5,window:'#ffd9a0',windowPower:.95,background:'#ece7f2',shade:'#e9ecfd',sun:'#fff3e2',brightness:1,skyTop:'#8ec6ee',skyBottom:'#ffd2a8',cloud:'#fff7ef',night:0,character:'#fff8f0'},
 day:{label:'白天',sky:'#f4faff',ground:'#e6dfed',ambient:1.85,key:'#fff9eb',keyPower:2.4,fill:'#e7f4ff',fillPower:.65,window:'#fff0ce',windowPower:1,background:'#eee8ef',shade:'#edf3ff',sun:'#fffaf0',brightness:1.04,skyTop:'#5cb8f4',skyBottom:'#e8f4fc',cloud:'#ffffff',night:0,character:'#ffffff'},
 sunset:{directSun:true,sunPower:6.2,sunContrast:.6,shadeSoftness:.7,label:'夕阳',sky:'#e9d9f6',ground:'#d0b6c6',ambient:1.05,key:'#ffd9ae',keyPower:1.8,fill:'#d4dcff',fillPower:.6,window:'#ff9a4d',windowPower:1.55,background:'#f0dee4',shade:'#e0ccf8',sun:'#ffd8a4',brightness:.98,skyTop:'#a87fd0',skyBottom:'#ffb260',cloud:'#ffdec2',night:0,character:'#ffeeda'},
 night:{label:'夜晚',sky:'#96a8f2',ground:'#a08fc8',ambient:1.32,key:'#ffe3c0',keyPower:1.6,fill:'#a5c0ff',fillPower:.5,window:'#b9d3ff',windowPower:.22,background:'#a8a8cc',shade:'#b0bef2',sun:'#ffe4c0',brightness:.8,skyTop:'#141f3d',skyBottom:'#4d587e',cloud:'#7f92b4',night:1,character:'#eae6ff'},
};
export function roomLightPhase(timeZone,base=new Date()){
 const hour=nowInTimeZone(timeZone,base).getHours();
 return hour>=5&&hour<8?'morning':hour>=8&&hour<16?'day':hour>=16&&hour<19?'sunset':'night';
}
export function resolveRoomLightPhase(mode,timeZone,base){
 return Object.hasOwn(ROOM_LIGHT_PHASES,mode)?mode:roomLightPhase(timeZone,base);
}
// 两档时段连续插值（换时段时 20 秒渐变过渡而非整点跳变）：
// 颜色 lerp、数值 lerp；label 等非插值字段直接取目标档。
const blendA=new T.Color(),blendB=new T.Color();
export function blendRoomPhase(a,b,t){
 const out={};
 for(const key of Object.keys(b)){
  const av=a[key],bv=b[key];
  if(typeof bv==='number')out[key]=av+(bv-av)*t;
  else if(typeof bv==='string'&&key!=='label')out[key]='#'+blendA.set(av).lerp(blendB.set(bv),t).getHexString();
  else out[key]=bv;
 }
 return out;
}
// These uniform objects are shared by this editor's materials. Changing time
// updates values only: no rebuild, shader compilation or new render pass.
export function createRoomLightUniforms(){
 return {skySunset:{value:0},roomSunContrast:{value:0},roomShadeSoftness:{value:0},roomShadeTint:{value:new T.Color()},roomSunTint:{value:new T.Color()},roomBrightness:{value:1},roomBounceUp:{value:new T.Color()},roomBounceDown:{value:new T.Color()},skyTop:{value:new T.Color()},skyBottom:{value:new T.Color()},skyCloud:{value:new T.Color()},skyNight:{value:0}};
}
export function updateRoomLightUniforms(uniforms,profile){
 // 漫反射色直接跟随该时段的天空/地面环境光：朝上面吃天空反弹，朝下面吃地面反弹。
 for(const [key,field]of [['roomShadeTint','shade'],['roomSunTint','sun'],['skyTop','skyTop'],['skyBottom','skyBottom'],['skyCloud','cloud'],['roomBounceUp','sky'],['roomBounceDown','ground']])uniforms[key].value.set(profile[field]);
 uniforms.roomBrightness.value=profile.brightness;uniforms.skyNight.value=profile.night;
 uniforms.roomSunContrast.value=profile.directSun?(profile.sunContrast??1):0;
 uniforms.roomShadeSoftness.value=profile.shadeSoftness??0;
 uniforms.skySunset.value=profile===ROOM_LIGHT_PHASES.sunset?1:0;
}
