import {beforeEach, expect, it} from 'vitest';
import {DB} from './db';
import {prepareHomeSecretTask, landHomeSecrets, readHomeSecrets, readSecretNotes, waitForHomeSecretOrigin} from './homeSecrets';
import {ChatPrompts} from './chatPrompts';
import {loadCharacterContextRange} from './chatContextRange';
import {isMessageSemanticallyRelevant, normalizeMessageContent} from './messageFormat';
import {isVisibleChatMessage} from './chatMessageVisibility';
import {prepareChatHistoryCleanup, deleteChatHistoryCleanup, CHAT_CLEANUP_CONFIRMATION} from './chatHistoryCleanup';
import {createReplyRun} from './chatReplyCancellation';
import {applyEmotionEvalRaw} from './emotionApply';
import type {SecretNoteOrigin} from './secretNote';
import type {HomeRecord} from '../apps/room3d/types';

const char:any={id:'secret-timeline',name:'阿澄',contextRangePolicyVersion:1,contextRangeMode:'adaptive',autoArchiveEnabled:true,
    home3D:{version:1,activeRoomId:'r',rooms:[{id:'r',name:'卧室',items:[]}]}};
const user:any={name:'用户'};
const history=[{role:'user',content:'你的衣服好看'},{role:'assistant',content:'谢谢'},{role:'user',content:'接着聊'}];
const text='你夸阿澄好看时，ta 偷偷确认了一遍衣领。';
const output=(id:string)=>({changed:false,homeSecretRequestId:id,homeSecrets:[{kind:'character',anchorId:id,petIds:[],text}]});
async function round():Promise<SecretNoteOrigin>{
    return {source:'chat',messageIds:[await DB.saveMessage({charId:char.id,role:'assistant',type:'text',content:'本轮第一句'}),
        await DB.saveMessage({charId:char.id,role:'assistant',type:'text',content:'本轮第二句'})]};
}
async function saved(origin:SecretNoteOrigin){
    const task=(await prepareHomeSecretTask(char,history,()=>0))!;
    await landHomeSecrets(char.id,output(task.id),task.id,undefined,origin);
    return task;
}
beforeEach(async()=>{localStorage.clear();await DB.deleteDB();await DB.saveCharacter(char);});

it('stores one semantic row hidden from normal chat; history and extraction see the same text and waterline removes it',async()=>{
    const origin=await round();await saved(origin);
    const notes=await readSecretNotes(char.id);expect(notes).toHaveLength(1);
    const note=notes[0];expect(note.metadata.sourceMessageIds).toEqual(origin.messageIds);
    expect(isMessageSemanticallyRelevant(note)).toBe(true);
    expect(isVisibleChatMessage(note,true)).toBe(false);
    expect(isVisibleChatMessage(note,false)).toBe(false);
    expect(normalizeMessageContent(note,char.name,user.name)).toContain(text);
    let range=await loadCharacterContextRange(char);
    expect(range.messages).toHaveLength(3);
    expect(JSON.stringify(ChatPrompts.buildMessageHistory(range.messages,3,char,user,[],undefined,{contextHighWaterMark:0}).apiMessages)).toContain(text);
    localStorage.setItem('mp_lastMsgId_'+char.id,String(note.id));
    range=await loadCharacterContextRange(char);
    expect(range.messages).toEqual([]);
    expect(JSON.stringify(ChatPrompts.buildMessageHistory(notes,3,char,user,[]).apiMessages)).not.toContain(text);
});

it.each(['single','batch','cleanup'] as const)('deleting one bubble with %s removes the entire linked note, and replay cannot resurrect it',async mode=>{
    const origin=await round();const task=await saved(origin);
    const note=(await readSecretNotes(char.id))[0];
    if(mode==='single')await DB.deleteMessage(origin.messageIds[0]);
    if(mode==='batch')await DB.deleteMessages([origin.messageIds[0]]);
    if(mode==='cleanup'){
        const plan=await prepareChatHistoryCleanup(char.id,{fromId:origin.messageIds[0],toId:origin.messageIds[0]});
        await deleteChatHistoryCleanup(plan,{reviewed:true,text:CHAT_CLEANUP_CONFIRMATION});
    }
    expect(await DB.getMessageById(note.id)).toBeNull();
    expect(await readHomeSecrets(char.id)).toEqual([]);
    await landHomeSecrets(char.id,output(task.id),task.id,undefined,origin);
    expect(await readSecretNotes(char.id)).toEqual([]);
    expect(await DB.getMessageById(origin.messageIds[1])).not.toBeNull();
});

it('full-range cleanup containing the note validates everything before cascading',async()=>{
    const origin=await round();await saved(origin);const note=(await readSecretNotes(char.id))[0];
    const plan=await prepareChatHistoryCleanup(char.id,{fromId:origin.messageIds[0],toId:note.id});
    expect(await deleteChatHistoryCleanup(plan,{reviewed:true,text:CHAT_CLEANUP_CONFIRMATION})).toBe(3);
    expect(await DB.getRecentMessagesByCharId(char.id,10)).toEqual([]);
});

