import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {hexToWheel,wheelAt,wheelToHex} from './colorWheel';
it('round trips RGB colors and agrees with the original creator wheel',()=>{
 const html=readFileSync('public/like520/character_creator.html','utf8');
 const helpers=html.slice(html.indexOf('function dyeWheelFromHex('),html.indexOf('function createDyeWheel('));
 for(const hex of ['#ff0000','#ffff00','#00ff00','#00ffff','#0000ff','#ff00ff','#000000','#ffffff','#999999','#bb8866','#ecc5d5']){
  expect(wheelToHex(hexToWheel(hex))).toBe(hex);
  expect(runInNewContext(helpers+';dyeWheelHex(dyeWheelFromHex(hex));',{hex})).toBe(hex);
 }
});
it('maps disk directions to hue, clamps outside drags, and preserves hue at the center',()=>{
 const base={h:45,s:1,v:1};
 expect(wheelToHex(wheelAt(1,0,base))).toBe('#ff0000');
 expect(wheelToHex(wheelAt(-1,0,base))).toBe('#00ffff');
 expect(wheelToHex(wheelAt(0,0,base))).toBe('#ffffff');
 expect(wheelAt(0,0,base).h).toBe(45);expect(wheelAt(3,4,base).s).toBe(1);
 expect(wheelToHex({...base,v:0})).toBe('#000000');
});
