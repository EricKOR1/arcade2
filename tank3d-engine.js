// 3D 탱크 대전 — 그림(Three.js r128) · HUD · 카드 · 입력. 규칙 · 통신 · XP 는 tank-engine.js 의 TankCore
//   · 카메라: 북쪽이 위인 고정 방향, 약 50° 내려다보며 부드럽게 따라감 → 조이스틱 위 = 화면 위 = 북쪽
//   · 그리기 호출이 인원과 무관하게: 전차는 '종류 × 부품' InstancedMesh(멀면 간단한 상자), 구조물 · 나무 · 바위 · 포탄 · 폭발 · 고리도 인스턴스
//   · 지형은 정점 색 한 덩어리 BufferGeometry (높이 · 경사 · 재질로 색, 골짜기는 어둡게 · 능선은 밝게)
//   · 카드 톡 · 마우스는 host(canvas-wrap)에 pointer 리스너로 받음 (조작 층 #fps-ctl 이 캔버스를 덮음)

const TK3_TEAM = { r: 0xE5484D, b: 0x3D8BF5 }, TK3_FFA = [0xE5484D, 0xF08C2E, 0xB65CE8, 0xD94F8A], TK3_ME_FFA = 0x3D8BF5;
const TK3_SKY = { hills: 0xA8D8F0, canyon: 0xF0D2A8, snow: 0xD8E6F0 };
const TK3_MAXT = 40;           // 종류마다 전차 인스턴스 수
const TK3_FAR = 40;            // 카메라 중심에서 이보다 멀면 간단한 모델
const TK3_PITCH = 50 * Math.PI / 180;
// 전차 모양 (앞 = +x): 길이 · 폭 · 차체 높이 · 포탑(폭 tw · 길이 tl · 높이 th · 앞뒤 tx · 둥근 round) · 포신(길이 bl · 굵기 br · 들림 pitch) · 포탑 축 px
const TK3_SHAPE = {
  light:  { L: 3.0, W: 2.0, H: 0.55, round: true, tw: 1.25, tl: 1.25, th: 0.45, tx: 0, bl: 1.6, br: 0.08, px: 0.15 },
  medium: { L: 3.4, W: 2.3, H: 0.7, tw: 1.5, tl: 1.7, th: 0.6, tx: 0, bl: 2.2, br: 0.11, px: 0 },
  heavy:  { L: 3.9, W: 2.8, H: 0.9, tw: 1.95, tl: 2.1, th: 0.8, tx: -0.1, bl: 2.4, br: 0.16, px: -0.15, brake: true },
  td:     { L: 3.6, W: 2.4, H: 0.65, tw: 2.0, tl: 1.8, th: 0.7, tx: 0.35, bl: 3.2, br: 0.12, px: 0.5 },
  arty:   { L: 3.4, W: 2.3, H: 0.6, tw: 2.0, tl: 1.9, th: 1.0, tx: -0.2, bl: 2.6, br: 0.19, px: -0.6, pitch: 0.55 },
  eng:    { L: 3.4, W: 2.4, H: 0.75, round: true, tw: 1.3, tl: 1.3, th: 0.5, tx: 0, bl: 1.3, br: 0.09, px: 0.35, crane: true }
};
// 카드에 쓰는 능력치 막대 기준
const TK3_DPS_MAX = Math.max(...TK_ORDER.map(k => TK_TYPES[k].dmg / TK_TYPES[k].reload));

