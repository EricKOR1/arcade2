// 레이저 태그 3D (Three.js) — 1인칭 시점. 개인전 · 팀전.
// 왼쪽 조이스틱으로 이동, 화면을 끌어 조준(상하 포함), 오른쪽 발사(꾹) · 재장전.
// 낮의 야외 훈련장. 30발 탄창, 3발이면 다운(머리는 2발), 3초 뒤 재등장.

// ── 맵 생성: 44×44 야외 훈련장 (회전 대칭) ──
//  # 외벽·콘크리트(2.4)  = 금속 격벽(2.4)  B 벽돌(2.4)  H 건물(4.0)  X 상자(1.0)  L 낮은 방벽(0.6)  . 바닥
function f3BuildMap() {
  const N = 44, g = [];
  for (let y = 0; y < N; y++) { g.push(new Array(N).fill('.')); }
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = c; };
  const rect = (x0, y0, w, h, c, fill) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1; if (edge || fill) set(x, y, c); } };
  // 외벽
  rect(0, 0, N, N, '#');
  // 한 사분면을 그리고 4방향으로 회전 복사
  const quad = (fn) => { fn((x, y, c) => { set(x, y, c); set(N - 1 - y, x, c); set(N - 1 - x, N - 1 - y, c); set(y, N - 1 - x, c); }); };
  quad(put => {
    // 모서리 건물 (9×7) — 안쪽 두 면에 출입구
    for (let y = 3; y < 10; y++) for (let x = 3; x < 12; x++) { const edge = x === 3 || y === 3 || x === 11 || y === 9; if (edge) put(x, y, 'H'); }
    put(11, 6, '.'); put(7, 9, '.'); put(8, 9, '.');                   // 출입구
    put(6, 6, 'X');                                                    // 건물 안 상자
    // 건물 앞 낮은 방벽과 상자
    put(14, 5, 'L'); put(14, 6, 'L'); put(14, 7, 'L'); put(15, 11, 'X'); put(16, 11, 'X');
    // 옆으로 뻗은 벽돌 벽 (골목)
    for (let x = 3; x < 9; x++) put(x, 13, 'B'); put(9, 13, '.'); for (let x = 10; x < 14; x++) put(x, 13, 'B');
    // 금속 격벽 (사선 진입 차단) + 엄폐 상자
    for (let y = 15; y < 19; y++) put(6, y, '='); put(8, 17, 'X'); put(9, 17, 'X');
    put(12, 16, 'L'); put(12, 17, 'L');
  });
  // 중앙 광장: 금속 링(14×14) 에 4방향 출입구, 안에 십자 상자와 낮은 방벽
  rect(15, 15, 14, 14, '=');
  [[21, 15], [22, 15], [21, 28], [22, 28], [15, 21], [15, 22], [28, 21], [28, 22]].forEach(([x, y]) => set(x, y, '.'));
  [[19, 19], [24, 19], [19, 24], [24, 24]].forEach(([x, y]) => { set(x, y, 'X'); });
  [[21, 18], [22, 18], [21, 25], [22, 25], [18, 21], [18, 22], [25, 21], [25, 22]].forEach(([x, y]) => set(x, y, 'L'));
  set(21, 21, 'X'); set(22, 22, 'X');
  return g.map(r => r.join(''));
}
const F3_MAP = f3BuildMap();
const F3_HEIGHT = { '#': 2.4, '=': 2.4, 'B': 2.4, 'H': 4.0, 'X': 1.0, 'L': 0.6 };
// 등장 지점: 모서리 건물 안 4곳 · 네 변 중앙 4곳 · 사분면 골목 4곳
const F3_SPAWNS = [[7.5, 7.5], [36.5, 7.5], [7.5, 36.5], [36.5, 36.5], [22, 2.5], [2.5, 22], [41.5, 22], [22, 41.5], [10.5, 16.5], [33.5, 10.5], [27.5, 33.5], [16.5, 27.5]];
const F3_TEAM = { red: 0xFF5C7A, blue: 0x2E9BFF };
const F3_TEAM_CSS = { red: '#FF5C7A', blue: '#2E9BFF' };
const F3_MAG = 30;
const F3_EYE = 1.6;

