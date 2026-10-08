// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import HomelyMusic from '../apps/room3d/HomelyMusic';
import {AppID} from '../types';
import type {HomeEditor} from '../apps/room3d/editor';
const m=vi.hoisted(()=>({music:{current:null as any,playing:false,loadingSong:false,progress:0,duration:60,queue:[] as any[],togglePlay:vi.fn(),nextSong:vi.fn()},openApp:vi.fn(),motion:vi.fn()}));
vi.mock('../context/MusicContext',()=>({useMusic:()=>m.music}));
vi.mock('../context/OSContext',()=>({useOS:()=>({openApp:m.openApp})}));
vi.mock('../components/os/TokenImg',()=>({default:()=>null}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
let host:HTMLDivElement,root:ReturnType<typeof createRoot>;
const editor={setHomelyMusic:m.motion} as unknown as HomeEditor;
function render(active=true){act(()=>root.render(React.createElement(HomelyMusic,{editor,active})));}
beforeEach(()=>{vi.clearAllMocks();Object.assign(m.music,{current:null,playing:false,loadingSong:false,progress:0,queue:[]});host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(()=>{act(()=>root.unmount());host.remove();});
it('is absent without a track and uses the shared player controls',()=>{render();expect(host.textContent).toBe('');m.music.current={id:1,name:'晚风',artists:'测试'};m.music.queue=[m.music.current,{id:2}];m.music.playing=true;render();const click=(label:string)=>act(()=>host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click());click('暂停音乐');expect(m.music.togglePlay).toHaveBeenCalledOnce();expect(host.querySelector('progress')).toBeNull();click('展开音乐播放器：晚风');click('下一首');expect(m.music.nextSong).toHaveBeenCalledOnce();click('打开音乐：晚风');expect(m.openApp).toHaveBeenCalledWith(AppID.Music);click('收起音乐播放器');expect(host.querySelector('progress')).toBeNull();});
it('tracks real playback state, pauses motion when busy, and cleans up',()=>{m.music.current={id:1,name:'晚风'};m.music.playing=true;m.music.progress=12;render();expect(m.motion).toHaveBeenLastCalledWith({playing:true,position:12});m.music.loadingSong=true;render();expect(m.motion).toHaveBeenLastCalledWith({playing:false,position:12});m.music.loadingSong=false;render(false);expect(m.motion).toHaveBeenLastCalledWith({playing:false,position:12});act(()=>root.render(null));expect(m.motion).toHaveBeenLastCalledWith({playing:false,position:0});});
