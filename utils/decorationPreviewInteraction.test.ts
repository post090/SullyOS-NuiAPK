// @vitest-environment jsdom
import {expect,it,vi} from 'vitest';
import {bindDecorationPreview,type DecorationPreviewState} from './decorationPreviewInteraction';
import {renderChatDecorationSample} from '../components/chat/ChatDecorationSample';
import {CHAT_TYPE_SAMPLES} from './chatPreviewFixtures';
const preset={format:'sullyos-chat-decoration',version:1,name:'预览',parts:{css:''}};
function preview(scene:string){
 const body=document.createElement('div');let state:DecorationPreviewState={};let cleanup=()=>{};
 const render=()=>{cleanup();body.innerHTML=renderChatDecorationSample(preset,scene,undefined,state).markup;cleanup=bindDecorationPreview(body,state,false,next=>{state=next;render();});};render();
 return {body,get state(){return state;},click:(selector:string)=>(body.querySelector(selector) as HTMLElement).click(),close:()=>cleanup()};
}
it.each(['accepted','returned'] as const)('opens transfer details, then shows %s and a receipt without changing fixture data',status=>{
 const fetch=vi.spyOn(globalThis,'fetch').mockRejectedValue(Error('no network'));
 const original=JSON.stringify(CHAT_TYPE_SAMPLES.transfer);const p=preview('transfer');
 try{p.click('.sully-chat-transfer-card');expect(p.body.querySelector('.sully-chat-transfer-dialog')).not.toBeNull();p.click(status==='accepted'?'.sully-chat-transfer-accept':'.sully-chat-transfer-return');expect(p.body.querySelector('.sully-chat-transfer-dialog')).toBeNull();expect(p.body.querySelector('.sully-chat-transfer-card')?.getAttribute('data-status')).toBe(status);expect(p.body.querySelector('.sully-chat-transfer-receipt')?.getAttribute('data-status')).toBe(status);expect(JSON.stringify(CHAT_TYPE_SAMPLES.transfer)).toBe(original);expect(fetch).not.toHaveBeenCalled();}finally{fetch.mockRestore();p.close();}
});
it('toggles psyche with click and keyboard',()=>{const p=preview('psyche');try{p.click('.sully-psyche');expect(p.body.querySelector('.sully-psyche')?.getAttribute('aria-expanded')).toBe('true');p.body.querySelector('.sully-psyche')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));expect(p.body.querySelector('.sully-psyche')?.getAttribute('aria-expanded')).toBe('false');}finally{p.close();}});
it('opens and pages the real plus menu, Escape closes, and app actions remain inert',()=>{const p=preview('conversation');try{p.click('.sully-chat-actions-button');expect(p.state.panel).toBe(true);expect(p.body.querySelector('[aria-label="聊天功能第 1 页"]')).not.toBeNull();p.click('button[aria-label="第 2 页"]');expect(p.state.actionsPage).toBe(1);expect(p.body.querySelector('[aria-label="聊天功能第 2 页"]')?.className).not.toContain('hidden');const button=p.body.querySelector('[aria-label="聊天功能第 2 页"] button') as HTMLElement;expect(button.getAttribute('aria-disabled')).toBe('true');button.click();expect(p.state.actionsPage).toBe(1);p.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));expect(p.state.panel).toBe(false);}finally{p.close();}});
