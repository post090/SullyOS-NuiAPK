// @vitest-environment jsdom
import React from 'react';
import {act} from 'react-dom/test-utils';
import {createRoot} from 'react-dom/client';
import {afterEach, describe, expect, it, vi} from 'vitest';
import Home3DEntry from '../apps/room3d/Home3DEntry';
import {stripSensitiveCardFields} from './characterCard';
import type {CharacterProfile} from '../types';

vi.mock('../apps/room3d/Home3DView', () => ({default: (props:any) => React.createElement('div', {'data-testid': 'scene'}, React.createElement('button',{onClick:props.onDefinition,'data-testid':'edit-definition'},'家园设定'))}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const host = document.createElement('div');
document.body.appendChild(host);
let root: ReturnType<typeof createRoot>;
afterEach(() => {act(() => root?.unmount()); host.innerHTML = '';});

describe('home definition entry', () => {
  it('requires an explicit choice, persists it through the character callback, and supports cancelling an edit', () => {
    root = createRoot(host);
    const save = vi.fn();
    const character = {id: 'a', name: 'A'} as CharacterProfile;
    const render = () => act(() => root.render(React.createElement(Home3DEntry, {character, onChange: () => {}, onBack: () => {}, onDefinitionChange: save})));
    render();
    expect(host.querySelector('[data-testid="scene"]')).toBeNull();
    expect(host.querySelector<HTMLButtonElement>('[type="submit"]')?.disabled).toBe(true);
    act(() => host.querySelector<HTMLInputElement>('[value="between-worlds"]')!.click());
    act(() => host.querySelector('form')!.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true})));
    expect(save).toHaveBeenCalledWith({kind: 'between-worlds', notes: ''});
    character.homeDefinition = {kind: 'between-worlds', notes: '只在周末相见'};
    render();
    expect(host.querySelector('[data-testid="scene"]')).not.toBeNull();
    act(() => host.querySelector<HTMLButtonElement>('[data-testid="edit-definition"]')!.click());
    expect(host.querySelector('textarea')?.value).toBe('只在周末相见');
    act(() => host.querySelector<HTMLInputElement>('[value="virtual"]')!.click());
    act(() => host.querySelector<HTMLButtonElement>('.home-definition-back')!.click());
    expect(save).toHaveBeenCalledTimes(1);
    act(() => host.querySelector<HTMLButtonElement>('[data-testid="edit-definition"]')!.click());
    expect(host.querySelector<HTMLInputElement>('[value="between-worlds"]')?.checked).toBe(true);
  });
  it('keeps a personal home definition out of shared character cards', () => {
    root = createRoot(host);
    const character = {name: 'A', homeDefinition: {kind: 'virtual', notes: '私人的共同设定'}};
    expect(stripSensitiveCardFields(character)).not.toHaveProperty('homeDefinition');
    expect(character.homeDefinition.notes).toBe('私人的共同设定');
  });
});
