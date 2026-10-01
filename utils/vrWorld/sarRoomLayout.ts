import mask from './sarRoomMask.json';

export const SAR_ROOM_SIZE = {width:mask.width,height:mask.height};
export type SARStandingZone = 'common' | 'fishing';
export type SARFacility = 'board' | 'modules' | 'cabinet' | 'gacha' | 'water' | 'garden';
export const SAR_ROOM_HOTSPOTS: {id:SARFacility;label:string;ariaLabel:string;x:number;y:number;align:'left'|'right'|'center'}[] = [
    {id:'board',label:'布告板',ariaLabel:'进入布告板',x:mask.hotspots.board[0],y:mask.hotspots.board[1],align:'left'},
    {id:'modules',label:'模块',ariaLabel:'进入模块购买',x:mask.hotspots.modules[0],y:mask.hotspots.modules[1],align:'center'},
    {id:'cabinet',label:'芯片',ariaLabel:'进入异界陈列柜',x:mask.hotspots.cabinet[0],y:mask.hotspots.cabinet[1],align:'left'},
    {id:'gacha',label:'扭蛋',ariaLabel:'进入异世界扭蛋',x:mask.hotspots.gacha[0],y:mask.hotspots.gacha[1],align:'right'},
    {id:'water',label:'钓鱼',ariaLabel:'进入水域',x:mask.hotspots.water[0],y:mask.hotspots.water[1],align:'left'},
    // User requested the dinosaur entrance on the coffee table.
    {id:'garden',label:'恐龙箱庭',ariaLabel:'进入恐龙箱庭',x:790,y:1300,align:'center'},
];

/** Sample the original artist's mask at the actor's feet, in source-image pixels. */
export function sarRoomZoneAt(x:number,y:number):SARStandingZone|null {
    if(!Number.isFinite(x)||!Number.isFinite(y))return null;
    const row=mask.rows[Math.round(y)];if(!row)return null;
    const run=row.find(([start,end])=>Math.round(x)>=start&&Math.round(x)<=end);
    return run?run[2]===2?'fishing':'common':null;
}
export interface SARRoomActor {id:string;zone:SARStandingZone;anchor?:{x:number;y:number};name?:string;title?:string;headOffset?:number}
export interface SARRoomStanding extends SARRoomActor {x:number;y:number}
const hash=(value:string)=>Array.from(value).reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,7);

/** No random roaming or cross-furniture interpolation. Excess occupants remain in the roster. */
export function arrangeSARRoomActors(actors:SARRoomActor[],displayScale=.27) {
    const placed:SARRoomStanding[]=[],overflow:string[]=[];
    const scale=Math.max(.1,displayScale||.27);
    type Rect={x:number;y:number;w:number;h:number};
    const overlaps=(a:Rect,b:Rect)=>a.x<b.x+b.w+3&&a.x+a.w+3>b.x&&a.y<b.y+b.h+3&&a.y+a.h+3>b.y;
    const labels=(actor:SARRoomActor,x:number,y:number):Rect[]=>{
        const rects:Rect[]=[];
        if(actor.name){const w=Math.min(80,Array.from(actor.name).length*9+8);rects.push({x:x*scale-w/2,y:y*scale+2,w,h:15});}
        if(actor.title){const w=Math.min(106,Array.from(actor.title).length*9+16);rects.push({x:x*scale-w/2,y:y*scale-mask.width*.125*scale-20-(actor.headOffset||0),w,h:17});}
        return rects;
    };
    const facilities=SAR_ROOM_HOTSPOTS.map(h=>{const w=h.label.length*10+28;return {x:h.x*scale-(h.align==='left'?w:h.align==='center'?w/2:0),y:h.y*scale+8,w,h:23};});
    const unique=[...new Map(actors.map(actor=>[actor.id,actor])).values()];
    unique.sort((a,b)=>Number(!!b.anchor)-Number(!!a.anchor)||a.id.localeCompare(b.id));
    for(const actor of unique){
        const candidates=mask.candidates.filter(p=>p[2]===(actor.zone==='fishing'?2:1)
            &&p[0]>=84&&p[0]<=mask.width-84
            &&SAR_ROOM_HOTSPOTS.every(hotspot=>Math.abs(hotspot.x-p[0])>105||hotspot.y<p[1]-200||hotspot.y>p[1]+40));
        const seed=candidates[hash(actor.id)%candidates.length];
        if(!seed){overflow.push(actor.id);continue;}
        const anchor=actor.anchor||{x:seed[0],y:seed[1]};
        const spot=[...candidates].sort((a,b)=>Math.hypot(a[0]-anchor.x,a[1]-anchor.y)-Math.hypot(b[0]-anchor.x,b[1]-anchor.y))
            .find(p=>{
                const ownLabels=labels(actor,p[0],p[1]);
                return ownLabels.every(rect=>rect.x>=0&&rect.x+rect.w<=mask.width*scale&&facilities.every(f=>!overlaps(rect,f)))
                    &&placed.every(other=>Math.hypot(other.x-p[0],other.y-p[1])>=155&&ownLabels.every(a=>labels(other,other.x,other.y).every(b=>!overlaps(a,b))));
            });
        if(spot)placed.push({...actor,x:spot[0],y:spot[1]});else overflow.push(actor.id);
    }
    return {placed,overflow};
}
