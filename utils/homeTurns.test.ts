import {expect,it} from 'vitest';
import {assignHomeTurns,homeTurnMessages} from './homeTurns';
import {DB,openDB} from './db';
import {loadCharacterContextMessages} from './chatContextRange';
import {buildHomeConversationPayload} from './homeConversation';
import type {HomeRecord,HomeScene} from '../apps/room3d/types';
import type {CharacterProfile,UserProfile,APIConfig} from '../types';
const event=(id:string,text:string,actor:HomeRecord['actor']='user',kind:HomeRecord['kind']='action',replyTo?:string):HomeRecord=>({id,text,actor,kind,source:actor==='user'?'user':'model',roomId:'r',roomName:'客厅',at:1000+Number(id.replace(/\D/g,'')),replyTo});
const example=[event('e1','U摸了C'),event('e2','U坐下了'),event('e3','U看了看镜子'),event('e4','你在干嘛呢','user','message'),event('e5','我在睡觉','character','message','e4'),event('e6','C走到U身边','character','action','e4')];
let sequence=0;const character=()=>({id:'home-turns-'+(++sequence),name:'C',contextRangePolicyVersion:1,contextRangeMode:'manual',contextLimit:50,home3D:{records:example}} as CharacterProfile);
const scene={roomId:'r',roomName:'客厅',present:true,busy:false,activity:'站着',actions:[]} as HomeScene;
const user={name:'U'} as UserProfile,api={baseUrl:'test',model:'test'} as APIConfig;
it('the full example occupies one row, next user action opens the second',()=>{
 const records=assignHomeTurns([...example,event('e7','U去拿水')]);const rows=homeTurnMessages('c',records);
 expect(rows).toHaveLength(2);for(const e of example)expect(rows[0].content).toContain(e.text);
 expect(rows[1].content).toContain('U去拿水');expect(rows[0].metadata.homeRecordIds).toHaveLength(6);
 expect(homeTurnMessages('c',records.filter(e=>e.id!=='e1'))[0].metadata.homeTurnId).toBe('e1');
});
it('a late model reply/action stays in its original turn after the user starts another',()=>{
 const records=[...example.slice(0,4),event('e7','U去拿水'),...example.slice(4)];
 const rows=homeTurnMessages('c',records);expect(rows).toHaveLength(2);
 expect(rows[0].content).toContain('我在睡觉');expect(rows[0].content).toContain('C走到U身边');expect(rows[1].metadata.homeRecordIds).toEqual(['e7']);
});
it('stored replies and action segments get new IDs while earlier messages retain theirs',async()=>{
 const char=character();char.home3D!.records=example.slice(0,4);await DB.saveCharacter(char);const before=await loadCharacterContextMessages(char);
 char.home3D!.records=example;await DB.saveCharacter(char);const after=await loadCharacterContextMessages(char);
 expect(after).toHaveLength(4);expect(after.slice(0,2).map(r=>r.id)).toEqual(before.map(r=>r.id));expect(after[2].role).toBe('assistant');expect(after[3].content).toContain('C走到U身边');
 char.home3D!.records=[...example,event('e7','U去拿水')];await DB.saveCharacter(char);expect(await loadCharacterContextMessages(char)).toHaveLength(4);
});
it('preserves old per-event messages and IDs when upgrading the bridge',async()=>{
 const char=character(),db=await openDB();
 await new Promise<void>((resolve,reject)=>{const tx=db.transaction('characters','readwrite');tx.objectStore('characters').put({...char,homeContextBridgeVersion:1});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
 let first=0;for(const e of example){const id=await DB.saveMessage({charId:char.id,role:'user',type:'text',content:e.text,timestamp:e.at,metadata:{source:'home',homeRecordId:e.id}});first||=id;}
 const rows=await loadCharacterContextMessages(char);expect(rows).toHaveLength(6);expect(rows[0].id).toBe(first);expect(rows[4].content).toContain('我在睡觉');expect(rows[4].role).toBe('assistant');
});
it('home requests use all shared sources once, no parallel home summary, and regeneration excludes later turns',async()=>{
 const char=character();char.home3D!.records=[];await DB.saveCharacter(char);
 for(const source of ['chat','date','call'])await DB.saveMessage({charId:char.id,role:'user',type:'text',timestamp:500,content:source+'共同历史',metadata:{source}});
 char.home3D!.records=example;await DB.saveCharacter(char);
 const args={char,user,api,scene,records:example.slice(0,4),signal:new AbortController().signal};
 const messages=await buildHomeConversationPayload(args),text=JSON.stringify(messages);
 for(const source of ['chat','date','call'])expect(text).toContain(source+'共同历史');
 expect(text.match(/U摸了C/g)).toHaveLength(1);expect(text).not.toContain('家园经历（独立场景记录）');expect(text).not.toContain('我在睡觉');
 expect(messages[0].content).not.toContain('U摸了C');
 char.home3D!.records=[...example,event('e7','未来的家园行为')];await DB.saveCharacter(char);
 await DB.saveMessage({charId:char.id,role:'user',type:'text',content:'未来的私聊'});
 const retry=JSON.stringify(await buildHomeConversationPayload({...args,regenerating:true}));
 expect(retry).not.toContain('未来');expect(retry).not.toContain('我在睡觉');expect(retry).toContain('你在干嘛呢');
});

it('omits routine footsteps but retains approaching a person and spoken words',()=>{
 const records=[event('walk','C在房间里走了几步','character'),event('move','U在房间里走动'),event('near','C走到U身边','character'),event('say','我走了几步','user','message')];
 const rows=homeTurnMessages('c',records);expect(rows).toHaveLength(1);expect(rows[0].content).not.toContain('C在房间里走了几步');expect(rows[0].content).not.toContain('U在房间里走动');expect(rows[0].content).toContain('C走到U身边');expect(rows[0].content).toContain('我走了几步');
});
