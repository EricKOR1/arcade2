// 장애물 대탈출 3D — 그림(Three.js r128) · HUD · 카메라. 규칙 · 코스 · 통신은 obst-engine.js 의 ObstCore
//   · 3인칭 뒤따라가는 카메라(코스 앞 = 화면 위 = 조이스틱 위) · 흔들림 · 부드러운 따라가기
//   · 그리기 호출을 인원과 무관하게: 캐릭터는 부품(몸 · 눈 · 모자 6종 · 발 · 손 · 그림자)별 InstancedMesh, 고정 발판은 한 덩어리(정점 색)
//     움직이는 발판 · 사라지는 발판 · 막대 · 망치 · 벽 · 공은 종류별 InstancedMesh
//   · 화질: high(PC — HDR 사진 환경광 · 그림자 2048) · mid(태블릿 — 그린 하늘 환경광 · 그림자 1024) · low(Lambert · 그림자 없음 · 입자 적게)
//   · 글자 · 막대 · 순위표는 위에 겹친 2D HUD 캔버스

const OB3_BODY = [0xFF4D5E, 0xFF9F1C, 0xFFD23F, 0x8BE04E, 0x2EC27E, 0x2EC4B6, 0x4CC9F0, 0x3A86FF, 0x8E5CF6, 0xFF6FB5, 0xB5835A, 0xF4F1EA];
const OB3_MAXP = 40;
const obLook = lk => ({ c: lk % 12, hat: (lk + 2 * Math.floor(lk / 12)) % 6 });
const obHex = n => '#' + (n >>> 0).toString(16).padStart(6, '0');

