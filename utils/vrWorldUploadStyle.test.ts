import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    fileURLToPath(new URL('../apps/VRWorldApp.tsx', import.meta.url)),
    'utf8',
);

const uploadModalStart = source.indexOf('const UploadModal:');
const uploadModalEnd = source.indexOf('// ============ chibi', uploadModalStart);
const uploadModal = source.slice(uploadModalStart, uploadModalEnd);

describe('彼方书库上传编辑框样式', () => {
    it('使用明确的浅色背景和深色正文，避免移动端白底白字', () => {
        expect(uploadModalStart).toBeGreaterThan(-1);
        expect(uploadModalEnd).toBeGreaterThan(uploadModalStart);
        expect(uploadModal).toContain('bg-white');
        expect(uploadModal).toContain('text-slate-800');
        expect(uploadModal).toContain('caret-indigo-500');
        expect(uploadModal.match(/\$\{uploadFieldClass\}/g)).toHaveLength(4);
        expect(uploadModal).not.toContain('bg-white/8');
        expect(uploadModal).not.toMatch(/<input[^>]+text-white/);
        expect(uploadModal).not.toMatch(/<textarea[^>]+text-white/);
    });
});
