import {createLocalId} from './localId.js';
import type {Home3DState,HomeRecord} from '../apps/room3d/types';
export function homeRecords(home?:Home3DState):HomeRecord[]{
 if(Array.isArray(home?.records))return home.records.filter(isHomeRecord);
 return (home?.activityLog??[]).filter(e=>e&&Number.isFinite(e.at)&&Math.abs(e.at)<8.64e15&&typeof e.label==='string'&&typeof e.roomName==='string').map((e,index)=>({id:`legacy-${e.at}-${index}`,at:e.at,kind:'action',source:'user',actor:'character',text:`开始${e.label}`,roomId:e.roomId,roomName:e.roomName}));
}
export function isHomeRecord(e:unknown):e is HomeRecord{
 const v=e as HomeRecord;
 return !!v&&typeof v.id==='string'&&Number.isFinite(v.at)&&Math.abs(v.at)<8.64e15&&['message','action','presence'].includes(v.kind)&&['user','local','model'].includes(v.source)&&['user','character'].includes(v.actor)&&typeof v.text==='string'&&typeof v.roomId==='string'&&typeof v.roomName==='string';
}
export function makeHomeRecord(input:Omit<HomeRecord,'id'|'at'>):HomeRecord{return {...input,id:createLocalId(),at:Date.now()};}
export function editHomeRecord(records:HomeRecord[],id:string,text:string):HomeRecord[]{return records.map(e=>e.id===id?{...e,text:text.trim().slice(0,8000),editedAt:Date.now()}:e);}
export function homeReplyHistory(records:HomeRecord[],replyId?:string):HomeRecord[]{
 const end=replyId?records.findIndex(e=>e.id===replyId):-1;
 return end>=0?records.slice(0,end):records;
}
