import {describe, expect, it} from 'vitest';
import {CameraStickerGesture} from './cameraStickerGesture';
const transform = {x:0.5,y:0.5,size:0.4,angle:0};
describe('camera sticker gestures in photo coordinates', () => {
    it('combines pinch, rotation and translation on a non-square photo', () => {
        const g=new CameraStickerGesture(1,transform,600,800,1.2);
        g.add(10,{x:250,y:400});g.add(11,{x:350,y:400});
        g.move(10,{x:330,y:320});
        const value=g.move(11,{x:330,y:520})!;
        expect(value.size).toBeCloseTo(0.8); expect(value.angle).toBeCloseTo(90);
        expect(value.x).toBeCloseTo(0.55); expect(value.y).toBeCloseTo(0.525);
    });
    it('rebases when a second finger arrives or leaves without dropping the last coordinates', () => {
        const g=new CameraStickerGesture(1,transform,600,800,1.2);
        g.add(1,{x:300,y:400});g.move(1,{x:360,y:440});
        expect(g.current.x).toBeCloseTo(0.6);
        g.add(2,{x:400,y:440});
        expect(g.move(2,{x:400,y:440})!.x).toBeCloseTo(0.6);
        g.move(2,{x:420,y:440});g.remove(1);
        const before={...g.current};
        expect(g.move(2,{x:420,y:440})).toEqual(before);
        expect(g.move(2,{x:450,y:480})!.x).toBeCloseTo(before.x+0.05);
        expect(g.current.y).toBeCloseTo(before.y+0.05);
        g.remove(2);expect(g.count).toBe(0);
    });
    it('ignores unrelated pointers, caps scale, and safely handles coincident fingers', () => {
        const g=new CameraStickerGesture(1,transform,600,800,1.2);
        g.add(1,{x:300,y:400});g.add(2,{x:300,y:400});
        expect(g.add(3,{x:1,y:1})).toBe(false);expect(g.move(3,{x:2,y:2})).toBeNull();
        expect(g.remove(3)).toBe(false);
        g.move(2,{x:301,y:400});g.move(2,{x:303,y:400});g.move(2,{x:600,y:400});
        expect(g.current.size).toBe(1.2);
        expect(Object.values(g.current).every(Number.isFinite)).toBe(true);
    });
    it('rotates through the angle wrap without jumping and keeps a finger offset when dragging', () => {
        const g=new CameraStickerGesture(1,{...transform,angle:170},600,800,1.2);
        g.add(1,{x:250,y:400});g.add(2,{x:350,y:400});
        const value=g.move(2,{x:250,y:500})!;expect(value.angle).toBe(-100);
        g.remove(2);const before={...g.current};g.move(1,{x:260,y:420});
        expect(g.current.x).toBeCloseTo(before.x+10/600);
        expect(g.current.y).toBeCloseTo(before.y+20/800);
    });
});
