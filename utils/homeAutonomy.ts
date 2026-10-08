import type {HomeAction} from '../apps/room3d/types';
// Conservative local matching: unrelated furniture must never become a substitute.
const intents:[RegExp,string[]][]=[
 [/做饭|煮饭|烹饪|cook/i,['cook']],
 [/咖啡|coffee/i,['coffee']],
 [/洗碗|wash.*dish/i,['wash']],
 [/直播|开播|stream/i,['stream']],
 [/睡|午休|躺|sleep|nap/i,['sleep']],
 [/吃|用餐|午饭|晚饭|早餐|eat|dinner|lunch/i,['eat']],
 [/游戏|打机|gaming|game/i,['computer','console','race','rhythm']],
 [/工作|办公|写代码|编程|work|coding/i,['computer']],
 [/浇水|照顾植物|water.*plant/i,['water']],
 [/休息|发呆|放松|坐|rest|relax/i,['sit','sleep']],
 [/洗澡|沐浴|淋浴|泡澡|shower|bath/i,['bath-soak','bath-shower']],
 [/照镜|整理仪容|mirror/i,['mirror-admire']],
];
export function chooseHomeAction(activity:string,actions:HomeAction[]):HomeAction|undefined{
 for(const [pattern,kinds]of intents){if(!pattern.test(activity))continue;
  for(const kind of kinds){const match=actions.find(a=>a.kind===kind);if(match)return match;}
  return undefined;
 }
 return undefined;
}
