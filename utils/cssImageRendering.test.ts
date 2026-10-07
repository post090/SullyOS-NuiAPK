// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import BlobRefStyle from '../components/chat/BlobRefStyle';
import BeautyPresetPreview from '../components/share/BeautyPresetPreview';

const read = vi.hoisted(() => vi.fn());
vi.mock('./blobRef', () => ({getBlobForRef:read}));
vi.mock('../components/chat/ChatDecorationSample', () => ({renderChatDecorationSample:(data:any) => ({markup:'<main class="sully-chat-root">preview</main>',css:data.parts.css})}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const source = (id:string) => `.sully-chat-avatar-wrap::after{background:url("blobref:${id}")}`;
let created:string[]; let revoked:string[];
beforeEach(() => {
    created=[]; revoked=[]; read.mockReset().mockResolvedValue(new Blob(['frame'],{type:'image/webp'}));
    Object.defineProperty(URL,'createObjectURL',{configurable:true,value:vi.fn(() => {const url='blob:test-'+created.length; created.push(url); return url;})});
    Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:vi.fn((url:string) => revoked.push(url))});
    vi.stubGlobal('ResizeObserver',class {observe(){} disconnect(){}});
});
afterEach(() => vi.unstubAllGlobals());

it('renders local frames in chat CSS, releases replaced URLs, and discards late loads after unmount', async () => {
    const host=document.createElement('div'); const root=createRoot(host);
    await act(async () => root.render(React.createElement(BlobRefStyle,{css:source('first')})));
    expect(host.textContent).toContain('blob:test-0'); expect(host.textContent).not.toContain('blobref:');
    await act(async () => root.render(React.createElement(BlobRefStyle,{css:source('second')})));
    expect(host.textContent).toContain('blob:test-1'); expect(revoked).toEqual(['blob:test-0']);
    let finish!:(blob:Blob)=>void;
    read.mockImplementationOnce(() => new Promise(resolve => {finish=resolve;}));
    await act(async () => root.render(React.createElement(BlobRefStyle,{css:source('late')})));
    await act(async () => root.unmount());
    await act(async () => finish(new Blob(['late'])));
    expect(revoked).toEqual(created);
});

it('renders preview CSS through object URLs and releases all resources when closed', async () => {
    const host=document.createElement('div'); const root=createRoot(host);
    const data={format:'sullyos-chat-decoration',version:1,name:'头像框',parts:{css:source('preview')}};
    await act(async () => root.render(React.createElement(BeautyPresetPreview,{data})));
    const shadow=host.querySelector('[data-beauty-preview-source]')!.shadowRoot!;
    expect(shadow.querySelector('style')!.textContent).toContain('blob:test-0');
    expect(host.querySelector('[role=alert]')).toBeNull();
    await act(async () => root.unmount()); expect(revoked).toEqual(created);
});

it('releases a preview asset that finishes loading after the preview was closed', async () => {
    let finish!:(blob:Blob)=>void;
    read.mockImplementationOnce(() => new Promise(resolve => {finish=resolve;}));
    const host=document.createElement('div'); const root=createRoot(host);
    const data={format:'sullyos-chat-decoration',version:1,name:'头像框',parts:{css:source('late-preview')}};
    await act(async () => root.render(React.createElement(BeautyPresetPreview,{data})));
    expect(read).toHaveBeenCalled();
    await act(async () => root.unmount());
    await act(async () => finish(new Blob(['late'])));
    expect(created).toHaveLength(1); expect(revoked).toEqual(created);
});
