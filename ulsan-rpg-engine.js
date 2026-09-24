// 울산 환경 수사대 3D — 추리 롤플레잉 (어려움)
//   울산을 본뜬 3D 지도를 돌아다니며 직접 조사한 사실로 오염물질 · 범인 시설 · 정확한 배출 지점 · 배출 시각을 밝힙니다
//   사건·증거 계산은 ulsan-case.js (진실 하나에서 모든 증거가 일관되게)
//   조작: 조이스틱(또는 WASD) 이동 · 🔍 버튼(또는 E·스페이스) 조사/대화 · 위 버튼 수첩·지도·보고서
class UlsanRpgGame {
  constructor(canvas, opts) {
    this.opts = opts || {}; this.glCanvas = canvas; this.host = canvas.parentElement;
    this.seed = this.opts.seed || Date.now(); this.C = ucMakeCase(this.seed); this.rnd = ucRng(this.seed + 99);
    this.nowH = this.C.startH; this.score = 0; this.gameOver = false; this.lastTime = 0; this.now = 0;
    this.px = 16; this.pz = -2; this.heading = Math.PI; this.mx = 0; this.my = 0; this.keys = {};
    this.samples = []; this.pending = []; this.evidence = []; this.known = {}; this.talked = {}; this.visited = {}; this.report = null; this.ui = {};
    this.initThree(); this.buildWorld(); this.buildPeople(); this.buildUI(); this.bindKeys(); this.resize();
    this.addEvidence({ id: 'case', title: '📄 사건 개요', key: false, html: this.caseBrief() });
    this.toast('수사 시작! 오늘 저녁 8시까지 오염원을 밝혀 보고서를 내세요');
  }
  // ── 플랫폼 인터페이스 ──
  setMove(x, y) { this.mx = x; this.my = y; }
  setBoost(on) { if (on) this.interact(); }
  resize() { const W = this.host.clientWidth || 800, H = this.host.clientHeight || 600; if (!this.renderer || W < 10) return; this.renderer.setSize(W, H, false); this.glCanvas.style.width = '100%'; this.glCanvas.style.height = '100%'; this.camera.aspect = W / H; this.camera.updateProjectionMatrix(); this.vw = W; this.vh = H; }
  destroy() { try { this.renderer.dispose(); this.ui.root.remove(); removeEventListener('keydown', this._kd); removeEventListener('keyup', this._ku); } catch (e) {} }
  captureTo(g, w, h) { this.renderer.render(this.scene, this.camera); g.drawImage(this.glCanvas, 0, 0, w, h); }
  get evidenceCount() { return this.evidence.length - 1; }
  get timeLeft() { return Math.max(0, this.C.endH - this.nowH); }
  getSnapshot() {                                         // 교사 화면 미니보드: 강(파랑) · 땅 · 나(초록)
    const N = 30, g = []; for (let y = 0; y < N; y++) g.push(new Array(N).fill(65));
    const put = (x, z, v) => { const gx = Math.floor((x + 240) / 500 * N), gz = Math.floor((z + 210) / 460 * N); if (g[gz] && g[gz][gx] != null) g[gz][gx] = v; };
    Object.values(UC_RIVERS).forEach(R => { const L = ucLen(R.pts); for (let s = 0; s < L; s += 6) { const p = ucAt(R.pts, s); put(p[0], p[1], 69); } });
    put(this.px, this.pz, 23); return g;
  }

