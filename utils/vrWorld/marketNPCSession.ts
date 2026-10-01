import type {APIConfig} from '../../types';
import {safeFetchJson,extractContent} from '../safeApi';
import {getVRApi,logVRApiCall} from './vrApi';
import {mutateFishingMarket,readFishingMarketState} from './fishingMarket';
import {sarNpcContentEnabled} from './sarNpcPreference';
import {applyMarketNPCs,MARKET_NPC_SYSTEM,parseMarketNPCs,prepareMarketNPCs} from './marketNPCs';
export class MarketNPCReplyError extends Error {
 constructor(message:string, public readonly responseText?:string){super(message);this.name='MarketNPCReplyError';}
}
let running=false;
/** One foreground request for the entire crowd, no background timer or per-NPC model loop. */
export async function runMarketNPCSession(chatApi?:APIConfig,signal?:AbortSignal){
 if(running)throw Error('路人正在来访，请等这一轮结束。');
 const run=async()=>{
  const check=()=>{if(signal?.aborted)throw Error('已离开布告板，本轮停止。');if(!sarNpcContentEnabled())throw Error('已关闭彼方 NPC，路人来访已停止。');};
  check();const vrApi=await getVRApi(),api=vrApi?.baseUrl?vrApi:chatApi;
  if(!api?.baseUrl||!api.model)throw Error('请先在彼方「API」或聊天默认 API 中配置模型，路人来访需要一次模型调用。');
  check();const snapshot=prepareMarketNPCs(readFishingMarketState()),baseUrl=api.baseUrl.replace(/\/+$/,''),start=Date.now();
  let responseText:string|undefined;
  let result:ReturnType<typeof applyMarketNPCs>|undefined;
  try{
   const data=await safeFetchJson(baseUrl+'/chat/completions',{
    method:'POST',signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+(api.apiKey||'sk-none')},
    body:JSON.stringify({model:api.model,temperature:.95,stream:false,messages:[{role:'system',content:MARKET_NPC_SYSTEM},{role:'user',content:snapshot.prompt}]}),
   },0,0,{appName:'彼方',purpose:'布告板路人来访'});
   check();
   responseText=JSON.stringify({content:data.choices?.[0]?.message?.content ?? null,finish_reason:data.choices?.[0]?.finish_reason ?? null,usage:data.usage ?? null},null,2);
   if(data.choices?.[0]?.finish_reason === 'length') throw Error('路人回复被输出长度限制截断，这轮没有写入便笺。请提高 API 输出上限后重试。');
   const content=extractContent(data);
   if(!content.trim())throw Error('模型没有返回路人发言，这轮没有写入便笺。');
   const actions=parseMarketNPCs(content,snapshot);
   await mutateFishingMarket(current=>{check();result=applyMarketNPCs(current,snapshot,actions);return result.state;});
   await logVRApiCall({ts:start,room:'sar',charName:'布告板路人（整轮）',model:api.model,baseUrl,ok:true,ms:Date.now()-start});
  }catch(e){await logVRApiCall({ts:start,room:'sar',charName:'布告板路人（整轮）',model:api.model,baseUrl,ok:false,ms:Date.now()-start,error:(e instanceof Error?e.message:'调用失败').slice(0,160)});throw new MarketNPCReplyError(e instanceof Error?e.message:String(e),responseText); }
  return result!;
 };
 running=true;
 try{
  if(typeof navigator!=='undefined'&&navigator.locks)return await navigator.locks.request('vr-market-npc-generation',{ifAvailable:true},async lock=>{if(!lock)throw Error('另一页正在生成路人来访，请稍后再看。');return run();});
  return await run();
 }finally{running=false;}
}
