// 범퍼카 서바이벌 3D — 그림(Three.js r128) · HUD · 효과. 규칙 · 통신은 bumper-engine.js 의 BumperCore
//   · 하늘 섬 경기장(고리 조각) 아래로 구름과 바다. 카메라는 북쪽이 위인 고정 방향으로 약 58° 내려다보며 부드럽게 따라감 (조이스틱 위 = 화면 위)
//   · 그리기 호출이 인원과 무관: 차는 '모양 3종 × 부품 3개' InstancedMesh(색은 인스턴스 색) · 조각은 고리마다 InstancedMesh 하나
//   · 화질: high(PC) = 물리 재질(광택 도장 · 하늘 반사 HDR) + 그림자 2048 · mid(태블릿) = 물리 재질 + 그려 만든 하늘 반사 + 그림자 1024
//           low(그래픽 가속 없음) = 단순 재질 · 그림자 대신 동그란 그림자. 느리면(index.html) 해상도 · 그림자 · 입자를 줄임
//   · 글자 · 점수 · 이름표 · 안내는 위에 겹친 2D HUD 캔버스

const BP3_COLORS = [0xE63946, 0xFF8C1A, 0xFFD60A, 0x8BD346, 0x2DC653, 0x14B8A6, 0x22D3EE, 0x3B9EFF, 0x3B5BDB, 0x8B5CF6, 0xD946EF, 0xFF6FB5, 0x9C6B3C, 0xF1F5F9, 0x2B2D42];
const BP3_SECOND = [0xFFFFFF, 0x1F2937, 0x1F2937, 0x1F2937, 0xFFFFFF, 0xFFFFFF, 0x1F2937, 0xFFFFFF, 0xFFD60A, 0xFFD60A, 0xFFFFFF, 0xFFFFFF, 0xFFD60A, 0xE63946, 0xFFD60A];
const BP3_SHAPES = 3, BP3_MAXC = 44;
const BP3_PITCH = 58 * Math.PI / 180;
const bp3Skin = s => { s = Math.max(0, s | 0); const c = s % 15, sh = Math.floor(s / 15) % BP3_SHAPES, alt = Math.floor(s / 45) % 2; return { c, sh, col: BP3_COLORS[c], sec: alt ? BP3_COLORS[(c + 7) % 15] : BP3_SECOND[c] }; };
const bp3Css = hex => '#' + (hex >>> 0).toString(16).padStart(6, '0');
const bp3Clock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function bp3RR(c, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function bp3T(c, s, x, y, size, color, align, stroke, weight) {
  c.font = (weight || 800) + ' ' + Math.round(size) + 'px ' + BP_FONT; c.textAlign = align || 'center'; c.textBaseline = 'middle';
  if (stroke !== false) { c.lineWidth = Math.max(2, size * 0.22); c.strokeStyle = stroke || 'rgba(10,16,34,0.9)'; c.lineJoin = 'round'; c.strokeText(s, x, y); }
  c.fillStyle = color || '#fff'; c.fillText(s, x, y);
}
function bp3TF(c, s, x, y, size, maxW, color, align, stroke, weight) { c.font = (weight || 800) + ' ' + Math.round(size) + 'px ' + BP_FONT; const w = c.measureText(s).width; bp3T(c, s, x, y, w > maxW && w > 0 ? Math.max(8, size * maxW / w) : size, color, align, stroke, weight); }
// 여러 기하를 한 덩어리로 (정점 색 포함)
function bp3Merge(parts, lin) {
  const T = THREE; let n = 0;
  const gs = parts.map(p => { const g0 = p.g, g = g0.index ? g0.toNonIndexed() : g0; if (g !== g0) g0.dispose(); if (p.m) g.applyMatrix4(p.m); n += g.attributes.position.count; return g; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  gs.forEach((g, i) => { const c = new T.Color(parts[i].c == null ? 0xFFFFFF : parts[i].c); if (lin) c.convertSRGBToLinear(); const cnt = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    for (let k = 0; k < cnt; k++) { col[(o + k) * 3] = c.r; col[(o + k) * 3 + 1] = c.g; col[(o + k) * 3 + 2] = c.b; } o += cnt; g.dispose(); });
  const out = new T.BufferGeometry(); out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.setAttribute('normal', new T.BufferAttribute(nor, 3)); out.setAttribute('color', new T.BufferAttribute(col, 3));
  out.computeBoundingSphere(); return out;
}
function bp3P(g, x, y, z, c, rx, ry, rz, sx, sy, sz) { const T = THREE, m = new T.Matrix4(); m.compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx || 0, ry || 0, rz || 0)), new T.Vector3(sx || 1, sy || sx || 1, sz || sx || 1)); return { g, m, c }; }
function bp3Canvas(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); return t; }

class BumperGame extends BumperCore {
  constructor(canvas, opts) {
    const host = canvas.parentElement, hud = document.createElement('canvas');
    hud.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2';
    host.appendChild(hud);
    super(opts);
    this.glCanvas = canvas; this.host = host; this.hudCanvas = hud; this.ctx = hud.getContext('2d');
    this.vw = host.clientWidth || 800; this.vh = host.clientHeight || 600; this.q = 2;
    this.guideAt = 0; this.wasAlive = false; this.tileFx = {}; this.lastFx = 0; this.btnAt = 0;
    this.initThree();
    this.resize();
  }
  // ── 한 프레임 (index.html 의 loop 가 부름) ──
  tick(ts) {
    if (this._dead) return;
    this.step(ts);
    if (this.alive && !this.wasAlive && !this.guideAt) this.guideAt = this.now;   // 처음 출격: 조작 안내
    this.wasAlive = this.alive;
    this.draw();
  }
  setQuality(q) {
    this.q = Math.max(0, Math.min(2, q | 0));
    if (this.renderer) this.renderer.setPixelRatio(Math.min([0.75, 1.0, 1.25][this.q], this.opts.maxDpr || 1.25, window.devicePixelRatio || 1));
    if (this.q === 0 && this.renderer && this.renderer.shadowMap.enabled) this.shadowsOff();
    this.resize();
  }
  shadowsOff() {
    const r = this.renderer; r.shadowMap.enabled = false; if (this.sun) this.sun.castShadow = false;
    this.scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
    if (this.blob) this.blob.visible = true;
  }
  resize() {
    if (this._dead) return;
    const W = this.host.clientWidth || 800, H = this.host.clientHeight || 600; if (W < 10 || H < 10) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.hudCanvas.width = Math.round(W * dpr); this.hudCanvas.height = Math.round(H * dpr); this.hudDpr = dpr; this.vw = W; this.vh = H;
    if (!this.renderer) return;
    this.renderer.setSize(W, H, false); this.glCanvas.style.width = '100%'; this.glCanvas.style.height = '100%';
    const cam = this.camera, asp = W / H; cam.aspect = asp; cam.fov = asp < 1 ? 52 : 42;
    const tn = Math.tan(cam.fov * Math.PI / 360), want = Math.min(asp < 1 ? 30 : 40, this.R * (asp < 1 ? 1.15 : 1.4) + 5);   // 짧은 변에 경기장 대부분이 보이게 (세로 화면은 차가 너무 작아지지 않게 조금 가까이)
    this.camDist = asp < 1 ? want / (2 * tn * asp) : want * 0.92 / (2 * tn); cam.far = this.camDist * 3 + 400; cam.updateProjectionMatrix();
  }
  captureTo(g, w, h) { if (!this.renderer || this._dead) return; this.renderer.render(this.scene, this.camera); g.drawImage(this.glCanvas, 0, 0, w, h); if (this.hudCanvas.width) g.drawImage(this.hudCanvas, 0, 0, w, h); }
  destroy() {
    if (this._dead) return; this._dead = true;
    try { const seen = new Set(), tex = t => { if (t && t.isTexture && !seen.has(t)) { seen.add(t); t.dispose(); } };
      this.scene.traverse(o => { if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
        [].concat(o.material || []).forEach(m => { if (!m || seen.has(m)) return; seen.add(m); Object.keys(m).forEach(k => tex(m[k])); m.dispose(); });
        if (o.isLight && o.shadow && o.shadow.map) { o.shadow.map.dispose(); o.shadow.map = null; } });
      if (this.scene.environment) this.scene.environment.dispose(); } catch (e) {}
    try { this.renderer.dispose(); } catch (e) {}
    try { if (this.hudCanvas.parentNode) this.hudCanvas.parentNode.removeChild(this.hudCanvas); } catch (e) {}
    const b = document.getElementById('aboost'); if (b) b.style.opacity = '';
  }

