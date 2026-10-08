// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import ChatBroadcast from '../components/ChatBroadcast';
import {announceChatGen,CHAT_GEN_EVENTS} from './chatGenEvents';
vi.mock('./amsgInstantChat',()=>({AMSG_INSTANT_CHAT_PENDING_EVENT:'test-pending',listInstantChatPendings:()=>[]}));
it('shows concurrent emotion work before the reply finishes, and keeps it visible afterwards',()=>{
 const host=document.createElement('div'),root=createRoot(host),detail={charId:'parallel-test',charName:'小栗'};
 try{
  act(()=>root.render(React.createElement(ChatBroadcast)));
  act(()=>announceChatGen(CHAT_GEN_EVENTS.replyStart,detail));
  expect(host.textContent).toContain('正在回应');
  act(()=>announceChatGen(CHAT_GEN_EVENTS.emotionStart,detail));
  expect(host.textContent).toContain('正在回应 · 情绪评估中');
  act(()=>announceChatGen(CHAT_GEN_EVENTS.replyEnd,detail));
  expect(host.textContent).toContain('正在感受');
  act(()=>announceChatGen(CHAT_GEN_EVENTS.emotionEnd,detail));
  expect(host.textContent).toBe('');
 }finally{act(()=>root.unmount());}
});
