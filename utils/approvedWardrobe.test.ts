import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {approvedGarments,approvedPresets,cleanApprovedWardrobe} from '../apps/room3d/chibi/approvedWardrobe';
describe('approved wardrobe integration',()=>{
 it('ships every selected primitive and its authored skin',()=>{
  expect(new Set(approvedGarments.map(g=>g.id)).size).toBe(approvedGarments.length);
  for(const def of approvedGarments){const b=readFileSync(`public/room3d/wardrobe/${def.asset}`);const gltf=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());const nodes=gltf.nodes.filter((n:any)=>n.mesh!==undefined&&n.name.startsWith(def.prefix));expect(nodes.length,def.id).toBeGreaterThan(0);for(const node of nodes){expect(node.skin,def.id).toBeTypeOf('number');for(const p of gltf.meshes[node.mesh].primitives){expect(p.attributes.JOINTS_0).toBeTypeOf('number');expect(p.attributes.WEIGHTS_0).toBeTypeOf('number');}}}
 });
 it('rejects stale and cross-slot selections while retaining independent shoes and socks',()=>{
  expect(cleanApprovedWardrobe({top:'unknown',bottom:'sailor-long',socks:'school-socks',shoes:'buckle-shoes'})).toEqual({socks:'school-socks',shoes:'buckle-shoes'});
  expect(cleanApprovedWardrobe(null)).toEqual({});
 for(const preset of Object.values(approvedPresets))expect(cleanApprovedWardrobe(preset.items)).toEqual(preset.items);
 });
 it('wears a one-piece without retaining conflicting tops and bottoms',()=>{
  expect(cleanApprovedWardrobe({top:'basic-tee',bottom:'swim-shorts',onepiece:'school-swimsuit',headwear:'bow-headband'})).toEqual({onepiece:'school-swimsuit',headwear:'bow-headband'});
 });
 it('ships the adjustable V neckline and all requested new garments',()=>{
  for(const id of ['fitted-camisole','fitted-turtleneck','fitted-sweater','basic-tee','school-swimsuit','swim-shorts','maid-sleeves','qipao'])expect(approvedGarments.find(g=>g.id===id),id).toBeTruthy();
  const def=approvedGarments.find(g=>g.id==='fitted-sweater')!,b=readFileSync(`public/room3d/wardrobe/${def.asset}`),gltf=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
  expect(def.morph).toBe('VNeck');expect(gltf.meshes.some((m:any)=>m.extras?.targetNames?.includes('VNeck')&&m.primitives.some((p:any)=>p.targets?.[0]?.POSITION!==undefined))).toBe(true);
 });
});
