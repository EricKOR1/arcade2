// 레이저 태그 (FPS) — 1인칭 시점. 개인전 · 팀전.
// 좌우 = 회전, ▲▼ = 이동, 발사(꾹) = 연사. 30발 탄창, 다 쓰면 자동 재장전(1.4초).
// 렌더링: 텍스처 레이캐스팅 + 거리 안개 + 빌보드 스프라이트. 태블릿 30명 기준으로 비용을 맞췄습니다.

// 맵 기호: # 콘크리트  = 금속 패널  X 상자  B 벽돌  . 바닥
const FPS_MAP = [
  '########################',
  '#....=........B........#',
  '#.XX.=.######.B.######.#',
  '#.X..=......#.B.#......#',
  '#.#.####.##.#...#.####.#',
  '#........X..#.###..#...#',
  '####.###.#..........#.##',
  '#....#...#.#######.....#',
  '#.##.#.###.#.....#.###.#',
  '#.#....#...#.XXX.#...#.#',
  '#.#.##.#.#.#.X.X.#.#.#.#',
  '#...#..#.#...X.#...#...#',
  '#.#.#.##.#####.#.#.##.##',
  '#.#.#....#...#...#....##',
  '#.#.####.#.#.#####.###.#',
  '#.#......#.#.......#...#',
  '#.######.#.#.######.#.##',
  '#......#.#.#......#.#..#',
  '#.####.#...######.#.##.#',
  '#....#.#.#........#....#',
  '#.##.#.#.#.########.##.#',
  '#....#...#.........#...#',
  '#.##...B...=======...X.#',
  '########################'
];
const FPS_SPAWNS = [[1.5,1.5],[22.5,1.5],[1.5,22.5],[22.5,22.5],[12,1.5],[1.5,12],[22.5,12],[12,22.5],[6.5,6.5],[17.5,17.5],[17.5,6.5],[6.5,17.5]];
const FPS_TEAM_COLORS = { red: '#FF5C7A', blue: '#4CC9F0' };
const FPS_MAG = 30;