function obMerge(parts) {
  const T = THREE; let n = 0; const withUv = parts.every(p => p.g.attributes.uv);
  const gs = parts.map(p => { const g0 = p.g, g = g0.index ? g0.toNonIndexed() : g0; if (g !== g0) g0.dispose(); if (p.m) g.applyMatrix4(p.m); n += g.attributes.position.count; return g; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = withUv ? new Float32Array(n * 2) : null; let o = 0;
  gs.forEach((g, i) => { const c = parts[i].c, cnt = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); if (uv) uv.set(g.attributes.uv.array, o * 2);
    for (let k = 0; k < cnt; k++) { col[(o + k) * 3] = c[0]; col[(o + k) * 3 + 1] = c[1]; col[(o + k) * 3 + 2] = c[2]; } o += cnt; g.dispose(); });
  const out = new T.BufferGeometry(); out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.setAttribute('normal', new T.BufferAttribute(nor, 3)); out.setAttribute('color', new T.BufferAttribute(col, 3));
  if (uv) out.setAttribute('uv', new T.BufferAttribute(uv, 2)); out.computeBoundingSphere(); return out;
}
function obPart(g, x, y, z, c, rx, ry, rz, sx, sy, sz) { const m = new THREE.Matrix4(); m.makeRotationFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)); if (sx) m.scale(new THREE.Vector3(sx, sy || sx, sz || sx)); m.setPosition(x, y, z); return { g, m, c }; }
// 상자(위가 기울 수 있음) — 위치 · 법선 · uv(세계 크기) · 색을 배열에 쌓음
class ObBoxBuf {
  constructor() { this.p = []; this.n = []; this.u = []; this.c = []; }
  quad(a, b, c, d, nx, ny, nz, ua, ub, uc, ud, col) {   // a b c d 반시계
    const P = this.p, N = this.n, U = this.u, C = this.c;
    [a, b, c, a, c, d].forEach(v => P.push(v[0], v[1], v[2]));
    for (let i = 0; i < 6; i++) { N.push(nx, ny, nz); C.push(col[0], col[1], col[2]); }
    [ua, ub, uc, ua, uc, ud].forEach(t => U.push(t[0], t[1]));
  }
  box(x0, x1, z0, z1, bot, topA, topB, cTop, cSide, cBot) {
    if (topB == null) topB = topA;
    const A = [x0, topA, z0], B = [x1, topA, z0], Cc = [x1, topB, z1], D = [x0, topB, z1], a = [x0, bot, z0], b = [x1, bot, z0], c = [x1, bot, z1], d = [x0, bot, z1];
    const s = 0.5, dz = z1 - z0, dy = topB - topA, ln = Math.hypot(dz, dy) || 1;
    this.quad(D, Cc, B, A, 0, dz / ln, -dy / ln, [x0 * s, z1 * s], [x1 * s, z1 * s], [x1 * s, z0 * s], [x0 * s, z0 * s], cTop);   // 위
    this.quad(a, b, B, A, 0, 0, -1, [x0 * s, bot * s], [x1 * s, bot * s], [x1 * s, topA * s], [x0 * s, topA * s], cSide);       // 앞(−z)
    this.quad(c, d, D, Cc, 0, 0, 1, [x1 * s, bot * s], [x0 * s, bot * s], [x0 * s, topB * s], [x1 * s, topB * s], cSide);       // 뒤(+z)
    this.quad(d, a, A, D, -1, 0, 0, [z1 * s, bot * s], [z0 * s, bot * s], [z0 * s, topA * s], [z1 * s, topB * s], cSide);      // 왼쪽
    this.quad(b, c, Cc, B, 1, 0, 0, [z0 * s, bot * s], [z1 * s, bot * s], [z1 * s, topB * s], [z0 * s, topA * s], cSide);      // 오른쪽
    this.quad(a, d, c, b, 0, -1, 0, [0, 0], [0, 1], [1, 1], [1, 0], cBot || cSide);                                                // 아래
  }
  geo() { const T = THREE, g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(this.u, 2)); g.setAttribute('color', new T.Float32BufferAttribute(this.c, 3)); g.computeBoundingSphere(); return g; }
}
function obRR(c, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function obT(c, s, x, y, size, color, align, stroke, weight) {
  c.font = (weight || 800) + ' ' + Math.round(size) + 'px ' + OB_FONT; c.textAlign = align || 'center'; c.textBaseline = 'middle';
  if (stroke !== false) { c.lineWidth = Math.max(2, size * 0.22); c.strokeStyle = stroke || 'rgba(20,24,48,0.9)'; c.lineJoin = 'round'; c.strokeText(s, x, y); }
  c.fillStyle = color || '#fff'; c.fillText(s, x, y);
}
function obTF(c, s, x, y, size, maxW, color, align, stroke, weight) {
  let z = size; c.font = (weight || 800) + ' ' + Math.round(z) + 'px ' + OB_FONT; const w = c.measureText(s).width; if (w > maxW && w > 0) z = Math.max(8, z * maxW / w);
  obT(c, s, x, y, z, color, align, stroke, weight);
}

class ObstGame extends ObstCore {
  constructor(canvas, opts) {
    const host = canvas.parentElement, hud = document.createElement('canvas');
    hud.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2';
    host.appendChild(hud);
    super(opts);
    this.glCanvas = canvas; this.host = host; this.hudCanvas = hud; this.ctx = hud.getContext('2d');
    this.vw = host.clientWidth || 800; this.vh = host.clientHeight || 600; this.q = 2; this.drawAt = 0; this.guideAt = 0;
    this.touchUi = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
    this.anim = { ph: 0, air: 0, tilt: 0 }; this.camShake = new THREE.Vector3();
    this.initThree();
    this.resize();
  }
  tick(ts) {
    if (this._dead) return;
    this.step(ts);
    if (!this._lkT || this.now - this._lkT > 1000) { this._lkT = this.now; this.fixLook(); }
    if (!this.guideAt && this.phase === 'race' && !this.hidden) this.guideAt = this.now;
    this.draw();
  }
  // 늦게 와서 같은 모습이 겹치면: id 가 작은 쪽이 그대로, 나는 안 쓰인 모습 중 가장 앞 것
  fixLook() {
    const used = {}; let clash = false;
    for (const id in this.peers) { const p = this.peers[id]; if (p.gone || this.now - p.seen > 6000) continue; used[p.look] = 1; if (p.look === this.look && id < this.myId) clash = true; }
    if (!clash) return; for (let i = 0; i < 48; i++) { const lk = (this.slot + i) % 36; if (!used[lk]) { this.look = lk; return; } }
  }
  setQuality(q) {
    this.q = Math.max(0, Math.min(2, q | 0));
    if (this.renderer) { this.renderer.setPixelRatio(Math.min([0.75, 1.0, 1.25][this.q], this.opts.maxDpr || 1.25, window.devicePixelRatio || 1));
      const sh = this.q > 0 && this.hq !== 'low' && !this._shadowOff; if (this.renderer.shadowMap.enabled !== sh) { this.renderer.shadowMap.enabled = sh; if (this.sun) this.sun.castShadow = sh; this.scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); }); } }
    this.resize();
  }
  resize() {
    if (this._dead) return;
    const W = this.host.clientWidth || 800, H = this.host.clientHeight || 600; if (W < 10 || H < 10) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.hudCanvas.width = Math.round(W * dpr); this.hudCanvas.height = Math.round(H * dpr); this.hudDpr = dpr;
    this.vw = W; this.vh = H;
    if (this.renderer) { this.renderer.setSize(W, H, false); this.glCanvas.style.width = '100%'; this.glCanvas.style.height = '100%';
      const cam = this.camera, asp = W / H; cam.aspect = asp; cam.fov = asp < 0.8 ? 72 : asp < 1.2 ? 64 : 56; cam.updateProjectionMatrix(); this.portrait = asp < 1; }
  }
  captureTo(g, w, h) {
    if (!this.renderer || this._dead) return;
    this.renderer.render(this.scene, this.camera);
    g.drawImage(this.glCanvas, 0, 0, w, h);
    if (this.hudCanvas && this.hudCanvas.width) g.drawImage(this.hudCanvas, 0, 0, w, h);
  }
  destroy() {
    if (this._dead) return; this._dead = true;
    try { this.freeGL(); } catch (e) {}
    try { this.renderer.dispose(); } catch (e) {}
    try { if (this.hudCanvas.parentNode) this.hudCanvas.parentNode.removeChild(this.hudCanvas); } catch (e) {}
  }
  freeGL() {
    if (!this.scene) return; const seen = new Set();
    const tex = t => { if (t && t.isTexture && !seen.has(t)) { seen.add(t); t.dispose(); } };
    const free = root => root.traverse(o => {
      if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
      [].concat(o.material || []).forEach(m => { if (!m || seen.has(m)) return; seen.add(m); Object.keys(m).forEach(k => tex(m[k])); if (m.uniforms) Object.keys(m.uniforms).forEach(k => tex(m.uniforms[k].value)); m.dispose(); });
      if (o.isInstancedMesh && o.dispose) o.dispose();
      if (o.isLight && o.shadow && o.shadow.map) { o.shadow.map.dispose(); o.shadow.map = null; } });
    free(this.scene);
    if (this.scene.environment) this.scene.environment.dispose();
    Object.keys(this.tex || {}).forEach(k => tex(this.tex[k]));
  }

  // ══ 장면 ══
  col(hex, k) { const c = new THREE.Color(hex); if (k != null) c.multiplyScalar(k); if (this.lin) c.convertSRGBToLinear(); return c; }
  carr(hex, k) { const c = this.col(hex, k); return [c.r, c.g, c.b]; }
  mat(o) {   // 화질에 맞는 재질 (high · mid = 물리 기반 · low = Lambert)
    const T = THREE; const opt = Object.assign({}, o); const rough = opt.roughness, metal = opt.metalness, ei = opt.envMapIntensity; delete opt.roughness; delete opt.metalness; delete opt.envMapIntensity;
    const m = this.hq === 'low' ? new T.MeshLambertMaterial(opt) : new T.MeshStandardMaterial(Object.assign(opt, { envMapIntensity: ei == null ? 0.45 : ei, roughness: rough == null ? 0.6 : rough, metalness: metal == null ? 0 : metal }));
    m.userData.lin = true; if (m.color && this.lin && o.color != null) m.color.convertSRGBToLinear(); if (m.emissive && this.lin && o.emissive != null) m.emissive.convertSRGBToLinear();
    return m;
  }
  canvasTex(w, h, fn, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } t.anisotropy = 4; return t; }
  initThree() {
    const T = THREE;
    const r = this.renderer = new T.WebGLRenderer({ canvas: this.glCanvas, antialias: (window.devicePixelRatio || 1) < 2, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.opts.maxDpr || 1.25));
    this.hq = 'low'; this.hqLocked = false;
    if (window.ThreeQuality) { const pq = ThreeQuality.pick(r, this.opts); this.hq = pq.q; this.hqLocked = !!pq.locked; }
    this.lin = this.hq !== 'low';
    r.outputEncoding = this.lin ? T.sRGBEncoding : T.LinearEncoding; r.toneMapping = this.lin ? T.ACESFilmicToneMapping : T.NoToneMapping; r.toneMappingExposure = 0.95;
    const sc = this.scene = new T.Scene();
    sc.fog = new T.Fog(0xCFE6FF, 60, 190);
    this.camera = new T.PerspectiveCamera(60, 1, 0.3, 600);
    this.hemi = new T.HemisphereLight(0xEAF4FF, 0x8C7BB0, this.lin ? 0.34 : 0.85); sc.add(this.hemi);
    const sun = this.sun = new T.DirectionalLight(0xFFF1D6, this.lin ? 2.6 : 0.9); sun.position.set(-14, 30, -10); sc.add(sun); sc.add(sun.target);
    this.tmpM = new T.Matrix4(); this.tmpM2 = new T.Matrix4(); this.tmpM3 = new T.Matrix4(); this.tmpQ = new T.Quaternion(); this.tmpS = new T.Vector3(1, 1, 1); this.tmpP = new T.Vector3(); this.tmpE = new T.Euler(); this.tmpV = new T.Vector3(); this.tmpC = new T.Color(); this.dummy = new T.Object3D();
    this.makeTextures();
    this.buildSky();
    this.buildChars();
    this.buildFx();
    this.camPos = new T.Vector3(0, 6, -14); this.camLook = new T.Vector3(0, 1, 2); this.camSnap = true;
    if (this.lin) {
      // 그림자 · 색 (three-quality.js) — 태양은 나를 따라다님
      r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap; sun.castShadow = true;
      const sz = this.hq === 'high' ? 2048 : 1024; sun.shadow.mapSize.set(sz, sz); const c = sun.shadow.camera, hh = 18; c.left = -hh; c.right = hh; c.top = hh; c.bottom = -hh; c.near = 1; c.far = 90;
      sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; this.sunOffset = sun.position.clone(); sun.color.convertSRGBToLinear(); this.hemi.color.convertSRGBToLinear(); this.hemi.groundColor.convertSRGBToLinear();
      this.makeEnv();
    }
    this.buildCourse();
  }
  makeTextures() {
    const tx = this.tex = {};
    // 발판 윗면: 둥근 타일 (흰 바탕 · 색은 정점 색이 곱해짐)
    tx.tile = this.canvasTex(128, 128, (g, w) => { g.fillStyle = '#d9d9e6'; g.fillRect(0, 0, w, w); const gr = g.createLinearGradient(0, 0, w, w); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#eeeef6');
      g.fillStyle = gr; obRR(g, 5, 5, w - 10, w - 10, 18); g.fill(); g.fillStyle = 'rgba(255,255,255,0.7)'; obRR(g, 14, 12, w - 46, 14, 7); g.fill(); }, true);
    // 컨베이어: 화살표 줄무늬
    const conv = (g, w, h) => { g.fillStyle = '#3b3f58'; g.fillRect(0, 0, w, h); g.strokeStyle = '#FFD23F'; g.lineWidth = 14; g.lineCap = 'round';
      for (let k = 0; k < 2; k++) { const y = h * (0.3 + k * 0.5); g.beginPath(); g.moveTo(w * 0.18, y + 18); g.lineTo(w * 0.5, y - 14); g.lineTo(w * 0.82, y + 18); g.stroke(); } };
    tx.convF = this.canvasTex(64, 128, conv, true); tx.convB = this.canvasTex(64, 128, conv, true);
    tx.convB.rotation = Math.PI; tx.convB.center.set(0.5, 0.5);
    // 줄무늬 (막대 · 벽)
    tx.stripe = this.canvasTex(128, 32, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff4d6d'; for (let i = -1; i < 5; i++) { g.beginPath(); g.moveTo(i * 32, h); g.lineTo(i * 32 + 16, h); g.lineTo(i * 32 + 32, 0); g.lineTo(i * 32 + 16, 0); g.fill(); } }, true);
    // 결승 체크무늬
    tx.check = this.canvasTex(128, 32, (g, w, h) => { for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#1d1f33' : '#ffffff'; g.fillRect(i * 16, j * 16, 16, 16); } }, true);
    // 점프대: 위 화살표
    tx.pad = this.canvasTex(64, 64, (g, w) => { g.fillStyle = '#FFC300'; g.fillRect(0, 0, w, w); g.strokeStyle = '#fff6c9'; g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(14, 40); g.lineTo(32, 20); g.lineTo(50, 40); g.stroke(); });
    // 입자: 부드러운 점 · 별
    tx.dot = this.canvasTex(64, 64, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
    tx.star = this.canvasTex(64, 64, (g, w) => { g.translate(w / 2, w / 2); g.fillStyle = '#fff'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? 11 : 28; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.fill(); });
    tx.blob = this.canvasTex(64, 64, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
    // 구름 바다
    tx.cloud = this.canvasTex(256, 256, (g, w) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, w); const rr = obRng(91);
      for (let i = 0; i < 70; i++) { const x = rr() * w, y = rr() * w, s = 20 + rr() * 50, gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, 'rgba(196,214,240,0.5)'); gr.addColorStop(1, 'rgba(196,214,240,0)'); g.fillStyle = gr;
        for (const ox of [-w, 0, w]) for (const oy of [-w, 0, w]) { g.save(); g.translate(ox, oy); g.fillRect(x - s, y - s, s * 2, s * 2); g.restore(); } } }, true);
    // 결승 · 출발 글자 현수막
    const banner = (txt, bg) => this.canvasTex(512, 96, (g, w, h) => { g.fillStyle = bg; obRR(g, 0, 0, w, h, 26); g.fill(); g.font = '900 64px ' + OB_FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,0.25)'; g.strokeText(txt, w / 2, h / 2 + 3); g.fillStyle = '#fff'; g.fillText(txt, w / 2, h / 2 + 3); });
    tx.finTxt = banner('🏁 결승 FINISH', '#8E5CF6'); tx.startTxt = banner('출발 START', '#FF4D8D');
  }
  // 하늘: 큰 공 안쪽에 그라데이션 + 해 (안개 없음) · 구름 바다 · 떠 있는 구름
  buildSky() {
    const T = THREE, sc = this.scene;
    this.skyU = { top: { value: new T.Color(0x4C9DF0) }, hor: { value: new T.Color(0xCDE9FF) }, sunDir: { value: new T.Vector3(-0.35, 0.6, 0.72).normalize() } };
    const skyMat = new T.ShaderMaterial({ uniforms: this.skyU, side: T.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz - cameraPosition; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; varying vec3 vW; void main(){ vec3 d = normalize(vW); float h = clamp(d.y, 0.0, 1.0);' +
        ' vec3 c = mix(hor, top, pow(h, 0.5)); c = mix(c, hor * vec3(0.96,0.97,1.0), smoothstep(0.0, -0.25, d.y)); float s = max(dot(d, sunDir), 0.0);' +
        ' c += vec3(1.0, 0.93, 0.75) * (pow(s, 900.0) * 1.6 + pow(s, 12.0) * 0.22); gl_FragColor = vec4(c, 1.0); }' });
    const sky = this.sky = new T.Mesh(new T.SphereGeometry(500, 24, 12), skyMat); sky.renderOrder = -1; sky.frustumCulled = false; sky.userData.noShadow = true; sc.add(sky);
    const sea = this.sea = new T.Mesh(new T.PlaneGeometry(1400, 1400), this.mat({ map: this.tex.cloud, color: 0xffffff, roughness: 1, emissive: 0x99aacc, emissiveIntensity: 0.35 }));
    this.tex.cloud.repeat.set(9, 9); sea.rotation.x = -Math.PI / 2; sea.position.y = -38; sea.userData.noShadow = true; sc.add(sea);
    // 떠 있는 구름 (공 5개씩 · 인스턴스 하나)
    const n = this.hq === 'low' ? 40 : 80, cg = new T.IcosahedronGeometry(1, this.hq === 'low' ? 0 : 1);
    const cm = this.clouds = new T.InstancedMesh(cg, this.mat({ color: 0xffffff, roughness: 0.95, emissive: 0xb8c8e8, emissiveIntensity: 0.45 }), n); cm.userData.noShadow = true; sc.add(cm);
    this.cloudN = n;
  }
  placeClouds() {
    const C = this.course, rr = obRng(C.seedI + 5), n = this.cloudN, M = this.tmpM; let i = 0;
    while (i < n) { const side = rr() < 0.5 ? -1 : 1, cx = side * (C.W / 2 + 14 + rr() * 50), cz = -30 + rr() * (C.len + 80), cy = -18 + rr() * 30, s = 3 + rr() * 5;
      for (let k = 0; k < 5 && i < n; k++, i++) { const ss = s * (0.6 + rr() * 0.6); this.tmpP.set(cx + (rr() - 0.5) * s * 2.2, cy + (rr() - 0.3) * s * 0.6, cz + (rr() - 0.5) * s * 1.6); this.tmpQ.set(0, 0, 0, 1); this.tmpS.set(ss * 1.3, ss * 0.8, ss); M.compose(this.tmpP, this.tmpQ, this.tmpS); this.clouds.setMatrixAt(i, M); } }
    this.clouds.instanceMatrix.needsUpdate = true;
  }
  // 환경광(반사): mid = 그린 하늘을 PMREM 으로 · high = HDR 사진(assets/hdr, CC0) 을 받으면 바꿈
  makeEnv() {
    const T = THREE, r = this.renderer;
    try { const es = new T.Scene(), g = new T.SphereGeometry(10, 24, 12), cols = [], pos = g.attributes.position;
      const top = new T.Color(0x4C9DF0).convertSRGBToLinear(), hor = new T.Color(0xE8F4FF).convertSRGBToLinear(), gnd = new T.Color(0xB9C6DE).convertSRGBToLinear();
      for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 10, c = y > 0 ? hor.clone().lerp(top, Math.pow(y, 0.6)) : hor.clone().lerp(gnd, Math.min(1, -y * 2)); cols.push(c.r * 1.3, c.g * 1.3, c.b * 1.3); }
      g.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
      es.add(new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
      const sunM = new T.Mesh(new T.SphereGeometry(1.2, 8, 6), new T.MeshBasicMaterial({ color: new T.Color(14, 12, 9) })); sunM.position.set(-3.5, 6, -7); es.add(sunM);
      const pm = new T.PMREMGenerator(r); this.envRT = pm.fromScene(es, 0.02); this.scene.environment = this.envRT.texture; pm.dispose();
      es.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    } catch (e) {}
    if (this.hq !== 'high') return;
    const load = src => new Promise((res, rej) => { if (window.THREE && THREE.RGBELoader) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    load('lib/RGBELoader.js').then(() => new Promise(res => new THREE.RGBELoader().setDataType(THREE.UnsignedByteType).load('assets/hdr/quarry_01_1k.hdr', res, undefined, () => res(null)))).then(tex => {
      if (!tex || this._dead) { if (tex) tex.dispose(); return; }
      tex.mapping = THREE.EquirectangularReflectionMapping; const pm = new THREE.PMREMGenerator(this.renderer), rt = pm.fromEquirectangular(tex); pm.dispose(); tex.dispose();
      if (this.envRT) this.envRT.dispose(); this.envRT = rt; this.scene.environment = rt.texture; this.hdr = true;
    }).catch(() => {});
  }

  // ── 캐릭터 (부품별 인스턴스) ──
  buildChars() {
    const T = THREE, sc = this.scene, W = [1, 1, 1], D = [0.12, 0.12, 0.16], N = OB3_MAXP;
    const prof = [[0, 0.14], [0.22, 0.16], [0.36, 0.3], [0.42, 0.52], [0.41, 0.78], [0.35, 0.98], [0.22, 1.12], [0, 1.18]].map(p => new T.Vector2(p[0], p[1]));
    const bodyG = new T.LatheGeometry(prof, this.hq === 'low' ? 10 : 16);
    const charMat = this.mat({ vertexColors: true, roughness: 0.32, metalness: 0.05, envMapIntensity: 0.3 });
    const inst = (g, mat, n) => { const m = new T.InstancedMesh(g, mat, n); m.instanceColor = new T.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3); m.count = 0; m.frustumCulled = false; m.castShadow = this.lin; m.receiveShadow = false; sc.add(m); return m; };
    const bodyGeo = obMerge([{ g: bodyG, c: W }, obPart(new T.SphereGeometry(0.2, 10, 8), 0, 0.5, 0.25, [1, 1, 1], 0, 0, 0, 1, 1.2, 0.6)]);   // 배 무늬(같은 색 — 볼록)
    this.mBody = inst(bodyGeo, charMat, N);
    const eyeW = obMerge([obPart(new T.SphereGeometry(0.115, 10, 8), -0.14, 0.86, 0.3, W), obPart(new T.SphereGeometry(0.115, 10, 8), 0.14, 0.86, 0.3, W)]);
    const eyeB = obMerge([obPart(new T.SphereGeometry(0.062, 8, 6), -0.14, 0.87, 0.4, D), obPart(new T.SphereGeometry(0.062, 8, 6), 0.14, 0.87, 0.4, D),
      obPart(new T.SphereGeometry(0.02, 6, 4), -0.12, 0.9, 0.455, W), obPart(new T.SphereGeometry(0.02, 6, 4), 0.16, 0.9, 0.455, W)]);
    this.mEyeW = inst(eyeW, this.mat({ color: 0xffffff, roughness: 0.2 }), N); this.mEyeB = inst(eyeB, this.mat({ vertexColors: true, roughness: 0.15 }), N);
    // 모자 6종 (흰 부분 = 모자 색으로 물듦)
    const G = [0.18, 0.18, 0.2];
    const hats = [
      obMerge([obPart(new T.ConeGeometry(0.22, 0.48, 12), 0, 1.36, 0, W, -0.08), obPart(new T.SphereGeometry(0.08, 8, 6), 0, 1.6, -0.02, W)]),
      obMerge([obPart(new T.CylinderGeometry(0.2, 0.2, 0.34, 14), 0, 1.32, 0, W), obPart(new T.CylinderGeometry(0.33, 0.33, 0.04, 16), 0, 1.15, 0, W), obPart(new T.CylinderGeometry(0.205, 0.205, 0.07, 14), 0, 1.2, 0, G)]),
      obMerge([obPart(new T.SphereGeometry(0.3, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 1.0, 0, W), obPart(new T.BoxGeometry(0.4, 0.035, 0.26), 0, 1.03, 0.3, W)]),
      obMerge([obPart(new T.CylinderGeometry(0.06, 0.07, 0.42, 8), -0.12, 1.34, 0, W, 0, 0, 0.18), obPart(new T.CylinderGeometry(0.06, 0.07, 0.42, 8), 0.12, 1.34, 0, W, 0, 0, -0.18),
        obPart(new T.SphereGeometry(0.06, 8, 6), -0.16, 1.55, 0, W), obPart(new T.SphereGeometry(0.06, 8, 6), 0.16, 1.55, 0, W)]),
      obMerge([obPart(new T.CylinderGeometry(0.22, 0.2, 0.16, 12, 1, true), 0, 1.14, 0, W)].concat([0, 1, 2, 3, 4].map(i => obPart(new T.ConeGeometry(0.055, 0.15, 6), Math.sin(i * 1.2566) * 0.21, 1.27, Math.cos(i * 1.2566) * 0.21, W)))
        .concat([obPart(new T.SphereGeometry(0.04, 6, 4), 0, 1.16, 0.22, [1, 0.25, 0.4])])),
      obMerge([obPart(new T.SphereGeometry(0.29, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 1.02, 0, W), obPart(new T.CylinderGeometry(0.02, 0.02, 0.14, 6), 0, 1.36, 0, G), obPart(new T.BoxGeometry(0.5, 0.025, 0.07), 0, 1.43, 0, W, 0, 0.5)])
    ];
    const hatMat = this.mat({ vertexColors: true, roughness: 0.45, side: T.DoubleSide });
    this.mHat = hats.map(g => inst(g, hatMat, N));
    this.mFoot = inst(new T.SphereGeometry(0.13, 10, 6), this.mat({ color: 0xffffff, roughness: 0.5 }), N * 2);
    this.mHand = inst(new T.SphereGeometry(0.1, 8, 6), charMat, N * 2);
    const bm = new T.MeshBasicMaterial({ map: this.tex.blob, transparent: true, depthWrite: false, opacity: 0.85 }); bm.userData.lin = true;
    const bg = new T.PlaneGeometry(1, 1); bg.rotateX(-Math.PI / 2);
    this.mBlob = new T.InstancedMesh(bg, bm, N); this.mBlob.count = 0; this.mBlob.frustumCulled = false; this.mBlob.renderOrder = 2; sc.add(this.mBlob);
    this.cBody = OB3_BODY.map(h => this.col(h)); this.cFoot = OB3_BODY.map(h => this.col(h, 0.55)); this.cHat = OB3_BODY.map((h, i) => this.col(OB3_BODY[(i + 6) % 12]));
    this.cGhost = this.col(0xB8BCC8);
    // 이 장면은 카메라에 가까운 일부만 → 꼭 필요한 것만 그림자
    this.mBody.castShadow = this.lin; this.mHat.forEach(m => { m.castShadow = this.lin; });
  }
  buildFx() {
    const T = THREE, sc = this.scene;
    const mk = (n, tex, add) => { const g = new T.BufferGeometry(), pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) pos[i * 3 + 1] = -999;
      g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3));
      const m = new T.PointsMaterial({ size: add ? 0.55 : 0.7, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending, sizeAttenuation: true });
      m.userData.lin = true; const p = new T.Points(g, m); p.frustumCulled = false; p.renderOrder = 3; sc.add(p);
      return { p, pos, col, n, list: [], next: 0 }; };
    const lo = this.hq === 'low';
    this.pDust = mk(lo ? 60 : 160, this.tex.dot, true); this.pStar = mk(lo ? 60 : 180, this.tex.star, true);
    // 둥둥 떠 있는 반짝이 (카메라 근처)
    const na = lo ? 0 : 60; this.amb = null;
    if (na) { const g = new T.BufferGeometry(), pos = new Float32Array(na * 3), rr = obRng(5); for (let i = 0; i < na * 3; i++) pos[i] = (rr() - 0.5) * 40; g.setAttribute('position', new T.BufferAttribute(pos, 3));
      const m = new T.PointsMaterial({ size: 0.18, map: this.tex.dot, color: 0xFFF4C8, transparent: true, opacity: 0.8, depthWrite: false, blending: T.AdditiveBlending }); m.userData.lin = true;
      this.amb = new T.Points(g, m); this.amb.frustumCulled = false; sc.add(this.amb); }
  }
  emit(sys, x, y, z, vx, vy, vz, life, hex, grav) {
    const i = sys.next; sys.next = (sys.next + 1) % sys.n; const c = this.col(hex);
    sys.list[i] = { x, y, z, vx, vy, vz, t: 0, life, g: grav == null ? 9 : grav, c };
  }
  spawnFx(f) {
    const r = Math.random, x = f.x, y = f.y, z = f.z, lo = this.hq === 'low' ? 0.5 : 1;
    if (f.kind === 'dust') for (let i = 0; i < 8 * lo; i++) { const a = r() * 6.28; this.emit(this.pDust, x, y + 0.1, z, Math.cos(a) * 2, 0.6 + r(), Math.sin(a) * 2, 0.5 + r() * 0.3, 0xF4F0FF, -1); }
    else if (f.kind === 'stars') for (let i = 0; i < 10 * lo; i++) { const a = r() * 6.28; this.emit(this.pStar, x, y, z, Math.cos(a) * 3, 2 + r() * 3, Math.sin(a) * 3, 0.7, [0xFFE066, 0xFFFFFF, 0xFF9AD5][i % 3], 6); }
    else if (f.kind === 'confetti') for (let i = 0; i < 40 * lo; i++) { const a = r() * 6.28, s = 2 + r() * 4; this.emit(this.pStar, x, y, z, Math.cos(a) * s, 5 + r() * 6, Math.sin(a) * s, 1.4, OB3_BODY[i % 12], 9); }
    else if (f.kind === 'ring') for (let i = 0; i < 18 * lo; i++) { const a = i / 18 * 6.28; this.emit(this.pStar, x + Math.cos(a) * 0.8, y + 0.2, z + Math.sin(a) * 0.8, Math.cos(a) * 3, 2.5, Math.sin(a) * 3, 0.8, 0x7CFFB2, 3); }
    else if (f.kind === 'pop') for (let i = 0; i < 16 * lo; i++) { const a = r() * 6.28, b = r() * 3.14; this.emit(this.pDust, x, y, z, Math.cos(a) * Math.sin(b) * 4, Math.cos(b) * 4, Math.sin(a) * Math.sin(b) * 4, 0.6, 0xFFFFFF, 0); }
  }
  updateParticles(dt) {
    for (const f of this.fx) if (!f.done) { f.done = true; this.spawnFx(f); }
    [this.pDust, this.pStar].forEach(sys => { const P = sys.pos, Cc = sys.col;
      for (let i = 0; i < sys.n; i++) { const q = sys.list[i]; if (!q) continue; q.t += dt; if (q.t >= q.life) { sys.list[i] = null; P[i * 3 + 1] = -999; continue; }
        q.vy -= q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vx *= 0.97; q.vz *= 0.97;
        P[i * 3] = q.x; P[i * 3 + 1] = q.y; P[i * 3 + 2] = q.z; const k = 1 - q.t / q.life; Cc[i * 3] = q.c.r * k; Cc[i * 3 + 1] = q.c.g * k; Cc[i * 3 + 2] = q.c.b * k; }
      sys.p.geometry.attributes.position.needsUpdate = true; sys.p.geometry.attributes.color.needsUpdate = true; });
    if (this.amb) { const P = this.amb.geometry.attributes.position.array, cx = this.camPos.x, cy = this.camPos.y, cz = this.camPos.z, t = this.now / 1000;
      for (let i = 0; i < P.length; i += 3) { P[i + 1] += dt * 0.3; let dx = P[i] - cx, dy = P[i + 1] - cy, dz = P[i + 2] - cz;
        if (dx > 20) P[i] -= 40; else if (dx < -20) P[i] += 40; if (dy > 12) P[i + 1] -= 24; else if (dy < -12) P[i + 1] += 24; if (dz > 25) P[i + 2] -= 50; else if (dz < -25) P[i + 2] += 50; P[i] += Math.sin(t + i) * dt * 0.2; }
      this.amb.geometry.attributes.position.needsUpdate = true; }
  }

  // ── 코스 모형 (코스가 바뀔 때마다 새로) ──
  buildCourse() {
    const T = THREE, C = this.course, th = C.theme, sc = this.scene;
    if (this.cg) { sc.remove(this.cg); this.cg.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.isInstancedMesh && o.dispose) o.dispose(); }); }
    const g = this.cg = new T.Group(); sc.add(g); this.built = C;
    // 하늘 · 안개 색
    this.skyU.top.value.set(th.sky[0]); this.skyU.hor.value.set(th.sky[1]); sc.fog.color.set(th.fog); if (this.lin) sc.fog.color.convertSRGBToLinear();
    const shadowy = (m, cast) => { m.receiveShadow = this.lin; m.castShadow = this.lin && !!cast; return m; };
    if (!this.cm) {   // 재질은 한 번만 (코스마다 다시 만들지 않음)
      this.cm = { plat: this.mat({ vertexColors: true, map: this.tex.tile, roughness: 0.5, metalness: 0.02 }),
        ice: this.mat({ vertexColors: true, map: this.tex.tile, roughness: 0.05, metalness: 0.15, transparent: true, opacity: 0.9 }),
        convF: this.mat({ map: this.tex.convF, color: 0xffffff, roughness: 0.7 }), convB: this.mat({ map: this.tex.convB, color: 0xffffff, roughness: 0.7 }),
        pad: this.mat({ map: this.tex.pad, color: 0xffffff, emissive: 0xFFB000, emissiveIntensity: 0.5, roughness: 0.35 }),
        dyn: this.mat({ color: 0xffffff, map: this.tex.tile, roughness: 0.45 }), stripe: this.mat({ map: this.tex.stripe, color: 0xffffff, roughness: 0.3, metalness: 0.1 }),
        metal: this.mat({ color: 0xC9D2E3, roughness: 0.25, metalness: 0.8 }), ball: this.mat({ vertexColors: true, roughness: 0.25, metalness: 0.0 }),
        deco: this.mat({ vertexColors: true, roughness: 0.4, metalness: 0.05 }), check: this.mat({ map: this.tex.check, color: 0xffffff, roughness: 0.5 }),
        finTxt: new T.MeshBasicMaterial({ map: this.tex.finTxt, transparent: true }), startTxt: new T.MeshBasicMaterial({ map: this.tex.startTxt, transparent: true }),
        bump: this.mat({ color: 0xFF7AB6, roughness: 0.3, emissive: 0x401028, emissiveIntensity: 0.4 }) };
      this.cm.finTxt.userData.lin = true; this.cm.startTxt.userData.lin = true;
    }
    const M = this.cm, plat = new ObBoxBuf(), ice = new ObBoxBuf(), convF = new ObBoxBuf(), convB = new ObBoxBuf(), pad = new ObBoxBuf(), deco = [];
    const pc = i => th.plat[i % th.plat.length], lip = this.carr(0xffffff, 0.98);
    C.plats.forEach(p => {
      if (p.kind === 4 || p.kind === 5) return;
      const topA = p.kind === 6 ? p.y0 : p.top, topB = p.kind === 6 ? p.y1 : p.top;
      if (p.kind === 2) { (p.cvz < 0 ? convB : convF).box(p.x0, p.x1, p.z0, p.z1, p.bot, topA, topB, this.carr(0xffffff), this.carr(0x9aa0c0), this.carr(0x555a78)); return; }
      if (p.kind === 3) { pad.box(p.x0, p.x1, p.z0, p.z1, p.bot, topA, topB, this.carr(0xffffff), this.carr(0xffffff, 0.8)); return; }
      const isIce = p.ice || p.kind === 1, hex = isIce ? 0xCFF1FF : p.fin ? 0xFFE7A0 : pc(p.col), buf = isIce ? ice : plat;
      buf.box(p.x0, p.x1, p.z0, p.z1, p.bot, topA, topB, this.carr(hex), this.carr(hex, 0.62), this.carr(hex, 0.35));
      if (!isIce && !p.beam && (p.x1 - p.x0) > 2.5) {   // 윗면 가장자리 흰 테두리
        const e = 0.16; plat.box(p.x0 - 0.02, p.x0 + e, p.z0, p.z1, topA - 0.25, topA + 0.05, topB + 0.05, lip, lip); plat.box(p.x1 - e, p.x1 + 0.02, p.z0, p.z1, topA - 0.25, topA + 0.05, topB + 0.05, lip, lip); }
    });
    const add = (buf, mat, cast) => { if (!buf.p.length) return null; const m = shadowy(new T.Mesh(buf.geo(), mat), cast); g.add(m); return m; };
    add(plat, M.plat, true); add(ice, M.ice, false); add(convF, M.convF); add(convB, M.convB); add(pad, M.pad);
    this.tex.convF.repeat.set(1, 0.5); this.tex.convB.repeat.set(1, 0.5);
    // 결승선 체크무늬 · 아치 · 출발 아치
    const W = C.W, tc = [1, 1, 1];
    const fl = new T.Mesh(new T.PlaneGeometry(W + 3, 1.2), M.check); fl.rotation.x = -Math.PI / 2; fl.position.set(0, C.finTop + 0.02, C.finishZ); this.tex.check.repeat.set((W + 3) / 2.4, 1); shadowy(fl); g.add(fl);
    const arch = (z, y, w, hex, txtMat, h) => { const c = this.carr(hex), c2 = this.carr(0xffffff);
      deco.push(obPart(new T.CylinderGeometry(0.42, 0.5, h, 12), -w / 2 - 0.8, y + h / 2, z, c), obPart(new T.CylinderGeometry(0.42, 0.5, h, 12), w / 2 + 0.8, y + h / 2, z, c),
        obPart(new T.BoxGeometry(w + 2.6, 1.0, 0.7), 0, y + h, z, c), obPart(new T.SphereGeometry(0.6, 12, 8), -w / 2 - 0.8, y + h + 0.3, z, c2), obPart(new T.SphereGeometry(0.6, 12, 8), w / 2 + 0.8, y + h + 0.3, z, c2));
      const tw = Math.min(w * 0.8, 7), tm = new T.Mesh(new T.PlaneGeometry(tw, tw * 96 / 512), txtMat); tm.position.set(0, y + h, z - 0.37); tm.rotation.y = Math.PI; g.add(tm); };
    arch(C.finishZ, C.finTop, W + 1, 0x8E5CF6, M.finTxt, 5.6); arch(C.startLine + 0.5, 0, W + 1.2, 0xFF4D8D, M.startTxt, 7.6);
    // 체크포인트 깃발
    C.cps.forEach((cp, i) => { if (!i) return; const x = cp.x1 + 0.25; deco.push(obPart(new T.CylinderGeometry(0.06, 0.06, 2.6, 6), x, cp.top + 1.3, cp.z, this.carr(0xffffff)), obPart(new T.BoxGeometry(0.05, 0.6, 0.9), x, cp.top + 2.25, cp.z + 0.45, this.carr(0x2EC27E)));
      const x2 = cp.x0 - 0.25; deco.push(obPart(new T.CylinderGeometry(0.06, 0.06, 2.6, 6), x2, cp.top + 1.3, cp.z, this.carr(0xffffff)), obPart(new T.BoxGeometry(0.05, 0.6, 0.9), x2, cp.top + 2.25, cp.z + 0.45, this.carr(0x2EC27E))); });
    // 망치 지지대
    C.obs.forEach(o => { if (o.type !== 'hammer') return; const half = W * 0.36 + 0.6, c = this.carr(0x7B61FF), y0 = o.py - o.L - 1.0;
      deco.push(obPart(new T.BoxGeometry(0.35, o.py - y0 + 0.3, 0.35), -half, (o.py + y0) / 2, o.pz, c), obPart(new T.BoxGeometry(0.35, o.py - y0 + 0.3, 0.35), half, (o.py + y0) / 2, o.pz, c),
        obPart(new T.BoxGeometry(half * 2 + 0.4, 0.35, 0.35), 0, o.py + 0.15, o.pz, c)); });
    if (deco.length) { const m = shadowy(new T.Mesh(obMerge(deco), M.deco), true); g.add(m); }
    // 움직이는 것들 (종류별 인스턴스)
    const tiles = C.plats.filter(p => p.kind === 4), movers = C.plats.filter(p => p.kind === 5);
    const box = new T.BoxGeometry(1, 1, 1);
    const im = (geo, mat, n, cast) => { if (!n) return null; const m = new T.InstancedMesh(geo, mat, n); m.frustumCulled = false; shadowy(m, cast); g.add(m); return m; };
    this.dTiles = im(box, M.dyn, tiles.length, true); this.tiles = tiles; this.tileCol = tiles.map(p => this.col(pc(p.col)));
    this.dMovers = im(box, M.dyn, movers.length, true); this.movers = movers;
    if (this.dMovers) movers.forEach((p, i) => this.dMovers.setColorAt(i, this.col(pc(p.col + 1))));
    if (this.dTiles) tiles.forEach((p, i) => this.dTiles.setColorAt(i, this.tileCol[i]));
    const sweeps = C.obs.filter(o => o.type === 'sweep' && !o.hub), hubs = C.obs.filter(o => o.type === 'sweep' && o.hub), hams = C.obs.filter(o => o.type === 'hammer'), walls = C.obs.filter(o => o.type === 'wall'), bumps = C.obs.filter(o => o.type === 'bump'), bobs = C.obs.filter(o => o.type === 'balls');
    const barG = new T.CylinderGeometry(0.34, 0.34, 1, 12, 1); barG.rotateZ(Math.PI / 2);
    this.dBars = im(barG, M.stripe, sweeps.length, true); this.sweeps = sweeps;
    this.dHubs = im(new T.CylinderGeometry(0.72, 0.85, 1.6, 16), M.metal, hubs.length, true); this.hubs = hubs;
    if (this.dHubs) hubs.forEach((o, i) => { this.tmpP.set(o.cx, o.y + 0.8, o.cz); this.tmpQ.set(0, 0, 0, 1); this.tmpS.set(1, 1, 1); this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS); this.dHubs.setMatrixAt(i, this.tmpM); });
    const armG = new T.CylinderGeometry(0.09, 0.09, 1, 6); armG.translate(0, -0.5, 0);
    const headG = new T.CylinderGeometry(1.0, 1.0, 1.7, 18); headG.rotateX(Math.PI / 2);
    this.dArms = im(armG, M.metal, hams.length, false); this.dHeads = im(headG, M.stripe, hams.length, true); this.hams = hams;
    this.dWalls = im(box, M.stripe, walls.length, true); this.walls = walls;
    this.dBumps = im(new T.CylinderGeometry(0.85, 0.95, 1.2, 16), M.bump, bumps.length, true); this.bumps = bumps;
    if (this.dBumps) bumps.forEach((o, i) => { const top = C.topAt(C.plats[o.ramp], o.z); this.tmpP.set(o.x, top + 0.6, o.z); this.tmpQ.set(0, 0, 0, 1); this.tmpS.set(1, 1, 1); this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS); this.dBumps.setMatrixAt(i, this.tmpM); });
    // 공: 비치볼 색 (경도 6조각)
    this.bobs = bobs; this.dBalls = null;
    if (bobs.length) { const sg = new T.SphereGeometry(1, this.hq === 'low' ? 12 : 20, this.hq === 'low' ? 8 : 14), pos = sg.attributes.position, cols = [], pal = [0xFF4D5E, 0xFFFFFF, 0x3A86FF, 0xFFFFFF, 0xFFD23F, 0xFFFFFF].map(h => this.col(h));
      for (let i = 0; i < pos.count; i++) { const a = Math.atan2(pos.getZ(i), pos.getY(i)), k = Math.floor(((a + Math.PI) / (2 * Math.PI)) * 6) % 6, c = Math.abs(pos.getX(i)) > 0.93 ? pal[1] : pal[k]; cols.push(c.r, c.g, c.b); }
      sg.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); this.dBalls = im(sg, M.ball, 24, true); }
    // 출발 막대 (출발 전에만)
    this.gate = new T.Mesh(new T.BoxGeometry(W + 2.4, 0.3, 0.3), M.stripe); this.gate.position.set(0, 1.0, C.startLine + 0.1); shadowy(this.gate, true); g.add(this.gate);
    this.placeClouds();
    this.sea.position.set(0, -38, C.len / 2);
  }
  // 매 프레임: 움직이는 것들
  updateCourse(T, dt) {
    const C = this.course, M = this.tmpM, P = this.tmpP, Q = this.tmpQ, S = this.tmpS;
    const fin = m => { if (m) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; } };
    if (this.dTiles) { const warnC = this.tmpC; this.tiles.forEach((p, i) => { const u = C.tilePhase(p, T); let s = 1, y = p.top - 0.25, c = this.tileCol[i];
        if (u >= 0.62) { const a = Math.min(1, (u - 0.62) / 0.05), b = Math.max(0, (u - 0.95) / 0.05); s = Math.max(0.001, 1 - a + b); y -= (1 - s) * 1.2; }
        else if (u >= 0.42) { const fl = Math.floor((u - 0.42) / 0.2 * 8) % 2; warnC.copy(c).lerp(this.cWarn || (this.cWarn = this.col(0xFF3B3B)), fl ? 0.85 : 0.25); c = warnC; y -= fl ? 0.04 : 0; }
        P.set((p.x0 + p.x1) / 2, y, (p.z0 + p.z1) / 2); Q.set(0, 0, 0, 1); S.set((p.x1 - p.x0) * s, 0.5 * Math.max(0.2, s), (p.z1 - p.z0) * s); M.compose(P, Q, S); this.dTiles.setMatrixAt(i, M); this.dTiles.setColorAt(i, c); }); fin(this.dTiles); }
    if (this.dMovers) { this.movers.forEach((p, i) => { const ox = C.offX(p, T); P.set((p.x0 + p.x1) / 2 + ox, p.top - 0.25, (p.z0 + p.z1) / 2); Q.set(0, 0, 0, 1); S.set(p.x1 - p.x0, 0.5, p.z1 - p.z0); M.compose(P, Q, S); this.dMovers.setMatrixAt(i, M); }); fin(this.dMovers); }
    if (this.dBars) { this.sweeps.forEach((o, i) => { const a = C.sweepAng(o, T); P.set(o.cx, o.y + 0.6, o.cz); this.tmpE.set(0, -a, 0); Q.setFromEuler(this.tmpE); S.set(o.R * 2, 1, 1); M.compose(P, Q, S); this.dBars.setMatrixAt(i, M); }); fin(this.dBars); }
    if (this.dHeads) { const hp = {}; this.hams.forEach((o, i) => { C.hammerPos(o, T, hp); this.tmpE.set(0, 0, hp.th); Q.setFromEuler(this.tmpE);
        P.set(o.px, o.py, o.pz); S.set(1, o.L, 1); M.compose(P, Q, S); this.dArms.setMatrixAt(i, M); P.set(hp.x, hp.y, hp.z); S.set(1, 1, 1); M.compose(P, Q, S); this.dHeads.setMatrixAt(i, M); }); fin(this.dArms); fin(this.dHeads); }
    if (this.dWalls) { this.walls.forEach((o, i) => { P.set(C.wallX(o, T), o.y + o.h / 2, o.cz); Q.set(0, 0, 0, 1); S.set(o.hx * 2, o.h, o.hz * 2); M.compose(P, Q, S); this.dWalls.setMatrixAt(i, M); }); fin(this.dWalls); }
    if (this.dBalls) { let n = 0; const tmp = this._bl || (this._bl = []); this.bobs.forEach(o => { C.balls(o, T, tmp); tmp.forEach(b => { if (n >= 24) return;
          const pop = Math.max(0, (b.a - (b.life - 0.25)) / 0.25), s = b.r * (1 - pop * 0.9) * Math.min(1, b.a / 0.2 + 0.2);
          P.set(b.x, b.y, b.z); this.tmpE.set(-b.roll, 0, 0); Q.setFromEuler(this.tmpE); S.set(s, s, s); M.compose(P, Q, S); this.dBalls.setMatrixAt(n++, M); }); });
      this.dBalls.count = n; fin(this.dBalls); }
    if (this.dHubs) fin(this.dHubs); if (this.dBumps) fin(this.dBumps);
    // 컨베이어 줄무늬 흐름 · 점프대 반짝
    const cz = this.course.plats.find(p => p.kind === 2), sp = cz ? Math.abs(cz.cvz) : 3.5;
    this.tex.convF.offset.y -= dt * sp * 0.6 * 0.25; this.tex.convB.offset.y += dt * sp * 0.25;
    if (this.cm.pad.emissiveIntensity != null) this.cm.pad.emissiveIntensity = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(this.now / 160));
    // 출발 막대: 출발하면 아래로
    if (this.gate) { const srv = this.srv(), up = srv < this.Sk; this.gate.position.y += ((up ? 1.0 : -2.5) - this.gate.position.y) * Math.min(1, dt * 6); this.gate.visible = this.gate.position.y > -2.2; }
  }

  // ── 캐릭터 그리기 ──
  updateChars(dt) {
    const now = this.now, list = this._cl || (this._cl = []); list.length = 0; const C = this.course, T = this.T();
    if (!this.hidden && !(this.fallAt && now - this.fallAt > 500)) {
      const sp = Math.hypot(this.vx, this.vz), blink = this.protUntil && now < this.protUntil && Math.floor(now / 90) % 2 === 0;
      if (!blink) list.push({ me: true, x: this.x, y: this.y, z: this.z, h: this.h, sp, air: !this.grounded, stun: now < this.stunUntil, fin: !!this.fin, look: this.look, a: this.anim, land: this.landK, jump: this.jumpK, ghost: false, vy: this.vy });
    }
    for (const id in this.peers) { const p = this.peers[id]; if (p.wait || p.k !== this.k || p.y < -30 || (p.gone && now - p.goneAt > 1500)) continue;   // 떨어지는 친구도 보임 (아래로 사라짐)
      const a = p.a || (p.a = { ph: Math.random() * 6, air: 0, tilt: 0, lx: p.x, lz: p.z, ly: p.y, sp: 0, land: 0, wasAir: false });
      const fdt = Math.max(0.001, dt), sp = Math.min(12, Math.hypot(p.x - a.lx, p.z - a.lz) / fdt), vy = (p.y - a.ly) / fdt; a.sp += (sp - a.sp) * Math.min(1, dt * 8); a.lx = p.x; a.lz = p.z; a.ly = p.y;
      const air = !!((p.vfl || 0) & 1); if (a.wasAir && !air) a.land = 1; a.wasAir = air; a.land = Math.max(0, a.land - dt * 4);
      if (list.length >= OB3_MAXP) break;
      list.push({ x: p.x, y: p.y, z: p.z, h: p.h, sp: a.sp, air, stun: !!((p.vfl || 0) & 2), fin: p.fin, look: p.look || 0, a, land: a.land, jump: air && vy > 2 ? 0.6 : 0, ghost: now - p.seen > 2500 || p.gone, vy, name: p.name || this.nameOf(id) });
    }
    const M = this.tmpM, M2 = this.tmpM2, P = this.tmpP, Q = this.tmpQ, S = this.tmpS, E = this.tmpE;
    const hatN = [0, 0, 0, 0, 0, 0]; let nf = 0, nh = 0, nb = 0;
    this._shown = list;
    list.forEach((c, i) => {
      const lk = obLook(c.look), a = c.a;
      a.ph += dt * (c.air ? 2 : 2.4 + c.sp * 1.6);
      let sy = 1, sxz = 1, rx = 0, rz = 0, bob = 0, yaw = c.h, hop = 0;
      if (c.stun) { rx = Math.sin(now / 60) * 0.5 + 0.6; rz = Math.sin(now / 45) * 0.4; }
      else if (c.air) { sy = c.vy > 0 ? 1.12 : 0.96; sxz = c.vy > 0 ? 0.92 : 1.03; rx = Math.max(-0.3, Math.min(0.3, -c.vy * 0.02)); }
      else if (c.fin && c.sp < 1) { hop = Math.abs(Math.sin(now / 180 + i)) * 0.35; yaw += now / 400; sy = 1 + Math.sin(now / 90) * 0.04; }
      else if (c.sp > 0.6) { bob = Math.abs(Math.sin(a.ph)) * 0.09; rx = Math.min(0.22, c.sp * 0.03); }
      else { sy = 1 + Math.sin(now / 420 + i) * 0.025; }
      if (c.land > 0) { sy *= 1 - 0.28 * c.land; sxz *= 1 + 0.16 * c.land; }
      if (c.jump > 0.5 && !c.air) { sy *= 1.08; }
      // 몸 행렬
      E.set(rx, yaw, rz, 'YXZ'); Q.setFromEuler(E); P.set(c.x, c.y + bob + hop, c.z); S.set(sxz, sy, sxz); M.compose(P, Q, S);
      const col = c.ghost ? this.cGhost : this.cBody[lk.c];
      this.mBody.setMatrixAt(i, M); this.mBody.setColorAt(i, col); this.mEyeW.setMatrixAt(i, M); this.mEyeB.setMatrixAt(i, M);
      const hm = this.mHat[lk.hat], hi = hatN[lk.hat]++; hm.setMatrixAt(hi, M); hm.setColorAt(hi, c.ghost ? this.cGhost : this.cHat[lk.c]);
      // 발 · 손 (달리기 흔들기)
      const sw = c.air ? 0 : Math.sin(a.ph) * Math.min(1, c.sp / 4), lift = c.air ? 0.12 : 0;
      for (let s = -1; s <= 1; s += 2) {
        M2.copy(M).multiply(this.tmpM3.makeTranslation(s * 0.17, 0.08 + lift + Math.max(0, -s * sw) * 0.1, s * sw * 0.24)).multiply(this.tmpM3.makeScale(1, 0.62, 1.35));
        this.mFoot.setMatrixAt(nf, M2); this.mFoot.setColorAt(nf++, c.ghost ? this.cGhost : this.cFoot[lk.c]);
        const up = c.air || c.stun || (c.fin && c.sp < 1) ? 0.45 : 0;
        M2.copy(M).multiply(this.tmpM3.makeTranslation(s * 0.43, 0.55 + up + (c.stun ? Math.sin(now / 50 + s) * 0.15 : 0), -s * sw * 0.18));
        this.mHand.setMatrixAt(nh, M2); this.mHand.setColorAt(nh++, col);
      }
      // 발밑 그림자 (점프 높이를 알기 쉽게)
      const s0 = C.support(c.x, c.z, T, c.y + 0.3, 0.1);
      if (s0 && c.y - s0.top < 12) { const k = Math.max(0.35, 1 - (c.y - s0.top) / 8); P.set(c.x, s0.top + 0.03, c.z); Q.set(0, 0, 0, 1); S.set(1.1 * k, 1, 1.1 * k); M.compose(P, Q, S); this.mBlob.setMatrixAt(nb++, M); }
    });
    const n = list.length, set = (m, k) => { m.count = k; m.visible = k > 0; if (k) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; } };
    set(this.mBody, n); set(this.mEyeW, n); set(this.mEyeB, n); this.mHat.forEach((m, i) => set(m, hatN[i])); set(this.mFoot, nf); set(this.mHand, nh); set(this.mBlob, nb);
  }

  // ── 카메라: 뒤에서 따라감 (코스 앞 = +z) ──
  camTarget() {
    if (!this.hidden) return { x: this.x, y: this.fallAt ? Math.max(this.y, this.zBase() - 3) : this.y, z: this.z };
    let best = null; for (const id in this.peers) { const p = this.peers[id]; if (p.gone || p.wait || p.k !== this.k || ((p.vfl || 0) & 4)) continue; if (!best || p.z > best.z) best = p; }
    if (best) { this.watchName = best.name || this.nameOf(best.id); return { x: best.x, y: best.y, z: best.z }; }
    this.watchName = ''; return { x: 0, y: 0, z: -2 };
  }
  updateCamera(dt) {
    const t = this.camTarget(), cam = this.camera, port = this.portrait, pre = this.phase === 'pre';
    const back = (port ? 8.6 : 7.4) + (pre ? 2.5 : 0), up = (port ? 4.8 : 3.9) + (pre ? 1.5 : 0), ahead = port ? 4.5 : 5;
    const want = this.tmpV.set(t.x * 0.85, t.y + up, t.z - back);
    if (this.camSnap) { this.camPos.copy(want); this.camLook.set(t.x, t.y + 1, t.z + ahead); this.camSnap = false; }
    const k = 1 - Math.exp(-dt * 6), ky = 1 - Math.exp(-dt * 3.2);
    this.camPos.x += (want.x - this.camPos.x) * k; this.camPos.z += (want.z - this.camPos.z) * k; this.camPos.y += (want.y - this.camPos.y) * ky;
    this.camLook.x += (t.x - this.camLook.x) * k; this.camLook.z += (t.z + ahead - this.camLook.z) * k; this.camLook.y += (t.y + 1 - this.camLook.y) * ky;
    const sh = Math.min(1, this.shake) * 0.35, ti = this.now / 1000;
    cam.position.set(this.camPos.x + Math.sin(ti * 47) * sh, this.camPos.y + Math.sin(ti * 61 + 1) * sh, this.camPos.z);
    cam.lookAt(this.camLook.x, this.camLook.y, this.camLook.z); cam.updateMatrixWorld();
    this.sky.position.copy(cam.position);
  }

  draw() {
    if (this._dead || !this.renderer) return;
    const pn = performance.now(), dt = this.drawAt ? Math.max(0.001, Math.min(0.1, (pn - this.drawAt) / 1000)) : 0.016; this.drawAt = pn;
    if (this.built !== this.course) { this.buildCourse(); this.camSnap = true; }
    const T = this.T();
    this.updateCourse(T, dt);
    this.updateChars(dt);
    this.updateCamera(dt);
    this.updateParticles(dt);
    if (this.lin && this.sun && this.renderer.shadowMap.enabled) { const o = this.sunOffset, t = this.camLook; this.sun.position.set(t.x + o.x, t.y + o.y, t.z + o.z); this.sun.target.position.set(t.x, t.y, t.z); this.sun.target.updateMatrixWorld(); }
    this.watchFps(pn);
    this.renderer.render(this.scene, this.camera);
    this.drawHud();
  }
  // 3초 평균 24fps 밑이면 그림자를 끔 (three-quality.js 와 같은 기준)
  watchFps(pn) {
    if (!this.lin || this.hqLocked || this._shadowOff) return;
    this._fN = (this._fN || 0) + 1; if (!this._fT) this._fT = pn;
    if (pn - this._fT > 3000) { const fps = this._fN * 1000 / (pn - this._fT); this._fN = 0; this._fT = pn;
      if (fps < 24 && this.renderer.shadowMap.enabled) { this._shadowOff = true; this.renderer.shadowMap.enabled = false; this.sun.castShadow = false; this.scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); }); } }
  }

  // ══ HUD ══
  drawHud() {
    const c = this.ctx, d = this.hudDpr || 1, W = this.vw, H = this.vh, now = this.now, srv = this.srv();
    c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, W, H);
    const s = Math.max(0.78, Math.min(1.25, Math.min(W, H) / 560)), pad = 10;
    // 이름표 (가까운 10명)
    if (this._shown) { const cam = this.camera, v = this.tmpV; let n = 0;
      const shown = this._shown.filter(e => !e.me && e.name).map(e => ({ e, d: Math.hypot(e.x - this.camPos.x, e.z - this.camPos.z) })).sort((a, b) => a.d - b.d);
      for (const o of shown) { if (n >= 10 || o.d > 34) break; v.set(o.e.x, o.e.y + 1.95, o.e.z).project(cam); if (v.z > 1 || v.z < -1) continue; const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H; if (x < -40 || x > W + 40 || y < 30 || y > H) continue;
        n++; const fs = Math.max(10, Math.min(15, 15 - o.d * 0.15)) * s; c.globalAlpha = o.e.ghost ? 0.45 : 0.92; obTF(c, o.e.name, x, y, fs, 110 * s, '#ffffff', 'center', 'rgba(20,24,48,0.85)', 800); c.globalAlpha = 1; } }
    // 위: 총점(왼쪽) · 코스 · 시간(가운데) · 순위(오른쪽)
    const st = this.standings(), myRank = st.findIndex(e => e.me) + 1; this.place = myRank;
    const bh = 54 * s, lx = 60, lw = 128 * s, rw = 96 * s, narrow = W - lx - lw - rw - pad * 3 < 200 * s;
    c.fillStyle = 'rgba(24,28,58,0.55)'; obRR(c, lx, pad, lw, bh, 14 * s); c.fill();
    const pend = this.phase === 'results' ? (this.results(this.k).fin.concat(this.results(this.k).half).find(e => e.id === this.myId) || {}).pts : 0;   // 순위 화면 동안: 곧 더해질 점수
    obTF(c, '⭐ ' + this.score + '점' + (pend ? ' +' + pend : ''), lx + 12 * s, pad + 19 * s, 21 * s, lw - 18 * s, '#FFE066', 'left', false, 900);
    obTF(c, '전체 ' + myRank + '등 / ' + st.length + '명', lx + 12 * s, pad + 41 * s, 12.5 * s, lw - 18 * s, '#E6E9FF', 'left', false, 700);
    const E = this.endOf(this.k, this.Sk), cx = W / 2;
    const cw = narrow ? Math.min(W - pad * 2, 300 * s) : Math.min(W - 2 * (lx + lw + pad), 250 * s), cy0 = narrow ? pad + bh + 6 : pad, ch = narrow ? 44 * s : bh, ccx = narrow ? cx : (lx + lw + W - pad - rw) / 2;
    this.topH = cy0 + ch;
    c.fillStyle = 'rgba(24,28,58,0.55)'; obRR(c, ccx - cw / 2, cy0, cw, ch, 14 * s); c.fill();
    const left = this.phase === 'race' ? E - srv : this.phase === 'pre' ? OB_LIMIT : 0, firstIn = E < this.Sk + OB_LIMIT - 1;
    if (narrow) { obTF(c, (this.k + 1) + '코스 · ' + this.course.name, ccx - cw / 2 + 12 * s, cy0 + ch / 2, 13 * s, cw * 0.42, '#ffffff', 'left', false, 800);
      obT(c, '⏱ ' + obClock(left), ccx + cw * 0.12, cy0 + ch / 2, 16 * s, firstIn && this.phase === 'race' ? '#FF9AA8' : '#ffffff', 'center', false, 900);
      if (this.endAt > 0) { const tl = Math.max(0, this.endAt - srv), last = tl <= 10000 && !this.gameOver; obT(c, '전체 ' + obClock(tl), ccx + cw / 2 - 12 * s, cy0 + ch / 2, 13 * s * (last ? 1 + 0.08 * Math.sin(now / 80) : 1), last ? '#FF5C7A' : '#C8D0FF', 'right', false, 800); } }
    else { obTF(c, '코스 ' + (this.k + 1) + ' · ' + this.course.name, ccx, cy0 + 16 * s, 13 * s, cw - 16, '#ffffff', 'center', false, 800);
      obT(c, '⏱ ' + obClock(left), ccx - (this.endAt > 0 ? cw * 0.22 : 0), cy0 + 38 * s, 17 * s, firstIn && this.phase === 'race' ? '#FF9AA8' : '#ffffff', 'center', false, 900);
      if (this.endAt > 0) { const tl = Math.max(0, this.endAt - srv), last = tl <= 10000 && !this.gameOver, pulse = last ? 1 + 0.08 * Math.sin(now / 80) : 1;
        obT(c, '전체 ' + obClock(tl), ccx + cw * 0.24, cy0 + 38 * s, 14 * s * pulse, last ? '#FF5C7A' : '#C8D0FF', 'center', false, 800); } }
    const cr = this.courseRank();
    if (!this.hidden && cr.rank) { c.fillStyle = 'rgba(24,28,58,0.55)'; obRR(c, W - pad - 96 * s, pad, 96 * s, bh, 14 * s); c.fill();
      obT(c, cr.rank + '등', W - pad - 48 * s, pad + 22 * s, 24 * s, this.fin ? '#FFE066' : '#ffffff', 'center', false, 900); obT(c, (this.fin ? '도착 · ' : '지금 · ') + cr.n + '명', W - pad - 48 * s, pad + 43 * s, 11 * s, '#C8D0FF', 'center', false, 700); }
    // 진행도 막대 (오른쪽 세로 · 위 = 결승)
    this.drawProgress(c, W, H, s, pad);
    // 안내 · 배너
    if (this.phase === 'pre' && !this.gameOver) this.drawPre(c, W, H, s, srv);
    if (this.banner && !(this.phase === 'pre' && this.banner.text.indexOf('코스') === 0)) this.drawBanner(c, W, H, s);
    if (this.phase === 'results') this.drawResults(c, W, H, s, srv, E);
    if (this.hidden && !this.gameOver) { c.fillStyle = 'rgba(24,28,58,0.66)'; const ww = Math.min(W - 30, 360 * s); obRR(c, cx - ww / 2, H * 0.2, ww, 62 * s, 16 * s); c.fill();
      obTF(c, '다음 코스부터 함께 달려요!', cx, H * 0.2 + 22 * s, 17 * s, ww - 20, '#FFE066', 'center', false, 900);
      obTF(c, this.watchName ? '👀 ' + this.watchName + ' 구경 중' : '잠깐만 기다려 주세요', cx, H * 0.2 + 45 * s, 12.5 * s, ww - 20, '#E6E9FF', 'center', false, 700); }
    if (this.fallAt && !this.gameOver) { const k = Math.min(1, (now - this.fallAt) / 700); c.fillStyle = 'rgba(160,210,255,' + (0.35 * k) + ')'; c.fillRect(0, 0, W, H); obT(c, '앗! 체크포인트로…', cx, H * 0.42, 22 * s, '#ffffff', 'center', 'rgba(30,60,120,0.85)', 900); }
    if (this.guideAt && now - this.guideAt < 7000 && !this.gameOver && this.phase === 'race') this.drawGuide(c, W, H, s, now - this.guideAt);
    if (this.gameOver) this.drawFinal(c, W, H, s, st);
  }
  drawProgress(c, W, H, s, pad) {
    const x = W - pad - 9 * s, y0 = (this.topH || 64) + 22 * s, y1 = H - (this.touchUi ? 200 : 90) * s; if (y1 - y0 < 80) return;
    const C = this.course, Y = p => y1 - (y1 - y0) * p;
    c.fillStyle = 'rgba(24,28,58,0.45)'; obRR(c, x - 6 * s, y0 - 8 * s, 12 * s, y1 - y0 + 16 * s, 6 * s); c.fill();
    C.cps.forEach((cp, i) => { if (!i) return; const yy = Y(this.progOf(cp.z)); c.fillStyle = i <= this.cp && !this.hidden ? '#7CFFB2' : 'rgba(255,255,255,0.55)'; c.fillRect(x - 6 * s, yy - 1, 12 * s, 2); });
    obT(c, '🏁', x, y0 - 14 * s, 13 * s, '#fff', 'center', false);
    for (const id in this.peers) { const p = this.peers[id]; if (p.gone || p.wait || p.k !== this.k) continue; const lk = obLook(p.look || 0);
      c.fillStyle = obHex(OB3_BODY[lk.c]); c.beginPath(); c.arc(x, Y(this.progOf(p.z)), 3.6 * s, 0, 6.283); c.fill(); }
    if (!this.hidden) { const yy = Y(this.progOf(this.z)), lk = obLook(this.look); c.fillStyle = obHex(OB3_BODY[lk.c]); c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.beginPath(); c.arc(x, yy, 7 * s, 0, 6.283); c.fill(); c.stroke();
      obT(c, '나', x - 16 * s, yy, 11 * s, '#fff', 'center', 'rgba(20,24,48,0.9)', 900); }
  }
  drawPre(c, W, H, s, srv) {
    const n = Math.ceil((this.Sk - srv) / 1000), cx = W / 2, cy = Math.max((this.topH || 64) + 74 * s, H * 0.25), ww = Math.min(W - 24, 380 * s);
    c.fillStyle = 'rgba(24,28,58,0.62)'; obRR(c, cx - ww / 2, cy - 64 * s, ww, 100 * s, 18 * s); c.fill();
    obTF(c, '코스 ' + (this.k + 1) + ' · ' + this.course.name, cx, cy - 40 * s, 22 * s, ww - 24, '#FFE066', 'center', false, 900);
    obTF(c, this.course.mods.map(m => OB_MOD_NAME[m]).join(' → '), cx, cy - 12 * s, 12.5 * s, ww - 24, '#E6E9FF', 'center', false, 700);
    obT(c, this.k === 0 && this.lastFinal == null ? '결승선까지 먼저 가면 100점!' : '1등 100점 · 2등 85점 · 3등 75점 …', cx, cy + 12 * s, 12 * s, '#C8D0FF', 'center', false, 700);
    if (n >= 1 && n <= 3) { const f = 1 - ((this.Sk - srv) / 1000 - (n - 1)); obT(c, String(n), cx, cy + 86 * s, (58 + 26 * Math.max(0, 1 - f * 3)) * s, '#ffffff', 'center', 'rgba(255,77,141,0.95)', 900); }
  }
  drawBanner(c, W, H, s) {
    const b = this.banner, age = this.now - b.at, k = Math.min(1, age / 160), out = b.until - this.now < 300 ? Math.max(0, (b.until - this.now) / 300) : 1, cx = W / 2, cy = H * 0.3;
    c.globalAlpha = out; const z = (0.7 + 0.3 * k) * s;
    obTF(c, b.text, cx, cy, 34 * z, W - 30, b.color, 'center', 'rgba(20,24,48,0.92)', 900);
    if (b.sub) obTF(c, b.sub, cx, cy + 32 * s, 15 * s, W - 30, '#ffffff', 'center', 'rgba(20,24,48,0.85)', 800);
    c.globalAlpha = 1;
  }
  drawResults(c, W, H, s, srv, E) {
    const res = this.results(this.k), cx = W / 2, rows = Math.min(8, res.fin.length), ww = Math.min(W - 24, 360 * s), rh = 24 * s, hh = (78 + Math.max(1, rows) * 24 + 26) * s, y0 = Math.max(70 * s, H * 0.42 - hh / 2);
    if (this.now - (this.banner ? this.banner.at : 0) < 1600 && this.banner && this.banner.text === '코스 끝!') return;   // 먼저 '코스 끝!' 을 보여 줌
    c.fillStyle = 'rgba(24,28,58,0.8)'; obRR(c, cx - ww / 2, y0, ww, hh, 18 * s); c.fill();
    obT(c, '코스 ' + (this.k + 1) + ' 결과', cx, y0 + 22 * s, 19 * s, '#FFE066', 'center', false, 900);
    const nm = id => id === this.myId ? (this.myName || '나') : ((this.peers[id] && this.peers[id].name) || this.nameOf(id) || '?');
    for (let i = 0; i < rows; i++) { const e = res.fin[i], y = y0 + 50 * s + i * rh, me = e.id === this.myId;
      if (me) { c.fillStyle = 'rgba(255,224,102,0.22)'; obRR(c, cx - ww / 2 + 8, y - rh / 2 + 1, ww - 16, rh - 2, 8); c.fill(); }
      obT(c, ['🥇', '🥈', '🥉'][i] || (i + 1) + '등', cx - ww / 2 + 30 * s, y, 13 * s, '#fff', 'center', false, 800);
      obTF(c, nm(e.id), cx - ww / 2 + 56 * s, y, 13.5 * s, ww * 0.44, me ? '#FFE066' : '#fff', 'left', false, 800);
      obT(c, ((e.t - this.Sk) / 1000).toFixed(1) + '초', cx + ww * 0.17, y, 12 * s, '#C8D0FF', 'center', false, 700);
      obT(c, '+' + e.pts, cx + ww / 2 - 28 * s, y, 14 * s, '#7CFFB2', 'center', false, 900); }
    const mine = res.fin.findIndex(e => e.id === this.myId), yB = y0 + 50 * s + Math.max(1, rows) * rh + 6 * s;
    if (!rows) obT(c, '아무도 도착하지 못했어요', cx, y0 + 50 * s, 13 * s, '#fff', 'center', false, 700);
    const mh = res.half.find(e => e.id === this.myId);
    obTF(c, mine >= 8 ? '나: ' + (mine + 1) + '등 +' + res.fin[mine].pts + '점' : mine < 0 ? (mh ? '나: 반환점 +' + OB_HALF_PTS + '점' : '나: 도착 못 함') : '', cx, yB, 12.5 * s, ww - 20, '#FFE066', 'center', false, 800);
    const nxt = Math.max(0, Math.ceil((E + OB_RES - srv) / 1000));
    obT(c, '다음 코스까지 ' + nxt + '초', cx, y0 + hh - 13 * s, 11.5 * s, '#C8D0FF', 'center', false, 700);
  }
  drawGuide(c, W, H, s, age) {
    const a = age < 300 ? age / 300 : age > 6200 ? Math.max(0, (7000 - age) / 800) : 1, cx = W / 2, y = H - (this.touchUi ? 170 : 70) * s, ww = Math.min(W - 24, 420 * s);
    c.globalAlpha = a; c.fillStyle = 'rgba(24,28,58,0.72)'; obRR(c, cx - ww / 2, y - 26 * s, ww, 52 * s, 16 * s); c.fill();
    obTF(c, this.touchUi ? '🕹 조이스틱: 달리기 · ⤴ 버튼: 점프' : 'WASD / 방향키: 달리기 · Space: 점프', cx, y - 9 * s, 15 * s, ww - 20, '#ffffff', 'center', false, 800);
    obTF(c, '떨어지면 체크포인트에서 바로 다시! · 결승선까지 달려요', cx, y + 12 * s, 12 * s, ww - 20, '#FFE066', 'center', false, 700);
    c.globalAlpha = 1;
  }
  drawFinal(c, W, H, s, st) {
    const cx = W / 2, rows = Math.min(5, st.length), ww = Math.min(W - 24, 340 * s), rh = 26 * s, hh = (70 + rows * 26 + 34) * s, y0 = H * 0.42;
    c.fillStyle = 'rgba(24,28,58,0.82)'; obRR(c, cx - ww / 2, y0, ww, hh, 18 * s); c.fill();
    obT(c, '최종 순위', cx, y0 + 22 * s, 19 * s, '#FFE066', 'center', false, 900);
    for (let i = 0; i < rows; i++) { const e = st[i], y = y0 + 52 * s + i * rh;
      if (e.me) { c.fillStyle = 'rgba(255,224,102,0.22)'; obRR(c, cx - ww / 2 + 8, y - rh / 2 + 1, ww - 16, rh - 2, 8); c.fill(); }
      obT(c, ['🥇', '🥈', '🥉'][i] || (i + 1) + '등', cx - ww / 2 + 30 * s, y, 14 * s, '#fff', 'center', false, 800);
      obTF(c, e.me ? (this.myName || '나') : e.name, cx - ww / 2 + 58 * s, y, 14 * s, ww * 0.5, e.me ? '#FFE066' : '#fff', 'left', false, 800);
      obT(c, e.s + '점', cx + ww / 2 - 36 * s, y, 15 * s, '#7CFFB2', 'center', false, 900); }
    obTF(c, '나: ' + this.rank + '등 / ' + this.total + '명 · ' + this.score + '점', cx, y0 + hh - 16 * s, 13 * s, ww - 20, '#FFE066', 'center', false, 800);
  }
}
if (typeof window !== 'undefined') window.ObstGame = ObstGame;
