import {furniturePartColor} from './furniturePaint.js';
import {PALETTE} from './model.js';
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function paintPanel(item,asset,defaultColor,partsOpen=false){
 const parts=asset.colorParts||[],primary=parts.find(p=>asset.paintMaterials?.includes(p.material));
 const color=primary?furniturePartColor(item,asset,primary):item.color||defaultColor||PALETTE[0];
 const partFields=parts.filter(p=>!asset.petSpecies||!asset.paintMaterials.includes(p.material)).map(p=>`<label class="h3-custom-color">${esc(p.label)}<input aria-label="${esc(p.label)}颜色" type="color" data-material-color="${esc(p.material)}" value="${esc(furniturePartColor(item,asset,p))}"></label>`).join('');
 const presets=(asset.colorPresets||[]).map(p=>`<button data-action="color-preset" data-value="${esc(p.id)}" aria-pressed="${parts.every(part=>furniturePartColor(item,asset,part).toLowerCase()===p.colors[part.material]?.toLowerCase())}"><span class="h3-preset-dots" aria-hidden="true">${Object.values(p.colors).slice(0,3).map(c=>`<i style="background:${esc(c)}"></i>`).join('')}</span>${esc(p.label)}</button>`).join('');
 const swatches=PALETTE.map(c=>`<button aria-label="换色 ${c}" aria-pressed="${color.toLowerCase()===c.toLowerCase()}" style="background:${c}" data-action="color" data-value="${c}"></button>`).join('');
 const details=asset.petSpecies?`<details class="h3-part-colors"${partsOpen?' open':''}><summary>自定义部位颜色</summary>${partFields}</details>`:partFields;
 const reset=parts.length?`<button data-action="${asset.petSpecies?'reset-all-colors':'reset-part-colors'}">${asset.petSpecies?'全部恢复原色':'局部恢复原色'}</button>`:'';
 return `${presets?`<div class="h3-color-presets" aria-label="${esc(asset.name)}预设配色">${presets}</div>`:''}<div class="h3-swatches">${swatches}<button class="reset" data-action="color" data-value="">主体原色</button></div><label class="h3-custom-color">自选主体颜色<input aria-label="自选家具颜色" type="color" data-furniture-color value="${esc(color)}"></label>${details}${reset}`;
}
