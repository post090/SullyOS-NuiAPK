// Authored primary surfaces. Fixtures/food/glass/screens retain their own colors.
const reviewed={
 loft:['Lavender gingham fabric','lavender','blush'],desk:['cream'],worktable:['woodLight'],chair:['blush'],bookcase:['cream'],aquarium:['lavender'],porthole:['lavender','purple'],sofa:['Lavender gingham fabric','lavender','blush'],table:['woodLight'],rug:['rug'],pouf:['blush','lavender'],tank:['cream'],nightstand:['cream'],pendant:['Frosted peach lamp shade'],bedside:['Frosted peach lamp shade'],high_shelf:['woodLight'],corner_plant:['cream','lavender'],wall_plant:['cream','lavender'],plant:['cream'],small_plant:['cream'],trailing_plant:['cream'],open_book:['lavender','blush'],tea_mug:['cream'],jelly_lamp:['cream'],left_gallery:['blush','peri','pink'],back_gallery:['lavender','pink'],left_shelf:['lavender'],petal_sofa:['pink-cushions'],petal_armchair:['pink-cushions'],monstera:['cream'],daisy_table:['cream'],daisy_vase:['cream'],daisy_books:['book'],daisy_mug:['pink'],daisy_cookies:['cream']
};
const fallback=['bath-accent','kitchen-accent','gaming-accent','gaming-shell','kitchen-ceramic','kitchen-pink','kitchen-cream','cream','woodLight','lavender','pink','book'];
export function furniturePaintMaterials(asset,names){
 const available=new Set(names),chosen=(asset.paintMaterials||reviewed[asset.id]||(asset.building?['cream']:[])).filter(n=>available.has(n));
 if(chosen.length)return [...new Set(chosen)];
 const primary=fallback.find(n=>available.has(n));return primary?[primary]:names.length?[names[0]]:[];
}
export const validFurnitureColor=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
// Presets are resolved to the same per-instance fields used by custom colors,
// copying, undo and saved layouts. No shared template materials are changed.
export function applyFurnitureColorPreset(item,asset,id){
 const preset=asset.colorPresets?.find(p=>p.id===id);if(!preset)return false;
 const allowed=new Set((asset.colorParts||[]).map(p=>p.material)),entries=Object.entries(preset.colors);
 if(!entries.length||entries.some(([name,color])=>!allowed.has(name)||!validFurnitureColor(color)))return false;
 item.color=null;item.materialColors=Object.fromEntries(entries);return true;
}
export function setFurniturePrimaryColor(item,asset,color){
 if(color!==null&&!validFurnitureColor(color))return false;
 item.color=color;
 // A previously applied palette may override the primary material, too.
 for(const name of asset.paintMaterials||[])if(item.materialColors)delete item.materialColors[name];
 return true;
}
export function resetFurnitureColors(item){item.color=null;delete item.materialColors;}
export function furniturePartColor(item,asset,part){
 return item.materialColors?.[part.material]||((asset.paintMaterials||[]).includes(part.material)&&item.color)||part.color;
}
