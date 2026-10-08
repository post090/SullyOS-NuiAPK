// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {useHomeEmotion} from '../apps/room3d/useHomeEmotion';
const mocks=vi.hoisted(()=>({load:vi.fn()}));
vi.mock('./homeEmotionLoader',()=>({loadHomeEmotion:mocks.load}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
let root:ReturnType<typeof createRoot>,host:HTMLDivElement,ref:any;
const char={id:'c',scheduleFeatureEnabled:true,emotionConfig:{enabled:true},activeBuffs:[]} as any;
function Harness({on=true}:{on?:boolean}){ref=useHomeEmotion({...char,emotionConfig:{enabled:on}},undefined,true);return null;}
beforeEach(()=>{vi.clearAllMocks();host=document.createElement('div');document.body.append(host);root=createRoot(host);mocks.load.mockResolvedValue({value:{energy:-.5,approach:.5,interaction:-.5},at:100});});
afterEach(()=>{act(()=>root.unmount());host.remove();});
it('applies the emotion event payload without waiting for parent profile refresh',async()=>{await act(async()=>root.render(React.createElement(Harness)));mocks.load.mockResolvedValue(undefined);await act(async()=>window.dispatchEvent(new CustomEvent('emotion-updated',{detail:{charId:'c',buffs:[],buffInjection:''}})));expect(mocks.load.mock.calls.at(-1)![0].buffInjection).toBe('');expect(ref.current).toBeUndefined();});
it('ignores other characters and clears motion bias when disabled',async()=>{await act(async()=>root.render(React.createElement(Harness)));expect(ref.current.value.approach).toBe(.5);await act(async()=>window.dispatchEvent(new CustomEvent('emotion-updated',{detail:{charId:'other',buffs:[]}})));expect(mocks.load).toHaveBeenCalledOnce();await act(async()=>root.render(React.createElement(Harness,{on:false})));expect(ref.current).toBeUndefined();expect(mocks.load.mock.calls[0][2].aborted).toBe(true);});
