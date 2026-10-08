import * as T from 'three';

// Analytic, depth-tested light halos. All lamps share one draw and no textures.
// Points are omitted by the furniture outline mask, so they cannot grow outlines.
export function createLampGlow(){
 const limit=16,positions=new Float32Array(limit*3),diameters=new Float32Array(limit);
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));
 geometry.setAttribute('diameter',new T.BufferAttribute(diameters,1).setUsage(T.DynamicDrawUsage));
 geometry.setDrawRange(0,0);
 const material=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,blending:T.AdditiveBlending,toneMapped:false,
  uniforms:{viewportHeight:{value:1}},
  vertexShader:`attribute float diameter;uniform float viewportHeight;
   void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
    gl_PointSize=diameter*projectionMatrix[1][1]*viewportHeight*.5;}`,
  fragmentShader:`void main(){float r=length(gl_PointCoord-.5)*2.;
   float edge=1.-smoothstep(.65,1.,r);
   float halo=(exp(-r*r*5.)*.17+exp(-r*r*22.)*.23)*edge;
   gl_FragColor=vec4(1.,.63,.28,halo);
   #include <colorspace_fragment>
  }`});
 const root=new T.Points(geometry,material);root.name='night-lamp-glow';root.frustumCulled=false;root.visible=false;root.raycast=()=>{};
 let sources=[],count=0;const point=new T.Vector3(),scale=new T.Vector3();
 const visible=o=>{for(;o;o=o.parent)if(!o.visible)return false;return true;};
 return {root,
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
   count=0;root.visible=enabled&&sources.length>0;if(!root.visible)return;
   for(const s of sources){
    if(!visible(s.mesh))continue;
    s.mesh.updateWorldMatrix(true,false);point.copy(s.center).applyMatrix4(s.mesh.matrixWorld);s.mesh.getWorldScale(scale);
    point.toArray(positions,count*3);
    diameters[count]=T.MathUtils.clamp(Math.max(s.size.x*scale.x,s.size.y*scale.y,s.size.z*scale.z)*3.4,.65,2.3);count++;
   }
   root.visible=count>0;geometry.setDrawRange(0,count);
   geometry.attributes.position.needsUpdate=true;geometry.attributes.diameter.needsUpdate=true;
   material.uniforms.viewportHeight.value=viewportHeight;
  },
  inspect:()=>({count,visible:root.visible,limit,positions:Array.from({length:count},(_,i)=>Array.from(positions.slice(i*3,i*3+3)))}),
  dispose(){sources=[];count=0;root.visible=false;root.removeFromParent();geometry.dispose();material.dispose();}
 };
}
