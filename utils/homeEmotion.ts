import type {CharacterBuff,CharacterProfile} from '../types';
import type {CompanionPolicy} from './homeCompanion';
import {isScheduleFeatureOn} from './scheduleFeature';
export interface HomeEmotion {energy:number;approach:number;interaction:number}
export interface TimedHomeEmotion {value:HomeEmotion;at:number}
export const neutralHomeEmotion:HomeEmotion={energy:0,approach:0,interaction:0};
export function parseHomeEmotion(value:unknown):HomeEmotion|undefined {
 if(!value||typeof value!=='object')return;
 const data=value as Record<string,unknown>,out={...neutralHomeEmotion};
 for(const key of Object.keys(out) as (keyof HomeEmotion)[]){const n=data[key];if(typeof n!=='number'||!Number.isFinite(n))return;out[key]=Math.max(-1,Math.min(1,n));}
 return out;
}
export function homeEmotionEnabled(char:CharacterProfile){return isScheduleFeatureOn(char)&&char.emotionConfig?.enabled===true;}
export function emotionMaterial(char:CharacterProfile){return JSON.stringify({buffs:(char.activeBuffs||[]).map(b=>({name:b.name,label:b.label,description:b.description,intensity:b.intensity})),text:char.buffInjection||''});}
export function structuredHomeEmotion(buffs:CharacterBuff[]):TimedHomeEmotion|undefined {
 if(!buffs.length)return;
 const rows=buffs.map(b=>({value:parseHomeEmotion(b.homeBehavior),at:b.homeBehaviorAt,weight:b.intensity}));
 if(rows.some(r=>!r.value||!Number.isFinite(r.at)))return;
 const value={...neutralHomeEmotion},total=rows.reduce((s,r)=>s+r.weight,0);
 if(total<=0)return;
 for(const key of Object.keys(value) as (keyof HomeEmotion)[])value[key]=rows.reduce((s,r)=>s+r.value![key]*r.weight,0)/total;
 return {value,at:Math.min(...rows.map(r=>r.at!))};
}
/** Only the motion bias eases over 30 minutes; never rewrites the character's mood. */
export function emotionCompanionPolicy(base:CompanionPolicy,state:TimedHomeEmotion|undefined,now:number):CompanionPolicy {
 if(!state)return base;
 const fade=Math.max(0,Math.min(1,1-Math.max(0,now-state.at)/1800000));
 const {energy,approach,interaction}=state.value,clamp=(n:number)=>Math.max(0,Math.min(1,n));
 return {approach:clamp(base.approach+approach*.3*fade),follow:clamp(base.follow*(1+approach*.7*fade)),sit:clamp(base.sit-energy*.3*fade),warmth:clamp(base.warmth+Math.min(0,interaction)*.5*fade)};
}
export function emotionCooldown(state:TimedHomeEmotion|undefined,now:number){
 if(!state)return 45000;
 const fade=Math.max(0,Math.min(1,1-Math.max(0,now-state.at)/1800000));
 return 45000*(1+-state.value.interaction*.3*fade+Math.max(0,-state.value.energy)*.5*fade);
}