it('drops a late result if any round bubble is already missing, without matching another identical message',async()=>{
    const origin=await round();const task=(await prepareHomeSecretTask(char,history,()=>0))!;
    await DB.deleteMessage(origin.messageIds[0]);
    await DB.saveMessage({charId:char.id,role:'assistant',type:'text',content:'本轮第一句'});
    await expect(landHomeSecrets(char.id,output(task.id),task.id,undefined,origin)).rejects.toThrow('来源不完整');
    expect(await readSecretNotes(char.id)).toEqual([]);
});

it('rejects unowned/cross-character sources and ignores old in-flight requests without backfilling',async()=>{
    const task=(await prepareHomeSecretTask(char,history,()=>0))!;
    await expect(landHomeSecrets(char.id,output(task.id),task.id)).rejects.toThrow('来源不完整');
    const other=await DB.saveMessage({charId:'other',role:'assistant',type:'text',content:'其他角色'});
    await expect(landHomeSecrets(char.id,output(task.id),task.id,undefined,{source:'chat',messageIds:[other]})).rejects.toThrow('来源不完整');
    const key='home_secrets_v1_'+char.id;const state=JSON.parse((await DB.getAsset(key))!);
    delete state.requests[0].historyNoteVersion;await DB.saveAsset(key,JSON.stringify(state));
    await landHomeSecrets(char.id,output(task.id),task.id,undefined,await round());
    expect(await readSecretNotes(char.id)).toEqual([]);
});

it('does not save a separate memory even if an old model returns that extra field',async()=>{
    const origin=await round();const task=(await prepareHomeSecretTask(char,history,()=>0))!;
    expect(task.prompt).not.toContain('- memory：');
    const result=output(task.id);(result.homeSecrets[0] as any).memory='不该隐藏保存的第二份文字';
    await landHomeSecrets(char.id,result,task.id,undefined,origin);
    expect(await DB.getAsset('home_secrets_v1_'+char.id)).not.toContain('不该隐藏保存');
    expect(JSON.stringify(await readSecretNotes(char.id))).not.toContain('memory');
});

it('home projection edits/deletion remove the note and undoing the record does not restore it',async()=>{
    const input:HomeRecord={id:'input',at:1,kind:'message',source:'user',actor:'user',text:'你好',roomId:'r',roomName:'卧室'};
    const reply:HomeRecord={...input,id:'reply',at:2,source:'model',actor:'character',text:'你好呀',replyTo:input.id};
    const c={...char,home3D:{...char.home3D,records:[input,reply]}};
    await DB.saveCharacter(c);
    const origin=await waitForHomeSecretOrigin(char.id,[input,reply],new AbortController().signal);expect(origin).toBeDefined();
    await saved(origin!);expect((await readSecretNotes(char.id))[0].metadata.source).toBe('home');
    const live=(await DB.getCharacter(char.id))!;
    await DB.saveCharacter({...live,home3D:{...live.home3D!,records:[input]}});
    expect(await readSecretNotes(char.id)).toEqual([]);
    await DB.saveCharacter(c);
    expect(await readSecretNotes(char.id)).toEqual([]);
});

it('a stopped/failed reply never supplies source IDs for secret landing',async()=>{
    const stopped=createReplyRun(char.id);await stopped.saveMessage({charId:char.id,role:'assistant',type:'text',content:'半句话'});
    stopped.stop();await stopped.settle();expect(await stopped.secretSourceIds).toEqual([]);
    const successful=createReplyRun(char.id);const id=await successful.saveMessage({charId:char.id,role:'assistant',type:'text',content:'成功'});
    successful.markCompleted();await successful.settle();expect(await successful.secretSourceIds).toEqual([id]);
});

it('changed emotion cannot overwrite a home reply saved after evaluation started or erase its secret',async()=>{
    const stale={...char};
    const input:HomeRecord={id:'u',at:1,kind:'message',source:'user',actor:'user',text:'你好',roomId:'r',roomName:'卧室'};
    const reply:HomeRecord={...input,id:'a',at:2,source:'model',actor:'character',text:'你好呀',replyTo:'u'};
    await DB.saveCharacter({...char,home3D:{...char.home3D,records:[input,reply]}});
    const origin=(await waitForHomeSecretOrigin(char.id,[input,reply],new AbortController().signal))!;
    const task=(await prepareHomeSecretTask(char,history,()=>0))!;
    await applyEmotionEvalRaw(JSON.stringify({...output(task.id),changed:true,buffs:[],injection:'新情绪'}),stale,task.id,origin);
    expect((await DB.getCharacter(char.id))?.home3D?.records?.map(r=>r.id)).toEqual(['u','a']);
    expect(await readSecretNotes(char.id)).toHaveLength(1);
});