  // ── 3D 준비 ──
  initThree() {
    const T = THREE;
    this.renderer = new T.WebGLRenderer({ canvas: this.glCanvas, antialias: (window.devicePixelRatio || 1) < 2 });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.scene = new T.Scene(); this.scene.background = new T.Color('#A9D3F0'); this.scene.fog = new T.Fog(new T.Color('#BFDDF2'), 140, 420);
    this.camera = new T.PerspectiveCamera(48, 1, 0.5, 900);
    this.hemi = new T.HemisphereLight(0xEAF4FF, 0x6F7F5A, 0.9); this.scene.add(this.hemi);
    this.sun = new T.DirectionalLight(0xFFF1D6, 0.75); this.sun.position.set(-40, 80, 30); this.scene.add(this.sun);
    if (window.ThreeQuality) { const pq = ThreeQuality.pick(this.renderer, this.opts); this.hq = pq.q; this.hqLocked = !!pq.locked; } else this.hq = 'low';
  }
  // 지형 높이: 서쪽·북쪽·남서쪽은 산, 동쪽은 바다, 하천은 파임
  coastX(z) { return 132 + Math.sin(z / 37) * 9 + (z > 150 ? -4 : 0); }
  riverDist(x, z) { let d = 1e9; Object.values(UC_RIVERS).forEach(R => { const p = ucProject(R.pts, x, z); d = Math.min(d, p.d - R.w * 0.5); }); return d; }
  groundH(x, z) {
    if (x > this.coastX(z)) return -3;
    const n = Math.sin(x * 0.045) * Math.cos(z * 0.05) + Math.sin(x * 0.11 + z * 0.07) * 0.5;
    let h = 0.4 + n * 0.4;
    if (x < -110) h += (-110 - x) * 0.32 * (0.7 + 0.3 * n); if (z < -110) h += (-110 - z) * 0.28 * (0.7 + 0.3 * n);
    if (x < -40 && z > 90 && z < 175) h += 10 + n * 6; if (z > 225) h += (z - 225) * 0.5;
    const rd = this.riverDist(x, z); if (rd < 8) h = Math.min(h, -0.6 + Math.max(0, rd) * 0.18);
    const cd = this.coastX(z) - x; if (cd < 10) h = Math.min(h, cd * 0.08);
    return h;
  }
  zoneOf(x, z) {
    if (x > -60 && x < 60 && z > -60 && z < 60) return 'city';
    if (x > 25 && x < 130 && z > 72 && z < 118) return 'petro';
    if (x > -5 && x < 125 && z > 142 && z < 192) return 'onsan';
    if (x > 60 && x < 160 && z > -110 && z < -40) return 'mipo';
    return '';
  }
  buildWorld() {
    const T = THREE, S = this.scene;
    // 땅 (정점 색: 풀 · 숲 · 바위 · 모래 · 도시 · 공단)
    const geo = new T.PlaneGeometry(520, 470, 130, 118); geo.rotateX(-Math.PI / 2); geo.translate(15, 0, 20);
    const pos = geo.attributes.position, cols = [], c = new T.Color();
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), h = this.groundH(x, z); pos.setY(i, h);
      const zn = this.zoneOf(x, z), sea = x > this.coastX(z) - 3;
      if (sea) c.set('#D8C79A'); else if (h > 22) c.set('#8A8F7E'); else if (h > 7) c.set('#3F7A43'); else if (zn === 'city') c.set('#9EA3AA'); else if (zn === 'petro' || zn === 'onsan' || zn === 'mipo') c.set('#A89F8C'); else c.set(h > 3 ? '#5E9A4C' : '#7DB35A');
      c.offsetHSL(0, 0, (Math.sin(x * 0.3) * Math.cos(z * 0.27)) * 0.025); if (this.hq !== 'low') c.convertSRGBToLinear(); cols.push(c.r, c.g, c.b); }   // 색 보정 모드면 정점 색도 선형으로(안 하면 하얗게 바램)
    geo.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); geo.computeVertexNormals();
    const gm = new T.MeshLambertMaterial({ vertexColors: true }); gm.userData.lin = true; const ground = new T.Mesh(geo, gm); S.add(ground); this.ground = ground;
    const sea = new T.Mesh(new T.PlaneGeometry(900, 900), new T.MeshLambertMaterial({ color: '#2F7FB8' })); sea.rotation.x = -Math.PI / 2; sea.position.set(320, -0.9, 30); S.add(sea);
    // 하천: 물 띠 + 1km 거리표(추리에 필요)
    const waterMat = new T.MeshLambertMaterial({ color: '#3E8FC7' });
    Object.keys(UC_RIVERS).forEach(rid => { const R = UC_RIVERS[rid], L = ucLen(R.pts), vs = [], idx = []; let k = 0;
      for (let s = 0; s <= L; s += 2) { const a = ucAt(R.pts, s), b = ucAt(R.pts, Math.min(L, s + 1)), dx = b[0] - a[0], dz = b[1] - a[1], d = Math.hypot(dx, dz) || 1, nx = -dz / d, nz = dx / d;
        vs.push(a[0] + nx * R.w / 2, -0.25, a[1] + nz * R.w / 2, a[0] - nx * R.w / 2, -0.25, a[1] - nz * R.w / 2); if (k) idx.push((k - 1) * 2, k * 2, (k - 1) * 2 + 1, (k - 1) * 2 + 1, k * 2, k * 2 + 1); k++; }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(vs, 3)); g.setIndex(idx); g.computeVertexNormals(); S.add(new T.Mesh(g, waterMat));
      for (let km = 1; km * UC_KM < L - 4; km++) { const p = ucAt(R.pts, km * UC_KM); this.post(p[0] + R.w * 0.7 + 1, p[1], '#F5F5F5'); this.label(R.name + ' ' + km + 'km', p[0] + R.w * 0.7 + 1, 4.2, p[1], 0.55, '#1B2A44', '#FFFFFF'); }
      const m = ucAt(R.pts, L * 0.5); this.label(R.name, m[0], 7, m[1], 1.1, '#FFFFFF', 'rgba(30,90,150,0.85)'); });
    // 다리 (태화강)
    [-30, 10, 45, 80].forEach(x => { const p = ucProject(UC_RIVERS.taehwa.pts, x, 6), q = ucAt(UC_RIVERS.taehwa.pts, p.s); const b = new T.Mesh(new T.BoxGeometry(4, 0.6, UC_RIVERS.taehwa.w + 6), new T.MeshLambertMaterial({ color: '#C9CDD4' })); b.position.set(q[0], 0.5, q[1]); S.add(b); });
    // 도시 · 공단 건물 (인스턴스 두 번)
    const apts = [], sheds = []; const R = this.rnd;
    for (let i = 0; i < 520; i++) { const x = -250 + R() * 380, z = -200 + R() * 440, zn = this.zoneOf(x, z); if (!zn || this.riverDist(x, z) < 6 || x > this.coastX(z) - 6) continue;
      if (Object.values(UC_FAC).some(F => Math.hypot(F.at[0] - x, F.at[1] - z) < 22) || Object.values(UC_PLACES).some(P => Math.hypot(P.at[0] - x, P.at[1] - z) < 12) || Math.hypot(x - 16, z + 2) < 10) continue;
      if (zn === 'city') apts.push([x, z, 4 + R() * 12, 3 + R() * 3]); else sheds.push([x, z, 2 + R() * 3, 5 + R() * 7]); }
    // 아파트 창문 무늬 (층마다 창 · 몇 개는 불 켜짐)
    const wc = document.createElement('canvas'); wc.width = 64; wc.height = 128; const wg = wc.getContext('2d'); wg.fillStyle = '#EDEAE2'; wg.fillRect(0, 0, 64, 128);
    for (let y = 6; y < 128; y += 12) for (let x = 5; x < 64; x += 15) { wg.fillStyle = Math.random() < 0.12 ? '#FFE9A8' : '#7C93AE'; wg.fillRect(x, y, 9, 6); }
    const winTex = new T.CanvasTexture(wc); winTex.wrapS = winTex.wrapT = T.RepeatWrapping;
    const inst = (list, color, fn, map) => { const im = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshLambertMaterial(map ? { map } : { color }), list.length), m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3();
      list.forEach((b, i) => { fn(b, sc); m4.compose(new T.Vector3(b[0], this.groundH(b[0], b[1]) + sc.y / 2, b[1]), q, sc); im.setMatrixAt(i, m4); }); S.add(im); return im; };
    inst(apts, '#E8E4DA', (b, sc) => sc.set(b[3], b[2], b[3]), winTex); inst(sheds, '#9FA8B5', (b, sc) => sc.set(b[3], b[2], b[3] * 0.7));
    // 나무 (산 · 공원) 
    const trees = []; for (let i = 0; i < 900; i++) { const x = -250 + R() * 400, z = -210 + R() * 460, h = this.groundH(x, z); if (h < 2 || this.zoneOf(x, z) || this.riverDist(x, z) < 4) continue; trees.push([x, z, h]); }
    const trunk = new T.InstancedMesh(new T.CylinderGeometry(0.25, 0.35, 1.6, 5), new T.MeshLambertMaterial({ color: '#6B4A2B' }), trees.length), crown = new T.InstancedMesh(new T.ConeGeometry(1.5, 3.4, 6), new T.MeshLambertMaterial({ color: '#2F6B3A' }), trees.length), m4 = new T.Matrix4();
    trees.forEach((t, i) => { const s = 0.8 + R() * 0.8; m4.makeScale(s, s, s).setPosition(t[0], t[2] + 0.8 * s, t[1]); trunk.setMatrixAt(i, m4); m4.makeScale(s, s, s).setPosition(t[0], t[2] + 2.8 * s, t[1]); crown.setMatrixAt(i, m4); });
    S.add(trunk, crown);
    // 장소 건물
    this.inter = [];
    const place = (key, build, npcs) => { const P = UC_PLACES[key], g = build(P); g.position.set(P.at[0], this.groundH(P.at[0], P.at[1]), P.at[1]); S.add(g); this.label(P.name, P.at[0], 11, P.at[1], 1, '#FFFFFF', 'rgba(27,27,47,0.8)'); };
    const box = (w, h, d, col, x, y, z, g) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshLambertMaterial({ color: col })); m.position.set(x, y, z); g.add(m); return m; };
    place('lab', P => { const g = new T.Group(); box(12, 5, 8, '#F2F4F7', 0, 2.5, 0, g); box(12.4, 0.6, 8.4, '#2A6FB0', 0, 5.2, 0, g); box(3, 2.4, 0.3, '#9DD3F5', 0, 1.6, 4.1, g); return g; });
    place('weather', P => { const g = new T.Group(); box(6, 6, 6, '#E9ECF2', 0, 3, 0, g); const d = new T.Mesh(new T.SphereGeometry(2, 14, 10), new T.MeshLambertMaterial({ color: '#FFFFFF' })); d.position.y = 7.6; g.add(d); box(0.2, 5, 0.2, '#8A93A6', 3.5, 8, 0, g); return g; });
    place('clinic', P => { const g = new T.Group(); box(10, 4.5, 7, '#FFFFFF', 0, 2.25, 0, g); box(2.2, 0.6, 0.2, '#E63946', 0, 3.6, 3.6, g); box(0.6, 2.2, 0.2, '#E63946', 0, 3.6, 3.62, g); return g; });
    place('riverOffice', P => { const g = new T.Group(); box(5, 3, 4, '#FFB347', 0, 1.5, 0, g); return g; });
    place('garden', P => { const g = new T.Group(); for (let i = 0; i < 14; i++) box(3, 0.4, 3, ['#FF6BD6', '#FFD166', '#9B5DE5', '#F15BB5'][i % 4], (i % 7) * 4 - 12, 0.2, Math.floor(i / 7) * 5 - 6, g); return g; });
    place('port', P => { const g = new T.Group(); for (let i = 0; i < 3; i++) { box(1, 12, 1, '#E63946', i * 7 - 7, 6, 0, g); box(8, 1, 1, '#E63946', i * 7 - 4, 12, 0, g); } for (let i = 0; i < 10; i++) box(5, 2.4, 2.4, ['#1D7FA6', '#E63946', '#FFD166', '#2A9D5C'][i % 4], (i % 5) * 5.5 - 10, 1.2 + Math.floor(i / 5) * 2.4, 6, g); return g; });
    place('onsanHarbor', P => { const g = new T.Group(); for (let i = 0; i < 4; i++) box(2, 1.2, 6, '#FFFFFF', i * 4 - 6, 0.3, 6, g); box(8, 3, 5, '#5B8DD6', 0, 1.5, -4, g); return g; });
    place('mouth', P => { const g = new T.Group(); box(10, 0.6, 3, '#8B5A2B', 0, 0.3, 0, g); box(2, 1, 5, '#FFFFFF', 3, 0.5, 3, g); return g; });
    // 시설 (공장 · 처리장): 건물 · 탱크 · 굴뚝(연기) · 배출구(관) · 이름판
    this.smokes = [];
    Object.keys(UC_FAC).forEach(fid => { const F = UC_FAC[fid], g = new T.Group(), [fx, fz] = F.at, y0 = this.groundH(fx, fz);
      const isPlant = fid === 'F6' || fid === 'F8';
      box(16, 4 + (fid.charCodeAt(1) % 3) * 2, 10, isPlant ? '#C9D6CF' : '#B8C0CC', -4, 3, -3, g); box(8, 3, 8, '#9AA3B0', 8, 1.5, 4, g);
      for (let i = 0; i < (isPlant ? 4 : 3); i++) { const tk = new T.Mesh(new T.CylinderGeometry(isPlant ? 3 : 2.2, isPlant ? 3 : 2.2, isPlant ? 1.5 : 5, 16), new T.MeshLambertMaterial({ color: isPlant ? '#6FA8C7' : '#F2F2F2' })); tk.position.set(-8 + i * 6, isPlant ? 0.75 : 2.5, 9); g.add(tk); }
      [[0, -15, 34, 0.3], [0, 15, 34, 0.3], [-17, 0, 0.3, 30], [17, 0, 0.3, 30]].forEach(([x, z, w, d]) => { if (z === 15) { box(13, 1.2, d, '#6B7280', -10.5, 0.6, z, g); box(13, 1.2, d, '#6B7280', 10.5, 0.6, z, g); } else box(w, 1.2, d, '#6B7280', x, 0.6, z, g); });   // 울타리(정문은 남쪽)
      g.position.set(fx, y0, fz); S.add(g);
      this.label(F.name, fx, 14, fz, 1.05, '#FFFFFF', 'rgba(120,40,40,0.85)');
      F.stacks.forEach(st => { const sy = this.groundH(st.x, st.z), sh = new T.Group();
        const cc = document.createElement('canvas'); cc.width = 16; cc.height = 64; const cg = cc.getContext('2d'); for (let y = 0; y < 64; y += 16) { cg.fillStyle = (y / 16) % 2 ? '#FFFFFF' : '#E63946'; cg.fillRect(0, y, 16, 16); }
        const stack = new T.Mesh(new T.CylinderGeometry(0.7, 1, 16, 12), new T.MeshLambertMaterial({ map: new T.CanvasTexture(cc) })); stack.position.y = 8; sh.add(stack); sh.position.set(st.x, sy, st.z); S.add(sh);
        this.smokes.push({ x: st.x, y: sy + 16.5, z: st.z, id: st.id, parts: [] });
        this.inter.push({ x: st.x, z: st.z, r: 6, kind: 'point', id: st.id, fac: fid, label: st.label + ' 살펴보기' }); });
      F.outs.forEach(o => { const R = UC_RIVERS[o.river], p = ucAt(R.pts, o.s), dir = Math.atan2(fz - p[1], fx - p[0]), bank = [p[0] + Math.cos(dir) * (R.w / 2 + 3), p[1] + Math.sin(dir) * (R.w / 2 + 3)];
        const pipe = new T.Mesh(new T.CylinderGeometry(0.45, 0.45, 6, 10), new T.MeshLambertMaterial({ color: '#5A6272' })); pipe.rotation.z = Math.PI / 2; pipe.rotation.y = -dir;
        pipe.position.set(p[0] + Math.cos(dir) * (R.w / 2 + 1), 0.1, p[1] + Math.sin(dir) * (R.w / 2 + 1)); S.add(pipe);
        this.post(bank[0], bank[1], '#FFD166');
        this.inter.push({ x: bank[0], z: bank[1], r: 6, kind: 'point', id: o.id, fac: fid, label: o.label + ' 살펴보기' }); });
      this.inter.push({ x: fx, z: fz + 17, r: 7, kind: 'facility', fac: fid, label: F.name + ' 방문' }); });
    // 측정소: 물벼룩 바이오센서(파란 상자) · 대기·악취 센서(기둥)
    UC_BIO.forEach(b => { const R = UC_RIVERS[b.river], p = ucAt(R.pts, b.s), x = p[0] + R.w / 2 + 2.5, z = p[1], g = new T.Group(); box(1.6, 2, 1.6, '#1D7FA6', 0, 1, 0, g); box(0.1, 2.5, 0.1, '#DDDDDD', 0.5, 3, 0, g);
      g.position.set(x, this.groundH(x, z), z); S.add(g); this.label('🦐 ' + b.name, x, 5, z, 0.6, '#FFFFFF', 'rgba(29,127,166,0.9)'); this.inter.push({ x, z, r: 5, kind: 'bio', st: b, label: b.name + ' 기록 보기' }); });
    UC_AIR.forEach(a => { const g = new T.Group(); box(0.2, 5, 0.2, '#8A93A6', 0, 2.5, 0, g); box(1.2, 1, 0.8, '#F2F4F7', 0, 4.2, 0, g); box(1.6, 0.08, 1, '#23395B', 0, 5.2, 0, g);
      g.position.set(a.x, this.groundH(a.x, a.z), a.z); S.add(g); this.label('💨 ' + a.name, a.x, 7, a.z, 0.6, '#FFFFFF', 'rgba(90,98,114,0.9)'); this.inter.push({ x: a.x, z: a.z, r: 5, kind: 'air', st: a, label: a.name + ' 기록 보기' }); });
    // 연구원 분석 창구
    this.inter.push({ x: UC_PLACES.lab.at[0], z: UC_PLACES.lab.at[1] + 6, r: 6, kind: 'lab', label: '시료 분석 의뢰' });
    if (window.ThreeQuality && this.hq !== 'low') ThreeQuality.apply(this, { half: 46, far: 320, tone: 'none', sun: 0.72, hemi: 0.72 });   // 원래 색 그대로 + 그림자
  }
  post(x, z, col) { const T = THREE, m = new T.Mesh(new T.BoxGeometry(0.35, 2.2, 0.35), new T.MeshLambertMaterial({ color: col })); m.position.set(x, this.groundH(x, z) + 1.1, z); this.scene.add(m); }
  label(text, x, y, z, s, fg, bg) {
    const T = THREE, c = document.createElement('canvas'), g = c.getContext('2d'); g.font = '800 34px Pretendard, sans-serif'; const w = Math.ceil(g.measureText(text).width) + 30;
    c.width = w; c.height = 52; g.font = '800 34px Pretendard, sans-serif'; g.fillStyle = bg; if (g.roundRect) { g.beginPath(); g.roundRect(0, 0, w, 52, 14); g.fill(); } else g.fillRect(0, 0, w, 52);
    g.fillStyle = fg; g.textBaseline = 'middle'; g.fillText(text, 15, 27);
    const sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), depthWrite: false })); sp.scale.set(w / 52 * 1.7 * s, 1.7 * s, 1); sp.position.set(x, this.groundH(x, z) + y, z); sp.userData.noShadow = true; this.scene.add(sp); return sp;
  }

  // ── 사람 ──
  person(o) {
    const T = THREE, g = new T.Group(), M = c => new T.MeshLambertMaterial({ color: c }), add = (geo, col, x, y, z) => { const m = new T.Mesh(geo, M(col)); m.position.set(x, y, z); g.add(m); return m; };
    const legL = add(new T.BoxGeometry(0.28, 0.9, 0.3), o.pants || '#2B3A55', -0.18, 0.45, 0), legR = add(new T.BoxGeometry(0.28, 0.9, 0.3), o.pants || '#2B3A55', 0.18, 0.45, 0);
    add(new T.BoxGeometry(0.72, 0.85, 0.42), o.shirt || '#3FA9F5', 0, 1.33, 0);
    if (o.coat) add(new T.BoxGeometry(0.78, 1.15, 0.46), o.coat, 0, 1.2, 0);
    const armL = add(new T.BoxGeometry(0.2, 0.8, 0.24), o.coat || o.shirt || '#3FA9F5', -0.48, 1.3, 0), armR = add(new T.BoxGeometry(0.2, 0.8, 0.24), o.coat || o.shirt || '#3FA9F5', 0.48, 1.3, 0);
    add(new T.SphereGeometry(0.3, 12, 10), o.skin || '#F2C9A0', 0, 2.02, 0);
    add(new T.SphereGeometry(0.31, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.2), o.hair || '#2B1E16', 0, 2.06, -0.02);
    if (o.hat === 'cap') { add(new T.CylinderGeometry(0.33, 0.33, 0.16, 12), o.hatCol || '#1D7FA6', 0, 2.3, 0); add(new T.BoxGeometry(0.4, 0.05, 0.3), o.hatCol || '#1D7FA6', 0, 2.24, 0.3); }
    if (o.hat === 'helmet') add(new T.SphereGeometry(0.36, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), o.hatCol || '#FFFFFF', 0, 2.1, 0);
    if (o.hat === 'rain') add(new T.ConeGeometry(0.5, 0.35, 12), o.hatCol || '#FFD166', 0, 2.35, 0);
    if (o.vest) add(new T.BoxGeometry(0.76, 0.6, 0.46), o.vest, 0, 1.4, 0);
    g.userData = { legL, legR, armL, armR }; this.scene.add(g); return g;
  }
  buildPeople() {
    this.player = this.person({ shirt: '#FFFFFF', vest: '#1FBF6A', pants: '#2B3A55', hat: 'cap', hatCol: '#12925A' });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.9, 24), new THREE.MeshBasicMaterial({ color: 0x1FBF6A, transparent: true, opacity: 0.8 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; ring.userData.noShadow = true; this.player.add(ring);
    this.npcs = [];
    const npc = (id, name, emoji, at, look) => { const g = this.person(look), [x, z] = at, y = this.groundH(x, z); g.position.set(x, y, z); g.rotation.y = Math.PI;
      const mark = this.label('!', x, 3.2, z, 0.9, '#1B1B2F', '#FFD166'); this.npcs.push({ id, name, emoji, x, z, g, mark }); this.inter.push({ x, z, r: 4.5, kind: 'npc', id, label: name + '와(과) 이야기' }); };
    const P = k => { const a = UC_PLACES[k].at; return [a[0] + 4, a[1] + 7]; };
    npc('researcher', '연구원 박연구사', '🧪', [UC_PLACES.lab.at[0] - 5, UC_PLACES.lab.at[1] + 7], { coat: '#FFFFFF', shirt: '#9DD3F5', hair: '#3B2A20' });
    npc('forecaster', '기상대 최예보관', '🌬️', P('weather'), { shirt: '#23395B', pants: '#1B1B2F', hair: '#1B1B1B' });
    npc('doctor', '보건소 윤의사', '🩺', P('clinic'), { coat: '#FFFFFF', shirt: '#B3E5FC', hair: '#1B1B1B' });
    npc('resident', '산책하던 주민 이씨', '🚶', P('garden'), { shirt: '#F28FB5', pants: '#5A6272', hair: '#8B5A2B' });
    npc('riverman', '하천관리원 정씨', '🦺', P('riverOffice'), { shirt: '#FF9F1C', vest: '#FF9F1C', hat: 'helmet', hatCol: '#FFD166' });
    npc('fisherT', '태화강 하구 어민 김씨', '🎣', P('mouth'), { coat: '#FFD166', hat: 'rain' });
    npc('fisherO', '온산 어촌계 한씨', '🎣', P('onsanHarbor'), { coat: '#FFD166', hat: 'rain', skin: '#D9A77A' });
    npc('activist', '환경단체 활동가 오씨', '📢', [34, 24], { shirt: '#2A9D5C', vest: '#7DF58F', hair: '#1B1B1B' });
    Object.keys(UC_FAC).forEach(fid => { const F = UC_FAC[fid];
      npc('mgr-' + fid, F.name.split(' (')[0] + ' 환경팀장', '👔', [F.at[0] - 3, F.at[1] + 19], { shirt: '#FFFFFF', coat: '#3A3F55', hat: 'helmet', hatCol: '#FFFFFF' });
      npc('guard-' + fid, F.name.split(' (')[0] + ' 경비원', '💂', [F.at[0] + 4, F.at[1] + 19], { shirt: '#23395B', hat: 'cap', hatCol: '#1B1B2F' }); });
    if (window.ThreeQuality && this.hq && this.hq !== 'low') { ThreeQuality.prep(this, this.player); this.npcs.forEach(n => ThreeQuality.prep(this, n.g)); }
  }

  // ── 매 프레임 ──
  bindKeys() {
    this._kd = e => { if (this.ui.modalOpen) return; this.keys[e.code] = true; if (e.code === 'KeyE' || e.code === 'Space') { e.preventDefault(); this.interact(); } };
    this._ku = e => { this.keys[e.code] = false; }; addEventListener('keydown', this._kd); addEventListener('keyup', this._ku);
  }
  tick(now) {
    const dt = this.lastTime ? Math.min(0.05, (now - this.lastTime) / 1000) : 0.016; this.lastTime = now; this.now = now;
    if (this.gameOver) return this.draw();
    let mx = this.mx, my = this.my; if (this.keys.KeyA || this.keys.ArrowLeft) mx -= 1; if (this.keys.KeyD || this.keys.ArrowRight) mx += 1; if (this.keys.KeyW || this.keys.ArrowUp) my -= 1; if (this.keys.KeyS || this.keys.ArrowDown) my += 1;
    const m = Math.hypot(mx, my); let moving = false;
    if (m > 0.1 && !this.ui.modalOpen) { const k = Math.min(1, m), sp = 16 * k * dt, nx = this.px + mx / m * sp, nz = this.pz + my / m * sp;
      if (nx < this.coastX(nz) - 1.5 && nx > -240 && nx < 250 && nz > -205 && nz < 245 && this.groundH(nx, nz) < 26) { const d = Math.hypot(nx - this.px, nz - this.pz); this.px = nx; this.pz = nz; this.spend(d * 0.33 / 60); moving = true; }
      this.heading = Math.atan2(mx, my); }
    const y = this.groundH(this.px, this.pz); this.player.position.set(this.px, Math.max(y, -0.1), this.pz); this.player.rotation.y = this.heading;
    const u = this.player.userData, sw = moving ? Math.sin(now / 90) * 0.7 : 0; u.legL.rotation.x = sw; u.legR.rotation.x = -sw; u.armL.rotation.x = -sw * 0.8; u.armR.rotation.x = sw * 0.8;
    this.npcs.forEach(n => { n.g.position.y = this.groundH(n.x, n.z) + Math.abs(Math.sin(now / 600 + n.x)) * 0.04; n.mark.visible = !this.talked[n.id]; });
    // 연기
    this.smokes.forEach(s => { if (Math.random() < 0.25) { const p = new THREE.Mesh(this._smokeGeo || (this._smokeGeo = new THREE.SphereGeometry(1, 8, 6)), new THREE.MeshLambertMaterial({ color: '#E6E6E6', transparent: true, opacity: 0.6 })); p.position.set(s.x, s.y, s.z); p.userData.noShadow = true; this.scene.add(p); s.parts.push({ m: p, t: 0 }); }
      const w = this.C.wind[this.C.wind.length - 1]; s.parts = s.parts.filter(q => { q.t += dt; q.m.position.x += Math.cos(w.dir) * dt * 2.2; q.m.position.z += Math.sin(w.dir) * dt * 2.2; q.m.position.y += dt * 1.6; q.m.scale.setScalar(1 + q.t * 1.2); q.m.material.opacity = Math.max(0, 0.6 - q.t * 0.15);
        if (q.t > 4) { this.scene.remove(q.m); q.m.material.dispose(); return false; } return true; }); });
    // 분석 결과 도착
    this.pending = this.pending.filter(p => { if (this.nowH >= p.readyH) { this.deliver(p); return false; } return true; });
    if (!this.report && this.nowH >= this.C.endH && !this.ui.forced) { this.ui.forced = true; this.toast('⏰ 조사 시간이 끝났어요. 보고서를 제출하세요'); this.openReport(); }
    // 카메라: 북쪽이 위 · 비스듬히 내려다봄
    const cam = this.camera, tx = this.px, tz = this.pz, ty = y; cam.position.lerp(new THREE.Vector3(tx, ty + 40, tz + 34), 0.12); cam.lookAt(tx, ty + 1, tz - 4);
    if (window.ThreeQuality) ThreeQuality.frame(this, this.px, 0, this.pz, now);
    this.near = this.nearest(); this.updateHud();
    this.draw();
  }
  draw() { this.renderer.render(this.scene, this.camera); }
  spend(h) { this.nowH = Math.min(this.C.endH + 2, this.nowH + h); }
  nearest() {
    let best = null, bd = 1e9; this.inter.forEach(o => { const d = Math.hypot(o.x - this.px, o.z - this.pz); if (d < o.r && d < bd) { bd = d; best = o; } });
    if (!best) { let rb = null; Object.keys(UC_RIVERS).forEach(rid => { const R = UC_RIVERS[rid], p = ucProject(R.pts, this.px, this.pz); if (p.d < R.w / 2 + 5 && (!rb || p.d < rb.d)) rb = { rid, s: p.s, d: p.d }; });
      if (rb) best = { kind: 'river', river: rb.rid, s: rb.s, label: UC_RIVERS[rb.rid].name + ' ' + (rb.s / UC_KM).toFixed(1) + 'km 지점 조사' }; }
    return best;
  }

  // ── 조사 ──
  interact() {
    if (this.ui.modalOpen || this.report) return; const o = this.near; if (!o) { this.toast('가까이에 조사할 것이 없어요'); return; }
    if (o.kind === 'npc') return this.talk(o.id);
    if (o.kind === 'river') return this.riverMenu(o);
    if (o.kind === 'bio') return this.readBio(o.st);
    if (o.kind === 'air') return this.readAir(o.st);
    if (o.kind === 'lab') return this.labMenu();
    if (o.kind === 'point') return this.inspectPoint(o);
    if (o.kind === 'facility') return this.visitFacility(o.fac);
  }
  hm(h) { const d = h >= 24 ? '1일차 ' : '0일차 ', hh = Math.floor(h % 24), mm = Math.floor((h % 1) * 60); return d + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); }
  riverMenu(o) {
    const where = UC_RIVERS[o.river].name + ' ' + (o.s / UC_KM).toFixed(1) + 'km';
    this.dialog('🧪', '현장 조사 — ' + where, '무엇을 할까요? (시료는 한 번에 6개까지 들고 다닐 수 있어요 · 지금 ' + this.samples.length + '개)', [
      ['현장 측정 키트 (15분) — pH · 용존산소 · 탁도 · 냄새', () => { this.spend(0.25); const k = ucFieldKit(this.C, o.river, o.s, this.nowH, this.rnd);
        const html = '<table><tr><th>pH</th><td>' + k.pH.toFixed(2) + '</td><th>용존산소</th><td>' + k.DO.toFixed(1) + ' mg/L</td></tr><tr><th>탁도</th><td>' + k.turb.toFixed(1) + ' NTU</td><th>수온</th><td>' + k.temp.toFixed(1) + ' ℃</td></tr></table><p>관찰: ' + (k.notes.length ? k.notes.join(' · ') : '특이사항 없음') + '</p><p class="dim">평소 이 강: pH 7.4~7.8 · 용존산소 8~9 · 탁도 5 안팎</p>';
        this.addEvidence({ title: '🧪 현장 측정 · ' + where + ' (' + this.hm(this.nowH) + ')', html, key: false, geo: { river: o.river, s: o.s } }); this.closeDialog(); this.toast('현장 측정 결과를 수첩에 적었어요'); }],
      ['물 시료 채취 (10분) — 연구원에서 정밀분석', () => this.takeSample('water', o, where)],
      ['환경DNA 시료 채취 (15분) — 물고기 종 수 확인', () => this.takeSample('edna', o, where)],
      ['그만두기', () => this.closeDialog()]]);
  }
  takeSample(kind, o, where) {
    if (this.samples.length >= 6) { this.toast('시료 가방이 가득 찼어요. 연구원에 먼저 맡기세요'); return; }
    this.spend(kind === 'edna' ? 0.25 : 0.17); this.samples.push({ kind, river: o.river, s: o.s, x: this.px, z: this.pz, takenH: this.nowH, label: (kind === 'edna' ? '🧬 eDNA ' : '💧 물 ') + where + ' · ' + this.hm(this.nowH) });
    this.closeDialog(); this.toast('시료를 챙겼어요 (' + this.samples.length + '/6) — 보건환경연구원에 분석을 맡기세요');
  }
  labMenu() {
    if (!this.samples.length) { this.dialog('🧪', '울산보건환경연구원', '들고 온 시료가 없어요. 강에서 물·환경DNA 시료를 채취하거나, 대기 센서에서 공기 시료를 받아 오세요.', [['알겠어요', () => this.closeDialog()]]); return; }
    const panels = Object.keys(UC_PANELS);
    const body = '<p>분석할 항목을 고르세요. 항목 하나당 20분 · 결과는 <b>2시간 뒤</b>(환경DNA 3시간) 수첩으로 와요.</p>' + this.samples.map((s, i) => '<div class="sample"><b>' + s.label + '</b><div>' +
      (s.kind === 'edna' ? '<label><input type="checkbox" data-i="' + i + '" data-p="edna" checked> 환경DNA 종 분석</label>' : panels.filter(p => (s.kind === 'air') === (p === 'air')).map(p => '<label><input type="checkbox" data-i="' + i + '" data-p="' + p + '"> ' + UC_PANELS[p] + '</label>').join('')) + '</div></div>').join('');
    this.dialog('🧪', '울산보건환경연구원 — 분석 의뢰', body, [['의뢰하기', () => {
      const boxes = [...this.ui.dlg.querySelectorAll('input[type=checkbox]:checked')]; if (!boxes.length) { this.toast('항목을 하나 이상 고르세요'); return; }
      const by = {}; boxes.forEach(b => { (by[b.dataset.i] = by[b.dataset.i] || []).push(b.dataset.p); });
      Object.keys(by).forEach(i => { const s = this.samples[+i], ps = by[i]; this.pending.push({ sample: s, panels: ps, readyH: this.nowH + (ps[0] === 'edna' ? 3 : 2) }); });
      this.spend(boxes.length * 0.33); this.samples = this.samples.filter((s, i) => !by[i]); this.closeDialog(); this.toast('분석을 맡겼어요 — 결과가 나오면 알려 드릴게요'); }], ['취소', () => this.closeDialog()]], true);
  }
  deliver(p) {
    const s = p.sample, C = this.C, P = UC_POL[C.pol], pt = ucPoint(C.point);
    if (p.panels[0] === 'edna') { const e = ucEdna(C, s.river, s.s, s.takenH);
      this.addEvidence({ title: '🧬 환경DNA 결과 · ' + s.label.replace(/^🧬 eDNA /, ''), html: '<p>찾은 물고기 종: <b>' + e.now + '종</b> (평소 이 구간 ' + e.usual + '종)</p><p class="dim">종 수가 크게 줄었다면 그 지점까지 독성 물질이 지나갔다는 뜻이에요.</p>', key: e.now < e.usual * 0.6 });
      this.toast('🧬 환경DNA 결과가 도착했어요'); return; }
    const rows = [];
    const polsOf = { organic: ['phenol', 'benzene'], metal: ['cadmium'], nutrient: ['ammonia'], oil: ['oil'], bod: ['bod'], air: ['benzene', 'toluene', 'h2s'] };
    let key = false;
    p.panels.forEach(pn => polsOf[pn].forEach(pid => { const Q = UC_POL[pid];
      const v = s.kind === 'air' ? (s.airPeak ? s.airPeak[pid] : Q.base) : (Q.path === 'water' ? ucWaterConc(C, pid, s.river, s.s, s.takenH) : Q.base * 0.1);
      const val = v * (0.93 + this.rnd() * 0.14); rows.push('<tr><th>' + Q.name + '</th><td><b>' + (val < 0.01 ? val.toFixed(4) : val < 1 ? val.toFixed(3) : val.toFixed(1)) + '</b> ' + Q.unit + '</td><td class="dim">평소 ' + Q.base + ' · 기준 ' + Q.limit + '</td></tr>');
      if (pid === C.pol && val > Q.base * 3) { if (s.kind === 'air') key = true; else { const d = ucDownstream(pt.river, pt.s, s.river, s.s); if (d >= 0 && d < 140) key = true; } }
      if (pid === C.pol && s.kind !== 'air' && P.path === 'water' && val < Q.base * 1.6 && s.river === pt.river && s.s < pt.s && pt.s - s.s < 70) key = true;   // 바로 위(상류)가 깨끗함 = 위치를 좁히는 증거
    }));
    this.addEvidence({ title: '📊 정밀분석 · ' + s.label.replace(/^(💧 물 |🌫 공기 )/, ''), html: '<table>' + rows.join('') + '</table>', key });
    this.toast('📊 정밀분석 결과가 도착했어요');
  }
  readBio(st) {
    this.spend(0.17); const log = ucBioLog(this.C, st, this.nowH), pt = ucPoint(this.C.point), d = pt.kind === 'water' ? ucDownstream(pt.river, pt.s, st.river, st.s) : -1;
    const html = '<p class="dim">물벼룩의 헤엄 활동량(%) — 독성 물질이 지나가면 뚝 떨어져요. 이 센서는 ' + UC_RIVERS[st.river].name + ' ' + (st.s / UC_KM).toFixed(1) + 'km 지점에 있어요.</p>' + this.bars(log.map(r => ({ l: (r.h % 24) + '시', v: r.act, bad: r.act < 70 })), 100, '%');
    this.addEvidence({ title: '🦐 ' + st.name + ' 기록', html, key: d >= 0 && log.some(r => r.act < 70) }); this.toast('바이오센서 기록을 수첩에 옮겼어요'); this.visited[st.id] = true;
  }
  readAir(st) {
    this.dialog('💨', st.name, '밤사이 기록을 볼까요, 공기 시료(캔)도 받아 갈까요?', [
      ['기록 보기 (10분)', () => { this.spend(0.17); const log = ucAirLog(this.C, st, this.nowH), P = UC_POL[this.C.pol];
        const html = '<p class="dim">시간별 평균. VOC = 벤젠·톨루엔 등 휘발성 유기물 지수(ppb) · H₂S = 황화수소(ppb). 평소 VOC 1~4 · H₂S 0~1</p>' + this.bars(log.map(r => ({ l: (r.h % 24) + '시', v: r.voc, bad: r.voc > 8 })), null, 'VOC') + this.bars(log.map(r => ({ l: (r.h % 24) + '시', v: r.h2s, bad: r.h2s > 5 })), null, 'H₂S');
        const spike = log.some(r => r.voc > 8 || r.h2s > 5); this.addEvidence({ title: '💨 ' + st.name + ' 기록', html, key: P.path === 'air' && spike }); this.closeDialog(); this.toast('센서 기록을 수첩에 옮겼어요'); }],
      ['공기 시료 받기 (10분) — 밤사이 가장 높았던 때 자동 채집분', () => { if (this.samples.length >= 6) { this.toast('시료 가방이 가득 찼어요'); return; } this.spend(0.17);
        const peak = {}; ['benzene', 'toluene', 'h2s'].forEach(p => { let mx = 0; for (let h = 18; h <= 32; h++) mx = Math.max(mx, ucAirConc(this.C, p, st.x, st.z, h + 0.5)); peak[p] = mx; });
        this.samples.push({ kind: 'air', airPeak: peak, x: st.x, z: st.z, takenH: this.nowH, label: '🌫 공기 ' + st.name }); this.closeDialog(); this.toast('공기 시료를 챙겼어요 (' + this.samples.length + '/6)'); }],
      ['그만두기', () => this.closeDialog()]]);
  }
  inspectPoint(o) {
    const pt = ucPoint(o.id); this.spend(0.17); this.known[o.id] = true;
    const F = UC_FAC[o.fac], obs = [];
    if (pt.kind === 'water') { const k = ucFieldKit(this.C, pt.river, pt.s + 1, this.nowH, this.rnd); obs.push('배출구 바로 앞 물: ' + (k.notes.length ? k.notes.join(' · ') : '겉보기로는 특이사항 없음')); }
    else obs.push('지금 굴뚝 연기: 옅은 흰색');
    this.addEvidence({ title: '📍 배출 지점 확인 · ' + o.id + ' (' + F.name + ' ' + pt.label + ')', html: '<p>위치: ' + (pt.kind === 'water' ? UC_RIVERS[pt.river].name + ' ' + (pt.s / UC_KM).toFixed(2) + 'km 지점' : '굴뚝') + '</p><p>' + obs.join('<br>') + '</p>', key: false });
    this.toast(o.id + ' 을(를) 보고서 후보에 올렸어요');
  }
  visitFacility(fid) {
    const F = UC_FAC[fid]; this.dialog('🏭', F.name, '서류 조사를 요청할까요? (30분) — 허가받은 물질, 배출 지점, 어젯밤 자동측정 기록을 볼 수 있어요.', [
      ['서류 조사 (30분)', () => { this.spend(0.5); const r = ucFacilityRecord(this.C, fid); r.rows.forEach(row => { this.known[row.id] = true; });
        const html = '<p>허가 물질: <b>' + r.permit.join(', ') + '</b></p>' + r.rows.map(row => '<p><b>' + row.id + ' ' + row.label + '</b> — ' + (row.kind === 'water' ? '방류 유량(㎥/h)' : '굴뚝 자동측정(TMS)') + '</p><div class="rec">' + row.rec.map(x => '<span class="' + (/—|장애/.test(x.v) ? 'bad' : '') + '">' + (x.h % 24) + '시 ' + x.v + '</span>').join('') + '</div>').join('');
        this.addEvidence({ title: '🗂 ' + F.name + ' 서류', html, key: fid === this.C.fac }); this.closeDialog(); this.toast('서류 내용을 수첩에 적었어요'); }],
      ['그만두기', () => this.closeDialog()]]);
  }
  talk(id) {
    const n = this.npcs.find(q => q.id === id), C = this.C, P = UC_POL[C.pol]; this.spend(0.2); this.talked[id] = true;
    let text = '', key = false;
    if (id === 'researcher') text = '"강물은 흐르는 방향으로만 오염이 퍼져요. 어떤 지점이 오염됐는데 그 바로 위(상류)는 깨끗하다면, 오염원은 그 사이에 있다는 뜻이죠. 물 시료를 가져오면 정밀분석해 드릴게요. 평소값·기준은 결과표에 함께 적어 드려요."';
    else if (id === 'forecaster') { text = '"어젯밤 바람 기록이에요. 화살표는 바람이 <b>불어 간</b> 방향이에요. 냄새는 바람을 타고 가니까, 냄새를 맡은 곳에서 바람을 <b>거슬러</b> 올라가면 출발지가 나와요."' + this.windTable(); key = P.path === 'air'; }
    else if (id === 'riverman') text = '"하천마다 물 흐르는 속도가 달라요. 태화강 시속 ' + UC_RIVERS.taehwa.speed + 'km, 동천 ' + UC_RIVERS.dongcheon.speed + 'km, 여천천 ' + UC_RIVERS.yeocheon.speed + 'km, 외황강 ' + UC_RIVERS.oehwang.speed + 'km, 회야강 ' + UC_RIVERS.hoeya.speed + 'km. 강가의 km 표지판으로 거리를 재면 오염물이 어디서 몇 시에 출발했는지 거꾸로 계산할 수 있어요."';
    else if (id === 'fisherT' || id === 'fisherO') { const mine = id === 'fisherT' ? ['taehwa', 'dongcheon'] : ['oehwang', 'hoeya'], pt = ucPoint(C.point);
      text = P.path === 'water' && mine.indexOf(pt.river) >= 0 ? ucTestimony(C, 'fisher') : (P.path === 'water' ? '"이쪽 바다는 밤새 멀쩡했어요. 다른 강 쪽에서 무슨 일이 있었다던데…"' : ucTestimony(C, 'fisher'));
      key = P.path === 'water' && mine.indexOf(pt.river) >= 0; }
    else if (id === 'resident') { text = ucTestimony(C, 'resident'); key = P.path === 'air'; }
    else if (id === 'doctor') { text = ucTestimony(C, 'doctor'); key = !!P.sym; }
    else if (id === 'activist') text = ucTestimony(C, 'activist');                   // 함정: 틀린 소문
    else if (id.indexOf('guard-') === 0) { const fid = id.slice(6); text = ucGuardLine(C, fid); key = fid === C.fac; }
    else if (id.indexOf('mgr-') === 0) text = ucManagerLine(C, id.slice(4));
    this.addEvidence({ title: n.emoji + ' ' + n.name + '의 말', html: '<p>' + text + '</p>', key });
    this.dialog(n.emoji, n.name, text, [['수첩에 적었어요', () => this.closeDialog()]]);
  }
  windTable() {
    const arrow = d => { const a = ((d * 180 / Math.PI) % 360 + 360) % 360; return ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'][Math.round(a / 45) % 8]; };
    return '<div class="rec">' + this.C.wind.filter(w => w.h <= 32).map(w => '<span>' + (w.h % 24) + '시 <b style="font-size:16px">' + arrow(w.dir) + '</b> ' + w.spd.toFixed(1) + 'm/s</span>').join('') + '</div><p class="dim">↑ = 북쪽으로 불어 감 · → = 동쪽으로 불어 감</p>';
  }
  bars(rows, max, unit) {
    const mx = max || Math.max(5, ...rows.map(r => r.v)); return '<div class="bars">' + rows.map(r => '<div class="bar' + (r.bad ? ' bad' : '') + '"><i style="height:' + Math.max(3, r.v / mx * 100) + '%"></i><em>' + r.v + '</em><span>' + r.l + '</span></div>').join('') + '</div><p class="dim">' + unit + '</p>';
  }
  caseBrief() {
    const P = UC_POL[this.C.pol];
    return '<p><b>' + (P.path === 'water' ? '오늘 새벽, 울산의 한 하천 하류에서 물고기가 떼죽음을 당했다는 신고가 들어왔습니다.' : '어젯밤, 울산 곳곳에서 심한 냄새와 두통을 호소하는 민원이 잇따랐습니다.') + '</b></p>' +
      '<p>당신은 환경보건 조사관입니다. 오늘 <b>저녁 8시까지</b> 아래 네 가지를 밝혀 보고서를 제출하세요.</p><ol><li>무슨 물질인가</li><li>어느 시설인가</li><li>정확히 어느 배출구·굴뚝인가</li><li>언제 배출했는가</li></ol>' +
      '<p class="dim">도구: 현장 측정 키트 · 정밀분석(연구원) · 환경DNA · 물벼룩 바이오센서 · 대기·악취 센서 · 기상대 바람 기록 · 인터뷰 · 시설 서류. 이동과 조사에는 시간이 들어요. 누군가는 거짓말을 하고, 누군가는 틀린 소문을 믿고 있어요.</p>';
  }

  // ── 화면 (수첩 · 지도 · 보고서 · 대화) ──
  buildUI() {
    const root = document.createElement('div'); root.className = 'urpg-ui'; this.host.appendChild(root); this.ui.root = root;
    root.innerHTML = '<div class="u-top"><div class="u-clock"><b></b><span></span></div><div class="u-btns"><button data-a="note">📓 수첩 <em>0</em></button><button data-a="map">🗺 지도</button><button data-a="rep">📝 보고서</button></div></div>' +
      '<div class="u-prompt"></div><div class="u-toast"></div><div class="u-modal hidden"><div class="u-box"></div></div>';
    root.querySelectorAll('.u-btns button').forEach(b => b.addEventListener('click', () => { const a = b.dataset.a; if (a === 'note') this.openNote(); if (a === 'map') this.openMap(); if (a === 'rep') this.openReport(); }));
    this.ui.clock = root.querySelector('.u-clock b'); this.ui.left = root.querySelector('.u-clock span'); this.ui.prompt = root.querySelector('.u-prompt'); this.ui.toast = root.querySelector('.u-toast');
    this.ui.modal = root.querySelector('.u-modal'); this.ui.dlg = root.querySelector('.u-box'); this.ui.noteN = root.querySelector('[data-a=note] em');
  }
  updateHud() {
    if (!this.ui.clock) return; const left = this.timeLeft;
    this.ui.clock.textContent = '🕘 ' + this.hm(this.nowH); this.ui.left.textContent = '남은 ' + Math.floor(left) + '시간 ' + Math.floor((left % 1) * 60) + '분 · 시료 ' + this.samples.length + '/6' + (this.pending.length ? ' · 분석 중 ' + this.pending.length : '');
    this.ui.left.classList.toggle('warn', left < 2);
    const txt = this.near ? '🔍 ' + this.near.label : ''; if (this.ui.prompt.textContent !== txt) { this.ui.prompt.textContent = txt; this.ui.prompt.classList.toggle('on', !!txt); }
    this.ui.noteN.textContent = this.evidenceCount;
  }
  toast(t) { const el = this.ui.toast; if (!el) return; el.textContent = t; el.classList.add('on'); clearTimeout(this._tt); this._tt = setTimeout(() => el.classList.remove('on'), 2600); }
  dialog(emoji, title, body, opts, wide) {
    this.ui.modalOpen = true; this.mx = 0; this.my = 0; this.ui.modal.classList.remove('hidden'); this.ui.dlg.className = 'u-box' + (wide ? ' wide' : '');
    this.ui.dlg.innerHTML = '<h3><span>' + emoji + '</span>' + title + '</h3><div class="u-body">' + body + '</div><div class="u-opts"></div>';
    const box = this.ui.dlg.querySelector('.u-opts'); opts.forEach(([label, fn]) => { const b = document.createElement('button'); b.textContent = label; b.addEventListener('click', fn); box.appendChild(b); });
  }
  closeDialog() { this.ui.modalOpen = false; this.ui.modal.classList.add('hidden'); }
  addEvidence(e) { e.id = e.id || ('e' + this.evidence.length); e.at = this.nowH; this.evidence.push(e); }
  openNote() {
    const list = this.evidence.slice().reverse().map(e => '<details' + (e.id === 'case' && this.evidence.length < 3 ? ' open' : '') + '><summary>' + e.title + '<small>' + (e.id === 'case' ? '' : this.hm(e.at)) + '</small></summary><div>' + e.html + '</div></details>').join('');
    this.dialog('📓', '수사 수첩 (' + this.evidenceCount + '건)', list || '아직 기록이 없어요', [['닫기', () => this.closeDialog()]], true);
  }
  openMap() {
    this.dialog('🗺', '울산 지도', '<canvas class="u-map" width="560" height="520"></canvas><p class="dim">● 나 · 🟦 바이오센서 · ⬜ 대기센서 · 🏭 시설 · 노란 점 = 확인한 배출 지점 · 강 위 눈금 = 1km</p><div class="u-travel"></div>', [['닫기', () => this.closeDialog()]], true);
    const cv = this.ui.dlg.querySelector('.u-map'), g = cv.getContext('2d'), tx = x => (x + 240) / 500 * 560, tz = z => (z + 210) / 470 * 520;
    g.fillStyle = '#CFE3C0'; g.fillRect(0, 0, 560, 520); g.fillStyle = '#7FB5E0'; g.beginPath(); g.moveTo(560, 0); for (let z = -210; z <= 260; z += 10) g.lineTo(tx(this.coastX(z)), tz(z)); g.lineTo(560, 520); g.fill();
    Object.values(UC_RIVERS).forEach(R => { g.strokeStyle = '#3E8FC7'; g.lineWidth = Math.max(2, R.w * 0.8); g.beginPath(); R.pts.forEach((p, i) => i ? g.lineTo(tx(p[0]), tz(p[1])) : g.moveTo(tx(p[0]), tz(p[1]))); g.stroke();
      const L = ucLen(R.pts); g.fillStyle = '#1B2A44'; for (let km = 1; km * UC_KM < L; km++) { const p = ucAt(R.pts, km * UC_KM); g.fillRect(tx(p[0]) - 1.5, tz(p[1]) - 1.5, 3, 3); }
      const m = ucAt(R.pts, L * 0.45); g.font = '700 12px Pretendard, sans-serif'; g.fillText(R.name, tx(m[0]) + 4, tz(m[1]) - 5); });
    g.font = '700 11px Pretendard, sans-serif';
    Object.values(UC_FAC).forEach(F => { g.fillStyle = '#8E3B3B'; g.fillText('🏭 ' + F.name.split(' (')[0], tx(F.at[0]) - 20, tz(F.at[1])); });
    Object.values(UC_PLACES).forEach(P => { g.fillStyle = '#1B1B2F'; g.fillText('■ ' + P.name, tx(P.at[0]) - 10, tz(P.at[1])); });
    UC_BIO.forEach(b => { const p = ucAt(UC_RIVERS[b.river].pts, b.s); g.fillStyle = '#1D7FA6'; g.fillRect(tx(p[0]) - 4, tz(p[1]) - 4, 8, 8); });
    UC_AIR.forEach(a => { g.fillStyle = '#FFFFFF'; g.strokeStyle = '#5A6272'; g.fillRect(tx(a.x) - 4, tz(a.z) - 4, 8, 8); g.strokeRect(tx(a.x) - 4, tz(a.z) - 4, 8, 8); });
    Object.keys(this.known).forEach(id => { const pt = ucPoint(id), p = pt.kind === 'water' ? ucAt(UC_RIVERS[pt.river].pts, pt.s) : [pt.x, pt.z]; g.fillStyle = '#FFD166'; g.beginPath(); g.arc(tx(p[0]), tz(p[1]), 5, 0, 7); g.fill(); g.fillStyle = '#1B1B2F'; g.fillText(id, tx(p[0]) + 6, tz(p[1]) + 4); });
    g.fillStyle = '#1FBF6A'; g.beginPath(); g.arc(tx(this.px), tz(this.pz), 7, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
    // 빠른 이동 (차량): 거리만큼 시간이 듦
    const tr = this.ui.dlg.querySelector('.u-travel'); const dests = Object.keys(UC_PLACES).map(k => [UC_PLACES[k].name, UC_PLACES[k].at]).concat(Object.values(UC_FAC).map(F => [F.name.split(' (')[0], [F.at[0], F.at[1] + 22]]));
    dests.forEach(([nm, at]) => { const d = Math.hypot(at[0] - this.px, at[1] - this.pz), cost = d * 0.25 / 60, b = document.createElement('button'); b.textContent = '🚙 ' + nm + ' (' + Math.round(cost * 60) + '분)';
      b.addEventListener('click', () => { this.px = at[0]; this.pz = at[1] + 4; this.spend(cost); this.camera.position.set(this.px, 30, this.pz + 22); this.closeDialog(); this.toast(nm + '에 도착했어요'); }); tr.appendChild(b); });
  }
  openReport() {
    const opt = (list, cur) => list.map(([v, t]) => '<option value="' + v + '">' + t + '</option>').join('');
    const pts = Object.keys(this.known);
    const ev = this.evidence.filter(e => e.id !== 'case');
    const body = '<p class="dim">보고서는 한 번만 낼 수 있어요. 확인한 배출 지점만 고를 수 있어요(시설 서류나 현장 확인으로 찾기).</p>' +
      '<label>① 오염물질 <select data-k="pol">' + opt(Object.keys(UC_POL).map(k => [k, UC_POL[k].name])) + '</select></label>' +
      '<label>② 시설 <select data-k="fac">' + opt(Object.keys(UC_FAC).map(k => [k, UC_FAC[k].name])) + '</select></label>' +
      '<label>③ 배출 지점 <select data-k="point">' + (pts.length ? opt(pts.map(id => { const p = ucPoint(id); return [id, id + ' · ' + UC_FAC[p.fac].name.split(' (')[0] + ' ' + p.label]; })) : '<option value="">(아직 확인한 곳 없음)</option>') + '</select></label>' +
      '<label>④ 배출 시간대 <select data-k="slot">' + opt(UC_SLOTS.map((t, i) => [i, t])) + '</select></label>' +
      '<p><b>⑤ 가장 결정적인 증거 3개</b></p><div class="u-evs">' + (ev.length ? ev.map((e, i) => '<label><input type="checkbox" data-ev="' + i + '"> ' + e.title + '</label>').join('') : '<p class="dim">아직 증거가 없어요</p>') + '</div>';
    this.dialog('📝', '수사 보고서', body, [['제출하기', () => {
      const v = k => this.ui.dlg.querySelector('[data-k=' + k + ']').value, chosen = [...this.ui.dlg.querySelectorAll('[data-ev]:checked')].map(b => ev[+b.dataset.ev]);
      if (chosen.length !== 3) { this.toast('결정적인 증거를 정확히 3개 고르세요'); return; }
      this.submit({ pol: v('pol'), fac: v('fac'), point: v('point'), slot: +v('slot'), evidence: chosen }); }], ['아직 더 조사할래요', () => { if (this.nowH >= this.C.endH) { this.toast('시간이 끝나서 지금 제출해야 해요'); return; } this.closeDialog(); }]], true);
  }
  submit(rep) {
    const r = ucScore(this.C, rep), C = this.C, P = UC_POL[C.pol], pt = ucPoint(C.point), F = UC_FAC[C.fac]; this.report = r; this.score = r.score;
    const ox = b => b ? '<b class="ok">✓</b>' : '<b class="no">✗</b>';
    const how = P.path === 'water' ? '물은 하류로만 흐릅니다. ' + UC_RIVERS[pt.river].name + '의 ' + pt.id + ' 바로 아래에서 ' + P.name + '이(가) 평소보다 크게 높고, 바로 위는 평소 수준이면 그 사이가 출발점이에요. 하류 바이오센서(또는 어민이 본) 반응 시각에서 거리 ÷ 흐름 속도를 빼면 배출 시각이 나와요.'
      : '냄새를 맡은 센서들의 시각과 그 시각의 바람 방향을 거슬러 선을 그으면, 선들이 만나는 곳이 출발지예요. 시설 서류의 굴뚝 자동측정(TMS) 기록에서 그 시각 "통신 장애"가 난 굴뚝이 범인이에요.';
    const body = '<div class="u-grade">' + r.grade + '<small>' + r.score + '점</small></div>' +
      '<table><tr><th>오염물질</th><td>' + ox(r.pol) + ' ' + P.name + '</td></tr><tr><th>시설</th><td>' + ox(r.fac) + ' ' + F.name + '</td></tr><tr><th>배출 지점</th><td>' + ox(r.point) + ' ' + pt.id + ' ' + pt.label + '</td></tr><tr><th>배출 시각</th><td>' + ox(r.time) + ' ' + this.hm(C.t0) + '부터 약 ' + C.dur.toFixed(1) + '시간 (' + UC_SLOTS[ucSlot(C.t0)] + ')</td></tr><tr><th>결정적 증거</th><td>' + r.keys + ' / 3</td></tr></table>' +
      '<p><b>이렇게 찾을 수 있었어요</b><br>' + how + '</p><p class="dim">함정: 활동가가 지목한 ' + UC_FAC[C.rumor].name + '은(는) 범인이 아니었어요. 몇몇 시설의 낮은 평소 배출도 섞여 있었어요 — 평소값과 비교해야 해요.</p>';
    this.dialog('🏁', '수사 결과', body, [['마치기', () => { this.closeDialog(); this.gameOver = true; }]], true);
  }
}
if (typeof window !== 'undefined') window.UlsanRpgGame = UlsanRpgGame;
