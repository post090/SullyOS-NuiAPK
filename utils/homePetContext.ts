import type {Home3DState} from '../apps/room3d/types';
const species:Record<string,string>={pet_cat:'猫',pet_dog:'狗',pet_bird:'小鸟',pet_snake:'蛇',pet_slime:'史莱姆',pet_turtle:'乌龟',pet_shark:'鲨鱼'};
export function buildHomePetContext(home?:Home3DState):string{
 const pets=(Array.isArray(home?.petLife?.pets)?home.petLife.pets:[]).filter(p=>p&&typeof p.name==='string'&&species[p.assetId]);
 if(!pets.length)return '';
 return '### 家园里的宠物\n'+pets.map(p=>'你们在家园里有一只叫'+JSON.stringify(p.name)+'的宠物，是一只'+species[p.assetId]+'。').join('\n')+'\n这是共同家园中的宠物信息，不表示你此刻就在家园；互动是否发生以实际行为记录为准。\n\n';
}
