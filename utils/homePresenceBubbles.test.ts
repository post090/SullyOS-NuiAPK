// @vitest-environment jsdom
import React,{act} from 'react';import {createRoot} from 'react-dom/client';import {it,expect,vi} from 'vitest';
import {HomePresenceBubbles} from '../apps/room3d/HomePresenceBubbles';
it('shows thoughts locally, offers without calling a model, and emits one request only when clicked',()=>{
 vi.useFakeTimers();vi.setSystemTime(1000000);const host=document.createElement('div');document.body.append(host);const root=createRoot(host),clicked=vi.fn();let present=true;
 const records=[1,2,3].map(i=>({id:String(i),at:1000000,kind:'action',source:'local',actor:'character',text:'角色坐着看手机',roomId:'r',roomName:'客厅'}));
 const editor={getState:()=>({records,autonomy:true}),getHomeScene:()=>({roomId:'r',present,busy:false}),getCompanionSnapshot:()=>({ready:true}),getResidentAnchor:()=>({x:190,y:330,width:390,height:844})};
 try{act(()=>root.render(React.createElement(HomePresenceBubbles,{editor:editor as any,character:{id:'c',name:'Sully',scheduleFeatureEnabled:true,emotionConfig:{enabled:true},activeBuffs:[{emoji:'❤️'}]} as any,enabled:true,canInvite:true,onInitiative:clicked})));
 act(()=>vi.advanceTimersByTime(11000));expect(host.querySelector('img')?.getAttribute('src')).toContain('2764.svg');expect(clicked).not.toHaveBeenCalled();
 act(()=>vi.advanceTimersByTime(80000));expect(host.querySelector('button')).toBeTruthy();expect(clicked).not.toHaveBeenCalled();act(()=>host.querySelector('button')!.click());expect(clicked).toHaveBeenCalledOnce();act(()=>vi.advanceTimersByTime(1000));expect(host.querySelector('button')).toBeNull();present=false;act(()=>vi.advanceTimersByTime(500));expect(host.textContent).toBe('');
 }finally{act(()=>root.unmount());host.remove();vi.useRealTimers();}
});
it('keeps an invitation through other actions and panel changes until its close button is used',()=>{
 vi.useFakeTimers();vi.setSystemTime(1000000);const host=document.createElement('div');document.body.append(host);const root=createRoot(host),clicked=vi.fn();let busy=false,enabled=true,present=true;
 const records=[1,2,3].map(i=>({id:String(i),at:1000000,kind:'action',source:'local',actor:'character',text:'走动',roomId:'r',roomName:'客厅'}));
 const editor={getState:()=>({records,autonomy:true}),getHomeScene:()=>({roomId:'r',present,busy}),getCompanionSnapshot:()=>({ready:!busy,speechReady:!busy}),getResidentAnchor:()=>({x:190,y:330,width:390,height:844})};
 const render=()=>root.render(React.createElement(HomePresenceBubbles,{editor:editor as any,character:{id:'c',name:'Sully'} as any,enabled,canInvite:true,onInitiative:clicked}));
 try{act(render);act(()=>vi.advanceTimersByTime(91000));expect(host.querySelector('.home-presence-invite')).toBeTruthy();busy=true;enabled=false;act(render);act(()=>vi.advanceTimersByTime(10000));expect(host.querySelector('.home-presence-invite')).toBeTruthy();present=false;act(()=>vi.advanceTimersByTime(500));expect(host.textContent).toBe('');present=true;act(()=>vi.advanceTimersByTime(500));expect(host.querySelector('.home-presence-invite')).toBeTruthy();act(()=>host.querySelector<HTMLButtonElement>('.home-presence-dismiss')!.click());expect(clicked).not.toHaveBeenCalled();act(()=>vi.advanceTimersByTime(500));expect(host.querySelector('.home-presence-invite')).toBeNull();}finally{act(()=>root.unmount());host.remove();vi.useRealTimers();}
});

it('direct speech dispatches once without a click, and waits while busy',()=>{
 vi.useFakeTimers();vi.setSystemTime(1000000);const host=document.createElement('div'),root=createRoot(host),request=vi.fn();let busy=true;
 const records=[1,2,3].map(i=>({id:String(i),at:1000000,kind:'action',source:'local',actor:'character',text:'坐着看手机',roomId:'r',roomName:'客厅'}));
 const editor={getState:()=>({records,autonomy:false,directSpeech:true,speechFrequency:"often"}),getHomeScene:()=>({roomId:'r',present:true,busy}),getCompanionSnapshot:()=>({ready:!busy}),getResidentAnchor:()=>({x:190,y:330,width:390,height:844})};
 try{act(()=>root.render(React.createElement(HomePresenceBubbles,{editor:editor as any,character:{id:'c'} as any,enabled:true,canInvite:true,onInitiative:request})));act(()=>vi.advanceTimersByTime(121000));expect(request).not.toHaveBeenCalled();busy=false;act(()=>vi.advanceTimersByTime(500));expect(request).toHaveBeenCalledOnce();expect(request.mock.calls[0][0].automatic).toBe(true);act(()=>vi.advanceTimersByTime(1000));expect(request).toHaveBeenCalledOnce();}finally{act(()=>root.unmount());vi.useRealTimers();}
});

it('thinks of an actual household pet without requesting speech',()=>{
 vi.useFakeTimers();vi.setSystemTime(1000000);const host=document.createElement('div'),root=createRoot(host),request=vi.fn();const editor={getState:()=>({records:[],petLife:{pets:[{id:'pet',name:'团子'}]}}),getHomeScene:()=>({roomId:'r',present:true,busy:false}),getCompanionSnapshot:()=>({ready:true}),getResidentAnchor:()=>({x:190,y:330,width:390,height:844}),getPetPortrait:()=>'/pet-portrait.png'};
 try{act(()=>root.render(React.createElement(HomePresenceBubbles,{editor:editor as any,character:{id:'c'} as any,enabled:true,onInitiative:request})));act(()=>vi.advanceTimersByTime(27000));expect(host.querySelector('img')?.alt).toBe('团子');expect(host.querySelector('img')?.getAttribute('src')).toBe('/pet-portrait.png');expect(request).not.toHaveBeenCalled();}finally{act(()=>root.unmount());vi.useRealTimers();}
});
