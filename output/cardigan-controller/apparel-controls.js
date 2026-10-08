export function setupApparel({model}) {
 let meta;model.traverse(o=>{if(o.userData.apparel)meta=o.userData.apparel;});if(!meta)return;
 const body=model.getObjectByName('Mesh_0'),original=body.geometry,covered=original.clone(),hide=new Set(meta.coveredBodyTriangles??[]),indices=[];
 for(let i=0;i<original.index.count;i+=3)if(!hide.has(i/3))indices.push(original.index.getX(i),original.index.getX(i+1),original.index.getX(i+2));covered.setIndex(indices);
 const pieces=[];model.traverse(o=>{if(o.isMesh&&o.name.startsWith('Apparel_'))pieces.push(o);});
 const toggle=document.getElementById('clothing');toggle.parentElement.lastChild.textContent=meta.accessory?'显示配饰':meta.head?'显示头饰':'显示服装';
 toggle.onchange=()=>{pieces.forEach(o=>o.visible=toggle.checked);body.geometry=toggle.checked?covered:original;};toggle.onchange();
 document.getElementById('handles').checked=false;document.getElementById('handles').dispatchEvent(new Event('change'));
 document.querySelector('header b').textContent='服装 · 姿势工作台';document.title=meta.label+' · 试穿';
 const panel=document.createElement('section');panel.id='garment-fit';const heading=document.createElement('h2');heading.textContent=meta.label;const info=document.createElement('p');info.textContent=meta.accessory?'独立配饰，可随上身动作一起活动。':'切换姿势，检查领口、袖口和衣摆。';panel.append(heading,info);document.getElementById('presets').before(panel);
 window.apparel={meta};window.render_game_to_text=()=>JSON.stringify({apparel:meta.id,visible:toggle.checked,triangles:meta.triangles});
}
