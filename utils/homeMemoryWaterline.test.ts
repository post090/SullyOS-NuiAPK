import {it,expect,vi} from 'vitest';
import {DB} from './db';
import {processNewMessages} from './memoryPalace/pipeline';
import {homeTurnMessages} from './homeTurns';
it('home turns share the real palace threshold; only reaching 20+10 starts processing',async()=>{
 const char:any={id:'home-threshold',name:'C',memoryPalaceEnabled:true,memoryPalaceWaterline:{preset:'custom',hotZoneSize:20,bufferThreshold:10}};
 await DB.saveCharacter(char);
 for(let i=0;i<29;i++)await DB.saveMessage(homeTurnMessages(char.id,[{id:'u'+i,turnId:'t'+i,at:i+1,actor:'user',kind:'message',source:'user',text:'这是第'+i+'轮家园对话',roomId:'r',roomName:'客厅'}])[0]);
 const emb:any={baseUrl:'test',apiKey:'test',model:'test'},llm:any={baseUrl:'test',apiKey:'test',model:'test'};
 const before=await processNewMessages([],char.id,char.name,emb,llm);
 expect(before?.skipReason).toBe('threshold');
 await DB.saveMessage(homeTurnMessages(char.id,[{id:'last',at:31,actor:'user',kind:'message',source:'user',text:'第三十轮',roomId:'r',roomName:'客厅'}])[0]);
 // Stop at the real processing boundary: this test must not call external APIs.
 const progress=vi.fn(()=>{throw Error('test: stop before network');});
 await processNewMessages([],char.id,char.name,emb,llm,'U',false,progress);
 expect(progress).toHaveBeenCalledWith('正在整理 9 条对话...');
 expect(localStorage.getItem('mp_lastMsgId_'+char.id)).toBeNull();
});
