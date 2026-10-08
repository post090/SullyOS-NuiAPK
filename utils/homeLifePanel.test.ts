// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,it,expect,vi} from 'vitest';
import HomeLifePanel from '../apps/room3d/HomeLifePanel';
import type {HomeRecord} from '../apps/room3d/types';
const mocks=vi.hoisted(()=>({reply:vi.fn()}));
vi.mock('./homeConversation',()=>({generateHomeReply:mocks.reply}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
const host=document.createElement('div');document.body.append(host);let root:ReturnType<typeof createRoot>;
let records:HomeRecord[]=[];let manualRevision=0;
const scene={roomId:'r',roomName:'客厅',present:true,busy:false,activity:'休息',actions:[{id:'sit',kind:'sit',label:'坐下',roomId:'r'}]};
const gestureEnd=vi.fn();
const editor={playUserSpeech:vi.fn(),playHomeResponse:vi.fn(()=>true),beginHomeConversation:vi.fn(()=>gestureEnd),getHomeScene:()=>({...scene,manualRevision}),getState:()=>({records}),updateRecords:(v:HomeRecord[])=>{records=v;},performHomeAction:vi.fn(()=> 'started'),setAutonomy:vi.fn(),openPanel:vi.fn()};
async function render(panel='chat',initiative?:any){root=createRoot(host);await act(async()=>root.render(React.createElement(HomeLifePanel,{initiative,editor:editor as any,character:{id:'c',name:'Sully'} as any,user:{name:'用户'} as any,api:{baseUrl:'test',model:'test'} as any,panel,onPanel:()=>{}})));}
async function click(text:string){await act(async()=>{const b=[...host.querySelectorAll('button')].find(e=>e.textContent===text||e.getAttribute('aria-label')===text);expect(b).toBeTruthy();b!.click();});}
async function input(text:string){await act(async()=>{const el=host.querySelector('textarea')!;Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(el,text);el.dispatchEvent(new Event('input',{bubbles:true}));});}
afterEach(()=>{act(()=>root.unmount());records=[];manualRevision=0;vi.clearAllMocks();vi.restoreAllMocks();});
it('opens and reopens at the latest record before paint, retaining the reading anchor when loading older records',async()=>{
 vi.spyOn(HTMLElement.prototype,'scrollHeight','get').mockImplementation(function(this:HTMLElement){return this.classList.contains('home-record-list')?this.querySelectorAll('.home-record').length*100:0;});
 vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(500);
 records=Array.from({length:80},(_,i)=>({id:String(i),at:i,kind:'message',source:'model',actor:'character',text:`记录 ${i}`,roomId:'r',roomName:'客厅'}));
 root=createRoot(host);
 let beforePaint=0;
 function Harness({panel,characterId='c'}:{panel:string|null;characterId?:string}){
  React.useLayoutEffect(()=>{beforePaint=host.querySelector<HTMLDivElement>('.home-record-list')?.scrollTop??0;});
  return React.createElement(HomeLifePanel,{editor:editor as any,character:{id:characterId,name:'Sully'} as any,panel,onPanel:()=>{}});
 }
 const show=async(panel:string|null,characterId='c')=>{await act(async()=>root.render(React.createElement(Harness,{panel,characterId})));};
 const page=()=>host.querySelector<HTMLDivElement>('.home-record-list')!;
 const scroll=async(top:number)=>{await act(async()=>{page().scrollTop=top;page().dispatchEvent(new Event('scroll'));});};
 await show('journal');expect(beforePaint).toBe(4000);
 await scroll(40);await click('更早的日常');expect(page().scrollTop).toBe(4040);
 records=[...records,{...records[0],id:'new',at:81,text:'新回复'}];
 await show('journal');expect(page().scrollTop).toBe(4040);
 await show(null);await show('journal');expect(beforePaint).toBe(8000);
 await show('chat');expect(beforePaint).toBe(3000);
 await scroll(40);await show('chat','other');expect(beforePaint).toBe(3000);
 expect(page().style.scrollBehavior).toBe('auto');
});
it('shows daily records oldest first with the latest at the bottom',async()=>{
 records=[{id:'a',at:1,kind:'action',source:'user',actor:'user',text:'你对 Sully 开始拥抱',roomId:'r',roomName:'客厅'},{id:'b',at:2,kind:'message',source:'model',actor:'character',text:'最新一句',roomId:'r',roomName:'客厅'}];
 await render('journal');expect([...host.querySelectorAll('.home-record>p')].map(e=>e.textContent)).toEqual(['你对 Sully 开始拥抱','最新一句']);
});
it('homely chat is nonmodal, preserves drafts across collapse, and uses the same reply pipeline',async()=>{
 root=createRoot(host);let panel:string|null='chat';
 const props={presentation:'homely' as const,editor:editor as any,character:{id:'c',name:'Sully'} as any,user:{name:'用户'} as any,api:{baseUrl:'test',model:'test'} as any,onPanel:(value:string|null)=>{panel=value;root.render(React.createElement(HomeLifePanel,{...props,panel}));}};
 await act(async()=>root.render(React.createElement(HomeLifePanel,{...props,panel})));
 expect(host.querySelector('[role="dialog"]')?.getAttribute('aria-modal')).toBeNull();
 await input('回家啦');await click('收起家园聊天');expect(host.querySelector('textarea')).toBeNull();
 await act(async()=>props.onPanel('chat'));expect(host.querySelector('textarea')?.value).toBe('回家啦');
 mocks.reply.mockResolvedValue({text:'欢迎回家'});await click('发送');expect(records.map(r=>r.text)).toEqual(['回家啦','欢迎回家']);
});
it('sends, records a real reply and performs a valid action only once',async()=>{
 mocks.reply.mockResolvedValue({text:'坐下来聊聊',actionId:'sit'});await render();await input('好呀');await click('发送');
 expect(records.map(e=>e.text)).toEqual(['好呀','坐下来聊聊']);expect(records[1].replyTo).toBe(records[0].id);expect(editor.performHomeAction).toHaveBeenCalledOnce();
 await click('重新回复');expect(records).toHaveLength(2);expect(editor.performHomeAction).toHaveBeenCalledOnce();
});
it('submits a multi-action reply as one ordered plan rather than firing all steps at once',async()=>{
 const plan=vi.fn(async(_ids:string[],_replyTo?:string)=> 'completed');(editor as any).performHomeActions=plan;
 try{
  mocks.reply.mockResolvedValue({text:'先坐下再休息',actionIds:['sit','sleep']});
  await render();await input('坐下再睡吧');await click('发送');
  expect(plan).toHaveBeenCalledOnce();expect(plan.mock.calls[0][0]).toEqual(['sit','sleep']);
  expect(editor.performHomeAction).not.toHaveBeenCalled();
 }finally{delete (editor as any).performHomeActions;}
});
it('keeps a failed user turn and retries without duplicating it',async()=>{
 mocks.reply.mockRejectedValueOnce(Error('断网')).mockResolvedValueOnce({text:'我在这里'});await render();await input('在吗');await click('发送');
 expect(records).toHaveLength(1);expect(host.textContent).toContain('断网');await click('重试');expect(records).toHaveLength(2);
});
it('deletes a record immediately, supports undo, and preserves records during regeneration failures',async()=>{
 records=[{id:'u',at:1,kind:'message',source:'user',actor:'user',text:'hello',roomId:'r',roomName:'客厅'},{id:'a',at:2,kind:'message',source:'model',actor:'character',text:'原回复',replyTo:'u',roomId:'r',roomName:'客厅'}];
 mocks.reply.mockRejectedValue(Error('超时'));await render('journal');await click('重新回复');expect(records[1].text).toBe('原回复');await click('删除');expect(records).toHaveLength(1);await click('撤销');expect(records).toHaveLength(2);
});

it('retrying an older unanswered message excludes later messages from the reply input',async()=>{
 records=[{id:'old',at:1,kind:'message',source:'user',actor:'user',text:'older',roomId:'r',roomName:'客厅'},{id:'later',at:2,kind:'message',source:'user',actor:'user',text:'later',roomId:'r',roomName:'客厅'}];
 mocks.reply.mockResolvedValue({text:'answer'});await render();await click('补回回复');expect(mocks.reply.mock.calls[0][0].records.map((r:HomeRecord)=>r.id)).toEqual(['old']);
});

it('a delayed model reply cannot override a newer manual interaction',async()=>{
 let resolve!:(value:any)=>void;mocks.reply.mockReturnValue(new Promise(r=>{resolve=r;}));await render();await input('坐下吧');await click('发送');manualRevision++;await act(async()=>resolve({text:'好',actionId:'sit'}));expect(records).toHaveLength(2);expect(editor.performHomeAction).not.toHaveBeenCalled();
});
it('animates the request and spoken reply, but never animates history regeneration',async()=>{
 let resolve!:(value:any)=>void;mocks.reply.mockReturnValue(new Promise(r=>{resolve=r;}));await render();await input('聊聊吧');await click('发送');
 expect(editor.beginHomeConversation).toHaveBeenCalledOnce();
 await act(async()=>resolve({text:'嗯，我在听你说。'}));expect(gestureEnd).toHaveBeenLastCalledWith(3);
 mocks.reply.mockResolvedValue({text:'重新说一遍'});await click('重新回复');expect(editor.beginHomeConversation).toHaveBeenCalledOnce();
});
it('ends conversation gestures when the request fails',async()=>{
 mocks.reply.mockRejectedValue(Error('断网'));await render();await input('你好');await click('发送');expect(gestureEnd).toHaveBeenLastCalledWith(0);
});

it('a clicked invitation uses the same reply pipeline without inventing a user message and invokes a visible response',async()=>{mocks.reply.mockResolvedValue({text:'刚才在窗边，想和你说说。'});await render('chat',{id:'offer',roomId:'r',reason:'走到窗边'});expect(mocks.reply).toHaveBeenCalledOnce();expect(mocks.reply.mock.calls[0][0].initiative).toBe(true);expect(records[0].kind).toBe('presence');expect(records[0].actor).toBe('character');expect(records[1].replyTo).toBe(records[0].id);expect(editor.playHomeResponse).toHaveBeenCalledWith('model',records[0].id);});

it('keeps an in-flight reply when the chat sheet is hidden and explains an explicit stop',async()=>{
 mocks.reply.mockImplementation(({signal}:any)=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason))));
 await render();await input('你好');await click('发送');const signal=mocks.reply.mock.calls[0][0].signal;
 expect(editor.playUserSpeech).toHaveBeenCalledWith('你好');
 const props={editor:editor as any,character:{id:'c',name:'Sully'} as any,user:{name:'用户'} as any,api:{baseUrl:'test',model:'test'} as any,onPanel:()=>{}};
 await act(async()=>root.render(React.createElement(HomeLifePanel,{...props,panel:null})));expect(signal.aborted).toBe(false);
 await act(async()=>root.render(React.createElement(HomeLifePanel,{...props,panel:'chat'})));await click('停止');expect(signal.reason.message).toBe('用户点击停止家园回复');expect(host.textContent).toContain('用户点击停止家园回复');
});

