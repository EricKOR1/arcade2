// 3D 카트 시제품 — Three.js r128 · 그림 파일 없이 전부 코드로 만든 트랙 · CPU 상대 5명 · 3바퀴
//   조작: ← → 조향 · 드리프트(꾹, 놓으면 미니 터보) · 아이템 · 브레이크   (자동 가속)
//   구조: 트랙은 닫힌 곡선을 촘촘히 나눈 점(샘플)들로 만들고, 카트 위치는 '가장 가까운 샘플'로 트랙 위 진행도·좌우 위치를 구합니다
const K3 = {
  W: 14,            // 도로 폭
  LAPS: 3,
  N: 900,           // 트랙 샘플 수
  MAX: 31, BOOST: 44, OFF: 13, ACC: 15,
  // 트랙 모양: (x, 높이, z) 제어점 — 긴 직선 · 오르막 헤어핀 · S자 · 내리막
  PTS: [[0, 0, 0], [90, 0, 0], [170, 1, -18], [215, 4, -75], [200, 8, -150], [140, 10, -190], [75, 9, -165], [50, 6, -110], [0, 3, -95],
        [-55, 2, -135], [-120, 3, -120], [-150, 4, -60], [-125, 2, 0], [-70, 0, 25]]
};

const K3_COLORS = [0x3FA9F5, 0xF24E4E, 0x06D6A0, 0xFFD166, 0xB15DFF, 0xFF9F43, 0xFF6BD6, 0x7DF58F, 0x4CC9F0, 0xE9ECF2];
const k3hash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

