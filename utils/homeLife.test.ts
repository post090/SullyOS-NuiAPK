import {describe,it,expect,vi,afterEach} from 'vitest';
import {chooseHomeAction} from './homeAutonomy';
import {homeRecords,editHomeRecord,homeReplyHistory} from './homeRecords';
import {buildHomeActivityContext} from './homeActivityContext';
import {parseHomeReply,buildHomeConversationPrompt,generateHomeReply} from './homeConversation';
import type {HomeRecord,HomeScene,HomeAction} from '../apps/room3d/types';
import type {CharacterProfile,APIConfig,UserProfile} from '../types';
vi.mock('./chatContextRange',async importOriginal=>({...await importOriginal<typeof import('./chatContextRange')>(),loadCharacterContextRange:vi.fn(async()=>({hwm:0,messages:[{id:1,charId:'c',timestamp:1,role:'user',type:'text',content:'范围内聊天'}]}))}));
const action=(kind:string):HomeAction=>({id:kind,kind,label:kind,roomId:'study'});
const scene:HomeScene={roomId:'study',roomName:'书房',present:true,busy:false,activity:'坐着',actions:[action('stream'),action('sit')]};
const record=(id:string,actor:'user'|'character',text=id):HomeRecord=>({id,at:1000,actor,text,kind:'message',source:actor==='user'?'user':'model',roomId:'study',roomName:'书房'});
const char={id:'c',name:'Sully',homeDefinition:{kind:'between-worlds',notes:''},home3D:{records:[]}} as unknown as CharacterProfile;
const user={name:'小雨'} as UserProfile;
afterEach(()=>vi.unstubAllGlobals());
describe('local home life',()=>{
 it('matches a supported scheduled activity and otherwise stays quiet',()=>{
  expect(chooseHomeAction('晚上直播',scene.actions)?.kind).toBe('stream');
  expect(chooseHomeAction('直播',[action('sit')])).toBeUndefined();
  expect(chooseHomeAction('出门购物',scene.actions)).toBeUndefined();
  expect(chooseHomeAction('午休',[action('sleep')])?.kind).toBe('sleep');
  expect(chooseHomeAction('淋浴',[action('bath-shower')])?.kind).toBe('bath-shower');
 });
 it('edits and deletes the same records seen by other contexts, without resurrecting legacy events',()=>{
  const records=[record('u','user','原始内容'),record('a','character','旧回复')];
  const home={...char.home3D!,records:editHomeRecord(records,'a','更正后的回复'),activityLog:[{at:1,label:'旧缓存',roomName:'客厅'}]} as any;
  expect(buildHomeActivityContext({...char,home3D:home})).toContain('更正后的回复');
  expect(buildHomeActivityContext({...char,home3D:home})).not.toContain('旧回复');
  expect(homeRecords({...home,records:[]})).toEqual([]);
  expect(buildHomeActivityContext({...char,home3D:{...home,records:[]}})).toBe('');
 });
 it('regenerates using only the preceding history, without leaking future turns',async ()=>{
  const records=[record('u','user'),record('a','character'),record('future','user')];
  expect(homeReplyHistory(records,'a').map(e=>e.id)).toEqual(['u']);
  const prompt=(await buildHomeConversationPrompt(char,user,scene));
  expect(prompt).not.toContain('future');expect(prompt).toContain('书房');expect(prompt).toContain('已有');
 });
 it('accepts prose or valid speech but never executes hallucinated or away actions',()=>{
  expect(parseHomeReply('```json\n{"text":"来啦","actionId":"stream"}\n```',scene)).toEqual({text:'来啦',actionId:'stream'});
  expect(parseHomeReply('{"text":"好","actionId":"delete-house"}',scene).actionId).toBeUndefined();
  expect(parseHomeReply('{"text":"好","actionId":"stream"}',{...scene,present:false}).actionId).toBeUndefined();
  expect(parseHomeReply('{"text":"好","actionId":1}',scene).actionId).toBe('stream');
  expect(parseHomeReply('{"text":"好","actionId":"2"}',scene).actionId).toBe('sit');
  for(const id of [0,-1,1.5,3,null])expect(parseHomeReply(JSON.stringify({text:'好',actionId:id}),scene).actionId).toBeUndefined();
  expect(parseHomeReply('{"text":"好","actionId":1}',{...scene,present:false}).actionId).toBeUndefined();
  expect(parseHomeReply('我们聊聊吧',scene).text).toBe('我们聊聊吧');
  expect(()=>parseHomeReply('{"text":',scene)).toThrow();
 });
 it('describes executable targets and includes scene records even before the first character save',async ()=>{
  const prompt=(await buildHomeConversationPrompt({...char,home3D:undefined},user,{...scene,furniture:[{id:'chair',name:'窗边座椅'},{id:'decoration',name:'不可互动的壁画'}],actions:[{...action('sit'),actor:'character',target:'窗边座椅'}]}));
  expect(prompt).not.toContain('家园经历（独立场景记录）');expect(prompt).toContain('窗边座椅');expect(prompt).toContain('全部由你执行');expect(prompt).toContain('实际行为');
  expect(prompt).not.toContain('不可互动的壁画');expect(prompt).not.toContain('家具清单');expect(prompt).toContain('和小雨当面交流');expect(prompt).toContain('不替小雨说话');
 });
 it('calls the configured API with bounded visible context and propagates failures',async()=>{
  const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:'{"text":"刚才在家休息呢"}'}}]})));
  vi.stubGlobal('fetch',fetch);
  const args={char,user,api:{baseUrl:'https://api.example/v1/',apiKey:'test',model:'test'} as APIConfig,scene,records:[record('u','user','刚才在做什么')],signal:new AbortController().signal};
  expect((await generateHomeReply(args)).text).toContain('休息');
  expect(fetch.mock.calls[0][0]).toBe('https://api.example/v1/chat/completions');
  const body=JSON.parse(fetch.mock.calls[0][1].body);expect(JSON.stringify(body.messages)).toContain('范围内聊天');expect(body.messages.filter((m:any)=>m.role==='user').at(-1).content).toContain('刚才在做什么');expect(body.messages.at(-1).role).toBe('system');
  fetch.mockResolvedValue(new Response('',{status:503}));await expect(generateHomeReply(args)).rejects.toThrow('503');
 });
});
