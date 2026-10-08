import * as T from 'three';
import {buildBody,loadBody} from '../../apps/room3d/chibi/FbxBody';
import {prepareApprovedWardrobe} from '../../apps/room3d/chibi/approvedClothing';
import {outfitClothes} from '../../apps/room3d/chibi/outfitLibrary';
import {BLANK_SCALE} from '../../apps/room3d/chibi/blankBody';
import type {HairSettings,Parts} from '../../apps/room3d/chibi/types';
import {createWardrobePose} from './wardrobePose';

const cache=new Map<string,string>();
let queue:Promise<unknown>=Promise.resolve();
// All thumbnails share one renderer at a time; each job releases its context.
export function renderOutfitThumbnail(hair:HairSettings,parts:Parts,signal:AbortSignal):Promise<string> {
 const clothes=outfitClothes(hair);
 const settings:HairSettings={layers:{},extras:[],bodyShape:'blank',skinColor:hair.skinColor??'#f0dfcf',headSize:hair.headSize,bodyHeight:hair.bodyHeight,...clothes};
 const key=JSON.stringify(settings),cached=cache.get(key);if(cached)return Promise.resolve(cached);
 const result=queue.catch(()=>{}).then(async()=>{
  signal.throwIfAborted();const hit=cache.get(key);if(hit)return hit;
  let source:Awaited<ReturnType<typeof loadBody>>|undefined,body:ReturnType<typeof buildBody>|undefined,renderer:T.WebGLRenderer|undefined;
  let outfit:Awaited<ReturnType<typeof prepareApprovedWardrobe>>|undefined,mixer:T.AnimationMixer|undefined;
  try {
   source=await loadBody();signal.throwIfAborted();
   // A neutral mannequin makes the clothes, silhouette and dye easy to compare.
   const blank=new Image();blank.src='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="472" height="472"/>';await blank.decode();signal.throwIfAborted();
   const mannequin=Object.fromEntries(Object.keys(parts).map(k=>[k,blank]));
   body=buildBody(source,mannequin,'skin',settings);
   outfit=await prepareApprovedWardrobe(body.rig!,clothes.wardrobe,clothes.wardrobeFits,clothes.wardrobeColors,clothes.wardrobeLayering,signal);
   signal.throwIfAborted();outfit.attach();
   body.root.scale.setScalar(2.8/BLANK_SCALE);
   mixer=new T.AnimationMixer(body.root);mixer.clipAction(createWardrobePose(body.rig!,'normal')).play();mixer.update(0);outfit.updatePose?.();
   const scene=new T.Scene();scene.add(body.root,new T.AmbientLight('#ffffff',.65),new T.HemisphereLight('#ffffff','#ede6df',1.9));
   const light=new T.DirectionalLight('#fff8ef',.65);light.position.set(-3,5,5);scene.add(light);
   const fill=new T.DirectionalLight('#f1f4ff',.35);fill.position.set(3,2,-4);scene.add(fill);
   const half=clothes.wardrobe.ears==='rabbit-ears'?1.95:clothes.wardrobe.ears?1.75:1.48;
   const camera=new T.OrthographicCamera(-half*.8,half*.8,half,-half,.1,30);camera.position.set(0,clothes.wardrobe.ears?1.45:1.18,6);camera.lookAt(0,camera.position.y,0);
   renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setSize(320,400);renderer.render(scene,camera);
   const image=renderer.domElement.toDataURL('image/png');if(cache.size>=80)cache.delete(cache.keys().next().value!);cache.set(key,image);return image;
  } finally {
   mixer?.stopAllAction();if(body)mixer?.uncacheRoot(body.root);outfit?.dispose();body?.resources.forEach(r=>r.dispose());
   source?.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
   renderer?.dispose();renderer?.forceContextLoss();
  }
 });
 queue=result;return result;
}
