// Targeted, repeatable repair for the already published chair; preserve materials.
import fs from 'node:fs/promises';
import * as T from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {saveGlb} from './asset-geometry.mjs';
import {CHAIR_SEAT_DROP,loweredChairY,lowerChairGeometry} from './chair-seat-height.mjs';
const path='public/room3d/catalog.json',catalog=JSON.parse(await fs.readFile(path,'utf8')),a=catalog.find(a=>a.id==='gaming_chair');
const file='public/room3d/'+a.url,bytes=await fs.readFile(file),{scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
let previousDrop=0;scene.traverse(o=>{if(o.userData.loweredSeat)previousDrop=typeof o.userData.loweredSeat==='number'?o.userData.loweredSeat:.14;});
if(previousDrop!==CHAIR_SEAT_DROP){
 scene.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(scene),center=bounds.getCenter(new T.Vector3()),scale=a.size[0]/bounds.getSize(new T.Vector3()).x,result=new T.Group();
 scene.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone().applyMatrix4(o.matrixWorld);g.translate(-center.x,-bounds.min.y,-center.z).scale(scale,scale,scale);lowerChairGeometry(g,previousDrop);result.add(new T.Mesh(g,o.material));});
 result.userData.loweredSeat=CHAIR_SEAT_DROP;await saveGlb(result,file);
 a.size[1]=loweredChairY(a.size[1],previousDrop);for(const b of a.boxes){b[1]=loweredChairY(b[1],previousDrop);b[4]=loweredChairY(b[4],previousDrop);}for(const seat of a.seats)seat.position[1]=loweredChairY(seat.position[1],previousDrop);a.revision='seat-low-20260930-v2';
 await fs.writeFile(path,JSON.stringify(catalog,null,2)+'\n');console.log('Chair seat',a.seats[0].position[1],'height',a.size[1]);
}else console.log('Chair seat already lowered');
