/** Low-frequency decisions only; animation and pathfinding stay in the editor. */
export interface CompanionPolicy {approach:number;follow:number;sit:number;warmth:number}
export const quietCompanion:CompanionPolicy={approach:.15,follow:0,sit:.25,warmth:.3};
export function parseCompanionPolicy(text:string):CompanionPolicy {
 const data=JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g,''));
 const result={...quietCompanion};
 for(const key of Object.keys(result) as (keyof CompanionPolicy)[]) {
  if(typeof data[key]!=='number'||!Number.isFinite(data[key]))throw Error('Invalid companion policy');
  result[key]=Math.max(0,Math.min(1,data[key]));
 }
 return result;
}
export interface CompanionSnapshot {speechReady?:boolean;ready:boolean;canMove:boolean;distance:number;userMoved:boolean;canSit:boolean;canIdle?:boolean;canRise?:boolean;canUseFurniture?:boolean;canInteractPet?:boolean;blockers?:string[];posture?:string;userFurniture?:boolean;manualRemaining?:number;lastResult?:string;reactionId?:string}
export type CompanionAction='look'|'react'|'approach'|'follow'|'sit'|'idle'|'wander'|'phone'|'furniture'|'stand'|'pet';
export interface CompanionMemory {nextAt:number;reactionId?:string;reactionAt?:number;lastAction?:CompanionAction}
export function chooseCompanionAction(s:CompanionSnapshot,p:CompanionPolicy,m:CompanionMemory,now:number,random:number):CompanionAction|null {
 if(!s.ready)return null;
 if(s.reactionId&&s.reactionId!==m.reactionId&&now-(m.reactionAt??-Infinity)>=3000)return 'react';
 if(now<m.nextAt)return null;
 if(!s.canMove){if(s.canRise)return 'stand';return s.canIdle&&m.lastAction!=='phone'?'phone':null;}
 if(s.canInteractPet&&m.lastAction!=='pet'&&random<.35)return 'pet';
 if(s.canSit&&s.distance<3.5&&random<p.sit*.6)return 'sit';
 if(s.distance>2.4&&s.userMoved&&random<p.follow*.65)return 'follow';
 if(s.distance>2.4&&random<p.approach*.5)return 'approach';
 if(s.canUseFurniture&&m.lastAction!=='furniture'&&random<.55)return 'furniture';
 if(s.canIdle)return m.lastAction!=='phone'&&random>.55?'phone':'wander';
 return null;
}
/** Soft page size; preserve sentence endings, using clauses only for oversized sentences. */
export function speechPages(text:string,size=54):string[]{
 const sentences=text.trim().match(/[^。！？!?\n]+[。！？!?]+[”’」』）)]*|[^。！？!?\n]+(?:\n|$)/gu)||[];
 const pages:string[]=[];let page='';
 const push=(part:string)=>{if(page&&Array.from(page+part).length>size){pages.push(page.trim());page='';}page+=part;};
 for(const sentence of sentences){
  if(Array.from(sentence).length<=size*2){push(sentence);continue;}
  for(const clause of sentence.match(/[^，,；;]+[，,；;]?/gu)||[sentence]){
   const chars=Array.from(clause);if(chars.length<=size*2)push(clause);else for(let i=0;i<chars.length;i+=size*2)push(chars.slice(i,i+size*2).join(''));
  }
 }
 if(page.trim())pages.push(page.trim());return pages;
}
export const speechPageDuration=(text:string)=>Math.max(6500,Math.min(18000,Array.from(text).length*160));
