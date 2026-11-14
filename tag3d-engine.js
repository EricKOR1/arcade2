// 좀비 술래잡기 3D — 그림(Three.js r128) · HUD · 소리 · 입력. 규칙 · 통신은 tag-engine.js 의 TagCore
//   · 해 질 녘 밤 학교 마을: 그린 하늘(별 · 달) · 안개 · 달빛 그림자(보통/높은 화질) · 내 손전등(스포트라이트) · 가로등 빛 웅덩이 · 불 켜진 창문
//   · 그리기 호출이 인원과 무관하게: 건물 · 담 · 나무 · 차는 정점 색 한 덩어리, 사람 · 좀비는 부품마다 InstancedMesh (몸 · 머리 · 머리카락 · 팔 · 다리 · 눈 · 손전등 빛)
//   · 높은 화질(PC): 물리 기반 재질 + HDR 환경광(assets/hdr 의 노을 사진 · 어둡게) — 태블릿(보통)은 받지 않음
//   · 2D HUD 는 위에 겹친 캔버스 (역할 · 점수 · 순위 · 남은 시간 · 사람/좀비 수 · 미니맵 · 경고 테두리 · 안내)

const TG3_MAXP = 40;
const TG3_SHIRT = [0x3D8BF5, 0xF08C2E, 0xFFD166, 0xB65CE8, 0x2EC4B6, 0xEF476F, 0x8AC926, 0xFF7AB6, 0x4CC9F0, 0xF4A261];
const TG3_PANTS = [0x2B3A55, 0x3A2E2A, 0x22303A, 0x4A3B5C, 0x1F2933];
const TG3_SKIN = [0xF2C9A0, 0xE0AC80, 0xC68A5E, 0xF6D5B8];
const TG3_HAIR = [0x2A1E16, 0x15110E, 0x5A3A22, 0x3A2A1A];
const TG3_HOUSE = [[0.78, 0.72, 0.62], [0.66, 0.70, 0.74], [0.80, 0.66, 0.52], [0.62, 0.68, 0.58], [0.74, 0.62, 0.62], [0.70, 0.66, 0.78]];
const TG3_ROOF = [[0.45, 0.17, 0.16], [0.18, 0.24, 0.36], [0.18, 0.33, 0.27], [0.36, 0.25, 0.17]];
const TG3_CAR = [[0.78, 0.12, 0.12], [0.15, 0.32, 0.62], [0.86, 0.86, 0.84], [0.16, 0.16, 0.18], [0.92, 0.72, 0.2]];
const TG3_FOG = 0x1B1C38;

function tg3RR(c, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function tg3T(c, s, x, y, size, color, align, stroke, weight) {
  c.font = (weight || 800) + ' ' + Math.round(size) + 'px ' + TG_FONT; c.textAlign = align || 'center'; c.textBaseline = 'middle';
  if (stroke !== false) { c.lineWidth = Math.max(2, size * 0.24); c.strokeStyle = stroke || 'rgba(10,12,28,0.92)'; c.lineJoin = 'round'; c.strokeText(s, x, y); }
  c.fillStyle = color || '#fff'; c.fillText(s, x, y);
}
function tg3TF(c, s, x, y, size, maxW, color, align, stroke, weight) { let z = size; c.font = (weight || 800) + ' ' + Math.round(z) + 'px ' + TG_FONT; const w = c.measureText(s).width; if (w > maxW && w > 0) z = Math.max(8, z * maxW / w); tg3T(c, s, x, y, z, color, align, stroke, weight); }
const tg3Clock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

// 정점 색 기하 만들기 (상자 · 사각형 · 박공지붕) — 수백 개를 한 덩어리로
class TG3Geo {
  constructor(game) { this.g = game; this.p = []; this.n = []; this.c = []; }
  push(x, y, z, nx, ny, nz, c) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.c.push(c[0], c[1], c[2]); }
  quad(a, b, cc, d, col, col2) {           // a→b→c→d 반시계 (바깥에서 볼 때)
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;   // (b−a)×(d−a) = 바깥쪽
    const c2 = col2 || col; [[a, col2 ? c2 : col], [b, col2 ? c2 : col], [cc, col], [a, col2 ? c2 : col], [cc, col], [d, col]].forEach(([v, k]) => this.push(v[0], v[1], v[2], nx, ny, nz, k));
  }
  // 상자 (밑면 없음) — 옆면은 아래쪽을 조금 어둡게 (땅에 닿은 그늘)
  box(x0, y0, z0, x1, y1, z1, col, top, ao) {
    const k = ao == null ? 0.72 : ao, lo = [col[0] * k, col[1] * k, col[2] * k], tp = top || col;
    this.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], tp);                                   // 위
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], col, lo);                              // +z
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], col, lo);                              // -z
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], col, lo);                              // +x
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], col, lo);                              // -x
  }
  // 박공지붕: 용마루가 ax('x' | 'z') 방향
  gable(x0, z0, x1, z1, y0, h, ax, col, end) {
    const o = 0.35; x0 -= o; z0 -= o; x1 += o; z1 += o; const y1 = y0 + h, dk = [col[0] * 0.8, col[1] * 0.8, col[2] * 0.8];
    if (ax === 'x') { const zm = (z0 + z1) / 2;
      this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, zm], [x0, y1, zm], col); this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, zm], [x1, y1, zm], dk);
      this.tri([x0 + o, y0, z0 + o], [x0 + o, y0, z1 - o], [x0 + o, y1, zm], end); this.tri([x1 - o, y0, z1 - o], [x1 - o, y0, z0 + o], [x1 - o, y1, zm], end); }
    else { const xm = (x0 + x1) / 2;
      this.quad([x1, y0, z1], [x1, y0, z0], [xm, y1, z0], [xm, y1, z1], col); this.quad([x0, y0, z0], [x0, y0, z1], [xm, y1, z1], [xm, y1, z0], dk);
      this.tri([x0 + o, y0, z1 - o], [x1 - o, y0, z1 - o], [xm, y1, z1 - o], end); this.tri([x1 - o, y0, z0 + o], [x0 + o, y0, z0 + o], [xm, y1, z0 + o], end); }
  }
  tri(a, b, cc, col) { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = cc[0] - a[0], vy = cc[1] - a[1], vz = cc[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; [a, b, cc].forEach(v => this.push(v[0], v[1], v[2], nx / l, ny / l, nz / l, col)); }
  // 벽면에 붙인 사각형 (창문 · 문): 면 방향 f('n','s','e','w') · 가로 위치 u0..u1 · 높이 v0..v1 · 면 좌표 w
  face(f, w, u0, u1, v0, v1, col) { const e = 0.03;
    if (f === 's') this.quad([u0, v0, w + e], [u1, v0, w + e], [u1, v1, w + e], [u0, v1, w + e], col);
    else if (f === 'n') this.quad([u1, v0, w - e], [u0, v0, w - e], [u0, v1, w - e], [u1, v1, w - e], col);
    else if (f === 'e') this.quad([w + e, v0, u1], [w + e, v0, u0], [w + e, v1, u0], [w + e, v1, u1], col);
    else this.quad([w - e, v0, u0], [w - e, v0, u1], [w - e, v1, u1], [w - e, v1, u0], col); }
  build() { const T = THREE, g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(this.n, 3)); g.setAttribute('color', new T.Float32BufferAttribute(this.c, 3)); g.computeBoundingSphere(); return g; }
}
// THREE 기하 여러 개를 정점 색과 함께 하나로 (r128 에는 BufferGeometryUtils 가 없음)
function tg3Merge(parts) {
  const T = THREE; let n = 0;
  const gs = parts.map(p => { const g0 = p.g, g = g0.index ? g0.toNonIndexed() : g0; if (g !== g0) g0.dispose(); if (p.m) g.applyMatrix4(p.m); n += g.attributes.position.count; return g; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  gs.forEach((g, i) => { const c = parts[i].c, cnt = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    for (let k = 0; k < cnt; k++) { col[(o + k) * 3] = c[0]; col[(o + k) * 3 + 1] = c[1]; col[(o + k) * 3 + 2] = c[2]; } o += cnt; g.dispose(); });
  const out = new T.BufferGeometry(); out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.setAttribute('normal', new T.BufferAttribute(nor, 3)); out.setAttribute('color', new T.BufferAttribute(col, 3)); out.computeBoundingSphere(); return out;
}
function tg3P(g, x, y, z, c, rx, ry, rz) { const m = new THREE.Matrix4(); m.makeRotationFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)); m.setPosition(x, y, z); return { g, m, c }; }

