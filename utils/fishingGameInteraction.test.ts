// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {FishingGame} from '../apps/vrWorld/FishingGame';
import type {FishingCatch} from './vrWorld/fishingMarket';
vi.mock('../apps/vrWorld/FishArt',()=>({FishArt:()=>null}));
let container:HTMLDivElement,root:Root;
const weather={kind:'clear',label:'晴',detail:'彼方天气',source:'simulated'} as const;
const catchData: FishingCatch={id:'test-catch',speciesId:'glass-minnow',ownerId:'user',ownerName:'我',caughtAt:1,weather:'clear',weatherLabel:'晴',weatherSource:'simulated',quality:1,sizeCm:12};
const button=(text:string)=>[...container.querySelectorAll('button')].find(b=>b.textContent===text)!;
beforeEach(()=>{
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;localStorage.clear();
    vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
    vi.stubGlobal('requestAnimationFrame',()=>1);vi.stubGlobal('cancelAnimationFrame',()=>{});
    vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);
    vi.spyOn(Math,'random').mockReturnValue(.1);
    container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(()=>{act(()=>root.unmount());container.remove();vi.restoreAllMocks();vi.unstubAllGlobals();});
it('simple fishing animates casting and reeling, saves once, and blocks duplicate casts',async()=>{
    let finish!:()=>void;const onCaught=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;})),onCast=vi.fn(()=>catchData);
    await act(async()=>root.render(React.createElement(FishingGame,{weather,onCast,onCaught})));
    act(()=>button('简单').click());const cast=button('抛竿');act(()=>{cast.click();cast.click();});
    expect(onCast).toHaveBeenCalledTimes(1);expect(onCaught).not.toHaveBeenCalled();
    expect(JSON.parse((window as any).render_game_to_text()).phase).toBe('waiting');
    act(()=>(window as any).advanceTime(2000));expect(onCaught).not.toHaveBeenCalled();
    act(()=>(window as any).advanceTime(2300));expect(onCaught).toHaveBeenCalledWith(catchData);
    expect(JSON.parse((window as any).render_game_to_text())).toMatchObject({phase:'caught',simple:true,saving:true});
    await act(async()=>finish());expect(button('再钓一次').disabled).toBe(false);
    expect(localStorage.getItem('vr_fishing_simple_mode')).toBe('true');
});
it('retries the same catch after storage failure and blocks rerolling it away',async()=>{
    localStorage.setItem('vr_fishing_simple_mode','true');
    const onCaught=vi.fn().mockRejectedValueOnce(new Error('写入失败')).mockResolvedValue(undefined),onCast=vi.fn(()=>catchData);
    await act(async()=>root.render(React.createElement(FishingGame,{weather,onCast,onCaught})));
    await act(async()=>button('抛竿').click());await act(async()=>(window as any).advanceTime(4300));expect(container.querySelector('[role=alert]')?.textContent).toContain('写入失败');
    expect(button('再钓一次').disabled).toBe(true);await act(async()=>button('重试收鱼').click());
    expect(onCast).toHaveBeenCalledTimes(1);expect(onCaught).toHaveBeenNthCalledWith(2,catchData);
    expect(container.querySelector('[role=alert]')).toBeNull();
});
it('cancels a manual cast without saving and suppresses the water context menu',async()=>{
    const onCaught=vi.fn().mockResolvedValue(undefined);
    await act(async()=>root.render(React.createElement(FishingGame,{weather,onCast:()=>catchData,onCaught})));
    act(()=>button('抛竿').click());expect(button('简单').disabled).toBe(true);act(()=>button('收竿').click());expect(onCaught).not.toHaveBeenCalled();
    const event=new MouseEvent('contextmenu',{bubbles:true,cancelable:true});container.querySelector('canvas')!.dispatchEvent(event);expect(event.defaultPrevented).toBe(true);
});

it('simple fishing can return empty and never saves an unearned catch', async()=>{
    localStorage.setItem('vr_fishing_simple_mode','true');vi.mocked(Math.random).mockReturnValue(.98);
    const onCaught=vi.fn().mockResolvedValue(undefined),onCast=vi.fn(()=>catchData);
    await act(async()=>root.render(React.createElement(FishingGame,{weather,onCast,onCaught})));
    act(()=>button('抛竿').click());await act(async()=>(window as any).advanceTime(4300));
    expect(JSON.parse((window as any).render_game_to_text()).phase).toBe('escaped');
    expect(container.textContent).toContain('空军');expect(onCaught).not.toHaveBeenCalled();expect(onCast).toHaveBeenCalledTimes(1);
});
