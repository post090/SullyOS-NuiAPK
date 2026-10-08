import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
// @ts-expect-error jsdom is installed for tests without its separate declaration package.
import {JSDOM} from 'jsdom';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const source=readFileSync(new URL('../public/startup-recovery.js',import.meta.url),'utf8');
let dom:JSDOM;
beforeEach(()=>vi.useFakeTimers());
afterEach(()=>{dom?.window.close();vi.useRealTimers();});
function boot(manual=false,serviceWorker?:any){
 dom=new JSDOM('<!doctype html><head></head><body><div id="root"></div></body>',{url:'https://app.invalid/SullyOS/'+(manual?'recover.html':'?private=secret')});
 const {window}=dom,document=window.document;
 const script=document.createElement('script');script.setAttribute('data-base','./');script.setAttribute('data-build','test-build');
 if(manual)script.setAttribute('data-mode','recovery');
 Object.defineProperty(document,'currentScript',{get:()=>script});
 const location={origin:window.location.origin,pathname:window.location.pathname,reload:vi.fn(),replace:vi.fn()};
 const navigator={serviceWorker,onLine:true,userAgent:'Test browser'};
 runInNewContext(source,{window,document,navigator,location,URL,MutationObserver:window.MutationObserver,setTimeout,clearTimeout,setInterval,clearInterval});
 document.dispatchEvent(new window.Event('DOMContentLoaded'));
 return {window,document,location,navigator};
}
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
const click=(d:Document,label:string)=>{const button=[...d.querySelectorAll('button')].find(b=>b.textContent===label)!;expect(button).toBeTruthy();button.click();};
describe('startup recovery independent of application modules',()=>{
 it('shows module-evaluation errors even when React never loads, without query strings',()=>{
  const {window,document}=boot();
  window.dispatchEvent(new window.ErrorEvent('error',{message:'createBlobStore: prefix must be a non-empty string',filename:'https://app.invalid/assets/vendor.js?private=secret',lineno:40}));
  vi.advanceTimersByTime(1);
  expect(document.querySelector('h1')?.textContent).toBe('启动遇到问题');
  expect(document.querySelector('textarea')?.value).toContain('createBlobStore');
  expect(document.querySelector('textarea')?.value).not.toContain('private=secret');
 });
 it('offers recovery for a stalled startup, then disappears if the app finishes loading',async()=>{
  const {document}=boot();vi.advanceTimersByTime(11999);expect(document.querySelector('section')).toBeNull();
  vi.advanceTimersByTime(1);expect(document.querySelector('h1')?.textContent).toBe('启动尚未完成');
  document.getElementById('root')!.appendChild(document.createElement('main'));await flush();
  expect(document.querySelector('section')).toBeNull();
 });
 it('does not cover a healthy app or reload it for unrelated async errors',()=>{
  const {window,document,location}=boot();document.getElementById('root')!.innerHTML='<main>用户正在聊天</main>';
  window.dispatchEvent(new window.ErrorEvent('error',{message:'optional feature failed'}));vi.advanceTimersByTime(15000);
  expect(document.querySelector('section')).toBeNull();expect(location.reload).not.toHaveBeenCalled();
 });
 it('reuses the scoped registration, activates a waiting update and navigates only once controlled',async()=>{
  const container=new EventTarget() as any,waiting={state:'installed',postMessage:vi.fn()};
  const registration={scope:'https://app.invalid/SullyOS/',waiting,update:vi.fn().mockResolvedValue(undefined),unregister:vi.fn()};
  container.getRegistration=vi.fn().mockResolvedValue(registration);container.register=vi.fn();
  const {document,location}=boot(true,container);click(document,'检查更新并重试');await flush();
  expect(registration.update).toHaveBeenCalledOnce();expect(container.register).not.toHaveBeenCalled();expect(registration.unregister).not.toHaveBeenCalled();
  expect(waiting.postMessage).toHaveBeenCalledWith({type:'SULLY_ACTIVATE_UPDATE'});expect(location.replace).not.toHaveBeenCalled();
  container.controller=waiting;container.dispatchEvent(new Event('controllerchange'));
  expect(location.replace).toHaveBeenCalledOnce();expect(location.replace).toHaveBeenCalledWith('https://app.invalid/SullyOS/');
 });
 it('shows a bounded failure when offline instead of a reload loop or deleting data',async()=>{
  const container=new EventTarget() as any;container.getRegistration=vi.fn().mockRejectedValue(Error('offline'));
  const {document,location}=boot(true,container);click(document,'检查更新并重试');await flush();
  expect(document.body.textContent).toContain('更新尚未完成');expect(location.replace).not.toHaveBeenCalled();
  expect(document.querySelector('button')?.disabled).toBe(false);
 });
 it('leaves slow installation retryable after the timeout',async()=>{
  const container=new EventTarget() as any;
  container.getRegistration=vi.fn().mockResolvedValue({scope:'https://app.invalid/SullyOS/',installing:{},update:vi.fn().mockResolvedValue(undefined)});
  const {document,location}=boot(true,container);click(document,'检查更新并重试');await flush();vi.advanceTimersByTime(120000);
  expect(document.body.textContent).toContain('更新尚未完成');expect(location.replace).not.toHaveBeenCalled();expect(document.querySelector('button')?.disabled).toBe(false);
 });
 it('cancels a pending recovery if the main app becomes usable',async()=>{
  const container=new EventTarget() as any,waiting={postMessage:vi.fn()};
  container.getRegistration=vi.fn().mockResolvedValue({scope:'https://app.invalid/SullyOS/',waiting,update:vi.fn().mockResolvedValue(undefined)});
  const {window,document,location}=boot(false,container);
  window.dispatchEvent(new window.ErrorEvent('error',{message:'temporary error'}));vi.advanceTimersByTime(1);
  click(document,'检查更新并重试');await flush();document.getElementById('root')!.innerHTML='<main>聊天</main>';await flush();
  container.controller=waiting;container.dispatchEvent(new Event('controllerchange'));
  expect(document.querySelector('section')).toBeNull();expect(location.reload).not.toHaveBeenCalled();
 });
});
