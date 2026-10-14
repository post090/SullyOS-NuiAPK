import * as T from 'three';

// Analytic, depth-tested light halos. All lamps share one draw and no textures.
// Points are omitted by the furniture outline mask, so they cannot grow outlines.
// 夜里灯具同时点亮真实点光源（常驻 4 盏、无阴影）：地面与墙面出现暖光池，
// 人物走近也会被照亮。灯常驻场景避免运行时增删光源触发全材质重编译。
export function createLampGlow(){
 const limit=16,lightLimit=4,positions=new Float32Array(limit*3),diameters=new Float32Array(limit);
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));
 geometry.setAttribute('diameter',new T.BufferAttribute(diameters,1).setUsage(T.DynamicDrawUsage));
 geometry.setDrawRange(0,0);
 const material=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,blending:T.AdditiveBlending,toneMapped:false,
  uniforms:{viewportHeight:{value:1},glowColor:{value:new T.Color().setRGB(1,.63,.28)}},
  vertexShader:`attribute float diameter;uniform float viewportHeight;
   void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
    gl_PointSize=diameter*projectionMatrix[1][1]*viewportHeight*.5;}`,
  fragmentShader:`uniform vec3 glowColor;
   void main(){float r=length(gl_PointCoord-.5)*2.;
    float edge=1.-smoothstep(.65,1.,r);
    float halo=(exp(-r*r*5.)*.13+exp(-r*r*22.)*.19)*edge;
    gl_FragColor=vec4(glowColor,halo);
    #include <colorspace_fragment>
   }`});
 const points=new T.Points(geometry,material);points.frustumCulled=false;points.raycast=()=>{};
 const lights=Array.from({length:lightLimit},()=>{const light=new T.PointLight('#ffbe78',0,6,2);light.castShadow=false;return light;});
 const root=new T.Group();root.name='night-lamp-glow';root.add(points,...lights);root.visible=false;
 let sources=[],count=0;const point=new T.Vector3(),scale=new T.Vector3();
 const visible=o=>{for(;o;o=o.parent)if(!o.visible)return false;return true;};
 return {root,
  // 调色：光晕与点光源同色。传入 sRGB 十六进制，three 的 Color 构造会转到工作色彩域。
  setColor(color){material.uniforms.glowColor.value.set(color);for(const light of lights)light.color.set(color);},
  // 恢复出厂暖光：光晕常数与点光源初始色各归各位。
  resetColor(){material.uniforms.glowColor.value.setRGB(1,.63,.28);for(const light of lights)light.color.set('#ffbe78');},
  sync(objects){
   sources=[];
   for(const object of objects)object.traverse(mesh=>{
    if(!mesh.isMesh||Array.isArray(mesh.material)||sources.length>=limit)return;
    const m=mesh.material,e=m.emissive;
    // Screen, jellyfish and water emissions are not warm household lamps.
    if(!e||m.emissiveIntensity<.25||e.r<.25||e.r<e.b*1.35||!/(glow|lamp|bulb|light)/i.test(m.name))return;
    mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox;
    if(!box||box.isEmpty())return;
    sources.push({mesh,center:box.getCenter(new T.Vector3()),size:box.getSize(new T.Vector3())});
   });
  },
  update(enabled,viewportHeight){
  count=0;let lit=0;
  for(const s of sources){
   if(!visible(s.mesh))continue;
   s.mesh.updateWorldMatrix(true,false);point.copy(s.center).applyMatrix4(s.mesh.matrixWorld);s.mesh.getWorldScale(scale);
   if(lit<lightLimit){const light=lights[lit++];light.position.copy(point);light.position.y+=.3;light.intensity=enabled?1.1:0;}
   point.toArray(positions,count*3);
   diameters[count]=T.MathUtils.clamp(Math.max(s.size.x*scale.x,s.size.y*scale.y,s.size.z*scale.z)*3.4,.65,2.3);count++;
  }
  for(let i=lit;i<lightLimit;i++)lights[i].intensity=0;
  root.visible=enabled&&count>0;geometry.setDrawRange(0,count);
  geometry.attributes.position.needsUpdate=true;geometry.attributes.diameter.needsUpdate=true;
  material.uniforms.viewportHeight.value=viewportHeight;
 },
  inspect:()=>({count,visible:root.visible,limit,positions:Array.from({length:count},(_,i)=>Array.from(positions.slice(i*3,i*3+3)))}),
  dispose(){sources=[];count=0;root.visible=false;root.removeFromParent();geometry.dispose();material.dispose();}
 };
}
