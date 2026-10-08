import {beforeEach,it,expect,vi} from 'vitest';
import {generateHomeReply,buildHomeConversationPayload} from './homeConversation';
import {homeTurnMessages} from './homeTurns';
import {DB} from './db';
const m=vi.hoisted(()=>({recall:vi.fn(),plates:vi.fn(),range:vi.fn(),emotion:vi.fn()}));
vi.mock('./homeReplyEmotion',()=>({evaluateHomeReplyEmotion:m.emotion}));
vi.mock('./memoryPalace/pipeline',()=>({injectMemoryPalace:m.recall}));
vi.mock('./memoryPalace/roomPlates',()=>({buildRoomPlatesInjection:m.plates}));
vi.mock('./chatContextRange',async(importOriginal)=>({...await importOriginal<typeof import('./chatContextRange')>(),loadCharacterContextRange:m.range}));
vi.mock('./visionApi',()=>({materializeVisionDescriptions:async(rows:any)=>rows}));
vi.mock('./db',async original=>({...await original<typeof import('./db')>()}));
const records:any[]=[{id:'u1',at:1000,actor:'user',kind:'message',source:'user',text:'还记得上次一起看海吗',roomId:'r',roomName:'客厅'}];
const args:any={char:{id:'c',name:'C',memoryPalaceEnabled:true,memoryPalaceInjection:'过期回忆',roomPlatesInjection:'过期门牌'},user:{name:'U'},api:{},scene:{roomId:'r',roomName:'客厅',present:true,actions:[]},records,signal:new AbortController().signal};
beforeEach(()=>{vi.clearAllMocks();m.range.mockResolvedValue({hwm:0,messages:[{id:1,charId:'c',role:'user',type:'text',content:'范围内原文',timestamp:1}]});m.plates.mockResolvedValue('新门牌：喜欢海边');m.recall.mockImplementation(async(c:any)=>{c.memoryPalaceInjection='找回了海边的记忆';c.roomPlatesInjection='新门牌：喜欢海边';return {stages:[{name:'room_plates'}]};});});
it('refreshes recall and plates before building the actual outgoing prompt without mutating the profile',async()=>{
 const messages=await buildHomeConversationPayload(args),text=JSON.stringify(messages);
 expect(m.recall).toHaveBeenCalledTimes(1);const call=m.recall.mock.calls[0];expect(call[1].map((r:any)=>r.content).join()).toContain('还记得上次一起看海吗');expect(call[4]).toEqual({entryPoint:'home_3d'});
 expect(text).toContain('找回了海边的记忆');expect(text).toContain('新门牌');expect(text).not.toContain('过期');expect(args.char.memoryPalaceInjection).toBe('过期回忆');
});
it('does not reread plates when the shared pipeline already loaded them',async()=>{m.recall.mockImplementation(async(c:any)=>{c.roomPlatesInjection='管线门牌';return {stages:[{name:'room_plates'}]};});expect((await buildHomeConversationPayload(args))[0].content).toContain('管线门牌');expect(m.plates).not.toHaveBeenCalled();});
it('clears deleted plates and never injects stale fields when palace is off',async()=>{m.plates.mockResolvedValue('');m.recall.mockResolvedValue({stages:[]});expect((await buildHomeConversationPayload(args))[0].content).not.toContain('过期');m.plates.mockClear();const disabled={...args,char:{...args.char,memoryPalaceEnabled:false}};expect((await buildHomeConversationPayload(disabled))[0].content).not.toContain('过期');expect(m.plates).not.toHaveBeenCalled();});
it('regeneration passes only the visible history through the target turn to recall',async()=>{const pending=homeTurnMessages('c',records)[0];m.range.mockResolvedValue({hwm:0,messages:[{...pending,id:2},{id:3,charId:'c',role:'user',type:'text',content:'未来消息',timestamp:3000}]});await buildHomeConversationPayload({...args,regenerating:true});expect(JSON.stringify(m.recall.mock.calls[0][1])).not.toContain('未来消息');});
it('does not continue assembling a cancelled request after recall',async()=>{const controller=new AbortController();m.recall.mockImplementation(async()=>{controller.abort();return {stages:[]};});await expect(buildHomeConversationPayload({...args,signal:controller.signal})).rejects.toMatchObject({name:'AbortError'});expect(m.plates).not.toHaveBeenCalled();});

it('reports recall and prompt assembly separately and skips a redundant profile read for an in-range turn',async()=>{
 const pending=homeTurnMessages('c',records)[0];m.range.mockResolvedValue({hwm:0,messages:[{...pending,id:2}]});
 const read=vi.spyOn(DB,'getCharacter'),stages:string[]=[];
 try{await buildHomeConversationPayload({...args,onStage:(s:string)=>stages.push(s)});expect(read).not.toHaveBeenCalled();expect(stages.indexOf('记忆召回')).toBeGreaterThan(-1);expect(stages.indexOf('组装提示词')).toBeGreaterThan(stages.indexOf('记忆召回'));}finally{read.mockRestore();}
});

it('still rejects a persisted turn excluded from the shared range before recall',async()=>{
 const read=vi.spyOn(DB,'getCharacter').mockResolvedValue({...args.char,home3D:{records}});
 try{await expect(buildHomeConversationPayload(args)).rejects.toThrow('已不在当前上下文范围内');expect(read).toHaveBeenCalledWith('c');expect(m.recall).not.toHaveBeenCalled();}finally{read.mockRestore();}
});

it('activates keyword worldbooks from the same visible history',async()=>{const messages=await buildHomeConversationPayload({...args,char:{...args.char,mountedWorldbooks:[{id:'sea',title:'海边',category:'测试',constant:false,key:['看海'],content:'我们常去东岸海滩'}]}});expect(messages[0].content).toContain('我们常去东岸海滩');});

it('starts emotion evaluation before the main reply resolves, with the identical outgoing input',async()=>{
 let finish!: (value:Response)=>void;
 const fetcher=vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve}));
 vi.stubGlobal('fetch',fetcher);
 m.emotion.mockReturnValue(new Promise(()=>{}));
 try {
  const pending=generateHomeReply({...args,api:{baseUrl:'https://example.test/v1',model:'test'}});
  await vi.waitFor(()=>expect(fetcher).toHaveBeenCalledOnce());
  const sent=JSON.parse((fetcher.mock.calls as any)[0][1].body).messages;
  expect(m.emotion).toHaveBeenCalledOnce();
  expect(m.emotion.mock.calls[0][1]).toEqual(sent);
  finish(new Response(JSON.stringify({choices:[{message:{content:'{"text":"你好"}'}}]}),{status:200}));
  expect(await pending).toMatchObject({text:'你好'});
 } finally {vi.unstubAllGlobals();}
});

it('releases a stalled recall on cancellation without firing either API',async()=>{
 const abort=new AbortController(),stages:string[]=[];let finish!:(v:any)=>void;
 m.recall.mockReturnValue(new Promise(resolve=>{finish=resolve;}));const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 try{const result=generateHomeReply({...args,signal:abort.signal,api:{baseUrl:'https://example.test',model:'test'},onStage:s=>stages.push(s)});
 const rejected=expect(result).rejects.toThrow('停止测试');await vi.waitFor(()=>expect(m.recall).toHaveBeenCalledOnce());abort.abort(new Error('停止测试'));await rejected;
 expect(stages.at(-1)).toBe('记忆召回');expect(m.emotion).not.toHaveBeenCalled();expect(fetcher).not.toHaveBeenCalled();finish({stages:[]});await Promise.resolve();expect(fetcher).not.toHaveBeenCalled();
 }finally{vi.unstubAllGlobals();}
});
