import {expect,it} from 'vitest';
import {compactCssImages} from './cssImagePlaceholders';

it('keeps editing short while preserving full images and user changes on save',()=>{
    const image='data:image/png;base64,'+'a'.repeat(2_000_000);
    const css=`.avatar{background:url("${image}");left:50%}`;
    const editor=compactCssImages(css);
    expect(editor.text.length).toBeLessThan(100);
    expect(editor.expand(editor.text)).toBe(css);
    expect(editor.expand(editor.text.replace('50%','42%'))).toBe(css.replace('50%','42%'));
    expect(editor.expand('.avatar{background:none}')).toBe('.avatar{background:none}');
});
it('avoids collisions with existing text and expands multiple assets independently',()=>{
    const css='.a{content:"sully-embedded-image-1";background:url(data:image/png;base64,AAAA)}.b{background:url(data:image/webp;base64,BBBB)}';
    const editor=compactCssImages(css);
    expect(editor.count).toBe(2);
    expect(editor.expand(editor.text)).toBe(css);
});
