import { expect, it, vi } from 'vitest';
import { Color, Mesh, OrthographicCamera, Scene, ShaderMaterial, Vector2 } from 'three';
import { createRoomAO } from '../apps/room3d/roomAO.js';

it.each([true, false])('keeps the contact radius circular across rotation and zoom (toon=%s)', toon => {
  const scene = new Scene();
  const camera = new OrthographicCamera(-2, 2, 4, -4);
  const viewport = new Vector2(400, 800);
  const radii: Vector2[] = [];
  const renderer = {
    autoClear: true, shadowMap: { enabled: true },
    getDrawingBufferSize: (out: Vector2) => out.copy(viewport),
    getRenderTarget: () => null, setRenderTarget: vi.fn(),
    getClearColor: (out: Color) => out.set(0), getClearAlpha: () => 1, setClearColor: vi.fn(),
    copyFramebufferToTexture: vi.fn(), clear: vi.fn(),
    render(object: Scene | Mesh) {
      if (object instanceof Mesh && object.material instanceof ShaderMaterial) {
        radii.push(object.material.uniforms.uRadius.value.clone().multiply(viewport));
        expect(object.material.uniforms.uToon.value).toBe(toon ? 1 : 0);
      }
    },
  };
  const ao = createRoomAO(renderer, scene, camera);
  ao.render([], { toon, radius: .2 });
  viewport.set(800, 400);
  camera.left = -4; camera.right = 4; camera.top = 2; camera.bottom = -2;
  camera.zoom = 2;
  ao.render([], { toon, radius: .2 });
  expect(radii.map(radius => radius.toArray())).toEqual([[20, 20], [40, 40]]);
  ao.dispose();
});
