import * as T from 'three';
import { dropShadowUniforms } from './dropShadow';

// A single material pass: retain painted features, cutout hair, skinning and
// garment colours, but replace physical highlights with two painted tones.
// Standalone previews use a fixed illustration light; homes bind their shared
// lighting uniforms and receive the room shadows in the existing material pass.
const originals = new WeakMap<T.MeshStandardMaterial, {
  compile: T.MeshStandardMaterial['onBeforeCompile'];
  cache: T.MeshStandardMaterial['customProgramCacheKey'];
  toneMapped: boolean;
}>();
// 装饰代次：卸载→重装若沿用同一 cacheKey，three.js 会按 programs 缓存直接
// 复用旧程序、跳过 onBeforeCompile 且不重接 uniforms——重装时新建的 uniform
// 对象与贴图槽位全部悬空，脸部 SDF/落影采样器指向被其他材质复用过的纹理
// 单元，脸上会出十字状的假阴影（贴图线稿被当成距离场）。每次重装递增代次，
// 逼着走一次全新编译，uniform 重新接线。
const installGenerations = new WeakMap<T.MeshStandardMaterial, number>();
type RoomLightUniforms = {roomShadeTint:{value:T.Color};roomSunTint:{value:T.Color};roomBrightness:{value:number};roomSunContrast:{value:number}};
const roomTints = new WeakMap<T.MeshStandardMaterial, {value:T.Color}>();
const roomLights = new WeakMap<T.MeshStandardMaterial, {enabled:{value:number}; uniforms:RoomLightUniforms; cel:{value:number}}>();
// 主光方向（视野空间，表面→光），脸部 SDF 阴影的横向扫动阈值用；由家园编辑器每帧刷新。
export const characterLightDirection={value:new T.Vector3(0,0,1)};

// 明暗色带 ramp 图（256×4）：行=脸/皮肤/头发/身体，横轴 0=各部位影色 → 1=纯白。
// 程序生成默认值，与旧的硬编码影色一致；之后调色改这里的行渐变即可，不动 shader。
let characterRamp:T.Texture|null=null;
function getCharacterRamp(){
 if(!characterRamp){
  if(typeof document==='undefined'){
   // 非浏览器环境（单测编译 shader）：白色占位，影色保持不动。
   characterRamp=new T.DataTexture(new Uint8Array([255,255,255,255]),1,1);characterRamp.needsUpdate=true;
  }else{
   const canvas=document.createElement('canvas');canvas.width=256;canvas.height=4;
   const ctx=canvas.getContext('2d')!;
   const bands=[[.97,.92,1.05],[.94,.89,1.08],[.90,.83,1.13],[.94,.87,1.07]];
   bands.forEach((c,i)=>{
    const gradient=ctx.createLinearGradient(0,0,256,0);
    gradient.addColorStop(0,`rgb(${c.map(v=>Math.round(v*255)).join(',')})`);
    gradient.addColorStop(1,'#ffffff');
    ctx.fillStyle=gradient;ctx.fillRect(0,i,256,1);
   });
   characterRamp=new T.CanvasTexture(canvas);characterRamp.colorSpace=T.SRGBColorSpace;
  }
 }
 return characterRamp;
}

export function setCharacterRoomLighting(root:T.Object3D,uniforms:RoomLightUniforms,cel=false){
 root.traverse(object=>{
  if(!(object instanceof T.Mesh))return;
  object.receiveShadow=true;
  for(const material of Array.isArray(object.material)?object.material:[object.material]){
   if(!(material instanceof T.MeshStandardMaterial))continue;
   const room=roomLights.get(material);if(!room)continue;
   const celValue=cel?1:0;
   if(room.uniforms===uniforms){if(room.cel.value!==celValue)room.cel.value=celValue;continue;}
   room.enabled.value=1;room.uniforms=uniforms;room.cel.value=celValue;material.needsUpdate=true;
  }
 });
}

// Keep faces legible while giving all residents the same room colour cast.
// Standalone avatar previews keep a neutral tint.
export function setCharacterRoomTint(root:T.Object3D,color:string){
 root.traverse(object=>{
  if(!(object instanceof T.Mesh))return;
  for(const material of Array.isArray(object.material)?object.material:[object.material]){
   if(!(material instanceof T.MeshStandardMaterial))continue;
   const tint=roomTints.get(material);if(tint)tint.value.set(color);
  }
 });
}

