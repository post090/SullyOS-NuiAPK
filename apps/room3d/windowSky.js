// A painted sky on the existing pane geometry. No extra mesh, texture, blur
// pass or animation; mullions and curtains still occlude the pane normally.
export function applyWindowSky(material,geometry,lightUniforms){
 if(!material.isMeshStandardMaterial)return;
 geometry.computeBoundingBox();const {min,max}=geometry.boundingBox;
 const x=Math.max(.001,max.x-min.x),y=Math.max(.001,max.y-min.y);
 material.toneMapped=false;material.roughness=1;material.metalness=0;
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,lightUniforms);
  shader.vertexShader='varying vec2 vWindowSky;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   vWindowSky=vec2((position.x-(${min.x.toFixed(6)}))/${x.toFixed(6)},(position.y-(${min.y.toFixed(6)}))/${y.toFixed(6)});`);
  shader.fragmentShader=`varying vec2 vWindowSky;uniform vec3 skyTop;uniform vec3 skyBottom;uniform vec3 skyCloud;uniform float skyNight;uniform float skySunset;
   float skyHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float skyNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(skyHash(i),skyHash(i+vec2(1,0)),f.x),mix(skyHash(i+vec2(0,1)),skyHash(i+vec2(1,1)),f.x),f.y);}
   float skyClouds(vec2 p){return .57*skyNoise(p)+.28*skyNoise(p*2.07)+.15*skyNoise(p*4.13);}
  `+shader.fragmentShader.replace('vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;',`
   vec2 skyUV=clamp(vWindowSky,0.,1.);
   vec3 sky=mix(skyBottom,skyTop,smoothstep(0.,.95,skyUV.y));
   float field=skyClouds(skyUV*vec2(5.,10.));
   float cloud=smoothstep(.48,.64,field)*smoothstep(.06,.23,skyUV.y);
   float rim=smoothstep(.40,.5,field)*(1.-smoothstep(.5,.60,field));
   vec3 cloudColour=mix(skyCloud,mix(vec3(.44,.25,.44),skyCloud,smoothstep(.35,.8,skyUV.y)),skySunset);
   vec3 outgoingLight=mix(sky,cloudColour,cloud*mix(1.,.25,skyNight));
   outgoingLight+=rim*skySunset*vec3(.32,.16,.035);
   float sunDistance=length((skyUV-vec2(.78,.20))*vec2(${(x/y).toFixed(6)},1.));
   outgoingLight+=skySunset*(vec3(.25,.12,.02)*exp(-sunDistance*9.)+vec3(1.,.85,.38)*(1.-smoothstep(.03,.038,sunDistance)));
   float tower=skyHash(vec2(floor(skyUV.x*26.),3.));float skyline=(1.-smoothstep(.045+tower*.055,.048+tower*.055,skyUV.y));
   outgoingLight=mix(outgoingLight,mix(vec3(.26,.35,.44),vec3(.32,.24,.34),skySunset),skyline*.65);
   float moon=1.-smoothstep(.038,.046,length((skyUV-vec2(.76,.78))*vec2(${(x/y).toFixed(6)},1.)));
   vec2 cell=floor(skyUV*vec2(19.,13.));
   float seed=fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453);
   float star=(1.-smoothstep(.02,.07,length(fract(skyUV*vec2(19.,13.))-.5)))*step(.87,seed)*smoothstep(.35,.8,skyUV.y);
   outgoingLight=mix(outgoingLight,vec3(.94,.95,1.),skyNight*max(moon,star*.8));
  `);
 };
 material.customProgramCacheKey=()=>`painted-window-sky-v3/${min.x}/${min.y}/${x}/${y}`;
}
