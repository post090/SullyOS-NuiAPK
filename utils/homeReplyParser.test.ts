import {describe,it,expect} from 'vitest';
import {parseHomeReply} from './homeReplyParser';
import type {HomeScene} from '../apps/room3d/types';
const scene:HomeScene={roomId:'r',roomName:'书房',present:true,busy:false,activity:'坐着',actions:[
 {id:'real-chair-a',kind:'sit',label:'坐下',target:'椅子',roomId:'r'},
 {id:'real-chair-b',kind:'sit',label:'坐下',target:'椅子',roomId:'r'},
]};
describe('home reply output tolerance',()=>{
 it('keeps the order and repeated steps of an explicit multi-action plan',()=>{
  expect(parseHomeReply('{"text":"先坐下，再换个位置","actionIds":[1,"2",1]}',scene)).toEqual({text:'先坐下，再换个位置',actionIds:['real-chair-a','real-chair-b','real-chair-a']});
 });
 it('rejects invalid middle steps instead of silently changing a plan',()=>{
  expect(()=>parseHomeReply('{"text":"好","actionIds":[1,99,2]}',scene)).toThrow('无效编号');
  expect(()=>parseHomeReply(JSON.stringify({text:'好',actionIds:Array(9).fill(1)}),scene)).toThrow('过长');
  expect(parseHomeReply('{"text":"好","actionIds":[1,2]}',{...scene,present:false}).actionIds).toEqual([]);
 });
 it('accepts an explicit unique action label but never guesses an ambiguous bed',()=>{
  const bed={id:'bed-b',kind:'sleep',label:'上床休息',target:'床',roomId:'r'};
  const raw=JSON.stringify({text:'这就躺下',actionId:'上床休息'});
  expect(parseHomeReply(raw,{...scene,actions:[bed]}).actionId).toBe('bed-b');
  expect(parseHomeReply(raw,{...scene,actions:[bed,{...bed,id:'bed-a'}]}).actionId).toBeUndefined();
 });
 it.each([
  '{"text":"来啦","actionId":2}',
  '```json\n{"text":"来啦","actionId":" 2 "}\n```',
  '好的，回复如下：\n{"text":"来啦","actionId":2}\n以上是回复。',
  '<THINK>不应展示</THINK>{"text":"来啦","actionId":2,}',
 ])('extracts the intended reply and exact numbered target: %s',raw=>{
  expect(parseHomeReply(raw,scene)).toEqual({text:'来啦',actionId:'real-chair-b'});
 });
 it('preserves quotes, braces and comma-like content in speech',()=>{
  const text='他说："你好"，这是 {样例,}。\n下一行';
  expect(parseHomeReply('回复：'+JSON.stringify({text,actionId:1}),scene)).toEqual({text,actionId:'real-chair-a'});
 });
 it.each([null,true,{},[],0,-1,1.5,3,1e30,'2号','坐下','1,2','02'])('keeps speech but ignores invalid action %j',id=>{
  expect(parseHomeReply(JSON.stringify({text:'你好',actionId:id}),scene)).toEqual({text:'你好',actionId:undefined});
 });
 it.each(['{"text":"未结束','<think>只有思考','{"text":"甲","actionId":1}{"text":"乙","actionId":2}','[{"text":"你好","actionId":1}]'])('rejects incomplete or ambiguous structure: %s',raw=>{
  expect(()=>parseHomeReply(raw,scene)).toThrow();
 });
 it('plain prose never triggers an action; absent residents cannot act',()=>{
  expect(parseHomeReply('我选 2，来坐一会儿。',scene)).toEqual({text:'我选 2，来坐一会儿。'});
  expect(parseHomeReply('{"text":"来啦","actionId":1}',{...scene,present:false}).actionId).toBeUndefined();
 });
 it('resolves each response only against its own request order',()=>{
  const raw='{"text":"来啦","actionId":1}';
  expect(parseHomeReply(raw,scene).actionId).toBe('real-chair-a');
  expect(parseHomeReply(raw,{...scene,actions:[...scene.actions].reverse()}).actionId).toBe('real-chair-b');
 });
});