export function setCharacterIllustration(root:T.Object3D, enabled=true) {
  const seen = new Set<T.Material>();
  root.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!(material instanceof T.MeshStandardMaterial) || seen.has(material)) continue;
      seen.add(material);
      const original = originals.get(material);
      if (!enabled) {
        if (!original) continue;
        material.onBeforeCompile = original.compile;
        material.customProgramCacheKey = original.cache;
        material.toneMapped = original.toneMapped;
        originals.delete(material);
        roomTints.delete(material);
        roomLights.delete(material);
      } else {
        if (original) continue;
        const saved = {compile:material.onBeforeCompile, cache:material.customProgramCacheKey, toneMapped:material.toneMapped};
        // 代次进 cacheKey：同一材质卸载再重装也拿到新 key，绕开 three.js 的
        // programs 缓存复用（见 installGenerations 注释），uniform 重编译重接线。
        const generation=(installGenerations.get(material)||0)+1;
        installGenerations.set(material,generation);
        const cacheKey = material.customProgramCacheKey()+'-g'+generation;
        originals.set(material,saved);
        const roomTint={value:new T.Color('#ffffff')};roomTints.set(material,roomTint);
        const room={enabled:{value:0},uniforms:{roomShadeTint:{value:new T.Color('#ffffff')},roomSunTint:{value:new T.Color('#ffffff')},roomBrightness:{value:1},roomSunContrast:{value:0},roomBounceUp:{value:new T.Color('#ffffff')},roomBounceDown:{value:new T.Color('#ffffff')}},cel:{value:0}};roomLights.set(material,room);
        const faceSdf = material.userData.faceSdf as T.Texture | undefined;
        const eyeMask = material.userData.eyeMask as T.Texture | undefined;
        // 色带行：脸/皮肤/头发/身体各占一行（采样 v 取行中心）。
        const rampRow = material.userData.illustrationFace ? '.125' : material.userData.illustrationSkin ? '.375' : material.userData.illustrationHair ? '.625' : '.875';
        material.toneMapped = false;
        material.onBeforeCompile = (shader,renderer) => {
          saved.compile.call(material,shader,renderer);
          shader.uniforms.characterRoomTint=roomTint;
          shader.uniforms.characterRoomEnabled=room.enabled;
          shader.uniforms.characterCel=room.cel;
          shader.uniforms.dropShadowMask=dropShadowUniforms.mask;
          shader.uniforms.dropShadowScreen=dropShadowUniforms.screen;
          shader.uniforms.dropShadowDrop=dropShadowUniforms.drop;
          shader.uniforms.dropShadowEnabled=dropShadowUniforms.enabled;
          if(faceSdf)shader.uniforms.faceSdfMap={value:faceSdf};
          if(eyeMask){
            shader.uniforms.eyeMaskMap={value:eyeMask};
            // 微光开关走 uniform 值：eyeMask 在装饰时被捕获进本闭包，事后删
            // userData.eyeMask 摘不掉已编译的发光分支——闭眼贴图上会残留一层
            // 睁眼形状的加亮斑（看着像眼白）。值开关不重编译，眨眼也不卡。
            if(!material.userData.eyeGlowUniform)material.userData.eyeGlowUniform={value:1};
            shader.uniforms.eyeGlowOn=material.userData.eyeGlowUniform;
          }
          shader.uniforms.rampMap={value:getCharacterRamp()};
          shader.uniforms.characterLightDirection=characterLightDirection;
          Object.assign(shader.uniforms,room.uniforms);
          shader.fragmentShader='uniform vec3 characterRoomTint;\nuniform float characterRoomEnabled;\nuniform float characterCel;\nuniform sampler2D dropShadowMask;\nuniform vec2 dropShadowScreen;\nuniform vec2 dropShadowDrop;\nuniform float dropShadowEnabled;\n'+(faceSdf?'uniform sampler2D faceSdfMap;\n':'')+(eyeMask?'uniform sampler2D eyeMaskMap;\nuniform float eyeGlowOn;\n':'')+'uniform sampler2D rampMap;\nuniform vec3 characterLightDirection;\nuniform vec3 roomShadeTint;\nuniform vec3 roomSunTint;\nuniform float roomBrightness;\nuniform float roomSunContrast;\nuniform vec3 roomBounceUp;\nuniform vec3 roomBounceDown;\n'+shader.fragmentShader;
          shader.fragmentShader = shader.fragmentShader.replace(
            'vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;',
            `
            vec3 inkLight = normalize(mat3(viewMatrix) * vec3(-0.45, 0.8, 0.65));
            float inkFacing = dot(normal, inkLight);
            float inkEdge = max(fwidth(inkFacing) * 1.5, 0.012);
            float inkLit = smoothstep(0.12 - inkEdge, 0.12 + inkEdge, inkFacing);
            float inkShade = mix(${material.userData.illustrationFace ? '0.90' : '0.70'}, 1.0, inkLit);
            vec3 inkTint = mix(vec3(0.96, 0.97, 1.0), vec3(1.0), inkLit);
            vec3 inkWeights = vec3(.2126,.7152,.0722);
            vec3 inkSkin = diffuseColor.rgb;
            ${material.userData.illustrationFace || material.userData.illustrationSkin ? `{
              // 卡通档压平贴图自带的静态阴影（腮影/侧影）：中间调按幂律提亮（保序不反色），
              // 五官线稿（极暗像素）与亮部保持不动——明暗交给光照色阶，贴图只留固有色与特征。
              float skinLum = dot(inkSkin,inkWeights);
              float midBand = smoothstep(.16,.26,skinLum)*(1.-smoothstep(.72,.88,skinLum));
              inkSkin = mix(inkSkin,inkSkin*pow(max(skinLum,.001),-.5),midBand*characterCel);
            }` : ''}
            ${material.userData.illustrationHair && material.map ? `{
              // 固有色渐变：发根→发梢的色带（贴图 UV 竖向，v 高为头顶），对应平涂
              // 「涂固有色」环节的分层上色——纯色块升级为有层次的动画质感。
              float rootBand = smoothstep(.45,.7,vMapUv.y);
              float tipBand = 1.-smoothstep(.15,.45,vMapUv.y);
              inkSkin *= mix(vec3(1.),vec3(.92,.91,1.03),rootBand*.34*characterCel);
              inkSkin *= mix(vec3(1.),vec3(1.05,1.0,.94),tipBand*.26*characterCel);
            }` : ''}
            ${(material.userData.illustrationFace || material.userData.illustrationSkin) && material.map ? `{
              // 皮肤固有色微渐变：上亮下微暖，大片肤色不再是一个死色（幅度极轻，不抢腮红）。
              float skinFall = smoothstep(.2,.8,vMapUv.y);
              inkSkin *= mix(vec3(.99,.975,1.005),vec3(1.02,1.01,.985),skinFall*.5*characterCel);
            }` : ''}
            vec3 inkPreview = inkSkin * inkShade * inkTint * characterRoomTint;
            float inkBase = max(dot(inkSkin,inkWeights),.001);
            float inkEnergy = dot(totalDiffuse,inkWeights)/inkBase;
            // directDiffuse includes window occlusion and the actual light direction.
            float inkDirect = dot(reflectedLight.directDiffuse,inkWeights)/inkBase;
            // 直射档量化成窄 AA 硬切：光打上来是整片一档，不随强度渐变——
            // 连续提亮是「物理感」的来源，卡通的色阶要一刀切。
            float inkSun = smoothstep(.30,.34,inkDirect);
            float inkRoomShade = mix(${material.userData.illustrationFace ? '.84' : '.68'},1.0,smoothstep(.18,.82,inkEnergy));
            // Toon rooms: the body snaps into two hard bands. The face skips the
            // physical band entirely—it stays fully lit and gets ALL of its
            // shadows from the SDF fringe term below (and the screen-space
            // fallback): physically-cut chin/under-nose shading reads as ugly
            // noise that no cel anime face has.
            // 身体档改以主光方向二分：dot(N,L) 在曲面上变化陡，色阶边界恒定
            // 锐利（能量场的缓变会把阈值线在屏幕上拉成软带）；能量档只兜底
            // 处理投影区——受影的亮面压回暗档，取两者更暗。
            ${material.userData.illustrationFace ? 'float celBand = 1.0;' : `
            float celFacing = dot(normal, normalize(characterLightDirection));
            float celFaceAA = max(fwidth(celFacing)*1.5, .02);
            float celBand = min(0.70 + 0.30*smoothstep(-celFaceAA, celFaceAA, celFacing),
                                0.70 + 0.30*smoothstep(.43,.47,inkEnergy));`}
            inkRoomShade = mix(inkRoomShade, celBand, characterCel);
            ${material.userData.faceSdf ? `
            // 脸部 SDF 阴影（原神式全范围扫动）：距离场由前发部件生成（faceSdf.ts），
            // 阈值面沿横向整体倾斜——光从右来，左半脸从发际线整片入影；正前光只剩
            // 刘海正下窄带。影边界随光呈对角弧线掠过额头，而非小幅平移。
            float faceField = texture2D(faceSdfMap, vMapUv).r * 2.0 - 1.0;
            vec3 faceRight = normalize(cross(vec3(0.,1.,0.), normal));
            float faceSweep = clamp(dot(normalize(characterLightDirection), faceRight), -1., 1.);
            float faceCut = -faceSweep * (vMapUv.x * 2.0 - 1.0) * .9;
            float faceAa = max(fwidth(faceField) * 1.5, 0.02);
            // 刘海正下的环带像画上去的一样恒定在影里，不随光位消失；
            // 随光扫动的只有发际线以下的大片影（faceCut 倾斜）。
            float bangShadow = 1.0 - smoothstep(-.25 - faceAa, -.25 + faceAa, faceField);
            float sweepShadow = 1.0 - smoothstep(faceCut - faceAa, faceCut + faceAa, faceField);
            float faceShadow = max(bangShadow, sweepShadow) * characterCel;
            inkRoomShade = mix(inkRoomShade, .75, faceShadow);` : material.userData.illustrationFace ? `
            // 屏幕空间落影（前发/衣片 → 脸）：按主光方向偏移采样剪影蒙版，命中处
            // 直接压进阴影档。无 SDF 的脸部走这条兜底——只在脸部材质生效：
            // 屏幕空间投影不区分深度，皮肤全身接收会把整个前发剪影投到腿上
            // （坐姿尤其诡异），所以身体与手都不接收。
            float dropMask = dropShadowEnabled > .5
              ? smoothstep(.35,.65,texture2D(dropShadowMask,(gl_FragCoord.xy/dropShadowScreen)+dropShadowDrop).a)
              : 0.0;
            inkRoomShade = mix(inkRoomShade, .80, dropMask);` : ''}
            // 漫反射：阴影色按表面朝向混入天空反弹/地面反弹色，别是单一死色。
            vec3 inkWorldN = normalize(vec3(dot(viewMatrix[0].xyz,normal),dot(viewMatrix[1].xyz,normal),dot(viewMatrix[2].xyz,normal)));
            vec3 inkBounce = mix(roomBounceDown,roomBounceUp,inkWorldN.y*.5+.5);
            vec3 inkRoomTint = mix(mix(roomShadeTint,inkBounce,.3),roomSunTint,inkSun);
            vec3 inkRoom = inkSkin * inkRoomShade * inkRoomTint * roomBrightness;
            // 色见本：阴影色各部位不一致——发影偏蓝紫更深、肤色影偏粉、衣身影偏紫；
            // 再按表面朝向混入环境反弹色（与场景阴影同逻辑），阴影不是全画面一个死色。
            float celDepth = clamp((1.0 - inkRoomShade) * 1.6, 0.0, 1.0);
            // 明暗色带采样 ramp 图（行=部位分区，暗端各部位影色、亮端纯白不
            // 动固有色）——直射不再额外提档，保持干净的二值色阶；
            // 环境反弹色照旧动态混入。色带数值从此与代码解耦。
            vec3 inkShadowTint = texture2D(rampMap, vec2(clamp(celDepth*2.0,0.0,1.0), ${rampRow})).rgb;
            inkShadowTint = mix(inkShadowTint, mix(vec3(1.0),inkBounce,celDepth), .22);
            inkRoom *= mix(vec3(1.0), inkShadowTint, celDepth * characterCel);
            ${material.userData.illustrationFace ? '' : `
            // 边缘光（脸部不加）：整圈轮廓都有窄硬亮带，受光侧弱、背光侧强，
            // 不挑光位。rim 吃环境反弹与直射色相（保亮度）：白天白亮、夕阳
            // 金粉、夜晚月光蓝紫——有色 rim 暗示灯光的存在，不一味提白。
            // 亮度整体加重一档：无光源时人物也有一圈可辨识的亮边。
            float inkBack = 1.0 - smoothstep(-.1,.1,dot(normal, normalize(characterLightDirection)));
            float inkGrazing = 1.0 - abs(dot(normal, normalize(vViewPosition)));
            float inkRim = smoothstep(.50,.60,inkGrazing) * mix(.45,1.15,inkBack);
            vec3 inkRimTone = mix(inkBounce, roomSunTint, inkSun*.6);
            inkRimTone /= max(dot(inkRimTone, inkWeights), .56);
            inkRoom = mix(inkRoom,(inkSkin*1.30+vec3(.07))*inkRimTone,inkRim*characterCel);`}
            vec3 outgoingLight = mix(inkPreview,inkRoom,characterRoomEnabled);
            ${eyeMask ? `
            // 眼睛微光：眼底一层若有若无的自发光（夜里「眼里有光」）。
            // 只加亮不参与明暗档，白天几乎无感，暗处隐约可见。
            outgoingLight += (inkSkin*.14+vec3(.03))*texture2D(eyeMaskMap,vMapUv).a*characterCel*eyeGlowOn;` : ''}
            `,
          );
        };
        material.customProgramCacheKey = () => cacheKey + '-character-illustration-v18-' + (material.userData.illustrationFace ? (material.userData.eyeMask ? (material.userData.faceSdf ? 'face-sdf-glow' : 'face-glow') : (material.userData.faceSdf ? 'face-sdf' : 'face')) : material.userData.illustrationSkin ? 'skin' : material.userData.illustrationHair ? 'hair' : 'body');
      }
      material.userData.characterIllustration = enabled;
      material.needsUpdate = true;
    }
  });
}
