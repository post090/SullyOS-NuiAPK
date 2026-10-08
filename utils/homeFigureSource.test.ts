// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach, expect, it, vi} from 'vitest';
import HomeFigureStudio from '../components/character/HomeFigureStudio';
const mocks=vi.hoisted(()=>({editor:vi.fn(),save:vi.fn(),userSave:vi.fn()}));
vi.mock('../context/OSContext',()=>({useOS:()=>({characters:[{id:'c',name:'Sully',chibiStudio:{room:{state:{selected:{eyes:'room'}}},vr:{state:{selected:{eyes:'vr'}}},like520:{state:{selected:{eyes:'520'}}},home3D:{state:{selected:{eyes:'home'}},hair:{layers:{},extras:[]}}}}],userProfile:{name:'用户',vrState:{chibi:{state:{selected:{eyes:'user'}}}}},updateCharacter:mocks.save,updateUserProfile:mocks.userSave})}));
vi.mock('../components/Like520Event',()=>({CreatorIframe:()=>null,LIKE520_RECORD_KEY:'like520_2026'}));
vi.mock('../components/os/TokenImg',()=>({default:()=>null}));
vi.mock('../components/character/HomeFigureEditor',()=>({default:(props:any)=>{mocks.editor(props);return React.createElement('button',{onClick:props.onClose},'取消编辑');}}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
const host=document.createElement('div');document.body.appendChild(host);let root:ReturnType<typeof createRoot>;
afterEach(()=>{act(()=>root.unmount());vi.clearAllMocks();vi.unstubAllGlobals();});
async function render(charId?:string){root=createRoot(host);await act(async()=>root.render(React.createElement(HomeFigureStudio,{charId,startEditing:true,onClose:vi.fn()})));}
async function click(label:string){await act(async()=>{[...host.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===label||b.textContent===label)!.click();});}
it('selects a cabinet source instead of silently preferring room or saved home',async()=>{
 await render('c');expect(mocks.editor).not.toHaveBeenCalled();
 await click('彼方');let props=mocks.editor.mock.lastCall![0];expect(props.seedState.selected.eyes).toBe('vr');expect(props.value).toBeUndefined();const key=props.draftKey;
 await click('取消编辑');await click('从头捏一个');props=mocks.editor.mock.lastCall![0];expect(props.seedState).toBeUndefined();expect(props.value).toBeUndefined();expect(props.draftKey).not.toBe(key);
 expect(mocks.save).not.toHaveBeenCalled();
});
it('continues saved home with its 3D settings',async()=>{await render('c');await click('继续编辑当前家园形象');expect(mocks.editor.mock.lastCall![0].value.state.selected.eyes).toBe('home');});
it('offers the user their own Chibi only',async()=>{await render();expect(host.textContent).not.toContain('小小窝');await click('我的 Chibi');expect(mocks.editor.mock.lastCall![0].seedState.selected.eyes).toBe('user');expect(mocks.userSave).not.toHaveBeenCalled();});

it('opens fresh, source and saved figures on a LAN HTTP origin without randomUUID',async()=>{
 const native=globalThis.crypto;
 vi.stubGlobal('crypto',{getRandomValues:native.getRandomValues.bind(native)});
 await render('c');
 const keys=new Set<string>();
 for(const label of ['从头捏一个','彼方','继续编辑当前家园形象']){
  await click(label);expect(mocks.editor).toHaveBeenCalled();
  const props=mocks.editor.mock.lastCall![0];keys.add(props.draftKey);
  await click('取消编辑');
 }
 expect(keys.size).toBe(3);expect(mocks.save).not.toHaveBeenCalled();
});