it('shows current buffs from the shared character profile via the mood panel',async()=>{
 root=createRoot(host);const props={editor:editor as any,user:{name:'用户'} as any,panel:'mood',onPanel:()=>{}};
 const character={id:'c',name:'Sully',scheduleFeatureEnabled:true,emotionConfig:{enabled:true},activeBuffs:[{id:'warm',emoji:'❤️',label:'安心',description:'和你待着很安心',intensity:3}]} as any;
 await act(async()=>root.render(React.createElement(HomeLifePanel,{...props,character})));expect(host.textContent).toContain('Sully的心情');expect(host.textContent).toContain('和你待着很安心');expect(mocks.reply).not.toHaveBeenCalled();
 await act(async()=>root.render(React.createElement(HomeLifePanel,{...props,character:{...character,activeBuffs:[{id:'joy',label:'开心',description:'新情绪',intensity:2}]}})));expect(host.textContent).toContain('新情绪');expect(host.textContent).not.toContain('和你待着很安心');
 await act(async()=>root.render(React.createElement(HomeLifePanel,{...props,character:{...character,emotionConfig:{enabled:false}}})));expect(host.textContent).toContain('尚未开启');expect(host.textContent).not.toContain('和你待着很安心');
});

it('cancels an automatic reply when leaving the home app',async()=>{
 mocks.reply.mockImplementation(({signal}:any)=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason))));
 const initiative={id:'auto-boundary',roomId:'r',reason:'坐下休息',automatic:true};await render('chat',initiative);expect(mocks.reply).toHaveBeenCalledOnce();const signal=mocks.reply.mock.calls[0][0].signal;
 await act(async()=>root.render(React.createElement(HomeLifePanel,{active:false,initiative,editor:editor as any,character:{id:'c',name:'Sully'} as any,user:{name:'用户'} as any,api:{baseUrl:'test',model:'test'} as any,panel:null,onPanel:()=>{}})));
 expect(signal.aborted).toBe(true);expect(signal.reason.message).toContain('已离开家园');expect(mocks.reply).toHaveBeenCalledOnce();
});
it('does not start an automatic request while the document is hidden',async()=>{
 const hidden=vi.spyOn(document,'hidden','get').mockReturnValue(true);try{await render('chat',{id:'hidden-auto',roomId:'r',reason:'休息',automatic:true});expect(mocks.reply).not.toHaveBeenCalled();}finally{hidden.mockRestore();}
});
it('mood panel displays shared inner state, updates without buff changes and isolates characters',async()=>{
 localStorage.setItem('sully_last_innerstate_c','正在惦记晚饭');
 root=createRoot(host);
 const show=async(character:any)=>{await act(async()=>root.render(React.createElement(HomeLifePanel,{editor:editor as any,character,panel:'mood',onPanel:()=>{}})));};
 const c={id:'c',name:'Sully',scheduleFeatureEnabled:true,emotionConfig:{enabled:true},activeBuffs:[]};
 await show(c);expect(host.textContent).toContain('正在惦记晚饭');
 await act(async()=>{window.dispatchEvent(new CustomEvent('emotion-innerstate-updated',{detail:{charId:'other',innerState:'其他角色的秘密'}}));});
 expect(host.textContent).not.toContain('其他角色的秘密');
 await act(async()=>{window.dispatchEvent(new CustomEvent('emotion-innerstate-updated',{detail:{charId:'c',innerState:'现在想喝茶'}}));});
 expect(host.textContent).toContain('现在想喝茶');
 await show({...c,id:'other'});expect(host.textContent).not.toContain('现在想喝茶');
 await show({...c,emotionConfig:{enabled:false}});expect(host.querySelector('[aria-label="内心想法"]')).toBeNull();
 localStorage.removeItem('sully_last_innerstate_c');
});

it('stop unlocks retry even if a shared preparation promise never settles',async()=>{
 mocks.reply.mockReturnValue(new Promise(()=>{}));await render();await input('你好');await click('发送');await click('停止');
 expect(host.textContent).toContain('用户点击停止家园回复');expect([...host.querySelectorAll('button')].find(b=>b.textContent==='重试')?.disabled).toBe(false);
 mocks.reply.mockResolvedValue({text:'重试成功'});await click('重试');expect(records.at(-1)?.text).toBe('重试成功');
});
