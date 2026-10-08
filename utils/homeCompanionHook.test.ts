// @vitest-environment jsdom
import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {beforeEach,afterEach,it,expect,vi} from 'vitest';import {useHomeCompanion} from '../apps/room3d/useHomeCompanion';
vi.mock('../apps/room3d/useHomeEmotion',()=>({useHomeEmotion:()=>({current:undefined})}));
vi.mock('./homeCompanionPolicy',()=>({loadCompanionPolicy:async()=>({approach:1,follow:0,sit:0,warmth:.5})}));
vi.mock('./memoryPalace/db',()=>({ROOM_PLATES_UPDATED_EVENT:'room-plates-updated'}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
let root:any,host:HTMLDivElement,reaction:string|undefined;
const perform=vi.fn(),editor={getState:()=>({autonomy:true}),getCompanionSnapshot:()=>({ready:true,canMove:true,distance:4,userMoved:false,canSit:false,reactionId:reaction}),performCompanionAction:perform,cancelCompanionAction:vi.fn()};
function Harness(){useHomeCompanion(editor as any,{id:'c'} as any,undefined,undefined,true,false);return null;}
beforeEach(async()=>{vi.useFakeTimers();vi.spyOn(Math,'random').mockReturnValue(.1);vi.clearAllMocks();reaction=undefined;perform.mockReturnValue(false);host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>root.render(React.createElement(Harness)));});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.restoreAllMocks();vi.useRealTimers();});
it('retries a failed route on the next decision instead of waiting 45 seconds',async()=>{await act(async()=>vi.advanceTimersByTime(15000));expect(perform).toHaveBeenCalledOnce();await act(async()=>vi.advanceTimersByTime(3000));expect(perform).toHaveBeenCalledTimes(2);});
it('fresh interaction responds despite the wandering cooldown and only once',async()=>{perform.mockReturnValue(true);await act(async()=>vi.advanceTimersByTime(15000));reaction='touch';await act(async()=>vi.advanceTimersByTime(3000));expect(perform).toHaveBeenLastCalledWith('react',.5);await act(async()=>vi.advanceTimersByTime(3000));expect(perform).toHaveBeenCalledTimes(2);});
