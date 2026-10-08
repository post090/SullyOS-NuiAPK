import {isDevDebugAvailable} from './devDebug';
import type {CompanionSnapshot} from './homeCompanion';
export interface HomeCompanionDebug {
 name:string;active:boolean;updatedAt:number;nextAt:number;status:string;snapshot?:CompanionSnapshot;
 checks:number;attempts:number;started:number;failed:number;reasons:Record<string,number>;
 recent:Array<{at:number;action:string;result:string}>;
}
let current:HomeCompanionDebug|undefined;
export function publishHomeCompanionDebug(value:HomeCompanionDebug){if(isDevDebugAvailable())current={...value,reasons:{...value.reasons},recent:[...value.recent]};}
export function readHomeCompanionDebug(){return isDevDebugAvailable()?current:undefined;}
export function companionWaitReason(s:CompanionSnapshot,nextAt:number,now:number){
 if(!s.ready)return s.blockers?.join('、')||'角色暂时不可用';
 if(now<nextAt)return '等待下次自主决策';
 if(!s.canIdle&&!s.canMove)return s.blockers?.join('、')||'当前姿势或手动操作暂不允许活动';
 return '本轮没有选中动作（概率或条件未满足）';
}
