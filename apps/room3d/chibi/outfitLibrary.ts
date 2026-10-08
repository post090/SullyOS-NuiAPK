import {createLocalId} from '../../../utils/localId.js';
import {approvedGarments,approvedPresets,cleanApprovedWardrobe} from './approvedWardrobe';
import {cleanGarmentFit,scopeLegacyHemFits} from './garmentFit';
import {cleanWardrobeColors} from './wardrobeColors';
import type {HairSettings} from './types';

export interface SavedOutfit {
 id:string; name:string;
 clothes:Required<Pick<HairSettings,'wardrobe'|'wardrobeFits'|'wardrobeColors'|'wardrobeLayering'>>;
}
export const OUTFIT_LIMIT=100;
export function outfitClothes(hair:Pick<HairSettings,'wardrobe'|'wardrobeFits'|'wardrobeColors'|'wardrobeLayering'>):SavedOutfit['clothes']{
 const wardrobe=cleanApprovedWardrobe(hair.wardrobe===undefined?approvedPresets.original.items:hair.wardrobe);
 const fits=scopeLegacyHemFits(hair.wardrobeFits,wardrobe),colors=cleanWardrobeColors(hair.wardrobeColors);
 return {wardrobe,wardrobeFits:Object.fromEntries(Object.values(wardrobe).map(id=>[id,cleanGarmentFit(fits[id])])),wardrobeColors:Object.fromEntries(Object.values(wardrobe).filter(id=>colors[id]).map(id=>[id,colors[id]])),wardrobeLayering:hair.wardrobeLayering!==false};
}
export function applyOutfit(hair:HairSettings,outfit:SavedOutfit):HairSettings{
 return {...hair,bodyShape:'blank',...outfitClothes(outfit.clothes)};
}
export function makeOutfit(name:string,hair:HairSettings):SavedOutfit{
 const clean=name.trim().slice(0,40);if(!clean)throw Error('给这套搭配起个名字吧');
 return {id:createLocalId(),name:clean,clothes:outfitClothes(hair)};
}
export function exportOutfit(outfit:SavedOutfit){return JSON.stringify({format:'sully-3d-outfit',version:1,name:outfit.name,clothes:outfitClothes(outfit.clothes)},null,2);}
export function importOutfit(text:string):SavedOutfit{
 if(text.length>256_000)throw Error('搭配文件过大');
 let value:any;try{value=JSON.parse(text);}catch{throw Error('不是有效的搭配文件');}
 if(value?.format!=='sully-3d-outfit'||value.version!==1||typeof value.name!=='string'||!value.clothes||typeof value.clothes!=='object')throw Error('不支持这个搭配文件');
 const w=value.clothes.wardrobe;
 if(!w||typeof w!=='object'||Array.isArray(w)||Object.entries(w).some(([slot,id])=>!approvedGarments.some(g=>g.slot===slot&&g.id===id)))throw Error('搭配含当前版本没有的服装，请更新后再试');
 return makeOutfit(value.name,{layers:{},extras:[],...outfitClothes(value.clothes)});
}
