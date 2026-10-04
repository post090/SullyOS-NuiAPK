// @vitest-environment jsdom
import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { VRMUtils } from '@pixiv/three-vrm';
import VRMAvatarCanvas from '../components/call/VRMAvatarCanvas';
const mocks = vi.hoisted(() => ({ load: vi.fn(), dispose: vi.fn(), forceContextLoss: vi.fn() }));
vi.mock('three', async importOriginal => {
  const actual = await importOriginal<typeof import('three')>();
  return { ...actual, WebGLRenderer: class {
    domElement = document.createElement('canvas');
    setPixelRatio() {} setClearColor() {} setSize() {} render() {}
    dispose = mocks.dispose; forceContextLoss = mocks.forceContextLoss;
  } };
});
vi.mock('three/addons/loaders/GLTFLoader.js', () => ({ GLTFLoader: class { register() {} load = mocks.load; } }));
let root: ReturnType<typeof createRoot> | undefined;
afterEach(() => { if (root) act(() => root?.unmount()); root = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals(); mocks.load.mockClear(); mocks.dispose.mockClear(); });
it('keeps a single model load across parent callback changes and uses latest callbacks', () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const host = document.createElement('div');
  root = createRoot(host);
  const first = vi.fn(), latest = vi.fn();
  act(() => root!.render(React.createElement(VRMAvatarCanvas, { modelUrl: 'model.vrm', motionState: 'idle', onError: first, onLoadingChange: () => {} })));
  for (let i = 0; i < 10; i++) act(() => root!.render(React.createElement(VRMAvatarCanvas, { modelUrl: 'model.vrm', motionState: 'speaking', onError: latest, onLoadingChange: () => {} })));
  expect(mocks.load).toHaveBeenCalledTimes(1);
  expect(host.querySelectorAll('canvas')).toHaveLength(1);
  act(() => mocks.load.mock.calls[0][3](new Error('invalid model')));
  expect(first).not.toHaveBeenCalled();
  expect(latest).toHaveBeenCalledWith('invalid model');
  const staleLoad = mocks.load.mock.calls[0][1];
  act(() => root!.render(React.createElement(VRMAvatarCanvas, { modelUrl: 'new.vrm', motionState: 'idle' })));
  expect(mocks.load).toHaveBeenCalledTimes(2);
  expect(mocks.dispose).toHaveBeenCalledTimes(1);
  const dispose = vi.spyOn(VRMUtils, 'deepDispose');
  const scene = new THREE.Group();
  staleLoad({ scene, userData: {} });
  expect(dispose).toHaveBeenCalledWith(scene);
});
