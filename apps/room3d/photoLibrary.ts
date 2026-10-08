import poses from './chibi/photoPoseCatalog.json';
import {selectedMotions,loadSelectedMotion,type SelectedClip} from './chibi/selectedMotions';
export const photoLibrary=[
 ...poses.map(p=>({...p,kind:'pose' as const})),
 ...selectedMotions.map(p=>({...p,kind:p.participants===2?'pair' as const:'motion' as const,thumbnail:undefined})),
];
const cache=new Map<string,Promise<SelectedClip>>();
export function loadPhotoClip(id:string){
 const p=poses.find(p=>p.id===id);if(!p)return loadSelectedMotion(id);
 if(!cache.has(id))cache.set(id,fetch(`${import.meta.env.BASE_URL}room3d/motions/photo/${p.file}`).then(async r=>{if(!r.ok)throw Error('姿势加载失败');const clip=await r.json();if(clip.id!==id||clip.actors?.length!==1)throw Error('姿势数据不匹配');return clip;}).catch(e=>{cache.delete(id);throw e;}));
 return cache.get(id)!;
}
