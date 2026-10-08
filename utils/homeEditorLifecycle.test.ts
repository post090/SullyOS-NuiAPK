// @vitest-environment jsdom
import React,{StrictMode,act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi,afterEach} from 'vitest';
import Home3DView from '../apps/room3d/Home3DView';
const m=vi.hoisted(()=>({mount:vi.fn(),dispose:vi.fn()}));
vi.mock('../apps/room3d/editor.js',()=>({mountHomeEditor:m.mount}));
vi.mock('../utils/blobRef',async original=>({...await original<typeof import('./blobRef')>(),useBlobRefUrl:()=>undefined}));
vi.mock('../apps/room3d/HomeSocialPanel',()=>({HomeSocialPanel:()=>null}));
vi.mock('../apps/room3d/HomeLifePanel',()=>({default:()=>null}));
vi.mock('../apps/room3d/HomeSpeechBubble',()=>({HomeSpeechBubble:()=>null}));
vi.mock('../apps/room3d/useHomeSchedule',()=>({useHomeSchedule:()=>({away:false,currentSchedule:null})}));
vi.mock('../apps/room3d/useHomeCompanion',()=>({useHomeCompanion:()=>{}}));
vi.mock('../apps/room3d/chibi/visitor',()=>({createVisitor:vi.fn(),decodeParts:vi.fn()}));
vi.mock('../apps/room3d/chibi/CreatorRollBridge',()=>({CreatorRollBridge:()=>null}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
let root:ReturnType<typeof createRoot>|undefined,host:HTMLDivElement;
afterEach(()=>{if(root)act(()=>root!.unmount());host?.remove();vi.clearAllMocks();});
async function render(){host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>root!.render(React.createElement(StrictMode,null,React.createElement(Home3DView,{onChange:()=>{},onBack:()=>{}}))));}
it('StrictMode starts only one real editor and unload explicitly cancels it',async()=>{m.mount.mockImplementation(async(_host,options)=>{options.signal.addEventListener('abort',m.dispose,{once:true});return {setResidentPortraits:()=>{},setTimeZone:()=>{},setSuspended:()=>{},setVisitor:()=>{}};});await render();expect(m.mount).toHaveBeenCalledTimes(1);const signal=m.mount.mock.calls[0][1].signal;expect(signal.aborted).toBe(false);act(()=>root!.unmount());root=undefined;expect(signal.reason.message).toBe('Home3D disposed');expect(m.dispose).toHaveBeenCalledTimes(1);});
it('still shows a genuine load failure',async()=>{m.mount.mockRejectedValue(new Error('家具模型加载失败'));await render();expect(host.textContent).toContain('家具模型加载失败');});
