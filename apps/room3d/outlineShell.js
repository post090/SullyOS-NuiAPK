import * as T from 'three';

// 背面外壳描边（inverted hull）：每个描边 mesh 罩一层沿法线外扩的墨色背面壳，
// 每个物件都有完整一圈轮廓线，物件相接处两侧各画各的边。正交相机下外扩量按
// 屏幕像素换算，远近粗细一致。宽度与墨色是全部壳材质共享的 uniform，由编辑器统一驱动。
// 笔触：部件级宽度变体——头发线粗、脸线细、其余标准，对应手绘描边的粗细节奏。
const shellWidth={value:.024};
const shellInk={value:new T.Color('#3a3542')};
// 新建壳的可见性跟随当前画风：编辑器只在 shellsOn 状态变化时全场景遍历一次，
// 之后新建的壳（角色/家具重建）直接读这个标记，避免在原始画风里漏出描边。
export const outlineShellsVisible={value:true};
const materialCache=new Map();
let hidden=null;

// 透明件（玻璃、纱帘）不画壳；材质数组里的透明组用全丢弃的占位材质保持分组对齐。
function hiddenMaterial(){
 if(!hidden){
  hidden=new T.MeshBasicMaterial({alphaTest:1,transparent:false,toneMapped:false});
  hidden.color.set(0);
 }
 return hidden;
}

function shellScale(source){
 if(!source)return 1;
 if(source.userData?.illustrationHair)return 1.45;
 if(source.userData?.illustrationFace)return .72;
 return 1;
}

function shellMaterial(source){
 if(!source||source.transparent)return hiddenMaterial();
 const cutout=source.map||source.alphaMap;
 const alphaTest=cutout?Math.max(source.alphaTest||0,.05):0;
 const scale=shellScale(source);
 const key=(source.map?.uuid||'')+'/'+(source.alphaMap?.uuid||'')+'/'+alphaTest+'/'+source.side+'/'+scale.toFixed(2);
 let material=materialCache.get(key);
 if(!material){
  material=new T.MeshBasicMaterial({side:T.BackSide,transparent:false,depthWrite:true,toneMapped:false});
  material.map=cutout||null;
  material.alphaTest=alphaTest;
  material.color=shellInk.value;
  material.onBeforeCompile=shader=>{
   shader.uniforms.shellWidth=shellWidth;
   // MeshBasicMaterial 的顶点着色器没有光照材质的 objectNormal chunk，
   // 直接用顶点 normal attribute；注入点在蒙皮 chunk 之前，外扩顶点随骨骼变换。
   shader.vertexShader='uniform float shellWidth;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed+=normal*shellWidth*'+scale.toFixed(2)+';');
  };
  material.customProgramCacheKey=()=>'outline-shell/'+key;
  materialCache.set(key,material);
 }
 return material;
}

// 幂等：同一根节点只处理一次（家具 rebuild 会生成新对象，标记随对象走）。
// 蒙皮部件复制骨骼绑定，壳跟随动作；壳作为原 mesh 的子节点，本地矩阵为单位阵。
export function addOutlineShells(root){
 if(!root||root.userData.outlineShells)return;
 root.userData.outlineShells=true;
 root.traverse(o=>{
  if(!o.isMesh||o.userData.outlineShell)return;
  const mats=Array.isArray(o.material)?o.material:[o.material];
  // 双面材质=无厚度薄片（发片、帘幔）：背面外壳几乎不出线，改标后处理描边。
  if(mats.length&&mats.every(m=>m&&m.side===T.DoubleSide)){o.userData.haloOutline=true;return;}
  const shells=mats.map(shellMaterial);
  if(shells.every(m=>m===hidden))return;
  const material=shells.length>1?shells:shells[0];
  const shell=o.isSkinnedMesh?new T.SkinnedMesh(o.geometry,material):new T.Mesh(o.geometry,material);
  if(o.isSkinnedMesh){shell.skeleton=o.skeleton;shell.bindMatrix.copy(o.bindMatrix);shell.bindMatrixInverse.copy(o.bindMatrixInverse);}
  shell.userData.outlineShell=true;
  shell.visible=outlineShellsVisible.value;
  shell.matrixAutoUpdate=false;
  o.add(shell);
 });
}

export const outlineShellWidth=shellWidth;
export function disposeOutlineShells(){for(const m of materialCache.values())m.dispose();materialCache.clear();hidden?.dispose();hidden=null;}
