import type {CustomCreatorPart} from '../types';
import {cleanFace, type FaceSettings} from '../apps/room3d/chibi/faceAppearance';

export function flipHomeFigurePart(state:any,key:string){
 return {...state,flipped:{...state?.flipped,[key]:!state?.flipped?.[key]}};
}

export function selectHomeFigurePart(state: any, face: Partial<FaceSettings> | undefined, part: CustomCreatorPart) {
 const key=part.categoryKey, old=state?.selected?.[key];
 const multi=key==='decor'||key==='facemark';
 const ids=Array.isArray(old)?old:[];
 const selection=multi?(ids.includes(part.id)?ids.filter(id=>id!==part.id):[...ids,part.id]):part.id;
 return {
  state:{...state,selected:{...state?.selected,[key]:selection}},
  face:{...cleanFace(face),...(key==='eyes'?{useBaseEyes:true,eyeArtwork:undefined}:key==='mouth'?{useBaseMouth:true}:{})},
 };
}
