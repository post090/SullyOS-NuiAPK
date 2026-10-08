import {isRoutineHomeWalk} from './homeTurns';
import type {HomeRecord} from '../apps/room3d/types';
export const INITIATIVE_ACTIONS=3,INITIATIVE_DELAY=90000,INITIATIVE_COOLDOWN=180000;
export function homeInitiative(records:HomeRecord[],roomId:string,now:number,enteredAt:number,lastOfferAt:number){
 let boundary=-1;for(let i=records.length-1;i>=0;i--)if(records[i].kind==='message'&&records[i].source==='model'||records[i].initiative){boundary=i;break;}
 const recent=records.slice(boundary+1).filter(r=>r.kind==='action'&&r.source==='local'&&r.actor==='character'&&r.roomId===roomId&&!isRoutineHomeWalk(r)&&!r.text.startsWith('宠物'));
 if(recent.length<INITIATIVE_ACTIONS||now-(records[boundary]?.at??enteredAt)<INITIATIVE_DELAY||lastOfferAt>0&&now-lastOfferAt<INITIATIVE_COOLDOWN)return null;
 return {key:recent.at(-1)!.id,reason:recent.slice(-3).map(r=>r.text).join('；')};
}

