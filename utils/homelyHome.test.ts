// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import HomelyHome from '../components/os/HomelyHome';
import {AppID} from '../types';
const m=vi.hoisted(()=>({open:vi.fn(),theme:vi.fn(),resident:{id:'qa',name:'Sully'},style:{homelyPalette:'apricot',skin:'homely'}}));
vi.mock('../context/OSContext',()=>({useOS:()=>({characters:[m.resident],activeCharacterId:'qa',setActiveCharacterId:vi.fn(),updateCharacter:vi.fn(),openApp:m.open,isLocked:false,theme:m.style,updateTheme:m.theme})}));
vi.mock('../apps/room3d/Home3DSetupEntry',()=>({default:()=>null}));
vi.mock('../components/os/TokenImg',()=>({default:()=>null}));
vi.mock('../constants',async()=>{const {AppID}=await import('../types');return {INSTALLED_APPS:[{id:AppID.Launcher,name:'桌面'},{id:AppID.Chat,name:'聊聊'},{id:AppID.Music,name:'音乐'}]};});
vi.mock('../components/os/AppIcon',()=>({default:({app,onClick}:any)=>React.createElement('button',{onClick},app.name)}));
let host:HTMLDivElement,root:ReturnType<typeof createRoot>;
const click=(label:string)=>act(async()=>host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click());
const input=async(value:string)=>act(async()=>{const el=host.querySelector<HTMLInputElement>('[aria-label="搜索应用"]')!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));});
beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);host=document.createElement('div');document.body.append(host);root=createRoot(host);act(()=>root.render(React.createElement(HomelyHome)));});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.unstubAllGlobals();});
it('filters app names, handles empty results and opens the selected real app',async()=>{
 await click('打开全部应用');
 await input('不存在');expect(host.textContent).toContain('没有找到这个应用');
 await input('  音乐  ');expect(host.textContent).toContain('音乐');expect(host.textContent).not.toContain('聊聊');
 const music=[...host.querySelectorAll('button')].find(el=>el.textContent==='音乐')!;
 await act(async()=>music.click());expect(m.open).toHaveBeenCalledWith(AppID.Music);expect(host.querySelector('[role="dialog"]')).toBeNull();
});
it('resets a dismissed search and includes the search field in the keyboard focus loop',async()=>{
 await click('打开全部应用');await input('不存在');
 const close=host.querySelector<HTMLButtonElement>('[aria-label="关闭"]')!;close.focus();
 await act(async()=>close.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,cancelable:true})));
 expect(document.activeElement).toBe(host.querySelector('[aria-label="搜索应用"]'));
 await click('关闭');await click('打开全部应用');
 expect(host.querySelector<HTMLInputElement>('[aria-label="搜索应用"]')?.value).toBe('');
 expect(host.textContent).toContain('聊聊');
});
it('palette selection updates only the existing appearance preference',async()=>{
 await click('更换居家配色');const blue=[...host.querySelectorAll('button')].find(el=>el.textContent==='云朵雾蓝')!;
 await act(async()=>blue.click());expect(m.theme).toHaveBeenCalledWith({homelyPalette:'blue'});expect(m.open).not.toHaveBeenCalled();
});
