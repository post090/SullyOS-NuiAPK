import type {CharacterProfile, APIConfig} from '../types';
import {DB} from './db';
import {homeRecords} from './homeRecords';
import {homeSegmentMessages as homeTurnMessages} from './homeContextSegments';
import {processNewMessagesWithAutoArchive} from './memoryPalace/autoArchive';
import {incrementDigestRound,runCognitiveDigestion} from './memoryPalace/digestion';
import type {EmbeddingConfig} from './memoryPalace/types';
import type {LightLLMConfig} from './memoryPalace/pipeline';

const seen=new Set<string>();
const chains=new Map<string,Promise<void>>();
/** Called only after the journal and its shared message projection have committed. */
export function processHomeMemoryAfterSave(before:CharacterProfile|undefined,after:CharacterProfile,config:{embedding?:EmbeddingConfig;lightLLM?:LightLLMConfig},api:APIConfig,userName:string):Promise<void>{
 if(before?.home3D?.records===after.home3D?.records)return Promise.resolve();
 const previous=homeRecords(before?.home3D),records=homeRecords(after.home3D);
 const oldIds=new Set(previous.map(r=>r.id));
 const replies=records.filter(r=>!oldIds.has(r.id)&&r.kind==='message'&&r.actor==='character'&&r.source==='model');
 const oldTurns=new Set(homeTurnMessages(after.id,previous).map(r=>r.metadata.homeTurnId));
 const turns=homeTurnMessages(after.id,records).filter(r=>!oldTurns.has(r.metadata.homeTurnId));
 const keys=[...turns.map(r=>'turn:'+r.metadata.homeTurnId),...replies.map(r=>'reply:'+r.id)].map(k=>after.id+':'+k);
 if(!keys.length||keys.every(k=>seen.has(k)))return Promise.resolve();
 const freshReplies=replies.filter(r=>!seen.has(after.id+':reply:'+r.id));
 for(const k of keys)seen.add(k);
 while(seen.size>2000)seen.delete(seen.values().next().value!);
 const task=(chains.get(after.id)||Promise.resolve()).catch(()=>{}).then(async()=>{
  const live=await DB.getCharacter(after.id),emb=config.embedding;
  const llm=config.lightLLM?.baseUrl?config.lightLLM:api;
  if(!live?.memoryPalaceEnabled||!emb?.baseUrl||!emb.apiKey||!llm.baseUrl)return;
  // The shared pipeline reads the full persisted timeline and the character's own waterline.
  await processNewMessagesWithAutoArchive([],live.id,live.name,emb,llm,userName,false);
  for(const _reply of freshReplies){
   const latest=await DB.getCharacter(live.id);
   if(!latest?.memoryPalaceEnabled)return;
   if(incrementDigestRound(live.id))await runCognitiveDigestion(live.id,latest.name,[latest.systemPrompt,latest.worldview].filter(Boolean).join('\n'),llm,false,userName,emb);
  }
 });
 chains.set(after.id,task);
 void task.finally(()=>{if(chains.get(after.id)===task)chains.delete(after.id);}).catch(()=>{});
 return task;
}
