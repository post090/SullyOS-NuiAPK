// Small rest-space adjustments for the current short-sleeve sailor outfit.
// Rest vertices are immutable: repeated slider changes never accumulate deformation.
const defaults = { skirtLength: 100, sleeveLength: 100, cuffWidth: 100 };
const specs = [
  ['skirtLength', '裙长', 85, 150, '短一些', '长一些'],
  ['sleeveLength', '袖长', 85, 125, '短一些', '长一些'],
  ['cuffWidth', '袖口宽松度', 95, 135, '收一些', '松一些'],
];
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const storageKey = 'sully-sailor-girl-fit-v1';
export function setupGarmentFit({ model, bodyIndex }) {
  if (new URLSearchParams(location.search).get('quality') !== 'sailor-girl') return;
  let state = { ...defaults }, undo = [], redo = [], gesture = null;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    for (const [id, , min, max] of specs) if (Number.isFinite(saved?.[id])) state[id] = clamp(saved[id], min, max);
  } catch { /* A corrupt/unavailable local draft does not block the preview. */ }
  const body = model.getObjectByName('Mesh_0');
  const originalIndex = [...bodyIndex];
  const parts = [];
  const rings = [[.23,.235],[.34,.245],[.52,.23],[.68,.207],[.70,.201],[.72,.199],[.74,.197],[.77,.194],[.79,.192],[.81,.19],[.81,.185],[.79,.16]];
  const skirtRoot = model.getObjectByName('Sailor_skirt');
  let outerSkirt;
  skirtRoot?.traverse(o => { if (!outerSkirt && o.isMesh) outerSkirt = o; });
  model.traverse(mesh => {
    if (!mesh.isMesh) return;
    const isTop = mesh.name.startsWith('Sailor_top') || mesh.parent?.name === 'Sailor_top';
    if (!isTop && mesh !== outerSkirt) return;
    const g = mesh.geometry, p = g.attributes.position, n = g.attributes.normal;
    const positions = p.array.slice(), normals = n.array.slice();
    const selected = [];
    for (let i = 0; i < p.count; i++) {
      const x = Math.abs(p.getX(i)), radius = Math.hypot(p.getY(i) - 3.125, p.getZ(i) + .0106);
      if (mesh === outerSkirt || rings.some(([rx, rr]) => Math.abs(rx - x) < .0001 && Math.abs(rr - radius) < .0001)) selected.push(i);
    }
    if (selected.length) parts.push({ mesh, positions, normals, selected, skirt: mesh === outerSkirt });
  });
  function skirtY(y) {
    const depth = Math.max(0, 2.35 - y);
    return y - (state.skirtLength / 100 - 1) * depth * smooth(depth / .1);
  }
  function deform(x, y, z, skirt) {
    if (skirt) return [x, skirtY(y), z];
    const length = state.sleeveLength / 100;
    const width = 1 + (state.cuffWidth / 100 - 1) * smooth((Math.abs(x) - .34) / .47);
    return [Math.sign(x) * (.23 + (Math.abs(x) - .23) * length), 3.125 + (y - 3.125) * width, -.0106 + (z + .0106) * width];
  }
  function maskBody() {
    const all = document.getElementById('clothing').checked;
    const top = all && document.getElementById('top-piece').checked;
    const skirt = all && document.getElementById('pants-piece').checked;
    const pos = body.geometry.attributes.position, kept = [];
    const sleeveEnd = .23 + .58 * state.sleeveLength / 100 - .10;
    for (let i = 0; i < originalIndex.length; i += 3) {
      const ids = originalIndex.slice(i, i + 3);
      const inTop = top && ids.every(v => {
        const x = Math.abs(pos.getX(v)), y = pos.getY(v);
        return (x < .49 && y > 2.32 && y < 3.24) || (x > .25 && x < sleeveEnd && y > 2.84 && y < 3.40);
      });
      const inSkirt = skirt && ids.every(v => pos.getY(v) > skirtY(1.81) && pos.getY(v) < 2.45);
      const inShoes = all && ids.every(v => pos.getY(v) < .94);
      if (!inTop && !inSkirt && !inShoes) kept.push(...ids);
    }
    body.geometry.setIndex(kept);
  }
  function apply() {
    for (const { mesh, positions, normals, selected, skirt } of parts) {
      const g = mesh.geometry, p = g.attributes.position, n = g.attributes.normal;
      p.array.set(positions); n.array.set(normals);
      const changed = skirt ? state.skirtLength !== 100 : state.sleeveLength !== 100 || state.cuffWidth !== 100;
      for (const i of changed ? selected : []) {
        const offset = i * 3, a = Array.from(positions.subarray(offset, offset + 3));
        p.setXYZ(i, ...deform(...a, skirt));
        // Inverse-transpose for these triangular Jacobians preserves authored normals.
        const e = .0001, xp = deform(a[0] + e, a[1], a[2], skirt), xm = deform(a[0] - e, a[1], a[2], skirt);
        const yp = deform(a[0], a[1] + e, a[2], skirt), ym = deform(a[0], a[1] - e, a[2], skirt);
        const zp = deform(a[0], a[1], a[2] + e, skirt), zm = deform(a[0], a[1], a[2] - e, skirt);
        const dx = xp.map((v,k) => (v-xm[k])/(2*e));
        const sy = (yp[1]-ym[1])/(2*e), sz = (zp[2]-zm[2])/(2*e);
        let ny = normals[offset+1]/sy, nz = normals[offset+2]/sz;
        let nx = (normals[offset]-dx[1]*ny-dx[2]*nz)/dx[0];
        const length = Math.hypot(nx,ny,nz); n.setXYZ(i,nx/length,ny/length,nz/length);
      }
      p.needsUpdate = true; n.needsUpdate = true;
      g.computeBoundingBox(); g.computeBoundingSphere();
    }
    maskBody(); refresh();
    try { localStorage.setItem(storageKey, JSON.stringify(state)); note.textContent = '已自动保存 · 导出当前模型会保留调整'; }
    catch { note.textContent = '本次调整有效；浏览器未允许保存'; }
  }
  const panel = document.createElement('section'); panel.id = 'garment-fit'; panel.setAttribute('aria-label', '服装版型');
  panel.innerHTML = '<h2>服装版型</h2><p>固定裙腰和肩膀，调整边缘的长短与宽松。</p>';
  const controls = new Map();
  const record = () => { undo.push({ ...state }); if (undo.length > 40) undo.shift(); redo = []; };
  for (const [id, label, min, max, left, right] of specs) {
    const row = document.createElement('div'); row.className = 'fit-control';
    const lab = document.createElement('label'); lab.htmlFor = `fit-${id}`; lab.textContent = label;
    const output = document.createElement('output'); output.htmlFor = `fit-${id}`;
    const input = document.createElement('input'); input.type = 'range'; input.id = `fit-${id}`;
    input.min = min; input.max = max; input.step = 1;
    const hint = document.createElement('div'); hint.className = 'fit-endpoints';
    const l = document.createElement('span'), r = document.createElement('span'); l.textContent = left; r.textContent = right; hint.append(l,r);
    const begin = () => { if (gesture !== id) { record(); gesture = id; } };
    input.addEventListener('pointerdown', begin);
    input.addEventListener('keydown', e => { if (/^(Arrow|Page|Home|End)/.test(e.key)) begin(); });
    input.addEventListener('input', () => { begin(); state[id] = clamp(input.valueAsNumber,min,max); apply(); });
    input.addEventListener('change', () => { gesture = null; });
    input.addEventListener('blur', () => { gesture = null; });
    row.append(lab,output,input,hint); panel.append(row); controls.set(id,{input,output});
  }
  const actions = document.createElement('div'); actions.className = 'row';
  const back = document.createElement('button'), forward = document.createElement('button'), reset = document.createElement('button');
  back.id = 'fit-undo'; back.textContent = '撤销'; forward.id = 'fit-redo'; forward.textContent = '重做'; reset.id = 'fit-reset'; reset.textContent = '恢复默认';
  back.onclick = () => { if (!undo.length) return; gesture=null; redo.push({...state}); state=undo.pop(); apply(); };
  forward.onclick = () => { if (!redo.length) return; gesture=null; undo.push({...state}); state=redo.pop(); apply(); };
  reset.onclick = () => { if (specs.every(([id])=>state[id]===100)) return; gesture=null; record(); state={...defaults}; apply(); };
  actions.append(back,forward,reset); panel.append(actions);
  const note = document.createElement('p'); note.className='fit-note'; note.setAttribute('role','status'); panel.append(note);
  document.getElementById('presets').before(panel);
  function refresh() {
    for (const [id,{input,output}] of controls) { input.value=state[id]; output.textContent=`${state[id]}%`; }
    back.disabled=!undo.length; forward.disabled=!redo.length;
  }
  for (const id of ['clothing','top-piece','pants-piece']) document.getElementById(id).addEventListener('change',maskBody);
  apply();
  window.garmentFit = { getState: () => ({...state}) };
  const previousText = window.render_game_to_text;
  window.render_game_to_text = () => JSON.stringify({ ...(previousText ? JSON.parse(previousText()) : {}), garmentFit: {...state}, outfit:'sailor-girl', coordinateSystem:'Y up, +Z front, rest-pose geometry' });
}
