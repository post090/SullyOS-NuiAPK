import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FileOrImageImport } from '../components/share/FileOrImageImport';

describe('文件与图片入口分离', () => {
    it('文件入口不含图片类型限制，PNG 仍可经通用文件选择器传给同一个解析器', () => {
        const html = renderToStaticMarkup(createElement(FileOrImageImport, { onChange: () => {} }));
        expect(html).toContain('accept="*/*"');
        expect(html).toContain('accept="image/png"');
        expect(html).not.toContain('image/png,text');
        expect(html).toContain('从文件导入');
        expect(html).toContain('从图片导入');
    });
});
