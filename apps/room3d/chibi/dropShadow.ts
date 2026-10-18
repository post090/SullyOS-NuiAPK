import * as T from 'three';

// Screen-space drop shadow for the chibi cast: render the casters'
// silhouettes from the camera into
// a small render target, then let face/skin materials sample that mask with a
// light-derived offset — bangs cast onto the face, garments onto hands.
// Zero authored assets; the boundary follows the painted hair alpha because
// the mask copies map + alphaTest from the source materials.
// Casters are opted in via material.userData.illustrationCast (FbxBody tags
// the front hair sheet and the front garment). Receivers are the illustration
// materials flagged illustrationFace / illustrationSkin.
// The sample offset points AGAINST the light's screen-space travel: a pixel
// is in shadow when a caster sits on the side the light comes from.
export const dropShadowUniforms = {
  mask: { value: null as T.Texture | null },
  screen: { value: new T.Vector2(1, 1) },
  drop: { value: new T.Vector2(0, 0.008) },
  enabled: { value: 0 },
};

const LAYER = 1;

export function createDropShadow(renderer: T.WebGLRenderer) {
  const target = new T.WebGLRenderTarget(2, 2, { minFilter: T.LinearFilter, magFilter: T.LinearFilter });
  const masks = new Map<T.Material, T.MeshBasicMaterial>();
  const hidden = new T.MeshBasicMaterial({ visible: false });
  const size = new T.Vector2();
  const swap: Array<[T.Mesh, T.Material | T.Material[]]> = [];
  const travel = new T.Vector3();
  const targetPos = new T.Vector3();
  const clearColor = new T.Color();

  function maskOf(source: T.Material) {
    let m = masks.get(source);
    if (!m) {
      const s = source as T.MeshStandardMaterial;
      m = new T.MeshBasicMaterial({ color: 0xffffff, map: s.map ?? null, alphaMap: s.alphaMap ?? null, alphaTest: s.alphaTest || 0, side: s.side, depthWrite: true });
      m.toneMapped = false;
      masks.set(source, m);
    }
    return m;
  }

  function off() { dropShadowUniforms.enabled.value = 0; }

  function render(scene: T.Scene, camera: T.OrthographicCamera | T.PerspectiveCamera, roots: T.Object3D[], light: T.DirectionalLight) {
    if (!roots.length) { off(); return; }
    renderer.getDrawingBufferSize(size);
    const w = Math.max(2, Math.floor(size.x / 2)), h = Math.max(2, Math.floor(size.y / 2));
    if (target.width !== w || target.height !== h) target.setSize(w, h);
    dropShadowUniforms.mask.value = target.texture;
    // screen 是「全屏像素 → 视口 UV」的分母（着色器用 gl_FragCoord/ 此值采样蒙版），
    // 蒙版虽是半分辨率，但它的 UV 与全屏视口一一对应——设成蒙版自己的尺寸会把
    // 采样坐标放大 2 倍，影子错位且右半屏采出界。
    dropShadowUniforms.screen.value.set(size.x, size.y);
    // 采样方向与主光在视野平面上的传播方向相反（正对相机的光自然收紧），再朝上多取
    // 一点——影子整体下坠，符合动画前发影的画法惯例。
    travel.subVectors(light.target.getWorldPosition(targetPos), light.position).normalize().transformDirection(camera.matrixWorldInverse);
    const drop = dropShadowUniforms.drop.value;
    drop.set(-travel.x, -travel.y);
    if (drop.lengthSq() > 1e-6) drop.normalize().multiplyScalar(0.016);
    drop.y += 0.008;
    dropShadowUniforms.enabled.value = 1;
    swap.length = 0;
    for (const root of roots) root.traverse(o => {
      const mesh = o as T.Mesh;
      if (!mesh.isMesh) return;
      const src = mesh.material;
      const list = Array.isArray(src) ? src : [src];
      if (!list.some(m => m.userData.illustrationCast)) return;
      mesh.layers.enable(LAYER);
      swap.push([mesh, src]);
      mesh.material = Array.isArray(src) ? src.map(m => m.userData.illustrationCast ? maskOf(m) : hidden) : maskOf(src);
    });
    const background = scene.background, shadows = renderer.shadowMap.enabled;
    const alpha = renderer.getClearAlpha();
    renderer.getClearColor(clearColor);
    const layerMask = camera.layers.mask;
    try {
      scene.background = null;
      renderer.shadowMap.enabled = false;
      camera.layers.set(LAYER);
      renderer.setRenderTarget(target);
      renderer.setClearColor(0x000000, 0);
      renderer.render(scene, camera);
    } finally {
      camera.layers.mask = layerMask;
      for (const [mesh, src] of swap) mesh.material = src;
      scene.background = background;
      renderer.shadowMap.enabled = shadows;
      renderer.setClearColor(clearColor, alpha);
      renderer.setRenderTarget(null);
    }
  }

  return { render, off, dispose() { target.dispose(); hidden.dispose(); for (const m of masks.values()) m.dispose(); masks.clear(); } };
}