  // ══ 장면 ══
  color3(hex) { const c = new THREE.Color(hex); if (this.lin) c.convertSRGBToLinear(); return c; }
  mat(o) {   // 화질별 재질: high/mid = 물리 재질, low = 람베르트
    const T = THREE, p = Object.assign({}, o); const phys = p.phys; delete p.phys;
    if (p.color != null && !(p.color instanceof T.Color)) p.color = this.color3(p.color);
    if (p.emissive != null && !(p.emissive instanceof T.Color)) p.emissive = this.color3(p.emissive);
    if (this.hq === 'low') { delete p.roughness; delete p.metalness; delete p.clearcoat; delete p.clearcoatRoughness; delete p.envMapIntensity; return new T.MeshLambertMaterial(p); }
    if (phys && this.hq === 'high') return new T.MeshPhysicalMaterial(Object.assign({ clearcoat: 1, clearcoatRoughness: 0.12 }, p));
    delete p.clearcoat; delete p.clearcoatRoughness; return new T.MeshStandardMaterial(p);
  }
  initThree() {
    const T = THREE;
    const r = this.renderer = new T.WebGLRenderer({ canvas: this.glCanvas, antialias: (window.devicePixelRatio || 1) < 2, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.opts.maxDpr || 1.25));
    this.hq = 'low'; this.hqLocked = false;
    if (window.ThreeQuality) { const pq = ThreeQuality.pick(r, this.opts); this.hq = pq.q; this.hqLocked = !!pq.locked; }
    this.lin = this.hq !== 'low';
    if (this.lin) { r.outputEncoding = T.sRGBEncoding; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.0; }
    const sc = this.scene = new T.Scene();
    this.horizon = 0xBFE3F7;
    sc.fog = new T.Fog(this.color3(this.horizon), 90, 330);
    this.camera = new T.PerspectiveCamera(45, 1, 0.5, 600);
    this.hemi = new T.HemisphereLight(this.color3(0xDCEFFF), this.color3(0x3A6F8F), this.lin ? 0.75 : 0.85); sc.add(this.hemi);
    const sun = this.sun = new T.DirectionalLight(this.color3(0xFFF1D6), this.lin ? 2.1 : 0.85); sun.position.set(-22, 46, 30); sc.add(sun); sc.add(sun.target);
    if (this.hq !== 'low') {
      r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap; sun.castShadow = true;
      const sz = this.hq === 'high' ? 2048 : 1024, h = this.R + 4, cm = sun.shadow.camera; sun.shadow.mapSize.set(sz, sz);
      cm.left = -h; cm.right = h; cm.top = h; cm.bottom = -h; cm.near = 10; cm.far = 120; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    }
    this.tmpM = new T.Matrix4(); this.tmpQ = new T.Quaternion(); this.tmpQ2 = new T.Quaternion(); this.tmpE = new T.Euler(); this.tmpS = new T.Vector3(1, 1, 1); this.tmpP = new T.Vector3(); this.tmpV = new T.Vector3(); this.tmpC = new T.Color(); this.vUp = new T.Vector3(0, 1, 0);
    this.buildSky(); this.buildSea(); this.buildClouds();
    this.buildArena(); this.buildProps(); this.buildCars(); this.buildFx();
    this.camT = new T.Vector3(this.x * 0.7, 0, this.z * 0.7); this.camSnap = true;
    this.buildEnv();
  }
  // 하늘: 큰 공 안쪽에 위(짙은 파랑) → 지평선(밝은 하늘색) → 아래(바다 안개) 그라데이션 + 해
  buildSky() {
    const T = THREE, top = this.color3(0x2F7FD8), hor = this.color3(this.horizon), bot = this.color3(0x6FB6D6), sunC = this.color3(0xFFF4DA);
    const m = new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, fog: false, toneMapped: false,
      uniforms: { top: { value: top }, hor: { value: hor }, bot: { value: bot }, sunC: { value: sunC }, sunDir: { value: new T.Vector3(-22, 46, 30).normalize() } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }',
      fragmentShader: 'uniform vec3 top, hor, bot, sunC, sunDir; varying vec3 vD; void main(){ float y = vD.y; vec3 c = y > 0.0 ? mix(hor, top, pow(clamp(y,0.0,1.0), 0.55)) : mix(hor, bot, clamp(-y*3.0,0.0,1.0));' +
        ' float s = max(dot(normalize(vD), sunDir), 0.0); c += sunC * (pow(s, 900.0) * 6.0 + pow(s, 12.0) * 0.25); gl_FragColor = vec4(c, 1.0);' + (this.lin ? ' gl_FragColor = linearToOutputTexel(gl_FragColor);' : '') + ' }' });
    const g = new T.SphereGeometry(500, 24, 14), sky = this.sky = new T.Mesh(g, m); sky.frustumCulled = false; sky.renderOrder = 6;
    // 카메라가 58° 내려다봐 지평선이 화면에 안 들어옴 → 하늘은 반사 환경을 만들 때만 씀 (화면마다 하늘을 칠하지 않아 가벼움)
  }
  // 바다: 경기장 한참 아래 · 물결(사인파 합) · 하늘 반사(프레넬) · 햇빛 반짝임 — 셰이더 하나 (가볍게)
  buildSea() {   // 톤 매핑(ACES)이 밝게 올리므로 선형 화질(mid/high)은 바다 색을 조금 어둡게
    const T = THREE, g = new T.PlaneGeometry(1200, 1200, 1, 1); g.rotateX(-Math.PI / 2);
    const m = this.seaMat = new T.ShaderMaterial({ fog: false, toneMapped: true,
      uniforms: { t: { value: 0 }, deep: { value: this.color3(this.lin ? 0x063A5E : 0x0B4F7A) }, shal: { value: this.color3(this.lin ? 0x0C7799 : 0x1FA3C4) }, sky: { value: this.color3(this.lin ? 0x9CCBE8 : 0xCFEAFB) }, fogC: { value: this.color3(this.horizon) }, sunDir: { value: new T.Vector3(-22, 46, 30).normalize() }, camP: { value: new T.Vector3() }, hiq: { value: this.hq === 'low' ? 0 : 1 } },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: [
        'uniform float t, hiq; uniform vec3 deep, shal, sky, fogC, sunDir, camP; varying vec3 vW;',
        'void main(){ vec2 p = vW.xz; float a = t;',
        ' vec2 g = vec2(cos(p.x*0.21 + a*1.1)*0.6 + cos(p.x*0.13 - p.y*0.17 + a*0.8), cos(p.y*0.19 - a*0.9)*0.6 + cos(p.x*0.11 + p.y*0.15 + a*0.7));',
        ' if (hiq > 0.5) g += vec2(cos(p.x*0.83 + p.y*0.31 + a*2.3), cos(p.y*0.77 - p.x*0.29 + a*2.1)) * 0.35;',
        ' vec3 n = normalize(vec3(g.x*0.09, 1.0, g.y*0.09)); vec3 v = normalize(camP - vW); float f = pow(1.0 - max(dot(n, v), 0.0), 4.0);',
        ' vec3 c = mix(deep, shal, 0.35 + 0.25*g.x*0.5); c = mix(c, sky, 0.1 + f*0.75);',
        ' vec3 h = normalize(sunDir + v); c += vec3(1.0,0.95,0.85) * pow(max(dot(n,h),0.0), 260.0) * 2.5;',
        ' float d = length(camP.xz - vW.xz); c = mix(c, fogC, smoothstep(140.0, 520.0, d));',
        ' gl_FragColor = vec4(c, 1.0);', this.lin ? ' #include <tonemapping_fragment>\n gl_FragColor = linearToOutputTexel(gl_FragColor);' : '', '}'].join('\n') });
    const sea = this.sea = new T.Mesh(g, m); sea.position.y = BP_FALL_Y - 2; sea.renderOrder = 5; this.scene.add(sea);   // 불투명한 것들 뒤에 그려 가려진 곳은 건너뜀
  }
  // 구름: 같은 그림의 납작한 판 여러 장을 한 번에 (카메라 방향이 늘 같아 처음에 카메라 쪽으로 돌려 둠)
  buildClouds() {
    const T = THREE, tex = bp3Canvas(256, 128, (g, w, h) => { for (let i = 0; i < 26; i++) { const x = w * (0.18 + 0.64 * Math.random()), y = h * (0.42 + 0.22 * Math.random()), r = h * (0.16 + 0.2 * Math.random());
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.85)'); gr.addColorStop(0.6, 'rgba(250,252,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); } });
    const n = this.hq === 'low' ? 6 : 12, m = new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.7, depthWrite: false, fog: true, color: this.color3(0xFFFFFF) });
    const mesh = this.clouds = new T.InstancedMesh(new T.PlaneGeometry(1, 0.5), m, n); mesh.frustumCulled = false; mesh.renderOrder = -2;
    this.cloudData = [];
    for (let i = 0; i < n; i++) { const a = bpHash(i, 3, 9) * Math.PI * 2, d = this.R + 30 + bpHash(i, 4, 9) * 110, y = -14 + bpHash(i, 5, 9) * 10;   // 경기장 둘레 멀리 (가까우면 바다를 덮어 뿌옇게 됨)
      this.cloudData.push({ x: Math.cos(a) * d, y, z: Math.sin(a) * d, s: 26 + bpHash(i, 6, 9) * 30, v: 0.4 + bpHash(i, 7, 9) * 0.6 }); }
    this.scene.add(mesh);
  }
  // 반사 환경: 하늘 장면을 한 번 그려 반사용으로 (mid/high) · high 는 바닷가 하늘 사진(HDR)을 받아 바꿈
  buildEnv() {
    if (this.hq === 'low') return;
    const T = THREE, r = this.renderer;
    try { const es = new T.Scene(); es.add(new T.Mesh(this.sky.geometry, this.sky.material));
      const ground = new T.Mesh(new T.CircleGeometry(400, 24), new T.MeshBasicMaterial({ color: this.color3(0x2D7FA6) })); ground.rotation.x = -Math.PI / 2; ground.position.y = -40; es.add(ground);
      const pm = new T.PMREMGenerator(r); this.scene.environment = pm.fromScene(es, 0.02).texture; pm.dispose(); ground.geometry.dispose(); ground.material.dispose();
    } catch (e) {}
    if (this.hq !== 'high' || typeof document === 'undefined') return;
    const load = src => new Promise((res, rej) => { if (window.THREE && THREE.RGBELoader) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    load('lib/RGBELoader.js').then(() => new Promise(res => new THREE.RGBELoader().setDataType(THREE.UnsignedByteType).load('assets/hdr/blouberg_sunrise_2_1k.hdr', res, undefined, () => res(null)))).then(tex => {
      if (!tex || this._dead) return; tex.mapping = THREE.EquirectangularReflectionMapping;
      const pm = new THREE.PMREMGenerator(this.renderer), old = this.scene.environment; this.scene.environment = pm.fromEquirectangular(tex).texture; pm.dispose(); tex.dispose(); if (old) old.dispose(); this.hdr = true; if (this.bodyMat) this.bodyMat.envMapIntensity = 0.7; this.renderer.toneMappingExposure = 0.92;   // 사진 하늘은 밝아 반사 · 노출을 조금 낮춤 (안 그러면 도장이 바래 보임)
    }).catch(() => {});
  }

  // 경기장: 가운데 원판 + 고리마다 조각 InstancedMesh · 아래는 떠 있는 바위섬
  buildArena() {
    const T = THREE, A = this.arena, TH = 0.9;
    const pal = [[0x38BDF8, 0xDCE6F0], [0xFB923C, 0xEDE3D8], [0x84CC16, 0xE0E8D2], [0xF472B6, 0xEEDDE6], [0xFACC15, 0xEDE7D0], [0x818CF8, 0xDDE0F0], [0x2DD4BF, 0xD6EAE6], [0xF87171, 0xF0DCDC]];
    const tileMat = this.tileMat = this.mat({ vertexColors: true, roughness: 0.38, metalness: 0.05, envMapIntensity: 0.8 });
    this.rings = [null]; this.tileState = [null];
    for (let k = 1; k <= A.K; k++) {
      const n = A.nSec[k], r0 = BP_CORE_R + (k - 1) * BP_RING_W + 0.05, r1 = r0 + BP_RING_W - 0.1, rm = (r0 + r1) / 2, span = Math.PI * 2 / n, gap = 0.07 / rm, a0 = -span / 2 + gap, a1 = span / 2 - gap;
      const seg = Math.max(2, Math.ceil((a1 - a0) * r1 / 1.1)), P = [], C = [], top = this.lin ? 1 : 1, rim = this.color3(0x64748B), side = this.color3(0x475569), under = this.color3(0x6B5B4B);
      const pt = (rad, a, y) => [Math.cos(a) * rad - rm, y, Math.sin(a) * rad];
      const quad = (p0, p1, p2, p3, c) => { [p0, p1, p2, p0, p2, p3].forEach(p => { P.push(p[0], p[1], p[2]); C.push(c.r, c.g, c.b); }); };
      const white = new T.Color(1, 1, 1), edgeW = this.color3(0xE2E8F0);
      for (let i = 0; i < seg; i++) { const u0 = a0 + (a1 - a0) * i / seg, u1 = a0 + (a1 - a0) * (i + 1) / seg;
        quad(pt(r0 + 0.18, u0, 0), pt(r0 + 0.18, u1, 0), pt(r1 - 0.18, u1, 0), pt(r1 - 0.18, u0, 0), white);                       // 윗면 (조각 색)
        quad(pt(r1 - 0.18, u0, 0), pt(r1 - 0.18, u1, 0), pt(r1, u1, -0.12), pt(r1, u0, -0.12), edgeW);                            // 바깥 모서리 (둥글게 깎은 테)
        quad(pt(r0, u0, -0.12), pt(r0, u1, -0.12), pt(r0 + 0.18, u1, 0), pt(r0 + 0.18, u0, 0), edgeW);
        quad(pt(r1, u0, -0.12), pt(r1, u1, -0.12), pt(r1, u1, -TH), pt(r1, u0, -TH), rim);                                         // 바깥 옆면
        quad(pt(r0, u1, -0.12), pt(r0, u0, -0.12), pt(r0, u0, -TH), pt(r0, u1, -TH), side);
        quad(pt(r0, u0, -TH), pt(r0, u1, -TH), pt(r1, u1, -TH), pt(r1, u0, -TH), under); }
      [a0, a1].forEach((a, j) => { const pa = [pt(r0, a, -0.12), pt(r1, a, -0.12), pt(r1, a, -TH), pt(r0, a, -TH)]; if (j) pa.reverse(); quad(pa[0], pa[1], pa[2], pa[3], side);
        const pb = [pt(r0 + 0.18, a, 0), pt(r1 - 0.18, a, 0), pt(r1, a, -0.12), pt(r0, a, -0.12)]; if (j) pb.reverse(); quad(pb[0], pb[1], pb[2], pb[3], edgeW); });
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('color', new T.Float32BufferAttribute(C, 3)); g.computeVertexNormals(); g.computeBoundingSphere();
      const mesh = new T.InstancedMesh(g, tileMat, n); mesh.receiveShadow = true; mesh.frustumCulled = false;
      const pr = pal[(k - 1) % pal.length], st = [];
      for (let s = 0; s < n; s++) { const th = A.rot[k] + (s + 0.5) * span; st.push({ th, rm, mode: -1, base: this.color3(pr[s % 2]), sx: Math.cos(th) * rm, sz: Math.sin(th) * rm }); mesh.setColorAt(s, st[s].base); }
      this.scene.add(mesh); this.rings.push(mesh); this.tileState.push(st);
    }
    // 가운데 원판 (별 무늬 그림)
    const tex = bp3Canvas(512, 512, (g, w) => { const c = w / 2; g.fillStyle = '#FDE68A'; g.fillRect(0, 0, w, w);
      for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#FBBF24' : '#FDE68A'; g.beginPath(); g.moveTo(c, c); g.arc(c, c, c, i * Math.PI / 8, (i + 1) * Math.PI / 8); g.fill(); }
      g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(c, c, c * 0.42, 0, 7); g.fill(); g.fillStyle = '#F43F5E'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? c * 0.16 : c * 0.36; g.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr); } g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 14; g.beginPath(); g.arc(c, c, c - 10, 0, 7); g.stroke(); });
    if (this.lin) tex.encoding = T.sRGBEncoding;
    const cg = new T.CylinderGeometry(BP_CORE_R - 0.05, BP_CORE_R - 0.3, TH, 48, 1), cm = this.mat({ map: tex, color: 0xFFFFFF, roughness: 0.35, metalness: 0.05 }), side = this.mat({ color: 0x64748B, roughness: 0.5, metalness: 0.2 });
    const core = new T.Mesh(cg, [side, cm, side]); core.position.y = -TH / 2; core.receiveShadow = true; this.scene.add(core);
    // 아래로 늘어진 바위섬 (가운데 아래만 · 정점을 흔들어 울퉁불퉁)
    const rg = new T.ConeGeometry(BP_CORE_R * 1.05, 16, 14, 5, true), pos = rg.attributes.position;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i), k = 1 + (bpHash(i, 1, 3) - 0.5) * 0.35 * (y < 7.9 ? 1 : 0); pos.setX(i, pos.getX(i) * k); pos.setZ(i, pos.getZ(i) * k); }
    rg.rotateX(Math.PI); rg.computeVertexNormals();
    const rock = new T.Mesh(rg, this.mat({ color: 0x8C7A66, roughness: 0.9, metalness: 0, flatShading: true })); rock.position.y = -TH - 8; this.scene.add(rock);
    const grass = new T.Mesh(new T.CylinderGeometry(BP_CORE_R * 1.08, BP_CORE_R * 1.02, 0.5, 20, 1, true), this.mat({ color: 0x5FA34A, roughness: 0.8, flatShading: true })); grass.position.y = -TH - 0.1; this.scene.add(grass);
  }
  // 범퍼 기둥 · 점프대 · 아이템 (라운드마다 자리가 바뀜 — 개수만큼 미리 만들어 둠)
  buildProps() {
    const T = THREE;
    const bg = bp3Merge([bp3P(new T.CylinderGeometry(0.85, 0.95, 1.1, 20), 0, 0.55, 0, 0xEF4444), bp3P(new T.TorusGeometry(0.86, 0.13, 8, 20), 0, 0.75, 0, 0xFFFFFF, Math.PI / 2), bp3P(new T.TorusGeometry(0.9, 0.13, 8, 20), 0, 0.3, 0, 0xFFFFFF, Math.PI / 2),
      bp3P(new T.CylinderGeometry(0.5, 0.6, 0.25, 16), 0, 1.2, 0, 0xFDE047)], this.lin);
    this.bumpMesh = new T.InstancedMesh(bg, this.mat({ vertexColors: true, roughness: 0.3, metalness: 0.1, emissive: 0x220000 }), 8); this.bumpMesh.castShadow = true; this.bumpMesh.frustumCulled = false; this.scene.add(this.bumpMesh);
    const ptex = bp3Canvas(256, 256, (g, w) => { const c = w / 2; const gr = g.createRadialGradient(c, c, 10, c, c, c); gr.addColorStop(0, '#A7F3D0'); gr.addColorStop(0.7, '#10B981'); gr.addColorStop(1, '#065F46'); g.fillStyle = gr; g.beginPath(); g.arc(c, c, c - 2, 0, 7); g.fill();
      g.fillStyle = '#FFFFFF'; for (let i = 0; i < 3; i++) { const y = c + 50 - i * 44; g.beginPath(); g.moveTo(c - 52, y + 16); g.lineTo(c, y - 24); g.lineTo(c + 52, y + 16); g.lineTo(c + 30, y + 24); g.lineTo(c, y + 2); g.lineTo(c - 30, y + 24); g.closePath(); g.fill(); } });
    if (this.lin) ptex.encoding = T.sRGBEncoding;
    const pg = new T.CircleGeometry(1.15, 28); pg.rotateX(-Math.PI / 2);
    this.padMat = new T.MeshBasicMaterial({ map: ptex, transparent: true, color: 0xFFFFFF, toneMapped: false });
    this.padMesh = new T.InstancedMesh(pg, this.padMat, 4); this.padMesh.frustumCulled = false; this.scene.add(this.padMesh);
    const ig = new T.OctahedronGeometry(0.55, 0); this.itemMesh = new T.InstancedMesh(ig, this.mat({ color: 0xFFFFFF, roughness: 0.15, metalness: 0.6, emissive: 0x333333, phys: true }), 10); this.itemMesh.castShadow = true; this.itemMesh.frustumCulled = false; this.scene.add(this.itemMesh);
    const hg = new T.RingGeometry(0.75, 1.0, 28); hg.rotateX(-Math.PI / 2);
    this.itemHalo = new T.InstancedMesh(hg, new T.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }), 10); this.itemHalo.frustumCulled = false; this.itemHalo.setColorAt(0, this.tmpC.set(0xFFFFFF)); this.itemMesh.setColorAt(0, this.tmpC); this.scene.add(this.itemHalo);
    this.propRound = -1;
  }
  // 범퍼카: 모양 3종 × (차체 · 줄무늬/헬멧 · 고무 범퍼/좌석/기둥) — 차체와 줄무늬는 인스턴스 색
  carParts(shape) {
    const T = THREE, body = [], sec = [], dark = [], R = BP_CAR_R;
    // 고무 범퍼 (둥근 고리) · 바닥
    const skirt = new T.LatheGeometry([new T.Vector2(0.01, 0.06), new T.Vector2(R * 0.92, 0.06), new T.Vector2(R * 1.0, 0.14), new T.Vector2(R * 1.02, 0.3), new T.Vector2(R * 0.96, 0.44), new T.Vector2(R * 0.82, 0.48), new T.Vector2(0.01, 0.48)], 22);
    dark.push(bp3P(skirt, 0, 0, 0, 0x222831));
    if (shape === 0) {          // 동글이: 둥근 욕조 + 앞 코 + 등받이
      body.push(bp3P(new T.SphereGeometry(0.9, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.42, 0, null, 0, 0, 0, 1.0, 0.62, 0.86));
      body.push(bp3P(new T.SphereGeometry(0.5, 14, 8), 0.62, 0.62, 0, null, 0, 0, 0, 0.75, 0.55, 1.25));
      body.push(bp3P(new T.BoxGeometry(0.34, 0.75, 1.28), -0.7, 0.92, 0, null, 0, 0, 0.18));
      sec.push(bp3P(new T.TorusGeometry(0.84, 0.07, 6, 24), 0, 0.72, 0, null, Math.PI / 2, 0, 0, 1, 0.86, 1));
    } else if (shape === 1) {   // 쌩쌩이: 낮고 뾰족한 앞 + 뒤 날개
      body.push(bp3P(new T.SphereGeometry(0.9, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), -0.05, 0.42, 0, null, 0, 0, 0, 1.08, 0.45, 0.82));
      body.push(bp3P(new T.ConeGeometry(0.5, 1.1, 14), 0.72, 0.58, 0, null, 0, 0, -Math.PI / 2, 1, 1, 0.75));
      sec.push(bp3P(new T.BoxGeometry(0.28, 0.08, 1.5), -0.82, 1.18, 0), bp3P(new T.BoxGeometry(0.1, 0.42, 0.1), -0.82, 0.96, 0.55), bp3P(new T.BoxGeometry(0.1, 0.42, 0.1), -0.82, 0.96, -0.55));
      sec.push(bp3P(new T.BoxGeometry(1.1, 0.04, 0.22), 0.3, 0.83, 0));
    } else {                    // 방울이: 높은 둥근 몸 + 투명 덮개 테
      body.push(bp3P(new T.CylinderGeometry(0.82, 0.92, 0.55, 22), 0, 0.72, 0));
      body.push(bp3P(new T.SphereGeometry(0.82, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.99, 0, null, 0, 0, 0, 1, 0.42, 1));
      sec.push(bp3P(new T.TorusGeometry(0.62, 0.08, 6, 20), 0.05, 1.32, 0, null, Math.PI / 2), bp3P(new T.SphereGeometry(0.16, 10, 8), 0.6, 1.0, 0.45), bp3P(new T.SphereGeometry(0.16, 10, 8), 0.6, 1.0, -0.45));
    }
    // 운전자 헬멧(줄무늬 색) · 좌석 · 운전대 · 뒤 기둥(전기 범퍼카) · 기둥 끝 불꽃
    const sy = shape === 2 ? 1.25 : 0.95;
    sec.push(bp3P(new T.SphereGeometry(0.3, 14, 10), -0.18, sy + 0.42, 0));
    dark.push(bp3P(new T.BoxGeometry(0.42, 0.22, 0.7), -0.35, sy - 0.08, 0, 0x111827), bp3P(new T.TorusGeometry(0.2, 0.04, 6, 14), 0.2, sy + 0.18, 0, 0x111827, 0, Math.PI / 2, 0.5),
      bp3P(new T.CylinderGeometry(0.035, 0.035, 1.5, 6), -0.82, 1.35, 0, 0xCBD5E1), bp3P(new T.SphereGeometry(0.09, 8, 6), -0.82, 2.12, 0, 0xFDE047));
    return { body, sec, dark };
  }
  buildCars() {
    const T = THREE;
    this.bodyMat = this.mat({ color: 0xFFFFFF, roughness: 0.24, metalness: 0.15, envMapIntensity: 1.0, phys: true });
    this.secMat = this.mat({ color: 0xFFFFFF, roughness: 0.3, metalness: 0.15 });
    this.darkMat = this.mat({ vertexColors: true, roughness: 0.6, metalness: 0.2 });
    this.carM = [];
    for (let s = 0; s < BP3_SHAPES; s++) { const P = this.carParts(s), mk = (parts, mat, colorful) => { const g = bp3Merge(parts.map(p => Object.assign(p, { c: p.c == null ? 0xFFFFFF : p.c })), this.lin && !colorful);
        const m = new T.InstancedMesh(g, mat, BP3_MAXC); m.castShadow = true; m.frustumCulled = false; if (colorful) m.setColorAt(0, this.tmpC.set(0xFFFFFF)); m.count = 0; this.scene.add(m); return m; };   // setColorAt 은 count 만큼 색 칸을 만듦 → count 를 줄이기 전에
      this.carM.push({ body: mk(P.body, this.bodyMat, true), sec: mk(P.sec, this.secMat, true), dark: mk(P.dark, this.darkMat, false) }); }
    // 방패 거품 · 내 차 표시 고리 · 슈퍼 돌진 고리 · 동그란 그림자(low)
    this.shieldMesh = new T.InstancedMesh(new T.SphereGeometry(1.55, 18, 12), new T.MeshBasicMaterial({ color: this.color3(0x7DD3FC), transparent: true, opacity: 0.28, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }), BP3_MAXC);
    this.shieldMesh.frustumCulled = false; this.scene.add(this.shieldMesh);
    const ring = new T.RingGeometry(1.35, 1.6, 32); ring.rotateX(-Math.PI / 2);
    this.auraMesh = new T.InstancedMesh(ring, new T.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }), BP3_MAXC); this.auraMesh.frustumCulled = false; this.auraMesh.setColorAt(0, this.tmpC.set(0xFFFFFF)); this.scene.add(this.auraMesh);
    const btex = bp3Canvas(64, 64, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
    const bgeo = new T.PlaneGeometry(2.8, 2.8); bgeo.rotateX(-Math.PI / 2);
    this.blob = new T.InstancedMesh(bgeo, new T.MeshBasicMaterial({ map: btex, transparent: true, depthWrite: false }), BP3_MAXC); this.blob.frustumCulled = false; this.blob.visible = !this.renderer.shadowMap.enabled; this.scene.add(this.blob);
  }
  // 불꽃 · 물보라 · 충격 고리
  buildFx() {
    const T = THREE, ptex = bp3Canvas(64, 64, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
    const mk = (n, size, add) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('color', new T.BufferAttribute(new Float32Array(n * 3), 3)); g.setDrawRange(0, 0);
      const pts = new T.Points(g, new T.PointsMaterial({ size, map: ptex, vertexColors: true, transparent: true, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending, toneMapped: false })); pts.frustumCulled = false; this.scene.add(pts); return { pts, n, list: [] }; };
    this.sparks = mk(260, 0.42, true); this.puffs = mk(140, 1.3, true);   // 연기 · 물보라도 더하기 섞기 (보통 섞기로 흐려지면 검은 점이 됨)
    const rg = new T.RingGeometry(0.9, 1.0, 40); rg.rotateX(-Math.PI / 2);
    this.ringFx = new T.InstancedMesh(rg, new T.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }), 24); this.ringFx.frustumCulled = false; this.ringFx.setColorAt(0, this.tmpC.set(0)); this.ringFx.count = 0; this.scene.add(this.ringFx);
    this.rings3 = [];
  }
  emit(sys, x, y, z, n, spd, col, life, up, grav) {
    const lim = this.q === 0 ? Math.ceil(n / 2) : n;
    for (let i = 0; i < lim; i++) { if (sys.list.length >= sys.n) sys.list.shift(); const a = Math.random() * Math.PI * 2, v = spd * (0.4 + Math.random() * 0.8), e = Math.random();
      sys.list.push({ x, y, z, vx: Math.cos(a) * v, vy: (up || 0) * (0.5 + e), vz: Math.sin(a) * v, l: life * (0.6 + Math.random() * 0.6), l0: life, c: col, g: grav == null ? 14 : grav }); }
  }
  ringAt(x, y, z, s, hex, ms) { if (this.rings3.length >= 24) this.rings3.shift(); this.rings3.push({ x, y, z, s, c: this.color3(hex || 0xFFFFFF), t: 0, d: (ms || 500) / 1000 }); }
  // 규칙 쪽이 쌓은 효과(this.fx) + 친구 차의 사건(떨어짐 · 돌진)을 입자로
  spawnFx(dt) {
    while (this.fx.length) { const f = this.fx.shift();
      if (f.kind === 'spark') { this.emit(this.sparks, f.x, f.y + 0.3, f.z, Math.round(10 + 10 * f.s), 5 + 3 * f.s, [1, 0.85, 0.35], 0.45, 4); this.emit(this.sparks, f.x, f.y + 0.3, f.z, 6, 3, [1, 1, 1], 0.25, 3); this.ringAt(f.x, 0.08, f.z, 0.8 + f.s * 0.5, 0xFFE08A, 380); }
      else if (f.kind === 'ring') this.ringAt(f.x, f.y, f.z, 1.2 * f.s, f.c ? new THREE.Color(f.c).getHex() : 0x9BE7FF, 520);
      else if (f.kind === 'splash') this.splash(f.x, f.z);
      else if (f.kind === 'spawn') { this.ringAt(f.x, 0.1, f.z, 1.1, 0x8BFFB0, 650); this.emit(this.sparks, f.x, 0.5, f.z, 16, 2.5, [0.5, 1, 0.7], 0.6, 6, 2); }
      else if (f.kind === 'dash') this.emit(this.puffs, f.x, 0.4, f.z, 5, 1.2, [0.45, 0.47, 0.5], 0.5, 1, -1); }
  }
  splash(x, z) { const y = BP_FALL_Y - 1.8; this.emit(this.puffs, x, y, z, 26, 4, [0.6, 0.66, 0.7], 1.1, 9, 12); this.emit(this.sparks, x, y, z, 14, 5, [0.75, 0.92, 1], 0.8, 10, 14); this.ringAt(x, y + 0.05, z, 1.6, 0xDDEEFF, 1000); }
  stepFx(dt) {
    [this.sparks, this.puffs].forEach(S => { const pos = S.pts.geometry.attributes.position.array, col = S.pts.geometry.attributes.color.array; let n = 0;
      S.list = S.list.filter(p => (p.l -= dt) > 0);
      for (const p of S.list) { p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; const k = Math.min(1, p.l / p.l0 * 1.6);
        pos[n * 3] = p.x; pos[n * 3 + 1] = p.y; pos[n * 3 + 2] = p.z; col[n * 3] = p.c[0] * k; col[n * 3 + 1] = p.c[1] * k; col[n * 3 + 2] = p.c[2] * k; n++; }
      S.pts.geometry.setDrawRange(0, n); S.pts.geometry.attributes.position.needsUpdate = true; S.pts.geometry.attributes.color.needsUpdate = true; });
    const R = this.ringFx; let n = 0;
    this.rings3 = this.rings3.filter(r => (r.t += dt) < r.d);
    for (const r of this.rings3) { const k = r.t / r.d, s = r.s * (0.6 + k * 1.8); this.tmpP.set(r.x, r.y, r.z); this.tmpQ.set(0, 0, 0, 1); this.tmpS.set(s, 1, s); this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS); R.setMatrixAt(n, this.tmpM);
      this.tmpC.copy(r.c).multiplyScalar(0.75 * (1 - k) * (1 - k)); R.setColorAt(n, this.tmpC); n++; }
    R.count = n; R.instanceMatrix.needsUpdate = true; if (R.instanceColor) R.instanceColor.needsUpdate = true;
  }

  // ══ 매 프레임 그림 ══
  draw() {
    if (this._dead || !this.renderer) return;
    if (this.host.clientWidth !== this.vw || this.host.clientHeight !== this.vh) this.resize();
    const now = this.now || 0, dt = this.drawAt ? Math.min(0.1, Math.max(0, (now - this.drawAt) / 1000)) : 0.016; this.drawAt = now;
    const ri = this.roundInfo(), L = this.arena.round(ri.r), t = ri.t;
    this.updateTiles(ri, L, now);
    this.updateProps(ri, L, now);
    this.updateCars(now, dt);
    this.spawnFx(dt); this.stepFx(dt);
    // 친구 차가 바다에 닿으면 물보라 (한 번)
    for (const id in this.peers) { const p = this.peers[id]; if (p.falling && p.y < BP_FALL_Y && p.splashed !== p.life) { p.splashed = p.life; this.splash(p.x, p.z); } if (p.dashing && Math.random() < dt * 22) this.emit(this.puffs, p.x, 0.4, p.z, 1, 1, [0.4, 0.42, 0.45], 0.45, 1, -1); }
    if (now < this.dashUntil && Math.random() < dt * 30) this.emit(this.puffs, this.x, 0.4, this.z, 1, 1, [0.4, 0.42, 0.45], 0.45, 1, -1);
    this.seaMat.uniforms.t.value = now / 1000;
    // 구름 흘러감
    if (this.clouds) { const C = this.clouds, cq = this.camera.quaternion;
      this.cloudData.forEach((c, i) => { let x = c.x + ((now / 1000 * c.v) % 300); if (x > 220) x -= 440; this.tmpP.set(x, c.y, c.z); this.tmpS.set(c.s, c.s, 1); this.tmpM.compose(this.tmpP, cq, this.tmpS); C.setMatrixAt(i, this.tmpM); });
      C.instanceMatrix.needsUpdate = true; }
    this.updateCamera(dt, now);
    this.sea.position.x = this.camera.position.x; this.sea.position.z = this.camera.position.z; this.seaMat.uniforms.camP.value.copy(this.camera.position);
    this.renderer.render(this.scene, this.camera);
    this.drawHud(ri, L);
    if (now - this.btnAt > 120) { this.btnAt = now; this.paintButton(); }
  }
  // 조각: 흔들림(경고) · 떨어짐 · 라운드 시작 때 솟아오름 — 바뀌는 조각만 행렬을 고침
  updateTiles(ri, L, now) {
    const A = this.arena, t = ri.pre ? 0 : ri.t, red = this.color3(0xFF3B30);
    for (let k = 1; k <= A.K; k++) { const mesh = this.rings[k], st = this.tileState[k], fall = L.fall[k]; let dirty = false, cdirty = false;
      for (let s = 0; s < st.length; s++) { const o = st[s], ft = fall[s];
        let mode = t >= ft ? 2 : t >= ft - BP_WARN_MS ? 1 : (!ri.pre && t < 1400 && ri.r > 0) ? 3 : 0;
        if (mode === 2 && t - ft > 4000) mode = 4;                                 // 다 떨어져 숨김
        if (mode === 0 && o.mode === 0) continue; if (mode === 4 && o.mode === 4) continue;
        let y = 0, rx = 0, rz = 0, sc = 1;
        if (mode === 1) { const k2 = (t - (ft - BP_WARN_MS)) / BP_WARN_MS, w = Math.sin(now / 38 + s * 1.7) * 0.06 * (0.3 + k2); y = w * 0.6; rx = w * 0.5; rz = Math.cos(now / 45 + s) * 0.04 * k2;
          const pulse = 0.5 + 0.5 * Math.sin(now / (130 - 70 * k2)); this.tmpC.copy(o.base).lerp(red, Math.min(1, 0.25 + 0.65 * k2 * pulse)); mesh.setColorAt(s, this.tmpC); cdirty = true; }
        else if (mode === 2) { const tt = (t - ft) / 1000; y = -0.5 * 18 * tt * tt; rx = tt * (bpHash(s, k, 1) - 0.5) * 2.4; rz = tt * (bpHash(s, k, 2) - 0.2) * 1.6; if (o.mode !== 2) { mesh.setColorAt(s, red); cdirty = true; this.emit(this.puffs, o.sx, -0.4, o.sz, 4, 1.4, [0.35, 0.3, 0.26], 0.8, 0.5, 2); } }
        else if (mode === 3) { const e = Math.min(1, t / 1200); y = -7 * Math.pow(1 - e, 3); if (o.mode !== 3) { mesh.setColorAt(s, o.base); cdirty = true; } }
        else if (mode === 0 && o.mode !== 0) { mesh.setColorAt(s, o.base); cdirty = true; }
        if (mode === 4) { sc = 0.0001; y = -80; }
        o.mode = mode;
        this.tmpE.set(rx, -o.th, rz, 'YXZ'); this.tmpQ.setFromEuler(this.tmpE); this.tmpP.set(o.sx, y, o.sz); this.tmpS.set(sc, sc, sc); this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS); mesh.setMatrixAt(s, this.tmpM); dirty = true; }
      if (dirty) mesh.instanceMatrix.needsUpdate = true; if (cdirty && mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
  }
  updateProps(ri, L, now) {
    const t = ri.pre ? 0 : ri.t, M = this.tmpM, P = this.tmpP, Q = this.tmpQ, S = this.tmpS;
    const tileY = (k, s) => { const ft = L.fall[k][s]; if (t >= ft) { const tt = (t - ft) / 1000; return -0.5 * 18 * tt * tt; } return (t < 1400 && ri.r > 0) ? -7 * Math.pow(1 - Math.min(1, t / 1200), 3) : 0; };
    let n = 0; for (const b of L.bumpers) { const y = tileY(b.k, b.s); if (y < -60) continue; const hit = b.hitAt && now - b.hitAt < 260 ? 1 + 0.18 * Math.sin((now - b.hitAt) / 260 * Math.PI) : 1;
      P.set(b.x, y, b.z); Q.set(0, 0, 0, 1); S.set(hit, 1 / hit, hit); M.compose(P, Q, S); this.bumpMesh.setMatrixAt(n++, M); }
    this.bumpMesh.count = n; this.bumpMesh.instanceMatrix.needsUpdate = true;
    n = 0; for (const p of L.pads) { const y = tileY(p.k, p.s); if (y < -60) continue; const s = 1 + 0.06 * Math.sin(now / 160); P.set(p.x, y + 0.03, p.z); Q.setFromAxisAngle(this.vUp, -Math.atan2(-p.z, -p.x) + Math.PI / 2); S.set(s, 1, s); M.compose(P, Q, S); this.padMesh.setMatrixAt(n++, M); }
    this.padMesh.count = n; this.padMesh.instanceMatrix.needsUpdate = true;
    n = 0; this.itemsShown = [];
    for (const it of L.items) { if (t < it.t0 || t >= it.t1 || this.taken[it.id] || ri.pre) continue; const k = Math.min(1, (t - it.t0) / 400), bob = 0.9 + 0.18 * Math.sin(now / 300 + n);
      P.set(it.x, bob, it.z); Q.setFromAxisAngle(this.vUp, now / 600 + n); S.set(k, k * 1.25, k); M.compose(P, Q, S); this.itemMesh.setMatrixAt(n, M); this.itemMesh.setColorAt(n, this.lin ? this.tmpC.set(BP_ITEMS[it.kind].color).convertSRGBToLinear() : this.tmpC.set(BP_ITEMS[it.kind].color));
      const hs = 1 + 0.15 * Math.sin(now / 200 + n); P.set(it.x, 0.06, it.z); Q.set(0, 0, 0, 1); S.set(hs, 1, hs); M.compose(P, Q, S); this.itemHalo.setMatrixAt(n, M); this.itemHalo.setColorAt(n, this.tmpC);
      this.itemsShown.push(it); n++; }
    this.itemMesh.count = this.itemHalo.count = n; this.itemMesh.instanceMatrix.needsUpdate = this.itemHalo.instanceMatrix.needsUpdate = true;
    if (this.itemMesh.instanceColor) this.itemMesh.instanceColor.needsUpdate = true; if (this.itemHalo.instanceColor) this.itemHalo.instanceColor.needsUpdate = true;
  }
  // 차 그리기: 나 + 친구들 (경기장 위 · 점프 중 · 떨어지는 중)
  updateCars(now, dt) {
    const cars = this._cars || (this._cars = []); cars.length = 0;
    const me = { me: true, x: this.x, y: this.y, z: this.z, h: this.h, skin: Math.max(0, this.skin), heavy: this.has('heavy'), shield: this.has('shield'), sup: this.has('super'), ghost: this.alive && now < this.ghostUntil, dash: now < this.dashUntil,
      falling: this.state === 'fall', stun: now < this.stunUntil, dim: false, vx: this.vx, vz: this.vz, id: this.myId, pct: this.pct, name: this.myName };
    if (this.state !== 'dead') cars.push(me);
    for (const id in this.peers) { const p = this.peers[id]; if (p.out || p.tx == null || (p.falling && p.y < BP_FALL_Y - 3)) continue;
      cars.push({ me: false, x: p.x, y: p.y || 0, z: p.z, h: p.h, skin: p.skin, heavy: p.heavy, shield: p.shield, sup: p.sup, ghost: p.ghost, dash: p.dashing, falling: p.falling, stun: false, dim: !!p.gone || now - (p.seen || 0) > 2500, vx: p.vx, vz: p.vz, id, pct: p.pct, name: p.name, p }); }
    this.carsShown = cars;
    const cnt = [0, 0, 0], M = this.tmpM, P = this.tmpP, Q = this.tmpQ, S = this.tmpS; let ns = 0, na = 0, nb = 0;
    for (const c of cars) {
      const sk = bp3Skin(c.skin), m = this.carM[sk.sh], i = cnt[sk.sh]++; if (i >= BP3_MAXC) continue;
      const blink = c.ghost && Math.floor(now / 110) % 2 === 0, sc = (c.heavy ? 1.2 : 1) * (blink ? 0.0001 : 1);
      let rx = 0, rz = 0; if (c.falling) { const k = Math.max(0, -c.y) * 0.12; rx = Math.sin(c.id.length + now / 300) * k; rz = k * 1.3; }
      else { const sp = Math.hypot(c.vx || 0, c.vz || 0); rz = -Math.min(0.12, sp * 0.008); if (c.stun) rx = Math.sin(now / 40) * 0.08; }
      const bob = c.falling ? 0 : Math.sin(now / 90 + c.skin) * 0.015;
      this.tmpE.set(rx, -c.h, rz, 'YXZ'); Q.setFromEuler(this.tmpE); P.set(c.x, c.y + bob, c.z); S.set(sc, sc, sc); M.compose(P, Q, S);
      m.body.setMatrixAt(i, M); m.sec.setMatrixAt(i, M); m.dark.setMatrixAt(i, M);
      const dim = c.dim ? 0.35 : 1;
      this.tmpC.set(sk.col).convertSRGBToLinear(); if (!this.lin) this.tmpC.set(sk.col); if (c.heavy) this.tmpC.lerp(this.grey || (this.grey = this.color3(0x777777)), 0.45); this.tmpC.multiplyScalar(dim); m.body.setColorAt(i, this.tmpC);
      this.tmpC.set(sk.sec); if (this.lin) this.tmpC.convertSRGBToLinear(); this.tmpC.multiplyScalar(dim); m.sec.setColorAt(i, this.tmpC);
      if (c.shield && !c.falling) { P.set(c.x, c.y + 0.7, c.z); Q.set(0, 0, 0, 1); const s2 = 1 + 0.04 * Math.sin(now / 120); S.set(s2, s2 * 0.85, s2); M.compose(P, Q, S); this.shieldMesh.setMatrixAt(ns++, M); }
      if ((c.me || c.sup || c.dash) && !c.falling && c.y > -1) { const s3 = c.sup ? 1 + 0.1 * Math.sin(now / 90) : 1; P.set(c.x, c.y + 0.05, c.z); Q.set(0, 0, 0, 1); S.set(s3, 1, s3); M.compose(P, Q, S); this.auraMesh.setMatrixAt(na, M);
        this.tmpC.set(c.sup ? 0xFFD447 : c.dash ? 0xFFFFFF : (this.dashReady() ? 0x7CFFB2 : 0x9AA5B1)); this.tmpC.multiplyScalar(c.me && !c.sup ? 0.9 : 1); this.auraMesh.setColorAt(na++, this.tmpC); }
      if (this.blob.visible && !c.falling && c.y > -1) { const bs = 1 / (1 + Math.max(0, c.y) * 0.25); P.set(c.x, 0.03, c.z); Q.set(0, 0, 0, 1); S.set(bs, 1, bs); M.compose(P, Q, S); this.blob.setMatrixAt(nb++, M); }
    }
    for (let s = 0; s < BP3_SHAPES; s++) { const m = this.carM[s], n = Math.min(BP3_MAXC, cnt[s]); ['body', 'sec', 'dark'].forEach(k => { m[k].count = n; m[k].instanceMatrix.needsUpdate = true; if (m[k].instanceColor) m[k].instanceColor.needsUpdate = true; }); }
    this.shieldMesh.count = ns; this.shieldMesh.instanceMatrix.needsUpdate = true;
    this.auraMesh.count = na; this.auraMesh.instanceMatrix.needsUpdate = true; if (this.auraMesh.instanceColor) this.auraMesh.instanceColor.needsUpdate = true;
    this.blob.count = nb; this.blob.instanceMatrix.needsUpdate = true;
  }
  // 카메라: 북쪽이 위 · 내 차를 따라가되 경기장 가운데 쪽으로 조금 당겨 가장자리가 보이게 · 부딪히면 흔들림
  updateCamera(dt, now) {
    const cam = this.camera, ri = this.roundInfo();
    let fx = this.x, fz = this.z; if (this.state === 'dead' || this.state === 'wait') { fx = this.x * 0.5; fz = this.z * 0.5; }
    if (this.state === 'fall') { fx = this.x; fz = this.z; }
    const tx = fx * 0.72, tz = fz * 0.72 + 1.5, ty = this.state === 'fall' ? Math.max(-6, this.y * 0.25) : 0;
    const k = this.camSnap ? 1 : 1 - Math.exp(-dt * 4.5); this.camSnap = false;
    this.camT.x += (tx - this.camT.x) * k; this.camT.z += (tz - this.camT.z) * k; this.camT.y += (ty - this.camT.y) * k;
    const d = this.camDist || 40, sh = this.shake || 0, jx = sh * (Math.sin(now / 23) * 0.5 + Math.sin(now / 37)) * 0.35, jy = sh * Math.sin(now / 29) * 0.3;
    cam.position.set(this.camT.x + jx, this.camT.y + Math.sin(BP3_PITCH) * d + jy, this.camT.z + Math.cos(BP3_PITCH) * d);
    cam.lookAt(this.camT.x + jx * 0.5, this.camT.y, this.camT.z);
  }
  project(x, y, z) { const v = this.tmpV.set(x, y, z).project(this.camera); return v.z > 1 ? null : [(v.x + 1) / 2 * this.vw, (1 - v.y) / 2 * this.vh]; }
  // ⚡ 버튼: 돌진 준비되면 밝게 · 기다리는 동안 흐리게 + 남은 초
  paintButton() {
    if (typeof document === 'undefined') return; const b = document.getElementById('aboost'); if (!b) return;
    const ready = this.dashReady() && !this.frozen(), sm = b.querySelector('small'), left = Math.max(0, this.dashReadyAt - this.now);
    b.style.opacity = ready ? '1' : '0.55'; const txt = !this.alive ? '돌진' : ready ? '돌진!' : (left / 1000).toFixed(1);
    if (sm && sm.textContent !== txt) sm.textContent = txt;
  }

  // ══ HUD ══
  drawHud(ri, L) {
    const c = this.ctx, dpr = this.hudDpr || 1, W = this.vw, H = this.vh, now = this.now, srv = this.srv();
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    const small = Math.min(W, H) < 520, U = small ? 0.85 : 1;
    // 이름표 · 충격 % (가까운 차만) · 아이템 그림
    for (const car of this.carsShown || []) { if (car.falling && car.y < -3) continue; const p = this.project(car.x, car.y + 2.5, car.z); if (!p) continue;
      if (!car.me && (p[0] < -40 || p[0] > W + 40 || p[1] < -20 || p[1] > H + 20)) continue;
      const sk = bp3Skin(car.skin), nm = car.me ? '나' : (car.name || '친구'); c.globalAlpha = car.dim ? 0.45 : 1;
      c.font = '800 ' + Math.round(12 * U) + 'px ' + BP_FONT; const w = Math.min(110, c.measureText(nm).width + 14);
      bp3RR(c, p[0] - w / 2, p[1] - 9 * U, w, 18 * U, 9 * U); c.fillStyle = car.me ? 'rgba(255,255,255,0.92)' : 'rgba(12,18,36,0.62)'; c.fill();
      c.fillStyle = bp3Css(sk.col); c.beginPath(); c.arc(p[0] - w / 2 + 7, p[1], 3.2, 0, 7); c.fill();
      bp3TF(c, nm, p[0] + 3, p[1] + 0.5, 12 * U, w - 16, car.me ? '#111827' : '#fff', 'center', false);
      if (car.pct >= 1) { const pc = Math.round(car.pct); bp3T(c, pc + '%', p[0], p[1] + 15 * U, 12 * U, this.pctColor(pc)); }
      c.globalAlpha = 1; }
    for (const it of this.itemsShown || []) { const p = this.project(it.x, 2.1, it.z); if (p) bp3T(c, BP_ITEMS[it.kind].icon, p[0], p[1], 22 * U, '#fff', 'center', false); }
    // 왼쪽 위: 내 충격 % · 점수 · 순위
    const st = this.standings(), myR = st.findIndex(e => e.me) + 1, x0 = 60, y0 = 10, narrow = W < 640;   // 왼쪽 위 ← · 소리 버튼(index.html) 자리는 비움
    bp3RR(c, x0, y0, 168 * U, 84 * U, 14); c.fillStyle = 'rgba(10,16,34,0.58)'; c.fill();
    const pc = Math.round(this.pct); bp3T(c, '충격', x0 + 12, y0 + 18 * U, 13 * U, '#CBD5E1', 'left', false, 700);
    bp3T(c, this.alive || this.state === 'wait' ? pc + '%' : '—', x0 + 12, y0 + 46 * U, 34 * U, this.pctColor(pc), 'left');
    bp3T(c, '점수 ' + this.score, x0 + 158 * U, y0 + 22 * U, 17 * U, '#FFD447', 'right');
    bp3T(c, myR + '등 / ' + st.length, x0 + 158 * U, y0 + 46 * U, 14 * U, '#fff', 'right', false);
    bp3T(c, '떨어뜨림 ' + this.kills, x0 + 158 * U, y0 + 68 * U, 12 * U, '#9BF6C8', 'right', false, 700);
    // 위 가운데: 남은 시간 · 라운드 · 경기장 남은 크기
    const cx = W / 2; let ty = narrow ? y0 + 84 * U + 18 : 22;            // 좁은 화면: 시간은 점수판 아래 가운데
    if (this.endAt > 0) { const left = Math.max(0, (this.gameOver ? this.endTs : this.endAt) - srv), last = left <= 10500 && !this.gameOver, pulse = last ? 1 + 0.1 * Math.sin(now / 90) : 1;
      bp3T(c, bp3Clock(left), cx, ty + 2, 26 * U * pulse, last ? '#FF5C5C' : '#fff'); ty += 26; }
    if (!ri.pre) { const rl = BP_ROUND_MS - ri.t, fr = this.arena, alive = this.liveTiles(ri, L);
      bp3T(c, '라운드 ' + (ri.r + 1) + (rl < 10500 ? ' · ' + Math.ceil(rl / 1000) + '초 뒤 다시 넓어짐' : ''), cx, ty + 2, 13 * U, '#E2E8F0', 'center', 'rgba(10,16,34,0.8)', 700);
      const bw = 120 * U, bx = cx - bw / 2, by = ty + 12; bp3RR(c, bx, by, bw, 7, 3.5); c.fillStyle = 'rgba(10,16,34,0.55)'; c.fill();
      bp3RR(c, bx, by, Math.max(7, bw * alive), 7, 3.5); c.fillStyle = alive < 0.35 ? '#FF7A59' : '#5EEAD4'; c.fill(); }
    // 오른쪽 위: 순위표 (5명 + 나)
    const rows = st.slice(0, small ? 4 : 5); if (myR > rows.length) rows.push(st[myR - 1]);
    const bw2 = 138 * U, bx2 = W - bw2 - 10, rh = 19 * U; bp3RR(c, bx2, 10, bw2, rows.length * rh + 10, 12); c.fillStyle = 'rgba(10,16,34,0.5)'; c.fill();
    rows.forEach((e, i) => { const y = 10 + 5 + rh * (i + 0.5), rk = st.indexOf(e) + 1, sk = bp3Skin(e.me ? this.skin : (this.peers[e.id] ? this.peers[e.id].skin : 0));
      if (e.me) { bp3RR(c, bx2 + 3, y - rh / 2 + 1, bw2 - 6, rh - 2, 8); c.fillStyle = 'rgba(255,255,255,0.18)'; c.fill(); }
      bp3T(c, rk + '', bx2 + 14, y, 12 * U, rk === 1 ? '#FFD447' : '#CBD5E1', 'center', false);
      c.fillStyle = bp3Css(sk.col); c.beginPath(); c.arc(bx2 + 28, y, 4, 0, 7); c.fill();
      bp3TF(c, e.me ? (this.myName || '나') : e.name, bx2 + 37, y, 12 * U, bw2 - 74, '#fff', 'left', false, 700);
      bp3T(c, String(e.s), bx2 + bw2 - 10, y, 13 * U, '#FFD447', 'right', false); });
    // 알림: 누가 누구를 떨어뜨렸나
    let fy = 10 + rows.length * rh + 26; c.textBaseline = 'middle';
    for (const f of this.feed.slice(0, small ? 3 : 4)) { const txt = f.kind === 'ko' ? f.a + ' ➜ ' + f.b : f.b + ' 퐁당!', col = f.me === 1 ? '#FFD447' : f.me === 2 ? '#FF8A8A' : '#fff';
      c.font = '700 ' + Math.round(12 * U) + 'px ' + BP_FONT; const w = Math.min(W * 0.5, c.measureText(txt).width + 16); bp3RR(c, W - w - 10, fy - 10, w, 20, 10); c.fillStyle = 'rgba(10,16,34,0.55)'; c.fill();
      bp3TF(c, txt, W - 18, fy, 12 * U, w - 14, col, 'right', false, 700); fy += 24; }
    // 내 차 아래 돌진 준비 고리 · 바닥 경고
    if (this.alive) { const p = this.project(this.x, 0, this.z); if (p) { const left = Math.max(0, this.dashReadyAt - now), k = 1 - left / this.dashCdOf();
        if (left > 0) { c.lineWidth = 4; c.strokeStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.arc(p[0], p[1] + 30, 11, 0, 7); c.stroke(); c.strokeStyle = '#7CFFB2'; c.beginPath(); c.arc(p[0], p[1] + 30, 11, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); c.stroke(); } }
      const ft = this.arena.fallTime(L, this.x, this.z), warn = !ri.pre && ft - ri.t < BP_WARN_MS + 400 && ft > ri.t;
      if (warn) { const a = 0.25 + 0.2 * Math.sin(now / 80), g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75); g.addColorStop(0, 'rgba(255,40,40,0)'); g.addColorStop(1, 'rgba(255,40,40,' + a + ')'); c.fillStyle = g; c.fillRect(0, 0, W, H);
        bp3T(c, '⚠ 바닥이 떨어져요! 안쪽으로!', W / 2, H * 0.3, 22 * U, '#FFD0D0'); } }
    // 떨어짐 · 부활 기다림
    if (this.state === 'dead' && !this.gameOver && srv >= this.startAt && this.respawnAt > 0) { const left = Math.max(0, this.respawnAt - now); bp3T(c, '퐁당!', W / 2, H * 0.4, 44 * U, '#7DD3FC'); bp3T(c, (left / 1000).toFixed(1) + '초 뒤 다시 출발', W / 2, H * 0.4 + 40, 18 * U, '#fff'); }
    // 시작 카운트다운
    if (srv < this.startAt) { const s = Math.ceil((this.startAt - srv) / 1000); bp3T(c, s > 0 ? String(s) : 'GO!', W / 2, H * 0.42, 72 * U, '#FFD447'); bp3T(c, '곧 시작해요', W / 2, H * 0.42 + 54, 18 * U, '#fff'); }
    // 알림 글자
    let toY = H * 0.62; if (!this.gameOver) for (const t of this.toasts.slice(-3)) { const a = Math.min(1, (t.until - now) / 300); c.globalAlpha = a; bp3TF(c, t.text, W / 2, toY, 19 * U, W - 40, t.color); toY += 28; } c.globalAlpha = 1;
    // 큰 안내 (라운드 시작 · 경고 · 시간 끝)
    const b = this.banner; if (b && now < b.until) { const k = Math.min(1, (now - b.at) / 220), a = Math.min(1, (b.until - now) / 400), sc = 0.7 + 0.3 * k;
      c.globalAlpha = a; bp3TF(c, b.text, W / 2, H * 0.24, 40 * U * sc, W - 30, b.color); if (b.sub) bp3TF(c, b.sub, W / 2, H * 0.24 + 38 * U, 16 * U, W - 30, '#fff'); c.globalAlpha = 1; }
    // 처음 출격: 조작 안내
    if (this.guideAt && now - this.guideAt < 6500 && !this.gameOver) { const a = Math.min(1, (6500 - (now - this.guideAt)) / 500), gw = Math.min(W - 30, 400), gh = 92 * U, gx = (W - gw) / 2, gy = H - gh - (small ? 130 : 150);
      c.globalAlpha = a; bp3RR(c, gx, gy, gw, gh, 16); c.fillStyle = 'rgba(10,16,34,0.78)'; c.fill();
      bp3TF(c, '🕹 조이스틱 = 운전   ⚡ 버튼 = 돌진!', W / 2, gy + 24 * U, 17 * U, gw - 20, '#fff');
      bp3TF(c, '친구를 밀어 경기장 밖으로 떨어뜨리면 +3점', W / 2, gy + 50 * U, 15 * U, gw - 20, '#FFD447', 'center', false, 700);
      bp3TF(c, '빨갛게 흔들리는 바닥은 곧 떨어져요 · 많이 맞을수록 충격%↑ 멀리 날아가요', W / 2, gy + 72 * U, 12 * U, gw - 20, '#CBD5E1', 'center', false, 600); c.globalAlpha = 1; }
  }
  pctColor(p) { return p < 30 ? '#FFFFFF' : p < 70 ? '#FFE066' : p < 120 ? '#FFA94D' : '#FF5C5C'; }
  liveTiles(ri, L) { if (!this._tileTot) this._tileTot = this.arena.tiles; let n = 0; for (let k = 1; k <= this.arena.K; k++) for (const ft of L.fall[k]) if (ft > ri.t) n++; return n / this._tileTot; }
}
