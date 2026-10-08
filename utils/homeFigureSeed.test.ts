import {it,expect} from 'vitest';
import {homeFigureSeed} from './homeFigureSeed';
import {validAppearanceColor} from '../apps/room3d/chibi/appearanceColors';
it('starts a new 3D figure with deterministic complete parts',()=>{
 const first=homeFigureSeed(undefined,false);expect(first.selected.skin).toBe('skin_01');expect(first.selected.fronthair).toBe('fronthair_01');expect(homeFigureSeed(undefined,false)).toEqual(first);
 expect(homeFigureSeed(undefined,true).selected.eyes).toBe('eyes_99');
});
it('keeps source colors and custom parts while restricting Sully facial artwork',()=>{
 const source={selected:{eyes:'eyes_99',mouth:'mouth_99',fronthair:'custom'},tintColor:{fronthair:{hueIdx:3}}};
 const next=homeFigureSeed(source,false);expect(next.selected.eyes).toBe('eyes_01');expect(next.selected.mouth).toBe('mouth_01');expect(next.selected.fronthair).toBe('custom');expect(next.tintColor).toEqual(source.tintColor);expect(source.selected.eyes).toBe('eyes_99');expect(homeFigureSeed(source,true).selected.eyes).toBe('eyes_99');
});
it('accepts only stored hex colors and leaves old figures without an override',()=>{
 expect(validAppearanceColor('#a1B2c3')).toBe('#a1B2c3');for(const color of [undefined,'red','#fff','#xxxxxx'])expect(validAppearanceColor(color)).toBeUndefined();
});