class Fps3DGame {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.opts = opts || {};
    this.myId = this.opts.myId || 'me';
    this.myName = this.opts.myName || '';
    this.teamMode = !!this.opts.teamMode;
    this.team = this.teamMode ? Fps3DGame.teamOf(this.myId) : null;
    this.map = F3_MAP;
    this.peers = {}; this.models = {};
    this.hp = 100; this.kills = 0; this.deaths = 0; this.score = 0; this.streak = 0;
    this.ammo = F3_MAG; this.reloadUntil = 0;
    this.mx = 0; this.my = 0; this.firing = false; this.turn = 0; this.upHeld = false; this.fwd = 0;
    this.yaw = 0; this.pitch = 0;
    this.lastFire = 0; this.muzzle = 0; this.recoil = 0; this.hurt = 0; this.deadUntil = 0;
    this.hitMarker = 0; this.dmgDir = null; this.bob = 0; this.moving = 0;
    this.gameOver = false; this.toast = null; this.feed = []; this.tracers = [];
    this.lastTime = 0; this.now = 0;
    this.spawnAt(this.opts.slot || 0);
    this.initScene();
  }

  static teamOf(id) { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return (h & 1) ? 'red' : 'blue'; }
  static parse(raw) {
    const a = String(raw).split(',');
    return { x: +a[0], y: +a[1], angle: +a[2], hp: +a[3], kills: +a[4], deaths: +a[5], team: a[6] || null, fire: a[7] === '1', dead: a[8] === '1', moving: a[9] === '1', pitch: +a[10] || 0 };
  }
  get isDead() { return this.now < this.deadUntil; }
  get reloading() { return this.now < this.reloadUntil; }
  clock() { return this.now || performance.now(); }
  cell(x, y) { const r = this.map[Math.floor(y)]; return (r && r[Math.floor(x)]) || '#'; }
  wall(x, y) { return this.cell(x, y) !== '.'; }

  spawnAt(slot) {
    let best = null, bestD = -1;
    F3_SPAWNS.forEach((sp, i) => {
      let d = 1e9;
      Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (p.dead || (this.teamMode && p.team === this.team)) return; d = Math.min(d, Math.hypot(p.x - sp[0], p.y - sp[1])); });
      if (d === 1e9) d = 100 + ((i + slot) % F3_SPAWNS.length);
      if (d > bestD) { bestD = d; best = sp; }
    });
    this.x = best[0]; this.y = best[1];
    const C = this.map.length / 2; this.yaw = Math.atan2(C - this.y, C - this.x); this.pitch = 0;
    this.ammo = F3_MAG; this.reloadUntil = 0;
  }

  // ── 장면 구성 ──
  initScene() {
    if (typeof THREE === 'undefined') { this.noGL = true; return; }
    const T = THREE;
    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x9ED4FF);
    this.scene.fog = new T.Fog(0xCFE6FF, 28, 95);
    this.camera = new T.PerspectiveCamera(72, 1, 0.05, 140);

    // 조명: 하늘빛 + 태양
    this.scene.add(new T.HemisphereLight(0xCFE8FF, 0x8A7A5A, 0.85));
    const sun = new T.DirectionalLight(0xFFF2D6, 1.0); sun.position.set(20, 30, 10); this.scene.add(sun);

    // 바닥 (모래빛 콘크리트) — 타일 텍스처
    const N = this.map.length;
    const floorTex = new T.CanvasTexture(Fps3DGame.texCanvas('floor')); floorTex.wrapS = floorTex.wrapT = T.RepeatWrapping; floorTex.repeat.set(N, N); floorTex.encoding = T.sRGBEncoding;
    const floor = new T.Mesh(new T.PlaneGeometry(N, N), new T.MeshLambertMaterial({ map: floorTex }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(N / 2, 0, N / 2); this.scene.add(floor);
    // 바깥 지면 (넓게)
    const ground = new T.Mesh(new T.PlaneGeometry(400, 400), new T.MeshLambertMaterial({ color: 0xC9B98E }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(N / 2, -0.01, N / 2); this.scene.add(ground);

    // 벽 — 종류별 InstancedMesh (드로우콜 4개)
    const kinds = {}; Object.keys(F3_HEIGHT).forEach(k => { kinds[k] = { h: F3_HEIGHT[k] }; });
    Object.keys(kinds).forEach(k => {
      const cells = [];
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (this.map[y][x] === k) cells.push([x, y]);
      if (!cells.length) return;
      const tex = new T.CanvasTexture(Fps3DGame.texCanvas(k === 'H' ? '#' : (k === 'L' ? '=' : k))); tex.encoding = T.sRGBEncoding;
      if (k === 'H') { tex.wrapT = T.RepeatWrapping; tex.repeat.set(1, 1.7); }
      const h = kinds[k].h;
      const geo = new T.BoxGeometry(1, h, 1);
      const mesh = new T.InstancedMesh(geo, new T.MeshLambertMaterial({ map: tex }), cells.length);
      const m = new T.Matrix4();
      cells.forEach(([x, y], i) => { m.makeTranslation(x + 0.5, h / 2, y + 0.5); mesh.setMatrixAt(i, m); });
      this.scene.add(mesh);
    });

    // 하늘 돔 (그라데이션) + 태양
    const skyTex = new T.CanvasTexture(Fps3DGame.texCanvas('sky')); skyTex.encoding = T.sRGBEncoding;
    const dome = new T.Mesh(new T.SphereGeometry(180, 24, 12), new T.MeshBasicMaterial({ map: skyTex, side: T.BackSide, fog: false }));
    dome.position.set(N / 2, 0, N / 2); this.scene.add(dome);
    const sunTex = new T.CanvasTexture(Fps3DGame.texCanvas('flash')); sunTex.encoding = T.sRGBEncoding;
    const sunSp = new T.Sprite(new T.SpriteMaterial({ map: sunTex, transparent: true, fog: false, depthWrite: false })); sunSp.scale.set(40, 40, 1); sunSp.position.set(N / 2 + 90, 70, N / 2 - 60); this.scene.add(sunSp);

    // 벽 위 어두운 트림 · 바닥 접지 그림자 띠 (입체감)
    const trimMat = new T.MeshLambertMaterial({ color: 0x3A4256 });
    const trimCells = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const k = this.map[y][x]; if (k === '#' || k === '=' || k === 'B' || k === 'H') trimCells.push([x, y, F3_HEIGHT[k]]); }
    const trim = new T.InstancedMesh(new T.BoxGeometry(1.04, 0.08, 1.04), trimMat, trimCells.length);
    const shadowMat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false });
    const shadow = new T.InstancedMesh(new T.PlaneGeometry(1.6, 1.6), shadowMat, trimCells.length);
    { const m = new T.Matrix4(), q = new T.Quaternion().setFromEuler(new T.Euler(-Math.PI / 2, 0, 0)), one = new T.Vector3(1, 1, 1);
      trimCells.forEach(([x, y, h], i) => { m.makeTranslation(x + 0.5, h + 0.04, y + 0.5); trim.setMatrixAt(i, m);
        m.compose(new T.Vector3(x + 0.5, 0.012, y + 0.5), q, one); shadow.setMatrixAt(i, m); }); }
    this.scene.add(trim);
    // 바닥 얼룩 (타이어 자국·먼지) — 화질을 낮추면 숨김
    this.decor = new T.Group(); this.scene.add(this.decor);
    const decMat = new T.MeshBasicMaterial({ color: 0x5A4A36, transparent: true, opacity: 0.18, depthWrite: false });
    for (let i = 0; i < 28; i++) {
      let x, y; do { x = 2 + Math.random() * (N - 4); y = 2 + Math.random() * (N - 4); } while (this.wall(x, y));
      const dec = new T.Mesh(new T.PlaneGeometry(1.2 + Math.random() * 2, 0.5 + Math.random() * 1.5), decMat);
      dec.rotation.x = -Math.PI / 2; dec.rotation.z = Math.random() * Math.PI; dec.position.set(x, 0.008, y); this.decor.add(dec);
    }
    this.decor.add(shadow);

    // 멀리 보이는 언덕 · 건물 실루엣
    this.farScenery = new T.Group(); this.scene.add(this.farScenery);
    const hillMat = new T.MeshLambertMaterial({ color: 0x9CBF7A });
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2, r = 80 + (i % 3) * 10;
      const hill = new T.Mesh(new T.SphereGeometry(14 + (i % 4) * 5, 10, 6), hillMat);
      hill.position.set(N / 2 + Math.cos(a) * r, -8, N / 2 + Math.sin(a) * r); hill.scale.y = 0.5; this.farScenery.add(hill);
    }
    const bMat = new T.MeshLambertMaterial({ color: 0xD8DEE8 });
    for (let i = 0; i < 8; i++) {
      const a = (i + 0.5) / 8 * Math.PI * 2, r = 62;
      const b = new T.Mesh(new T.BoxGeometry(6 + (i % 3) * 3, 6 + (i % 4) * 4, 6), bMat);
      b.position.set(N / 2 + Math.cos(a) * r, b.geometry.parameters.height / 2, N / 2 + Math.sin(a) * r); this.farScenery.add(b);
    }

    // 총 (카메라에 붙임)
    this.weapon = this.buildWeapon(); this.camera.add(this.weapon); this.scene.add(this.camera);
    // 총구 섬광
    const flashTex = new T.CanvasTexture(Fps3DGame.texCanvas('flash')); flashTex.encoding = T.sRGBEncoding;
    this.flash = new T.Sprite(new T.SpriteMaterial({ map: flashTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    this.flash.scale.set(0.35, 0.35, 1); this.flash.position.set(0.22, -0.18, -1.05); this.flash.visible = false; this.camera.add(this.flash);
    // HUD 2D 오버레이 캔버스
    this.hud = document.createElement('canvas');
    this.hud.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
    if (this.canvas.parentElement) { this.canvas.parentElement.style.position = 'relative'; this.canvas.parentElement.appendChild(this.hud); }
    this.hctx = this.hud.getContext('2d');
    // 궤적용
    this.tracerMat = new T.LineBasicMaterial({ color: 0x8FE3FF, transparent: true, opacity: 0.9 });
    // 렌더러 (WebGL 이 없으면 장면 갱신만 하고 그리지 않음)
    try {
      this.renderer = new T.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(Math.min(1.25, (typeof window !== 'undefined' && window.devicePixelRatio) || 1));
      this.renderer.outputEncoding = T.sRGBEncoding;
    } catch (e) { this.noGL = true; }
  }

  static texCanvas(kind) {
    const S = 128, cv = document.createElement('canvas'); cv.width = S; cv.height = S; const g = cv.getContext('2d');
    const noise = (a, n) => { for (let i = 0; i < (n || 500); i++) { g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '0,0,0' : '255,255,255') + ',' + a + ')'; g.fillRect(Math.random() * S, Math.random() * S, 3, 3); } };
    if (kind === 'floor') { g.fillStyle = '#C9BFA6'; g.fillRect(0, 0, S, S); noise(0.06, 900); g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 3; g.strokeRect(1, 1, S - 2, S - 2); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(4, 4, S - 8, 4); }
    else if (kind === '#') { g.fillStyle = '#B9BFC9'; g.fillRect(0, 0, S, S); noise(0.07); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 4; g.strokeRect(3, 3, S - 6, S - 6); g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(6, 6, S - 12, 5); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(6, S - 12, S - 12, 6); g.fillStyle = '#6B7280'; [16, 112].forEach(x => [16, 112].forEach(y => { g.beginPath(); g.arc(x, y, 4, 0, 6.3); g.fill(); })); }
    else if (kind === '=') { g.fillStyle = '#8F98A8'; g.fillRect(0, 0, S, S); noise(0.05); for (let y = 0; y < S; y += 32) { g.fillStyle = (y / 32) % 2 ? '#8A93A3' : '#9CA5B5'; g.fillRect(0, y, S, 32); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, y, S, 3); }
      g.fillStyle = '#FFC533'; for (let x = -32; x < S + 32; x += 32) { g.beginPath(); g.moveTo(x, S - 26); g.lineTo(x + 16, S - 26); g.lineTo(x, S - 8); g.lineTo(x - 16, S - 8); g.closePath(); g.fill(); }
      g.fillStyle = '#2B2F3A'; for (let x = -16; x < S + 32; x += 32) { g.beginPath(); g.moveTo(x, S - 26); g.lineTo(x + 16, S - 26); g.lineTo(x, S - 8); g.lineTo(x - 16, S - 8); g.closePath(); g.fill(); } }
    else if (kind === 'X') { g.fillStyle = '#B98A55'; g.fillRect(0, 0, S, S); noise(0.07); g.strokeStyle = '#7A552F'; g.lineWidth = 8; g.strokeRect(6, 6, S - 12, S - 12); g.beginPath(); g.moveTo(8, 8); g.lineTo(S - 8, S - 8); g.moveTo(S - 8, 8); g.lineTo(8, S - 8); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(12, 12, S - 24, 4); }
    else if (kind === 'B') { g.fillStyle = '#9A5A50'; g.fillRect(0, 0, S, S); for (let y = 0; y < S; y += 32) for (let x = ((y / 32) % 2) * 32 - 32; x < S; x += 64) { g.fillStyle = (x + y) % 3 ? '#C27A6C' : '#B36E61'; g.fillRect(x + 3, y + 3, 58, 26); } noise(0.05); }
    else if (kind === 'sky') { const r = g.createLinearGradient(0, 0, 0, S); r.addColorStop(0, '#5FA8FF'); r.addColorStop(0.55, '#A9D6FF'); r.addColorStop(1, '#E6F1FF'); g.fillStyle = r; g.fillRect(0, 0, S, S);
      g.fillStyle = 'rgba(255,255,255,0.55)'; for (let i = 0; i < 8; i++) { const cx = Math.random() * S, cy = S * (0.35 + Math.random() * 0.25); [0, 10, -8, 6].forEach(o => { g.beginPath(); g.ellipse(cx + o, cy + (o % 3), 14, 6, 0, 0, Math.PI * 2); g.fill(); }); } }
    else if (kind === 'flash') { const r = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(160,235,255,0.9)'); r.addColorStop(1, 'rgba(160,235,255,0)'); g.fillStyle = r; g.fillRect(0, 0, S, S); }
    return cv;
  }

  buildWeapon() {
    const T = THREE, g = new T.Group();
    const dark = new T.MeshLambertMaterial({ color: 0x2B3140 }), mid = new T.MeshLambertMaterial({ color: 0x4A5163 });
    const teamC = new T.MeshBasicMaterial({ color: this.team ? F3_TEAM[this.team] : 0xFFD166 });
    const add = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
    add(new T.BoxGeometry(0.09, 0.12, 0.5), mid, 0, 0, 0);            // 총몸
    add(new T.BoxGeometry(0.05, 0.05, 0.45), dark, 0, 0.02, -0.45);   // 총열
    add(new T.BoxGeometry(0.06, 0.16, 0.08), dark, 0, -0.12, 0.05);   // 탄창
    add(new T.BoxGeometry(0.05, 0.04, 0.16), dark, 0, 0.09, 0.02);    // 조준경
    add(new T.BoxGeometry(0.095, 0.015, 0.4), teamC, 0, 0.065, -0.05); // 팀 색 발광선
    add(new T.BoxGeometry(0.06, 0.06, 0.06), teamC, 0, -0.03, -0.66);  // 총구 링
    add(new T.BoxGeometry(0.08, 0.1, 0.12), new T.MeshLambertMaterial({ color: 0x6B5B4E }), 0.02, -0.1, 0.18); // 손
    g.position.set(0.28, -0.26, -0.55); g.rotation.y = -0.06;
    return g;
  }

  buildSoldier(team, name) {
    const T = THREE, g = new T.Group();
    const armor = new T.MeshLambertMaterial({ color: 0x5C6678 }), skin = new T.MeshLambertMaterial({ color: 0x3A4256 });   // 모델마다 새로 만듦 (피격 번쩍임이 개별로 보이도록)
    const tc = new T.MeshBasicMaterial({ color: team ? F3_TEAM[team] : 0xFFD166 });
    const add = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
    const legL = add(new T.BoxGeometry(0.16, 0.7, 0.18), skin, -0.11, 0.35, 0), legR = add(new T.BoxGeometry(0.16, 0.7, 0.18), skin, 0.11, 0.35, 0);
    add(new T.BoxGeometry(0.46, 0.6, 0.28), armor, 0, 1.0, 0);
    add(new T.BoxGeometry(0.2, 0.32, 0.29), tc, 0, 1.02, 0);                  // 팀 색 가슴판
    add(new T.BoxGeometry(0.48, 0.05, 0.3), tc, 0, 1.3, 0);                   // 어깨 띠
    add(new T.BoxGeometry(0.13, 0.5, 0.14), skin, -0.32, 1.0, 0);             // 왼팔
    const armR = add(new T.BoxGeometry(0.13, 0.4, 0.14), skin, 0.3, 1.05, -0.15);
    add(new T.BoxGeometry(0.06, 0.08, 0.5), new T.MeshLambertMaterial({ color: 0x1A1D24 }), 0.3, 1.05, -0.45); // 총
    add(new T.BoxGeometry(0.3, 0.32, 0.3), armor, 0, 1.55, 0);                // 헬멧
    add(new T.BoxGeometry(0.26, 0.08, 0.05), tc, 0, 1.55, -0.15);             // 바이저
    // 이름표 스프라이트
    const tag = this.makeTag(name || '', team); tag.position.set(0, 2.0, 0); g.add(tag);
    g.userData = { legL, legR, armR, tag };
    return g;
  }
  makeTag(name, team, hp) {
    const T = THREE, cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const g = cv.getContext('2d');
    g.fillStyle = 'rgba(8,10,16,0.65)'; g.beginPath(); if (g.roundRect) g.roundRect(28, 6, 200, 36, 10); else g.rect(28, 6, 200, 36); g.fill();
    g.fillStyle = team ? F3_TEAM_CSS[team] : '#FFD166'; g.font = '800 26px Pretendard, sans-serif'; g.textAlign = 'center'; g.fillText(name, 128, 33);
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(48, 48, 160, 8); g.fillStyle = (hp == null || hp > 40) ? '#06D6A0' : '#FF5C7A'; g.fillRect(48, 48, 160 * Math.max(0, Math.min(1, (hp == null ? 100 : hp) / 100)), 8);
    const tex = new T.CanvasTexture(cv); tex.encoding = T.sRGBEncoding;
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false })); sp.scale.set(1.6, 0.4, 1);
    sp.userData = { name, team, hp: hp == null ? 100 : hp };
    return sp;
  }

  // ── 조작 (플랫폼 계약 + 조이스틱) ──
  setMove(x, y) { this.mx = Math.max(-1, Math.min(1, x)); this.my = Math.max(-1, Math.min(1, y)); }
  look(dx, dy) { if (this.spectator) return; this.yaw += dx * 0.0042; this.pitch = Math.max(-1.1, Math.min(1.1, this.pitch - dy * 0.0036)); }
  move(dir) { this.turn = dir; }                       // 키보드 ← → 는 회전
  releaseSteer(dir) { if (this.turn === dir) this.turn = 0; }
  up() { this.upHeld = true; }
  softDrop() { this.fwd = -1; }
  rotate() { this.fire(); }
  hardDrop() { this.fire(); }
  fire() { this.shoot(); }
  reload() { if (this.reloading || this.ammo === F3_MAG || this.isDead) return; this.reloadUntil = this.clock() + 1400; if (window.Sound) Sound.softDrop(); }

  shoot() {
    const now = this.clock();
    if (this.isDead || this.spectator || this.reloading) return;
    if (this.ammo <= 0) { this.reload(); return; }
    if (now - this.lastFire < 110) return;
    this.lastFire = now; this.muzzle = 1; this.ammo--;
    if (this.ammo <= 0) this.reload();
    if (window.Sound) Sound.hardDrop();
    const spread = 0.01 * this.recoil + (this.moving ? 0.012 : 0);
    const yaw = this.yaw + (Math.random() - 0.5) * spread * 2, pitch = this.pitch + (Math.random() - 0.5) * spread;
    this.recoil = Math.min(1, this.recoil + 0.3); this.pitch = Math.min(1.1, this.pitch + 0.012);   // 반동은 발사 뒤에
    // 조준선을 따라 전진하며 벽 또는 사람에 닿는 첫 지점
    const dx = Math.cos(yaw) * Math.cos(pitch), dy = Math.sin(yaw) * Math.cos(pitch), dz = Math.sin(pitch);
    let best = null, bestD = 1e9, hitZ = 0;
    Object.keys(this.peers).forEach(id => {
      const p = this.peers[id];
      if (p.dead || (this.teamMode && p.team === this.team)) return;
      const rx = p.x - this.x, ry = p.y - this.y;
      const t = rx * dx + ry * dy; if (t <= 0 || t > 30) return;
      const px = this.x + dx * t, py = this.y + dy * t, pz = F3_EYE + dz * t;
      const lateral = Math.hypot(px - p.x, py - p.y);
      // 터치 조준을 감안해 판정을 넉넉하게: 몸통 반지름 0.5 + 거리 비례 (10칸에서 약 3.5도)
      const tol = Math.max(0.5, t * 0.06);
      if (lateral > tol || pz < -0.2 || pz > 2.1) return;
      if (this.blocked(this.x, this.y, p.x, p.y)) return;
      // 여러 명이 겹치면 조준선에 가장 가까운 쪽 (같으면 가까운 쪽)
      const score = lateral / tol + t * 0.01;
      if (score < bestD) { bestD = score; best = id; hitZ = pz; this._bestT = t; }
    });
    if (best) bestD = this._bestT;
    let ex = this.x, ey = this.y, ez = F3_EYE, n = 0;
    while (!this.wall(ex, ey) && ez > 0 && ez < 2.2 && n++ < 400) { ex += dx * 0.08; ey += dy * 0.08; ez += dz * 0.08; }
    if (best) { const p = this.peers[best]; ex = p.x; ey = p.y; ez = hitZ; }
    this.tracers.push({ from: [this.x, this.y, F3_EYE - 0.1], to: [ex, ey, ez], until: now + 80 });
    if (best) {
      const head = hitZ > 1.66;                                 // 눈높이(1.6) 직사는 몸통, 살짝 올려야 머리
      const dmg = head ? 60 : (bestD < 8 ? 34 : 26);
      this.pops = this.pops || []; this.pops.push({ x: ex, y: ey, z: ez + 0.2, val: dmg, head: head, until: now + 800 });
      if (this.opts.onAttack) this.opts.onAttack('hit', best, { dmg: dmg, head: head ? 1 : 0 });
      this.hitMarker = head ? 1.4 : 1; this.score += head ? 5 : 3;
      if (this.models[best]) this.models[best].userData.flash = now + 150;
      if (window.Sound) Sound.lock();
    }
  }
  // 원(반지름 R) 이 주변 벽 칸과 겹치면 가장 가까운 면으로 밀어냅니다
  pushOut() {
    const R = 0.3, cx = Math.floor(this.x), cy = Math.floor(this.y);
    for (let gy = cy - 1; gy <= cy + 1; gy++) for (let gx = cx - 1; gx <= cx + 1; gx++) {
      if (!this.wall(gx + 0.5, gy + 0.5)) continue;
      const nx = Math.max(gx, Math.min(gx + 1, this.x)), ny = Math.max(gy, Math.min(gy + 1, this.y));   // 칸에서 가장 가까운 점
      let dx = this.x - nx, dy = this.y - ny, d = Math.hypot(dx, dy);
      if (d >= R) continue;
      if (d < 1e-6) {                                     // 정확히 면 위: 이동 방향 반대로
        const ex = Math.abs(this.x - (gx + 0.5)), ey = Math.abs(this.y - (gy + 0.5));
        if (ex > ey) { dx = Math.sign(this.x - (gx + 0.5)) || 1; dy = 0; } else { dy = Math.sign(this.y - (gy + 0.5)) || 1; dx = 0; }
        d = 1;
      }
      this.x += dx / d * (R - d); this.y += dy / d * (R - d);
    }
    // 맵 밖으로는 절대 못 나가게
    const N = this.map.length; this.x = Math.max(1 + R, Math.min(N - 1 - R, this.x)); this.y = Math.max(1 + R, Math.min(N - 1 - R, this.y));
  }

  blocked(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d * 8);
    for (let i = 1; i < n; i++) { const t = i / n; const c = this.cell(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t); if (c === '#' || c === '=' || c === 'B' || c === 'H') return true; }
    return false;   // 상자(X)·낮은 방벽(L)은 낮아서 위로 쏠 수 있음
  }

  onEvent(e) {
    if (!e) return;
    if (e.type === 'hit' && e.target === this.myId) {
      if (this.isDead) return;
      this.hp = Math.max(0, this.hp - (e.dmg || 26)); this.hurt = 1;
      const p = this.peers[e.by];
      if (p) { let da = Math.atan2(p.y - this.y, p.x - this.x) - this.yaw; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; this.dmgDir = { a: da, until: this.clock() + 900 }; }
      if (window.Sound) Sound.crash();
      const who = this.nameOf(e.by);
      if (this.hp <= 0) {
        this.deaths++; this.streak = 0; this.deadUntil = this.clock() + 3000; this.score = Math.max(0, this.score - 20); this.killer = who; this.killHead = !!e.head;
        this.pushFeed(who, this.myName, '#FF5C7A', !!e.head);
        if (this.opts.onAttack) this.opts.onAttack('kill', e.by, { victim: this.myId, head: e.head ? 1 : 0 });
        if (window.Sound) Sound.gameOver();
      }
    } else if (e.type === 'kill' && e.target === this.myId) {
      this.kills++; this.streak++; this.score += 100 + (e.head ? 50 : 0) + (this.streak >= 3 ? 50 : 0);
      this.pushFeed(this.myName, this.nameOf(e.victim), '#06D6A0', !!e.head);
      this.showToast(e.head ? '🎯 헤드샷!  +150' : (this.streak >= 3 ? this.streak + '연속 킬  +150' : this.nameOf(e.victim) + ' 처치  +100'), e.head || this.streak >= 3 ? '#FFD166' : '#06D6A0');
      if (window.Sound) Sound.levelUp();
    } else if (e.type === 'kill') this.pushFeed(this.nameOf(e.by), this.nameOf(e.victim), '#9AA3B2', !!e.head);
  }
  nameOf(id) { if (this.peers[id] && this.peers[id].name) return this.peers[id].name; if (this.opts.nameOf) return this.opts.nameOf(id) || '?'; return '?'; }
  pushFeed(a, b, color, head) { this.feed.unshift({ a, b, color, head, until: this.clock() + 5000 }); this.feed = this.feed.slice(0, 5); }
  showToast(text, color) { this.toast = { text, color, until: this.clock() + 1600 }; }

  serialize() {
    return [this.x.toFixed(2), this.y.toFixed(2), this.yaw.toFixed(2), this.hp, this.kills, this.deaths, this.team || '',
            this.muzzle > 0.5 ? 1 : 0, this.isDead ? 1 : 0, this.moving ? 1 : 0, this.pitch.toFixed(2)].join(',');
  }
  applyPeerRaw(id, raw, name) {
    const d = Fps3DGame.parse(raw);
    if (!this.peers[id]) this.peers[id] = { x: d.x, y: d.y, angle: d.angle, walk: 0 };
    const p = this.peers[id];
    Object.assign(p, { tx: d.x, ty: d.y, tangle: d.angle, hp: d.hp, kills: d.kills, deaths: d.deaths, team: d.team, fire: d.fire, dead: d.dead, moving: d.moving, pitch: d.pitch });
    if (name) p.name = name;
  }
  removePeer(id) { delete this.peers[id]; if (this.models[id] && this.scene) { this.scene.remove(this.models[id]); delete this.models[id]; } }
  setPeers(map) { Object.keys(map).forEach(id => { const d = map[id]; if (d.raw) this.applyPeerRaw(id, d.raw, d.name); }); Object.keys(this.peers).forEach(id => { if (!map[id]) this.removePeer(id); }); }
  spectate(id) { this.spectator = true; this.followId = id; }

  // 화질 단계 (2 최고 · 0 최저): 해상도 배율 · 바닥 장식 · 원경
  setQuality(q) {
    this.q = Math.max(0, Math.min(2, q | 0));
    if (this.renderer) this.renderer.setPixelRatio(Math.min([0.75, 1.0, 1.25][this.q], (typeof window !== 'undefined' && window.devicePixelRatio) || 1));
    if (this.decor) this.decor.visible = this.q >= 1;
    if (this.farScenery) this.farScenery.visible = this.q >= 1;
    this._w = 0;                                         // 크기 다시 맞춤
  }

  // ── 프레임 ──
  tick(now) {
    this.now = now;
    const dt = this.lastTime ? Math.min(50, now - this.lastTime) : 16.7; this.lastTime = now; const f = dt / 16.7;
    Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (p.tx == null) return;
      p.x += (p.tx - p.x) * 0.3; p.y += (p.ty - p.y) * 0.3;
      let da = p.tangle - p.angle; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; p.angle += da * 0.3;
      p.walk = (p.walk || 0) + (p.moving ? 0.22 * f : 0); });
    this.tracers = this.tracers.filter(t => t.until > now);
    this.muzzle = Math.max(0, this.muzzle - 0.2 * f); this.recoil = Math.max(0, this.recoil - 0.06 * f);
    this.hurt = Math.max(0, this.hurt - 0.04 * f); this.hitMarker = Math.max(0, this.hitMarker - 0.08 * f);

    if (this.spectator) {
      const p = this.peers[this.followId];
      if (p) { this.x = p.x; this.y = p.y; this.yaw = p.angle; this.pitch = p.pitch || 0; this.hp = p.hp; this.kills = p.kills; this.deaths = p.deaths; this.team = p.team; this.myName = p.name || ''; this.deadUntil = p.dead ? now + 100 : 0; this.moving = p.moving; if (p.fire) this.muzzle = 1; }
      this.draw(); return;
    }
    if (this.isDead) {
      if (!this._respawned && this.deadUntil - now < 50) { this._respawned = true; this.hp = 100; this.spawnAt(Math.floor(Math.random() * 12)); this.dmgDir = null; }
      this.draw(); return;
    }
    this._respawned = false;
    if (this.reloadUntil && now >= this.reloadUntil && this.ammo < F3_MAG) { this.ammo = F3_MAG; this.reloadUntil = 0; if (window.Sound) Sound.rotate(); }

    this.yaw += this.turn * 0.05 * f;
    // 이동: 조이스틱(mx: 옆, my: 앞) + 키보드
    let sx = this.mx, sy = this.my;
    if (this.upHeld) sy = 1; if (this.fwd) sy = this.fwd; this.fwd = 0;
    const len = Math.hypot(sx, sy);
    this.moving = len > 0.15 ? 1 : 0;
    if (this.moving) {
      const sp = 0.095 * f * Math.min(1, len);
      const ux = (Math.cos(this.yaw) * sy - Math.sin(this.yaw) * sx) / (len || 1), uy = (Math.sin(this.yaw) * sy + Math.cos(this.yaw) * sx) / (len || 1);
      // 한 프레임에 너무 멀리 가지 않게 잘게 나눠 움직이고, 매번 벽에서 밀어냅니다
      const steps = Math.max(1, Math.ceil(sp / 0.12));
      for (let k = 0; k < steps; k++) { this.x += ux * sp / steps; this.y += uy * sp / steps; this.pushOut(); }
      this.bob += 0.2 * f;
    }
    if (this.firing) this.shoot();
    else if (this.autoFire && !this.reloading && this.ammo > 0) {
      // 자동 발사: 조준선에서 5도 안에 적이 보이면 쏩니다
      const dx = Math.cos(this.yaw) * Math.cos(this.pitch), dy = Math.sin(this.yaw) * Math.cos(this.pitch);
      const found = Object.keys(this.peers).some(id => { const p = this.peers[id]; if (p.dead || (this.teamMode && p.team === this.team)) return false;
        const rx = p.x - this.x, ry = p.y - this.y, t = rx * dx + ry * dy; if (t <= 0.5 || t > 26) return false;
        const lateral = Math.hypot(this.x + dx * t - p.x, this.y + dy * t - p.y); return lateral < Math.max(0.5, t * 0.09) && !this.blocked(this.x, this.y, p.x, p.y); });
      if (found) this.shoot();
    }
    this.draw();
  }

  getSnapshot() { return null; }

  draw() {
    if (!this.scene) return;
    this.updateModels();
    if (this.noGL || !this.renderer) return;
    const T = THREE, now = this.clock();
    const W = this.canvas.clientWidth || 300, H = this.canvas.clientHeight || 300;
    if (this._w !== W || this._h !== H) { this._w = W; this._h = H; this.renderer.setSize(W, H, false); this.camera.aspect = W / H; this.camera.updateProjectionMatrix();
      const dpr = Math.min(1.5, window.devicePixelRatio || 1); this.hud.width = Math.round(W * dpr); this.hud.height = Math.round(H * dpr); this.hctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    // 카메라
    const bobY = this.moving ? Math.sin(this.bob) * 0.03 : 0;
    const shake = this.hurt > 0.5 ? (this.hurt - 0.5) * 0.06 : 0;
    this.camera.position.set(this.x + (Math.random() - 0.5) * shake, F3_EYE + bobY + (Math.random() - 0.5) * shake, this.y + (Math.random() - 0.5) * shake);
    const fov = 72 + this.recoil * 2.5 + (this.moving ? 1.5 : 0);
    if (Math.abs(this.camera.fov - fov) > 0.05) { this.camera.fov += (fov - this.camera.fov) * 0.3; this.camera.updateProjectionMatrix(); }
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = -this.yaw - Math.PI / 2; this.camera.rotation.x = this.pitch; this.camera.rotation.z = (this.mx || 0) * -0.02;   // 시선 = 이동 방향 · 옆걸음 때 살짝 기울기
    // 총 흔들림 · 반동 · 재장전
    const rel = this.reloading ? Math.sin(((this.reloadUntil - now) / 1400) * Math.PI) * 0.25 : 0;
    this.weapon.position.set(0.28 + (this.moving ? Math.sin(this.bob * 0.5) * 0.01 : 0), -0.26 - rel + (this.moving ? Math.abs(Math.cos(this.bob * 0.5)) * 0.01 : 0), -0.55 + this.recoil * 0.06);
    this.weapon.rotation.x = -rel * 1.5 + this.recoil * 0.1; this.weapon.visible = !this.spectator && !this.isDead;
    this.flash.visible = this.muzzle > 0.15; this.flash.material.opacity = this.muzzle; this.flash.scale.setScalar(0.25 + this.muzzle * 0.25);

    // 궤적
    this.tracers.forEach(t => {
      if (!t.line) { const geo = new T.BufferGeometry().setFromPoints([new T.Vector3(t.from[0], t.from[2], t.from[1]), new T.Vector3(t.to[0], t.to[2], t.to[1])]); t.line = new T.Line(geo, this.tracerMat); this.scene.add(t.line); }
    });
    if (this._oldTracers) this._oldTracers.forEach(t => { if (t.line && this.tracers.indexOf(t) < 0) { this.scene.remove(t.line); t.line.geometry.dispose(); } });
    this._oldTracers = this.tracers.slice();

    this.renderer.render(this.scene, this.camera);
    this.drawHud(this.hctx, W, H, now);
  }

  // 상대 모델 갱신 (위치 · 걷기 · 다운 · 이름표 · 피격 번쩍임)
  updateModels() {
    const now = this.clock();
    Object.keys(this.peers).forEach(id => {
      if (this.spectator && id === this.followId) { if (this.models[id]) this.models[id].visible = false; return; }
      const p = this.peers[id];
      let m = this.models[id];
      if (!m || m.userData.team !== p.team) { if (m) this.scene.remove(m); m = this.buildSoldier(p.team, p.name); m.userData.team = p.team; this.models[id] = m; this.scene.add(m); }
      const far = Math.hypot(p.x - this.x, p.y - this.y) > 45;
      m.visible = !far; if (far) return;
      m.position.set(p.x, 0, p.y); m.rotation.y = -p.angle - Math.PI / 2;
      const u = m.userData;
      const sw = p.moving ? Math.sin(p.walk) * 0.5 : 0;
      u.legL.rotation.x = sw; u.legR.rotation.x = -sw; u.armR.rotation.x = -(p.pitch || 0);
      // 다운: 쓰러짐
      const fall = p.dead ? 1 : 0; m.rotation.x += (fall * -Math.PI / 2 - m.rotation.x) * 0.2;
      // 이름표 체력 갱신 (바뀔 때만)
      if (Math.round((u.tag.userData.hp || 0) / 10) !== Math.round((p.hp || 0) / 10) || u.tag.userData.name !== p.name) { const nt = this.makeTag(p.name || '', p.team, p.hp); nt.position.copy(u.tag.position); m.remove(u.tag); if (u.tag.material.map) u.tag.material.map.dispose(); u.tag = nt; m.add(nt); }
      u.tag.visible = !p.dead;
      // 피격 번쩍임
      const fl = !!(u.flash && now < u.flash);
      if (fl !== !!u.flashOn) { u.flashOn = fl; m.traverse(o => { if (o.isMesh && o.material && o.material.emissive) o.material.emissive.setHex(fl ? 0xFFFFFF : 0x000000); }); }
    });
  }

  drawHud(ctx, W, H, now) {
    ctx.clearRect(0, 0, W, H);
    const hy = H / 2, teamC = this.team ? F3_TEAM_CSS[this.team] : '#FFD166';
    // 유리 카드 — 반투명 + 밝은 테두리
    const rr = (x, y, w, h, r, fill) => { ctx.fillStyle = fill; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1; ctx.stroke(); };

    // 피해 숫자 — 맞은 자리에서 떠오름 (3D → 화면 좌표)
    if (this.pops && this.camera) {
      this.pops = this.pops.filter(p => p.until > now);
      const v = new THREE.Vector3();
      this.pops.forEach(p => {
        const k = (p.until - now) / 800;
        v.set(p.x, p.z + (1 - k) * 0.6, p.y).project(this.camera);
        if (v.z > 1) return;
        const sx = (v.x + 1) / 2 * W, sy = (1 - v.y) / 2 * H;
        ctx.globalAlpha = Math.min(1, k * 2);
        ctx.font = '800 ' + (p.head ? 22 : 17) + 'px Pretendard, sans-serif'; ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4;
        ctx.fillStyle = p.head ? '#FFD166' : '#FFFFFF'; ctx.fillText((p.head ? '🎯 ' : '') + '-' + p.val, sx, sy);
        ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.textAlign = 'left';
      });
    }

    // 나침반 띠 (위쪽)
    {
      const cw = Math.min(260, W * 0.6), cx0 = W / 2 - cw / 2, cy0 = this.teamMode ? 56 : 52;
      rr(cx0, cy0, cw, 18, 9, 'rgba(8,10,16,0.45)');
      ctx.save(); ctx.beginPath(); ctx.rect(cx0, cy0, cw, 18); ctx.clip();
      const labels = ['E', 'S', 'W', 'N'];
      for (let k = -8; k <= 8; k++) {
        const a = k * Math.PI / 4;
        let da = a - this.yaw; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
        const px = W / 2 + da / (Math.PI / 2) * (cw / 2);
        if (px < cx0 - 10 || px > cx0 + cw + 10) continue;
        const major = ((k % 2) + 2) % 2 === 0;
        ctx.fillStyle = major ? '#fff' : 'rgba(255,255,255,0.4)';
        if (major) { ctx.font = '800 11px Pretendard, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(labels[(((k / 2) % 4) + 4) % 4], px, cy0 + 13); }
        else ctx.fillRect(px - 0.5, cy0 + 6, 1, 6);
      }
      ctx.restore(); ctx.textAlign = 'left';
      ctx.fillStyle = '#FFD166'; ctx.fillRect(W / 2 - 1, cy0 - 3, 2, 24);
    }
    // 조준점 + 히트마커
    const gap = 6 + this.recoil * 10 + (this.moving ? 5 : 0);
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 3;
    [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([ax, ay]) => { ctx.beginPath(); ctx.moveTo(W / 2 + ax * gap, hy + ay * gap); ctx.lineTo(W / 2 + ax * (gap + 8), hy + ay * (gap + 8)); ctx.stroke(); });
    ctx.shadowBlur = 0;
    if (this.hitMarker > 0) { const hm = Math.min(1, this.hitMarker); ctx.strokeStyle = this.hitMarker > 1 ? 'rgba(255,214,102,' + hm + ')' : 'rgba(255,80,80,' + hm + ')'; ctx.lineWidth = 3;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([ax, ay]) => { ctx.beginPath(); ctx.moveTo(W / 2 + ax * 6, hy + ay * 6); ctx.lineTo(W / 2 + ax * 16, hy + ay * 16); ctx.stroke(); }); }
    if (this.dmgDir && now < this.dmgDir.until) { const k = (this.dmgDir.until - now) / 900; ctx.save(); ctx.translate(W / 2, hy); ctx.rotate(this.dmgDir.a); ctx.strokeStyle = 'rgba(255,60,80,' + (k * 0.9).toFixed(2) + ')'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, Math.min(W, H) * 0.22, -0.35, 0.35); ctx.stroke(); ctx.restore(); }
    if (this.hurt > 0 || (this.hp <= 30 && !this.isDead)) { const a = Math.max(this.hurt * 0.6, this.hp <= 30 && !this.isDead ? 0.25 + Math.sin(now / 180) * 0.12 : 0); const g = ctx.createRadialGradient(W / 2, hy, H * 0.25, W / 2, hy, H * 0.85); g.addColorStop(0, 'rgba(255,40,70,0)'); g.addColorStop(1, 'rgba(255,40,70,' + a.toFixed(2) + ')'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    // 체력
    rr(14, H - 66, 168, 52, 14, 'rgba(8,10,16,0.72)');
    ctx.fillStyle = this.hp > 40 ? '#06D6A0' : '#FF5C7A'; ctx.font = '800 26px Pretendard, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText('+', 28, H - 30); ctx.fillText(String(this.hp), 50, H - 30);
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(28, H - 24, 140, 5); ctx.fillStyle = this.hp > 40 ? '#06D6A0' : '#FF5C7A'; ctx.fillRect(28, H - 24, 140 * this.hp / 100, 5);
    // 탄약
    rr(W - 152, H - 66, 138, 52, 14, 'rgba(8,10,16,0.72)'); ctx.textAlign = 'right';
    if (this.reloading) { ctx.fillStyle = '#FFD166'; ctx.font = '800 15px Pretendard, sans-serif'; ctx.fillText('재장전 중…', W - 28, H - 36); ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(W - 138, H - 26, 110, 5); ctx.fillStyle = '#FFD166'; ctx.fillRect(W - 138, H - 26, 110 * (1 - (this.reloadUntil - now) / 1400), 5); }
    else { ctx.fillStyle = this.ammo > 6 ? '#FFFFFF' : '#FF5C7A'; ctx.font = '800 28px Pretendard, sans-serif'; ctx.fillText(String(this.ammo), W - 62, H - 34); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '700 13px Pretendard, sans-serif'; ctx.fillText('/ ' + F3_MAG, W - 26, H - 34);
      for (let k = 0; k < 15; k++) { ctx.fillStyle = k < Math.ceil(this.ammo / 2) ? (this.ammo > 6 ? '#FFD166' : '#FF5C7A') : 'rgba(255,255,255,0.15)'; ctx.fillRect(W - 138 + k * 7.4, H - 26, 5, 6); } }
    ctx.textAlign = 'left';
    // 점수판
    if (this.teamMode) {
      let red = 0, blue = 0; const add = (t, k) => { if (t === 'red') red += k; else if (t === 'blue') blue += k; };
      add(this.team, this.kills); Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (this.spectator && id === this.followId) return; add(p.team, p.kills || 0); });
      rr(W / 2 - 84, 10, 168, 40, 14, 'rgba(8,10,16,0.72)'); ctx.textAlign = 'center'; ctx.font = '800 22px Pretendard, sans-serif';
      ctx.fillStyle = F3_TEAM_CSS.red; ctx.fillText(String(red), W / 2 - 40, 39); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '700 14px Pretendard, sans-serif'; ctx.fillText('RED   BLUE', W / 2, 38);
      ctx.fillStyle = F3_TEAM_CSS.blue; ctx.font = '800 22px Pretendard, sans-serif'; ctx.fillText(String(blue), W / 2 + 40, 39); ctx.textAlign = 'left';
      ctx.fillStyle = teamC; ctx.font = '800 12px Pretendard, sans-serif'; ctx.fillText(this.team === 'red' ? '🔴 RED' : '🔵 BLUE', 62, 28);
    } else { rr(W / 2 - 64, 10, 128, 36, 14, 'rgba(8,10,16,0.72)'); ctx.textAlign = 'center'; ctx.font = '800 16px Pretendard, sans-serif'; ctx.fillStyle = '#FFD166'; ctx.fillText('K ' + this.kills + '   D ' + this.deaths, W / 2, 34); ctx.textAlign = 'left'; }
    // 킬 피드
    this.feed = this.feed.filter(x => x.until > now); ctx.font = '700 12px Pretendard, sans-serif'; ctx.textAlign = 'right';
    this.feed.forEach((x, i) => { const y = 66 + i * 20, t = x.a + (x.head ? '  🎯  ' : '  ⚡  ') + x.b; const tw = ctx.measureText(t).width + 16; rr(W - 14 - tw, y - 14, tw, 19, 8, 'rgba(8,10,16,0.6)'); ctx.fillStyle = x.color; ctx.fillText(t, W - 22, y); });
    ctx.textAlign = 'left';
    this.drawMinimap(ctx, W, H);
    if (this.toast && now < this.toast.until) { ctx.textAlign = 'center'; ctx.font = '800 18px Pretendard, sans-serif'; ctx.fillStyle = this.toast.color; ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4; ctx.fillText(this.toast.text, W / 2, hy + 80); ctx.shadowBlur = 0; ctx.textAlign = 'left'; }
    if (this.isDead) {
      ctx.fillStyle = 'rgba(8,10,16,0.55)'; ctx.fillRect(0, 0, W, H); const left = (this.deadUntil - now) / 3000;
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(W / 2, hy, 48, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#FF5C7A'; ctx.beginPath(); ctx.arc(W / 2, hy, 48, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - left)); ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '800 30px Pretendard, sans-serif'; ctx.fillText(String(Math.ceil(left * 3)), W / 2, hy + 11);
      ctx.fillStyle = '#FF5C7A'; ctx.font = '800 20px Pretendard, sans-serif'; ctx.fillText((this.killer || '누군가') + (this.killHead ? ' 의 헤드샷' : ' 에게 당했다'), W / 2, hy - 74);
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '600 13px Pretendard, sans-serif'; ctx.fillText('잠시 후 다시 등장합니다', W / 2, hy + 78); ctx.textAlign = 'left';
    }
    if (this.spectator) { ctx.textAlign = 'center'; ctx.font = '700 13px Pretendard, sans-serif'; ctx.fillStyle = '#FFD166'; ctx.fillText('👁 ' + this.myName + ' 의 화면', W / 2, this.teamMode ? 66 : 64); ctx.textAlign = 'left'; }
    if (this.showBoard) this.drawScoreboard(ctx, W, H);
  }

  // 점수판 — 전원 킬/데스 (팀전은 팀별로 나눔)
  drawScoreboard(ctx, W, H) {
    const rows = [{ id: this.myId, name: this.myName || '나', k: this.kills, d: this.deaths, team: this.team, me: true, dead: this.isDead }];
    Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (this.spectator && id === this.followId) return; rows.push({ id, name: p.name || '학생', k: p.kills || 0, d: p.deaths || 0, team: p.team, me: false, dead: p.dead }); });
    rows.sort((a, b) => (b.k - a.k) || (a.d - b.d));
    const groups = this.teamMode ? [['red', rows.filter(r => r.team === 'red')], ['blue', rows.filter(r => r.team === 'blue')]] : [[null, rows]];
    const rowH = 22, bw = Math.min(W - 24, 360);
    let bh = 34; groups.forEach(([t, g]) => { bh += (t ? 26 : 0) + Math.min(g.length, 10) * rowH + 8; });
    const x0 = W / 2 - bw / 2, y0 = Math.max(60, H / 2 - bh / 2);
    ctx.save();
    ctx.fillStyle = 'rgba(8,10,16,0.88)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x0, y0, bw, bh, 18); else ctx.rect(x0, y0, bw, bh); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.textBaseline = 'middle';
    ctx.font = '800 13px Pretendard, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.textAlign = 'left'; ctx.fillText('점수판', x0 + 16, y0 + 18);
    ctx.textAlign = 'right'; ctx.font = '700 11px Pretendard, sans-serif'; ctx.fillText('K      D', x0 + bw - 18, y0 + 18);
    let y = y0 + 34;
    groups.forEach(([t, g]) => {
      if (t) { ctx.textAlign = 'left'; ctx.font = '800 12px Pretendard, sans-serif'; ctx.fillStyle = F3_TEAM_CSS[t];
        const tk = g.reduce((a, r) => a + r.k, 0); ctx.fillText((t === 'red' ? '🔴 RED' : '🔵 BLUE') + '  ' + tk, x0 + 16, y + 13); y += 26; }
      g.slice(0, 10).forEach((r, i) => {
        if (r.me) { ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x0 + 8, y + 1, bw - 16, rowH - 2, 7); else ctx.rect(x0 + 8, y + 1, bw - 16, rowH - 2); ctx.fill(); }
        ctx.textAlign = 'left'; ctx.font = (r.me ? '800' : '600') + ' 13px Pretendard, sans-serif';
        ctx.fillStyle = r.dead ? 'rgba(255,255,255,0.4)' : (r.team ? F3_TEAM_CSS[r.team] : '#fff');
        ctx.fillText((i + 1) + '.  ' + r.name, x0 + 16, y + rowH / 2);
        ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.font = '700 13px Pretendard, sans-serif';
        ctx.fillText(r.k + '      ' + r.d, x0 + bw - 18, y + rowH / 2);
        y += rowH;
      });
      y += 8;
    });
    ctx.restore(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  drawMinimap(ctx, W, H) {
    const n = this.map.length, size = Math.min(104, W * 0.28), cs = size / n, x0 = 14, y0 = 62;   // 왼쪽 위 뒤로가기 버튼 아래
    if (!this._mm || this._mmSize !== size) {
      this._mm = document.createElement('canvas'); this._mm.width = Math.ceil(size + 8); this._mm.height = Math.ceil(size + 8); this._mmSize = size;
      const g = this._mm.getContext('2d'); g.fillStyle = 'rgba(8,10,16,0.72)'; g.beginPath(); if (g.roundRect) g.roundRect(0, 0, size + 8, size + 8, 10); else g.rect(0, 0, size + 8, size + 8); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.3)'; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (this.map[y][x] !== '.') g.fillRect(4 + x * cs, 4 + y * cs, cs, cs);
    }
    ctx.drawImage(this._mm, x0 - 4, y0 - 4);
    Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (this.spectator && id === this.followId) return; if (this.teamMode && p.team !== this.team && !this.spectator) return;
      ctx.fillStyle = p.dead ? '#6B7280' : (p.team ? F3_TEAM_CSS[p.team] : '#FFD166'); ctx.beginPath(); ctx.arc(x0 + p.x * cs, y0 + p.y * cs, 2.4, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.moveTo(x0 + this.x * cs, y0 + this.y * cs); ctx.arc(x0 + this.x * cs, y0 + this.y * cs, cs * 5, this.yaw - Math.PI / 6, this.yaw + Math.PI / 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x0 + this.x * cs, y0 + this.y * cs, 3, 0, Math.PI * 2); ctx.fill();
  }

  destroy() {
    if (this.hud && this.hud.parentElement) this.hud.parentElement.removeChild(this.hud);
    if (this.renderer) { try { this.renderer.dispose(); } catch (e) {} }
  }
}
