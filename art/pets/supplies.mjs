import fs from 'node:fs/promises';
import * as T from 'three';
import {saveGlb} from '../jellyfish-home/asset-geometry.mjs';
const catalog=JSON.parse(await fs.readFile('public/room3d/catalog.json','utf8'));
for(const kind of ['toy','mat']){
 const root=new T.Group(),material=new T.MeshStandardMaterial({color:kind==='toy'?'#96b481':'#dde5cb',roughness:.9});material.name='pet-supply';
 const g=kind==='toy'?new T.SphereGeometry(.17,12,8):new T.CylinderGeometry(.72,.72,.045,32);g.deleteAttribute('uv');
 const mesh=new T.Mesh(g,material);mesh.position.y=kind==='toy'?.17:.0225;root.add(mesh);
 const id=kind==='toy'?'pet_toy_ball':'pet_rest_mat',url=`pets/${kind}.glb`;await saveGlb(root,'public/room3d/'+url);
 const size=new T.Box3().setFromObject(root).getSize(new T.Vector3()).toArray(),a={id,name:kind==='toy'?'宠物小球':'宠物休息垫',surface:kind==='toy'?'floor':'rug',url,size,default:[0,.15,0],boxes:[[-size[0]/2,0,-size[2]/2,size[0]/2,size[1],size[2]/2]],collection:'pets',category:'pets',paintMaterials:['pet-supply'],petInteraction:kind==='toy'?'play':'sleep'};
 const index=catalog.findIndex(a=>a.id===id);if(index<0)catalog.push(a);else catalog[index]=a;
 console.log(id,g.index.count/3);
}
await fs.writeFile('public/room3d/catalog.json',JSON.stringify(catalog,null,2)+'\n');
