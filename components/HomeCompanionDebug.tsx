import React,{useEffect,useState} from 'react';
import {readHomeCompanionDebug} from '../utils/homeCompanionDebug';
const names:Record<string,string>={look:'看向用户',react:'互动回应',approach:'靠近',follow:'跟随',sit:'坐下',idle:'环顾',wander:'短途走动',phone:'看手机',furniture:'家具交互',stand:'起身',pet:'陪伴宠物'};
export default function HomeCompanionDebug(){
 const [,update]=useState(0);
 useEffect(()=>{const timer=setInterval(()=>update(n=>n+1),1000);return()=>clearInterval(timer);},[]);
 const d=readHomeCompanionDebug(),now=Date.now(),s=d?.snapshot;
 return <details className="border-b border-white/10 py-3" open><summary className="cursor-pointer text-xs font-bold text-amber-200">家园自主行为</summary>
 {!d?<p className="mt-2 text-xs text-white/50">尚无数据，进入角色家园后开始观察。</p>:<div className="mt-2 space-y-2 text-xs leading-relaxed">
 <div className="font-bold">{d.name} · {d.active?'观察中':'已停止'}</div>
 <div role="status">{d.status}</div>
 <div className="text-white/60">{Math.floor((now-d.updatedAt)/1000)} 秒前更新 · 下次决策冷却 {Math.max(0,Math.ceil((d.nextAt-now)/1000))} 秒</div>
 {s&&<><div>{s.posture||'姿势未知'} · {s.canMove?'可走动':'暂不可走动'} · {s.canIdle?'可做空闲动作':'暂不可做空闲动作'}</div><div>距离：{Number.isFinite(s.distance)?s.distance.toFixed(1)+' 房间单位':'不在同一现场'} · 附近空座：{s.canSit?'有':'暂无'}</div>{!!s.blockers?.length&&<div className="text-amber-100">限制：{s.blockers.join('；')}</div>}{!!s.manualRemaining&&<div>手动让行约 {Math.max(0,Math.ceil((s.manualRemaining-(now-d.updatedAt))/1000))} 秒</div>}{s.userFurniture&&<div className="text-white/60">用户正占用家具动作槽；角色仍可独立走动、回应，日程家具动作暂不可并行。</div>}</>}
 <div>判断 {d.checks} 次 · 尝试 {d.attempts} 次 · 启动 {d.started} 次 · 未启动 {d.failed} 次</div>
 <details><summary className="cursor-pointer text-white/60">等待原因统计（判断次数）</summary>{Object.entries(d.reasons).sort((a,b)=>b[1]-a[1]).map(([reason,count])=><div key={reason}>{reason}：{count}</div>)}</details>
 <details><summary className="cursor-pointer text-white/60">最近动作尝试</summary>{d.recent.length?d.recent.map((r,i)=><div key={i}>{Math.floor((now-r.at)/1000)} 秒前 · {names[r.action]||r.action}：{r.result}</div>):<div>尚未尝试动作</div>}</details>
 <p className="text-[10px] text-white/40">仅本次家园会话，不上传、不保存聊天内容。启动次数不等于完成次数。</p>
 </div>}</details>;
}