// 여러 기하를 한 덩어리로 (정점 색 포함) — r128 에는 BufferGeometryUtils 가 없어 직접 합침
function tk3Merge(parts) {
  const T = THREE; let n = 0;
  const gs = parts.map(p => { const g0 = p.g, g = g0.index ? g0.toNonIndexed() : g0; if (g !== g0) g0.dispose(); if (p.m) g.applyMatrix4(p.m); n += g.attributes.position.count; return g; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  gs.forEach((g, i) => { const c = parts[i].c, cnt = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    for (let k = 0; k < cnt; k++) { col[(o + k) * 3] = c[0]; col[(o + k) * 3 + 1] = c[1]; col[(o + k) * 3 + 2] = c[2]; } o += cnt; g.dispose(); });
  const out = new T.BufferGeometry(); out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.setAttribute('normal', new T.BufferAttribute(nor, 3)); out.setAttribute('color', new T.BufferAttribute(col, 3));
  out.computeBoundingSphere(); return out;
}
function tk3P(g, x, y, z, c, rx, ry, rz) { const m = new THREE.Matrix4(); m.makeRotationFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)); m.setPosition(x, y, z); return { g, m, c }; }
// HUD 그리기 도우미
function tk3RR(c, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function tk3T(c, s, x, y, size, color, align, stroke, weight) {
  c.font = (weight || 800) + ' ' + Math.round(size) + 'px ' + TK_FONT; c.textAlign = align || 'center'; c.textBaseline = 'middle';
  if (stroke !== false) { c.lineWidth = Math.max(2, size * 0.24); c.strokeStyle = stroke || 'rgba(14,18,34,0.92)'; c.lineJoin = 'round'; c.strokeText(s, x, y); }
  c.fillStyle = color || '#fff'; c.fillText(s, x, y);
}
// 폭에 맞게 글자 크기를 줄여 씀
function tk3TF(c, s, x, y, size, maxW, color, align, stroke, weight) {
  let z = size; c.font = (weight || 800) + ' ' + Math.round(z) + 'px ' + TK_FONT; const w = c.measureText(s).width; if (w > maxW && w > 0) z = Math.max(8, z * maxW / w);
  tk3T(c, s, x, y, z, color, align, stroke, weight);
}
const tk3Clock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

class TankGame extends TankCore {
  constructor(canvas, opts) {
    // 부모(TankCore)는 그리지 않음 — 3D 는 게임 캔버스(WebGL), 글자 · 막대 · 카드는 위에 겹친 HUD 캔버스
    const host = canvas.parentElement, hud = document.createElement('canvas');
    hud.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2';
    host.appendChild(hud);
    super(opts);
    this.world3d = true; this.glCanvas = canvas; this.host = host; this.hudCanvas = hud; this.ctx = hud.getContext('2d');
    this.vw = host.clientWidth || 800; this.vh = host.clientHeight || 600;
    this.ui = { cards: [], types: [] }; this.selShownAt = 0; this.mouse = null; this.mouseHeld = false; this.guideAt = 0; this.wasAlive = false; this.drawAt = 0;
    this.touchUi = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
    this.initThree();
    this.bindInput();
    this.resize();
  }

  // ── 입력: 카드 톡 · 마우스 조준(땅 위 지점) · 클릭 발사 · 오른쪽 클릭 스킬 ──
  bindInput() {
    this._offs = [];
    const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); this._offs.push(() => t.removeEventListener(ev, fn, o)); };
    on(this.host, 'pointerdown', e => this.onPointer(e, true), true);
    on(this.host, 'pointermove', e => { if (e.pointerType === 'mouse') this.onPointer(e, false); }, true);
    on(window, 'pointerup', e => { if (e.pointerType === 'mouse') this.mouseHeld = false; });
    on(this.host, 'contextmenu', e => e.preventDefault());
  }
  onPointer(e, down) {
    if (this._dead) return;
    const r = this.host.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (!down) { this.mouse = { x, y, at: this.now }; return; }
    if (e.target && e.target.closest && e.target.closest('button')) return;      // 발사 · ★ 버튼은 그쪽에서
    if (this.uiHit(x, y)) { e.preventDefault(); e.stopPropagation(); return; }
    if (e.pointerType !== 'mouse' || this.gameOver) return;
    if (e.button === 2) { this.useSuper(); return; }
    if (e.button !== 0) return;
    this.mouse = { x, y, at: this.now }; this.aimAtMouse(); this.fire(); this.mouseHeld = true;
  }
  uiHit(x, y) {
    const inR = b => x >= b.x && y >= b.y && x <= b.x + b.w && y <= b.y + b.h;
    if (this.gameOver) return false;
    if (this.sel.open && !this.alive) { for (const b of this.ui.types) if (inR(b)) { if (performance.now() - this.selShownAt > 450) { this.chooseType(b.k); this.sfx('up'); } return true; } return false; }   // 막 뜬 카드는 잠깐 안 받음 (뜨기 전에 누른 톡)
    if (this.cards) for (const b of this.ui.cards) if (inR(b)) { this.pickCard(b.i); return true; }
    return false;
  }
  // index.html onKeyDown 이 먼저 부름: 숫자 1~6 = 전차 고르기 / 1~3 = 업그레이드 · Space = 스킬 · F = 발사
  onKey(e) {
    if (this.gameOver) return false;
    const k = e.key;
    if (k >= '1' && k <= '6') { const i = +k - 1;
      if (this.sel.open && !this.alive) { if (TK_ORDER[i]) { this.chooseType(TK_ORDER[i]); this.sfx('up'); } }
      else if (this.cards && i < this.cards.length) this.pickCard(i);
      return true; }
    if (k === ' ' || e.code === 'Space') { if (e.preventDefault) e.preventDefault(); this.useSuper(); return true; }
    if (k === 'f' || k === 'F' || k === 'Enter') { this.fire(); return true; }
    return false;
  }
  aimAtMouse() { if (!this.mouse || !this.alive) return; const p = this.groundAt(this.mouse.x, this.mouse.y); if (p) this.setAimPoint(p[0], p[1]); }
  // 화면 점 → 땅 위 점 (광선을 따라가다 지형 아래로 들어가는 곳)
  groundAt(sx, sy) {
    if (!this.camera) return null;
    const v = this.tmpV.set(sx / this.vw * 2 - 1, -(sy / this.vh) * 2 + 1, 0.5).unproject(this.camera), o = this.camera.position;
    let dx = v.x - o.x, dy = v.y - o.y, dz = v.z - o.z; const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
    if (dy > -0.02) return null;
    let t0 = 0, t = 0, hit = false; const W = this.world;
    for (t = 2; t < 320; t += 1.5) { if (o.y + dy * t <= W.height(o.x + dx * t, o.z + dz * t)) { hit = true; break; } t0 = t; }
    if (!hit) return null;
    for (let i = 0; i < 8; i++) { const m = (t0 + t) / 2; if (o.y + dy * m <= W.height(o.x + dx * m, o.z + dz * m)) t = m; else t0 = m; }
    return [o.x + dx * t, o.z + dz * t];
  }

  // ── 한 프레임 (index.html 의 loop 가 부름) ──
  tick(ts) {
    if (this._dead) return;
    this.step(ts);
    if (this.mouse && this.alive && !this.gameOver) {
      if (this.mouseHeld) { this.aimAtMouse(); this.fire(); }
      else if (this.now - this.mouse.at < 1400) this.aimAtMouse();     // 마우스를 움직이는 동안만 마우스 쪽 조준 (가만 두면 자동 조준으로)
    }
    if (this.alive && !this.wasAlive && !this.guideAt) this.guideAt = this.now;   // 처음 출격: 4초 조작 안내
    this.wasAlive = this.alive;
    this.draw();
  }
  setQuality(q) {
    this.q = Math.max(0, Math.min(2, q | 0));
    if (this.renderer) this.renderer.setPixelRatio(Math.min([0.75, 1.0, 1.25][this.q], this.opts.maxDpr || 1.25, window.devicePixelRatio || 1));
    this.resize();
  }
  resize() {
    if (this._dead) return;
    const W = this.host.clientWidth || 800, H = this.host.clientHeight || 600; if (W < 10 || H < 10) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.hudCanvas.width = Math.round(W * dpr); this.hudCanvas.height = Math.round(H * dpr); this.hudDpr = dpr;
    this.vw = W; this.vh = H;
    if (this.renderer) { this.renderer.setSize(W, H, false); this.glCanvas.style.width = '100%'; this.glCanvas.style.height = '100%';
      const cam = this.camera, asp = W / H; cam.aspect = asp; cam.fov = asp < 1 ? 50 : 40;
      // 짧은 변에 약 28~30m 가 보이게 (세로 폰은 가로 28m · 가로 화면은 세로 30m)
      const tn = Math.tan(cam.fov * Math.PI / 360), zoom = this.T && (this.T.lob || this.T.pierce) ? 1.12 : 1;
      this.camDist = (asp < 1 ? 28 / (2 * tn * asp) : 30 / (2 * tn)) * zoom;
      this.scene.fog.near = this.camDist + 22; this.scene.fog.far = this.camDist * 1.7 + 70;
      cam.far = this.camDist * 2.2 + 120; cam.updateProjectionMatrix(); }
    this._camZoom = this.T ? this.T.c : '';
  }
  captureTo(g, w, h) {
    if (!this.renderer || this._dead) return;
    this.renderer.render(this.scene, this.camera);                 // 그린 직후 같은 순간에 복사해야 빈 화면이 아님
    g.drawImage(this.glCanvas, 0, 0, w, h);
    if (this.hudCanvas && this.hudCanvas.width) g.drawImage(this.hudCanvas, 0, 0, w, h);
  }
  // 판을 끝낼 때: 입력 리스너 · GPU 자원(그물 · 재질 · 인스턴스 · 그림자) 정리 — renderer.dispose() 보다 먼저
  destroy() {
    if (this._dead) return; this._dead = true;
    (this._offs || []).forEach(f => { try { f(); } catch (e) {} }); this._offs = [];
    try { this.freeGL(); } catch (e) {}
    try { this.renderer.dispose(); } catch (e) {}
    try { if (this.hudCanvas.parentNode) this.hudCanvas.parentNode.removeChild(this.hudCanvas); } catch (e) {}
    this.mmCanvas = null;
  }
  freeGL() {
    if (!this.scene) return; const seen = new Set();
    const tex = t => { if (t && t.isTexture && !seen.has(t)) { seen.add(t); t.dispose(); } };
    this.scene.traverse(o => {
      if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
      [].concat(o.material || []).forEach(m => { if (!m || seen.has(m)) return; seen.add(m); Object.keys(m).forEach(k => tex(m[k])); m.dispose(); });
      if (o.isInstancedMesh && o.dispose) o.dispose();
      if (o.isLight && o.shadow && o.shadow.map) { o.shadow.map.dispose(); o.shadow.map = null; }
    });
  }

  // ══ 장면 만들기 ══
  // 색(sRGB 0~1) → 렌더러 색 공간 (화질 mid/high 는 선형으로)
  col(r, g, b) { if (g == null) { const c = new THREE.Color(r); r = c.r; g = c.g; b = c.b; } return this.lin ? [Math.pow(r, 2.2), Math.pow(g, 2.2), Math.pow(b, 2.2)] : [r, g, b]; }
  color3(hex) { const c = new THREE.Color(hex); if (this.lin) c.convertSRGBToLinear(); return c; }
  initThree() {
    const T = THREE, map = this.mapId;
    const r = this.renderer = new T.WebGLRenderer({ canvas: this.glCanvas, antialias: (window.devicePixelRatio || 1) < 2 });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.opts.maxDpr || 1.25));
    this.hq = 'low'; this.hqLocked = false;
    if (window.ThreeQuality) { const pq = ThreeQuality.pick(r, this.opts); this.hq = pq.q; this.hqLocked = !!pq.locked; }
    this.lin = this.hq !== 'low';
    const sc = this.scene = new T.Scene(); sc.background = new T.Color(TK3_SKY[map]); sc.fog = new T.Fog(TK3_SKY[map], 70, 170);
    this.camera = new T.PerspectiveCamera(40, 1, 1, 400);
    this.hemi = new T.HemisphereLight(0xFFFFFF, map === 'snow' ? 0x8E9CB0 : 0x7E6E52, 0.78); sc.add(this.hemi);
    const sun = this.sun = new T.DirectionalLight(0xFFF2DC, 0.8); sun.position.set(-26, 52, 34); sc.add(sun); sc.add(sun.target);   // 남서쪽 높이에서 → 그림자는 북동쪽(화면 오른쪽 위)
    this.tmpV = new T.Vector3(); this.tmpM = new T.Matrix4(); this.tmpM2 = new T.Matrix4(); this.tmpQ = new T.Quaternion(); this.tmpS = new T.Vector3(1, 1, 1); this.tmpP = new T.Vector3();
    this.vF = new T.Vector3(); this.vU = new T.Vector3(); this.vR = new T.Vector3(); this.vX = new T.Vector3(1, 0, 0); this.vD = new T.Vector3(); this.tmpC = new T.Color();
    this.buildTerrain();
    this.buildObs();
    this.buildTanks();
    this.buildFx();
    this.camT = new T.Vector3(this.x, this.world.height(this.x, this.z), this.z); this.camSnap = true;
    if (this.hq !== 'low' && window.ThreeQuality) ThreeQuality.apply(this, { half: 34, far: 220, tone: 'none', sun: 0.95, hemi: 0.72 });   // 색 보정 · 태양 그림자 (three-quality.js)
  }

  // 지형: 정점 색 한 덩어리 + 물 · 맵 바깥 땅 · 가장자리 둑
  buildTerrain() {
    const T = THREE, W = this.world, N = W.N, V = N + 1, cs = W.cs, H = W.hgt, M = W.mat, L = this.L, map = this.mapId, team = !this.ffa;
    const pos = new Float32Array(V * V * 3), col = new Float32Array(V * V * 3), sm = tkSm, mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const P = {
      hills:  { lo: [0.33, 0.55, 0.25], hi: [0.62, 0.76, 0.36], mud: [0.55, 0.45, 0.3], bed: [0.36, 0.42, 0.3], rock: [0.56, 0.52, 0.44] },
      canyon: { lo: [0.86, 0.68, 0.46], hi: [0.84, 0.56, 0.38], mud: [0.72, 0.56, 0.4], bed: [0.7, 0.55, 0.4], rock: [0.66, 0.4, 0.27] },
      snow:   { lo: [0.86, 0.9, 0.95], hi: [0.96, 0.97, 0.99], mud: [0.74, 0.79, 0.86], bed: [0.62, 0.72, 0.82], rock: [0.5, 0.53, 0.58] }
    }[map];
    this.gcol = new Float32Array(V * V * 3);                                   // 미니맵용 (sRGB)
    for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
      const k = j * V + i, h = H[k], x = i * cs, z = j * cs; pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      const sl = W.slopeAtGrid(i, j), avg = (H[j * V + Math.max(0, i - 1)] + H[j * V + Math.min(N, i + 1)] + H[Math.max(0, j - 1) * V + i] + H[Math.min(N, j + 1) * V + i]) / 4;
      let c = mix(P.lo, P.hi, sm((h + 0.5) / 5.5));
      if (M[k] === 1) c = mix(c, P.mud, 0.8); else if (M[k] === 2) c = P.bed.slice();
      if (map === 'canyon' && h > 2.6) c = mix(c, P.hi, 0.7);
      const st = sm((sl - 0.55) / 0.45); if (st > 0) { let rk = P.rock; if (map === 'canyon') { const band = ((h * 1.6) % 1 + 1) % 1 > 0.5 ? 0.92 : 1.04; rk = [rk[0] * band, rk[1] * band, rk[2] * band]; } c = mix(c, rk, st); }
      // 골짜기 어둡게 · 능선 밝게 · 잔무늬
      const cv = Math.max(-0.16, Math.min(0.1, (h - avg) * 0.45)), nz = 0.95 + 0.08 * tkHash(i, j, 77), b = (1 + cv) * nz;
      c = [c[0] * b, c[1] * b, c[2] * b];
      if (team) { const tr = sm((L * 0.17 - z) / (L * 0.06)), tb = sm((z - L * 0.83) / (L * 0.06)); if (tr > 0) c = mix(c, [0.95, 0.42, 0.42], tr * 0.16); if (tb > 0) c = mix(c, [0.4, 0.62, 0.98], tb * 0.16); }
      const cl = this.col(Math.min(1, c[0]), Math.min(1, c[1]), Math.min(1, c[2])); col[k * 3] = cl[0]; col[k * 3 + 1] = cl[1]; col[k * 3 + 2] = cl[2];
      this.gcol[k * 3] = c[0]; this.gcol[k * 3 + 1] = c[1]; this.gcol[k * 3 + 2] = c[2];
    }
    // 칸 하나 = 삼각형 둘 (TkWorld.height 와 같은 나눔)
    const idx = new (V * V > 65535 ? Uint32Array : Uint16Array)(N * N * 6); let q = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * V + i, b = a + 1, c = a + V, d = c + 1; idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = d; idx[q++] = b; idx[q++] = c; }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3)); g.setIndex(new T.BufferAttribute(idx, 1)); g.computeVertexNormals(); g.computeBoundingSphere();
    const terr = this.terrain = new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true })); terr.userData.flat = true; this.scene.add(terr);
    // 물 (초원: 연못 · 눈: 얼음)
    let hasW = false; for (let k = 0; k < M.length; k++) if (M[k] === 2) { hasW = true; break; }
    if (hasW) { const wg = new T.PlaneGeometry(L, L); wg.rotateX(-Math.PI / 2);
      const wm = map === 'snow' ? new T.MeshLambertMaterial({ color: 0xCFE6F4, transparent: true, opacity: 0.88 }) : new T.MeshLambertMaterial({ color: 0x3F8FCF, transparent: true, opacity: 0.72 });
      const wmesh = new T.Mesh(wg, wm); wmesh.position.set(L / 2, TK_WL + 0.03, L / 2); wmesh.userData.noShadow = true; wmesh.renderOrder = 1; this.scene.add(wmesh); }
    // 맵 바깥 땅 (네 장을 한 덩어리로) · 가장자리 둑 (지형 높이를 따라가는 낮은 벽)
    const E = 260, oc = this.col(P.lo[0] * 0.7 + 0.08, P.lo[1] * 0.66 + 0.08, P.lo[2] * 0.66 + 0.1), parts = [];   // 맵 바깥: 조금 어둡고 흐린 색
    [[-E / 2, L / 2, E, L + 2 * E], [L + E / 2, L / 2, E, L + 2 * E], [L / 2, -E / 2, L, E], [L / 2, L + E / 2, L, E]].forEach(([cx, cz, w, d]) => { const pg = new T.PlaneGeometry(w, d); pg.rotateX(-Math.PI / 2); parts.push(tk3P(pg, cx, -0.4, cz, oc)); });
    const out = new T.Mesh(tk3Merge(parts), new T.MeshLambertMaterial({ vertexColors: true })); out.userData.flat = true; this.scene.add(out);
    const wp = [], wc = this.col(0.42, 0.38, 0.33), wt = this.col(0.58, 0.54, 0.48);
    const edge = (fx, fz) => { for (let t = 0; t < N; t++) { const p0 = fx(t), p1 = fx(t + 1), h0 = H[fz(t)], h1 = H[fz(t + 1)], y0 = Math.min(h0, h1, -0.4) - 0.6;
      wp.push([p0[0], y0, p0[1], p1[0], y0, p1[1], p1[0], h1 + 0.75, p1[1], p0[0], h0 + 0.75, p0[1]]); } };
    edge(t => [t * cs, 0], t => t); edge(t => [t * cs, L], t => N * V + t); edge(t => [0, t * cs], t => t * V); edge(t => [L, t * cs], t => t * V + N);
    const wpos = new Float32Array(wp.length * 18), wcol = new Float32Array(wp.length * 18); let o = 0;
    wp.forEach(a => { [0, 1, 2, 0, 2, 3].forEach(v => { wpos[o] = a[v * 3]; wpos[o + 1] = a[v * 3 + 1]; wpos[o + 2] = a[v * 3 + 2]; const cc = v >= 2 ? wt : wc; wcol[o] = cc[0]; wcol[o + 1] = cc[1]; wcol[o + 2] = cc[2]; o += 3; }); });
    const wgeo = new T.BufferGeometry(); wgeo.setAttribute('position', new T.BufferAttribute(wpos, 3)); wgeo.setAttribute('color', new T.BufferAttribute(wcol, 3)); wgeo.computeVertexNormals();
    const wall = new T.Mesh(wgeo, new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide })); wall.userData.flat = true; this.scene.add(wall);
    // 미니맵 바탕 그림 (한 번만)
    const MM = 128, mc = this.mmCanvas = document.createElement('canvas'); mc.width = mc.height = MM; const mg = mc.getContext('2d'), im = mg.createImageData(MM, MM);
    for (let y = 0; y < MM; y++) for (let x = 0; x < MM; x++) { const i = Math.min(N, Math.round(x / (MM - 1) * N)), j = Math.min(N, Math.round(y / (MM - 1) * N)), k = j * V + i, p = (y * MM + x) * 4;
      let r = this.gcol[k * 3], gg = this.gcol[k * 3 + 1], b = this.gcol[k * 3 + 2]; if (M[k] === 2) { r = 0.3; gg = 0.55; b = 0.82; }
      const sh = 0.75 + 0.25 * sm((H[k] + 1) / 6); im.data[p] = r * sh * 255; im.data[p + 1] = gg * sh * 255; im.data[p + 2] = b * sh * 255; im.data[p + 3] = 255; }
    mg.putImageData(im, 0, 0);
    W.obs.forEach(ob => { if (ob.k === 'bunker' || ob.k === 'tower') { mg.fillStyle = 'rgba(60,52,44,0.85)'; const s = ob.k === 'bunker' ? 4 : 3; mg.fillRect(ob.x / L * MM - s / 2, ob.z / L * MM - s / 2, s, s); } });
  }

  // 구조물 · 나무 · 바위: 종류마다 InstancedMesh 하나 (부서지면 숨기고 잔해를 보임)
  buildObs() {
    const T = THREE, W = this.world, map = this.mapId, c = (r, g, b) => this.col(r, g, b);
    const geos = {};
    // 상자: 나무 상자 + 대각선 널빤지
    geos.crate = tk3Merge([tk3P(new T.BoxGeometry(1.6, 1.9, 1.6), 0, 0.35, 0, c(0.74, 0.54, 0.32)), tk3P(new T.BoxGeometry(2.0, 0.08, 0.22), 0, 1.31, 0, c(0.55, 0.38, 0.22), 0, 0.785, 0), tk3P(new T.BoxGeometry(2.0, 0.08, 0.22), 0, 1.31, 0, c(0.55, 0.38, 0.22), 0, -0.785, 0),
      tk3P(new T.BoxGeometry(1.64, 0.16, 1.64), 0, 0.65, 0, c(0.6, 0.42, 0.25))]);
    // 모래주머니: 두 줄 (앞뒤로 길게 = x)
    { const bp = []; for (let row = 0; row < 2; row++) for (let i = 0; i < (row ? 4 : 5); i++) { const x = -1.36 + i * 0.68 + (row ? 0.34 : 0), sh = (i + row) % 2 ? 0.93 : 1;
        bp.push(tk3P(new T.BoxGeometry(0.64, row ? 0.46 : 0.9, 0.95 - row * 0.1), x, row ? 0.92 : 0.24, 0, c(0.82 * sh, 0.74 * sh, 0.54 * sh))); }
      geos.sandbag = tk3Merge(bp); }
    // 벙커: 콘크리트 몸통 + 지붕 + 사방 총안(어두운 띠) + 출입구
    { const gp = [tk3P(new T.BoxGeometry(4.2, 2.6, 4.2), 0, 0.7, 0, c(0.64, 0.64, 0.6)), tk3P(new T.BoxGeometry(4.7, 0.45, 4.7), 0, 2.2, 0, c(0.55, 0.56, 0.53)), tk3P(new T.BoxGeometry(1.2, 0.3, 1.2), 0, 2.55, 0, c(0.45, 0.46, 0.44))];
      [0, 1, 2, 3].forEach(s => { const a = s * Math.PI / 2; gp.push(tk3P(new T.BoxGeometry(2.8, 0.3, 0.06), Math.cos(a) * 2.11, 1.5, Math.sin(a) * 2.11, c(0.12, 0.12, 0.13), 0, -a + Math.PI / 2, 0)); });
      geos.bunker = tk3Merge(gp); }
    // 감시탑: 다리 넷 + 오두막 + 지붕
    { const gp = []; [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => gp.push(tk3P(new T.BoxGeometry(0.3, 5.4, 0.3), a * 0.95, 2.1, b * 0.95, c(0.45, 0.33, 0.22))));
      gp.push(tk3P(new T.BoxGeometry(2.3, 0.18, 0.18), 0, 2.2, 0.95, c(0.42, 0.31, 0.2), 0, 0, 0.5), tk3P(new T.BoxGeometry(2.3, 0.18, 0.18), 0, 2.2, -0.95, c(0.42, 0.31, 0.2), 0, 0, -0.5));
      gp.push(tk3P(new T.BoxGeometry(2.5, 1.3, 2.5), 0, 5.0, 0, c(0.66, 0.5, 0.33)), tk3P(new T.BoxGeometry(2.56, 0.35, 2.56), 0, 4.75, 0, c(0.3, 0.24, 0.18)), tk3P(new T.ConeGeometry(2.1, 1.1, 4), 0, 6.2, 0, c(0.62, 0.28, 0.22), 0, Math.PI / 4, 0));
      geos.tower = tk3Merge(gp); }
    // 나무 (맵마다): 초원 = 둥근 잎 · 눈 = 침엽수 + 눈 · 협곡 = 마른 덤불나무
    if (map === 'snow') geos.tree = tk3Merge([tk3P(new T.CylinderGeometry(0.2, 0.26, 1.6, 6), 0, 0.5, 0, c(0.4, 0.3, 0.22)), tk3P(new T.ConeGeometry(1.6, 2.2, 8), 0, 2.0, 0, c(0.16, 0.38, 0.27)), tk3P(new T.ConeGeometry(1.2, 1.8, 8), 0, 3.2, 0, c(0.19, 0.43, 0.3)), tk3P(new T.ConeGeometry(0.62, 1.1, 8), 0, 4.3, 0, c(0.92, 0.95, 0.98))]);
    else if (map === 'canyon') geos.tree = tk3Merge([tk3P(new T.CylinderGeometry(0.16, 0.24, 2.2, 6), 0, 0.8, 0, c(0.48, 0.36, 0.26)), tk3P(new T.IcosahedronGeometry(1.15, 0), 0, 2.4, 0, c(0.55, 0.58, 0.32)), tk3P(new T.IcosahedronGeometry(0.8, 0), 0.6, 2.9, 0.3, c(0.6, 0.62, 0.36))]);
    else geos.tree = tk3Merge([tk3P(new T.CylinderGeometry(0.2, 0.28, 2.0, 6), 0, 0.7, 0, c(0.44, 0.32, 0.22)), tk3P(new T.IcosahedronGeometry(1.5, 1), 0, 2.7, 0, c(0.3, 0.56, 0.26)), tk3P(new T.IcosahedronGeometry(1.05, 1), 0.45, 3.7, 0.25, c(0.38, 0.64, 0.3))]);
    const rc = map === 'canyon' ? c(0.66, 0.45, 0.32) : map === 'snow' ? c(0.58, 0.61, 0.67) : c(0.6, 0.59, 0.56);
    geos.rock = tk3Merge([tk3P(new T.IcosahedronGeometry(1, 0), 0, 0, 0, rc)]);
    geos.rubble = tk3Merge([tk3P(new T.BoxGeometry(1.0, 0.35, 0.7), -0.4, 0.1, 0.2, c(0.42, 0.4, 0.37), 0, 0.4, 0.1), tk3P(new T.BoxGeometry(0.8, 0.3, 0.9), 0.45, 0.08, -0.25, c(0.36, 0.34, 0.31), 0.1, -0.3, 0), tk3P(new T.BoxGeometry(0.6, 0.45, 0.5), 0.1, 0.15, 0.55, c(0.48, 0.45, 0.4), 0, 1, 0.2), tk3P(new T.BoxGeometry(2.2, 0.08, 2.0), 0, -0.02, 0, c(0.28, 0.27, 0.25))]);
    const mat = this.obsMat = new T.MeshLambertMaterial({ vertexColors: true });
    const by = {}; W.obs.forEach(o => { (by[o.k] = by[o.k] || []).push(o); });
    this.obsMesh = {}; this.dyn = [];
    const destructible = W.obs.filter(o => o.max);
    const rub = this.rubMesh = new T.InstancedMesh(geos.rubble, mat, Math.max(1, destructible.length)); rub.count = destructible.length; this.scene.add(rub);
    const M = this.tmpM;
    Object.keys(by).forEach(k => {
      const list = by[k], mesh = new T.InstancedMesh(geos[k], mat, list.length); this.obsMesh[k] = mesh;
      list.forEach((o, i) => { o._mi = i; o._mk = k;
        if (k === 'tree' || k === 'rock') { const tint = 0.86 + 0.24 * tkHash(o.id, 3, 9); this.tmpC.setRGB(tint, tint * (k === 'tree' ? 0.97 + 0.08 * tkHash(o.id, 4, 9) : 1), tint); mesh.setColorAt(i, this.tmpC); }
        else { this.tmpC.setRGB(1, 1, 1); mesh.setColorAt(i, this.tmpC); }
        this.obsMatrix(o, M); mesh.setMatrixAt(i, M); });
      this.scene.add(mesh);
    });
    Object.keys(geos).forEach(k => { if (k !== 'rubble' && !by[k]) geos[k].dispose(); });
    destructible.forEach((o, i) => { o._ri = i; this.hideAt(rub, i); this.dyn.push(o); });
    this.dynShown = new Uint8Array(this.dyn.length);                         // 이 화면에 그린 부서짐 상태 (지형 · 구조물은 같은 기기의 엔진끼리 함께 씀)
    rub.instanceMatrix.needsUpdate = true;
  }
  obsMatrix(o, M) {
    const T = THREE, Q = this.tmpQ, S = this.tmpS, P = this.tmpP;
    let ry = 0, sx = 1, sy = 1, sz = 1, y = o.y;
    if (o.k === 'sandbag') ry = o.rot ? Math.PI / 2 : 0;
    else if (o.k === 'tree') { ry = tkHash(o.id, 1, 5) * 6.28; sx = sy = sz = o.s || 1; y -= 0.1; }
    else if (o.k === 'rock') { ry = tkHash(o.id, 2, 5) * 6.28; sx = sz = o.r * 1.05; sy = o.h * 0.55; y -= 0.25; }
    else if (o.k === 'crate') ry = 0;
    Q.setFromAxisAngle(this.vU.set(0, 1, 0), ry); S.set(sx, sy, sz); P.set(o.x, y, o.z); M.compose(P, Q, S); return M;
  }
  hideAt(mesh, i) { this.tmpS.set(0.0001, 0.0001, 0.0001); this.tmpP.set(0, -50, 0); this.tmpQ.set(0, 0, 0, 1); this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS); mesh.setMatrixAt(i, this.tmpM); }
  // 부서짐 · 다시 생김이 바뀐 것만 행렬을 고침
  updateObs() {
    let ch = false; const sh = this.dynShown;
    for (let i = 0; i < this.dyn.length; i++) { const o = this.dyn[i], d = o.dead ? 1 : 0; if (d === sh[i]) continue; sh[i] = d; ch = true; const mesh = this.obsMesh[o._mk];
      if (o.dead) { this.hideAt(mesh, o._mi); const s = o.k === 'bunker' ? 2.2 : o.k === 'tower' ? 1.4 : o.k === 'sandbag' ? 1.2 : 0.85;
        this.tmpQ.setFromAxisAngle(this.vU.set(0, 1, 0), o.rot ? Math.PI / 2 : 0); this.tmpS.set(o.k === 'sandbag' ? 1.6 : s, 1, o.k === 'sandbag' ? 0.6 : s); this.tmpP.set(o.x, o.y, o.z); this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS); this.rubMesh.setMatrixAt(o._ri, this.tmpM); }
      else { mesh.setMatrixAt(o._mi, this.obsMatrix(o, this.tmpM)); this.hideAt(this.rubMesh, o._ri); }
      mesh.instanceMatrix.needsUpdate = true; }
    if (ch) this.rubMesh.instanceMatrix.needsUpdate = true;
  }

  // 전차: 종류마다 차체 · 포탑 InstancedMesh (+ 먼 전차용 간단한 상자 둘) — 팀색은 인스턴스 색 × 정점 색
  tankHullGeo(type) {
    const T = THREE, S = TK3_SHAPE[type], c = v => this.col(v, v, v), L = S.L, W = S.W, H = S.H, P = [];
    [-1, 1].forEach(sd => { const z = sd * (W / 2 - 0.3);
      P.push(tk3P(new T.BoxGeometry(L, 0.66, 0.6), 0, 0.33, z, c(0.2)));
      [-0.36, -0.12, 0.12, 0.36].forEach(f => P.push(tk3P(new T.CylinderGeometry(0.24, 0.24, 0.64, 8), f * L, 0.3, z, c(0.34), Math.PI / 2, 0, 0)));   // 바퀴
      P.push(tk3P(new T.BoxGeometry(L * 0.98, 0.07, 0.68), 0, 0.68, z, c(0.62))); });
    P.push(tk3P(new T.BoxGeometry(L * 0.84, H, W * 0.86), -L * 0.05, 0.66 + H / 2, 0, c(1)));
    P.push(tk3P(new T.BoxGeometry(L * 0.22, H * 0.9, W * 0.84), L * 0.37, 0.66 + H * 0.36, 0, c(0.9), 0, 0, 0.62));     // 비스듬한 앞판
    P.push(tk3P(new T.BoxGeometry(L * 0.26, 0.1, W * 0.6), -L * 0.33, 0.66 + H + 0.05, 0, c(0.5)));                   // 엔진 덮개
    if (type === 'heavy') P.push(tk3P(new T.BoxGeometry(L * 0.5, 0.12, W * 0.95), L * 0.05, 0.66 + H * 0.55, 0, c(0.78)));   // 옆 장갑판
    if (type === 'eng') { P.push(tk3P(new T.BoxGeometry(0.7, 0.4, 0.5), -L * 0.32, 0.66 + H + 0.2, W * 0.28, c(0.85)), tk3P(new T.BoxGeometry(0.7, 0.4, 0.5), -L * 0.32, 0.66 + H + 0.2, -W * 0.28, c(0.85))); }
    if (type === 'light') P.push(tk3P(new T.BoxGeometry(0.5, 0.25, W * 0.5), -L * 0.36, 0.66 + H + 0.12, 0, c(0.7)));
    return tk3Merge(P);
  }
  tankTurretGeo(type) {
    const T = THREE, S = TK3_SHAPE[type], c = v => this.col(v, v, v), P = [], th = S.th, tx = S.tx;
    if (S.round) P.push(tk3P(new T.CylinderGeometry(S.tw * 0.42, S.tw * 0.5, th, 10), tx, th / 2, 0, c(0.96)));
    else { P.push(tk3P(new T.BoxGeometry(S.tl, th, S.tw), tx, th / 2, 0, c(0.96)));
      P.push(tk3P(new T.BoxGeometry(S.tl * 0.3, th * 0.85, S.tw * 0.8), tx + S.tl * 0.5, th * 0.42, 0, c(0.88), 0, 0, 0.5)); }      // 앞 경사
    const front = tx + (S.round ? S.tw * 0.42 : S.tl / 2), pitch = S.pitch || 0, len = S.bl, by = th * 0.55;
    P.push(tk3P(new T.BoxGeometry(0.34, 0.32, 0.5), front, by, 0, c(0.6)));                                            // 포 방패
    P.push(tk3P(new T.CylinderGeometry(S.br, S.br * 1.15, len, 8), front + Math.cos(pitch) * len / 2, by + Math.sin(pitch) * len / 2, 0, c(0.42), 0, 0, -Math.PI / 2 + pitch));
    if (S.brake) P.push(tk3P(new T.BoxGeometry(0.34, 0.3, 0.42), front + len, by, 0, c(0.36)));
    if (type === 'td') P.push(tk3P(new T.CylinderGeometry(S.br * 1.5, S.br * 1.5, 0.4, 8), front + len - 0.1, by, 0, c(0.36), 0, 0, -Math.PI / 2));
    if (!S.round && type !== 'td') P.push(tk3P(new T.CylinderGeometry(0.26, 0.28, 0.16, 8), tx - S.tl * 0.15, th + 0.08, S.tw * 0.2, c(0.72)));   // 해치
    if (type === 'light') P.push(tk3P(new T.BoxGeometry(0.04, 1.4, 0.04), tx - 0.4, th + 0.7, -0.35, c(0.3)));          // 안테나
    if (type === 'arty') P.push(tk3P(new T.BoxGeometry(S.tl * 0.9, 0.08, S.tw * 1.02), tx, th - 0.04, 0, c(0.7)));
    if (S.crane) { P.push(tk3P(new T.BoxGeometry(0.16, 1.1, 0.16), -0.75, 0.55, 0.45, c(0.86)), tk3P(new T.BoxGeometry(1.3, 0.12, 0.12), -0.35, 1.05, 0.45, c(0.86), 0, 0, -0.35), tk3P(new T.BoxGeometry(0.06, 0.45, 0.06), 0.25, 0.65, 0.45, c(0.3)));
      P.push(tk3P(new T.BoxGeometry(0.5, 0.12, 0.12), 0, th + 0.02, 0, c(0.98)), tk3P(new T.BoxGeometry(0.12, 0.12, 0.5), 0, th + 0.02, 0, c(0.98))); }   // 수리 십자
    return tk3Merge(P);
  }
  buildTanks() {
    const T = THREE, sc = this.scene, mat = this.tankMat = new T.MeshLambertMaterial({ vertexColors: true });
    // r128: setColorAt 은 그때의 count 로 색 버퍼를 만듦 → 색을 먼저 채우고 count 를 0 으로
    const mk = (geo, n) => { const m = new T.InstancedMesh(geo, mat, n); this.tmpC.setRGB(1, 1, 1); for (let i = 0; i < n; i++) m.setColorAt(i, this.tmpC); m.count = 0; m.frustumCulled = false; m.instanceMatrix.setUsage(T.DynamicDrawUsage); m.visible = false; sc.add(m); return m; };
    this.hullMesh = {}; this.turMesh = {};
    TK_ORDER.forEach(k => { this.hullMesh[k] = mk(this.tankHullGeo(k), TK3_MAXT); this.turMesh[k] = mk(this.tankTurretGeo(k), TK3_MAXT); });
    const c = v => this.col(v, v, v);
    this.farHull = mk(tk3Merge([tk3P(new T.BoxGeometry(3.4, 0.66, 2.3), 0, 0.33, 0, c(0.22)), tk3P(new T.BoxGeometry(3.0, 0.7, 2.1), 0, 1.0, 0, c(1))]), TK3_MAXT * 2);
    this.farTur = mk(tk3Merge([tk3P(new T.BoxGeometry(1.6, 0.6, 1.4), 0, 0.3, 0, c(0.96)), tk3P(new T.BoxGeometry(2.0, 0.2, 0.2), 1.6, 0.33, 0, c(0.42))]), TK3_MAXT * 2);
    // 발밑 고리 (나 = 노랑 · 우리 팀 = 파랑 · 상대 = 빨강) · 표적 고리 · 곡사 조준 고리
    const rg = new T.RingGeometry(1.0, 1.14, 32); rg.rotateX(-Math.PI / 2);
    const rmat = new T.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.7, depthWrite: false, depthTest: false });   // 나무 · 언덕 뒤에서도 보임 (전차 위치 알림)
    this.ringMesh = new T.InstancedMesh(rg, rmat, TK3_MAXT + 40); this.tmpC.setRGB(1, 1, 1); for (let i = 0; i < TK3_MAXT + 40; i++) this.ringMesh.setColorAt(i, this.tmpC);
    this.ringMesh.count = 0; this.ringMesh.frustumCulled = false; this.ringMesh.userData.noShadow = true; this.ringMesh.renderOrder = 2; sc.add(this.ringMesh);
    // 방어막 (반투명 공)
    this.shieldMesh = new T.InstancedMesh(new T.IcosahedronGeometry(1, 2), new T.MeshBasicMaterial({ color: 0x7FE6FF, transparent: true, opacity: 0.28, depthWrite: false, blending: T.AdditiveBlending }), TK3_MAXT);
    this.shieldMesh.count = 0; this.shieldMesh.frustumCulled = false; this.shieldMesh.userData.noShadow = true; sc.add(this.shieldMesh);
    // 색
    this.cTeam = { r: this.color3(TK3_TEAM.r), b: this.color3(TK3_TEAM.b) }; this.cFfa = TK3_FFA.map(h => this.color3(h)); this.cMeFfa = this.color3(TK3_ME_FFA); this.cGray = this.color3(0x9AA0AA);
    this.cRing = { me: new T.Color(0xFFD166), r: new T.Color(0xFF8A8A), b: new T.Color(0x7CC4FF), foe: new T.Color(0xFF5A5A), tgt: new T.Color(0xFF3B3B), arty: new T.Color(0xFFA43B), mine: new T.Color(0xFF7043) };
  }
  // 포탄 · 폭발 · 연기 · 수리 구역 · 지뢰: 미리 만든 인스턴스를 다시 씀
  buildFx() {
    const T = THREE, sc = this.scene;
    const inst = (geo, mat, n, color) => { const m = new T.InstancedMesh(geo, mat, n); if (color) { this.tmpC.setRGB(1, 1, 1); for (let i = 0; i < n; i++) m.setColorAt(i, this.tmpC); }
      m.count = 0; m.frustumCulled = false; m.userData.noShadow = true; m.instanceMatrix.setUsage(T.DynamicDrawUsage); sc.add(m); return m; };
    const sg = new T.BoxGeometry(1, 0.2, 0.2);
    this.shellMesh = inst(sg, new T.MeshBasicMaterial({ color: 0xFFE08A }), 160);
    this.lobMesh = inst(new T.IcosahedronGeometry(0.32, 1), new T.MeshBasicMaterial({ color: 0x3A3530 }), 80);
    this.flashMesh = inst(new T.IcosahedronGeometry(1, 1), new T.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, depthWrite: false, blending: T.AdditiveBlending }), 64, true);
    this.puffMesh = inst(new T.IcosahedronGeometry(1, 1), new T.MeshLambertMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.62, depthWrite: false }), 420, true);
    this.puffMesh.renderOrder = 3;
    const zg = new T.CylinderGeometry(1, 1, 1, 32, 1, true); zg.translate(0, 0.5, 0);
    this.zoneMesh = inst(zg, new T.MeshBasicMaterial({ color: 0x5EE07A, transparent: true, opacity: 0.32, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending }), 24);
    this.mineMesh = inst(tk3Merge([tk3P(new T.CylinderGeometry(0.45, 0.5, 0.18, 10), 0, 0.09, 0, this.col(0.25, 0.25, 0.25)), tk3P(new T.CylinderGeometry(0.12, 0.12, 0.08, 6), 0, 0.2, 0, this.col(1, 0.3, 0.2))]), new T.MeshLambertMaterial({ vertexColors: true }), 8);
    this.cPuff = { smoke: this.color3(0x6E6A66), dark: this.color3(0x4A4642), dirt: this.color3(0x9A7A55), cloud: this.color3(0xE6E8EC), snow: this.color3(0xF2F6FA) };
    this.cFlash = { boom: new T.Color(1, 0.62, 0.22), spark: new T.Color(1, 0.88, 0.45) };
  }

  // ══ 그리기 ══
  draw() {
    if (this._dead || !this.renderer) return;
    const now = this.now, dt = this.drawAt ? Math.max(0.001, Math.min(0.1, (performance.now() - this.drawAt) / 1000)) : 0.016; this.drawAt = performance.now();
    if (this._camZoom !== this.T.c) this.resize();
    this.updateCamera(dt);
    this.updateTanks(now);
    this.updateObs();
    this.updateShells();
    this.updateFx(now);
    if (window.ThreeQuality && this.hq !== 'low') ThreeQuality.frame(this, this.camT.x, this.camT.y, this.camT.z, now);   // 그림자 범위가 나를 따라옴 · 느리면 그림자 끔
    this.renderer.render(this.scene, this.camera);
    this.drawHud();
  }
  updateCamera(dt) {
    const T = this.camT, W = this.world;
    let tx = this.x, tz = this.z;
    if (this.alive) { tx += Math.max(-4, Math.min(4, this.vx * 0.35)); tz += Math.max(-4, Math.min(4, this.vz * 0.35)); }
    // 맵 가장자리에서는 카메라가 바깥을 너무 많이 보이지 않게 (전차가 화면 가운데에서 조금 비켜남)
    const asp = this.vw / this.vh, hw = asp < 1 ? 14 : 15 * asp, hh = asp < 1 ? 14 / asp : 15, L = this.L, mx = Math.min(L / 2, hw * 0.5), mn = Math.min(L / 2, hh), ms = Math.min(L / 2, hh * 0.6);
    const port = asp < 1, ox = port ? 3 : 8, on = port ? 7 : 5;              // 그래도 전차가 위쪽 HUD · 카드 밑으로 숨지 않을 만큼만
    tx = this.x + Math.max(-ox, Math.min(ox, Math.max(mx, Math.min(L - mx, tx)) - this.x)); tz = this.z + Math.max(-4, Math.min(on, Math.max(mn, Math.min(L - ms, tz)) - this.z));
    const ty = W.height(tx, tz);
    if (this.camSnap || (this.alive && Math.hypot(T.x - tx, T.z - tz) > 30)) { T.set(tx, ty, tz); this.camSnap = false; }
    else { const k = 1 - Math.exp(-dt * 5); T.x += (tx - T.x) * k; T.z += (tz - T.z) * k; T.y += (ty - T.y) * (1 - Math.exp(-dt * 3)); }
    const d = this.camDist || 40, cam = this.camera;
    cam.position.set(T.x, T.y + d * Math.sin(TK3_PITCH), T.z + d * Math.cos(TK3_PITCH));
    cam.lookAt(T.x, T.y, T.z); cam.updateMatrixWorld();
  }
  // 차체 행렬: 땅 기울기를 따라 (앞뒤 · 좌우 높이 차)
  hullMatrix(M, x, z, h, S) {
    const W = this.world, a = S.L * 0.42, b = S.W * 0.42, ch = Math.cos(h), sh = Math.sin(h);
    const hf = W.height(x + ch * a, z + sh * a), hb = W.height(x - ch * a, z - sh * a), hr = W.height(x - sh * b, z + ch * b), hl = W.height(x + sh * b, z - ch * b), hc = W.height(x, z);
    const F = this.vF.set(ch, (hf - hb) / (2 * a), sh).normalize(), R = this.vR.set(-sh, (hr - hl) / (2 * b), ch).normalize(), U = this.vU.crossVectors(R, F).normalize();
    R.crossVectors(F, U);
    M.makeBasis(F, U, R); M.setPosition(x, Math.max(hc, (hf + hb + hr + hl) / 4) - 0.05, z); return M;
  }
  updateTanks(now) {
    const cnt = this._cnt || (this._cnt = {}); TK_ORDER.forEach(k => { cnt[k] = 0; }); let nf = 0, nr = 0, ns = 0;
    const M = this.tmpM, M2 = this.tmpM2, cx = this.camT.x, cz = this.camT.z;
    const put = (x, z, h, tu, type, color, ring, recoil, shield) => {
      const S = TK3_SHAPE[type] || TK3_SHAPE.medium, far = Math.hypot(x - cx, z - cz) > TK3_FAR;
      this.hullMatrix(M, x, z, h, S);
      if (nr < this.ringMesh.instanceMatrix.count) { M2.copy(M); const s = S.L * 0.62; M2.scale(this.tmpS.set(s, 1, s)); this.ringMesh.setMatrixAt(nr, M2); this.ringMesh.setColorAt(nr, ring); nr++; }
      if (shield && ns < TK3_MAXT) { this.tmpS.set(1, 1, 1).multiplyScalar(S.L * 0.72); this.tmpP.set(x, this.world.height(x, z) + 1.0, z); this.tmpQ.set(0, 0, 0, 1); M2.compose(this.tmpP, this.tmpQ, this.tmpS); this.shieldMesh.setMatrixAt(ns++, M2); }
      const rel = tu - h, hy = 0.66 + S.H - 0.02;
      if (far) { if (nf >= TK3_MAXT * 2) return;
        M2.makeRotationY(-rel); M2.setPosition(S.px, hy, 0); M2.premultiply(M); M2.scale(this.tmpS.set(S.L / 3.4, 1, S.W / 2.3)); this.farTur.setMatrixAt(nf, M2); this.farTur.setColorAt(nf, color);
        M.scale(this.tmpS.set(S.L / 3.4, 1, S.W / 2.3)); this.farHull.setMatrixAt(nf, M); this.farHull.setColorAt(nf, color); nf++; return; }
      const i = cnt[type]; if (i >= TK3_MAXT) return; cnt[type]++;
      this.hullMesh[type].setMatrixAt(i, M); this.hullMesh[type].setColorAt(i, color);
      const ra = -rel; M2.makeRotationY(ra); M2.setPosition(S.px - recoil * Math.cos(ra) * 0.35, hy, recoil * Math.sin(ra) * 0.35); M2.premultiply(M);
      this.turMesh[type].setMatrixAt(i, M2); this.turMesh[type].setColorAt(i, color);
    };
    const blink = t => t && Math.floor(now / 140) % 2 === 0;
    // 다른 전차
    for (const id in this.peers) { const p = this.peers[id]; if (p.dead || p.tx == null) continue;
      const ally = !this.ffa && this.team && p.team === this.team, foe = !ally;
      if (foe && p.smoke && this.alive && Math.hypot(p.x - this.x, p.z - this.z) > 6) { p._vis = false; continue; }   // 연막 속 적은 가까울 때만 보임
      p._vis = true; if (blink(p.prot)) continue;
      const col = this.ffa ? this.cFfa[(tkStrHash(id) >>> 0) % this.cFfa.length] : (this.cTeam[p.team] || this.cGray);
      put(p.x, p.z, p.h, p.tu, p.type, col, this.ffa ? this.cRing.foe : p.team === 'b' ? this.cRing.b : this.cRing.r, 0, p.shield); }   // 팀전 고리 = 그 팀 색 (나는 노랑)
    // 나
    if (this.alive && !blink(this.spawnSafe)) put(this.x, this.z, this.h, this.tu, this.type, this.ffa ? this.cMeFfa : (this.cTeam[this.team] || this.cGray), this.cRing.me, this.recoil || 0, now < this.shieldUntil);
    // 표적 고리 · 곡사 조준 고리 · 내 지뢰
    const flat = (x, z, s, c) => { if (nr >= this.ringMesh.instanceMatrix.count) return; this.tmpQ.set(0, 0, 0, 1); this.tmpS.set(s, 1, s); this.tmpP.set(x, this.world.height(x, z) + 0.15, z); M2.compose(this.tmpP, this.tmpQ, this.tmpS); this.ringMesh.setMatrixAt(nr, M2); this.ringMesh.setColorAt(nr, c); nr++; };
    if (this.alive && this.target && !this.target.dead && this.target._vis !== false) flat(this.target.x, this.target.z, 2.6 + 0.25 * Math.sin(now / 120), this.cRing.tgt);
    if (this.alive && this.T.lob) { if (this.target) flat(this.aimX, this.aimZ, this.T.splash, this.cRing.arty); else if (this.aimPt && now < this.aimUntil) flat(this.aimPt[0], this.aimPt[1], this.T.splash, this.cRing.arty); }
    for (const s of this.shells) if (s.lob && s.mine && !s.bar && nr < this.ringMesh.instanceMatrix.count) flat(s.ex, s.ez, s.splash, this.cRing.arty);
    let nm = 0; for (const mn of this.mines) { if (nm >= 8) break; this.tmpQ.set(0, 0, 0, 1); this.tmpS.set(1, 1, 1); this.tmpP.set(mn.x, this.world.height(mn.x, mn.z), mn.z); M2.compose(this.tmpP, this.tmpQ, this.tmpS); this.mineMesh.setMatrixAt(nm++, M2); }
    this.mineMesh.count = nm; this.mineMesh.visible = nm > 0; this.mineMesh.instanceMatrix.needsUpdate = true;
    const fin = (m, n) => { m.count = n; m.visible = n > 0; if (n) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; } };
    TK_ORDER.forEach(k => { fin(this.hullMesh[k], cnt[k]); fin(this.turMesh[k], cnt[k]); });
    fin(this.farHull, nf); fin(this.farTur, nf); fin(this.ringMesh, nr); fin(this.shieldMesh, ns);
  }
  updateShells() {
    let n1 = 0, n2 = 0; const M = this.tmpM, Q = this.tmpQ, S = this.tmpS, P = this.tmpP, D = this.vD;
    for (const s of this.shells) {
      if (s.delay > 0 || (s.lob && s.t < 0)) continue;
      if (s.lob) { if (n2 >= 80) continue; Q.set(0, 0, 0, 1); const k = s.bar ? 0.8 : 1.15; S.set(k, k, k); P.set(s.x, s.y, s.z); M.compose(P, Q, S); this.lobMesh.setMatrixAt(n2++, M); continue; }
      if (n1 >= 160) continue;
      D.set(s.vx, s.vy, s.vz); const l = D.length() || 1; D.multiplyScalar(1 / l); Q.setFromUnitVectors(this.vX, D);
      const big = s.ap ? 1.7 : s.type === 'td' || s.type === 'heavy' ? 1.25 : s.type === 'light' ? 0.75 : 1; S.set(1.3 * big, big, big); P.set(s.x, s.y, s.z); M.compose(P, Q, S); this.shellMesh.setMatrixAt(n1++, M);
    }
    this.shellMesh.count = n1; this.shellMesh.visible = n1 > 0; if (n1) this.shellMesh.instanceMatrix.needsUpdate = true;
    this.lobMesh.count = n2; this.lobMesh.visible = n2 > 0; if (n2) this.lobMesh.instanceMatrix.needsUpdate = true;
  }
  updateFx(now) {
    const M = this.tmpM, Q = this.tmpQ, S = this.tmpS, P = this.tmpP, C = this.tmpC; let nf = 0, np = 0; Q.set(0, 0, 0, 1);
    const puff = (x, y, z, s, c, k) => { if (np >= 420 || s <= 0.01) return; S.set(s, s * 0.85, s); P.set(x, y, z); M.compose(P, Q, S); this.puffMesh.setMatrixAt(np, M); C.copy(c); if (k != null) C.multiplyScalar(k); this.puffMesh.setColorAt(np, C); np++; };
    for (const f of this.fx) { const t = f.t, s = f.s;
      if ((f.kind === 'boom' || f.kind === 'spark') && nf < 64) { const fade = Math.pow(Math.max(0, 1 - t * (f.kind === 'boom' ? 1.6 : 1)), 1.5); if (fade > 0.01) {
          const sz = f.kind === 'boom' ? s * (0.7 + 1.5 * t) : s * (0.35 + 0.7 * t); S.set(sz, sz, sz); P.set(f.x, f.y, f.z); M.compose(P, Q, S); this.flashMesh.setMatrixAt(nf, M); C.copy(this.cFlash[f.kind]).multiplyScalar(fade); this.flashMesh.setColorAt(nf, C); nf++; } }
      const shrink = t < 0.75 ? 1 : Math.max(0, (1 - t) / 0.25);
      if (f.kind === 'boom') for (let j = 0; j < 3; j++) { const a = j * 2.1 + f.x, r = s * 0.6 * t; puff(f.x + Math.cos(a) * r, f.y - 0.3 + t * 1.8 + j * 0.25, f.z + Math.sin(a) * r, s * (0.45 + 0.75 * t) * shrink, j ? this.cPuff.smoke : this.cPuff.dark); }
      else if (f.kind === 'dirt') for (let j = 0; j < 2; j++) { const a = j * 3 + f.z; puff(f.x + Math.cos(a) * 0.3, f.y + t * 0.8, f.z + Math.sin(a) * 0.3, s * (0.35 + 0.5 * t) * shrink, this.mapId === 'snow' ? this.cPuff.snow : this.cPuff.dirt); }
      else if (f.kind === 'puff') puff(f.x, f.y + t * 0.5, f.z, s * (0.3 + 0.4 * t) * shrink, this.cPuff.smoke, 1.2);
    }
    // 연막: 둥근 연기 8덩이 (켜질 때 커지고 꺼질 때 작아짐)
    for (const sm of this.smokes) { const a0 = Math.min(1, (now - sm.t0) / 400), a1 = Math.min(1, (sm.until - now) / 700), k = Math.max(0, Math.min(a0, a1));
      for (let j = 0; j < 8; j++) { const a = j * 0.785 + sm.t0 * 0.001, r = j === 7 ? 0 : 3.0, x = sm.x + Math.cos(a) * r, z = sm.z + Math.sin(a) * r;
        puff(x, this.world.height(x, z) + 1.3 + 0.2 * Math.sin(now / 500 + j), z, k * (2.5 + 0.3 * Math.sin(now / 700 + j * 1.7)), this.cPuff.cloud); } }
    this.flashMesh.count = nf; this.flashMesh.visible = nf > 0; if (nf) { this.flashMesh.instanceMatrix.needsUpdate = true; this.flashMesh.instanceColor.needsUpdate = true; }
    this.puffMesh.count = np; this.puffMesh.visible = np > 0; if (np) { this.puffMesh.instanceMatrix.needsUpdate = true; this.puffMesh.instanceColor.needsUpdate = true; }
    // 수리 구역 (팀전 정비전차)
    let nz = 0; for (const z of this.zones) { if (nz >= 24) break; const k = Math.min(1, (z.until - now) / 600); S.set(7, 0.9 + 0.2 * Math.sin(now / 200), 7); P.set(z.x, this.world.height(z.x, z.z) - 0.2, z.z); M.compose(P, Q, S); if (k > 0) this.zoneMesh.setMatrixAt(nz++, M); }
    this.zoneMesh.count = nz; this.zoneMesh.visible = nz > 0; if (nz) this.zoneMesh.instanceMatrix.needsUpdate = true;
  }

  // ══ HUD (2D) ══
  // 조작 버튼 자리 (index.html 의 #fps-ctl) — 1초마다 다시 잼. HUD · 카드가 버튼을 피하도록
  measureCtl() {
    const t = performance.now(); if (this._ctl && t - this._ctlAt < 1000 && this._ctlW === this.vw && this._ctlH === this.vh) return this._ctl;
    this._ctlAt = t; this._ctlW = this.vw; this._ctlH = this.vh;
    const out = { joyTop: this.vh, joyRight: 0, btnTop: this.vh, btnLeft: this.vw }, ctl = typeof document !== 'undefined' && document.getElementById('fps-ctl');
    if (ctl) { const hr = this.host.getBoundingClientRect(), j = ctl.querySelector('.fjoy');
      if (j) { const r = j.getBoundingClientRect(); if (r.width) { out.joyTop = r.top - hr.top; out.joyRight = r.right - hr.left; } }
      ctl.querySelectorAll('button').forEach(b => { const r = b.getBoundingClientRect(); if (!r.width) return; out.btnTop = Math.min(out.btnTop, r.top - hr.top); out.btnLeft = Math.min(out.btnLeft, r.left - hr.left); }); }
    return (this._ctl = out);
  }
  layout() {
    const W = this.vw, H = this.vh, port = H > W * 1.05, s = Math.max(0.85, Math.min(1.35, Math.min(W, H) / 400)), C = this.measureCtl();
    let mm = Math.round(port ? Math.min(124, W * 0.3) : Math.min(150, H * 0.3, W * 0.17)); const pad = 8;
    if (C.btnLeft < W - pad && C.btnTop < pad + mm + 8) mm = Math.max(64, Math.round(C.btnTop - pad - 8));   // ★ 버튼 위까지만
    const L = { W, H, port, s, pad, C, mm: { x: W - mm - pad, y: pad, w: mm, h: mm } };
    const lx = 60;                                                         // 왼쪽 위 ← · 소리 버튼(index.html) 자리를 비움
    L.panel = { x: lx, y: pad, w: Math.round(port ? Math.min(W - mm - lx - pad * 2, 250) : Math.min(260 * s, W * 0.3)), h: Math.round(46 * s) };
    L.clock = port ? { x: lx, y: L.panel.y + L.panel.h + 6, align: 'left' } : { x: W / 2, y: pad + 2, align: 'center' };
    const top = port ? Math.max(L.mm.y + mm, L.clock.y + 30 * s) + 8 : pad + 44 * s;
    const ch = Math.round(Math.min((port ? 84 : 78) * Math.min(1.2, s), H * 0.2)), cy = top + 18 * s;
    let cw = port ? W - pad * 2 : Math.min(W - 2 * (mm + pad * 3), 560 * s);
    if (!port) { const rl = Math.min(L.mm.x, C.btnTop < cy + ch ? C.btnLeft : W) - 8; cw = Math.min(cw, 2 * (rl - W / 2)); }
    L.cards = { x: (W - cw) / 2, y: cy, w: cw, h: ch };
    L.feed = { x: W - pad, y: port && this.cards && this.alive ? L.cards.y + L.cards.h + 10 : L.mm.y + mm + 10 };   // 세로 화면: 카드가 있으면 그 아래
    return L;
  }
  drawHud() {
    const c = this.ctx, d = this.hudDpr || 1, W = this.vw, H = this.vh, now = this.now;
    c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, W, H);
    const L = this.layout();
    if (this.hurt > 0.02 && this.alive) { const g = this._vig && this._vigW === W && this._vigH === H ? this._vig : (this._vig = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75)); this._vigW = W; this._vigH = H;
      if (g === this._vig && !g._ok) { g.addColorStop(0, 'rgba(255,40,60,0)'); g.addColorStop(1, 'rgba(255,40,60,0.55)'); g._ok = true; }
      c.globalAlpha = Math.min(1, this.hurt); c.fillStyle = g; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
    this.drawLabels(c, L);
    this.drawTop(c, L);
    this.drawMinimap(c, L);
    this.drawFeed(c, L);
    const selecting = this.sel.open && !this.alive && !this.gameOver;
    if (this.cards && !selecting && !this.gameOver) this.drawCards(c, L); else this.ui.cards.length = 0;
    this.drawToasts(c, L);
    if (this.guideAt && now - this.guideAt < 4600 && this.alive) this.drawGuide(c, L, now - this.guideAt);
    if (selecting && !this._selVis) this.selShownAt = performance.now(); this._selVis = selecting;
    if (!this.alive && !this.gameOver) { if (selecting) this.drawSelect(c, L); else this.drawWait(c, L); } else this.ui.types.length = 0;
    if (this.gameOver && this.result) this.drawResult(c, L);
  }
  toScreen(x, y, z) { const v = this.tmpV.set(x, y, z).project(this.camera); if (v.z > 1 || v.x < -1.2 || v.x > 1.2 || v.y < -1.2 || v.y > 1.2) return null; return [(v.x + 1) / 2 * this.vw, (1 - v.y) / 2 * this.vh]; }
  // 전차 머리 위: 이름 · 레벨 · 체력 막대 · 구조물 체력 · 피해 숫자
  drawLabels(c, L) {
    const s = L.s, bw = 46 * s, bh = 6 * s;
    const bar = (x, y, k, col) => { c.fillStyle = 'rgba(14,18,34,0.85)'; tk3RR(c, x - bw / 2 - 2, y - 2, bw + 4, bh + 4, 3); c.fill(); c.fillStyle = col; tk3RR(c, x - bw / 2, y, bw * Math.max(0, Math.min(1, k)), bh, 2); c.fill(); };
    for (const id in this.peers) { const p = this.peers[id]; if (p.dead || p.tx == null || p._vis === false) continue;
      const S = TK3_SHAPE[p.type] || TK3_SHAPE.medium, sp = this.toScreen(p.x, this.world.height(p.x, p.z) + 2.4 + S.H, p.z); if (!sp) continue;
      const ally = !this.ffa && this.team && p.team === this.team;
      bar(sp[0], sp[1], (p.hpPct || 0) / 100, !this.ffa && p.team === 'b' ? '#56B8FF' : '#FF5A6E');            // 막대 = 팀 색 · 이름: 우리 팀 흰색
      tk3T(c, (p.name || '?') + ' ' + p.lv, sp[0], sp[1] - 8 * s, 11 * s, ally ? '#FFFFFF' : '#FFD3D8', 'center', null, 700);
      if (p.prot) tk3T(c, '보호', sp[0], sp[1] + bh + 9 * s, 9 * s, '#FFFFFF', 'center', null, 700); }
    if (this.alive) { const sp = this.toScreen(this.x, this.y + 2.4 + this.T.r * 0.5, this.z);
      if (sp) { bar(sp[0], sp[1], this.hp / this.maxHpOf(), '#5EE07A'); if (this.spawnSafe) tk3T(c, '보호 중', sp[0], sp[1] - 9 * s, 10 * s, '#FFFFFF', 'center', null, 700);
        else if (this.apArmed) tk3T(c, '철갑탄 장전', sp[0], sp[1] - 9 * s, 10 * s, '#FFD166', 'center', null, 700); } }
    // 부서지는 중인 구조물 (가까운 것 6개까지)
    let n = 0; for (const o of this.dyn) { if (n >= 6) break; if (o.dead || o.hp >= o.max || Math.abs(o.x - this.camT.x) > 30 || Math.abs(o.z - this.camT.z) > 30) continue;
      const sp = this.toScreen(o.x, o.y + o.h + 0.6, o.z); if (!sp) continue; n++; c.globalAlpha = 0.9; bar(sp[0], sp[1], o.hp / o.max, '#FFC857'); c.globalAlpha = 1; }
    for (const d of this.dmgNums) { const sp = this.toScreen(d.x, d.y + d.t * 1.6, d.z); if (!sp) continue; c.globalAlpha = Math.max(0, 1 - d.t); tk3T(c, String(d.v), sp[0], sp[1], (14 + 6 * (1 - d.t)) * s, d.c); c.globalAlpha = 1; }
  }
  // 왼쪽 위: 레벨 · 체력 · XP / 가운데(가로) 또는 그 아래(세로): 남은 시간 · 팀 점수
  drawTop(c, L) {
    const s = L.s, P = L.panel, r = P.h / 2;
    c.fillStyle = 'rgba(14,18,34,0.62)'; tk3RR(c, P.x, P.y, P.w, P.h, 12); c.fill();
    const cx = P.x + r + 2, cy = P.y + r; c.fillStyle = '#FFD166'; c.beginPath(); c.arc(cx, cy, r - 5, 0, Math.PI * 2); c.fill();
    tk3T(c, String(this.lv), cx, cy + 4 * s, 16 * s, '#2A1E00', 'center', false, 900); tk3T(c, 'Lv', cx, cy - 8 * s, 7.5 * s, '#5A4300', 'center', false, 800);
    const x0 = cx + r, w = P.w - (x0 - P.x) - 10, hpK = this.alive ? this.hp / this.maxHpOf() : 0, xpK = this.lv >= TK_LV_MAX ? 1 : this.lx / tkNeed(this.lv);
    tk3TF(c, this.T.name + (this.skTier ? ' ' + '★'.repeat(this.skTier) : '') + (this.pts > 0 ? '  +' + this.pts : ''), x0, P.y + 10 * s, 12 * s, w, '#FFFFFF', 'left', false, 800);
    const hy = P.y + 18 * s, hh = 11 * s; c.fillStyle = 'rgba(0,0,0,0.45)'; tk3RR(c, x0, hy, w, hh, 4); c.fill();
    c.fillStyle = hpK > 0.5 ? '#5EE07A' : hpK > 0.25 ? '#FFC857' : '#FF5A6E'; tk3RR(c, x0, hy, w * Math.max(0, Math.min(1, hpK)), hh, 4); c.fill();
    tk3T(c, this.alive ? Math.max(0, Math.round(this.hp)) + ' / ' + this.maxHpOf() : '—', x0 + w / 2, hy + hh / 2 + 0.5, 9 * s, '#FFFFFF', 'center', 'rgba(0,0,0,0.6)', 800);
    const xy = hy + hh + 4 * s, xh = 6 * s; c.fillStyle = 'rgba(0,0,0,0.45)'; tk3RR(c, x0, xy, w, xh, 3); c.fill(); c.fillStyle = '#62D8FF'; tk3RR(c, x0, xy, w * Math.max(0, Math.min(1, xpK)), xh, 3); c.fill();
    // 남은 시간 · 팀 점수 (개인전은 내 순위)
    const left = this.started ? this.matchLeft : Math.max(0, this.startAt - this.srv());
    let txt = (this.started ? '' : '출발 ') + tk3Clock(left), sub = '';
    if (!this.ffa) { const ts = this.teamScores(); sub = '레드 ' + ts.r + ' : ' + ts.b + ' 블루'; }
    else { const st = this.standings(), rk = st.findIndex(q => q.me) + 1; sub = '내 순위 ' + rk + '/' + st.length; }
    const K = L.clock, fs = 15 * s, tw = (c.font = '900 ' + Math.round(fs) + 'px ' + TK_FONT, c.measureText(txt).width), fs2 = 11 * s;
    c.font = '800 ' + Math.round(fs2) + 'px ' + TK_FONT; const sw = c.measureText(sub).width, bw = tw + sw + 30 * s, bx = K.align === 'left' ? K.x : K.x - bw / 2, bh2 = 26 * s;
    c.fillStyle = 'rgba(14,18,34,0.62)'; tk3RR(c, bx, K.y, bw, bh2, bh2 / 2); c.fill();
    tk3T(c, txt, bx + 10 * s + tw / 2, K.y + bh2 / 2 + 1, fs, left < 30000 && this.started ? '#FF8A8A' : '#FFFFFF', 'center', false, 900);
    if (!this.ffa) { const ts = this.teamScores(), x1 = bx + 20 * s + tw, a = '레드 ' + ts.r, b2 = ' : ', cc = ts.b + ' 블루';
      c.font = '800 ' + Math.round(fs2) + 'px ' + TK_FONT; const wa = c.measureText(a).width, wb = c.measureText(b2).width;
      tk3T(c, a, x1, K.y + bh2 / 2 + 1, fs2, this.team === 'r' ? '#FF9AA6' : '#FF7A8A', 'left', false, this.team === 'r' ? 900 : 700);
      tk3T(c, b2, x1 + wa, K.y + bh2 / 2 + 1, fs2, '#FFFFFF', 'left', false, 700);
      tk3T(c, cc, x1 + wa + wb, K.y + bh2 / 2 + 1, fs2, this.team === 'b' ? '#9ED2FF' : '#7DBBFF', 'left', false, this.team === 'b' ? 900 : 700); }
    else tk3T(c, sub, bx + 20 * s + tw, K.y + bh2 / 2 + 1, fs2, '#FFE7A0', 'left', false, 800);
  }
  // 오른쪽 위 미니맵: 지형 + 우리 팀 · 가까운 적(45m 안) · 나
  drawMinimap(c, L) {
    const R = L.mm, k = R.w / this.L; if (!this.mmCanvas) return;
    c.save(); c.fillStyle = 'rgba(14,18,34,0.7)'; tk3RR(c, R.x - 3, R.y - 3, R.w + 6, R.h + 6, 9); c.fill(); tk3RR(c, R.x, R.y, R.w, R.h, 7); c.clip();
    c.globalAlpha = 0.92; c.drawImage(this.mmCanvas, R.x, R.y, R.w, R.h); c.globalAlpha = 1;
    // 화면에 보이는 범위
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1; const vw = (this.vw / this.vh < 1 ? 28 : 30 * this.vw / this.vh) * 0.5, vh = vw * this.vh / this.vw * 1.3;
    c.strokeRect(R.x + (this.camT.x - vw) * k, R.y + (this.camT.z - vh * 0.75) * k, vw * 2 * k, vh * 2 * k);
    const dot = (x, z, col, r) => { c.fillStyle = col; c.beginPath(); c.arc(R.x + x * k, R.y + z * k, r, 0, Math.PI * 2); c.fill(); };
    for (const id in this.peers) { const p = this.peers[id]; if (p.dead || p.tx == null) continue; const ally = !this.ffa && this.team && p.team === this.team;
      if (!ally && (Math.hypot(p.x - this.x, p.z - this.z) > 45 || p._vis === false)) continue; dot(p.x, p.z, !this.ffa && p.team === 'b' ? '#56B8FF' : '#FF4D5E', ally ? 2.4 : 3); }
    if (this.alive) { const x = R.x + this.x * k, y = R.y + this.z * k, a = this.h; c.fillStyle = '#FFD166'; c.strokeStyle = '#1B1B2F'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6); c.lineTo(x + Math.cos(a + 2.4) * 4.5, y + Math.sin(a + 2.4) * 4.5); c.lineTo(x + Math.cos(a - 2.4) * 4.5, y + Math.sin(a - 2.4) * 4.5); c.closePath(); c.fill(); c.stroke(); }
    c.restore();
    tk3T(c, 'N', R.x + R.w / 2, R.y + 7, 9 * L.s, '#FFFFFF', 'center', null, 900);
  }
  drawFeed(c, L) {
    const s = L.s; let y = L.feed.y + 8 * s;
    for (const f of this.feed) { const a = Math.max(0, Math.min(1, (f.t - this.now) / 600)); c.globalAlpha = a;
      const txt = f.a + ' ▶ ' + f.b, fs = 11 * s; c.font = '800 ' + Math.round(fs) + 'px ' + TK_FONT; const w = Math.min(c.measureText(txt).width, L.W * 0.5) + 14 * s;
      c.fillStyle = f.me ? 'rgba(120,90,10,0.75)' : f.mv ? 'rgba(120,20,30,0.75)' : 'rgba(14,18,34,0.6)'; tk3RR(c, L.feed.x - w, y - 9 * s, w, 18 * s, 6); c.fill();
      tk3TF(c, txt, L.feed.x - 7 * s, y, fs, w - 14 * s, f.me ? '#FFE08A' : f.mv ? '#FFB3BC' : '#FFFFFF', 'right', false, 800); y += 21 * s; c.globalAlpha = 1; }
  }
  drawToasts(c, L) {
    const s = L.s; let y = L.H * (L.port ? 0.58 : 0.64);                    // 전차(화면 가운데) 조금 아래 — 위쪽은 HUD · 카드 자리
    for (let i = Math.max(0, this.toasts.length - 3); i < this.toasts.length; i++) { const t = this.toasts[i], a = Math.max(0, Math.min(1, (t.until - this.now) / 400)); c.globalAlpha = a; tk3T(c, t.text, L.W / 2, y, 16 * s, t.color); y += 22 * s; }   // 최근 3개만
    c.globalAlpha = 1;
  }
  // 업그레이드 카드 3장 (화면 위쪽 · 조작 버튼과 겹치지 않게)
  drawCards(c, L) {
    const s = L.s, R = L.cards, n = this.cards.length, gap = 6 * s, w = (R.w - gap * (n - 1)) / n, h = R.h; this.ui.cards.length = 0;
    tk3T(c, '레벨 업! 업그레이드 고르기' + (this.pts > 1 ? ' (' + this.pts + ')' : ''), L.W / 2, R.y - 10 * s, 12 * s, '#FFE08A', 'center', null, 900);
    const pulse = 0.5 + 0.5 * Math.sin(this.now / 220);
    this.cards.forEach((k, i) => { const U = TK_UPS[k], x = R.x + i * (w + gap), y = R.y, lv = this.up[k];
      c.fillStyle = 'rgba(18,24,48,0.86)'; tk3RR(c, x, y, w, h, 10); c.fill(); c.lineWidth = 2; c.strokeStyle = 'rgba(255,209,102,' + (0.45 + 0.4 * pulse) + ')'; c.stroke();
      c.fillStyle = '#FFD166'; tk3RR(c, x + 5, y + 5, 16 * s, 16 * s, 4); c.fill(); tk3T(c, String(i + 1), x + 5 + 8 * s, y + 5 + 8.5 * s, 11 * s, '#2A1E00', 'center', false, 900);
      tk3T(c, U.icon, x + w - 15 * s, y + 15 * s, 16 * s, '#8FE3FF', 'center', false, 900);
      tk3TF(c, U.name, x + w / 2, y + h * 0.38, 15 * s, w - 12, '#FFFFFF', 'center', false, 900);
      tk3TF(c, U.desc, x + w / 2, y + h * 0.6, 10.5 * s, w - 10, '#BFD3FF', 'center', false, 700);
      const pw = Math.min(10 * s, (w - 30) / 5), px = x + w / 2 - (pw * 5 + 3 * 4) / 2; for (let j = 0; j < 5; j++) { c.fillStyle = j < lv ? '#62D8FF' : j === lv ? 'rgba(255,209,102,' + (0.5 + 0.5 * pulse) + ')' : 'rgba(255,255,255,0.18)'; tk3RR(c, px + j * (pw + 3), y + h * 0.8, pw, 5 * s, 2); c.fill(); }
      this.ui.cards.push({ i, x, y, w, h }); });
  }
  // 처음 출격 4초: 짧은 조작 안내
  drawGuide(c, L, t) {
    const s = L.s, a = Math.min(1, (4600 - t) / 600), lines = ['조이스틱: 이동 (화면 위 = 북쪽)', '● 발사: 가까운 적 자동 조준 · 꾹 = 연사', '★ ' + this.T.sk.label + ' · 적 · 상자 · 벙커를 맞히면 XP'];
    if (!this.touchUi) lines.push('PC: WASD 이동 · 마우스 조준 · 클릭 발사 · Space 스킬 · 숫자키 카드');
    const C = L.C, fs = 12.5 * s, lh = 19 * s, h = lines.length * lh + 14 * s;
    // 세로: 조작 버튼 위 · 가로: 아래쪽 조이스틱과 버튼 사이
    const w = L.port ? Math.min(L.W - 24, 380 * s) : Math.min(380 * s, Math.max(240, C.btnLeft - C.joyRight - 16)), x = L.port ? (L.W - w) / 2 : (C.joyRight + C.btnLeft) / 2 - w / 2;
    const y = L.port ? Math.min(L.H * 0.6 - h / 2, Math.min(C.joyTop, C.btnTop) - 10 - h) : L.H - 10 - h;
    c.globalAlpha = a; c.fillStyle = 'rgba(14,18,34,0.72)'; tk3RR(c, x, y, w, h, 12); c.fill();
    lines.forEach((ln, i) => tk3TF(c, ln, x + w / 2, y + 7 * s + lh * (i + 0.5), fs, w - 16, i === 3 ? '#BFD3FF' : '#FFFFFF', 'center', false, 800)); c.globalAlpha = 1;
  }
  // 전차 고르기 카드 6장 (처음 출격 · 다시 태어날 때) — 6초 뒤 지난 전차로 자동
  drawSelect(c, L) {
    const s = L.s, W = L.W, H = L.H, now = this.now; this.ui.types.length = 0;
    c.fillStyle = 'rgba(8,12,26,0.74)'; c.fillRect(0, 0, W, H);
    const left = Math.max(0, (this.sel.until || now + TK_PICK_MS) - now), wait = !this.started;
    const titleY = L.port ? L.clock.y + 50 * s : L.panel.y + L.panel.h + 22 * s;
    tk3T(c, this.deaths ? '격파됐어요! 다시 출격할 전차' : '출격할 전차를 고르세요', W / 2, titleY, 18 * s, '#FFFFFF', 'center', null, 900);
    tk3T(c, Math.ceil(left / 1000) + '초 뒤 자동: ' + TK_TYPES[this.type].name + (!wait && this.respawnAt > now ? ' · ' + Math.ceil((this.respawnAt - now) / 1000) + '초 뒤 출격' : ''), W / 2, titleY + 20 * s, 11 * s, '#FFE08A', 'center', null, 800);
    // 칸 배치: (가) 조작 버튼 양옆을 비움 · (나) 버튼 위까지만 — 카드가 더 큰 쪽
    const cols = L.port ? 2 : 3, rows = 6 / cols, top = titleY + 34 * s, gap = 7 * s, C = L.C, ctlTop = Math.min(C.joyTop, C.btnTop);
    const fit = (l, r, b) => { const cw = Math.min(250 * s, (r - l - gap * (cols - 1)) / cols), ch = Math.min(200 * s, (b - top - gap * (rows - 1)) / rows); return { l, r, cw, ch, k: Math.min(cw, ch * 1.3) }; };
    const A = fit(Math.max(10, C.joyRight + 6), Math.min(W - 10, C.btnLeft - 6), H - 10), B = fit(10, W - 10, Math.min(H - 10, ctlTop - 8)), F = (A.k >= B.k && A.ch >= 90) || B.ch < 90 ? A : B;
    const cw = F.cw, ch = F.ch, x0 = (F.l + F.r) / 2 - (cw * cols + gap * (cols - 1)) / 2;
    const tcol = this.ffa ? '#3D8BF5' : (this.team === 'r' ? '#E5484D' : '#3D8BF5');
    TK_ORDER.forEach((k, i) => { const T = TK_TYPES[k], x = x0 + (i % cols) * (cw + gap), y = top + Math.floor(i / cols) * (ch + gap), cur = k === this.type;
      c.fillStyle = cur ? 'rgba(40,52,96,0.96)' : 'rgba(22,28,54,0.94)'; tk3RR(c, x, y, cw, ch, 12); c.fill();
      c.lineWidth = cur ? 3 : 1.5; c.strokeStyle = cur ? '#FFD166' : 'rgba(255,255,255,0.18)'; c.stroke();
      const p = 8 * s, fs = Math.min(15 * s, ch * 0.12); let ty = y + p + fs * 0.6;
      c.fillStyle = '#FFD166'; tk3RR(c, x + p, y + p - 1, fs * 1.1, fs * 1.1, 4); c.fill(); tk3T(c, String(i + 1), x + p + fs * 0.55, y + p + fs * 0.5, fs * 0.75, '#2A1E00', 'center', false, 900);
      tk3TF(c, T.name, x + p + fs * 1.5, ty, fs, cw * 0.5, '#FFFFFF', 'left', false, 900);
      tk3TF(c, T.role, x + cw - p, ty, fs * 0.72, cw * 0.36, '#9FB3E0', 'right', false, 700);
      this.drawTankIcon(c, k, x + cw - p - ch * 0.25, y + ch * 0.34, ch * 0.2, tcol);
      ty += fs * 1.05;
      // 능력치 막대 (체력 · 속도 · 화력 · 사거리)
      const bars = [['체력', T.hp / 315], ['속도', T.spd / 9.2], ['화력', T.dmg / T.reload / TK3_DPS_MAX], ['사거리', T.range / 36]], bh = Math.max(4, ch * 0.045), bw = cw * 0.34;
      if (ch > 120 * s) bars.forEach(([nm, v], j) => { const by = ty + j * (bh + 4 * s); tk3T(c, nm, x + p, by + bh / 2, fs * 0.62, '#C9D4F2', 'left', false, 700);
        c.fillStyle = 'rgba(255,255,255,0.14)'; tk3RR(c, x + p + fs * 2.4, by, bw, bh, 2); c.fill(); c.fillStyle = '#62D8FF'; tk3RR(c, x + p + fs * 2.4, by, bw * Math.min(1, v), bh, 2); c.fill(); });
      ty += ch > 120 * s ? 4 * (bh + 4 * s) + 4 * s : 2 * s;
      const fl = fs * 0.7, lh = fl * 1.32, mw = cw - p * 2, line = (t, col) => { if (ty + lh * 0.5 > y + ch - 4) return; tk3TF(c, t, x + p, ty + lh * 0.5, fl, mw, col, 'left', false, 700); ty += lh; };
      line('★ ' + T.sk.label + ' · ' + T.pro, '#FFFFFF'); line('약점: ' + T.con, '#FFB3BC'); line('강함 → ' + T.good, '#9EF0B0'); line('약함 ← ' + T.bad, '#FFC27A');
      this.ui.types.push({ k, x, y, w: cw, h: ch }); });
  }
  // 옆에서 본 전차 그림 (카드용)
  drawTankIcon(c, k, cx, cy, sz, col) {
    const S = TK3_SHAPE[k], u = sz / 2.6, hw = S.L * u, hh = S.H * u * 1.3;
    c.save(); c.translate(cx, cy);
    c.fillStyle = '#2A2F3A'; tk3RR(c, -hw / 2, 0, hw, 0.62 * u, 0.3 * u); c.fill();
    c.fillStyle = col; c.fillRect(-hw / 2 * 0.92, -hh, hw * 0.92, hh);
    const tw = (S.round ? S.tw : S.tl) * u, th = S.th * u * 1.3, tx = (S.px + S.tx) * u;
    c.fillRect(tx - tw / 2, -hh - th, tw, th);
    c.strokeStyle = '#5A6070'; c.lineWidth = Math.max(2, S.br * u * 2.2); c.beginPath(); const bx = tx + tw / 2, by = -hh - th * 0.45, a = -(S.pitch || 0); c.moveTo(bx, by); c.lineTo(bx + Math.cos(a) * S.bl * u, by + Math.sin(a) * S.bl * u); c.stroke();
    c.restore();
  }
  drawWait(c, L) {
    const s = L.s, left = Math.max(0, this.respawnAt - this.now);
    if (!this.started) return;
    c.fillStyle = 'rgba(8,12,26,0.35)'; c.fillRect(0, 0, L.W, L.H);
    tk3T(c, '다시 출격까지', L.W / 2, L.H * 0.42, 15 * s, '#FFFFFF'); tk3T(c, String(Math.ceil(left / 1000)), L.W / 2, L.H * 0.42 + 34 * s, 38 * s, '#FFD166', 'center', null, 900);
  }
  drawResult(c, L) {
    const s = L.s, R = this.result, w = Math.min(L.W - 24, 340 * s), h = (150 + Math.min(5, R.top.length) * 20) * s, x = (L.W - w) / 2, y = (L.H - h) / 2;
    c.fillStyle = 'rgba(8,12,26,0.55)'; c.fillRect(0, 0, L.W, L.H); c.fillStyle = 'rgba(22,28,54,0.96)'; tk3RR(c, x, y, w, h, 14); c.fill();
    const head = this.ffa ? (R.rank === 1 ? '1등!' : R.rank + '등 / ' + R.total) : R.tie ? '무승부' : R.win ? '승리!' : '패배';
    tk3T(c, head, L.W / 2, y + 32 * s, 28 * s, R.win ? '#FFD166' : '#FFFFFF', 'center', null, 900);
    if (!this.ffa) tk3T(c, '레드 ' + R.ts.r + ' : ' + R.ts.b + ' 블루', L.W / 2, y + 64 * s, 15 * s, '#FFFFFF');
    else tk3T(c, '점수 ' + this.score + ' · 격파 ' + this.kills + ' · 레벨 ' + this.lv, L.W / 2, y + 64 * s, 13 * s, '#FFFFFF');
    R.top.slice(0, 5).forEach((q, i) => tk3TF(c, (i + 1) + '. ' + q.name + '  ' + q.score + '점 · 격파 ' + q.kills, L.W / 2, y + (98 + i * 20) * s, 12 * s, w - 20, q.me ? '#FFE08A' : (q.team === 'r' ? '#FFB3BC' : q.team === 'b' ? '#BFE3FF' : '#E0E6F5'), 'center', false, 800));
  }
}
if (typeof window !== 'undefined') window.TankGame = TankGame;
