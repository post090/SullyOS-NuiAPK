export type ResidentEyeExpression='auto'|'closed'|'happy';
export interface ResidentExpression {eyes:ResidentEyeExpression;blink:boolean}
export const defaultResidentExpression:ResidentExpression={eyes:'auto',blink:true};

// A stable resident offset prevents synchronized blinking. Time is an animation
// clock in seconds, independent of the room owner's wall-clock timezone.
export function residentBlinkSeed(id:string){let hash=0;for(const c of id)hash=(Math.imul(hash,31)+c.charCodeAt(0))>>>0;return hash;}
export function residentFaceFrame(time:number,seed:number,settings:Partial<ResidentExpression>={},base:'open'|'closed'|'happy'='open',canBlink=true){
 const eyes=settings.eyes==='closed'||settings.eyes==='happy'?settings.eyes:base;
 if(eyes!=='open'||settings.blink===false||!canBlink)return {eyes,blinking:false,nextIn:Infinity};
 const period=3.6+(seed%170)/100,offset=((seed>>>8)%1000)/1000*period;
 const phase=((time+offset)%period+period)%period,closed=phase>=period-.16;
 return {eyes:closed?'closed' as const:'open' as const,blinking:closed,nextIn:Math.max(.016,closed?period-phase:period-.16-phase)};
}
