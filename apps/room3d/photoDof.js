import * as T from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';

// 拍照景深：从屏幕拷贝「成品图」（已含描边、辉光等全部后期），另渲一遍带深度的
// 场景取深度，成品图三级降采样模糊（1/4 → 1/8 → 1/16），合成时按「像素深度与
// 焦点深度之差」混合清晰与两级模糊（正交相机深度线性）。仅拍照模式出帧时跑。
// 色彩域约定：只有第一级从 sRGB 成品图解码到线性；之后 RT 之间全部线性传递，
// 最后合成时统一编码回 sRGB——中途任何一级再做解码都会把亮度层层压黑（黑雾）。
// 两级模糊层按虚化程度交叉过渡：描边等高频深色内容在 1/16 层充分化开；
// bokeh 在 1/4 层做亮点圆盘扩散，随链继续柔化；strength 是模糊半径的整体倍率。
export function createPhotoDof(renderer,scene,camera){
 let image=null,depthTarget=null,blurA=null,bokehRT=null,blurB=null,blurC=null,width=0,height=0;const size=new T.Vector2();
 const vertexShader='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
 const blurMaterial=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,
  uniforms:{image:{value:null},pixel:{value:new T.Vector2()},decode:{value:0}},
  vertexShader,
  fragmentShader:`varying vec2 vUv;uniform sampler2D image;uniform vec2 pixel;uniform float decode;
   // sRGB→线性：three 的 sRGBTransferEOTF 签名是 vec4，手写 vec3 版更省事；
   // 整条链只在第一级解码一次，之后保持线性域，避免逐级重复解码把画面压黑。
   vec3 srgbToLinear(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(.04045,c));}
   vec3 fetch(vec2 p){vec3 c=texture2D(image,p).rgb;return decode>.5?srgbToLinear(c):c;}
   void main(){vec3 c=fetch(vUv);for(int i=0;i<8;i++){float a=float(i)*6.2831853/8.;c+=fetch(vUv+vec2(cos(a),sin(a))*pixel*2.);}gl_FragColor=vec4(c/9.,1.);}`});
 // 光斑：对邻域做圆盘 gather——命中亮点的采样数决定覆盖，天然形成硬边圆盘；
 // 光斑只加进模糊链（blurA 之后，线性域），焦点区合成时取清晰图，光斑自动只留在虚化区。
 const bokehMaterial=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,
  uniforms:{image:{value:null},pixel:{value:new T.Vector2()},amount:{value:0}},
  vertexShader,
  fragmentShader:`varying vec2 vUv;uniform sampler2D image;uniform vec2 pixel;uniform float amount;
   float lum(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
   void main(){
    vec3 base=texture2D(image,vUv).rgb;
    if(amount<=0.001){gl_FragColor=vec4(base,1.);return;}
    vec3 acc=vec3(0.);float hits=0.;
    for(int i=0;i<24;i++){
     float a=float(i)*6.2831853/24.;
     for(int r=1;r<=4;r++){
      float rr=float(r)/4.;
      vec3 s=texture2D(image,vUv+vec2(cos(a),sin(a))*pixel*7.*rr).rgb;
      if(lum(s)>.68){acc+=s;hits+=1.;}
     }
    }
    if(hits>3.){
     // 命中占比高（采样盘大部分落在亮源内）→ 光斑主体；边缘命中少 → 圆盘硬边。
     float disk=smoothstep(.06,.5,hits/96.);
     gl_FragColor=vec4(base+acc/hits*disk*amount*.9,1.);
    }else gl_FragColor=vec4(base,1.);
   }`});
 const material=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,
  uniforms:{image:{value:null},blurredNear:{value:null},blurredFar:{value:null},depth:{value:null},focus:{value:8},aperture:{value:1},range:{value:3},near:{value:.1},far:{value:200}},
  vertexShader,
  fragmentShader:`varying vec2 vUv;uniform sampler2D image;uniform sampler2D blurredNear;uniform sampler2D blurredFar;uniform sampler2D depth;uniform float focus;uniform float aperture;uniform float range;uniform float near;uniform float far;
   vec3 srgbToLinear(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(.04045,c));}
   void main(){
    float z=texture2D(depth,vUv).x;
    float d=near+z*(far-near);
    float coc=smoothstep(.15,1.,clamp(abs(d-focus)/max(range,.001),0.,1.))*clamp(aperture,0.,1.);
    // 两级模糊按虚化程度交叉：轻度虚化用 1/8 层（保住中景结构），
    // 深度虚化过渡到 1/16 层——描边等高频深色内容在此充分化开。
    // 两层 RT 都已是线性域，直接取值；成品图在此时才解码到线性。
    vec3 blur=mix(texture2D(blurredNear,vUv).rgb,texture2D(blurredFar,vUv).rgb,smoothstep(.3,.8,coc));
    vec3 c=mix(srgbToLinear(texture2D(image,vUv).rgb),blur,coc);
    gl_FragColor=vec4(c,1.);
    #include <colorspace_fragment>
   }`});
 const quad=new FullScreenQuad(material),blurQuad=new FullScreenQuad(blurMaterial),bokehQuad=new FullScreenQuad(bokehMaterial);
 return {
  render({focus,aperture,range,strength=1,bokeh=0}){
   renderer.getDrawingBufferSize(size);
   if(width!==size.x||height!==size.y){
    image?.dispose();depthTarget?.dispose();blurA?.dispose();bokehRT?.dispose();blurB?.dispose();blurC?.dispose();width=size.x;height=size.y;
    image=new T.FramebufferTexture(width,height);image.colorSpace=T.NoColorSpace;image.minFilter=image.magFilter=T.LinearFilter;
    depthTarget=new T.WebGLRenderTarget(width,height,{depthTexture:new T.DepthTexture(width,height)});
    blurA=new T.WebGLRenderTarget(Math.ceil(width/4),Math.ceil(height/4),{depthBuffer:false});
    bokehRT=new T.WebGLRenderTarget(Math.ceil(width/4),Math.ceil(height/4),{depthBuffer:false});
    blurB=new T.WebGLRenderTarget(Math.ceil(width/8),Math.ceil(height/8),{depthBuffer:false});
    blurC=new T.WebGLRenderTarget(Math.ceil(width/16),Math.ceil(height/16),{depthBuffer:false});
    material.uniforms.image.value=blurMaterial.uniforms.image.value=image;
    material.uniforms.depth.value=depthTarget.depthTexture;
    material.uniforms.blurredNear.value=blurB.texture;
    material.uniforms.blurredFar.value=blurC.texture;
   }
   material.uniforms.near.value=camera.near;material.uniforms.far.value=camera.far;
   material.uniforms.focus.value=focus;material.uniforms.aperture.value=aperture;material.uniforms.range.value=range;
   const clear=renderer.autoClear,target=renderer.getRenderTarget();renderer.autoClear=true;
   try{
    renderer.copyFramebufferToTexture(image);
    renderer.setRenderTarget(depthTarget);renderer.render(scene,camera);
    const radius=Math.max(.25,strength);
    // 第一级：从 sRGB 成品图解码到线性；之后各级都在线性域，不再解码。
    blurMaterial.uniforms.image.value=image;blurMaterial.uniforms.decode.value=1;
    blurMaterial.uniforms.pixel.value.set(2/blurA.width*radius,2/blurA.height*radius);
    renderer.setRenderTarget(blurA);blurQuad.render(renderer);
    blurMaterial.uniforms.decode.value=0;
    if(bokeh>0.001){
     bokehMaterial.uniforms.image.value=blurA.texture;bokehMaterial.uniforms.pixel.value.set(1/blurA.width,1/blurA.height);
     bokehMaterial.uniforms.amount.value=bokeh;
     renderer.setRenderTarget(bokehRT);bokehQuad.render(renderer);
     blurMaterial.uniforms.image.value=bokehRT.texture;
    }else blurMaterial.uniforms.image.value=blurA.texture;
    blurMaterial.uniforms.pixel.value.set(2/blurB.width*radius,2/blurB.height*radius);
    renderer.setRenderTarget(blurB);blurQuad.render(renderer);
    blurMaterial.uniforms.image.value=blurB.texture;
    blurMaterial.uniforms.pixel.value.set(2/blurC.width*radius,2/blurC.height*radius);
    renderer.setRenderTarget(blurC);blurQuad.render(renderer);
    renderer.setRenderTarget(null);quad.render(renderer);
   }finally{renderer.setRenderTarget(target);renderer.autoClear=clear;}
  },
  dispose(){image?.dispose();depthTarget?.dispose();blurA?.dispose();bokehRT?.dispose();blurB?.dispose();blurC?.dispose();quad.dispose();blurQuad.dispose();bokehQuad.dispose();blurMaterial.dispose();bokehMaterial.dispose();material.dispose();}
 };
}
