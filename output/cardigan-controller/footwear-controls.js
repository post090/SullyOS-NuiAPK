import {bodyOutsideBand} from './body-occlusion.js';
export function setupFootwear({model}) {
 let meta;model.traverse(o=>{if(o.userData.footwear)meta=o.userData.footwear;});if(!meta)return;
 const body=model.getObjectByName('Mesh_0'),original=body.geometry,pieces=[];
 // Clip the hidden skin at a level inside the shoe. Dropping whole triangles
 // leaves long white teeth along the cuff on this low-poly body.
 const covered=meta.opening?bodyOutsideBand(original,-Infinity,meta.opening):original;
 model.traverse(o=>{if(o.isMesh&&o.name.startsWith('Footwear_'))pieces.push(o);});
 const toggle=document.getElementById('clothing');toggle.parentElement.lastChild.textContent='显示鞋子';
 function update(){
  pieces.forEach(o=>o.visible=toggle.checked);
  body.geometry=toggle.checked?covered:original;
  body.parent.position.y=toggle.checked?meta.groundOffset:0;
 }
 toggle.onchange=update;
 document.getElementById('handles').checked=false;document.getElementById('handles').dispatchEvent(new Event('change'));
 document.querySelector('header b').textContent='鞋履 · 姿势工作台';document.title='鞋履 · 姿势工作台';
 const panel=document.createElement('section');panel.id='garment-fit';panel.innerHTML=`<h2>${meta.label}</h2><p>切换正面、侧面和动作，检查鞋口与脚背。</p>`;document.getElementById('presets').before(panel);
 update();window.footwear={meta};window.render_game_to_text=()=>JSON.stringify({footwear:meta.id,visible:toggle.checked,groundOffset:body.parent.position.y});
}