class TagGame extends TagCore {
  constructor(canvas, opts) {
    const host = canvas.parentElement, hud = document.createElement('canvas');
    hud.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2';
    host.appendChild(hud);
    super(opts);
    this.world3d = true; this.glCanvas = canvas; this.host = host; this.hudCanvas = hud; this.ctx = hud.getContext('2d');
    this.vw = host.clientWidth || 800; this.vh = host.clientHeight || 600; this.q = 1; this.drawAt = 0; this.beatAt = 0; this.guideAt = 0;
    this.touchUi = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
    this.parts = []; this.camPitch = 0.92;
    this.initThree(); this.bindInput(); this.resize();
  }
  // ── 입력: Space · Shift = ⚡ 버튼 (사람: 꾹 = 달리기 · 좀비: 톡 = 돌진) ──
  bindInput() {
    this._offs = []; const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); this._offs.push(() => t.removeEventListener(ev, fn, o)); };
    on(window, 'keyup', e => { if (e.code === 'Space' || e.key === ' ' || e.key === 'Shift') this.setBoost(false); });
    on(window, 'blur', () => this.setBoost(false));
  }
  onKey(e) { if (this.gameOver) return false; if (e.code === 'Space' || e.key === ' ' || e.key === 'Shift') { if (e.preventDefault) e.preventDefault(); if (!e.repeat) this.setBoost(true); return true; } return false; }

  tick(ts) {
    if (this._dead) return;
    this.step(ts);
    if (this.started && !this.guideAt && !this.joinWait) this.guideAt = this.now;
    this.heartbeat();
    this.draw();
  }
  // 좀비가 가까우면 심장 소리 (가까울수록 빠르게)
  heartbeat() {
    if (this.role !== 'h' || this.gameOver || this.phase() !== 'hunt' || !(this.nearZ < 12) || typeof window === 'undefined' || !window.Sound || !Sound.note) return;
    const iv = 330 + (this.nearZ / 12) * 820; if (this.now - this.beatAt < iv) return; this.beatAt = this.now;
    try { Sound.note(62, 0.09, 'sine', 0.5); Sound.note(50, 0.11, 'sine', 0.4, 0.14); } catch (e) {}
    if (this.nearZ < 4 && window.Haptic && Haptic.hit && this.now - (this._hapAt || 0) > 900) { this._hapAt = this.now; try { Haptic.hit(); } catch (e) {} }
  }
  setQuality(q) {
    this.q = Math.max(0, Math.min(2, q | 0));
    if (this.renderer) this.renderer.setPixelRatio(Math.min([0.75, 1.0, 1.25][this.q], this.opts.maxDpr || 1.25, window.devicePixelRatio || 1));
    if (this.q === 0 && this.renderer && this.renderer.shadowMap.enabled) { this.renderer.shadowMap.enabled = false; if (this.moon) this.moon.castShadow = false; this.scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); }); }
    this.resize();
  }
  resize() {
    if (this._dead) return;
    const W = this.host.clientWidth || 800, H = this.host.clientHeight || 600; if (W < 10 || H < 10) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.hudCanvas.width = Math.round(W * dpr); this.hudCanvas.height = Math.round(H * dpr); this.hudDpr = dpr; this.vw = W; this.vh = H;
    if (this.renderer) { this.renderer.setSize(W, H, false); this.glCanvas.style.width = '100%'; this.glCanvas.style.height = '100%';
      const cam = this.camera, asp = W / H; cam.aspect = asp; cam.fov = asp < 1 ? 58 : 48;
      const tn = Math.tan(cam.fov * Math.PI / 360); this.camDist = asp < 1 ? Math.min(24, 12.5 / (2 * tn * asp)) : 15 / (2 * tn);   // 짧은 변에 약 12.5~15m
      this.scene.fog.near = this.camDist * 0.85; this.scene.fog.far = this.camDist + 46; cam.far = this.camDist + 320; cam.updateProjectionMatrix(); }
  }
  captureTo(g, w, h) { if (!this.renderer || this._dead) return; this.renderer.render(this.scene, this.camera); g.drawImage(this.glCanvas, 0, 0, w, h); if (this.hudCanvas && this.hudCanvas.width) g.drawImage(this.hudCanvas, 0, 0, w, h); }
  destroy() {
    if (this._dead) return; this._dead = true;
    (this._offs || []).forEach(f => { try { f(); } catch (e) {} }); this._offs = [];
    try { this.freeGL(); } catch (e) {} try { this.renderer.dispose(); } catch (e) {}
    try { if (this.hudCanvas.parentNode) this.hudCanvas.parentNode.removeChild(this.hudCanvas); } catch (e) {}
    this.mmCanvas = null;
  }
  freeGL() {
    if (!this.scene) return; const seen = new Set(), tex = t => { if (t && t.isTexture && !seen.has(t)) { seen.add(t); t.dispose(); } };
    this.scene.traverse(o => { if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
      [].concat(o.material || []).forEach(m => { if (!m || seen.has(m)) return; seen.add(m); Object.keys(m).forEach(k => tex(m[k])); m.dispose(); });
      if (o.isLight && o.shadow && o.shadow.map) { o.shadow.map.dispose(); o.shadow.map = null; } });
    if (this.scene.environment) this.scene.environment.dispose();
  }

  // ══ 장면 ══
  col(r, g, b) { if (g == null) { const c = new THREE.Color(r); r = c.r; g = c.g; b = c.b; } return this.lin ? [Math.pow(r, 2.2), Math.pow(g, 2.2), Math.pow(b, 2.2)] : [r, g, b]; }
  color3(hex) { const c = new THREE.Color(hex); if (this.lin) c.convertSRGBToLinear(); return c; }
  mat(o) { const T = THREE; o = Object.assign({ vertexColors: true }, o || {}); if (this.hq === 'low') return new T.MeshLambertMaterial(o); return new T.MeshStandardMaterial(Object.assign({ roughness: 0.88, metalness: 0.0, envMapIntensity: 0.3 }, o)); }
  initThree() {
    const T = THREE;
    const r = this.renderer = new T.WebGLRenderer({ canvas: this.glCanvas, antialias: (window.devicePixelRatio || 1) < 2, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.opts.maxDpr || 1.25));
    this.hq = 'low'; this.hqLocked = false;
    if (window.ThreeQuality) { const pq = ThreeQuality.pick(r, this.opts); this.hq = pq.q; this.hqLocked = !!pq.locked; }
    this.lin = this.hq !== 'low';
    const sc = this.scene = new T.Scene(); sc.background = new T.Color(TG3_FOG); sc.fog = new T.Fog(TG3_FOG, 16, 60);
    this.camera = new T.PerspectiveCamera(50, 1, 0.5, 400);
    this.hemi = new T.HemisphereLight(0x8A98D8, 0x2C2434, this.hq === 'low' ? 0.85 : 0.6); sc.add(this.hemi);
    const moon = this.moon = this.sun = new T.DirectionalLight(0xB8C8FF, 0.5); moon.position.set(-24, 44, 16); sc.add(moon); sc.add(moon.target);
    this.tmpM = new T.Matrix4(); this.tmpM2 = new T.Matrix4(); this.tmpM3 = new T.Matrix4(); this.tmpQ = new T.Quaternion(); this.tmpS = new T.Vector3(1, 1, 1); this.tmpP = new T.Vector3(); this.tmpV = new T.Vector3(); this.tmpC = new T.Color(); this.tmpE = new T.Euler(); this.vU = new T.Vector3(0, 1, 0);
    this.buildSky(); this.buildGround(); this.buildCity(); this.buildPeople(); this.buildFx();
    // 내 손전등 (사람: 따뜻한 흰빛 · 좀비: 붉은 시야)
    const sp = this.spot = new T.SpotLight(0xFFE2B0, this.hq === 'low' ? 1.6 : 2.4, 26, 0.62, 0.55, 1.3); sp.position.set(this.x, 1.6, this.z); sc.add(sp); sc.add(sp.target);
    this.camT = new T.Vector3(this.x, 0, this.z); this.camSnap = true;
    if (this.hq !== 'low' && window.ThreeQuality) {
      ThreeQuality.apply(this, { half: 24, far: 150, tone: 'aces', exposure: 1.15, sun: 0.55, hemi: 0.5 });
      if (this.hq === 'high') { sp.castShadow = true; sp.shadow.mapSize.set(512, 512); sp.shadow.bias = -0.002; this.loadEnv(); }
    }
    this.moonOff = moon.position.clone();
  }
  // PC 높은 화질: 노을 HDR 사진을 환경광으로 (어둡게 · 물리 재질에 은은한 반사)
  loadEnv() {
    const go = () => { if (this._dead || !THREE.RGBELoader) return;
      new THREE.RGBELoader().setDataType(THREE.UnsignedByteType).load('assets/hdr/venice_sunset_1k.hdr', tex => {
        if (this._dead || !this.renderer) { tex.dispose(); return; }
        try { const pm = new THREE.PMREMGenerator(this.renderer); this.scene.environment = pm.fromEquirectangular(tex).texture; pm.dispose(); } catch (e) {} tex.dispose(); }, undefined, () => {}); };
    if (THREE.RGBELoader) return go();
    const s = document.createElement('script'); s.src = 'lib/RGBELoader.js'; s.onload = go; s.onerror = () => {}; document.head.appendChild(s);
  }
  // 하늘: 높이에 따라 색이 바뀌는 큰 공 (서쪽 지평선에 노을) + 별 + 달
  buildSky() {
    const T = THREE, g = new T.SphereGeometry(300, 24, 14), pos = g.attributes.position, cols = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), h = y / 300, w = Math.max(0, -x / 300) * Math.max(0, 1 - Math.abs(h) * 3.2);
      let c; if (h > 0.35) c = [0.03, 0.04, 0.12]; else if (h > 0.05) { const k = (h - 0.05) / 0.3; c = [0.11 + (0.03 - 0.11) * k, 0.10 + (0.04 - 0.10) * k, 0.26 + (0.12 - 0.26) * k]; } else c = [0.18, 0.13, 0.28];
      c = [c[0] + w * 0.62, c[1] + w * 0.26, c[2] + w * 0.05]; cols[i * 3] = c[0]; cols[i * 3 + 1] = c[1]; cols[i * 3 + 2] = c[2]; }
    g.setAttribute('color', new T.BufferAttribute(cols, 3));
    const sky = this.sky = new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false })); sky.userData.noShadow = true; sky.renderOrder = -10; this.scene.add(sky);
    const n = 260, sp = new Float32Array(n * 3), R = tgRng(99);
    for (let i = 0; i < n; i++) { const a = R() * Math.PI * 2, h = 0.15 + R() * 0.85, rr = Math.sqrt(1 - h * h) * 280; sp[i * 3] = Math.cos(a) * rr; sp[i * 3 + 1] = h * 280; sp[i * 3 + 2] = Math.sin(a) * rr; }
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sp, 3));
    const stars = new T.Points(sg, new T.PointsMaterial({ color: 0xDDE6FF, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85, depthWrite: false })); stars.userData.noShadow = true; sky.add(stars);
    const moon = new T.Mesh(new T.CircleGeometry(9, 24), new T.MeshBasicMaterial({ color: 0xF4F1DE, fog: false })); moon.position.set(-150, 170, -120); moon.lookAt(0, 0, 0); sky.add(moon);
    const glow = new T.Mesh(new T.CircleGeometry(26, 24), new T.MeshBasicMaterial({ map: this.radialTex(), color: 0x8090C0, transparent: true, opacity: 0.55, fog: false, depthWrite: false, blending: T.AdditiveBlending })); glow.position.copy(moon.position).multiplyScalar(0.99); glow.lookAt(0, 0, 0); sky.add(glow);
  }
  radialTex() {
    if (this._rad) return this._rad; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return (this._rad = new THREE.CanvasTexture(c));
  }
  // 바닥: 구역을 캔버스에 그려 한 장 (아스팔트 · 차선 · 운동장 트랙 · 보도블록 · 풀) + 맵 밖 어두운 땅
  buildGround() {
    const T = THREE, W = this.world, L = this.L, S = this.hq === 'low' ? 640 : 1024, k = S / L, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
    const R = tgRng(this.seedInt + 5), speck = (x0, z0, x1, z1, n, cols) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect((x0 + R() * (x1 - x0)) * k, (z0 + R() * (z1 - z0)) * k, 1 + R() * 2, 1 + R() * 2); } };
    for (const zn of W.zones) { const x = zn.x0 * k, y = zn.z0 * k, w = (zn.x1 - zn.x0) * k, h = (zn.z1 - zn.z0) * k, a = (zn.x1 - zn.x0) * (zn.z1 - zn.z0);
      if (zn.k === 'alley') { g.fillStyle = '#3A3B42'; g.fillRect(x, y, w, h); speck(zn.x0, zn.z0, zn.x1, zn.z1, a * 1.2, ['#33343A', '#45464D', '#2E2F35']); }
      else if (zn.k === 'road') { g.fillStyle = '#2C2E35'; g.fillRect(x, y, w, h); speck(zn.x0, zn.z0, zn.x1, zn.z1, a * 0.8, ['#26282E', '#363840']);
        // 차선 (가운데 점선 · 학교 담장 둘레)
        const sc0 = W.school, mx0 = (zn.x0 + sc0.x0) / 2, mz0 = (zn.z0 + sc0.z0) / 2, mx1 = (zn.x1 + sc0.x1) / 2, mz1 = (zn.z1 + sc0.z1) / 2; g.strokeStyle = 'rgba(230,200,90,0.55)'; g.lineWidth = Math.max(1, 0.14 * k); g.setLineDash([1.6 * k, 1.4 * k]);
        g.strokeRect(mx0 * k, mz0 * k, (mx1 - mx0) * k, (mz1 - mz0) * k); g.setLineDash([]);
        g.strokeStyle = 'rgba(200,200,200,0.35)'; g.lineWidth = Math.max(1, 0.1 * k); g.strokeRect(x + 0.3 * k, y + 0.3 * k, w - 0.6 * k, h - 0.6 * k); }
      else if (zn.k === 'yard') { g.fillStyle = '#5E5A55'; g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(40,38,36,0.35)'; g.lineWidth = 1; for (let t = 0; t < w; t += 1.2 * k) { g.beginPath(); g.moveTo(x + t, y); g.lineTo(x + t, y + h); g.stroke(); } for (let t = 0; t < h; t += 1.2 * k) { g.beginPath(); g.moveTo(x, y + t); g.lineTo(x + w, y + t); g.stroke(); } speck(zn.x0, zn.z0, zn.x1, zn.z1, a * 0.5, ['#68645E', '#55524D']); }
      else if (zn.k === 'sand') { g.fillStyle = '#8E7452'; g.fillRect(x, y, w, h); speck(zn.x0, zn.z0, zn.x1, zn.z1, a * 2, ['#9A7F5C', '#836A4A', '#A08560']);
        g.strokeStyle = 'rgba(240,240,230,0.7)'; g.lineWidth = Math.max(1.5, 0.12 * k); const rr = Math.min(w, h) * 0.32; tg3RR(g, x + w * 0.08, y + h * 0.12, w * 0.84, h * 0.76, rr); g.stroke(); tg3RR(g, x + w * 0.13, y + h * 0.22, w * 0.74, h * 0.56, rr * 0.7); g.stroke();
        g.beginPath(); g.moveTo(x + w / 2, y + h * 0.22); g.lineTo(x + w / 2, y + h * 0.78); g.stroke(); g.beginPath(); g.arc(x + w / 2, y + h / 2, Math.min(w, h) * 0.1, 0, Math.PI * 2); g.stroke(); }
      else if (zn.k === 'grass') { g.fillStyle = '#2E4A2C'; g.fillRect(x, y, w, h); speck(zn.x0, zn.z0, zn.x1, zn.z1, a * 3, ['#375834', '#284026', '#3F6239']); } }
    // 건물 · 담 아래 그늘 (부드러운 테두리)
    g.fillStyle = 'rgba(0,0,0,0.28)'; for (const b of W.boxes) if (b.y0 < 2 && b.h > 1) g.fillRect((b.x0 - 0.35) * k, (b.z0 - 0.35) * k, (b.x1 - b.x0 + 0.7) * k, (b.z1 - b.z0 + 0.7) * k);
    const tex = this.groundTex = new T.CanvasTexture(c); if (this.lin) tex.encoding = T.sRGBEncoding; tex.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    const seg = this.hq === 'low' ? 40 : 1, pg = new T.PlaneGeometry(L, L, seg, seg); pg.rotateX(-Math.PI / 2);
    const gm = this.hq === 'low' ? new T.MeshLambertMaterial({ map: tex }) : new T.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0, envMapIntensity: 0.2 });
    const ground = new T.Mesh(pg, gm); ground.position.set(L / 2, 0, L / 2); ground.userData.flat = true; this.scene.add(ground);
    const og = new T.PlaneGeometry(L + 500, L + 500); og.rotateX(-Math.PI / 2); const out = new T.Mesh(og, new T.MeshLambertMaterial({ color: 0x15161D })); out.position.set(L / 2, -0.03, L / 2); out.userData.flat = true; this.scene.add(out);
    // 미니맵 바탕 (한 번만)
    const MM = 160, mc = this.mmCanvas = document.createElement('canvas'); mc.width = mc.height = MM; const mg = mc.getContext('2d'); mg.drawImage(c, 0, 0, MM, MM);
    mg.fillStyle = 'rgba(8,10,24,0.35)'; mg.fillRect(0, 0, MM, MM);
    const mk = MM / L; W.boxes.forEach(b => { if (b.y0 > 2) return; mg.fillStyle = b.k === 'school' || b.k === 'gym' ? '#8FA0C8' : b.k === 'house' ? '#7C7F96' : b.k === 'car' ? '#5A5E70' : b.h >= 1 ? '#9A9AA6' : '#55606A'; mg.fillRect(b.x0 * mk, b.z0 * mk, Math.max(1, (b.x1 - b.x0) * mk), Math.max(1, (b.z1 - b.z0) * mk)); });
    W.trees.forEach(t => { mg.fillStyle = '#2E6B3A'; mg.beginPath(); mg.arc(t.x * mk, t.z * mk, 1.6, 0, 7); mg.fill(); });
  }
  // 건물 · 담 · 차 · 상자 · 나무 · 가로등 · 창문
  buildCity() {
    const T = THREE, W = this.world, c = (r, g, b) => this.col(r, g, b), G = new TG3Geo(this), Gl = new TG3Geo(this), R = tgRng(this.seedInt * 7 + 3);
    const dark = c(0.09, 0.1, 0.15), frame = c(0.28, 0.27, 0.26);
    const winLit = [c(1.0, 0.82, 0.5), c(1.0, 0.9, 0.66), c(0.62, 0.8, 1.0), c(1.0, 0.72, 0.42)];
    // 면 하나에 창문 줄 (층 · 간격)
    const windows = (b, f, floors, fh, wy, spacing, ww, wh, litP, skip) => {
      const along = f === 'n' || f === 's', u0 = along ? b.x0 : b.z0, u1 = along ? b.x1 : b.z1, wpos = f === 's' ? b.z1 : f === 'n' ? b.z0 : f === 'e' ? b.x1 : b.x0, len = u1 - u0, n = Math.max(1, Math.floor((len - 0.8) / spacing)), st = u0 + (len - n * spacing) / 2 + spacing / 2;
      for (let fl = 0; fl < floors; fl++) for (let i = 0; i < n; i++) { const u = st + i * spacing; if (skip && skip(u, fl)) continue; const v0 = fl * fh + wy, lit = R() < litP;
        G.face(f, wpos, u - ww / 2 - 0.08, u + ww / 2 + 0.08, v0 - 0.08, v0 + wh + 0.08, frame);
        if (lit) Gl.face(f, wpos + (f === 's' || f === 'e' ? 0.01 : -0.01), u - ww / 2, u + ww / 2, v0, v0 + wh, winLit[Math.floor(R() * winLit.length)]);
        else G.face(f, wpos + (f === 's' || f === 'e' ? 0.01 : -0.01), u - ww / 2, u + ww / 2, v0, v0 + wh, dark); } };
    const door = (b, f, u, w, h, col) => { const along = f === 'n' || f === 's', wpos = f === 's' ? b.z1 : f === 'n' ? b.z0 : f === 'e' ? b.x1 : b.x0; G.face(f, wpos, u - w / 2, u + w / 2, 0, h, col); };
    for (const b of W.boxes) {
      const k = b.k, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
      if (k === 'school') {
        const wall = c(0.86, 0.82, 0.74), base = c(0.5, 0.42, 0.36), top = c(0.42, 0.44, 0.48);
        if (b.bridge) { G.box(b.x0, b.y0, b.z0, b.x1, b.h, b.z1, wall, top, 1); G.quad([b.x0, b.y0, b.z1], [b.x0, b.y0, b.z0], [b.x1, b.y0, b.z0], [b.x1, b.y0, b.z1], c(0.3, 0.3, 0.32));
          windows(b, 's', 2, 3.2, 3.2 + 1.0, 2.4, 1.5, 1.3, 0.6); windows(b, 'n', 2, 3.2, 3.2 + 1.0, 2.4, 1.5, 1.3, 0.4);
          Gl.quad([b.x0 + 0.3, b.y0 - 0.02, b.z0 + 0.5], [b.x1 - 0.3, b.y0 - 0.02, b.z0 + 0.5], [b.x1 - 0.3, b.y0 - 0.02, b.z1 - 0.5], [b.x0 + 0.3, b.y0 - 0.02, b.z1 - 0.5], c(0.75, 0.7, 0.55)); continue; }
        G.box(b.x0, 0, b.z0, b.x1, 0.9, b.z1, base, base, 0.85); G.box(b.x0 + 0.02, 0.9, b.z0 + 0.02, b.x1 - 0.02, b.h, b.z1 - 0.02, wall, top, 0.9);
        G.box(b.x0 - 0.1, b.h, b.z0 - 0.1, b.x1 + 0.1, b.h + 0.5, b.z0 + 0.25, c(0.7, 0.68, 0.64)); G.box(b.x0 - 0.1, b.h, b.z1 - 0.25, b.x1 + 0.1, b.h + 0.5, b.z1 + 0.1, c(0.7, 0.68, 0.64));
        for (let fl = 1; fl < (b.floors || 3); fl++) G.box(b.x0 - 0.06, fl * 3.2 - 0.12, b.z1 - 0.01, b.x1 + 0.06, fl * 3.2 + 0.08, b.z1 + 0.12, c(0.7, 0.66, 0.6));   // 층 띠
        windows(b, 's', b.floors || 3, 3.2, 1.0, 2.4, 1.5, 1.4, 0.62); windows(b, 'n', b.floors || 3, 3.2, 1.0, 2.6, 1.3, 1.3, 0.35);
        windows(b, 'e', b.floors || 3, 3.2, 1.0, 2.6, 1.2, 1.3, 0.4); windows(b, 'w', b.floors || 3, 3.2, 1.0, 2.6, 1.2, 1.3, 0.4);
        continue; }
      if (k === 'gym') { const wall = c(0.62, 0.66, 0.74), top = c(0.32, 0.36, 0.44);
        G.box(b.x0, 0, b.z0, b.x1, b.h, b.z1, wall, top, 0.8); G.gable(b.x0, b.z0, b.x1, b.z1, b.h, 1.6, (b.x1 - b.x0) > (b.z1 - b.z0) ? 'x' : 'z', c(0.3, 0.42, 0.55), wall);
        windows(b, 'e', 1, 3.2, 4.0, 2.2, 1.6, 1.6, 0.7); windows(b, 'w', 1, 3.2, 4.0, 2.2, 1.6, 1.6, 0.5); door(b, 'e', cz, 2.2, 2.6, c(0.2, 0.22, 0.3)); continue; }
      if (k === 'house') {
        const hc = TG3_HOUSE[b.col || 0], wall = c(hc[0], hc[1], hc[2]), rc = TG3_ROOF[b.roof || 0], fl = b.floors || 1, fh = b.h / fl;
        G.box(b.x0, 0, b.z0, b.x1, b.h, b.z1, wall, wall, 0.78);
        G.gable(b.x0, b.z0, b.x1, b.z1, b.h, 1.5, b.ridge === 'x' ? 'x' : 'z', c(rc[0], rc[1], rc[2]), wall);
        const f = b.face || 's', along = f === 'n' || f === 's', mid = along ? cx : cz, dw = 1.1;
        windows(b, f, fl, fh, 1.0, 2.2, 1.0, 1.1, 0.6, (u, flr) => flr === 0 && Math.abs(u - mid) < 1.4);
        door(b, f, mid, dw, 2.1, c(0.32, 0.2, 0.14));
        Gl.face(f, (f === 's' ? b.z1 : f === 'n' ? b.z0 : f === 'e' ? b.x1 : b.x0) + (f === 's' || f === 'e' ? 0.02 : -0.02), mid - 0.15, mid + 0.15, 2.25, 2.5, c(1, 0.85, 0.55));   // 현관등
        const back = { s: 'n', n: 's', e: 'w', w: 'e' }[f]; windows(b, back, fl, fh, 1.1, 2.6, 0.9, 1.0, 0.45);
        continue; }
      if (k === 'wall' || k === 'edge') { const col = k === 'edge' ? c(0.42, 0.25, 0.2) : c(0.6, 0.6, 0.58), cap = k === 'edge' ? c(0.52, 0.34, 0.28) : c(0.75, 0.75, 0.72);
        G.box(b.x0, 0, b.z0, b.x1, b.h - 0.12, b.z1, col, col, 0.75); G.box(b.x0 - 0.05, b.h - 0.12, b.z0 - 0.05, b.x1 + 0.05, b.h, b.z1 + 0.05, cap, cap, 0.9);
        if (k === 'wall') { const along = b.dir === 'x', a0 = along ? b.x0 : b.z0, a1 = along ? b.x1 : b.z1; for (let a = a0 + 2.5; a < a1 - 0.5; a += 3) { if (along) G.box(a - 0.18, 0, b.z0 - 0.06, a + 0.18, b.h + 0.08, b.z1 + 0.06, c(0.68, 0.68, 0.66)); else G.box(b.x0 - 0.06, 0, a - 0.18, b.x1 + 0.06, b.h + 0.08, a + 0.18, c(0.68, 0.68, 0.66)); } }
        continue; }
      if (k === 'car') { const cc = TG3_CAR[b.col || 0], body = c(cc[0], cc[1], cc[2]), ax = b.dir === 'x', glass = c(0.12, 0.16, 0.22);
        G.box(b.x0, 0.32, b.z0, b.x1, 0.95, b.z1, body, body, 0.75);
        const ix = ax ? 0.9 : 0.12, iz = ax ? 0.12 : 0.9; G.box(b.x0 + ix, 0.95, b.z0 + iz, b.x1 - ix, 1.5, b.z1 - iz, glass, body, 1);
        [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([u, v]) => { const x = ax ? (u ? b.x1 - 0.8 : b.x0 + 0.8) : (u ? b.x1 - 0.05 : b.x0 + 0.05), z = ax ? (v ? b.z1 - 0.05 : b.z0 + 0.05) : (v ? b.z1 - 0.8 : b.z0 + 0.8);
          G.box(x - (ax ? 0.34 : 0.12), 0, z - (ax ? 0.12 : 0.34), x + (ax ? 0.34 : 0.12), 0.62, z + (ax ? 0.12 : 0.34), c(0.06, 0.06, 0.07)); });
        if (ax) { Gl.face('e', b.x1, b.z0 + 0.2, b.z0 + 0.5, 0.6, 0.8, c(1, 0.95, 0.75)); Gl.face('e', b.x1, b.z1 - 0.5, b.z1 - 0.2, 0.6, 0.8, c(1, 0.95, 0.75)); Gl.face('w', b.x0, b.z0 + 0.2, b.z0 + 0.5, 0.6, 0.8, c(0.9, 0.1, 0.1)); Gl.face('w', b.x0, b.z1 - 0.5, b.z1 - 0.2, 0.6, 0.8, c(0.9, 0.1, 0.1)); }
        else { Gl.face('s', b.z1, b.x0 + 0.2, b.x0 + 0.5, 0.6, 0.8, c(1, 0.95, 0.75)); Gl.face('s', b.z1, b.x1 - 0.5, b.x1 - 0.2, 0.6, 0.8, c(1, 0.95, 0.75)); Gl.face('n', b.z0, b.x0 + 0.2, b.x0 + 0.5, 0.6, 0.8, c(0.9, 0.1, 0.1)); Gl.face('n', b.z0, b.x1 - 0.5, b.x1 - 0.2, 0.6, 0.8, c(0.9, 0.1, 0.1)); }
        continue; }
      if (k === 'crate') { const wd = c(0.55, 0.36, 0.2), tr = c(0.4, 0.25, 0.13); G.box(b.x0, 0, b.z0, b.x1, b.h, b.z1, wd, c(0.6, 0.42, 0.25), 0.8);
        G.box(b.x0 - 0.02, b.h * 0.45, b.z0 - 0.02, b.x1 + 0.02, b.h * 0.55, b.z1 + 0.02, tr); continue; }
      if (k === 'bed') { G.box(b.x0, 0, b.z0, b.x1, b.h, b.z1, c(0.55, 0.52, 0.48), c(0.2, 0.36, 0.18)); for (let x = b.x0 + 0.4; x < b.x1 - 0.2; x += 0.9) G.box(x - 0.12, b.h, (b.z0 + b.z1) / 2 - 0.12, x + 0.12, b.h + 0.22, (b.z0 + b.z1) / 2 + 0.12, [c(0.9, 0.3, 0.4), c(0.95, 0.8, 0.3), c(0.7, 0.5, 0.9)][Math.floor(R() * 3)]); continue; }
      if (k === 'stage') { G.box(b.x0, 0, b.z0, b.x1, b.h, b.z1, c(0.62, 0.6, 0.56)); G.box(b.x0 + 0.6, 0, b.z1, b.x1 - 0.6, b.h * 0.5, b.z1 + 0.5, c(0.66, 0.64, 0.6)); continue; }
      if (k === 'jungle') { const bars = [c(0.9, 0.3, 0.25), c(0.25, 0.6, 0.9), c(0.95, 0.8, 0.2)]; let i = 0;
        for (let x = b.x0; x <= b.x1 + 0.01; x += (b.x1 - b.x0) / 3) for (let z = b.z0; z <= b.z1 + 0.01; z += (b.z1 - b.z0) / 2) G.box(x - 0.06, 0, z - 0.06, x + 0.06, b.h, z + 0.06, bars[(i++) % 3]);
        for (let y = 0.7; y < b.h; y += 0.75) { G.box(b.x0, y, b.z0 - 0.05, b.x1, y + 0.08, b.z0 + 0.05, bars[1]); G.box(b.x0, y, b.z1 - 0.05, b.x1, y + 0.08, b.z1 + 0.05, bars[1]); G.box(b.x0 - 0.05, y, b.z0, b.x0 + 0.05, y + 0.08, b.z1, bars[2]); G.box(b.x1 - 0.05, y, b.z0, b.x1 + 0.05, y + 0.08, b.z1, bars[2]); }
        continue; }
    }
    // 축구 골대 (흰 틀)
    for (const gl of W.goals) { const w = c(0.92, 0.92, 0.9), x = gl.x, z = gl.z, d = gl.dir * 1.2;
      G.box(x - 0.06, 0, z - 1.8, x + 0.06, 2.1, z - 1.68, w); G.box(x - 0.06, 0, z + 1.68, x + 0.06, 2.1, z + 1.8, w); G.box(x - 0.06, 2.0, z - 1.8, x + 0.06, 2.12, z + 1.8, w);
      G.box(Math.min(x, x - d) - 0.04, 0, z - 1.8, Math.max(x, x - d) + 0.04, 0.08, z - 1.7, w); G.box(Math.min(x, x - d) - 0.04, 0, z + 1.7, Math.max(x, x - d) + 0.04, 0.08, z + 1.8, w); }
    // 학교 이름판 (본관 남쪽 벽 가운데 위)
    const sm = W.schoolMain;
    const cityMat = this.cityMat = this.mat(); const city = new T.Mesh(G.build(), cityMat); this.scene.add(city);
    const glow = new T.Mesh(Gl.build(), new T.MeshBasicMaterial({ vertexColors: true })); glow.userData.noShadow = true; this.scene.add(glow);
    { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const g = cv.getContext('2d'); g.fillStyle = '#1E3A5F'; g.fillRect(0, 0, 512, 96); g.strokeStyle = '#E8D9A8'; g.lineWidth = 6; g.strokeRect(6, 6, 500, 84);
      g.fillStyle = '#F6EFD8'; g.font = '900 56px ' + TG_FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('달빛초등학교', 256, 52);
      const tx = new T.CanvasTexture(cv); if (this.lin) tx.encoding = T.sRGBEncoding; const pl = new T.Mesh(new T.PlaneGeometry(6, 1.1), new T.MeshBasicMaterial({ map: tx }));
      pl.position.set(sm.pass < (sm.x0 + sm.x1) / 2 ? (sm.pass + sm.x1) / 2 : (sm.x0 + sm.pass) / 2, 9.9, sm.z1 + 0.05); pl.userData.noShadow = true; this.scene.add(pl); }
    // 나무 · 가로등 (THREE 기하를 합침)
    const tp = [], lp = [], gp = [];
    for (const t of W.trees) { const s = t.h / 5, j = tgHash(Math.round(t.x * 10), Math.round(t.z * 10), 5);
      tp.push(tg3P(new T.CylinderGeometry(0.16 * s, 0.24 * s, 2.0 * s, 6), t.x, 1.0 * s, t.z, c(0.3, 0.21, 0.14)));
      tp.push(tg3P(new T.IcosahedronGeometry(1.45 * s, 1), t.x, 2.7 * s, t.z, c(0.13 + 0.05 * j, 0.27 + 0.06 * j, 0.16)));
      tp.push(tg3P(new T.IcosahedronGeometry(1.0 * s, 1), t.x + 0.4 * s, 3.6 * s, t.z + 0.25 * s, c(0.17 + 0.04 * j, 0.33, 0.2))); }
    for (const l of W.lamps) { lp.push(tg3P(new T.CylinderGeometry(0.07, 0.1, 4.2, 6), l.x, 2.1, l.z, c(0.22, 0.23, 0.26)), tg3P(new T.BoxGeometry(0.8, 0.08, 0.1), l.x + 0.35, 4.15, l.z, c(0.22, 0.23, 0.26)), tg3P(new T.BoxGeometry(0.42, 0.16, 0.26), l.x + 0.7, 4.08, l.z, c(0.2, 0.2, 0.22)));
      gp.push(tg3P(new T.BoxGeometry(0.34, 0.05, 0.2), l.x + 0.7, 3.98, l.z, c(1, 0.9, 0.6))); }
    if (tp.length) this.scene.add(new T.Mesh(tg3Merge(tp), cityMat));
    if (lp.length) { this.scene.add(new T.Mesh(tg3Merge(lp), cityMat)); const bulbs = new T.Mesh(tg3Merge(gp), new T.MeshBasicMaterial({ vertexColors: true })); bulbs.userData.noShadow = true; this.scene.add(bulbs); }
    // 가로등 빛 웅덩이 (더하기 섞기 · 한 덩어리) + 전구 둘레 빛
    const pools = [], halos = [], rt = this.radialTex();
    for (const l of W.lamps) { const pg = new T.PlaneGeometry(9, 9); pg.rotateX(-Math.PI / 2); pools.push(tg3P(pg, l.x + 0.7, 0.03, l.z, [1, 1, 1])); const hg = new T.PlaneGeometry(1.6, 1.6); halos.push({ x: l.x + 0.7, y: 3.95, z: l.z, g: hg }); }
    if (pools.length) { const g = tg3Merge(pools), uv = new Float32Array(g.attributes.position.count * 2); for (let i = 0; i < g.attributes.position.count / 6; i++) [[0, 1], [0, 0], [1, 1], [0, 0], [1, 0], [1, 1]].forEach((v, k) => { uv[(i * 6 + k) * 2] = v[0]; uv[(i * 6 + k) * 2 + 1] = v[1]; });
      g.setAttribute('uv', new T.BufferAttribute(uv, 2));
      const pm = new T.Mesh(g, new T.MeshBasicMaterial({ map: rt, color: 0xFFC77A, transparent: true, opacity: 0.42, depthWrite: false, blending: T.AdditiveBlending })); pm.userData.noShadow = true; pm.renderOrder = 1; this.scene.add(pm); }
    this.halo = halos.length ? new T.InstancedMesh(new T.PlaneGeometry(1.8, 1.8), new T.MeshBasicMaterial({ map: rt, color: 0xFFD9A0, transparent: true, opacity: 0.8, depthWrite: false, blending: T.AdditiveBlending }), halos.length) : null;
    if (this.halo) { this.haloPos = halos; halos.forEach(h => h.g.dispose()); this.halo.userData.noShadow = true; this.halo.renderOrder = 2; this.scene.add(this.halo); }
  }
  // 사람 · 좀비: 부품마다 인스턴스 (색 = 인스턴스 색 · 좀비는 초록 피부 · 붉은 눈 · 앞으로 뻗은 팔)
  buildPeople() {
    const T = THREE, sc = this.scene, P = TG3_MAXP;
    const mk = (geo, n, mat, shadow) => { const m = new T.InstancedMesh(geo, mat, n); this.tmpC.setRGB(1, 1, 1); for (let i = 0; i < n; i++) m.setColorAt(i, this.tmpC); m.count = 0; m.frustumCulled = false; m.instanceMatrix.setUsage(T.DynamicDrawUsage); if (!shadow) m.userData.noShadow = true; sc.add(m); return m; };
    const pm = this.peopleMat = this.mat({ vertexColors: false, roughness: 0.75 }), wm = new T.MeshBasicMaterial({ color: 0xFFFFFF });
    const torso = new T.BoxGeometry(0.5, 0.6, 0.3); torso.translate(0, 0.3, 0);
    const head = new T.SphereGeometry(0.22, 12, 9), hair = new T.SphereGeometry(0.235, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.52); hair.rotateX(-0.25);
    const leg = new T.BoxGeometry(0.17, 0.72, 0.2); leg.translate(0, -0.36, 0); const arm = new T.BoxGeometry(0.13, 0.62, 0.14); arm.translate(0, -0.31, 0);
    const eyes = tg3Merge([tg3P(new T.SphereGeometry(0.045, 6, 4), -0.08, 0.03, 0.19, [1, 1, 1]), tg3P(new T.SphereGeometry(0.045, 6, 4), 0.08, 0.03, 0.19, [1, 1, 1])]);
    const lamp = new T.BoxGeometry(0.1, 0.1, 0.22);
    this.pp = { torso: mk(torso, P, pm, true), head: mk(head, P, pm, true), hair: mk(hair, P, pm, true), leg: mk(leg, P * 2, pm, true), arm: mk(arm, P * 2, pm, true), eyes: mk(eyes, P, new T.MeshBasicMaterial({ color: 0xFFFFFF })), lamp: mk(lamp, P, wm) };
    // 투명 망토 쓴 사람: 반투명 유령 (몸 · 머리 · 다리 · 팔)
    const gm = new T.MeshBasicMaterial({ color: 0xC8B8FF, transparent: true, opacity: 0.22, depthWrite: false });
    this.pg = { torso: mk(torso, 12, gm), head: mk(head, 12, gm), leg: mk(leg, 24, gm), arm: mk(arm, 24, gm) };
    // 손전등 빛 (원뿔 · 더하기) · 발밑 고리 · 얼음 상자 · 방패 공
    const cone = new T.ConeGeometry(1.2, 5.0, 16, 1, true); cone.translate(0, -2.5, 0); cone.rotateX(-Math.PI / 2 - 0.3); { const p = cone.attributes.position, cc = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const k = Math.max(0, Math.min(1, 1 - Math.hypot(p.getX(i), p.getY(i), p.getZ(i)) / 5.1)); cc[i * 3] = cc[i * 3 + 1] = cc[i * 3 + 2] = k * k * 0.8; } cone.setAttribute('color', new T.BufferAttribute(cc, 3)); }
    this.cone = mk(cone, P, new T.MeshBasicMaterial({ vertexColors: true, color: 0xFFE2A8, transparent: true, opacity: 0.22, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide })); this.cone.renderOrder = 3;
    const pool = new T.PlaneGeometry(1, 1); pool.rotateX(-Math.PI / 2);
    this.pool = mk(pool, P * 2, new T.MeshBasicMaterial({ map: this.radialTex(), transparent: true, opacity: 0.5, depthWrite: false, blending: T.AdditiveBlending })); this.pool.renderOrder = 1;
    const rg = new T.RingGeometry(0.5, 0.62, 28); rg.rotateX(-Math.PI / 2);
    this.ring = mk(rg, P, new T.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.85, depthWrite: false })); this.ring.renderOrder = 2;
    this.meRing = new T.Mesh(rg, new T.MeshBasicMaterial({ color: 0xFFD166, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false })); this.meRing.renderOrder = 9; this.meRing.userData.noShadow = true; sc.add(this.meRing);
    const ar = new T.ConeGeometry(0.22, 0.42, 4); ar.rotateX(Math.PI); this.meArrow = new T.Mesh(ar, new T.MeshBasicMaterial({ color: 0xFFD166, depthTest: false, transparent: true })); this.meArrow.renderOrder = 9; this.meArrow.userData.noShadow = true; sc.add(this.meArrow);
    // 내 실루엣 (가려졌을 때만): 몸 · 머리 · 다리 둘 · 팔 둘
    const xm = new T.MeshBasicMaterial({ color: 0xFFD166, transparent: true, opacity: 0.7, depthTest: false, depthWrite: false });
    this._meM = []; this.xray = [torso, head, leg, leg, arm, arm].map(g => { const m = new T.Mesh(g, xm); m.matrixAutoUpdate = false; m.visible = false; m.renderOrder = 8; m.userData.noShadow = true; m.frustumCulled = false; sc.add(m); return m; });
    this.ice = mk(new T.BoxGeometry(1.0, 1.9, 1.0), 12, new T.MeshBasicMaterial({ color: 0xA8E4FF, transparent: true, opacity: 0.35, depthWrite: false })); this.ice.renderOrder = 4;
    this.bubble = mk(new T.IcosahedronGeometry(1, 2), 12, new T.MeshBasicMaterial({ color: 0x4CC9F0, transparent: true, opacity: 0.18, depthWrite: false, blending: T.AdditiveBlending })); this.bubble.renderOrder = 4;
    this.cSkin = TG3_SKIN.map(h => this.color3(h)); this.cShirt = TG3_SHIRT.map(h => this.color3(h)); this.cPants = TG3_PANTS.map(h => this.color3(h)); this.cHair = TG3_HAIR.map(h => this.color3(h));
    this.cZSkin = this.color3(0x7FAF63); this.cZShirt = this.color3(0x5C6650); this.cZPants = this.color3(0x3A3530); this.cEye = new T.Color(1.0, 0.15, 0.1); this.cIce = this.color3(0xBFE8FF);
    this.cRingH = new T.Color(0x5EE07A); this.cRingZ = new T.Color(0xFF4D5E); this.cLamp = new T.Color(1, 0.95, 0.8); this.cPoolH = new T.Color(1.0, 0.86, 0.6); this.cPoolZ = new T.Color(0.7, 0.05, 0.05);
  }
  // 아이템 · 입자 · 눈덩이
  buildFx() {
    const T = THREE, sc = this.scene, c = (r, g, b) => this.col(r, g, b);
    const inst = (geo, mat, n) => { const m = new T.InstancedMesh(geo, mat, n); this.tmpC.setRGB(1, 1, 1); for (let i = 0; i < n; i++) m.setColorAt(i, this.tmpC); m.count = 0; m.frustumCulled = false; m.userData.noShadow = true; m.instanceMatrix.setUsage(T.DynamicDrawUsage); sc.add(m); return m; };
    const im = this.mat();
    this.itemMesh = {
      spd: inst(tg3Merge([tg3P(new T.BoxGeometry(0.34, 0.1, 0.62), 0, 0, 0.04, c(0.95, 0.95, 0.95)), tg3P(new T.BoxGeometry(0.3, 0.24, 0.42), 0, 0.15, -0.04, c(1, 0.36, 0.25)), tg3P(new T.BoxGeometry(0.31, 0.05, 0.3), 0, 0.17, 0.0, c(1, 1, 1))]), im, 24),
      inv: inst(tg3Merge([tg3P(new T.ConeGeometry(0.32, 0.7, 8), 0, 0, 0, c(0.62, 0.42, 0.95)), tg3P(new T.SphereGeometry(0.13, 8, 6), 0, 0.38, 0, c(0.85, 0.75, 1))]), im, 24),
      shd: inst(tg3Merge([tg3P(new T.CylinderGeometry(0.36, 0.36, 0.08, 16), 0, 0, 0, c(0.3, 0.72, 0.95), Math.PI / 2), tg3P(new T.CylinderGeometry(0.22, 0.22, 0.1, 16), 0, 0, 0, c(0.92, 0.95, 1), Math.PI / 2), tg3P(new T.BoxGeometry(0.06, 0.3, 0.12), 0, 0, 0, c(0.3, 0.72, 0.95))]), im, 24),
      snw: inst(tg3Merge([tg3P(new T.IcosahedronGeometry(0.28, 1), 0, 0, 0, c(0.96, 0.98, 1))]), im, 24)
    };
    const beam = new T.CylinderGeometry(0.42, 0.42, 3.2, 12, 1, true); beam.translate(0, 1.6, 0); { const p = beam.attributes.position, cc = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const k = 1 - p.getY(i) / 3.2; cc[i * 3] = cc[i * 3 + 1] = cc[i * 3 + 2] = k; } beam.setAttribute('color', new T.BufferAttribute(cc, 3)); }
    this.beam = inst(beam, new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.45, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }), 24); this.beam.renderOrder = 3;
    this.cItem = { spd: new T.Color(1, 0.42, 0.3), inv: new T.Color(0.7, 0.5, 1), shd: new T.Color(0.3, 0.78, 1), snw: new T.Color(0.85, 0.92, 1) };
    this.dots = inst(new T.IcosahedronGeometry(0.09, 0), new T.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, depthWrite: false, blending: T.AdditiveBlending }), 320); this.dots.renderOrder = 5;
    this.snowball = inst(new T.IcosahedronGeometry(0.2, 1), new T.MeshBasicMaterial({ color: 0xF4FAFF }), 16);
  }

  // ══ 그리기 ══
  draw() {
    if (this._dead || !this.renderer) return;
    const now = this.now, t = performance.now(), dt = this.drawAt ? Math.max(0.001, Math.min(0.1, (t - this.drawAt) / 1000)) : 0.016; this.drawAt = t;
    this.updateCamera(dt);
    this.updatePeople(now, dt);
    this.updateItems(now);
    this.updateParticles(now, dt);
    if (window.ThreeQuality && this.hq !== 'low') ThreeQuality.frame(this, this.camT.x, 0, this.camT.z, now);
    this.renderer.render(this.scene, this.camera);
    if (t - (this._hudAt || 0) >= 30 || this.gameOver) { this._hudAt = t; this.drawHud(); }   // 글자 HUD 는 초당 30번까지 (저사양 기기 CPU 아낌)
  }
  // 순위표는 0.3초마다 다시 셈 (한국어 이름 비교가 무거움)
  standingsC() { if (!this._stC || this.now - this._stAt > 300 || this.gameOver) { this._stC = this.standings(); this._stAt = this.now; } return this._stC; }
  updateCamera(dt) {
    const T = this.camT, W = this.world, z = this.role === 'z';
    let tx = this.x + Math.max(-2.5, Math.min(2.5, this.vx * 0.22)), tz = this.z + Math.max(-2.5, Math.min(2.5, this.vz * 0.22));
    if (this.camSnap || Math.hypot(T.x - tx, T.z - tz) > 12) { T.set(tx, 0, tz); this.camSnap = false; } else { const k = 1 - Math.exp(-dt * 6); T.x += (tx - T.x) * k; T.z += (tz - T.z) * k; }
    // 남쪽(카메라 쪽) 높은 건물이 나를 가리면 더 위에서 내려다봄 (기본 각도에서 가려지는지로 정함 · 그래도 가려지면 실루엣)
    const d = this.camDist || 18;
    const occAt = pitch => { let occ = false; const sn = Math.sin(pitch), cs = Math.cos(pitch);
      for (let i = 1; i <= 10 && !occ; i++) { const k = i / 10, py = 1.2 + d * sn * k, pz = this.z + d * cs * k;
        W.near(this.x - 0.3, pz - 0.3, this.x + 0.3, pz + 0.3, o => { if (o.t !== 'b' || !o.see) return false; const b = o.b; if (this.x > b.x0 - 0.6 && this.x < b.x1 + 0.6 && pz > b.z0 - 0.6 && pz < b.z1 + 0.6 && py < b.h + (b.k === 'house' || b.k === 'gym' ? 1.9 : 0.6)) { occ = true; return true; } return false; }); }   // (박공지붕 높이 포함)
      return occ; };
    if (!this._occT || this.now - this._occT > 120) { this._occT = this.now; this._occBase = occAt(0.92); this.occluded = occAt(this.camPitch); }
    const goal = this._occBase ? 1.36 : 0.92; this.camPitch += (goal - this.camPitch) * (1 - Math.exp(-dt * 3));
    const sh = this.shake || 0, j = sh * sh * 0.6, cam = this.camera;
    cam.position.set(T.x + (Math.random() - 0.5) * j, d * Math.sin(this.camPitch) + (Math.random() - 0.5) * j, T.z + d * Math.cos(this.camPitch));
    cam.lookAt(T.x, 0.8, T.z); cam.updateMatrixWorld();
    this.sky.position.set(cam.position.x, 0, cam.position.z);
    // 손전등 (사람 = 앞쪽 땅 · 좀비 = 붉은 시야)
    const sp = this.spot, a = this.h; sp.position.set(this.x + Math.cos(a) * 0.3, 1.5, this.z + Math.sin(a) * 0.3); sp.target.position.set(this.x + Math.cos(a) * 8, 0, this.z + Math.sin(a) * 8); sp.target.updateMatrixWorld();
    if (z !== this._spotZ) { this._spotZ = z; sp.color.set(z ? 0xFF5050 : 0xFFE2B0); if (this.lin) sp.color.convertSRGBToLinear(); sp.angle = z ? 0.95 : 0.62; sp.intensity = (this.hq === 'low' ? 1.6 : 2.4) * (z ? 0.6 : 1); }
  }
  // 한 명 그리기 (부품 행렬) — vis: 0 숨김 · 1 보통 · 2 유령
  updatePeople(now, dt) {
    const pp = this.pp, pg = this.pg, M = this.tmpM, M2 = this.tmpM2, Q = this.tmpQ, S = this.tmpS, P = this.tmpP, E = this.tmpE;
    const n = { b: 0, l: 0, g: 0, gl: 0, cone: 0, pool: 0, ring: 0, ice: 0, bub: 0, eye: 0, hair: 0 }, meZ = this.role === 'z', camX = this.camT.x, camZ = this.camT.z;
    const put = (id, x, z, h, role, walk, spd, fl, me) => {
      const zb = role === 'z', ghost = fl.inv && !zb; let vis = 1;
      if (ghost) { if (meZ && !me) { const d = Math.hypot(x - this.x, z - this.z); if (d > 3.5) return; } vis = 2; }
      if (!me && (Math.abs(x - camX) > 34 || Math.abs(z - camZ) > 40)) return;
      const hs = tgStrHash(id) >>> 0, rise = fl.rise ? Math.max(0, Math.min(1, fl.riseK)) : 1, froze = fl.frozen;
      let y = zb && fl.rise && fl.origin ? -1.6 * (1 - rise) : 0;
      const sw = Math.min(1, spd / 6) * (froze ? 0 : 1), ph = walk * 2.4, swing = Math.sin(ph) * 0.75 * sw, bob = Math.abs(Math.cos(ph)) * 0.06 * sw;
      y += bob;
      Q.setFromAxisAngle(this.vU, Math.PI / 2 - h); P.set(x, y, z); S.set(1, 1, 1); M.compose(P, Q, S);
      const lean = zb ? 0.16 : (fl.sprint ? 0.12 : 0.03);
      let pi = 0; const part = (mesh, i, ox, oy, oz, rx, col) => { E.set(rx || 0, 0, 0); this.tmpQ.setFromEuler(E); this.tmpV.set(ox, oy, oz); M2.compose(this.tmpV, this.tmpQ, S); M2.premultiply(M); mesh.setMatrixAt(i, M2); if (col) mesh.setColorAt(i, col);
        if (me && pi < 6) { (this._meM[pi] || (this._meM[pi] = new THREE.Matrix4())).copy(M2); pi++; } };
      const tgt = vis === 2 ? pg : pp, bi = vis === 2 ? n.g : n.b, li = vis === 2 ? n.gl : n.l; if (vis === 2 ? n.g >= 12 : n.b >= TG3_MAXP) return;
      const skin = zb ? this.cZSkin : this.cSkin[hs % this.cSkin.length], shirt = zb ? this.cZShirt : this.cShirt[(hs >>> 3) % this.cShirt.length], pants = zb ? this.cZPants : this.cPants[(hs >>> 7) % this.cPants.length];
      const ic = froze ? this.cIce : null;
      part(tgt.torso, bi, 0, 0.72, 0, lean, ic || shirt);
      part(tgt.head, bi, 0, 1.56, lean * 0.6 + (zb ? 0.05 : 0), 0, ic || skin);
      part(tgt.leg, li, -0.12, 0.74, 0, swing, ic || pants); part(tgt.leg, li + 1, 0.12, 0.74, 0, -swing, ic || pants);
      if (zb) { const reach = -1.35 + Math.sin(now / 260 + hs) * 0.12; part(tgt.arm, li, -0.33, 1.27, lean * 0.6, reach + swing * 0.2, ic || skin); part(tgt.arm, li + 1, 0.33, 1.27, lean * 0.6, reach - swing * 0.2, ic || skin); }
      else { part(tgt.arm, li, -0.33, 1.28, 0, -swing * 0.9, ic || shirt); part(tgt.arm, li + 1, 0.33, 1.28, 0, swing * 0.9 - 0.5, ic || shirt); }
      if (vis === 2) { n.g++; n.gl += 2; } else { n.b++; n.l += 2;
        if (!zb) { part(pp.hair, n.hair, 0, 1.6, 0, 0, this.cHair[(hs >>> 11) % this.cHair.length]); n.hair++; part(pp.lamp, n.hair - 1, 0.33, 0.7, 0.25, 0, this.cLamp); }
        else if (n.eye < TG3_MAXP) { part(pp.eyes, n.eye, 0, 1.56, lean * 0.6 + 0.05, 0, this.cEye); n.eye++; } }
      // 손전등 빛 원뿔 · 땅 빛 (사람) / 붉은 기운 (좀비)
      if (!zb && vis === 1 && this.q > 0 && n.cone < TG3_MAXP) { part(this.cone, n.cone, 0.33, 0.85, 0.3, 0); n.cone++; }
      if (n.pool < TG3_MAXP * 2) { const ca = Math.cos(h), sa = Math.sin(h);
        if (!zb && vis === 1 && !(me && this.hq !== 'low')) { this.tmpQ.set(0, 0, 0, 1); S.set(3.2, 1, 4.2); P.set(x + ca * 4.2, 0.04, z + sa * 4.2); M2.compose(P, this.tmpQ.setFromAxisAngle(this.vU, Math.PI / 2 - h), S); this.pool.setMatrixAt(n.pool, M2); this.pool.setColorAt(n.pool, this.cPoolH); n.pool++; S.set(1, 1, 1); }
        else if (zb) { this.tmpQ.set(0, 0, 0, 1); S.set(2.6, 1, 2.6); P.set(x, 0.035, z); M2.compose(P, this.tmpQ, S); this.pool.setMatrixAt(n.pool, M2); this.pool.setColorAt(n.pool, this.cPoolZ); n.pool++; S.set(1, 1, 1); } }
      if (!me && n.ring < TG3_MAXP) { this.tmpQ.set(0, 0, 0, 1); P.set(x, 0.05, z); M2.compose(P, this.tmpQ, S); this.ring.setMatrixAt(n.ring, M2); this.ring.setColorAt(n.ring, zb ? this.cRingZ : this.cRingH); n.ring++; }
      if (froze && n.ice < 12) { this.tmpQ.set(0, 0, 0, 1); P.set(x, 0.95, z); M2.compose(P, this.tmpQ, S); this.ice.setMatrixAt(n.ice++, M2); }
      if ((fl.shield || fl.immune) && n.bub < 12) { this.tmpQ.set(0, 0, 0, 1); const s = 1.05 + 0.04 * Math.sin(now / 150); S.set(s, s * 1.05, s); P.set(x, 1.0, z); M2.compose(P, this.tmpQ, S); this.bubble.setMatrixAt(n.bub++, M2); S.set(1, 1, 1); }
    };
    for (const id in this.peers) { const p = this.peers[id]; if (p.tx == null || p.role === 'w') continue;
      put(id, p.x, p.z, p.h, p.role, p.walk || 0, p.spdShown || 0, { inv: p.inv, rise: p.rise, riseK: p.rise ? (now - (p.turnedAt || p.born || now)) / TG_RISE0 : 1, origin: p.origin, frozen: p.frozen, shield: p.shield, immune: p.immune, sprint: p.sprint }, false); }
    if (!this.joinWait) { const spd = Math.hypot(this.vx, this.vz);
      put(this.myId, this.x, this.z, this.h, this.role, this.walk || 0, spd, { inv: now < this.invUntil, rise: this.role === 'z' && now < this.riseUntil, riseK: 1 - (this.riseUntil - now) / (this.origin ? TG_RISE0 : TG_RISE), origin: this.origin, frozen: now < this.frozenUntil, shield: this.shield, immune: now < this.immuneUntil, sprint: this.sprinting }, true); }
    const fin = (m, k) => { m.count = k; m.visible = k > 0; if (k) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; } };
    fin(pp.torso, n.b); fin(pp.head, n.b); fin(pp.leg, n.l); fin(pp.arm, n.l); fin(pp.hair, n.hair); fin(pp.lamp, n.hair); fin(pp.eyes, n.eye);
    fin(pg.torso, n.g); fin(pg.head, n.g); fin(pg.leg, n.gl); fin(pg.arm, n.gl); fin(this.cone, n.cone); fin(this.pool, n.pool); fin(this.ring, n.ring); fin(this.ice, n.ice); fin(this.bubble, n.bub);
    // 내 표시 (벽 뒤에서도 보임)
    const show = !this.joinWait && !this.gameOver; this.meRing.visible = this.meArrow.visible = show;
    if (show) { this.meRing.position.set(this.x, 0.06, this.z); if (this._ringZ !== this.role) { this._ringZ = this.role; this.meRing.material.color.copy(this.color3(this.role === 'z' ? 0xFF7A85 : 0xFFD166)); this.meArrow.material.color.copy(this.meRing.material.color); this.xray.forEach(m => m.material.color.copy(this.meRing.material.color)); }
      this.meArrow.position.set(this.x, 2.45 + 0.12 * Math.sin(now / 220), this.z); }
    // 지붕 · 건물에 가려졌으면 내 몸을 비쳐 보이게 (벽 너머 실루엣)
    const xr = show && this.occluded; this.xray.forEach((m, i) => { m.visible = xr && !!this._meM[i]; if (m.visible) m.matrix.copy(this._meM[i]); });
    // 가로등 빛 (카메라를 봄)
    if (this.halo) { const cq = this.camera.quaternion; for (let i = 0; i < this.haloPos.length; i++) { const h0 = this.haloPos[i]; P.set(h0.x, h0.y, h0.z); S.set(1, 1, 1); M.compose(P, cq, S); this.halo.setMatrixAt(i, M); } this.halo.instanceMatrix.needsUpdate = true; }
  }
  updateItems(now) {
    const srv = this.srv(), its = this.itemsNow(srv), cnt = { spd: 0, inv: 0, shd: 0, snw: 0 }, M = this.tmpM, Q = this.tmpQ, S = this.tmpS, P = this.tmpP; let nb = 0;
    for (const it of its) { const m = this.itemMesh[it.k]; if (cnt[it.k] >= 24) continue; const pop = Math.min(1, it.age / 400), b = 0.65 + 0.15 * Math.sin(now / 300 + it.s);
      Q.setFromAxisAngle(this.vU, now / 600 + it.s); S.set(pop * 1.25, pop * 1.25, pop * 1.25); P.set(it.x, b, it.z); M.compose(P, Q, S); m.setMatrixAt(cnt[it.k]++, M);
      if (nb < 24) { Q.set(0, 0, 0, 1); S.set(1, 0.6 + 0.4 * pop, 1); P.set(it.x, 0.02, it.z); M.compose(P, Q, S); this.beam.setMatrixAt(nb, M); this.beam.setColorAt(nb, this.cItem[it.k]); nb++; } }
    for (const k in this.itemMesh) { const m = this.itemMesh[k]; m.count = cnt[k]; m.visible = cnt[k] > 0; if (cnt[k]) m.instanceMatrix.needsUpdate = true; }
    S.set(1, 1, 1); this.beam.count = nb; this.beam.visible = nb > 0; if (nb) { this.beam.instanceMatrix.needsUpdate = true; this.beam.instanceColor.needsUpdate = true; }
    // 눈덩이 (포물선)
    let ns = 0; for (const s of this.shots) { const k = (now - s.t0) / s.T; if (k < 0 || k > 1 || ns >= 16) continue; Q.set(0, 0, 0, 1); P.set(s.x0 + (s.x1 - s.x0) * k, 1.3 + 2.2 * k * (1 - k), s.z0 + (s.z1 - s.z0) * k); M.compose(P, Q, S); this.snowball.setMatrixAt(ns++, M);
      if (k > 0.92 && !s.hit) { s.hit = true; this.burst(s.x1, 1.2, s.z1, 14, [0.85, 0.95, 1]); } }
    this.snowball.count = ns; this.snowball.visible = ns > 0; if (ns) this.snowball.instanceMatrix.needsUpdate = true;
  }
  burst(x, y, z, n, col, up) { if (this.q === 0) n = Math.ceil(n / 2); for (let i = 0; i < n; i++) { if (this.parts.length >= 320) this.parts.shift(); const a = Math.random() * Math.PI * 2, v = 1.5 + Math.random() * 3;
    this.parts.push({ x, y, z, vx: Math.cos(a) * v, vy: (up || 2) + Math.random() * 3, vz: Math.sin(a) * v, life: 1, decay: 1.1 + Math.random() * 0.8, s: 0.6 + Math.random() * 0.9, c: col }); } }
  updateParticles(now, dt) {
    // 엔진이 남긴 효과 (감염 · 방패 · 눈 · 아이템) → 입자
    for (const f of this.fx) { if (f._done) continue; f._done = true;
      if (f.kind === 'infect') this.burst(f.x, 1.0, f.z, 26, [0.45, 1, 0.35], 2.5); else if (f.kind === 'shield') this.burst(f.x, 1.0, f.z, 18, [0.3, 0.8, 1]); else if (f.kind === 'snow') this.burst(f.x, 1.2, f.z, 16, [0.85, 0.95, 1]); else if (f.kind === 'item') this.burst(f.x, 0.8, f.z, 14, [1, 0.9, 0.5]); }
    if (this.now < this.dashUntil && Math.random() < 0.6) this.burst(this.x, 0.15, this.z, 1, [0.5, 0.5, 0.55], 0.5);
    const M = this.tmpM, Q = this.tmpQ, S = this.tmpS, P = this.tmpP; Q.set(0, 0, 0, 1); let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) { const p = this.parts[i]; p.life -= dt * p.decay; if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      p.vy -= 7 * dt; p.x += p.vx * dt; p.y = Math.max(0.05, p.y + p.vy * dt); p.z += p.vz * dt; const s = p.s * p.life; S.set(s, s, s); P.set(p.x, p.y, p.z); M.compose(P, Q, S); this.dots.setMatrixAt(n, M);
      this.tmpC.setRGB(p.c[0] * p.life, p.c[1] * p.life, p.c[2] * p.life); this.dots.setColorAt(n, this.tmpC); n++; }
    S.set(1, 1, 1); this.dots.count = n; this.dots.visible = n > 0; if (n) { this.dots.instanceMatrix.needsUpdate = true; this.dots.instanceColor.needsUpdate = true; }
  }

  // ══ HUD ══
  measureCtl() {
    const t = performance.now(); if (this._ctl && t - this._ctlAt < 1000 && this._ctlW === this.vw && this._ctlH === this.vh) return this._ctl;
    this._ctlAt = t; this._ctlW = this.vw; this._ctlH = this.vh;
    const out = { joyTop: this.vh, joyRight: 0, btn: null }, ctl = typeof document !== 'undefined' && document.getElementById('fps-ctl');
    if (ctl) { const hr = this.host.getBoundingClientRect(), j = ctl.querySelector('.fjoy'); if (j) { const r = j.getBoundingClientRect(); if (r.width) { out.joyTop = r.top - hr.top; out.joyRight = r.right - hr.left; } }
      const b = document.getElementById('aboost'); if (b) { const r = b.getBoundingClientRect(); if (r.width) out.btn = { x: r.left - hr.left + r.width / 2, y: r.top - hr.top + r.height / 2, r: r.width / 2 }; } }
    return (this._ctl = out);
  }
  // ⚡ 버튼 글자: 사람 = 달리기 · 좀비 = 돌진
  labelButton() {
    const k = this.role + (this.gameOver ? 'o' : ''); if (k === this._btnK) return; const b = typeof document !== 'undefined' && document.getElementById('aboost'); if (!b) return; this._btnK = k;
    b.innerHTML = this.role === 'z' ? '💥<small>돌진</small>' : '🏃<small>달리기</small>'; b.style.borderColor = this.role === 'z' ? 'rgba(255,90,110,.7)' : 'rgba(94,224,122,.7)';
  }
  layout() {
    const W = this.vw, H = this.vh, port = H > W * 1.05, s = Math.max(0.85, Math.min(1.35, Math.min(W, H) / 400)), pad = 8, C = this.measureCtl();
    const mm = Math.round(port ? Math.min(118, W * 0.3) : Math.min(150, H * 0.28, W * 0.18));
    const L = { W, H, port, s, pad, C, mm: { x: W - mm - pad, y: pad, w: mm, h: mm } };
    L.panel = { x: 60, y: pad, w: Math.round(port ? Math.min(W - mm - 60 - pad * 2, 230) : Math.min(250 * s, W * 0.3)), h: Math.round(58 * s) };
    L.clock = port ? { x: 60, y: L.panel.y + L.panel.h + 6, align: 'left' } : { x: W / 2, y: pad + 2, align: 'center' };
    return L;
  }
  drawHud() {
    const c = this.ctx, d = this.hudDpr || 1, W = this.vw, H = this.vh, now = this.now, srv = this.srv(), ph = this.phase(srv);
    c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, W, H);
    this.labelButton();
    const L = this.layout(), s = L.s;
    // 위험 테두리 (사람: 좀비가 가까우면 붉게 두근두근) · 좀비 시야(늘 붉은 기운)
    let danger = 0; if (this.role === 'h' && ph === 'hunt' && this.nearZ < 10) danger = Math.min(1, (10 - this.nearZ) / 8) * (0.55 + 0.45 * Math.abs(Math.sin(now / Math.max(120, 60 + this.nearZ * 40))));
    if (this.role === 'z' && !this.gameOver) danger = Math.max(danger, 0.28);
    if (danger > 0.02) { if (!this._vig || this._vigW !== W || this._vigH !== H) { const g = this._vig = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.24, W / 2, H / 2, Math.max(W, H) * 0.62); g.addColorStop(0, 'rgba(255,30,50,0)'); g.addColorStop(0.6, 'rgba(255,30,50,0.32)'); g.addColorStop(1, 'rgba(255,20,40,0.8)'); this._vigW = W; this._vigH = H; }
      c.globalAlpha = danger; c.fillStyle = this._vig; c.fillRect(0, 0, W, H);
      if (this.role === 'h') { c.lineWidth = 10; c.strokeStyle = 'rgba(255,40,60,0.85)'; c.strokeRect(5, 5, W - 10, H - 10); }   // 화면 테두리 경고
      c.globalAlpha = 1; }
    this.drawLabels(c, L);
    this.drawEdgeArrow(c, L);
    this.drawTop(c, L, srv, ph);
    this.drawMinimap(c, L);
    this.drawFeed(c, L);
    this.drawButtonRing(c, L);
    this.drawToasts(c, L);
    const roundCard = !this.gameOver && ph === 'wait' && this.r > 1 && this.lastRound && srv < this.rs;
    if (!roundCard) this.drawBanner(c, L, srv, ph);
    if (this.guideAt && now - this.guideAt < 6500 && !this.gameOver) this.drawGuide(c, L, now - this.guideAt);
    if (roundCard) this.drawRoundEnd(c, L, srv);
    if (this.joinWait && !this.gameOver) { c.fillStyle = 'rgba(8,10,24,0.55)'; c.fillRect(0, 0, W, H); tg3T(c, '참가하는 중…', W / 2, H * 0.42, 22 * s, '#FFFFFF', 'center', null, 900); tg3T(c, '친구들과 라운드를 맞추고 있어요', W / 2, H * 0.42 + 30 * s, 13 * s, '#BFD3FF'); }
    if (this.gameOver && this.result) this.drawResult(c, L);
  }
  toScreen(x, y, z) { const v = this.tmpV.set(x, y, z).project(this.camera); if (v.z > 1 || v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1) return null; return [(v.x + 1) / 2 * this.vw, (1 - v.y) / 2 * this.vh]; }
  // 머리 위: 이름 (사람 흰색 · 좀비 빨강) + 상태 (방패 · 얼음 · 기절 · 투명) — 벽 너머 친구는 이름도 안 보임
  drawLabels(c, L) {
    const s = L.s, meZ = this.role === 'z', now = this.now; let nl = 0;
    for (const id in this.peers) { const p = this.peers[id]; if (p.tx == null || p.role === 'w') continue;
      const d = Math.hypot(p.x - this.x, p.z - this.z); if (d > 24 || nl >= 14) continue;
      if (p.inv && p.role === 'h' && meZ && d > 3.5) continue;
      if (d > 3) { if (!p._losAt || now - p._losAt > 150) { p._losAt = now; p._los = this.world.los(this.x, this.z, p.x, p.z); } if (!p._los) continue; }
      nl++;
      const sp = this.toScreen(p.x, 2.3, p.z); if (!sp) continue; const zb = p.role === 'z';
      c.globalAlpha = p.stale ? 0.45 : 1;
      if (zb) { c.fillStyle = '#FF4D5E'; c.beginPath(); c.moveTo(sp[0], sp[1] + 6 * s); c.lineTo(sp[0] - 6 * s, sp[1] - 4 * s); c.lineTo(sp[0] + 6 * s, sp[1] - 4 * s); c.closePath(); c.fill(); }
      else { c.fillStyle = '#5EE07A'; c.beginPath(); c.arc(sp[0], sp[1], 4.5 * s, 0, 7); c.fill(); }
      tg3T(c, p.name || '친구', sp[0], sp[1] - 13 * s, 11 * s, zb ? '#FFB3BC' : '#FFFFFF', 'center', null, 700);
      const tag = p.frozen ? '얼음' : p.stun ? '기절' : p.rise ? '일어나는 중' : p.shield ? '방패' : p.inv ? '투명' : p.stale ? '연결 약함' : '';
      if (tag) tg3T(c, tag, sp[0], sp[1] + 14 * s, 9.5 * s, p.frozen ? '#BFE8FF' : p.shield ? '#8FDFFF' : '#FFE08A', 'center', null, 800);
      c.globalAlpha = 1; }
    if (!this.joinWait && !this.gameOver) { const sp = this.toScreen(this.x, 2.95, this.z); const now = this.now;
      const tag = now < this.frozenUntil ? '얼었어요!' : now < this.stunUntil ? '기절!' : this.role === 'z' && now < this.riseUntil ? '일어나는 중…' : now < this.invUntil ? '투명 중' : '';
      if (sp && tag) tg3T(c, tag, sp[0], sp[1] - 12 * s, 12 * s, '#FFE08A', 'center', null, 900); }
  }
  // 좀비: 화면 밖 가까운 사람(20m 안) 쪽 화살표 · 사람: 화면 밖 가까운 좀비(12m 안) 경고 화살표
  drawEdgeArrow(c, L) {
    if (this.gameOver || this.joinWait || this.phase() !== 'hunt') return; const zMe = this.role === 'z', lim = zMe ? 20 : 12; let best = null, bd = lim;
    for (const id in this.peers) { const p = this.peers[id]; if (p.tx == null || p.r !== this.r || p.role === 'w' || p.role === this.role) continue; if (zMe && p.inv) continue; const d = Math.hypot(p.x - this.x, p.z - this.z); if (d < bd) { bd = d; best = p; } }
    if (!best || this.toScreen(best.x, 1, best.z)) return;
    const a = Math.atan2(best.z - this.z, best.x - this.x), cx = L.W / 2, cy = L.H / 2, rx = L.W / 2 - 34, ry = L.H / 2 - 70, k = Math.min(rx / Math.max(1e-3, Math.abs(Math.cos(a))), ry / Math.max(1e-3, Math.abs(Math.sin(a))));
    const x = cx + Math.cos(a) * k, y = cy + Math.sin(a) * k, s = L.s * (1 + 0.12 * Math.sin(this.now / 150));
    c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = zMe ? 'rgba(94,224,122,0.9)' : 'rgba(255,77,94,0.92)'; c.beginPath(); c.moveTo(16 * s, 0); c.lineTo(-8 * s, -11 * s); c.lineTo(-3 * s, 0); c.lineTo(-8 * s, 11 * s); c.closePath(); c.fill(); c.restore();
    tg3T(c, Math.round(bd) + 'm', x - Math.cos(a) * 22, y - Math.sin(a) * 22, 10 * L.s, '#FFFFFF', 'center', null, 800);
  }
  // 왼쪽 위: 역할 · 점수 · 순위 · 아이템 / 가운데(가로) 또는 그 아래(세로): 남은 시간 · 라운드 · 사람/좀비 수
  drawTop(c, L, srv, ph) {
    const s = L.s, P = L.panel, zMe = this.role === 'z', now = this.now;
    c.fillStyle = 'rgba(10,12,30,0.66)'; tg3RR(c, P.x, P.y, P.w, P.h, 12); c.fill();
    const r = P.h * 0.36, cx = P.x + r + 7, cy = P.y + P.h / 2;
    c.fillStyle = zMe ? '#E5394C' : '#3BBF5C'; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill();
    // 얼굴 그림 (사람: 웃는 얼굴 · 좀비: 붉은 눈 + 이빨)
    c.fillStyle = zMe ? '#FFD0D0' : '#FFFFFF'; c.beginPath(); c.arc(cx - r * 0.35, cy - r * 0.18, r * 0.14, 0, 7); c.arc(cx + r * 0.35, cy - r * 0.18, r * 0.14, 0, 7); c.fill();
    c.strokeStyle = '#FFFFFF'; c.lineWidth = Math.max(1.5, r * 0.12); c.beginPath(); if (zMe) { c.moveTo(cx - r * 0.42, cy + r * 0.35); for (let i = 1; i <= 6; i++) c.lineTo(cx - r * 0.42 + i * r * 0.14, cy + r * (i % 2 ? 0.22 : 0.38)); } else c.arc(cx, cy + r * 0.08, r * 0.38, 0.2, Math.PI - 0.2); c.stroke();
    const x0 = cx + r + 8, w = P.x + P.w - x0 - 8, st = this.standingsC(), rk = st.findIndex(q => q.me) + 1;
    tg3TF(c, this.joinWait ? '참가 중' : zMe ? '좀비' : '사람', x0, P.y + 13 * s, 13 * s, w * 0.5, zMe ? '#FF9AA6' : '#9EF0B0', 'left', false, 900);
    tg3TF(c, rk + '등 / ' + st.length, x0 + w, P.y + 13 * s, 11 * s, w * 0.48, '#FFE08A', 'right', false, 800);
    tg3TF(c, this.score + '점', x0, P.y + P.h * 0.62, 20 * s, w * 0.6, '#FFFFFF', 'left', false, 900);
    // 아이템 · 상태 작은 칸
    let ix = x0 + w; const chip = (txt, col) => { c.font = '800 ' + Math.round(9.5 * s) + 'px ' + TG_FONT; const tw = c.measureText(txt).width + 10 * s; ix -= tw; c.fillStyle = col; tg3RR(c, ix, P.y + P.h * 0.5, tw - 3, 15 * s, 6); c.fill(); tg3T(c, txt, ix + (tw - 3) / 2, P.y + P.h * 0.5 + 7.5 * s, 9.5 * s, '#0B0F1E', 'center', false, 900); };
    if (this.snow > 0) chip('눈 ' + this.snow, '#E6F2FF'); if (this.shield) chip('방패', '#7FD8FF'); if (now < this.spdUntil) chip('신발 ' + Math.ceil((this.spdUntil - now) / 1000), '#FF9A80'); if (now < this.invUntil) chip('투명 ' + Math.ceil((this.invUntil - now) / 1000), '#C9A8FF');
    if (zMe && this.catches) chip('잡음 ' + this.catches, '#FFB3BC');
    // 시계 + 라운드 + 수
    const mLeft = this.matchEnd() - srv, cnt = this.counts(), last = mLeft < 10000 && !this.gameOver && this.started;
    const txt = !this.started ? '출발 ' + tg3Clock(this.startAt - srv) : tg3Clock(this.gameOver ? 0 : mLeft), K = L.clock, fs = (last ? 19 : 15) * s * (last ? 1 + 0.08 * Math.abs(Math.sin(now / 160)) : 1);
    c.font = '900 ' + Math.round(fs) + 'px ' + TG_FONT; const tw = c.measureText(txt).width; c.font = '800 ' + Math.round(11 * s) + 'px ' + TG_FONT;
    const rtx = this.r + '라운드', rw = c.measureText(rtx).width, numW = 80 * s, bw = tw + rw + numW + 40 * s, bx = K.align === 'left' ? K.x : K.x - bw / 2, bh = 28 * s;
    c.fillStyle = last ? 'rgba(120,16,28,0.8)' : 'rgba(10,12,30,0.66)'; tg3RR(c, bx, K.y, bw, bh, bh / 2); c.fill();
    tg3T(c, txt, bx + 12 * s + tw / 2, K.y + bh / 2 + 1, fs, last ? '#FFD0D0' : '#FFFFFF', 'center', false, 900);
    let xx = bx + 22 * s + tw; tg3T(c, rtx, xx, K.y + bh / 2 + 1, 11 * s, '#FFE08A', 'left', false, 800); xx += rw + 10 * s;
    c.fillStyle = '#5EE07A'; c.beginPath(); c.arc(xx + 4 * s, K.y + bh / 2, 4.5 * s, 0, 7); c.fill(); tg3T(c, String(cnt.h), xx + 12 * s, K.y + bh / 2 + 1, 12 * s, '#C8FFD4', 'left', false, 900); xx += 38 * s;
    c.fillStyle = '#FF4D5E'; c.beginPath(); c.arc(xx + 4 * s, K.y + bh / 2, 4.5 * s, 0, 7); c.fill(); tg3T(c, String(cnt.z), xx + 12 * s, K.y + bh / 2 + 1, 12 * s, '#FFC0C8', 'left', false, 900);
    // 준비 시간 큰 숫자 (마지막 3초)
    if (!this.gameOver && ph === 'prep') { const left = this.pickAt() - srv; if (left < 3500) { const n = Math.ceil(left / 1000); if (n !== this._cntN) { this._cntN = n; this.sfx('count'); }
        tg3T(c, '좀비 등장까지', L.W / 2, L.H * 0.3, 15 * s, '#FFD0D0'); tg3T(c, String(n), L.W / 2, L.H * 0.3 + 40 * s, 52 * s * (1.2 - 0.2 * ((left % 1000) / 1000)), '#FF6B7E', 'center', null, 900); } }
  }
  drawMinimap(c, L) {
    const R = L.mm, k = R.w / this.L; if (!this.mmCanvas) return; const zMe = this.role === 'z';
    c.save(); c.fillStyle = 'rgba(10,12,30,0.72)'; tg3RR(c, R.x - 3, R.y - 3, R.w + 6, R.h + 6, 9); c.fill(); tg3RR(c, R.x, R.y, R.w, R.h, 7); c.clip();
    c.drawImage(this.mmCanvas, R.x, R.y, R.w, R.h);
    const dot = (x, z, col, r) => { c.fillStyle = col; c.beginPath(); c.arc(R.x + x * k, R.y + z * k, r, 0, 7); c.fill(); };
    for (const it of this.itemsNow(this.srv())) if (this.role === 'h') { c.fillStyle = TG_ITEMS[it.k].color; c.fillRect(R.x + it.x * k - 1.5, R.y + it.z * k - 1.5, 3, 3); }
    for (const id in this.peers) { const p = this.peers[id]; if (p.tx == null || p.role === 'w') continue; const same = p.role === this.role, d = Math.hypot(p.x - this.x, p.z - this.z);
      if (!same && (d > 16 || (p.inv && zMe))) continue; if (p.inv && !zMe && p.role === 'h') { c.globalAlpha = 0.45; }
      dot(p.x, p.z, p.role === 'z' ? '#FF4D5E' : '#5EE07A', 2.6); c.globalAlpha = 1; }
    if (!this.joinWait) { const x = R.x + this.x * k, y = R.y + this.z * k, a = this.h; c.fillStyle = '#FFD166'; c.strokeStyle = '#151528'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6); c.lineTo(x + Math.cos(a + 2.4) * 4.5, y + Math.sin(a + 2.4) * 4.5); c.lineTo(x + Math.cos(a - 2.4) * 4.5, y + Math.sin(a - 2.4) * 4.5); c.closePath(); c.fill(); c.stroke(); }
    c.restore();
  }
  drawFeed(c, L) {
    const s = L.s; let y = L.mm.y + L.mm.h + 16 * s; const x = L.W - L.pad;
    for (const f of this.feed) { const a = Math.max(0, Math.min(1, (f.t - this.now) / 600)); c.globalAlpha = a;
      const txt = f.a + ' ▶ ' + f.b, fs = 11 * s; c.font = '800 ' + Math.round(fs) + 'px ' + TG_FONT; const w = Math.min(c.measureText(txt).width, L.W * 0.5) + 14 * s;
      c.fillStyle = f.kind === 'me' ? 'rgba(120,90,10,0.78)' : f.kind === 'mv' ? 'rgba(120,20,30,0.78)' : 'rgba(10,12,30,0.62)'; tg3RR(c, x - w, y - 9 * s, w, 18 * s, 6); c.fill();
      tg3TF(c, txt, x - 7 * s, y, fs, w - 14 * s, f.kind === 'me' ? '#FFE08A' : f.kind === 'mv' ? '#FFB3BC' : '#FFFFFF', 'right', false, 800); y += 21 * s; c.globalAlpha = 1; }
  }
  // ⚡ 버튼 둘레: 사람 = 기력 고리 · 좀비 = 돌진 대기 고리
  drawButtonRing(c, L) {
    const b = L.C.btn; if (!b || this.gameOver || this.joinWait) return; const now = this.now, zMe = this.role === 'z';
    const k = zMe ? (now >= this.dashCdUntil ? 1 : 1 - (this.dashCdUntil - now) / TG_DASH_CD) : this.stam / 100, R = b.r + 6;
    c.lineWidth = 6; c.strokeStyle = 'rgba(0,0,0,0.45)'; c.beginPath(); c.arc(b.x, b.y, R, 0, 7); c.stroke();
    c.strokeStyle = zMe ? (k >= 1 ? '#FF6B7E' : '#9A4A55') : (this.stamLock ? '#FF9A5A' : '#5EE07A'); c.beginPath(); c.arc(b.x, b.y, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, k))); c.stroke();
    if (zMe && k >= 1 && this.phase() === 'hunt' && this.active(now)) tg3T(c, '돌진 준비!', b.x, b.y - R - 10, 10 * L.s, '#FFB3BC', 'center', null, 800);
  }
  drawToasts(c, L) {
    const s = L.s; let y = L.H * (L.port ? 0.6 : 0.66);
    for (let i = Math.max(0, this.toasts.length - 3); i < this.toasts.length; i++) { const t = this.toasts[i], a = Math.max(0, Math.min(1, (t.until - this.now) / 400)); c.globalAlpha = a; tg3TF(c, t.text, L.W / 2, y, 16 * s, L.W - 24, t.color); y += 22 * s; }
    c.globalAlpha = 1;
  }
  drawBanner(c, L, srv, ph) {
    const b = this.banner; if (!b || this.now > b.until || this.gameOver) return; const s = L.s, t = this.now - b.at, a = Math.min(1, t / 200, (b.until - this.now) / 400), k = 1 + 0.25 * Math.max(0, 1 - t / 250);
    c.globalAlpha = Math.max(0, a); const y = L.H * (L.port ? 0.36 : 0.32);
    tg3TF(c, b.title, L.W / 2, y, 30 * s * k, L.W - 30, b.color, 'center', null, 900); if (b.sub) tg3TF(c, b.sub, L.W / 2, y + 30 * s, 14 * s, L.W - 30, '#FFFFFF', 'center', null, 800); c.globalAlpha = 1;
  }
  drawGuide(c, L, t) {
    const s = L.s, a = Math.min(1, (6500 - t) / 600), zMe = this.role === 'z';
    const lines = ['조이스틱: 이동 (화면 위 = 북쪽)', zMe ? '좀비: 사람에게 닿으면 잡아요 · 💥 톡 = 돌진' : '사람: 좀비(빨강)를 피해 살아남아요 · 🏃 꾹 = 달리기', '아이템: 신발(빨라짐) · 망토(투명) · 방패(한 번 막음) · 눈덩이(좀비 얼리기)'];
    if (!this.touchUi) lines.push('PC: WASD · 방향키 이동 · Space 꾹 = 달리기/돌진');
    const C = L.C, fs = 12 * s, lh = 18 * s, h = lines.length * lh + 14 * s, bl = C.btn ? C.btn.x - C.btn.r - 12 : L.W - 12, w = L.port ? Math.min(L.W - 24, 400 * s) : Math.min(400 * s, Math.max(240, bl - C.joyRight - 16)), x = L.port ? (L.W - w) / 2 : (C.joyRight + bl) / 2 - w / 2;
    const y = L.port ? Math.min(L.H * 0.74 - h / 2, C.joyTop - 10 - h) : L.H - 10 - h;   // 가로: 아래쪽 조이스틱과 버튼 사이 (가운데 내 캐릭터를 가리지 않게)
    c.globalAlpha = a; c.fillStyle = 'rgba(10,12,30,0.74)'; tg3RR(c, x, y, w, h, 12); c.fill();
    lines.forEach((ln, i) => tg3TF(c, ln, x + w / 2, y + 7 * s + lh * (i + 0.5), fs, w - 16, i === 3 ? '#BFD3FF' : i === 1 ? (zMe ? '#FFB3BC' : '#C8FFD4') : '#FFFFFF', 'center', false, 800)); c.globalAlpha = 1;
  }
  // 라운드 사이: 지난 라운드 결과 + 지금 순위 위 5명
  drawRoundEnd(c, L, srv) {
    const s = L.s, lr = this.lastRound, st = this.standingsC().slice(0, 5), w = Math.min(L.W - 24, 330 * s), h = (96 + st.length * 19) * s, x = (L.W - w) / 2, y = L.H * 0.44 - h / 2 + 40 * s;
    c.fillStyle = 'rgba(14,16,40,0.86)'; tg3RR(c, x, y, w, h, 14); c.fill();
    tg3T(c, lr.r + '라운드 결과', L.W / 2, y + 20 * s, 16 * s, '#FFD166', 'center', null, 900);
    tg3TF(c, lr.why === 'cap' ? '살아남은 사람 ' + lr.surv.length + '명' + (lr.surv.length ? ': ' + lr.surv.slice(0, 4).join(', ') + (lr.surv.length > 4 ? ' …' : '') : '') : '사람이 모두 잡혔어요!', L.W / 2, y + 42 * s, 12 * s, w - 20, '#FFFFFF', 'center', false, 800);
    st.forEach((q, i) => tg3TF(c, (i + 1) + '. ' + q.name + '  ' + q.score + '점', L.W / 2, y + (66 + i * 19) * s, 12 * s, w - 20, q.me ? '#FFE08A' : '#E0E6F5', 'center', false, 800));
    tg3T(c, '다음 라운드 ' + Math.max(0, Math.ceil((this.rs - srv) / 1000)) + '초', L.W / 2, y + h - 14 * s, 12 * s, '#9EF0B0', 'center', false, 900);
  }
  drawResult(c, L) {
    const s = L.s, R = this.result, w = Math.min(L.W - 24, 340 * s), h = (150 + Math.min(5, R.top.length) * 20) * s, x = (L.W - w) / 2, y = (L.H - h) / 2;
    c.fillStyle = 'rgba(8,10,24,0.55)'; c.fillRect(0, 0, L.W, L.H); c.fillStyle = 'rgba(20,24,52,0.96)'; tg3RR(c, x, y, w, h, 14); c.fill();
    tg3T(c, this.rank === 1 ? '1등!' : this.rank + '등 / ' + this.total, L.W / 2, y + 32 * s, 28 * s, this.rank === 1 ? '#FFD166' : '#FFFFFF', 'center', null, 900);
    tg3T(c, '점수 ' + this.score + ' · 생존 ' + this.survSec + '초 · 잡음 ' + this.catches, L.W / 2, y + 64 * s, 13 * s, '#FFFFFF');
    R.top.slice(0, 5).forEach((q, i) => tg3TF(c, (i + 1) + '. ' + q.name + '  ' + q.score + '점', L.W / 2, y + (98 + i * 20) * s, 12 * s, w - 20, q.me ? '#FFE08A' : '#E0E6F5', 'center', false, 800));
  }
}
if (typeof window !== 'undefined') window.TagGame = TagGame;
