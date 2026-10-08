// Furniture-only experiment: clean color blocks, without pixelation or extra passes.
// Keep the existing geometry normals, alpha cutouts, shadows and emissive details.
export function applyRetroFurniture(material,lightUniforms) {
 if (!material.isMeshStandardMaterial) return;
 material.roughness = 0.82;
 material.metalness = 0;
 material.toneMapped = false;
 material.onBeforeCompile = shader => {
  if(lightUniforms)Object.assign(shader.uniforms,lightUniforms);
  shader.fragmentShader=(lightUniforms?'uniform vec3 roomShadeTint;\nuniform vec3 roomSunTint;\nuniform float roomBrightness;\nuniform float roomSunContrast;\n':'const vec3 roomShadeTint=vec3(.88,.92,1.);\nconst vec3 roomSunTint=vec3(1.,.97,.92);\nconst float roomBrightness=1.;\nconst float roomSunContrast=0.;\n')+shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace(
   'vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;',
   `
   vec3 weights = vec3(0.2126, 0.7152, 0.0722);
   float base = max(dot(diffuseColor.rgb, weights), 0.001);
   float illumination = dot(totalDiffuse, weights) / base;
   // Broad, gently joined steps keep curved furniture readable in motion.
   float shade = 0.74
     + 0.10 * smoothstep(0.28, 0.38, illumination)
     + 0.10 * smoothstep(0.55, 0.67, illumination)
     + 0.06 * smoothstep(0.88, 1.02, illumination);
   float daylight = smoothstep(0.8, 2.8, illumination);
   vec3 shadowTint = mix(roomShadeTint, roomSunTint, smoothstep(0.25, 1.3, illumination));
   // A restrained white reflection follows the actual lights and camera.
   // Cap it so the broad color blocks do not turn into glossy white plastic.
   float shaft = smoothstep(.12, .65, dot(reflectedLight.directDiffuse, weights) / base);
   shade = mix(shade, .62 + .24 * clamp(illumination,0.,1.) + shaft * .78, roomSunContrast);
   shadowTint = mix(shadowTint, mix(roomShadeTint, roomSunTint, shaft), roomSunContrast);
   daylight *= 1. - roomSunContrast;
   float reflection = min(dot(totalSpecular, weights), 0.035);
   // Retain the window projection above the last cel band. Previously it was
   // clipped to the same flat white as ordinary ambient illumination.
   vec3 outgoingLight = mix(diffuseColor.rgb * (shade + daylight * 0.3) * shadowTint * roomBrightness, vec3(1.0, 0.96, 0.83), reflection) + totalEmissiveRadiance;
   `);
 };
 material.customProgramCacheKey = () => 'retro-furniture-time-v5-'+!!lightUniforms;
}
