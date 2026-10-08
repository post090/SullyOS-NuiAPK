import {describe,it,expect} from 'vitest';import {readFileSync} from 'node:fs';
import {gamingPreset,gamingActivities,placeGamingPreset} from '../apps/room3d/gaming.js';
import {createHome,placementError,snapToSupport,previewFurniture,validateHome} from '../apps/room3d/model.js';
import {rhythmFrame} from '../apps/room3d/rhythm.js';
const catalog=JSON.parse(readFileSync('public/room3d/catalog.json','utf8'));
const room=(kind='stream')=>({...createHome(catalog).rooms[0],items:gamingPreset(kind,catalog)});
describe('twin rhythm cabinet and rigid-body jumps',()=>{
 it('provides independent left/right spots and reaches all eight buttons at the apex',()=>{
  const r=room('rhythm'),machine=r.items[0],asset=catalog.find(a=>a.id===machine.assetId),actions=gamingActivities(r,catalog);
  expect(actions.map(a=>a.stationId)).toEqual(['left','right']);
  for(const a of actions){expect(a.reason).toBe('');const station=asset.activity.stations.find(s=>s.id===a.stationId),keys=new Set<string>();
   a.rhythm.forEach((beat,index)=>{const frame=rhythmFrame(a,index*1.5+.60)!;expect(frame.offset[1]).toBeGreaterThan(.6);expect(frame.keys).toEqual(beat.keys);frame.keys.forEach(k=>keys.add(k));
    // Resolve actual hand centers back into world space and compare with authored buttons.
    for(const target of station.beats[index].targets){const world=[machine.x+target[0],machine.y+target[1],machine.z+target[2]];
     const distances=frame.hands.map(h=>{const p=h.map((v,k)=>(v+frame.offset[k])*.7),c=Math.cos(a.rotation),s=Math.sin(a.rotation);return Math.hypot(a.position[0]+c*p[0]+s*p[2]-world[0],a.position[1]+p[1]-world[1],a.position[2]-s*p[0]+c*p[2]-world[2]);});expect(Math.min(...distances)).toBeLessThan(1e-6);
    }
    for(const h of frame.hands){expect(Math.abs(h[0])).toBeLessThanOrEqual(.8);expect(h[1]).toBeLessThan(.91);expect(h[2]).toBeLessThan(.84);}
    expect(rhythmFrame(a,index*1.5+1.30)!.offset).toEqual([0,0,0]);
   });expect(keys.size).toBe(8);
  }
 });
 it('rotates both play spots and every jump target with the cabinet',()=>{
  const initial=gamingActivities(room('rhythm'),catalog);for(const rotation of [0,90,180,270]){const r=room('rhythm');r.items[0].z=0;r.items[0].rotation=rotation;const actions=gamingActivities(r,catalog);for(let i=0;i<2;i++){expect(actions[i].reason).toBe('');actions[i].rhythm.forEach((b,j)=>b.offset.forEach((v,k)=>expect(v).toBeCloseTo(initial[i].rhythm[j].offset[k])));}}
 });
 it('rejects an overhead obstacle on the jump path while leaving the other station usable',()=>{
  const r=room('rhythm'),a=gamingActivities(r,catalog)[0],b=a.rhythm[3],x=a.position[0],z=a.position[2]-b.offset[2]*.7;
  const blocker={id:'jump-blocker',surface:'ceiling',boxes:[[-.12,0,-.12,.12,.20,.12]],size:[.24,.20,.24]};
  r.items.push({id:'overhead',assetId:blocker.id,x,y:a.position[1]+b.offset[1]*.7+1.2,z,rotation:0,stored:false} as any);
  const actions=gamingActivities(r,[...catalog,blocker]);expect(actions[0].reason).toContain('跳起来');expect(actions[1].reason).toBe('');
 });
});
describe('reviewed gaming furniture',()=>{
 for(const kind of ['computer','stream','race','rhythm'])it(kind+' provides a usable position and rigid hand targets',()=>{const r=room(kind);for(const i of r.items)expect(placementError(i,r,catalog),i.assetId).toBe('');const a=gamingActivities(r,catalog).find(a=>a.kind===kind)!;expect(a.reason).toBe('');expect(!!a.seat).toBe(kind!=='rhythm');expect(a.hands).toHaveLength(2);expect(a.hands[0][0]).toBeLessThan(0);expect(a.hands[1][0]).toBeGreaterThan(0);});
 it('rejects missing devices, reversed or distant chairs and head blockers',()=>{const r=room();const chair=r.items.find(i=>i.assetId==='gaming_chair')!;chair.rotation=0;expect(gamingActivities(r,catalog)[0].reason).not.toBe('');chair.rotation=180;chair.z+=.8;expect(gamingActivities(r,catalog)[0].reason).not.toBe('');const s=room();s.items.find(i=>i.assetId==='gaming_microphone')!.stored=true;expect(gamingActivities(s,catalog).find(a=>a.kind==='stream')!.reason).toContain('麦克风');const a=gamingActivities(s,catalog)[0];s.items.push({...s.items[0],id:'blocker',assetId:'gaming_display',x:a.position[0],z:a.position[2]});expect(gamingActivities(s,catalog)[0].reason).toContain('挡住');});
 it('invalidates moved input devices instead of stretching the arms',()=>{const r=room();r.items.find(i=>i.assetId==='gaming_keyboard')!.z-=.8;expect(gamingActivities(r,catalog)[0].reason).toContain('够得到');});
 it('rotates station, seat and hand targets together in all four directions',()=>{for(const rotation of [0,90,180,270]){const r=room('race'),initial=gamingActivities(r,catalog)[0],t=rotation*Math.PI/180;r.items=r.items.map(i=>({...i,x:Math.cos(t)*i.x+Math.sin(t)*i.z,z:-Math.sin(t)*i.x+Math.cos(t)*i.z,rotation:(i.rotation+rotation)%360}));const a=gamingActivities(r,catalog)[0];expect(a.reason).toBe('');a.hands.flat().forEach((v,k)=>expect(v).toBeCloseTo(initial.hands.flat()[k]));}});
 it('adds a full independent bundle or nothing, and round trips supports',()=>{const home=createHome(catalog),r=home.rooms[0];r.items=[];const items=placeGamingPreset('stream',r,catalog);expect(r.items).toHaveLength(0);r.items.push(...items);expect(validateHome(home,catalog)).toEqual(home);expect(()=>placeGamingPreset('stream',r,catalog)).toThrow();});
});
describe('two-level desk supports and overhanging monitor base',()=>{
 it('snaps keyboard to the low plane and monitor foot to the raised plane',()=>{const r=room(),desk=r.items.find(i=>i.assetId==='gaming_desk')!,a=catalog.find(a=>a.id===desk.assetId);for(const [id,height]of [['gaming_keyboard',a.support.height],['gaming_monitors',a.support.areas[0].height]] as const){const i=r.items.find(i=>i.assetId===id)!;expect(i.y).toBeCloseTo(desk.y+height);expect(snapToSupport(i,r,catalog).supportId).toBe(desk.id);}});
 it('rejects a keyboard bridging the step and a monitor whose foot falls off',()=>{const r=room(),keyboard=r.items.find(i=>i.assetId==='gaming_keyboard')!,monitor=r.items.find(i=>i.assetId==='gaming_monitors')!;expect(snapToSupport({...keyboard,z:-.92},r,catalog).supportId).toBeNull();expect(snapToSupport({...monitor,x:1.65},r,catalog).supportId).toBeNull();});
 it('keeps correct heights and support on moving/rotating the parent',()=>{const r=room(),desk=r.items.find(i=>i.assetId==='gaming_desk')!;r.items=r.items.filter(i=>i.id===desk.id||i.supportId===desk.id);for(const rotation of [0,90,180,270]){const next=previewFurniture(r,desk.id,{rotation,x:.2,z:0});for(const i of next.items.filter(i=>i.supportId))expect(placementError(i,next,catalog),i.assetId).toBe('');}});
});

describe('lower monitor with existing streaming layouts',()=>{
 it('repairs only the old colliding preset microphone, preserving identity and paint',()=>{const h=createHome(catalog),r=h.rooms[0];r.items=gamingPreset('stream',catalog);const mic=r.items.find(i=>i.assetId==='gaming_microphone')!,desk=r.items.find(i=>i.assetId==='gaming_desk')!;mic.x=desk.x-.96;mic.z=desk.z+.29;mic.color='#91C9F4';expect(placementError(mic,r,catalog)).not.toBe('');const restored=validateHome(h,catalog),next=restored.rooms[0].items.find(i=>i.id===mic.id)!;expect(placementError(next,restored.rooms[0],catalog)).toBe('');expect(next.color).toBe(mic.color);expect(next.supportId).toBe(desk.id);expect(validateHome(restored,catalog)).toEqual(restored);});
});
