import {expect,it} from 'vitest';
import {assignHomeContextSegments} from './homeContextSegments';
import {homeSegmentMessages as homeTurnMessages,expandHomeContextHistory} from './homeContextSegments';
import type {HomeRecord} from '../apps/room3d/types';
import type {Message} from '../types';
const event=(id:string,at:number,kind:HomeRecord['kind']='action',actor:HomeRecord['actor']='character'):HomeRecord=>({id,at,kind,actor,source:actor==='user'?'user':'local',text:id,roomId:'r',roomName:'客厅'});
const row=(records:HomeRecord[],id=10)=>({...homeTurnMessages('c',records)[0],id}) as Message;

it('groups short actions but preserves every speech, including spontaneous character speech',()=>{
 const events=[event('a1',1),event('a2',2),event('a3',3),event('u',4,'message','user'),event('c',5,'message'),event('a4',6),event('a5',7,'action','user'),event('initiative',8,'message'),event('u2',9,'message','user')];
 const assigned=assignHomeContextSegments([],events,undefined,0);
 const rows=homeTurnMessages('c',assigned);
 expect(rows.map(r=>r.metadata.homeRecordIds)).toEqual([['a1','a2','a3'],['u'],['c'],['a4','a5'],['initiative'],['u2']]);
 expect(rows.map(r=>r.role)).toEqual(['user','user','assistant','user','assistant','user']);
});
it('extends only the unarchived last action segment, retaining its ID across stale snapshots',()=>{
 const first=assignHomeContextSegments([],[event('a',1)],undefined,0),last=row(first);
 const next=assignHomeContextSegments(first,[event('a',1),event('b',2)],last,0);
 expect(next.map(r=>r.contextSegmentId)).toEqual(['a','a']);
});
it.each(['archive','chat','legacy','speech','initiative'])('seals actions at a %s boundary',boundary=>{
 const first=assignHomeContextSegments([],[event('a',1)],undefined,0);
 let last=row(first),hwm=0,events=[event('a',1),event('b',3)];
 if(boundary==='archive')hwm=last.id;
 if(boundary==='chat')last={...last,metadata:{source:'chat'}};
 if(boundary==='legacy')last.metadata.homeLegacy=true;
 if(boundary==='speech')events.splice(1,0,event('u',2,'message','user'));
 if(boundary==='initiative')events.splice(1,0,{...event('prompt',2,'presence'),initiative:true});
 expect(assignHomeContextSegments(first,events,last,hwm).at(-1)?.contextSegmentId).toBe('b');
});
it('keeps old turn IDs while expanding roles/times around another app message',()=>{
 const events=[event('u',1,'message','user'),event('a',3,'message')];
 const legacy:Message={id:10,charId:'c',role:'user',type:'text',timestamp:1,content:'old',metadata:{source:'home',homeTurnId:'old-turn',homeRecordIds:['u','a']}};
 const assigned=assignHomeContextSegments([],events,legacy,10,[legacy]);
 expect(assigned.map(r=>r.contextSegmentId)).toEqual(['old-turn','old-turn']);
 const projected={...row(assigned),id:legacy.id};
 const other:Message={...legacy,id:11,timestamp:2,content:'CHAT',metadata:{source:'chat'}};
 const expanded=expandHomeContextHistory([projected,other]);
 expect(expanded.map(r=>r.timestamp)).toEqual([1,2,3]);
 expect(expanded.map(r=>r.role)).toEqual(['user','user','assistant']);
 expect(expanded.map(r=>r.id)).toEqual([10,11,10]);
});
it('new replies and actions never join their old logical turn',()=>{
 const first=assignHomeContextSegments([],[event('u',1,'message','user')],undefined,0);
 const next=assignHomeContextSegments(first,[...first,{...event('r',2,'message'),replyTo:'u',turnId:'u'},{...event('a',3),replyTo:'u',turnId:'u'}],row(first),10);
 expect(next.map(r=>r.contextSegmentId)).toEqual(['u','r','a']);
});
it('splits a backfilled action span around an interleaved chat message',()=>{
 const assigned=assignHomeContextSegments([],[event('a1',1),event('a2',3)],undefined,0);
 const other:Message={id:2,charId:'c',role:'assistant',type:'text',timestamp:2,content:'CHAT',metadata:{}};
 expect(expandHomeContextHistory([row(assigned),other]).map(m=>m.timestamp)).toEqual([1,2,3]);
});
