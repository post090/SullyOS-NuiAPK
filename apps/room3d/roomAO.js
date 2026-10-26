import * as T from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';

// 场景环境光遮蔽（SAO 式屏幕空间采样），给墙角、家具底部补接触阴影。
// 正交相机深度线性：viewZ = near + depth*(far-near)，无需透视重建，稳定可靠。
// 采样只认「邻域更近 + 高差适中」的几何——隔墙另一侧的房间不会污染本侧。
// 人物：不投射遮蔽——深度遍临时隐藏角色/宠物根，遮蔽只由场景几何产生，
// 人物身边不出接触暗晕（人物自己的落影交给 dropShadow，不与 AO 打架）。
// 也不接收——深度遍里没有人物，角色像素算出的遮蔽其实是身后家具的纹路，
// 会像「透过身体看到身后家具」一样印在角色身上；蒙版遍在同一深度缓冲上
// 把人物补画成纯白，合成时蒙版像素跳过遮蔽。
// 卡通画风：遮蔽二值化为硬边色带，乘冷调阴影色而非压黑；原始画风：平滑衰减。
export function createRoomAO(renderer,scene,camera){
 let image=null,depthTarget=null,width=0,height=0;
 const size=new T.Vector2();
 const vertexShader='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
 const material=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,
  uniforms:{image:{value:null},depth:{value:null},mask:{value:null},
   uNear:{value:.1},uFar:{value:200},uRadius:{value:.02},uStrength:{value:.5},
   uShade:{value:new T.Color('#b9b6dd')},uToon:{value:1}},
  vertexShader,
  fragmentShader:`varying vec2 vUv;uniform sampler2D image;uniform sampler2D depth;uniform sampler2D mask;
   uniform float uNear,uFar,uRadius,uStrength,uToon;uniform vec3 uShade;
   vec3 srgbToLinear(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(.04045,c));}
   float zOf(vec2 uv){return uNear+texture2D(depth,uv).x*(uFar-uNear);}
   void main(){
    vec3 base=srgbToLinear(texture2D(image,vUv).rgb);
    float zc=zOf(vUv);
    float occ=0.;float wsum=0.;
    for(int i=0;i<12;i++){
     float a=float(i)*6.2831853/12.;
     for(int r=1;r<=3;r++){
      float w=float(r)/3.;
      vec2 off=vec2(cos(a),sin(a))*uRadius*w;
      float dz=zOf(vUv+off)-zc;
      // 近处遮挡计入（先给一点点自遮挡偏置）；高差超过一个家具高度后衰减，
      // 隔墙/分层看到的另一间房不会在本侧投出假阴影。
      occ+=clamp((dz-.015)/.05,0.,1.)*(1.-smoothstep(.45,1.1,dz));
      wsum+=1.;
     }
    }
    occ/=max(wsum,1.);
    // 人物像素跳过遮蔽合成（蒙版由含人遍在同一深度上补画，见 render）——
    // 深度遍藏了人物，角色像素算出的遮蔽其实是身后家具的纹路。
    occ*=1.-step(.5,texture2D(mask,vUv).r);
    vec3 col;
    if(uToon>.5){
     // 卡渲：二值遮蔽带，smoothstep 出干净边缘；乘冷调阴影色（同色阶暗档思路）。
     col=mix(base,base*uShade,smoothstep(.30,.55,occ)*uStrength);
    }else{
     col=base*(1.-occ*uStrength);
    }
    gl_FragColor=vec4(col,1.);
    #include <colorspace_fragment>
   }`});
 const quad=new FullScreenQuad(material);
 // 人物蒙版：画在独立图层（30 避开 dropShadow 的 1 与 homelyForeground 的 31），
 // 换纯白不透明材质——蒙版只认覆盖，不认角色贴图与明暗。
 const MASK_LAYER=30,swap=[];
 const maskMaterial=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false,depthWrite:false});
 return {
  render(roots,{toon=true,strength=.5,radius=.14}={}){
   renderer.getDrawingBufferSize(size);
   const w=size.x,h=size.y;
   if(width!==w||height!==h){
    image?.dispose();depthTarget?.dispose();
    image=new T.FramebufferTexture(w,h);image.colorSpace=T.NoColorSpace;image.minFilter=image.magFilter=T.LinearFilter;
    const hw=Math.max(8,Math.ceil(w/2)),hh=Math.max(8,Math.ceil(h/2));
   // 深度值不可插值：ES 3.0 对深度纹理做 LINEAR 过滤是未定义行为，部分移动
   // GPU 会返回脏值——AO 沿轮廓边缘抹出脏带（正是「描边不干净」的来源），必须 Nearest。
   const depthTexture=new T.DepthTexture(hw,hh);depthTexture.minFilter=depthTexture.magFilter=T.NearestFilter;
    depthTarget=new T.WebGLRenderTarget(hw,hh,{depthTexture});
    material.uniforms.image.value=image;
    material.uniforms.depth.value=depthTexture;
    material.uniforms.mask.value=depthTarget.texture;
    width=w;height=h;
   }
   material.uniforms.uNear.value=camera.near;material.uniforms.uFar.value=camera.far;
   // 正交视野宽 = (right-left)/zoom；半径换算成屏幕 UV 比例（RT 与屏幕同宽高比）。
   material.uniforms.uRadius.value=Math.max(.004,radius/((camera.right-camera.left)/camera.zoom));
   material.uniforms.uStrength.value=strength;
   material.uniforms.uToon.value=toon?1:0;
   const target=renderer.getRenderTarget(),autoClear=renderer.autoClear,background=scene.background,shadows=renderer.shadowMap.enabled;
   const clearColor=renderer.getClearColor(new T.Color()),clearAlpha=renderer.getClearAlpha();
   const hidden=[];
   try{
    renderer.copyFramebufferToTexture(image);
    // 人物不投射遮蔽：深度遍临时藏起角色与宠物根（只藏可见的，其余本来就看不见）。
    // 藏的同时把人物网格换成蒙版材质、挪到独立图层，深度遍后补画蒙版。
    for(const root of roots){
     if(!root?.visible)continue;
     hidden.push(root);root.visible=false;
     root.traverse(o=>{if(o.isMesh){swap.push([o,o.material]);o.material=maskMaterial;o.layers.enable(MASK_LAYER);}});
    }
    scene.background=null;renderer.shadowMap.enabled=false;renderer.autoClear=true;
    // 半分辨率渲一遍场景取深度：AO 是低频信息，1/2 深度足够，省 3/4 像素成本。
    renderer.setRenderTarget(depthTarget);renderer.render(scene,camera);
    for(const root of hidden)root.visible=true;hidden.length=0;
    // 人物蒙版：只清颜色不清深度——保住场景深度供 AO 采样与深度测试，人物
    // 过深度测试的部分才进蒙版（被身前家具挡住的自动剔除），深度不写回。
    renderer.setClearColor(0x000000,0);renderer.autoClear=false;
    renderer.clear(true,false,false);
    if(swap.length){
     const layerMask=camera.layers.mask;
     camera.layers.set(MASK_LAYER);
     renderer.render(scene,camera);
     camera.layers.mask=layerMask;
    }
    for(const [mesh,material] of swap){mesh.material=material;mesh.layers.disable(MASK_LAYER);}
    swap.length=0;
    renderer.setRenderTarget(null);
    quad.render(renderer);
   }finally{
    for(const root of hidden)root.visible=true;
    for(const [mesh,material] of swap){mesh.material=material;mesh.layers.disable(MASK_LAYER);}
    swap.length=0;
    scene.background=background;renderer.shadowMap.enabled=shadows;renderer.autoClear=autoClear;
    renderer.setClearColor(clearColor,clearAlpha);renderer.setRenderTarget(target);
   }
  },
  dispose(){image?.dispose();depthTarget?.dispose();quad.dispose();material.dispose();image=depthTarget=null;width=height=0;}
 };
}
