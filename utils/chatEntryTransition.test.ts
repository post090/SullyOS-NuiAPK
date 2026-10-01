// @vitest-environment jsdom
import React,{act,useState,useLayoutEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {it,expect,vi} from 'vitest';
import CharacterEntryTransition from '../components/chat/CharacterEntryTransition';
import MemoryContextSelfCheck from '../components/chat/MemoryContextSelfCheck';
vi.mock('./blobRef',()=>({useBlobRefUrl:()=>undefined}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
// Use Chat's actual keys: a lifecycle-only test with invented keys misses this regression.
const source=ts.createSourceFile('Chat.tsx',readFileSync('apps/Chat.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const keys=new Map<string,ts.Expression>();
function visit(node:ts.Node){
 if(ts.isJsxSelfClosingElement(node)){
  const key=node.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.getText(source)==='key');
  if(key&&ts.isJsxAttribute(key)&&key.initializer&&ts.isJsxExpression(key.initializer)&&key.initializer.expression)keys.set(node.tagName.getText(source),key.initializer.expression);
 }
 ts.forEachChild(node,visit);
}
visit(source);
const value=(expr:ts.Expression,id:string):string=>{
 if(ts.isIdentifier(expr)&&expr.text==='activeCharacterId'||ts.isPropertyAccessExpression(expr)&&expr.getText(source)==='char.id')return id;
 if(ts.isTemplateExpression(expr))return expr.head.text+expr.templateSpans.map(span=>value(span.expression,id)+span.literal.text).join('');
 throw Error('Unrecognized chat key: '+expr.getText(source));
};
const key=(name:string,id:string)=>value(keys.get(name)!,id);
it('keeps character-scoped sibling overlays distinct in Chat',()=>{
 const names=['CharacterEntryTransition','ChatAppearanceWardrobe','ChatHistoryCleanupModal','MemoryContextSelfCheck'];
 for(const id of ['preset-sully-v2','another-role'])expect(new Set(names.map(name=>key(name,id))).size).toBe(names.length);
});
it('removes the entry veil with a persistent self-check sibling after rerenders and character changes',()=>{
 vi.useFakeTimers();const host=document.createElement('div');const root=createRoot(host);
 const errors=vi.spyOn(console,'error').mockImplementation(()=>{});
 function ChatLayers({id}:{id:string}){
  const [show,setShow]=useState(true);useLayoutEffect(()=>setShow(true),[id]);
  return React.createElement('div',null,
   show&&React.createElement(CharacterEntryTransition,{key:key('CharacterEntryTransition',id),name:id,onDone:()=>setShow(false)}),
   React.createElement(MemoryContextSelfCheck,{key:key('MemoryContextSelfCheck',id),character:{id,name:id,memoryPalaceEnabled:false} as any,active:true,onDisable:()=>{}}));
 }
 try{
  for(const id of ['preset-sully-v2','another-role','preset-sully-v2']){
   act(()=>root.render(React.createElement(ChatLayers,{id})));
   act(()=>root.render(React.createElement(ChatLayers,{id})));
   expect(host.querySelectorAll('[aria-hidden]')).toHaveLength(1);
   act(()=>vi.advanceTimersByTime(1600));
   expect(host.querySelectorAll('[aria-hidden]')).toHaveLength(0);
  }
  expect(errors.mock.calls.filter(args=>String(args[0]).includes('same key'))).toHaveLength(0);
 }finally{act(()=>root.unmount());errors.mockRestore();vi.useRealTimers();}
});
