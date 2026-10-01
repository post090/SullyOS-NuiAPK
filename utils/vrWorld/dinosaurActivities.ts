import { PROP_LABELS } from './dinosaurCatalog';
import { coastEdge, riverCenter } from './dinosaurTerrain';
import type { DinoAction, DinoPose, DinoToy, GardenMap, GardenPropKind } from './dinosaurTypes';

export type GardenActivityKind = 'idle'|'nap'|'snack'|'splash'|'sniff'|'leaves'|'perch';
export interface GardenActivity {kind:GardenActivityKind;action:DinoAction;text:string;place:string;propId?:string;dock:DinoPose;lift:number}
export const INTERACTIVE_PROPS:readonly GardenPropKind[]=['picnic','puddle','flowers','tent','stump','tree','rock'];
const kinds:Partial<Record<GardenPropKind,GardenActivityKind>>={tent:'nap',picnic:'snack',puddle:'splash',flowers:'sniff',tree:'leaves',stump:'perch',rock:'nap'};
const verbs:Record<GardenActivityKind,DinoAction>={idle:'发呆',nap:'睡觉',snack:'吃饭',splash:'玩耍',sniff:'玩耍',leaves:'吃饭',perch:'观察'};
const lines:Partial<Record<GardenPropKind,string>>={tent:'在帐篷门口蜷成一小团。',picnic:'抱着饼干，一小口一小口地啃。',puddle:'踩踩水，溅出一串小水花。',flowers:'凑过去闻闻花，花瓣蹭得鼻子有点痒。',tree:'伸伸脖子，咬一口垂下来的叶子。',stump:'站在木桩上，摇摇尾巴放个哨。',rock:'靠着石头，睡得一下一下的。'};
const distance=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
/** Saved anchors and facing are authoritative. An interaction never walks or turns the toy. */
export function gardenActivityAt(map:GardenMap,pose:DinoPose,excluded:ReadonlySet<string>=new Set()):GardenActivity {
  const p=map.props.filter(p=>!excluded.has(p.id)&&INTERACTIVE_PROPS.includes(p.kind)).filter(p=>{
    const d=distance(p,pose);
    if(p.kind==='stump')return d<.32;
    if(p.kind==='picnic'||p.kind==='puddle')return d<.8;
    if(p.kind==='flowers')return d<1.05;
    if(p.kind==='tent')return d<1.85&&(pose.x-p.x)*Math.sin(p.rotation)+(pose.z-p.z)*Math.cos(p.rotation)>.6;
    if(p.kind==='rock')return d<1.55;
    // A tree is only reachable when the model's +X nose faces it.
    return d<1.85&&((p.x-pose.x)*Math.cos(pose.rotation)-(p.z-pose.z)*Math.sin(pose.rotation))/d>.35;
  }).sort((a,b)=>distance(a,pose)-distance(b,pose)||a.id.localeCompare(b.id))[0];
  if(p){const kind=kinds[p.kind]!;return {kind,action:verbs[kind],text:lines[p.kind]!,place:PROP_LABELS[p.kind],propId:p.id,dock:{...pose},lift:p.kind==='stump'?.46:0};}
  const water=map.theme==='coast'?pose.x>coastEdge(pose.z)+.1:map.theme==='grassland'&&Math.abs(pose.x-riverCenter(pose.z))<.45&&Math.abs(pose.z-.25)>.55;
  return {kind:water?'splash':'idle',action:water?'玩耍':'发呆',text:water?'踩踩浅水，看看自己的倒影。':'安安静静地待在这里。',place:water?'浅水边':'空地',dock:{...pose},lift:0};
}
export function buildGardenActivities(map:GardenMap,toys:DinoToy[]):Record<string,GardenActivity> {
  const result:Record<string,GardenActivity>={},claimed=new Set<string>();
  for(const t of toys.filter(t=>t.pose&&t.mapId===map.id).sort((a,b)=>a.catchId.localeCompare(b.catchId))){
    let a=gardenActivityAt(map,t.pose!,claimed);
    if(t.speciesId==='dinosaur-egg'||t.speciesId==='dinosaur-fossil')a={kind:'idle',action:'发呆',text:'安安静静地待在这里。',place:a.place,dock:{...t.pose!},lift:a.lift};
    else if(a.propId)claimed.add(a.propId);
    result[t.catchId]=a;
  }
  return result;
}
export const gardenStory=(toy:DinoToy,activity?:GardenActivity)=>toy.stage.text.trim()||activity?.text||'安安静静地待在这里。';
const seed=(id:string)=>Array.from(id).reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0)%180/10;
/** Local animation seconds only; reduced motion holds one static pose. */
export function sampleGardenActivity(toy:DinoToy,activity:GardenActivity,elapsed:number,reduced=false) {
  const p=toy.pose!,t=reduced?0:elapsed+seed(toy.catchId),beat=Math.sin(t*3),k=activity.kind;
  return {x:p.x,z:p.z,rotation:p.rotation,lift:activity.lift,
    lean:0,squash:k==='nap'?.76+(reduced?0:Math.sin(t*1.3)*.035):k==='splash'?1-Math.max(0,beat)*.06:1,
    head:k==='snack'?-.28+(reduced?0:Math.sin(t*6)*.12):k==='sniff'?-.42+(reduced?0:Math.sin(t*2)*.12):k==='leaves'?.25+(reduced?0:Math.sin(t*3)*.15):k==='nap'?-.25:0,
    tail:reduced?0:k==='perch'?Math.sin(t*2)*.5:k==='splash'?Math.sin(t*4)*.25:0,
    feet:reduced||k!=='splash'?0:beat*.11,activity:k,phase:reduced?0:t%6,active:1};
}
