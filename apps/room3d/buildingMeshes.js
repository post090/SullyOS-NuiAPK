import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {BUILDING_ASSETS} from './building.js';

export function createBuildingTemplates(){
 const cream=new T.MeshStandardMaterial({color:'#FFF2E3',roughness:.85});cream.name='cream';
 const trim=new T.MeshStandardMaterial({color:'#A99BE8',roughness:.7});trim.name='lavender';
 return BUILDING_ASSETS.map(asset=>{
  const root=new T.Group();root.userData.assetId=asset.id;
  const batches=[[],[]],height=asset.size[1];
  const box=(x,y,z,w,h,d,material=0)=>{const g=new RoundedBoxGeometry(w,h,d,2,Math.min(.045,w/4,h/4,d/4));g.translate(x,y,z);batches[material].push(g);};
  if(asset.id==='wall_fence'){
   for(let i=0;i<6;i++)box(-.5+i*.2,.46,0,.075,.88,.085);
   box(0,.22,0,1.2,.09,.15,1);box(0,.76,0,1.2,.1,.15,1);
  }else{
   box(0,(height-.1)/2,0,1.2,height-.1,.22);
   box(0,height-.055,0,1.2,.11,.24,1);
   box(0,.1,0,1.2,.16,.24);
  }
  batches.forEach((geometries,i)=>{const geometry=mergeGeometries(geometries);for(const g of geometries)g.dispose();const mesh=new T.Mesh(geometry,i?trim:cream);root.add(mesh);});
  return root;
 });
}
