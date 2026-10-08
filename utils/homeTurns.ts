import type {HomeRecord} from '../apps/room3d/types';
import type {Message} from '../types';

export function isRoutineHomeWalk(record:HomeRecord){return record.kind==='action'&&/(?:在房间里走动|走了几步)[。！]?$/u.test(record.text);}

/** Preserve assigned boundaries even when individual events are edited or deleted. */
export function assignHomeTurns(records:HomeRecord[]):HomeRecord[]{
 const byRecord=new Map<string,string>(),sealed=new Set<string>();
 let current:string|undefined;
 return records.map(record=>{
  const linked=record.replyTo?byRecord.get(record.replyTo):undefined;
  let turn=record.turnId||linked;
  if(!turn){
   if(!current||((record.source==='user'||record.source==='local')&&sealed.has(current)))current=record.id;
   turn=current;
  }
  if(!current||!linked)current=turn;
  byRecord.set(record.id,turn);
  if(record.kind==='message'||record.initiative)sealed.add(turn);
  return record.turnId===turn?record:{...record,turnId:turn};
 });
}

/** Legacy v2 projection retained for compatibility. New persistence and requests
 * use homeContextSegments so replies never extend these whole-turn messages. */
export function homeTurnMessages(charId:string,records:HomeRecord[]):Omit<Message,'id'>[]{
 const groups=new Map<string,HomeRecord[]>();
 for(const record of assignHomeTurns(records)){
  if(isRoutineHomeWalk(record))continue;
  const turn=record.turnId!;const group=groups.get(turn)||[];group.push(record);groups.set(turn,group);
 }
 return [...groups].map(([turnId,events])=>({
  charId,role:'user',type:'text',timestamp:events[0].at,
  content:'家园回合（按发生顺序记录双方对话与实际行为；动作开始不代表完成）：\n'+events.map(e=>
   '['+e.roomName+'] '+(e.kind==='message'?(e.actor==='user'?'用户说：':'角色说：'):('实际行为（'+({user:'用户操作',local:'本地自主',model:'模型执行'}[e.source])+'）：'))+e.text).join('\n'),
  metadata:{source:'home',homeTurnId:turnId,homeRecordIds:events.map(e=>e.id),homeTurnEndAt:events.at(-1)!.at},
 }));
}
