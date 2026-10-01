import { afterEach, describe, expect, it, vi } from 'vitest';
import { cameraCaptureLayout, cameraIsPortrait } from './cameraCapture';
afterEach(() => vi.unstubAllGlobals());

describe('phone camera orientation', () => {
    it.each([[1920,1080],[1280,720],[1440,1920],[1080,1920],[720,960]])('portrait viewfinder and capture agree for %s × %s sensors', (w,h) => {
        const crop = cameraCaptureLayout(w,h,true)!;
        expect(crop.width / crop.height).toBeCloseTo(3/4,2);
        expect(crop.sourceWidth / crop.sourceHeight).toBeCloseTo(3/4);
        expect(crop.x*2 + crop.sourceWidth).toBeCloseTo(w);
        expect(crop.y*2 + crop.sourceHeight).toBeCloseTo(h);
        expect(Math.max(crop.width,crop.height)).toBeLessThanOrEqual(1440);
        expect(crop.width).toBeLessThanOrEqual(crop.sourceWidth + 1);
        expect(crop.height).toBeLessThanOrEqual(crop.sourceHeight + 1);
    });
    it('landscape capture follows landscape phone orientation', () => {
        const crop = cameraCaptureLayout(1920,1080,false)!;
        expect(crop).toMatchObject({x:240,y:0,sourceWidth:1440,sourceHeight:1080,width:1440,height:1080});
    });
    it('rejects unloaded camera sizes', () => {
        expect(cameraCaptureLayout(0,1080,true)).toBeNull();
        expect(cameraCaptureLayout(1920,0,true)).toBeNull();
        expect(cameraCaptureLayout(NaN,1080,true)).toBeNull();
    });
    it('uses physical orientation ahead of viewport, with iOS fallback', () => {
        vi.stubGlobal('window', {orientation:90,matchMedia:()=>({matches:false})});
        vi.stubGlobal('screen', {orientation:{type:'portrait-primary'}});
        expect(cameraIsPortrait()).toBe(true);
        vi.stubGlobal('screen', {});
        expect(cameraIsPortrait()).toBe(false);
        vi.stubGlobal('window', {orientation:0,matchMedia:()=>({matches:false})});
        expect(cameraIsPortrait()).toBe(true);
        vi.stubGlobal('window', {matchMedia:()=>({matches:true})});
        expect(cameraIsPortrait()).toBe(true);
    });
});
