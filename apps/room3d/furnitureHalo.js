import * as T from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';

// Union mask outlines only visible furniture silhouettes, never mesh seams.
// Render the normal scene directly, so its color management remains unchanged.
export function createFurnitureHalo(renderer,scene,camera){
 const target=new T.WebGLRenderTarget(1,1,{minFilter:T.LinearFilter,magFilter:T.LinearFilter});
 const size=new T.Vector2(),cache=new Map(),bounds=new T.Box3(),point=new T.Vector3(),scissor=new T.Vector4();
 let coverage=1;
 const material=new T.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,
  uniforms:{mask:{value:target.texture},pixel:{value:new T.Vector2()},ink:{value:new T.Color('#756478')}},
  vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader:`uniform sampler2D mask;uniform vec2 pixel;uniform vec3 ink;varying vec2 vUv;
   void main(){
    float center=texture2D(mask,vUv).r,edge=0.;
    for(int i=0;i<8;i++){
     float a=float(i)*6.2831853/8.;vec2 d=vec2(cos(a),sin(a))*pixel;
     edge=max(edge,texture2D(mask,vUv+d*.65).r);
    }
    float line=clamp(edge-center,0.,1.)*.48;
    gl_FragColor=vec4(ink,line);
    #include <colorspace_fragment>
   }`});
 const quad=new FullScreenQuad(material);
 function maskMaterial(source,selected){
  // Solid color sections all produce the same binary mask. Share by culling
  // mode instead of allocating one shader material for every furniture color.
  const solid=!source.transparent&&!source.alphaTest&&!source.alphaHash&&!source.alphaMap;
  const key=(solid?'solid/'+source.side:source.uuid)+'/'+selected;let entry=cache.get(key);
  if(!entry){
   const m=new T.MeshBasicMaterial({color:selected?0xffffff:0x000000,side:source.side,map:solid?null:source.map,alphaMap:source.alphaMap,alphaTest:source.alphaTest,depthWrite:true});
   m.toneMapped=false;
   if(selected)m.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <alphatest_fragment>','#include <alphatest_fragment>\ndiffuseColor.rgb=vec3(1.);');};
   entry={material:m,used:true};cache.set(key,entry);
  }
  entry.used=true;return entry.material;
 }
 function meshMask(mesh,selected){
  const source=mesh.material;
  if(!Array.isArray(source))return maskMaterial(source,selected);
  // A single material draws all geometry groups in one call. Only collapse
  // fully covered, contiguous groups: sparse groups may intentionally hide faces.
  const count=mesh.geometry.index?.count??mesh.geometry.attributes.position.count;
  let end=0;
  const covered=mesh.geometry.groups.every(g=>{if(g.start!==end||!source[g.materialIndex])return false;end+=g.count;return true;})&&end===count;
  const opaque=source.length&&source.every(m=>m.visible&&!m.transparent&&!m.alphaTest&&!m.alphaHash&&!m.alphaMap&&m.side===source[0].side);
  if(covered&&opaque)return maskMaterial(source[0],selected);
  return source.map(m=>maskMaterial(m,selected));
 }
 return {
  render(objects){
   renderer.render(scene,camera);
   if(!objects.length){coverage=0;return;}
   renderer.getDrawingBufferSize(size);
   if(target.width!==size.x||target.height!==size.y)target.setSize(size.x,size.y);
   material.uniforms.pixel.value.set(renderer.getPixelRatio()/size.x,renderer.getPixelRatio()/size.y);
   const selected=new Set();for(const root of objects)root.traverse(o=>{if(o.isMesh)selected.add(o)});
   bounds.makeEmpty();for(const root of objects)bounds.expandByObject(root);
   if(bounds.isEmpty()){coverage=0;return;}
   let left=1,right=-1,bottom=1,top=-1;
   for(let i=0;i<8;i++){
    point.set(i&1?bounds.max.x:bounds.min.x,i&2?bounds.max.y:bounds.min.y,i&4?bounds.max.z:bounds.min.z).project(camera);
    left=Math.min(left,point.x);right=Math.max(right,point.x);bottom=Math.min(bottom,point.y);top=Math.max(top,point.y);
   }
   // Four physical pixels cover the 0.65 CSS-pixel outline and linear filtering.
   const x=Math.max(0,Math.floor((left+1)*size.x/2)-4),y=Math.max(0,Math.floor((bottom+1)*size.y/2)-4);
   const w=Math.max(0,Math.min(size.x,Math.ceil((right+1)*size.x/2)+4)-x),h=Math.max(0,Math.min(size.y,Math.ceil((top+1)*size.y/2)+4)-y);
   coverage=w*h/(size.x*size.y);if(!w||!h)return;
   const restore=[],background=scene.background,shadows=renderer.shadowMap.enabled,autoClear=renderer.autoClear;
   const clearColor=renderer.getClearColor(new T.Color()),clearAlpha=renderer.getClearAlpha();
   for(const entry of cache.values())entry.used=false;
   try{
    scene.background=new T.Color(0);renderer.shadowMap.enabled=false;
    scene.traverse(o=>{
     if(o.isMesh){restore.push([o,o.material,o.visible]);o.material=meshMask(o,selected.has(o));}
     else if(o.isLine||o.isSprite||o.isPoints){restore.push([o,o.material,o.visible]);o.visible=false;}
    });
    // Clear the full mask to prevent stale outlines after moving the camera.
    target.scissorTest=false;renderer.setRenderTarget(target);renderer.setClearColor(0,1);renderer.clear();
    target.scissor.set(x,y,w,h);target.scissorTest=true;renderer.setRenderTarget(target);
    renderer.autoClear=false;renderer.render(scene,camera);
   }finally{
    for(const [o,m,v] of restore){o.material=m;o.visible=v;}
    scene.background=background;renderer.shadowMap.enabled=shadows;renderer.autoClear=autoClear;renderer.setClearColor(clearColor,clearAlpha);renderer.setRenderTarget(null);
   }
   renderer.autoClear=false;
   renderer.getScissor(scissor);const scissorTest=renderer.getScissorTest(),ratio=renderer.getPixelRatio();
   renderer.setScissor(x/ratio,y/ratio,w/ratio,h/ratio);renderer.setScissorTest(true);
   try{quad.render(renderer)}finally{renderer.autoClear=autoClear;renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);}
   for(const [key,entry] of cache)if(!entry.used){entry.material.dispose();cache.delete(key);}
  },
  inspect:()=>({screenCoverage:coverage,maskMaterials:cache.size}),
  dispose(){target.dispose();material.dispose();quad.dispose();for(const e of cache.values())e.material.dispose();cache.clear();}
 };
}