class Kart3DGame {
  constructor(container, opts) {
    this.opts = opts || {};
    // 플랫폼에서는 준비된 캔버스를 받습니다 (그 부모가 화면 영역). 단독 페이지에서는 영역을 받아 캔버스를 새로 만듭니다
    if (container && container.tagName === 'CANVAS') { this.opts.canvas = container; container = container.parentElement; }
    this.container = container;
    const T = THREE, W = container.clientWidth || 800, H = container.clientHeight || 600;
    const aa = (window.devicePixelRatio || 1) < 2;
    this.renderer = new T.WebGLRenderer(this.opts.canvas ? { canvas: this.opts.canvas, antialias: aa } : { antialias: aa });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.opts.maxDpr || 1.5));
    this.renderer.setSize(W, H); if (!this.opts.canvas) container.appendChild(this.renderer.domElement);
    if (this.opts.canvas) { this.opts.canvas.style.width = '100%'; this.opts.canvas.style.height = '100%'; }
    // 색 보정은 하지 않습니다 (그림 텍스처가 이미 화면 색이라, 한 번 더 보정하면 허옇게 바랩니다)
    this.scene = new T.Scene(); this.scene.fog = new T.Fog(0xBFE3FF, 120, 520);
    this.camera = new T.PerspectiveCamera(70, W / H, 0.5, 1400);
    this.buildWorld(); this.buildTrack(); this.buildScenery(); this.buildItems();
    // 카트: 0번이 나, 1~5번 CPU
    // 나 + CPU (단독 페이지는 5명, 플랫폼은 0명 — 친구들이 상대)
    const nBots = this.opts.bots != null ? this.opts.bots : 5, botNames = ['레드', '그린', '옐로', '퍼플', '오렌지'];
    const myColor = this.opts.myId ? K3_COLORS[k3hash(this.opts.myId) % K3_COLORS.length] : K3_COLORS[0];
    this.karts = [this.makeKart(myColor, this.opts.myName || '나', true)];
    for (let i = 0; i < nBots; i++) this.karts.push(this.makeKart(K3_COLORS[(i + 1) % K3_COLORS.length], botNames[i % botNames.length], false));
    const mySlot = this.opts.slot || 0;
    this.karts.forEach((k, i) => { this.placeOnGrid(k, i === 0 ? mySlot : mySlot + i);
      k.ai = i > 0 ? { off: (Math.random() - 0.5) * 5, max: K3.MAX * (0.86 + Math.random() * 0.08), look: 10 + Math.floor(Math.random() * 6) } : null; });
    this.me = this.karts[0]; this.peers = {}; this.finishRank = 0; this.score = 0; this.lapNo = 1; this.place = 1;
    this.input = { steer: 0, drift: false, brake: false };
    this.countdown = typeof this.opts.countdown === 'number' ? Math.max(0, this.opts.countdown) : 3.6; this.state = 'count'; this.raceT = 0; this.lastNow = 0; this.finishOrder = [];
    this.parts = []; this.camPos = new T.Vector3(); this.camLook = new T.Vector3(); this.snapCam = true;
    this.hud = document.createElement('canvas'); this.hud.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
    container.appendChild(this.hud); this.hctx = this.hud.getContext('2d');
    this.resize();
  }

  placeOnGrid(k, slot) {
    const row = Math.floor(slot / 3), lane = [-4.5, 0, 4.5][slot % 3];
    k.idx = (K3.N - 6 - row * 5 + K3.N * 4) % K3.N; const S = this.samp[k.idx];
    k.pos.set(S.p.x, S.p.y, S.p.z).addScaledVector(S.n, lane); k.head = Math.atan2(S.t.x, S.t.z); k.lap = 0; k.prog = -(row * 5 + 6) * this.segLen;
  }
  // ── 다른 학생 카트 (위치 신호) ──
  serialize() { const m = this.me; return [m.pos.x.toFixed(1), m.pos.z.toFixed(1), m.head.toFixed(2), m.speed.toFixed(1), Math.round(m.prog), m.lap, this.now < m.boostUntil ? 1 : 0, m.driftDir, m.finished ? 1 : 0, m.finished ? m.time.toFixed(1) : 0].join(','); }
  static parse(raw) { const a = String(raw).split(','); return { x: +a[0], z: +a[1], head: +a[2], speed: +a[3], prog: +a[4], lap: +a[5], boost: a[6] === '1', drift: +a[7] || 0, finished: a[8] === '1', ft: +a[9] || 0 }; }
  applyPeerRaw(id, raw, name) {
    if (typeof raw !== 'string') return; const d = Kart3DGame.parse(raw); if (!isFinite(d.x) || !isFinite(d.z)) return;
    let p = this.peers[id];
    if (!p) { p = this.peers[id] = this.makeKart(K3_COLORS[k3hash(id) % K3_COLORS.length], name || '친구', false); p.pos.set(d.x, 0, d.z); p.head = d.head; p.idx = this.nearestIdx(d.x, d.z); p.peer = true; }
    if (name && p.name !== name) { p.name = name; }
    Object.assign(p, { tx: d.x, tz: d.z, thead: d.head, speed: d.speed, prog: d.prog, lap: d.lap, peerBoost: d.boost, driftDir: d.drift, finished: d.finished, time: d.ft, seen: this.now || 0 });
  }
  setPeers(map) { Object.keys(map).forEach(id => { const v = map[id]; if (v && v.raw) this.applyPeerRaw(id, v.raw, v.name); }); Object.keys(this.peers).forEach(id => { if (!map[id]) this.removePeer(id); }); }
  removePeer(id) { const p = this.peers[id]; if (p) { this.scene.remove(p.g); delete this.peers[id]; } }
  nearestIdx(x, z) { let best = 0, bd = 1e18; for (let i = 0; i < K3.N; i += 3) { const p = this.samp[i].p, d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; best = i; } } return best; }
  stepPeer(p, dt) {
    if (p.tx == null) return;
    if ((p.tx - p.pos.x) ** 2 + (p.tz - p.pos.z) ** 2 > 900) { p.pos.x = p.tx; p.pos.z = p.tz; p.head = p.thead; }   // 30m 넘게 튀면(재접속 등) 바로 옮김
    const k = Math.min(1, dt * 10); p.pos.x += (p.tx - p.pos.x) * k; p.pos.z += (p.tz - p.pos.z) * k;
    let da = p.thead - p.head; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; p.head += da * k;
    let best = p.idx, bd = 1e18; for (let o = -20; o <= 20; o++) { const i = (p.idx + o + K3.N) % K3.N, s = this.samp[i].p, d = (s.x - p.pos.x) ** 2 + (s.z - p.pos.z) ** 2; if (d < bd) { bd = d; best = i; } }
    p.idx = best; p.y = this.samp[best].p.y;
    p.g.position.set(p.pos.x, p.y, p.pos.z); p.g.rotation.set(0, p.head + (p.driftDir ? p.driftDir * 0.35 : 0), 0, 'YXZ'); p.wheels.forEach(w => { w.rotation.x += (p.speed || 0) * dt * 2.2; });
    if (p.peerBoost && Math.random() < 0.5) this.burst(new THREE.Vector3(p.pos.x - Math.sin(p.head) * 1.8, p.y + 0.6, p.pos.z - Math.cos(p.head) * 1.8), 0xFFB347, 1, 0.4);
  }
  // 플랫폼 공용 인터페이스
  draw() {}
  destroy() { try { if (window.Sound) { Sound.engineStop(); Sound.skidSet(0); } this.renderer.dispose(); if (this.hud && this.hud.parentNode) this.hud.parentNode.removeChild(this.hud); } catch (e) {} }
  // 교사 미니보드: 트랙(어두운 칸) · 친구(빨강) · 나(초록) 30×30
  getSnapshot() {
    const N = 30, g = []; for (let y = 0; y < N; y++) g.push(new Array(N).fill(65));
    if (!this._bb) { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; this.samp.forEach(s => { a = Math.min(a, s.p.x); b = Math.max(b, s.p.x); c = Math.min(c, s.p.z); d = Math.max(d, s.p.z); }); const sz = Math.max(b - a, d - c) * 1.08; this._bb = { x0: (a + b) / 2 - sz / 2, z0: (c + d) / 2 - sz / 2, sz }; }
    const put = (x, z, v) => { const cx = Math.floor((x - this._bb.x0) / this._bb.sz * N), cz = Math.floor((z - this._bb.z0) / this._bb.sz * N); if (g[cz] && g[cz][cx] != null) g[cz][cx] = v; };
    for (let i = 0; i < K3.N; i += 4) put(this.samp[i].p.x, this.samp[i].p.z, 66);
    Object.keys(this.peers).forEach(id => put(this.peers[id].pos.x, this.peers[id].pos.z, 68)); put(this.me.pos.x, this.me.pos.z, 23);
    return g;
  }

  // ── 하늘 · 조명 · 땅 ──
  buildWorld() {
    const T = THREE;
    const sky = document.createElement('canvas'); sky.width = 16; sky.height = 256; const g = sky.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#3F8FE8'); gr.addColorStop(0.55, '#9CCEF7'); gr.addColorStop(1, '#E6F4FF'); g.fillStyle = gr; g.fillRect(0, 0, 16, 256);
    const skyTex = new T.CanvasTexture(sky);
    this.scene.add(new T.Mesh(new T.SphereGeometry(1200, 24, 12), new T.MeshBasicMaterial({ map: skyTex, side: T.BackSide, fog: false })));
    this.scene.add(new T.HemisphereLight(0xDDEEFF, 0x6A8F4A, 0.9));
    const sun = new T.DirectionalLight(0xFFF1D6, 0.85); sun.position.set(120, 200, 80); this.scene.add(sun);
    // 잔디 땅: 두 톤 잔디 + 얼룩
    const gc = document.createElement('canvas'); gc.width = gc.height = 128; const gg = gc.getContext('2d');
    gg.fillStyle = '#6DBB4B'; gg.fillRect(0, 0, 128, 128); for (let i = 0; i < 900; i++) { gg.fillStyle = Math.random() < 0.5 ? 'rgba(40,110,40,0.18)' : 'rgba(170,220,110,0.16)'; gg.fillRect(Math.random() * 128, Math.random() * 128, 2, 2 + Math.random() * 3); }
    const gt = new T.CanvasTexture(gc); gt.wrapS = gt.wrapT = T.RepeatWrapping; gt.repeat.set(90, 90);
    const ground = new T.Mesh(new T.PlaneGeometry(2400, 2400), new T.MeshLambertMaterial({ map: gt })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; this.scene.add(ground);
    // 먼 산 (각진 원뿔, 두 겹 색)
    const mMat = new T.MeshPhongMaterial({ color: 0x6F8FA8, flatShading: true }), sMat = new T.MeshPhongMaterial({ color: 0xF3F7FB, flatShading: true });
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = 620 + (i % 3) * 90, h = 110 + (i * 37 % 5) * 30;
      const m = new T.Mesh(new T.ConeGeometry(120 + (i % 4) * 30, h, 5), mMat); m.position.set(Math.cos(a) * r, h / 2 - 5, Math.sin(a) * r - 60); m.rotation.y = i; this.scene.add(m);
      const c = new T.Mesh(new T.ConeGeometry(42 + (i % 4) * 10, h * 0.34, 5), sMat); c.position.set(m.position.x, h - h * 0.17 - 5, m.position.z); c.rotation.y = i; this.scene.add(c); }
  }

  // ── 트랙: 곡선 → 샘플 → 도로·연석·옆벽 메쉬 ──
  buildTrack() {
    const T = THREE, N = K3.N, W = K3.W;
    const curve = new T.CatmullRomCurve3(K3.PTS.map(p => new T.Vector3(p[0] * 1.35, p[1], p[2] * 1.35)), true, 'centripetal');
    const pts = curve.getSpacedPoints(N); pts.pop();
    this.samp = pts.map((p, i) => { const q = pts[(i + 1) % N]; const t = new T.Vector3().subVectors(q, p); t.y = 0; t.normalize(); return { p, t, n: new T.Vector3(-t.z, 0, t.x) }; });
    this.segLen = curve.getLength() / N; this.trackLen = curve.getLength();
    // 도로 텍스처: 아스팔트 + 가장자리 흰 선 + 가운데 점선
    const rc = document.createElement('canvas'); rc.width = 128; rc.height = 128; const r = rc.getContext('2d');
    r.fillStyle = '#4A4E57'; r.fillRect(0, 0, 128, 128); for (let i = 0; i < 1400; i++) { r.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '0,0,0,0.12' : '255,255,255,0.07') + ')'; r.fillRect(Math.random() * 128, Math.random() * 128, 1.5, 1.5); }
    r.fillStyle = '#F2F2F2'; r.fillRect(4, 0, 4, 128); r.fillRect(120, 0, 4, 128); r.fillStyle = 'rgba(255,255,255,0.85)'; r.fillRect(62, 0, 4, 64);
    const rt = new T.CanvasTexture(rc); rt.wrapS = rt.wrapT = T.RepeatWrapping; rt.anisotropy = 4;
    const cc = document.createElement('canvas'); cc.width = 16; cc.height = 32; const c2 = cc.getContext('2d'); c2.fillStyle = '#E63946'; c2.fillRect(0, 0, 16, 16); c2.fillStyle = '#FFFFFF'; c2.fillRect(0, 16, 16, 16);
    const ct = new T.CanvasTexture(cc); ct.wrapS = ct.wrapT = T.RepeatWrapping;
    // 띠 만들기: 중심선에서 a~b 만큼 떨어진 두 가장자리를 잇는 면. v 좌표는 거리 방향으로 반복
    const strip = (a, b, yA, yB, vScale, tex, color) => {
      const pos = [], uv = [], idx = [];
      for (let i = 0; i <= N; i++) { const S = this.samp[i % N], d = (i * this.segLen) / vScale;
        const A = S.p.clone().addScaledVector(S.n, a), B = S.p.clone().addScaledVector(S.n, b); pos.push(A.x, A.y + yA, A.z, B.x, B.y + yB, B.z); uv.push(0, d, 1, d);
        if (i < N) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); } }
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
      const m = new T.Mesh(geo, new T.MeshLambertMaterial(tex ? { map: tex, side: T.DoubleSide } : { color: color, side: T.DoubleSide })); this.scene.add(m); return m; };
    strip(W / 2, -W / 2, 0.05, 0.05, 16, rt);                                  // 도로
    strip(W / 2 + 1.3, W / 2, 0.12, 0.05, 3, ct); strip(-W / 2, -W / 2 - 1.3, 0.05, 0.12, 3, ct);   // 연석 (빨강·흰색)
    // 옆벽: 도로가 땅보다 높은 곳에서 가장자리 아래로 내려오는 흙벽 (떠 있어 보이지 않게)
    const skirt = (off) => { const pos = [], idx = [];
      for (let i = 0; i <= N; i++) { const S = this.samp[i % N], A = S.p.clone().addScaledVector(S.n, off); pos.push(A.x, A.y + 0.1, A.z, A.x, -0.1, A.z); if (i < N) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); } }
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      this.scene.add(new T.Mesh(geo, new T.MeshLambertMaterial({ color: 0x9C7A55, side: T.DoubleSide }))); };
    skirt(W / 2 + 1.3); skirt(-W / 2 - 1.3);
    // 출발선 (체크무늬) + 아치
    const fc = document.createElement('canvas'); fc.width = 64; fc.height = 16; const f = fc.getContext('2d'); for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { f.fillStyle = (x + y) % 2 ? '#111' : '#fff'; f.fillRect(x * 4, y * 4, 4, 4); }
    const S0 = this.samp[0], line = new T.Mesh(new T.PlaneGeometry(W, 2.4), new T.MeshBasicMaterial({ map: new T.CanvasTexture(fc) }));
    line.rotation.x = -Math.PI / 2; line.rotation.z = -Math.atan2(S0.t.x, S0.t.z) + Math.PI / 2; line.position.set(S0.p.x, S0.p.y + 0.08, S0.p.z); this.scene.add(line);
    const arch = new T.Group(), post = new T.MeshLambertMaterial({ color: 0xE9ECF2 });
    [-1, 1].forEach(sd => { const p = new T.Mesh(new T.BoxGeometry(0.8, 8, 0.8), post); p.position.set(sd * (W / 2 + 2), 4, 0); arch.add(p); });
    const bc = document.createElement('canvas'); bc.width = 256; bc.height = 48; const b = bc.getContext('2d'); b.fillStyle = '#E63946'; b.fillRect(0, 0, 256, 48); b.fillStyle = '#fff'; b.font = '900 30px sans-serif'; b.textAlign = 'center'; b.fillText('START · FINISH', 128, 35);
    const banner = new T.Mesh(new T.BoxGeometry(W + 5, 2.2, 0.5), new T.MeshLambertMaterial({ map: new T.CanvasTexture(bc) })); banner.position.set(0, 8, 0); arch.add(banner);
    arch.position.copy(S0.p); arch.rotation.y = Math.atan2(S0.t.x, S0.t.z); this.scene.add(arch);
    // 부스터 발판 (빛나는 화살표) 3곳
    const ac = document.createElement('canvas'); ac.width = 64; ac.height = 64; const a = ac.getContext('2d'); a.fillStyle = '#FF8A00'; a.fillRect(0, 0, 64, 64);
    a.fillStyle = '#FFE066'; for (let k = 0; k < 2; k++) { a.beginPath(); a.moveTo(12, 30 + k * 26 - 20); a.lineTo(32, 10 + k * 26 - 20 + 10); a.lineTo(52, 30 + k * 26 - 20); a.lineTo(52, 40 + k * 26 - 20); a.lineTo(32, 20 + k * 26 - 20 + 10); a.lineTo(12, 40 + k * 26 - 20); a.fill(); }
    const aTex = new T.CanvasTexture(ac); this.pads = [];
    [120, 430, 700].forEach(i => { const S = this.samp[i], m = new T.Mesh(new T.PlaneGeometry(5, 7), new T.MeshBasicMaterial({ map: aTex, transparent: true, opacity: 0.95 }));
      m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(S.t.x, S.t.z) + Math.PI; m.position.set(S.p.x, S.p.y + 0.1, S.p.z); this.scene.add(m); this.pads.push({ i, m }); });
    // 미니맵용 점
    this.mapPts = this.samp.filter((s, i) => i % 6 === 0).map(s => [s.p.x, s.p.z]);
  }

  // ── 나무 · 관중석 (인스턴스로 가볍게) ──
  buildScenery() {
    const T = THREE, spots = [];
    let seed = 7; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let k = 0; k < 900 && spots.length < 320; k++) { const x = (rnd() - 0.5) * 900, z = (rnd() - 0.5) * 760 - 80; let near = 1e9;
      for (let i = 0; i < K3.N; i += 10) { const s = this.samp[i].p; near = Math.min(near, (s.x - x) ** 2 + (s.z - z) ** 2); } if (near > 22 * 22) spots.push([x, z, 0.7 + rnd() * 0.8]); }
    const trunk = new T.InstancedMesh(new T.CylinderGeometry(0.35, 0.5, 3, 5), new T.MeshLambertMaterial({ color: 0x7A5230 }), spots.length);
    const leaf = new T.InstancedMesh(new T.ConeGeometry(2.4, 6, 7), new T.MeshLambertMaterial({ color: 0x2F8F46 }), spots.length);
    const leaf2 = new T.InstancedMesh(new T.ConeGeometry(1.8, 4.5, 7), new T.MeshLambertMaterial({ color: 0x3DAA56 }), spots.length);
    const m = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3();
    spots.forEach(([x, z, s], i) => { sc.set(s, s, s); m.compose(new T.Vector3(x, 1.5 * s, z), q, sc); trunk.setMatrixAt(i, m); m.compose(new T.Vector3(x, 5 * s, z), q, sc); leaf.setMatrixAt(i, m); m.compose(new T.Vector3(x, 7.5 * s, z), q, sc); leaf2.setMatrixAt(i, m); });
    this.scene.add(trunk, leaf, leaf2);
    // 출발선 옆 관중석
    const S0 = this.samp[20], stand = new T.Group();
    for (let r = 0; r < 4; r++) { const step = new T.Mesh(new T.BoxGeometry(40, 1, 3), new T.MeshLambertMaterial({ color: r % 2 ? 0x5B6C8C : 0x6E7FA0 })); step.position.set(0, 0.5 + r, -r * 3); stand.add(step); }
    const crowd = new T.InstancedMesh(new T.SphereGeometry(0.45, 6, 5), new T.MeshLambertMaterial({ color: 0xffffff }), 120);
    const cols = [0xF24E4E, 0x3FA9F5, 0xFFD166, 0x06D6A0, 0xB15DFF, 0xFFFFFF]; const col = new T.Color();
    for (let i = 0; i < 120; i++) { const r = i % 4; m.makeTranslation(-19 + (i >> 2) * 1.3, 1.5 + r, -r * 3); crowd.setMatrixAt(i, m); col.setHex(cols[i % cols.length]); if (crowd.setColorAt) crowd.setColorAt(i, col); }
    stand.add(crowd); stand.position.copy(S0.p).addScaledVector(S0.n, K3.W / 2 + 12); stand.rotation.y = Math.atan2(S0.t.x, S0.t.z) + Math.PI / 2; this.scene.add(stand);
  }

  // ── 아이템 상자 (물음표 상자, 먹으면 부스트 아이템) ──
  buildItems() {
    const T = THREE, qc = document.createElement('canvas'); qc.width = qc.height = 64; const q = qc.getContext('2d');
    const gr = q.createLinearGradient(0, 0, 64, 64); gr.addColorStop(0, '#FFE066'); gr.addColorStop(0.5, '#FF6BD6'); gr.addColorStop(1, '#5BC8FF'); q.fillStyle = gr; q.fillRect(0, 0, 64, 64);
    q.fillStyle = '#fff'; q.font = '900 46px sans-serif'; q.textAlign = 'center'; q.fillText('?', 32, 48);
    const mat = new T.MeshLambertMaterial({ map: new T.CanvasTexture(qc), transparent: true, opacity: 0.92 }), geo = new T.BoxGeometry(1.8, 1.8, 1.8);
    this.boxes = [];
    [260, 560, 820].forEach(i => { const S = this.samp[i]; [-4.5, -1.5, 1.5, 4.5].forEach(o => { const b = new T.Mesh(geo, mat); b.position.copy(S.p).addScaledVector(S.n, o); b.position.y += 1.4; this.scene.add(b); this.boxes.push({ m: b, back: 0 }); }); });
  }

  // ── 카트 모델 (코드로 만든 차체·바퀴·운전자) ──
  makeKart(color, name, isMe) {
    const T = THREE, g = new T.Group(), body = new T.MeshLambertMaterial({ color }), dark = new T.MeshLambertMaterial({ color: 0x23262E }), white = new T.MeshLambertMaterial({ color: 0xF5F5F5 });
    const add = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
    add(new T.BoxGeometry(1.7, 0.45, 2.6), body, 0, 0.55, 0);                         // 차체
    add(new T.BoxGeometry(1.3, 0.35, 0.9), body, 0, 0.62, 1.55);                      // 코
    add(new T.BoxGeometry(1.9, 0.12, 0.5), dark, 0, 0.5, 1.95);                       // 앞 범퍼
    add(new T.BoxGeometry(1.9, 0.1, 0.45), body, 0, 1.25, -1.25);                     // 스포일러
    [-0.7, 0.7].forEach(x => add(new T.BoxGeometry(0.1, 0.5, 0.2), dark, x, 1.0, -1.25));
    add(new T.BoxGeometry(0.9, 0.5, 0.8), dark, 0, 0.95, -0.3);                       // 좌석
    add(new T.SphereGeometry(0.45, 12, 10), body, 0, 1.55, -0.2);                     // 헬멧
    add(new T.BoxGeometry(0.6, 0.18, 0.1), new T.MeshLambertMaterial({ color: 0x9DE9FF }), 0, 1.58, 0.22);   // 고글
    this.wheelGeo = this.wheelGeo || new T.CylinderGeometry(0.45, 0.45, 0.4, 12);
    const wheels = [[-0.95, 0.9], [0.95, 0.9], [-0.95, -0.9], [0.95, -0.9]].map(([x, z]) => { const w = add(this.wheelGeo, dark, x, 0.45, z); w.rotation.z = Math.PI / 2; add(new T.CylinderGeometry(0.2, 0.2, 0.42, 8), white, x, 0.45, z).rotation.z = Math.PI / 2; return w; });
    // 바닥 그림자
    if (!this.shadowTex) { const c = document.createElement('canvas'); c.width = c.height = 64; const s = c.getContext('2d'); const r = s.createRadialGradient(32, 32, 4, 32, 32, 32); r.addColorStop(0, 'rgba(0,0,0,0.45)'); r.addColorStop(1, 'rgba(0,0,0,0)'); s.fillStyle = r; s.fillRect(0, 0, 64, 64); this.shadowTex = new T.CanvasTexture(c); }
    const sh = new T.Mesh(new T.PlaneGeometry(3, 3.8), new T.MeshBasicMaterial({ map: this.shadowTex, transparent: true, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.06; g.add(sh);
    // 이름표 (내 카트는 표시 안 함)
    if (!isMe) { const c = document.createElement('canvas'); c.width = 128; c.height = 32; const s = c.getContext('2d'); s.fillStyle = 'rgba(0,0,0,0.55)'; s.fillRect(0, 0, 128, 32); s.fillStyle = '#' + color.toString(16).padStart(6, '0'); s.font = '900 20px sans-serif'; s.textAlign = 'center'; s.fillText(name, 64, 23);
      const sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), depthTest: false })); sp.scale.set(2.4, 0.6, 1); sp.position.y = 3.1; g.add(sp); g.userData.tag = sp; }
    this.scene.add(g);
    return { g, wheels, name, color, pos: new T.Vector3(), head: 0, speed: 0, idx: 0, lap: 0, prog: 0, lat: 0, item: null, boostUntil: 0, drift: 0, driftDir: 0, charge: 0, finished: false, place: 0, time: 0, y: 0, tilt: 0, lastLapPass: 0, half: false };
  }

  // 가장 가까운 샘플 찾기 (지난 위치 근처만 — 빠르고, 트랙이 가까이 지나가는 곳에서도 헷갈리지 않게)
  locate(k) {
    let best = k.idx, bd = 1e18;
    for (let o = -25; o <= 25; o++) { const i = (k.idx + o + K3.N) % K3.N, p = this.samp[i].p, d = (p.x - k.pos.x) ** 2 + (p.z - k.pos.z) ** 2; if (d < bd) { bd = d; best = i; } }
    const S = this.samp[best], dx = k.pos.x - S.p.x, dz = k.pos.z - S.p.z;
    const prevIdx = k.idx; k.idx = best; k.lat = dx * S.n.x + dz * S.n.z;
    // 진행도: 인덱스가 끝→처음으로 넘어가면 한 바퀴 (반대로 가면 되돌림). 절반 지점을 지나야 인정
    let di = best - prevIdx; if (di > K3.N / 2) di -= K3.N; if (di < -K3.N / 2) di += K3.N;
    k.prog += di * this.segLen;
    if (best > K3.N * 0.45 && best < K3.N * 0.55) k.half = true;
    if (prevIdx > K3.N * 0.9 && best < K3.N * 0.1 && k.half) { k.lap++; k.half = false; if (k === this.me && k.lap < K3.LAPS) { this.flash = { text: k.lap === K3.LAPS - 1 ? '마지막 바퀴!' : 'LAP ' + (k.lap + 1), until: this.now + 1600 }; if (window.Sound) Sound.pass(); } }
    // 높이: 샘플 사이 보간
    const S2 = this.samp[(best + 1) % K3.N]; k.y = S.p.y + (S2.p.y - S.p.y) * 0.5;
    return S;
  }

  step(k, dt, now) {
    const S = this.locate(k), onRoad = Math.abs(k.lat) <= K3.W / 2 + 1.3;
    let steer = 0, drift = false, brake = false;
    if (k.ai) {               // CPU: 앞 샘플을 향해 조향 (각자 선택한 옆 간격 유지)
      const T2 = this.samp[(k.idx + k.ai.look) % K3.N], tx = T2.p.x + T2.n.x * k.ai.off - k.pos.x, tz = T2.p.z + T2.n.z * k.ai.off - k.pos.z;
      let da = Math.atan2(tx, tz) - k.head; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; steer = Math.max(-1, Math.min(1, da * 2.2));
      if (k.item && Math.random() < 0.01) this.useItem(k, now);
    } else { steer = this.input.steer; drift = this.input.drift; brake = this.input.brake; }
    if (this.state !== 'race' || k.finished) { steer = k.finished ? steer * 0.3 : 0; }
    // 속도: 자동 가속 · 길 밖은 느림 · 부스트
    const boosting = now < k.boostUntil;
    let max = (k.ai ? k.ai.max * this.rubber(k) : K3.MAX) * (onRoad ? 1 : K3.OFF / K3.MAX); if (boosting) max = K3.BOOST;
    if (this.state === 'race' && !k.finished) { if (brake) k.speed -= 30 * dt; else k.speed += (k.speed < max ? K3.ACC : -20) * dt; }
    else k.speed *= Math.pow(0.4, dt);
    k.speed = Math.max(k.finished ? 0 : -6, Math.min(boosting ? K3.BOOST : Math.max(max, k.speed - 25 * dt), k.speed));
    // 조향 · 드리프트 (꾹 누르고 꺾으면 더 날카롭게 돌며 불꽃 충전 → 놓으면 미니 터보)
    const grip = Math.min(1, Math.abs(k.speed) / 9);
    if (drift && Math.abs(steer) > 0.3 && k.speed > 14) { if (!k.driftDir) k.driftDir = Math.sign(steer); k.charge += dt; }
    else { if (k.driftDir && k.charge > 0.7) { k.boostUntil = now + (k.charge > 1.5 ? 1100 : 700); if (k === this.me && window.Sound) Sound.boost(); this.flash = k === this.me ? { text: k.charge > 1.5 ? '슈퍼 터보!' : '미니 터보!', until: now + 900 } : this.flash; } k.driftDir = 0; k.charge = 0; }
    const turn = (k.driftDir ? (steer * 0.9 + k.driftDir * 0.55) * 1.35 : steer) * 1.9 * grip * (k.speed < 0 ? -1 : 1);
    k.head += turn * dt;
    k.pos.x += Math.sin(k.head) * k.speed * dt; k.pos.z += Math.cos(k.head) * k.speed * dt;
    // 벽: 길에서 너무 벗어나면 밀어 넣고 감속
    const lim = K3.W / 2 + 6;
    if (Math.abs(k.lat) > lim) { const back = Math.abs(k.lat) - lim; k.pos.x -= S.n.x * Math.sign(k.lat) * back; k.pos.z -= S.n.z * Math.sign(k.lat) * back; k.speed *= 0.6; if (k === this.me && window.Sound) Sound.bump(); }
    // 부스터 발판 · 아이템 상자
    this.pads.forEach(p => { let d = Math.abs(k.idx - p.i); d = Math.min(d, K3.N - d); if (d < 4 && Math.abs(k.lat) < 3.5 && now > (k.padAt || 0)) { k.padAt = now + 600; k.boostUntil = Math.max(k.boostUntil, now + 900); if (k === this.me && window.Sound) Sound.boost(); } });
    this.boxes.forEach(b => { if (now < b.back) return; const dx = b.m.position.x - k.pos.x, dz = b.m.position.z - k.pos.z; if (dx * dx + dz * dz < 4.5) { b.back = now + 3000; b.m.visible = false;
      if (!k.item) { k.item = 'boost'; if (k === this.me && window.Sound) Sound.item(); } this.burst(b.m.position, 0xFFFFFF, 10); } });
    // 모델
    k.tilt += ((k.driftDir ? -k.driftDir * 0.12 : -steer * 0.05) - k.tilt) * Math.min(1, dt * 8);
    k.g.position.set(k.pos.x, k.y, k.pos.z); k.g.rotation.set(0, k.head + (k.driftDir ? k.driftDir * 0.35 : 0), k.tilt, 'YXZ');
    k.wheels.forEach(w => { w.rotation.x += k.speed * dt * 2.2; });
    if (k.driftDir && k.charge > 0.7 && Math.random() < 0.6) this.burst(k.g.position, k.charge > 1.5 ? 0xFF6BD6 : 0x5BC8FF, 1, 0.4);
    if (boosting && Math.random() < 0.7) this.burst(new THREE.Vector3(k.pos.x - Math.sin(k.head) * 1.8, k.y + 0.6, k.pos.z - Math.cos(k.head) * 1.8), 0xFFB347, 1, 0.5);
    // 완주
    if (!k.finished && k.lap >= K3.LAPS) { k.finished = true; k.time = this.raceT; this.finishOrder.push(k); k.place = this.finishOrder.length;
      if (k === this.me) { this.flash = { text: '완주!', until: now + 1e9 }; if (window.Sound) { Sound.finish(); Sound.engineStop(); Sound.skidSet(0); } if (this.opts.onFinish) this.opts.onFinish(); } }
  }
  // CPU 가 너무 앞서거나 뒤처지지 않게 (뒤처지면 조금 빨라짐)
  rubber(k) { const gap = (this.me.prog + this.me.lap * 0) - k.prog; return Math.max(0.9, Math.min(1.12, 1 + gap / 900)); }
  useItem(k, now) { if (!k.item) return; k.item = null; k.boostUntil = now + 1500; if (k === this.me) { if (window.Sound) Sound.boost(); this.flash = { text: '부스트!', until: now + 800 }; } }

  burst(pos, color, n, life) {
    const T = THREE; if (!this.partGeo) { this.partGeo = new T.SphereGeometry(0.22, 5, 4); }
    for (let i = 0; i < n; i++) { if (this.parts.length > 140) break; const m = new T.Mesh(this.partGeo, new T.MeshBasicMaterial({ color, transparent: true })); m.position.copy(pos); this.scene.add(m);
      this.parts.push({ m, v: new T.Vector3((Math.random() - 0.5) * 4, Math.random() * 3 + 1, (Math.random() - 0.5) * 4), l: life || 0.7, t: 0 }); }
  }

  // ── 매 프레임 ──
  tick(now) {
    const dt = Math.min(0.05, this.lastNow ? (now - this.lastNow) / 1000 : 0.016); this.lastNow = now; this.now = now;
    if (this.state === 'count') { const prev = Math.ceil(this.countdown); this.countdown -= dt; const cur = Math.ceil(this.countdown);
      if (window.Sound && cur !== prev && cur >= 1 && cur <= 3) Sound.countdown(cur);
      if (this.countdown <= 0) { this.state = 'race'; if (window.Sound) { Sound.countdown(0); Sound.engineStart(); } this.flash = { text: 'GO!', until: now + 900 }; } }
    else if (this.state === 'race') this.raceT += dt;
    this.karts.forEach(k => this.step(k, dt, now));
    Object.keys(this.peers).forEach(id => this.stepPeer(this.peers[id], dt));
    // 순위: 완주한 순서(완주 시간) → 달리는 중이면 진행도. 친구 카트 포함
    const all = this.karts.concat(Object.keys(this.peers).map(id => this.peers[id]));
    const order = all.slice().sort((a, b) => (a.finished && b.finished) ? (a.time - b.time) : a.finished ? -1 : b.finished ? 1 : b.prog - a.prog);
    order.forEach((k, i) => { k.place = i + 1; });
    if (this.finishRank) this.me.place = this.finishRank;                 // 완주 뒤엔 서버가 정한 순위 (공통 출발 시각 기준)
    this.total = all.length; this.place = this.me.place; this.lapNo = Math.min(K3.LAPS, this.me.lap + 1);
    // 점수(교사 화면 정렬용): 완주 = 1000 − 순위(플랫폼 완주 처리와 같은 규칙), 달리는 중 = 진행률 0~899 → 완주자가 항상 위
    this.score = this.me.finished ? 1000 - (this.finishRank || this.me.place) : Math.max(0, Math.min(899, Math.round(this.me.prog / (K3.LAPS * this.trackLen) * 899)));
    if (this.me.finished && all.every(k => k.finished || this.raceT - this.me.time > 15)) this.state = 'done';
    // 소리
    if (window.Sound && this.state === 'race' && !this.me.finished) { Sound.engineSet(Math.min(1, this.me.speed / K3.BOOST), now < this.me.boostUntil); Sound.skidSet(this.me.driftDir ? 0.5 + Math.min(0.4, this.me.charge / 3) : 0); }
    // 상자 회전 · 부활
    this.boxes.forEach(b => { b.m.rotation.y += dt * 1.6; b.m.rotation.x += dt * 0.7; if (!b.m.visible && now >= b.back) b.m.visible = true; });
    this.pads.forEach(p => { p.m.material.opacity = 0.7 + Math.sin(now / 150) * 0.25; });
    for (let i = this.parts.length - 1; i >= 0; i--) { const p = this.parts[i]; p.t += dt; p.v.y -= 9 * dt; p.m.position.addScaledVector(p.v, dt); p.m.material.opacity = Math.max(0, 1 - p.t / p.l);
      if (p.t > p.l) { this.scene.remove(p.m); p.m.material.dispose(); this.parts.splice(i, 1); } }
    // 카메라: 뒤에서 따라감 · 빠를수록 시야가 넓어져 속도감
    const me = this.me, fwd = new THREE.Vector3(Math.sin(me.head), 0, Math.cos(me.head));
    const want = new THREE.Vector3(me.pos.x, me.y, me.pos.z).addScaledVector(fwd, -7.5); want.y += 3.4;
    const look = new THREE.Vector3(me.pos.x, me.y + 1.2, me.pos.z).addScaledVector(fwd, 5);
    if (this.snapCam) { this.camPos.copy(want); this.camLook.copy(look); this.snapCam = false; }
    this.camPos.lerp(want, Math.min(1, dt * 6)); this.camLook.lerp(look, Math.min(1, dt * 10));
    this.camera.position.copy(this.camPos); this.camera.lookAt(this.camLook);
    const fov = 68 + Math.min(1, Math.max(0, me.speed) / K3.BOOST) * 14 + (now < me.boostUntil ? 6 : 0);
    if (Math.abs(this.camera.fov - fov) > 0.2) { this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 5); this.camera.updateProjectionMatrix(); }
    const hideNear = k => { const t = k.g.userData.tag; if (t) t.visible = this.camera.position.distanceToSquared(k.g.position) > 64; };
    this.karts.forEach(hideNear); Object.keys(this.peers).forEach(id => hideNear(this.peers[id]));
    this.renderer.render(this.scene, this.camera);
    this.drawHud(order);
  }

  drawHud(order) {
    const now2 = k => this.now < k.boostUntil;
    const c = this.hctx, W = this.hudW, H = this.hudH, me = this.me, dpr = this.hudDpr; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    const txt = (s, x, y, size, col, align) => { c.font = '900 ' + size + 'px Pretendard, sans-serif'; c.textAlign = align || 'left'; c.lineJoin = 'round'; c.lineWidth = Math.max(3, size * 0.18); c.strokeStyle = '#1B1B2F'; c.strokeText(s, x, y); c.fillStyle = col || '#fff'; c.fillText(s, x, y); };
    const sfx = n => n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
    // 순위 (왼쪽 위 크게)
    txt(me.place + '', 18, 64, 56, me.place === 1 ? '#FFD166' : '#fff'); txt(sfx(me.place) + ' / ' + (this.total || this.karts.length), 18 + (me.place >= 10 ? 62 : 34), 64, 20);
    // 바퀴 · 시간
    txt('LAP ' + Math.min(K3.LAPS, me.lap + 1) + '/' + K3.LAPS, W - 16, 38, 24, '#fff', 'right');
    const t = me.finished ? me.time : this.raceT; txt(Math.floor(t / 60) + ':' + (t % 60).toFixed(1).padStart(4, '0'), W - 16, 66, 18, '#DDE7FF', 'right');
    // 아이템 칸
    const ix = W / 2 - 34, iy = 12; c.fillStyle = 'rgba(0,0,0,0.45)'; c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); if (c.roundRect) c.roundRect(ix, iy, 68, 68, 14); else c.rect(ix, iy, 68, 68); c.fill(); c.stroke();
    if (me.item) { txt('🚀', W / 2, iy + 48, 34, '#fff', 'center'); }
    // 속도계 (오른쪽 아래)
    const kmh = Math.max(0, Math.round(me.speed * 3.6)); txt(kmh + ' km/h', W - 16, 94, 18, now2(me) ? '#FFB347' : '#fff', 'right');   // 속도: 오른쪽 위 (아래는 버튼 자리)
    // 미니맵 (왼쪽, 트랙 선 + 카트 점)
    const mx = 14, my = 86, ms = Math.min(120, W * 0.22); let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9; this.mapPts.forEach(([x, z]) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); });
    const sc = ms / Math.max(maxX - minX, maxZ - minZ), P = (x, z) => [mx + (x - minX) * sc, my + (z - minZ) * sc];
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(mx - 6, my - 6, (maxX - minX) * sc + 12, (maxZ - minZ) * sc + 12);
    c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 4; c.beginPath(); this.mapPts.forEach(([x, z], i) => { const [a, b] = P(x, z); i ? c.lineTo(a, b) : c.moveTo(a, b); }); c.closePath(); c.stroke();
    this.karts.concat(Object.keys(this.peers).map(id => this.peers[id])).reverse().forEach(k => { const [a, b] = P(k.pos.x, k.pos.z); c.fillStyle = '#' + k.color.toString(16).padStart(6, '0'); c.beginPath(); c.arc(a, b, k === me ? 5.5 : 4, 0, Math.PI * 2); c.fill(); if (k === me) { c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); } });
    // 드리프트 충전 표시
    if (me.driftDir) { const k2 = Math.min(1, me.charge / 1.5); c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(W / 2 - 60, H - 34, 120, 10); c.fillStyle = me.charge > 1.5 ? '#FF6BD6' : me.charge > 0.7 ? '#5BC8FF' : '#9AA3B8'; c.fillRect(W / 2 - 60, H - 34, 120 * k2, 10); }
    // 카운트다운 · 알림
    if (this.state === 'count' && this.countdown < 3.05) txt(String(Math.ceil(this.countdown)), W / 2, H * 0.42, 110, '#FFD166', 'center');
    if (this.flash && this.now < this.flash.until) txt(this.flash.text, W / 2, H * 0.3, this.flash.text.length > 4 ? Math.min(40, W / 14) : Math.min(64, W / 9), '#fff', 'center');
    if (me.finished && !this.opts.canvas) { const list = order.map((k, i) => (i + 1) + '. ' + k.name + (k.finished ? '  ' + Math.floor(k.time / 60) + ':' + (k.time % 60).toFixed(1).padStart(4, '0') : '  …')); c.fillStyle = 'rgba(8,10,20,0.6)'; c.fillRect(W / 2 - 150, H * 0.42, 300, 30 + list.length * 26);
      list.slice(0, 8).forEach((s, i) => txt(s, W / 2 - 130, H * 0.42 + 30 + i * 26, 18, order[i] === me ? '#FFD166' : '#fff')); }
  }

  resize() {
    const W = this.container.clientWidth || 800, H = this.container.clientHeight || 600; if (W < 10 || H < 10) return;
    this.renderer.setSize(W, H); this.camera.aspect = W / H; this.camera.fov = W < H ? 78 : 68; this.camera.updateProjectionMatrix();
    this.hudDpr = Math.min(2, window.devicePixelRatio || 1); this.hud.width = W * this.hudDpr; this.hud.height = H * this.hudDpr; this.hudW = W; this.hudH = H;
  }
  info() { return { draws: this.renderer.info.render.calls, tris: this.renderer.info.render.triangles, place: this.me.place, lap: this.me.lap, prog: this.me.prog, speed: this.me.speed, state: this.state }; }
}
if (typeof window !== 'undefined') window.Kart3DGame = Kart3DGame;
