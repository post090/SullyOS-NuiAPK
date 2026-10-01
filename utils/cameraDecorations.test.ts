import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CAMERA_DECORATIONS } from './cameraDecorations';

describe('bundled camera decorations', () => {
    it('ships every named local PNG and uses unique ids', () => {
        expect(new Set(CAMERA_DECORATIONS.map(s => s.id)).size).toBe(11);
        for (const item of CAMERA_DECORATIONS) {
            const bytes = readFileSync(new URL(`../public/assets/camera/${item.file}`, import.meta.url));
            expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
            expect(item.image).not.toMatch(/^https?:/);
        }
    });
    it('ships upstream licenses and source revision separately from the project license', () => {
        const read = (path: string) => readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8');
        expect(read('assets/camera/fluent/LICENSE')).toContain('Microsoft Corporation');
        expect(read('assets/camera/fluent/LICENSE')).toContain('Permission is hereby granted');
        expect(read('assets/camera/kenney/License.txt')).toContain('CC0');
        expect(read('licenses/pixi-filters-MIT.txt')).toContain('Permission is hereby granted');
        expect(read('assets/camera/SOURCES.md')).toContain('1ffb34c752ecf5d402f04cfb4b392c77f57c54bc');
        expect(read('licenses/camera.html')).toContain('../assets/camera/fluent/LICENSE');
    });
});
