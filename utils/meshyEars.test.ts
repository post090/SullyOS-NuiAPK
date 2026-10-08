import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import catalog from '../apps/room3d/chibi/approvedWardrobe.json';
import colors from '../apps/room3d/chibi/wardrobeColorRegions.json';

it('publishes each pair below 4000 triangles, with head binding and hand-authored color regions',()=>{
 const bytes=readFileSync('public/room3d/wardrobe/meshy-ears.glb');
 const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 expect(gltf.images??[]).toHaveLength(0);expect(gltf.textures??[]).toHaveLength(0);
 for(const id of ['cat-ears','dog-ears','fox-ears','rabbit-ears']){
  const def=catalog.find(d=>d.id===id)!;expect(def.asset).toBe('meshy-ears.glb');
  const nodes=gltf.nodes.filter(n=>n.name?.startsWith(def.prefix));expect(nodes.length).toBeGreaterThan(0);
  let triangles=0;
  for(const node of nodes){expect(gltf.skins[node.skin].joints).toHaveLength(48);
   for(const p of gltf.meshes[node.mesh].primitives){triangles+=gltf.accessors[p.indices].count/3;expect(p.attributes.TEXCOORD_0).toBeUndefined();expect(p.attributes.COLOR_0).toBeDefined();expect(p.attributes.JOINTS_0).toBeDefined();}
  }
  expect(triangles).toBeGreaterThan(0);expect(triangles).toBeLessThan(4000);
  expect(colors[id].map(r=>r.id)).toEqual(['fur','inner']);expect(colors[id].every(r=>r.targets.length>0)).toBe(true);
 }
});
