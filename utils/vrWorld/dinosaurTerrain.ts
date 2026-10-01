import type { GardenTheme } from './dinosaurTypes';
/** Solid, baked-in landmarks also reserve space on the hidden board. */
export const COAST_LANDMARKS = {
  lighthouse: {x:-3.2,z:-3.91,radius:.5},
  umbrella: {x:-2.7,z:1.75,radius:.72},
  sailboat: {x:3.15,z:-2.8,radius:.33},
};
export const VOLCANO_LANDMARKS = {
  supplies: {x:3.25,z:2.85,radius:.4},
  dish: {x:3.3,z:-1.1,radius:.25},
};
export function gardenSceneryBlocked(theme:GardenTheme,point:{x:number;z:number},radius:number):boolean {
  const landmarks=theme==='coast'?Object.values(COAST_LANDMARKS):theme==='volcano'?Object.values(VOLCANO_LANDMARKS):[];
  return landmarks.some(p=>Math.hypot(p.x-point.x,p.z-point.z)<p.radius+radius);
}
/** World-space tabletop height shared by scenery, dinosaur feet and picking. */
export const riverCenter = (z: number) => 1.45 + Math.sin(z * 1.05) * .52;
export const coastEdge = (z:number) => .15 + 1.1 * Math.cos((z+.3)*.62);
export const lavaCenter = (z:number) => -2.8 + (z+3)*.59 + Math.sin((z+3)*1.2)*.20;
export function gardenGroundHeight(x: number, z: number, theme:GardenTheme='grassland'): number {
  if(theme==='coast')return x>coastEdge(z)? .075 : .11+.24*Math.exp(-((x+3.1)**2/1.8+(z+3.7)**2/1.7));
  if(theme==='volcano')return .09+.24*Math.exp(-((x+2.8)**2/3.5+(z+2.9)**2/3.1))+.10*Math.exp(-((x-2.8)**2/1.6+(z-2.5)**2/2));
  const hill = .85 * Math.exp(-((x + 2.7) ** 2 / 2.8 + (z + 3.15) ** 2 / 2.1));
  const knoll = .24 * Math.exp(-((x + 2.7) ** 2 / 1.8 + (z - 2.65) ** 2 / 1.5));
  const bank = Math.min(1, Math.max(0, (Math.abs(x - riverCenter(z)) - .4) / .45));
  return .085 + (hill + knoll + .035) * bank;
}
export function gardenSurfaceHeight(x: number, z: number,theme:GardenTheme='grassland'): number {
  if (theme==='grassland'&&Math.abs(z - .25) < .48 && Math.abs(x - riverCenter(.25)) < 1.2)
    return .28 + .18 * Math.cos((x - riverCenter(.25)) / 1.2 * Math.PI / 2);
  return Math.max(.125, gardenGroundHeight(x, z,theme));
}
