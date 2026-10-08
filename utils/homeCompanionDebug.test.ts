import {it,expect,vi} from 'vitest';
vi.mock('./devDebug',()=>({isDevDebugAvailable:()=>true}));
import {companionWaitReason,publishHomeCompanionDebug,readHomeCompanionDebug} from './homeCompanionDebug';
const s={ready:true,canMove:true,canIdle:true,distance:1,canSit:false,userMoved:false};
it('explains busy state before cooldown and distinguishes probability from blocking',()=>{
 expect(companionWaitReason({...s,ready:false,blockers:['正在交谈']},5000,0)).toBe('正在交谈');
 expect(companionWaitReason(s,5000,0)).toBe('等待下次自主决策');
 expect(companionWaitReason(s,0,100)).toContain('没有选中动作');
});
it('copies bounded session records so later mutation cannot silently rewrite the displayed report',()=>{
 const d={name:'Test',active:true,updatedAt:1,nextAt:3,status:'等待',checks:1,attempts:0,started:0,failed:0,reasons:{等待:1},recent:[]};
 publishHomeCompanionDebug(d);d.reasons.等待=9;
 expect(readHomeCompanionDebug()?.reasons.等待).toBe(1);
});
