import {expect,it} from 'vitest';
import {HOMELY_PALETTES,homelyPalette,homelyPaletteStyle} from '../components/os/homelyPalette';
const luminance=(hex:string)=>{
 const [r,g,b]=hex.slice(1).match(/../g)!.map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return r*.2126+g*.7152+b*.0722;
};
const contrast=(a:string,b:string)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
it.each(HOMELY_PALETTES)('$name keeps small labels and button text legible, and supplies the same palette to paper notes',palette=>{
 expect(contrast(palette.muted,palette.paper)).toBeGreaterThanOrEqual(4.5);
 expect(contrast(palette.buttonInk,palette.accent)).toBeGreaterThanOrEqual(4.5);
 const style=homelyPaletteStyle(palette.id) as Record<string,string>;
 expect(style['--homely-accent']).toBe(style['--animal-primary-color']);
 expect(style['--homely-paper']).toBe(style['--island-paper']);
 expect(style['--homely-button-ink']).toBe(palette.buttonInk);
});
it('old or unknown preferences keep the established apricot fallback',()=>{
 expect(homelyPalette().id).toBe('apricot');
 expect(homelyPalette('unknown').id).toBe('apricot');
});
