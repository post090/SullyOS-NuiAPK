// @vitest-environment jsdom
import React, {act, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Simulate} from 'react-dom/test-utils';
import {afterEach, expect, it, vi} from 'vitest';
import AvatarFrameImageEditor from '../components/chat/AvatarFrameImageEditor';
import CssCodeEditor from '../components/chat/CssCodeEditor';

const image = 'data:image/webp;base64,' + 'a'.repeat(200_000);
vi.mock('./blobRef', () => ({putImageBlobDeduped: vi.fn(async () => ({token:'blobref:img_uploaded',reused:false})),resolveRefToDataUrl:vi.fn(async () => 'data:image/webp;base64,' + 'a'.repeat(200_000))}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => {vi.unstubAllGlobals(); vi.restoreAllMocks();});

it('keeps original image data out of text layout, adjusts the uploaded frame and copies complete CSS', async () => {
    vi.stubGlobal('Image', class {
        naturalWidth = 1080; naturalHeight = 1440; onload?: () => void;
        set src(_: string) {queueMicrotask(() => this.onload?.());}
    });
    Object.defineProperty(URL,'createObjectURL',{configurable:true,value:vi.fn(()=> 'blob:upload')});
    const revoke = vi.fn();
    Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:revoke});
    const copy = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: copy}});
    const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
    let saved = '';
    const error = vi.fn();
    function Harness() {
        const [css, setCss] = useState(''), [busy, setBusy] = useState(false); saved = css;
        return React.createElement(React.Fragment, null,
            React.createElement(AvatarFrameImageEditor, {css, disabled: busy, onChange: setCss, onBusy: setBusy, onError: error}),
            React.createElement(CssCodeEditor, {value: css, onChange: setCss}),
        );
    }
    try {
        await act(async () => root.render(React.createElement(Harness)));
        const input = host.querySelector<HTMLInputElement>('input[type=file]')!;
        await act(async () => Simulate.change(input, {target: {files: [new File(['frame'], 'frame.webp', {type: 'image/webp'})], value: 'frame.webp'}} as any));
        expect(input.disabled).toBe(false);
        expect(saved).toContain('blobref:img_uploaded');
        expect(saved).not.toContain('base64');
        expect(host.querySelector('textarea')!.value.length).toBeLessThan(1000);
        const slider = host.querySelector<HTMLInputElement>('[aria-label="上下位置"]')!;
        await act(async () => Simulate.change(slider, {target: {value: '45'}} as any));
        expect(saved).toContain('top: 45%');
        expect(saved).toContain('aspect-ratio: 1080 / 1440');
        expect(saved).toContain('blobref:img_uploaded');
        expect(saved).not.toContain('base64');
        await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent === '复制完整 CSS（含图片）')!.click());
        expect(copy).toHaveBeenCalledWith(saved.replaceAll('blobref:img_uploaded',image));
        expect(revoke).toHaveBeenCalledWith('blob:upload');
        expect(error).toHaveBeenCalledWith('');
    } finally {act(() => root.unmount()); host.remove();}
});