class FpsGame {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = opts || {};
    this.myId = this.opts.myId || 'me';
    this.myName = this.opts.myName || '';
    this.teamMode = !!this.opts.teamMode;
    this.team = this.teamMode ? FpsGame.teamOf(this.myId) : null;
    this.map = FPS_MAP;
    this.peers = {};
    this.hp = 100; this.kills = 0; this.deaths = 0; this.score = 0; this.streak = 0;
    this.ammo = FPS_MAG; this.reloadUntil = 0;
    this.turn = 0; this.fwd = 0; this.firing = false; this.upHeld = false;
    this.lastFire = 0; this.muzzle = 0; this.recoil = 0; this.hurt = 0; this.deadUntil = 0;
    this.hitMarker = 0; this.dmgDir = null; this.bob = 0; this.moving = 0;
    this.gameOver = false; this.toast = null; this.feed = []; this.hits = []; this.tracers = [];
    this.lastTime = 0; this.now = 0;
    this.spawnAt(this.opts.slot || 0);
  }

  static teamOf(id) { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return (h & 1) ? 'red' : 'blue'; }
  static parse(raw) {
    const a = String(raw).split(',');
    return { x: +a[0], y: +a[1], angle: +a[2], hp: +a[3], kills: +a[4], deaths: +a[5], team: a[6] || null, fire: a[7] === '1', dead: a[8] === '1', moving: a[9] === '1' };
  }
  get isDead() { return this.now < this.deadUntil; }
  get reloading() { return this.now < this.reloadUntil; }
  clock() { return this.now || performance.now(); }

  spawnAt(slot) {
    let best = null, bestD = -1;
    FPS_SPAWNS.forEach((sp, i) => {
      let d = 1e9;
      Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (p.dead || (this.teamMode && p.team === this.team)) return; d = Math.min(d, Math.hypot(p.x - sp[0], p.y - sp[1])); });
      if (d === 1e9) d = 100 + ((i + slot) % FPS_SPAWNS.length);
      if (d > bestD) { bestD = d; best = sp; }
    });
    this.x = best[0]; this.y = best[1];
    this.angle = Math.atan2(12 - this.y, 12 - this.x);
    this.ammo = FPS_MAG; this.reloadUntil = 0;
  }

  // ── 조작 ──
  move(dir) { this.turn = dir; }
  releaseSteer(dir) { if (this.turn === dir) this.turn = 0; }
  up() { this.upHeld = true; }
  softDrop() { this.fwd = -1; }
  rotate() { this.fire(); }
  hardDrop() { this.fire(); }
  fire() { this.shoot(); }
  reload() { if (this.reloading || this.ammo === FPS_MAG || this.isDead) return; this.reloadUntil = this.clock() + 1400; if (window.Sound) Sound.softDrop(); }

  cell(x, y) { const r = this.map[Math.floor(y)]; return (r && r[Math.floor(x)]) || '#'; }
  wall(x, y) { return this.cell(x, y) !== '.'; }

  shoot() {
    const now = this.clock();
    if (this.isDead || this.spectator || this.reloading) return;
    if (this.ammo <= 0) { this.reload(); return; }
    if (now - this.lastFire < 110) return;                      // 연사 속도
    this.lastFire = now; this.muzzle = 1; this.recoil = Math.min(1, this.recoil + 0.35); this.ammo--;
    if (this.ammo <= 0) this.reload();
    if (window.Sound) Sound.hardDrop();
    // 반동으로 조준이 살짝 흔들림
    const spread = 0.012 * this.recoil + (this.moving ? 0.012 : 0);
    const aim = this.angle + (Math.random() - 0.5) * spread * 2;
    // 히트스캔
    let best = null, bestD = 1e9;
    Object.keys(this.peers).forEach(id => {
      const p = this.peers[id];
      if (p.dead || (this.teamMode && p.team === this.team)) return;
      const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy);
      if (d > 16) return;
      let da = Math.atan2(dy, dx) - aim; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      if (Math.abs(da) > Math.max(0.03, 0.36 / d)) return;
      if (this.blocked(this.x, this.y, p.x, p.y)) return;
      if (d < bestD) { bestD = d; best = id; }
    });
    // 레이저 궤적 (맞았으면 상대까지, 아니면 벽까지)
    let tx = this.x, ty = this.y, n = 0;
    while (!this.wall(tx, ty) && n++ < 200) { tx += Math.cos(aim) * 0.1; ty += Math.sin(aim) * 0.1; }
    if (best) { const p = this.peers[best]; tx = p.x; ty = p.y; }
    this.tracers.push({ x0: this.x, y0: this.y, x1: tx, y1: ty, until: now + 90 });
    if (best) {
      const dmg = bestD < 6 ? 34 : 26;                          // 가까우면 3발, 멀면 4발
      if (this.opts.onAttack) this.opts.onAttack('hit', best, { dmg: dmg });
      this.hits.push({ id: best, until: now + 160 });
      this.hitMarker = 1; this.score += 3;
      if (window.Sound) Sound.lock();
    }
  }

  blocked(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d * 8);
    for (let i = 1; i < n; i++) { const t = i / n; if (this.wall(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return true; }
    return false;
  }

  // ── 피격 이벤트 ──
  onEvent(e) {
    if (!e) return;
    if (e.type === 'hit' && e.target === this.myId) {
      if (this.isDead) return;
      this.hp = Math.max(0, this.hp - (e.dmg || 26)); this.hurt = 1;
      // 맞은 방향 (공격자 위치 기준)
      const p = this.peers[e.by];
      if (p) { let da = Math.atan2(p.y - this.y, p.x - this.x) - this.angle; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; this.dmgDir = { a: da, until: this.clock() + 900 }; }
      if (window.Sound) Sound.crash();
      const who = this.nameOf(e.by);
      if (this.hp <= 0) {
        this.deaths++; this.streak = 0; this.deadUntil = this.clock() + 3000; this.score = Math.max(0, this.score - 20);
        this.killer = who;
        this.pushFeed(who, this.myName, '#FF5C7A');
        if (this.opts.onAttack) this.opts.onAttack('kill', e.by, { victim: this.myId });
        if (window.Sound) Sound.gameOver();
      }
    } else if (e.type === 'kill' && e.target === this.myId) {
      this.kills++; this.streak++; this.score += 100 + (this.streak >= 3 ? 50 : 0);
      this.pushFeed(this.myName, this.nameOf(e.victim), '#06D6A0');
      this.showToast(this.streak >= 5 ? '🔥 ' + this.streak + '연속 킬!' : (this.streak >= 3 ? this.streak + '연속 킬  +150' : this.nameOf(e.victim) + ' 처치  +100'), this.streak >= 3 ? '#FFD166' : '#06D6A0');
      if (window.Sound) Sound.levelUp();
    } else if (e.type === 'kill') {
      this.pushFeed(this.nameOf(e.by), this.nameOf(e.victim), '#9AA3B2');
    }
  }
  nameOf(id) { if (this.peers[id] && this.peers[id].name) return this.peers[id].name; if (this.opts.nameOf) return this.opts.nameOf(id) || '?'; return '?'; }
  pushFeed(a, b, color) { this.feed.unshift({ a, b, color, until: this.clock() + 5000 }); this.feed = this.feed.slice(0, 5); }
  showToast(text, color) { this.toast = { text, color, until: this.clock() + 1600 }; }

  // ── 동기화 ──
  serialize() {
    return [this.x.toFixed(2), this.y.toFixed(2), this.angle.toFixed(2), this.hp, this.kills, this.deaths, this.team || '',
            this.muzzle > 0.5 ? 1 : 0, this.isDead ? 1 : 0, this.moving ? 1 : 0].join(',');
  }
  applyPeerRaw(id, raw, name) {
    const d = FpsGame.parse(raw);
    if (!this.peers[id]) this.peers[id] = { x: d.x, y: d.y, angle: d.angle, walk: 0 };
    const p = this.peers[id];
    Object.assign(p, { tx: d.x, ty: d.y, tangle: d.angle, hp: d.hp, kills: d.kills, deaths: d.deaths, team: d.team, fire: d.fire, dead: d.dead, moving: d.moving });
    if (name) p.name = name;
  }
  removePeer(id) { delete this.peers[id]; }
  setPeers(map) { Object.keys(map).forEach(id => { const d = map[id]; if (d.raw) this.applyPeerRaw(id, d.raw, d.name); }); Object.keys(this.peers).forEach(id => { if (!map[id]) delete this.peers[id]; }); }
  spectate(id) { this.spectator = true; this.followId = id; }

  // ── 프레임 ──
  tick(now) {
    this.now = now;
    const dt = this.lastTime ? Math.min(50, now - this.lastTime) : 16.7;
    this.lastTime = now; const f = dt / 16.7;
    Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (p.tx == null) return;
      p.x += (p.tx - p.x) * 0.3; p.y += (p.ty - p.y) * 0.3;
      let da = p.tangle - p.angle; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; p.angle += da * 0.3;
      p.walk = (p.walk || 0) + (p.moving ? 0.22 * f : 0); });
    this.tracers = this.tracers.filter(t => t.until > now);
    this.hits = this.hits.filter(h => h.until > now);
    this.muzzle = Math.max(0, this.muzzle - 0.18 * f); this.recoil = Math.max(0, this.recoil - 0.06 * f);
    this.hurt = Math.max(0, this.hurt - 0.04 * f); this.hitMarker = Math.max(0, this.hitMarker - 0.08 * f);

    if (this.spectator) {
      const p = this.peers[this.followId];
      if (p) { this.x = p.x; this.y = p.y; this.angle = p.angle; this.hp = p.hp; this.kills = p.kills; this.deaths = p.deaths; this.team = p.team; this.myName = p.name || ''; this.deadUntil = p.dead ? now + 100 : 0; this.moving = p.moving; if (p.fire) this.muzzle = 1; }
      this.draw(); return;
    }
    if (this.isDead) {
      if (!this._respawned && this.deadUntil - now < 50) { this._respawned = true; this.hp = 100; this.spawnAt(Math.floor(Math.random() * 12)); this.dmgDir = null; }
      this.draw(); return;
    }
    this._respawned = false;
    if (this.reloadUntil && now >= this.reloadUntil && this.ammo < FPS_MAG) { this.ammo = FPS_MAG; this.reloadUntil = 0; if (window.Sound) Sound.rotate(); }

    this.angle += this.turn * 0.05 * f;
    let mv = this.fwd; if (this.upHeld) mv = 1;
    this.moving = mv ? 1 : 0;
    if (mv) {
      const sp = 0.072 * f * mv;
      const nx = this.x + Math.cos(this.angle) * sp, ny = this.y + Math.sin(this.angle) * sp, R = 0.25;
      if (!this.wall(nx + Math.sign(nx - this.x) * R, this.y)) this.x = nx;
      if (!this.wall(this.x, ny + Math.sign(ny - this.y) * R)) this.y = ny;
      this.bob += 0.2 * f;
    }
    this.fwd = 0;
    if (this.firing) this.shoot();
    this.draw();
  }

  getSnapshot() { return null; }

  // ── 텍스처 (한 번만 만들어 재사용) ──
  static tex(kind) {
    FpsGame._tex = FpsGame._tex || {};
    if (FpsGame._tex[kind]) return FpsGame._tex[kind];
    const S = 64, cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const g = cv.getContext('2d');
    const noise = (a) => { for (let i = 0; i < 260; i++) { g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '0,0,0' : '255,255,255') + ',' + a + ')'; g.fillRect(Math.random() * S, Math.random() * S, 2, 2); } };
    if (kind === '#') {                                   // 콘크리트 패널
      g.fillStyle = '#7A8496'; g.fillRect(0, 0, S, S); noise(0.08);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; g.strokeRect(2, 2, S - 4, S - 4);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(4, 4, S - 8, 3);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(4, S - 8, S - 8, 4);
      g.fillStyle = '#4A5163'; [8, 56].forEach(x => [8, 56].forEach(y => { g.beginPath(); g.arc(x, y, 2, 0, 6.3); g.fill(); }));
    } else if (kind === '=') {                            // 금속 패널 + 경고 띠
      g.fillStyle = '#5C6678'; g.fillRect(0, 0, S, S); noise(0.06);
      for (let y = 0; y < S; y += 16) { g.fillStyle = y % 32 ? '#525B6C' : '#67728A'; g.fillRect(0, y, S, 16); g.fillStyle = 'rgba(255,255,255,0.1)'; g.fillRect(0, y, S, 2); }
      g.fillStyle = '#FFD166'; for (let x = -16; x < S + 16; x += 16) { g.beginPath(); g.moveTo(x, S - 12); g.lineTo(x + 8, S - 12); g.lineTo(x, S - 4); g.lineTo(x - 8, S - 4); g.closePath(); g.fill(); }
      g.fillStyle = '#1A1D24'; for (let x = -8; x < S + 16; x += 16) { g.beginPath(); g.moveTo(x, S - 12); g.lineTo(x + 8, S - 12); g.lineTo(x, S - 4); g.lineTo(x - 8, S - 4); g.closePath(); g.fill(); }
    } else if (kind === 'X') {                            // 나무 상자
      g.fillStyle = '#8A6238'; g.fillRect(0, 0, S, S); noise(0.07);
      g.strokeStyle = '#5A3E22'; g.lineWidth = 4; g.strokeRect(3, 3, S - 6, S - 6);
      g.beginPath(); g.moveTo(4, 4); g.lineTo(S - 4, S - 4); g.moveTo(S - 4, 4); g.lineTo(4, S - 4); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(6, 6, S - 12, 2);
    } else {                                              // 벽돌
      g.fillStyle = '#6B3F3A'; g.fillRect(0, 0, S, S);
      for (let y = 0; y < S; y += 16) for (let x = ((y / 16) % 2) * 16 - 16; x < S; x += 32) { g.fillStyle = (x + y) % 3 ? '#8A4E46' : '#7C463F'; g.fillRect(x + 2, y + 2, 28, 12); }
      noise(0.05);
    }
    FpsGame._tex[kind] = cv; return cv;
  }

  // ── 하늘 (회전에 따라 스크롤) ──
  skyStrip(W, H) {
    if (this._sky && this._sky.width === Math.round(W * 2) && this._sky.height === Math.round(H / 2)) return this._sky;
    const cv = document.createElement('canvas'); cv.width = Math.round(W * 2); cv.height = Math.round(H / 2);
    const g = cv.getContext('2d'), h = cv.height, w = cv.width;
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#05070F'); sky.addColorStop(0.7, '#141B33'); sky.addColorStop(1, '#2A3555');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 120; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.3 + Math.random() * 0.6).toFixed(2) + ')'; g.fillRect(Math.random() * w, Math.random() * h * 0.7, 1.5, 1.5); }
    // 멀리 보이는 시설 실루엣 + 조명
    for (let x = 0; x < w; x += 36 + Math.random() * 40) {
      const bh = h * (0.12 + Math.random() * 0.3), bw = 30 + Math.random() * 50;
      g.fillStyle = '#0D1220'; g.fillRect(x, h - bh, bw, bh);
      g.fillStyle = 'rgba(255,214,120,0.5)'; for (let k = 0; k < 4; k++) if (Math.random() < 0.6) g.fillRect(x + 6 + k * 9, h - bh + 6 + Math.random() * (bh - 10), 4, 4);
      if (Math.random() < 0.3) { g.fillStyle = '#FF5C7A'; g.fillRect(x + bw / 2, h - bh - 8, 2, 8); }
    }
    this._sky = cv; return cv;
  }

  draw() {
    const ctx = this.ctx, W = this.canvas.clientWidth || this.canvas.width, H = this.canvas.clientHeight || this.canvas.height;
    const now = this.clock();
    const FOV = Math.PI / 3, cols = Math.min(170, Math.floor(W / 2.5)), cw = W / cols;
    const zb = this.zbuf = new Float32Array(cols);
    const bobY = Math.sin(this.bob) * (this.moving ? 4 : 0);
    const hy = H * 0.5 + bobY, myTeamC = this.team ? FPS_TEAM_COLORS[this.team] : '#FFD166';
    const FOG = '#0E1322';

    // 하늘
    const sky = this.skyStrip(W, H);
    const off = ((this.angle / (Math.PI * 2)) * sky.width) % sky.width;
    ctx.drawImage(sky, off, 0, sky.width - off, sky.height, 0, hy - sky.height, sky.width - off, sky.height);
    ctx.drawImage(sky, 0, 0, off, sky.height, sky.width - off, hy - sky.height, off, sky.height);
    // 바닥 — 원근 안개 + 격자
    const fl = ctx.createLinearGradient(0, hy, 0, H); fl.addColorStop(0, FOG); fl.addColorStop(0.5, '#1C2233'); fl.addColorStop(1, '#2C3448');
    ctx.fillStyle = fl; ctx.fillRect(0, hy, W, H - hy);
    ctx.strokeStyle = 'rgba(120,150,200,0.10)'; ctx.lineWidth = 1;
    for (let k = 1; k < 10; k++) { const y = hy + (H - hy) / (11 - k); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    const spin = (this.x * Math.sin(this.angle) - this.y * Math.cos(this.angle)) % 1;
    for (let k = -6; k <= 6; k++) { const x = W / 2 + (k - spin) * W * 0.16; ctx.beginPath(); ctx.moveTo(W / 2 + (x - W / 2) * 0.05, hy); ctx.lineTo(x * 2 - W / 2, H); ctx.stroke(); }

    // 벽 — 텍스처 열
    for (let c = 0; c < cols; c++) {
      const ra = this.angle + Math.atan((c / cols - 0.5) * 2 * Math.tan(FOV / 2));   // 어안 왜곡 없는 투영
      const dx = Math.cos(ra), dy = Math.sin(ra);
      let mx = Math.floor(this.x), my = Math.floor(this.y);
      const ddx = Math.abs(1 / (dx || 1e-9)), ddy = Math.abs(1 / (dy || 1e-9));
      let sx, sy, sdx, sdy;
      if (dx < 0) { sx = -1; sdx = (this.x - mx) * ddx; } else { sx = 1; sdx = (mx + 1 - this.x) * ddx; }
      if (dy < 0) { sy = -1; sdy = (this.y - my) * ddy; } else { sy = 1; sdy = (my + 1 - this.y) * ddy; }
      let side = 0, kind = '#', n = 0;
      while (n++ < 48) {
        if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; }
        const k = this.cell(mx + 0.5, my + 0.5); if (k !== '.') { kind = k; break; }
      }
      const rawD = side === 0 ? sdx - ddx : sdy - ddy;
      const dist = rawD * Math.cos(ra - this.angle);
      zb[c] = dist;
      const lh = Math.min(H * 3, H / Math.max(0.05, dist));
      const wallX = side === 0 ? this.y + rawD * dy : this.x + rawD * dx;
      const tex = FpsGame.tex(kind), tx = Math.floor((wallX - Math.floor(wallX)) * tex.width);
      const x0 = Math.floor(c * cw), y0 = hy - lh / 2;
      ctx.drawImage(tex, tx, 0, 1, tex.height, x0, y0, Math.ceil(cw) + 1, lh);
      // 면 방향 음영 + 거리 안개
      const fog = Math.min(0.92, dist / 13);
      const shade = side ? 0.25 : 0.05;
      if (shade + fog > 0.02) { ctx.fillStyle = 'rgba(14,19,34,' + Math.min(0.95, shade + fog).toFixed(2) + ')'; ctx.fillRect(x0, y0, Math.ceil(cw) + 1, lh); }
    }

    // 레이저 궤적 (내가 쏜 것) — 화면 아래 총구에서 목표점으로
    this.tracers.forEach(t => {
      const dx = t.x1 - this.x, dy = t.y1 - this.y, d = Math.hypot(dx, dy);
      let da = Math.atan2(dy, dx) - this.angle; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      if (Math.abs(da) > FOV / 2 + 0.2) return;
      const sx = W / 2 + Math.tan(da) / Math.tan(FOV / 2) * (W / 2), sz = Math.max(0.1, d * Math.cos(da));
      const ex = sx, ey = hy;
      const k = (t.until - now) / 90;
      ctx.strokeStyle = 'rgba(120,230,255,' + (0.9 * k).toFixed(2) + ')'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(W * 0.66, H - H * 0.19); ctx.lineTo(ex, ey - (H / sz) * 0.02); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.6 * k).toFixed(2) + ')'; ctx.lineWidth = 1; ctx.stroke();
    });

    // 상대 — 사람 형태 빌보드
    const sprites = [];
    Object.keys(this.peers).forEach(id => {
      if (this.spectator && id === this.followId) return;
      const p = this.peers[id];
      const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy);
      let da = Math.atan2(dy, dx) - this.angle; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      if (Math.abs(da) > FOV / 2 + 0.3 || d < 0.2 || d > 18) return;
      sprites.push({ id, p, d: d * Math.cos(da), da, dist: d });
    });
    sprites.sort((a, b) => b.d - a.d);
    if (sprites.length > 14) sprites.splice(0, sprites.length - 14);
    sprites.forEach(s => this.drawSoldier(ctx, s, W, H, hy, FOV, cw, cols, zb, now));
    ctx.textAlign = 'left';

    if (!this.spectator) this.drawWeapon(ctx, W, H, now, myTeamC);
    this.drawHud(ctx, W, H, hy, now, myTeamC);
  }

  drawSoldier(ctx, s, W, H, hy, FOV, cw, cols, zb, now) {
    const p = s.p;
    const sx = W / 2 + Math.tan(s.da) / Math.tan(FOV / 2) * (W / 2);
    const h = Math.min(H * 2.2, H / Math.max(0.05, s.d)) * 0.72, w = h * 0.42;
    const col = Math.floor(sx / cw);
    if (col >= 0 && col < cols && zb[col] < s.d) return;
    const teamC = p.team ? FPS_TEAM_COLORS[p.team] : '#FFD166';
    const fog = Math.min(0.75, s.dist / 14);
    const hit = this.hits.some(x => x.id === s.id);
    const y0 = hy - h * 0.5, yBase = y0 + h;                 // y0 = 머리 위, yBase = 발
    ctx.save();
    if (p.dead) { ctx.globalAlpha = 0.5; ctx.translate(sx, yBase); ctx.rotate(0.9); ctx.translate(-sx, -yBase); }
    // 다리 (걷기 애니메이션)
    const sw = p.moving ? Math.sin(p.walk) * 0.35 : 0;
    ctx.fillStyle = '#23283A';
    ctx.fillRect(sx - w * 0.3, y0 + h * 0.56, w * 0.24, h * 0.44 - Math.max(0, sw) * h * 0.1);
    ctx.fillRect(sx + w * 0.06, y0 + h * 0.56, w * 0.24, h * 0.44 - Math.max(0, -sw) * h * 0.1);
    // 몸통 (방탄복) + 팀 색 띠
    ctx.fillStyle = '#3A4256'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(sx - w * 0.42, y0 + h * 0.22, w * 0.84, h * 0.38, w * 0.12); else ctx.rect(sx - w * 0.42, y0 + h * 0.22, w * 0.84, h * 0.38); ctx.fill();
    ctx.fillStyle = teamC; ctx.fillRect(sx - w * 0.42, y0 + h * 0.22, w * 0.84, h * 0.06); ctx.fillRect(sx - w * 0.12, y0 + h * 0.28, w * 0.24, h * 0.3);
    // 팔 + 총
    ctx.fillStyle = '#2F3648'; ctx.fillRect(sx - w * 0.55, y0 + h * 0.26, w * 0.14, h * 0.3);
    ctx.fillStyle = '#1A1D24'; ctx.fillRect(sx + w * 0.1, y0 + h * 0.36, w * 0.75, h * 0.07);
    ctx.fillStyle = teamC; ctx.fillRect(sx + w * 0.75, y0 + h * 0.36, w * 0.1, h * 0.07);
    if (p.fire) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(sx + w * 0.9, y0 + h * 0.39, w * 0.14, 0, Math.PI * 2); ctx.fill(); }
    // 머리 (헬멧 + 바이저)
    ctx.fillStyle = '#2B3140'; ctx.beginPath(); ctx.arc(sx, y0 + h * 0.12, w * 0.24, Math.PI, 0); ctx.fill(); ctx.fillRect(sx - w * 0.24, y0 + h * 0.12, w * 0.48, h * 0.1);
    ctx.fillStyle = teamC; ctx.fillRect(sx - w * 0.2, y0 + h * 0.13, w * 0.4, h * 0.06);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(sx - w * 0.16, y0 + h * 0.14, w * 0.14, h * 0.03);
    if (hit) { ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(sx - w * 0.6, y0, w * 1.5, h); }
    if (fog > 0.05) { ctx.fillStyle = 'rgba(14,19,34,' + fog.toFixed(2) + ')'; ctx.fillRect(sx - w * 0.6, y0, w * 1.5, h); }
    ctx.restore();
    // 이름표 · 체력 · 거리
    if (h > 22 && !p.dead) {
      const fs = Math.max(10, Math.min(14, h * 0.11));
      ctx.font = '700 ' + fs + 'px Pretendard, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const label = (p.name || '') + '  ' + Math.round(s.dist * 3) + 'm';
      const tw = ctx.measureText(label).width + 12;
      ctx.fillStyle = 'rgba(8,10,16,0.65)'; ctx.fillRect(sx - tw / 2, y0 - fs - 14, tw, fs + 6);
      ctx.fillStyle = teamC; ctx.fillText(label, sx, y0 - 12);
      const bw = Math.max(30, w * 1.3);
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(sx - bw / 2, y0 - 7, bw, 4);
      ctx.fillStyle = (p.hp || 0) > 40 ? '#06D6A0' : '#FF5C7A'; ctx.fillRect(sx - bw / 2, y0 - 7, bw * Math.max(0, Math.min(1, (p.hp || 0) / 100)), 4);
    }
  }

  drawWeapon(ctx, W, H, now, teamC) {
    const kick = this.recoil * 14, sway = Math.sin(this.bob * 0.5) * (this.moving ? 6 : 0);
    const rel = this.reloading ? Math.sin(((this.reloadUntil - now) / 1400) * Math.PI) * 60 : 0;
    const gx = W * 0.5 + sway, gy = H + kick + rel;
    const s = Math.min(W, H) / 380;
    ctx.save(); ctx.translate(gx, gy); ctx.scale(s, s);
    // 손 · 팔
    ctx.fillStyle = '#4B4F5E'; ctx.fillRect(40, -70, 90, 80); ctx.fillRect(-30, -60, 70, 70);
    // 총몸
    const body = ctx.createLinearGradient(0, -130, 0, -40); body.addColorStop(0, '#3A4152'); body.addColorStop(1, '#1E2230');
    ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(-10, -50); ctx.lineTo(120, -50); ctx.lineTo(125, -110); ctx.lineTo(60, -125); ctx.lineTo(-20, -118); ctx.closePath(); ctx.fill();
    // 총열 (앞으로 뻗음)
    ctx.fillStyle = '#242938'; ctx.beginPath(); ctx.moveTo(60, -125); ctx.lineTo(75, -215); ctx.lineTo(95, -215); ctx.lineTo(105, -118); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#12151E'; ctx.fillRect(78, -230, 14, 20);
    // 탄창 · 손잡이
    ctx.fillStyle = '#2B3140'; ctx.beginPath(); ctx.moveTo(30, -60); ctx.lineTo(70, -60); ctx.lineTo(64, 10); ctx.lineTo(24, 10); ctx.closePath(); ctx.fill();
    // 조준경 · 팀 색 발광선
    ctx.fillStyle = '#1A1D24'; ctx.fillRect(20, -140, 40, 16);
    ctx.fillStyle = teamC; ctx.fillRect(-10, -100, 130, 4); ctx.fillRect(90, -215, 6, 95);
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(-10, -116, 130, 3);
    // 탄약 표시등 (총몸에)
    ctx.fillStyle = this.ammo > 6 ? '#06D6A0' : '#FF5C7A'; ctx.fillRect(0, -92, 20 * (this.ammo / FPS_MAG), 3);
    ctx.restore();
    // 총구 섬광
    if (this.muzzle > 0) {
      const mx = gx + 86 * s, my = gy - 232 * s;
      const g = ctx.createRadialGradient(mx, my, 0, mx, my, 40 * s * (0.6 + this.muzzle));
      g.addColorStop(0, 'rgba(255,255,255,' + this.muzzle.toFixed(2) + ')'); g.addColorStop(0.3, 'rgba(120,230,255,' + (this.muzzle * 0.8).toFixed(2) + ')'); g.addColorStop(1, 'rgba(120,230,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx, my, 40 * s * (0.6 + this.muzzle), 0, Math.PI * 2); ctx.fill();
    }
  }

  drawHud(ctx, W, H, hy, now, teamC) {
    const rr = (x, y, w, h, r, fill) => { ctx.fillStyle = fill; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); ctx.fill(); };
    // 조준점 — 움직이거나 쏘면 벌어짐 · 히트마커
    const gap = 6 + this.recoil * 10 + (this.moving ? 5 : 0);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
    [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([ax, ay]) => { ctx.beginPath(); ctx.moveTo(W / 2 + ax * gap, hy + ay * gap); ctx.lineTo(W / 2 + ax * (gap + 8), hy + ay * (gap + 8)); ctx.stroke(); });
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(W / 2 - 1, hy - 1, 2, 2);
    if (this.hitMarker > 0) { ctx.strokeStyle = 'rgba(255,80,80,' + this.hitMarker.toFixed(2) + ')'; ctx.lineWidth = 3;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([ax, ay]) => { ctx.beginPath(); ctx.moveTo(W / 2 + ax * 6, hy + ay * 6); ctx.lineTo(W / 2 + ax * 16, hy + ay * 16); ctx.stroke(); }); }
    // 피격 방향 표시 (빨간 호)
    if (this.dmgDir && now < this.dmgDir.until) {
      const k = (this.dmgDir.until - now) / 900;
      ctx.save(); ctx.translate(W / 2, hy); ctx.rotate(this.dmgDir.a);
      ctx.strokeStyle = 'rgba(255,60,80,' + (k * 0.9).toFixed(2) + ')'; ctx.lineWidth = 8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, Math.min(W, H) * 0.22, -0.35, 0.35); ctx.stroke(); ctx.restore();
    }
    // 피격 비네트 · 저체력 맥박
    if (this.hurt > 0 || this.hp <= 30) {
      const a = Math.max(this.hurt * 0.6, this.hp <= 30 && !this.isDead ? 0.25 + Math.sin(now / 180) * 0.12 : 0);
      const g = ctx.createRadialGradient(W / 2, hy, H * 0.25, W / 2, hy, H * 0.85); g.addColorStop(0, 'rgba(255,40,70,0)'); g.addColorStop(1, 'rgba(255,40,70,' + a.toFixed(2) + ')');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // 왼쪽 아래: 체력
    rr(14, H - 66, 168, 52, 14, 'rgba(8,10,16,0.72)');
    ctx.fillStyle = this.hp > 40 ? '#06D6A0' : '#FF5C7A'; ctx.font = '800 26px Pretendard, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('+', 28, H - 30); ctx.fillText(String(this.hp), 50, H - 30);
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(28, H - 24, 140, 5);
    ctx.fillStyle = this.hp > 40 ? '#06D6A0' : '#FF5C7A'; ctx.fillRect(28, H - 24, 140 * this.hp / 100, 5);
    // 오른쪽 아래: 탄약
    rr(W - 152, H - 66, 138, 52, 14, 'rgba(8,10,16,0.72)');
    ctx.textAlign = 'right';
    if (this.reloading) { ctx.fillStyle = '#FFD166'; ctx.font = '800 15px Pretendard, sans-serif'; ctx.fillText('재장전 중…', W - 28, H - 36);
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(W - 138, H - 26, 110, 5); ctx.fillStyle = '#FFD166'; ctx.fillRect(W - 138, H - 26, 110 * (1 - (this.reloadUntil - now) / 1400), 5); }
    else { ctx.fillStyle = this.ammo > 6 ? '#FFFFFF' : '#FF5C7A'; ctx.font = '800 28px Pretendard, sans-serif'; ctx.fillText(String(this.ammo), W - 62, H - 30);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '700 13px Pretendard, sans-serif'; ctx.fillText('/ ' + FPS_MAG, W - 26, H - 30); }
    ctx.textAlign = 'left';
    // 위쪽 가운데: 점수판 (팀전은 팀 점수, 개인전은 내 K/D)
    if (this.teamMode) {
      let red = 0, blue = 0; const add = (t, k) => { if (t === 'red') red += k; else if (t === 'blue') blue += k; };
      add(this.team, this.kills); Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (this.spectator && id === this.followId) return; add(p.team, p.kills || 0); });
      rr(W / 2 - 84, 10, 168, 40, 14, 'rgba(8,10,16,0.72)');
      ctx.textAlign = 'center'; ctx.font = '800 22px Pretendard, sans-serif';
      ctx.fillStyle = FPS_TEAM_COLORS.red; ctx.fillText(String(red), W / 2 - 40, 39);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '700 14px Pretendard, sans-serif'; ctx.fillText('RED   BLUE', W / 2, 38);
      ctx.fillStyle = FPS_TEAM_COLORS.blue; ctx.font = '800 22px Pretendard, sans-serif'; ctx.fillText(String(blue), W / 2 + 40, 39);
      ctx.textAlign = 'left';
      ctx.fillStyle = teamC; ctx.font = '800 12px Pretendard, sans-serif'; ctx.fillText(this.team === 'red' ? '🔴 RED' : '🔵 BLUE', 14, 24);
    } else {
      rr(W / 2 - 64, 10, 128, 36, 14, 'rgba(8,10,16,0.72)');
      ctx.textAlign = 'center'; ctx.font = '800 16px Pretendard, sans-serif'; ctx.fillStyle = '#FFD166';
      ctx.fillText('K ' + this.kills + '   D ' + this.deaths, W / 2, 34); ctx.textAlign = 'left';
    }
    // 오른쪽 위: 킬 피드
    this.feed = this.feed.filter(x => x.until > now);
    ctx.font = '700 12px Pretendard, sans-serif'; ctx.textAlign = 'right';
    this.feed.forEach((x, i) => { const y = 66 + i * 20, t = x.a + '  ⚡  ' + x.b; const tw = ctx.measureText(t).width + 16;
      rr(W - 14 - tw, y - 14, tw, 19, 8, 'rgba(8,10,16,0.6)'); ctx.fillStyle = x.color; ctx.fillText(t, W - 22, y); });
    ctx.textAlign = 'left';
    // 왼쪽 위: 미니맵
    this.drawMinimap(ctx, W, H);
    // 가운데 문구 · 사망
    if (this.toast && now < this.toast.until) { ctx.textAlign = 'center'; ctx.font = '800 18px Pretendard, sans-serif'; ctx.fillStyle = this.toast.color; ctx.fillText(this.toast.text, W / 2, hy + 80); ctx.textAlign = 'left'; }
    if (this.isDead) {
      ctx.fillStyle = 'rgba(8,10,16,0.6)'; ctx.fillRect(0, 0, W, H);
      const left = (this.deadUntil - now) / 3000;
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(W / 2, hy, 48, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#FF5C7A'; ctx.beginPath(); ctx.arc(W / 2, hy, 48, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - left)); ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '800 30px Pretendard, sans-serif'; ctx.fillText(String(Math.ceil(left * 3)), W / 2, hy + 11);
      ctx.fillStyle = '#FF5C7A'; ctx.font = '800 20px Pretendard, sans-serif'; ctx.fillText((this.killer || '누군가') + ' 에게 당했다', W / 2, hy - 74);
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '600 13px Pretendard, sans-serif'; ctx.fillText('잠시 후 다시 등장합니다', W / 2, hy + 78); ctx.textAlign = 'left';
    }
    if (this.spectator) { ctx.textAlign = 'center'; ctx.font = '700 13px Pretendard, sans-serif'; ctx.fillStyle = '#FFD166'; ctx.fillText('👁 ' + this.myName + ' 의 화면', W / 2, this.teamMode ? 66 : 64); ctx.textAlign = 'left'; }
  }

  drawMinimap(ctx, W, H) {
    const n = this.map.length, size = Math.min(104, W * 0.28), cs = size / n, x0 = 14, y0 = this.teamMode ? 34 : 14;
    if (!this._mm || this._mmSize !== size) {
      this._mm = document.createElement('canvas'); this._mm.width = Math.ceil(size + 8); this._mm.height = Math.ceil(size + 8); this._mmSize = size;
      const g = this._mm.getContext('2d');
      g.fillStyle = 'rgba(8,10,16,0.72)'; g.beginPath(); if (g.roundRect) g.roundRect(0, 0, size + 8, size + 8, 10); else g.rect(0, 0, size + 8, size + 8); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.28)';
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (this.map[y][x] !== '.') g.fillRect(4 + x * cs, 4 + y * cs, cs, cs);
    }
    ctx.drawImage(this._mm, x0 - 4, y0 - 4);
    Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (this.spectator && id === this.followId) return;
      if (this.teamMode && p.team !== this.team && !this.spectator) return;
      ctx.fillStyle = p.dead ? '#6B7280' : (p.team ? FPS_TEAM_COLORS[p.team] : '#FFD166'); ctx.beginPath(); ctx.arc(x0 + p.x * cs, y0 + p.y * cs, 2.4, 0, Math.PI * 2); ctx.fill(); });
    // 나: 시야 부채꼴
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.moveTo(x0 + this.x * cs, y0 + this.y * cs);
    ctx.arc(x0 + this.x * cs, y0 + this.y * cs, cs * 5, this.angle - Math.PI / 6, this.angle + Math.PI / 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x0 + this.x * cs, y0 + this.y * cs, 3, 0, Math.PI * 2); ctx.fill();
  }
}
