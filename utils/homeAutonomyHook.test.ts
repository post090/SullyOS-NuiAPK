// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {useHomeSchedule} from '../apps/room3d/useHomeSchedule';
const mocks=vi.hoisted(()=>({read:vi.fn(),position:vi.fn()}));
vi.mock('./dailySchedule',()=>({getDailyScheduleForChar:mocks.read}));
vi.mock('./homePresence',()=>({homePresence:mocks.position}));
vi.mock('./scheduleTime',()=>({getCurrentScheduleSlotIndex:()=>0}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
let root:ReturnType<typeof createRoot>,host:HTMLDivElement;
let enabled=true,busy=false;
const editor={finishAutonomousAction:vi.fn(),setScheduleLabel:vi.fn(),setResidentRoom:vi.fn(),getState:()=>({autonomy:enabled}),getHomeScene:()=>({present:true,roomId:'r',busy,actions:[{id:'bed',kind:'sleep'}]}),performHomeAction:vi.fn(()=> 'started')};
function Harness({suspended=false,on=true}:{suspended?:boolean;on?:boolean}){const {away,currentSchedule}=useHomeSchedule(editor as any,{id:'c',scheduleFeatureEnabled:on} as any,true,suspended);return React.createElement('output',{'data-schedule':currentSchedule?`${currentSchedule.startTime} ${currentSchedule.activity}`:''},String(away));}
beforeEach(()=>{vi.useFakeTimers();enabled=true;busy=false;vi.clearAllMocks();mocks.read.mockResolvedValue({date:'2026-10-03',slots:[{startTime:'00:00',activity:'休息'}]});mocks.position.mockReturnValue({kind:'home',roomId:'r'});host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.useRealTimers();});
async function render(props={}){await act(async()=>{root.render(React.createElement(Harness,props));});}
it('waits for manual activity and runs once per schedule slot',async()=>{busy=true;await render();expect(editor.performHomeAction).not.toHaveBeenCalled();busy=false;await act(async()=>vi.advanceTimersByTime(15000));expect(editor.performHomeAction).toHaveBeenCalledWith('bed','local');await act(async()=>vi.advanceTimersByTime(90000));expect(editor.performHomeAction).toHaveBeenCalledOnce();});
it('honors autonomy and suspension switches',async()=>{enabled=false;await render();expect(editor.performHomeAction).not.toHaveBeenCalled();enabled=true;await render({suspended:true});await act(async()=>vi.advanceTimersByTime(15000));expect(editor.performHomeAction).not.toHaveBeenCalled();await render();expect(editor.performHomeAction).toHaveBeenCalledOnce();});
it('hides an away resident and never starts a home activity',async()=>{mocks.position.mockReturnValue({kind:'away'});await render();expect(editor.setResidentRoom).toHaveBeenCalledWith(null,true);expect(host.textContent).toBe('true');expect(editor.performHomeAction).not.toHaveBeenCalled();});
it('disabled schedules do not query daily schedules or invent activity',async()=>{await render({on:false});expect(mocks.read).not.toHaveBeenCalled();expect(editor.setResidentRoom).toHaveBeenCalledWith(undefined,true);expect(editor.performHomeAction).not.toHaveBeenCalled();expect(host.querySelector('output')?.dataset.schedule).toBe('');});

it('exposes the current activity and clears it when no slot exists',async()=>{await render();expect(host.querySelector('output')?.dataset.schedule).toBe('00:00 休息');mocks.read.mockResolvedValue({date:'2026-10-03',slots:[]});await act(async()=>vi.advanceTimersByTime(60000));expect(host.querySelector('output')?.dataset.schedule).toBe('');});

it('ends the previous autonomous activity when the next schedule slot starts',async()=>{await render();editor.finishAutonomousAction.mockClear();mocks.read.mockResolvedValue({date:'2026-10-03',slots:[{startTime:'01:00',activity:'休息'}]});await act(async()=>vi.advanceTimersByTime(60000));expect(editor.finishAutonomousAction).toHaveBeenCalledOnce();expect(editor.performHomeAction).toHaveBeenCalledTimes(2);});
