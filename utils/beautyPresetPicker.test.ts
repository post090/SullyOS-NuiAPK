// @vitest-environment jsdom
import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import BeautyPresetPicker from '../components/share/BeautyPresetPicker';

vi.mock('./beautyShareClient', () => ({ normalizeBeautyPackage: (value: unknown) => value, readBeautyPackage: vi.fn() }));
vi.mock('../components/share/BeautyPresetPreview', () => ({ default: ({ data }: { data: { name: string } }) => React.createElement('div', { 'data-preview': true }, data.name) }));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const host = document.createElement('div');
const root = createRoot(host);
afterEach(async () => { await act(async () => root.render(null)); });

it('paginates large collections and filters without reading every preset', async () => {
  const read = vi.fn(async () => ({name:'preview'}));
  const onSource = vi.fn();
  const sources = Array.from({length:30}, (_,i) => ({id:String(i),name:`作品 ${i}`,kind:'chat-decoration' as const,categories:[i < 25 ? 'bubbles' as const : 'psyche' as const],read}));
  await act(async () => root.render(React.createElement(BeautyPresetPicker,{sources,source:'file',file:null,kind:'chat-decoration',onSource,onFile:()=>{}})));
  const click = async (text:string) => { const button=Array.from(host.querySelectorAll('dialog button')).find(item=>item.textContent===text) as HTMLButtonElement; await act(async()=>button.click()); };
  expect(host.querySelectorAll('.beauty-preset-row')).toHaveLength(12);
  await click('下一页');
  expect(host.querySelector('.beauty-preset-row')?.textContent).toContain('作品 12');
  await click('心象');
  expect(host.querySelectorAll('.beauty-preset-row')).toHaveLength(5);
  expect(host.querySelector('dialog footer')?.textContent).toContain('1 / 1');
  expect(read).not.toHaveBeenCalled();
  const dialog=host.querySelector('dialog')!; dialog.close=vi.fn();
  await act(async()=> (host.querySelector('.beauty-preset-row') as HTMLButtonElement).click());
  expect(onSource).toHaveBeenCalledWith('25');
  expect(dialog.close).toHaveBeenCalled();
});

it('keeps the preview mounted across fresh parent callbacks, but reloads changed presets', async () => {
  const read = vi.fn(async () => ({ name: 'first' }));
  const revision = {};
  const render = async (version: unknown, loader = read) => {
    await act(async () => root.render(React.createElement(BeautyPresetPicker, {
      sources: [{ id: 'one', name: 'Preset', revision: version, read: () => loader() }],
      source: 'one', file: null, kind: 'appearance', onSource: () => {}, onFile: () => {},
    })));
  };
  await render(revision);
  const preview = host.querySelector('[data-preview]');
  expect(preview?.textContent).toBe('first');
  for (let i = 0; i < 5; i++) await render(revision);
  expect(read).toHaveBeenCalledTimes(1);
  expect(host.querySelector('[data-preview]')).toBe(preview);
  const updated = vi.fn(async () => ({ name: 'updated' }));
  await render({}, updated);
  expect(updated).toHaveBeenCalledTimes(1);
  expect(host.querySelector('[data-preview]')?.textContent).toBe('updated');
});
