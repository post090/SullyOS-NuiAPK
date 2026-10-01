import { describe, it, expect } from 'vitest';
import { cameraFrameLayout } from './cameraFrames';
describe('instant photo frames', () => {
    it('uses mini and square paper proportions', () => {
        const mini = cameraFrameLayout(720, 960, 4), square = cameraFrameLayout(720, 960, 6);
        expect(mini.width / mini.height).toBeCloseTo(54 / 86, 2);
        expect(square.width / square.height).toBeCloseTo(72 / 86, 2);
    });
    it('preserves the whole image and has a larger lower margin', () => {
        for (const [w, h] of [[720, 960], [1600, 600]]) for (const frame of [4, 6]) {
            const l = cameraFrameLayout(w, h, frame);
            expect(l.photoWidth / l.photoHeight).toBeCloseTo(w / h);
            expect(l.x).toBeGreaterThan(0);
            expect(l.height - l.y - l.photoHeight).toBeGreaterThan(l.y);
            expect(l.height).toBeLessThanOrEqual(1440);
        }
    });
});
