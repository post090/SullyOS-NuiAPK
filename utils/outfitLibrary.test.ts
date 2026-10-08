import {it,expect,afterEach,vi} from 'vitest';
import * as T from 'three';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {makeOutfit,applyOutfit,exportOutfit,importOutfit} from '../apps/room3d/chibi/outfitLibrary';
import {createBlankBody} from '../apps/room3d/chibi/blankBody';
import {bindBlankBody} from '../apps/room3d/chibi/blankRig';
import {dressApprovedWardrobe} from '../apps/room3d/chibi/approvedClothing';
import {DB} from './db';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
it('creates and imports outfits on LAN HTTP without randomUUID',()=>{
 const native=globalThis.crypto;
 vi.stubGlobal('crypto',{getRandomValues:native.getRandomValues.bind(native)});
 const outfit=makeOutfit('手机搭配',{layers:{},extras:[]});
 const imported=importOutfit(exportOutfit(outfit));
 expect(imported.id).not.toBe(outfit.id);expect(imported.clothes).toEqual(outfit.clothes);
});
it('round trips outfits including independent ears/tails, colors, fitting and layering without face/profile data',()=>{
 const hair={layers:{},extras:[],wardrobe:{top:'sailor-long',ears:'fox-ears',tail:'fox-tail',headwear:'bow-headband'},wardrobeColors:{'fox-tail':{fur:'#abc'}},wardrobeFits:{'fox-tail':{scale:125,offsetZ:-12}},wardrobeLayering:true};
 const original=makeOutfit('狐狸出门',hair),restored=importOutfit(exportOutfit(original));
 expect(restored.clothes).toEqual(original.clothes);expect(restored.id).not.toBe(original.id);
 const face={enabled:true},target={layers:{},extras:[],headSize:1.2,face};
 expect(applyOutfit(target,restored)).toMatchObject({headSize:1.2,face,wardrobe:hair.wardrobe});
 expect(exportOutfit(original)).not.toContain('headSize');expect(restored.clothes.wardrobeColors['fox-tail'].fur).toBe('#aabbcc');
});
it('preserves explicit undressed outfits and resolves the legacy initial hoodie',()=>{
 expect(makeOutfit('空', {layers:{},extras:[],wardrobe:{}}).clothes.wardrobe).toEqual({});
 expect(makeOutfit('原版',{layers:{},extras:[]}).clothes.wardrobe.top).toBe('original-hoodie');
});
it('rejects unsupported, cross-slot and oversized shares before storing them',()=>{
 for(const text of ['{','x'.repeat(256001),JSON.stringify({format:'sully-3d-outfit',version:2}),JSON.stringify({format:'sully-3d-outfit',version:1,name:'bad',clothes:{wardrobe:{ears:'fox-tail'}}})])expect(()=>importOutfit(text)).toThrow();
});
it('atomically saves the shared wardrobe without stale profile forms erasing it',async()=>{
 const profile={name:'测试',avatar:'',bio:''};await DB.saveUserProfile(profile);
 const a=makeOutfit('A',{layers:{},extras:[]}),b=makeOutfit('B',{layers:{},extras:[]});
 await DB.updateWardrobeOutfits(()=>[]);
 await Promise.all([DB.updateWardrobeOutfits(old=>[...old,a]),DB.updateWardrobeOutfits(old=>[...old,b])]);
 await DB.saveUserProfile({...profile,bio:'新的简介'});
 const saved=await DB.getUserProfile();expect(saved?.wardrobeOutfits?.map(o=>o.name)).toEqual(['A','B']);expect(saved?.bio).toBe('新的简介');
 expect((await DB.exportFullData()).userProfile?.wardrobeOutfits).toEqual(saved?.wardrobeOutfits);
});
it('binds every animal accessory to the live head or hips and restores the body when removed',async()=>{
 vi.spyOn(GLTFLoader.prototype,'loadAsync').mockImplementation(async url=>{const b=readFileSync(`public/room3d/wardrobe/${String(url).split('/').pop()!.split('?')[0]}`);return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');});
 for(const animal of ['cat','dog','fox'])for(const height of [.8,1.25]){
  const root=new T.Group(),body=new T.Mesh(createBlankBody('skin',{bodyHeight:height,headSize:1.2}),new T.MeshStandardMaterial()),hair=new T.Group();root.add(body,hair);const rig=bindBlankBody(body,hair,true),index=Array.from(rig.baseGeometry.index!.array);
  const outfit=await dressApprovedWardrobe(rig,{ears:`${animal}-ears`,tail:`${animal}-tail`});
  expect(new Set(outfit.meshes.map(m=>m.userData.garmentId))).toEqual(new Set([animal+'-ears',animal+'-tail']));expect(Array.from(rig.mesh.geometry.index!.array)).toEqual(index);
  for(const mesh of outfit.meshes){const g=mesh.geometry,bone=mesh.userData.garmentId.endsWith('ears')?'head':'hips';expect(rig.skeleton.bones[g.attributes.skinIndex.getX(0)].name).toBe(bone);expect(g.attributes.skinWeight.getX(0)).toBe(1);expect(Array.from(g.attributes.position.array).every(Number.isFinite)).toBe(true);}
  const ears=outfit.meshes.find(m=>m.userData.garmentId.endsWith('ears'))!,tail=outfit.meshes.find(m=>m.userData.garmentId.endsWith('tail'))!,a=new T.Vector3(),b=new T.Vector3();root.updateMatrixWorld(true);rig.skeleton.update();const ep=ears.geometry.attributes.position,earIndex=Array.from({length:ep.count},(_,i)=>i).reduce((best,i)=>Math.abs(ep.getX(i))>Math.abs(ep.getX(best))?i:best,0);ears.getVertexPosition(earIndex,a);tail.getVertexPosition(0,b);
  rig.bones.head.rotation.y=.5;root.updateMatrixWorld(true);rig.skeleton.update();const c=new T.Vector3(),d=new T.Vector3();ears.getVertexPosition(earIndex,c);tail.getVertexPosition(0,d);expect(c.distanceTo(a)).toBeGreaterThan(.05);expect(d.distanceTo(b)).toBeLessThan(.00001);
  outfit.dispose();expect(rig.mesh.geometry).toBe(rig.baseGeometry);expect(outfit.meshes.every(m=>!m.parent)).toBe(true);
 }
});



