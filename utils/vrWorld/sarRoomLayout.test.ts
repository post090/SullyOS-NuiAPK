import {expect,it} from 'vitest';
import {arrangeSARRoomActors,sarRoomZoneAt,SAR_ROOM_HOTSPOTS,type SARRoomActor} from './sarRoomLayout';

it('keeps feet inside the supplied zone, separates occupants and handles a crowded room without recycling positions',()=>{
    const actors:SARRoomActor[]=[{id:'caian',zone:'common',anchor:{x:740,y:945}},{id:'aiven',zone:'fishing',anchor:{x:880,y:1745}},...Array.from({length:60},(_,i)=>({id:`visitor-${i}`,zone:i%2?'common' as const:'fishing' as const}))];
    const {placed,overflow}=arrangeSARRoomActors(actors);
    expect(placed.length+overflow.length).toBe(actors.length);expect(overflow.length).toBeGreaterThan(0);
    for(const actor of placed){
        expect(sarRoomZoneAt(actor.x,actor.y)).toBe(actor.zone);
        for(const [dx,dy] of [[-20,0],[20,0],[0,-9],[0,9]])expect(sarRoomZoneAt(actor.x+dx,actor.y+dy)).toBe(actor.zone);
        for(const other of placed)if(other.id!==actor.id)expect(Math.hypot(actor.x-other.x,actor.y-other.y)).toBeGreaterThanOrEqual(155);
    }
    expect(arrangeSARRoomActors([...actors].reverse())).toEqual({placed,overflow});
    expect(sarRoomZoneAt(675,500)).toBeNull();expect(sarRoomZoneAt(NaN,10)).toBeNull();
});
it('preserves all supplied facilities and puts the added dinosaur entrance on the coffee table',()=>{
    expect(SAR_ROOM_HOTSPOTS.find(p=>p.id==='cabinet')).toMatchObject({x:1026.12,y:824.28});
    expect(SAR_ROOM_HOTSPOTS.find(p=>p.id==='gacha')).toMatchObject({x:1143.12,y:892.28});
    expect(SAR_ROOM_HOTSPOTS.find(p=>p.id==='garden')).toMatchObject({x:790,y:1300});
    expect(SAR_ROOM_HOTSPOTS).toHaveLength(6);
});
