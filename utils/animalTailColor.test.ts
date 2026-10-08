import {expect,it} from 'vitest';
import {resolveWardrobeColors,garmentColorRegions} from '../apps/room3d/chibi/wardrobeColors';
it('follows the worn ears by default, preserves tip and explicit fur, and never mutates saved colors',()=>{
 const w={ears:'fox-ears',tail:'cat-tail'},saved={'fox-ears':{fur:'#123456'},'cat-tail':{tip:'#eeeeee'}};
 expect(resolveWardrobeColors(w,saved)['cat-tail']).toEqual({fur:'#123456',tip:'#eeeeee'});
 expect(saved['cat-tail']).toEqual({tip:'#eeeeee'});
 expect(resolveWardrobeColors(w,{'cat-tail':{fur:'#654321'}})['cat-tail'].fur).toBe('#654321');
 expect(resolveWardrobeColors(w,{})['cat-tail'].fur).toBe(garmentColorRegions['fox-ears'].find(r=>r.id==='fur')!.color);
 expect(resolveWardrobeColors({tail:'cat-tail'},{})).toEqual({});
});
