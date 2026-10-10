// 지하철 달리기 — 철길 3줄을 달리며 열차는 옆 줄로 피하고, 낮은 차단봉은 ↑ 점프, 높은 차단봉은 ↓ 미끄러지기.
//   동전을 모으고 🧲 자석 · 🛡 방패를 먹어요. 갈수록 빨라지고, 부딪히면 끝 (방패가 있으면 한 번 버팀)
//   (모바일 다운로드 상위 '무한 달리기' 장르를 학교용으로 새로 만든 것 — 이름·그림은 모두 새로 그림)

const RN_COLS = 9, RN_ROWS = 16, RN_FAR = 70, RN_D = 7;
// 줄마다 나올 수 있는 것: 열차(옆 줄로) · 낮은 차단봉(점프) · 높은 차단봉(미끄러지기) — 세 줄을 한꺼번에 막지 않음
const RN_PATTERNS = [
  ['train', null, null], [null, 'train', null], [null, null, 'train'], ['train', 'train', null], [null, 'train', 'train'], ['train', null, 'train'],
  ['low', null, 'train'], ['train', 'low', null], [null, 'high', 'train'], ['high', 'train', null], ['low', 'low', 'low'], ['high', 'high', 'high'],
  ['low', 'train', 'high'], [null, 'low', null], ['high', null, null], [null, null, 'low']
];

class RunnerGame {
  constructor(canvas, cellSize) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.cellSize = cellSize;
    this.lane = 0; this.lx = 0; this.py = 0; this.vy = 0; this.slide = 0; this.speed = 16; this.dist = 0; this.coins = 0; this.score = 0;
    this.objs = []; this.nextRow = 52; this.gameOver = false;   // 첫 장애물 줄은 약 3.2초 뒤 (예전 26m: 1.6초 — READY·GO 가 끝나자마자 부딪혔음)
    this._sdOn = false; this.magnet = 0; this.shield = 0; this.hitFlash = 0; this.lastTime = 0; this.now = 0; this.pops = []; this.run = 0;
  }
  get best() { return Math.floor(this.dist); }
  // ── 조작 ──
  move(d) { if (this.gameOver) return; const n = Math.max(-1, Math.min(1, this.lane + d)); if (n !== this.lane) { this.lane = n; if (window.Sound) Sound.move(); } else if (window.Sound) Sound.bump(); }
  up() { if (this.gameOver) return; if (this.py <= 0.01) { this.vy = 9.5; this.slide = 0; if (window.Sound) Sound.jump(); } }
  down() { if (this.gameOver) return; if (this.py > 0.05) this.vy = Math.min(this.vy, -14); this.slide = 0.75; this._sdOn = !!this.softDropping; if (window.Sound && Sound.roll) Sound.roll(); }   // 공중이면 빠르게 내려와 미끄러짐
  rotate() { this.up(); } hardDrop() { this.up(); } softDrop() { this.down(); }
  spawnRow(z) {
    // 이미 지나가는 긴 열차와 합쳐 세 줄이 모두 막히지 않는 모양만 (항상 빠져나갈 줄이 하나는 있게)
    const busy = [-1, 0, 1].filter(L => this.objs.some(o => o.k === 'train' && o.lane === L && o.z <= z + 3 && o.z + o.len >= z - 8));
    // 끝 줄 → 반대 끝 줄로 피해야 하면 가운데 줄이 그 직전에 비어 있어야 함 (긴 열차가 아직 옆을 지나가면 갇힘)
    const midBusy = this.objs.some(o => o.k === 'train' && o.lane === 0 && o.z <= z && o.z + o.len >= z - this.speed * 0.7);
    const ok = c => { const free = [-1, 0, 1].filter(L => c[L + 1] !== 'train' && busy.indexOf(L) < 0); if (!free.length) return false;
      return [-1, 0, 1].every(L => free.indexOf(L) >= 0 || free.some(F => Math.abs(F - L) === 1) || !midBusy); };
    let pat = null; for (let t = 0; t < 40 && !pat; t++) { const c = RN_PATTERNS[Math.floor(Math.random() * RN_PATTERNS.length)]; if (ok(c)) pat = c; }
    if (!pat) pat = [null, null, null];
    busy.forEach(L => { if (pat[L + 1] && pat[L + 1] !== 'train') pat = pat.map((v, i) => i === L + 1 ? null : v); });
    pat.forEach((k, i) => { if (!k) return; const len = k === 'train' ? 9 + Math.floor(Math.random() * 8) : 0.6; this.objs.push({ k, lane: i - 1, z, len, moving: k === 'train' && Math.random() < 0.3 }); });   // moving: 빨간 열차 (색만 다름)
    // 빈 줄에는 동전 줄 · 가끔 아이템
    const free = pat.map((k, i) => k || busy.indexOf(i - 1) >= 0 ? null : i - 1).filter(v => v != null), lowL = pat.indexOf('low') - 1, L = free.length ? free[Math.floor(Math.random() * free.length)] : lowL >= -1 ? lowL : 0;
    if (Math.random() < 0.75) for (let i = 0; i < 6; i++) this.objs.push({ k: 'coin', lane: L, z: z + 2 + i * 1.6, len: 0.3, high: pat[L + 1] === 'low' && i >= 2 && i <= 3 });
    else if (Math.random() < 0.5) this.objs.push({ k: Math.random() < 0.5 ? 'magnet' : 'shield', lane: L, z: z + 4, len: 0.4 });
  }
  tick(now) {
    const { dt, f } = FX.frame(this, now), k = dt / 1000; this.run += k;
    this.pops = this.pops.filter(p => (p.t -= 0.02 * f) > 0); this.hitFlash = Math.max(0, this.hitFlash - 0.04 * f);
    if (!this.gameOver) {
      // 키보드 ↓ 는 softDropping 만 켬 → 누른 순간 공중이어도 바로 내려와 미끄러지게 (예전: 땅에 닿을 때까지 아무 일 없음) · 누르고 있으면 계속 미끄러짐
      if (this.softDropping && !this._sdOn) this.down(); else if (this.softDropping && this.slide <= 0 && this.py <= 0.01) this.down();
      if (!this.softDropping) this._sdOn = false;
      this.speed = Math.min(42, 16 + this.dist / 90); const dz = this.speed * k; this.dist += dz; this.score = Math.floor(this.dist) + this.coins * 10;
      this.lx += (this.lane - this.lx) * Math.min(1, k * 14);
      this.vy -= 26 * k; this.py = Math.max(0, this.py + this.vy * k); if (this.py <= 0 && this.vy < 0) { if (this.vy < -6 && window.Sound && Sound.land) Sound.land(0.2); this.vy = 0; }
      this.slide = Math.max(0, this.slide - k); this.magnet = Math.max(0, this.magnet - k);
      this.objs.forEach(o => { o.z -= dz; });   // (예전: 빨간 열차가 더 빨리 다가와 뒤 줄 열차와 겹쳐 세 줄이 모두 막히는 때가 있었음)
      this.nextRow -= dz; while (this.nextRow < RN_FAR) { this.spawnRow(this.nextRow + 0); this.nextRow += this.speed * 0.62 + 4 + Math.random() * 6; }   // 빨라질수록 줄 사이도 넓게 — 피할 시간(약 0.6초)은 늘 남게
      // 부딪힘 (z = 0 이 내 자리 · 줄은 지금 가까운 줄)
      const myLane = Math.round(this.lx), atLane = o => Math.abs(o.lane - this.lx) < 0.45;
      for (const o of this.objs) {
        if (o.dead || o.z > 0.6 || o.z + o.len < -0.6) continue;
        if (o.k === 'coin' || o.k === 'magnet' || o.k === 'shield') { const pull = o.k === 'coin' && this.magnet > 0; if ((pull || atLane(o)) && (o.k !== 'coin' || !o.high || this.py > 0.6 || pull)) { o.dead = true;
            if (o.k === 'coin') { this.coins++; if (window.Sound && Sound.gem) Sound.gem(); } else { this[o.k] = o.k === 'magnet' ? 8 : 1; this.pops.push({ t: 1, txt: o.k === 'magnet' ? '🧲 자석 8초!' : '🛡 방패!' }); if (window.Sound && Sound.item) Sound.item(); } } continue; }
        if (!atLane(o)) continue;
        const hit = o.k === 'train' ? true : o.k === 'low' ? this.py < 0.55 : this.slide <= 0;
        if (hit) { o.dead = true; this.hitFlash = 1;
          if (this.shield) { this.shield = 0; this.pops.push({ t: 1, txt: '🛡 방패가 막았어요!' }); if (window.Sound) Sound.bump();
            // 열차에 막히면 옆 줄로 튕겨 나가되, 지금 비어 있는 줄로만 (예전: 아무 줄로나 밀려 옆 열차·차단봉에 바로 다시 부딪힘 — 방패를 먹고도 29% 가 0.35초 안에 끝)
            if (o.k === 'train') { const clear = L => !this.objs.some(q => !q.dead && q.lane === L && (q.k === 'train' ? q.z <= 2 && q.z + q.len >= -1 : (q.k === 'low' || q.k === 'high') && q.z > -0.8 && q.z < 1.5));
              const to = (myLane === 0 ? [-1, 1] : [0]).filter(clear); if (to.length) this.lane = to[Math.floor(Math.random() * to.length)]; } }
          else { this.gameOver = true; this.crashed = o.k; if (window.Sound) Sound.crash(); if (window.Sound) setTimeout(() => Sound.gameOver(), 350); } break; }
      }
      this.objs = this.objs.filter(o => !o.dead && o.z + o.len > -3);
    }
    this.draw();
  }
  getSnapshot() {
    const g = Array.from({ length: RN_ROWS }, () => Array(RN_COLS).fill(0)), col = l => 1 + (l + 1) * 3;
    this.objs.forEach(o => { for (let z = Math.max(0, o.z); z < Math.min(60, o.z + o.len + 0.01); z += 4) { const r = RN_ROWS - 3 - Math.floor(z / 4); if (r < 0) continue; const v = o.k === 'train' ? 11 : o.k === 'coin' ? 4 : o.k === 'low' || o.k === 'high' ? 21 : 6; g[r][col(o.lane)] = v; g[r][col(o.lane) + 1] = v; } });   // 차단봉은 밝은 회색 21 (예전 12 는 바탕과 거의 같은 색이라 교사 미니 보드에서 안 보였음)
    const c = col(Math.round(this.lx)); g[RN_ROWS - 2][c] = g[RN_ROWS - 2][c + 1] = 10; return g;
  }
  // ── 그리기: 소실점 원근 (멀수록 작고 위로) ──
  P(x, z) { const W = this.cellSize * RN_COLS, H = this.cellSize * RN_ROWS, hy = H * 0.3, s = RN_D / (RN_D + Math.max(-RN_D + 0.5, z)); return { x: W / 2 + x * W * 0.3 * s, y: hy + (H * 0.93 - hy) * s, s }; }
  // 땅 위 높이 h(줄 폭 단위)인 점의 화면 자리
  Q(x, z, h) { const p = this.P(x, z), u = this.cellSize * RN_COLS * 0.3 * p.s; return [p.x, p.y - h * u]; }
  // 멀수록 안개 색으로 (가까운 장애물이 또렷하게 튀어나와 보이게)
  fog(hex, z) { const t = Math.max(0, Math.min(0.75, (z - 18) / 60)); if (!t) return hex; const a = parseInt(hex.slice(1), 16), b = 0xBFD3E6;
    const m = (s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return 'rgb(' + m(16) + ',' + m(8) + ',' + m(0) + ')'; }
  poly(pts, fill, stroke, lw) { const c = this.ctx; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 1; c.lineJoin = 'round'; c.stroke(); } }
  // 입체 상자: 앞면 · 카메라 쪽 옆면 · 지붕 (x0~x1 줄 폭 단위 · z0~z1 · 높이 h)
  box(x0, x1, z0, z1, h, C, lw, noFront, y0) {   // y0: 바닥 높이 (공중에 걸린 판)
    y0 = y0 || 0; const f = [this.Q(x0, z0, y0), this.Q(x1, z0, y0), this.Q(x1, z0, h), this.Q(x0, z0, h)], b = [this.Q(x0, z1, y0), this.Q(x1, z1, y0), this.Q(x1, z1, h), this.Q(x0, z1, h)], ol = 'rgba(10,14,24,.55)';
    if (x1 < 0) this.poly([f[1], b[1], b[2], f[2]], C.side, ol, lw); else if (x0 > 0) this.poly([f[0], b[0], b[3], f[3]], C.side, ol, lw);   // 가운데 줄에서 보이는 옆면
    this.poly([f[3], f[2], b[2], b[3]], C.top, ol, lw);
    if (!noFront) this.poly(f, C.front, ol, lw); return f;
  }
  draw() {
    const ctx = this.ctx, cs = this.cellSize, W = cs * RN_COLS, H = cs * RN_ROWS, hy = H * 0.3, U = W * 0.3;
    // 하늘 · 해 · 먼 산 · 도시
    const sky = ctx.createLinearGradient(0, 0, 0, hy); sky.addColorStop(0, '#2E6FD6'); sky.addColorStop(0.65, '#8EC5F2'); sky.addColorStop(1, '#E3F0FA'); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hy + 1);
    const sun = ctx.createRadialGradient(W * 0.78, hy * 0.35, 2, W * 0.78, hy * 0.35, W * 0.35); sun.addColorStop(0, 'rgba(255,248,220,.95)'); sun.addColorStop(0.15, 'rgba(255,236,170,.55)'); sun.addColorStop(1, 'rgba(255,236,170,0)'); ctx.fillStyle = sun; ctx.fillRect(0, 0, W, hy);
    ctx.fillStyle = '#9DB7D2'; ctx.beginPath(); ctx.moveTo(0, hy); for (let x = 0; x <= W + 10; x += 10) ctx.lineTo(x, hy - hy * (0.18 + 0.1 * Math.sin((x + this.dist * 0.15) * 0.03) + 0.05 * Math.sin((x + this.dist * 0.15) * 0.11))); ctx.lineTo(W, hy); ctx.fill();
    for (let i = 0; i < 11; i++) { const bw = W / 8, span = W + bw * 2, bx = ((i * bw * 1.25 - this.dist * 0.5) % span + span) % span - bw, bh = hy * (0.22 + ((i * 37) % 5) * 0.07);
      ctx.fillStyle = i % 2 ? '#6F8DB0' : '#7E9BBC'; ctx.fillRect(bx, hy - bh, bw * 0.82, bh); ctx.fillStyle = 'rgba(255,240,180,.55)';
      for (let wy = hy - bh + 4; wy < hy - 4; wy += 7) for (let wx = bx + 3; wx < bx + bw * 0.82 - 4; wx += 6) if ((wx * 7 + wy * 3 + i) % 5 < 2) ctx.fillRect(wx, wy, 2.5, 3); }
    // 땅 (양옆은 승강장 · 풀밭)
    const gr = ctx.createLinearGradient(0, hy, 0, H); gr.addColorStop(0, '#A9B79B'); gr.addColorStop(1, '#4F6B3E'); ctx.fillStyle = gr; ctx.fillRect(0, hy, W, H - hy);
    [-1, 1].forEach(sd => { this.poly([this.Q(sd * 1.75, RN_FAR, 0), this.Q(sd * 2.35, RN_FAR, 0), this.Q(sd * 2.35, -RN_D + 1, 0), this.Q(sd * 1.75, -RN_D + 1, 0)], '#B9B4A6');   // 승강장 바닥
      this.poly([this.Q(sd * 1.75, RN_FAR, 0), this.Q(sd * 1.82, RN_FAR, 0), this.Q(sd * 1.82, -RN_D + 1, 0), this.Q(sd * 1.75, -RN_D + 1, 0)], '#F2C94C'); });   // 노란 안전선
    // 자갈 바닥 · 줄마다 은은한 띠
    this.poly([this.Q(-1.75, RN_FAR, 0), this.Q(1.75, RN_FAR, 0), this.Q(1.75, -RN_D + 1, 0), this.Q(-1.75, -RN_D + 1, 0)], '#7A746A');
    [-1, 0, 1].forEach(L => this.poly([this.Q(L - 0.5, RN_FAR, 0), this.Q(L + 0.5, RN_FAR, 0), this.Q(L + 0.5, -RN_D + 1, 0), this.Q(L - 0.5, -RN_D + 1, 0)], L === this.lane && !this.gameOver ? 'rgba(255,255,255,.07)' : (L % 2 ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.03)')));
    // 침목 (가까울수록 진하게)
    for (let z = -(this.dist % 2.2) - 4; z < RN_FAR; z += 2.2) [-1, 0, 1].forEach(L => { const a = this.Q(L - 0.42, z, 0), b = this.Q(L + 0.42, z, 0), c = this.Q(L + 0.42, z + 0.45, 0), d = this.Q(L - 0.42, z + 0.45, 0); this.poly([a, b, c, d], this.fog('#5B4330', z)); });
    // 레일: 어두운 받침 + 밝은 윗면
    [-1, 0, 1].forEach(L => [-0.3, 0.3].forEach(o => { const p0 = this.Q(L + o, RN_FAR, 0), p1 = this.Q(L + o, -RN_D + 1, 0);
      ctx.lineCap = 'round'; ctx.strokeStyle = '#4A4F59'; ctx.lineWidth = Math.max(1.5, cs * 0.12); ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
      ctx.strokeStyle = '#E4E9F0'; ctx.lineWidth = Math.max(1, cs * 0.05); ctx.beginPath(); ctx.moveTo(p0[0], p0[1] - 1); ctx.lineTo(p1[0], p1[1] - 1); ctx.stroke(); }));
    // 양옆 구조물: 전차선 기둥 · 가로 빔 (지나가며 속도감)
    const poles = []; for (let z = -(this.dist % 9) - 4; z < RN_FAR; z += 9) poles.push(z);
    poles.slice().reverse().forEach(z => { [-1, 1].forEach(sd => { const b = this.Q(sd * 2.05, z, 0), t = this.Q(sd * 2.05, z, 1.9), p = this.P(sd * 2.05, z); ctx.strokeStyle = this.fog('#4B5563', z); ctx.lineWidth = Math.max(1.5, U * p.s * 0.06); ctx.beginPath(); ctx.moveTo(b[0], b[1]); ctx.lineTo(t[0], t[1]); ctx.stroke(); });
      if (z < 5) return; const l = this.Q(-2.05, z, 1.85), r = this.Q(2.05, z, 1.85), p = this.P(0, z); ctx.strokeStyle = this.fog('#5E6876', z); ctx.lineWidth = Math.max(1, U * p.s * 0.035); ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(r[0], r[1]); ctx.stroke(); });
    // 물건 (먼 것부터)
    const near = o => Math.abs(o.lane - this.lx) < 0.5 && o.z > 0 && o.z < 24 && !this.gameOver, pulse = 0.5 + 0.5 * Math.sin(this.run * 12);
    const list = this.objs.slice().sort((p, q) => q.z - p.z);
    list.forEach(o => { if (o.z > RN_FAR || o.z + o.len < -RN_D + 1) return; const z0 = Math.max(-RN_D + 1.2, o.z), L = o.lane, p = this.P(L, z0), u = U * p.s, lw = Math.max(1, u * 0.025), fg = c => this.fog(c, z0);
      // 땅 그림자
      if (o.k !== 'coin') this.poly([this.Q(L - 0.5, z0 - 0.3, 0), this.Q(L + 0.5, z0 - 0.3, 0), this.Q(L + 0.5, Math.min(RN_FAR, z0 + (o.k === 'train' ? o.len : 0.6)), 0), this.Q(L - 0.5, Math.min(RN_FAR, z0 + (o.k === 'train' ? o.len : 0.6)), 0)], 'rgba(0,0,0,.28)');
      if (o.k === 'train') { const body = o.moving ? '#E0484F' : '#2F7DDB', z1 = Math.min(RN_FAR, o.z + o.len), h = 1.3, passing = o.z < -0.5;   // passing: 앞머리가 이미 내 옆을 지남 → 옆면·지붕만
        const f = this.box(L - 0.43, L + 0.43, z0, z1, h, { front: fg(body), side: fg(FX.tint(body, -0.25)), top: fg(FX.tint(body, 0.15)) }, lw, passing);
        // 옆면 창문 줄 · 노란 띠 (카메라 쪽 옆면에)
        const sx = L < 0 ? L + 0.43 : L > 0 ? L - 0.43 : null;
        if (sx != null) { for (let z = z0 + 0.8; z < z1 - 0.6; z += 1.6) { const q = [this.Q(sx, z, 0.72), this.Q(sx, z + 1.0, 0.72), this.Q(sx, z + 1.0, 1.05), this.Q(sx, z, 1.05)]; this.poly(q, this.fog('#BFE4FF', z)); }
          this.poly([this.Q(sx, z0, 0.42), this.Q(sx, z1, 0.42), this.Q(sx, z1, 0.52), this.Q(sx, z0, 0.52)], fg('#FFD23F')); }
        if (passing) return;
        // 앞면: 앞유리 · 헤드라이트 · 경고 줄무늬 범퍼
        const fx = (a, hh) => [f[0][0] + (f[1][0] - f[0][0]) * a, f[0][1] - (f[0][1] - f[3][1]) * hh], fw = f[1][0] - f[0][0], fh = f[0][1] - f[3][1];
        this.poly([fx(0.12, 0.62), fx(0.88, 0.62), fx(0.84, 0.9), fx(0.16, 0.9)], fg('#1D2B3F'), 'rgba(255,255,255,.35)', lw);
        ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); const g1 = fx(0.2, 0.86), g2 = fx(0.42, 0.86), g3 = fx(0.3, 0.66), g4 = fx(0.18, 0.66); ctx.moveTo(g1[0], g1[1]); ctx.lineTo(g2[0], g2[1]); ctx.lineTo(g3[0], g3[1]); ctx.lineTo(g4[0], g4[1]); ctx.fill();
        [0.2, 0.8].forEach(a => { const c = fx(a, 0.3), r = fw * 0.08, gl = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], r * 3); gl.addColorStop(0, 'rgba(255,250,210,.95)'); gl.addColorStop(0.35, 'rgba(255,236,150,.45)'); gl.addColorStop(1, 'rgba(255,236,150,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(c[0], c[1], r * 3, 0, 7); ctx.fill(); ctx.fillStyle = '#FFF8D6'; ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, 7); ctx.fill(); });
        const by = f[0][1] - fh * 0.13; ctx.save(); ctx.beginPath(); ctx.rect(f[0][0], by, fw, fh * 0.13); ctx.clip(); ctx.fillStyle = fg('#FFD23F'); ctx.fillRect(f[0][0], by, fw, fh * 0.13); ctx.fillStyle = fg('#1B1B1B'); for (let i = -2; i < 12; i++) { ctx.beginPath(); const x = f[0][0] + i * fw / 8; ctx.moveTo(x, by + fh * 0.13); ctx.lineTo(x + fw / 16, by + fh * 0.13); ctx.lineTo(x + fw / 16 + fh * 0.13, by); ctx.lineTo(x + fh * 0.13, by); ctx.fill(); } ctx.restore();
        if (near(o)) { ctx.strokeStyle = 'rgba(255,234,0,' + (0.55 + 0.45 * pulse).toFixed(2) + ')'; ctx.lineWidth = Math.max(2, u * 0.06); ctx.strokeRect(f[0][0], f[3][1], fw, fh); }
        return; }
      if (o.k === 'low' || o.k === 'high') { const low = o.k === 'low', top = low ? 0.5 : 1.25, b0 = low ? 0.22 : 0.86, main = low ? '#FFC21A' : '#E8323C', zb = z0 + 0.25;
        // 다리 (입체 기둥)
        [L - 0.46, L + 0.38].forEach(x => this.box(x, x + 0.08, z0, zb, top, { front: fg('#59606E'), side: fg('#3F4550'), top: fg('#7B8494') }, lw));
        // 판 (줄무늬)
        const f = this.box(L - 0.48, L + 0.48, z0 - 0.02, zb, top, { front: fg(main), side: fg(FX.tint(main, -0.3)), top: fg(FX.tint(main, 0.3)) }, lw, false, b0);   // 판은 b0~top 에만 (높은 차단봉 밑은 비어 있음)
        const bf = [this.Q(L - 0.48, z0 - 0.03, b0), this.Q(L + 0.48, z0 - 0.03, b0), this.Q(L + 0.48, z0 - 0.03, top), this.Q(L - 0.48, z0 - 0.03, top)];
        ctx.save(); this.poly(bf, null); ctx.clip(); ctx.fillStyle = fg(low ? '#1B1B1B' : '#FFFFFF'); const bw = bf[1][0] - bf[0][0], bh = bf[0][1] - bf[3][1];
        for (let i = -2; i < 10; i++) { ctx.beginPath(); const x = bf[0][0] + i * bw / 6; ctx.moveTo(x, bf[0][1]); ctx.lineTo(x + bw / 12, bf[0][1]); ctx.lineTo(x + bw / 12 + bh, bf[3][1]); ctx.lineTo(x + bh, bf[3][1]); ctx.fill(); } ctx.restore();
        // 높은 차단봉: 판 밑에 그림자 띠 — 그 밑으로 미끄러져 지나가요
        // 어떻게 지나가는지 표지: ⬆ 점프 · ⬇ 미끄러지기
        if (z0 < 45) { const c = this.Q(L, z0, top + 0.28), r = Math.max(5, u * 0.15); ctx.fillStyle = low ? 'rgba(255,194,26,.95)' : 'rgba(232,50,60,.95)'; ctx.beginPath(); ctx.arc(c[0], c[1], r, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.2, r * 0.18); ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.beginPath(); const d = low ? -1 : 1; ctx.moveTo(c[0], c[1] + d * r * 0.6); ctx.lineTo(c[0] - r * 0.5, c[1] - d * r * 0.05); ctx.lineTo(c[0] - r * 0.18, c[1] - d * r * 0.05); ctx.lineTo(c[0] - r * 0.18, c[1] - d * r * 0.55); ctx.lineTo(c[0] + r * 0.18, c[1] - d * r * 0.55); ctx.lineTo(c[0] + r * 0.18, c[1] - d * r * 0.05); ctx.lineTo(c[0] + r * 0.5, c[1] - d * r * 0.05); ctx.closePath(); ctx.fill(); }
        if (near(o)) { ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 + 0.5 * pulse).toFixed(2) + ')'; ctx.lineWidth = Math.max(2, u * 0.05); ctx.strokeRect(f[3][0], f[3][1], f[2][0] - f[3][0], f[0][1] - f[3][1]); }
        return; }
      const yy = p.y - u * (o.high ? 0.75 : 0.3) - Math.abs(Math.sin(this.run * 4 + o.z)) * u * 0.05;
      if (o.k === 'coin') { const R = u * 0.14, rx = R * Math.abs(Math.cos(this.run * 5 + o.z)) + 1, cg = ctx.createLinearGradient(p.x - rx, yy - R, p.x + rx, yy + R); cg.addColorStop(0, '#FFF2A8'); cg.addColorStop(0.5, '#FFC93C'); cg.addColorStop(1, '#C98A12');
        ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(p.x, p.y - u * 0.02, R * 0.8, R * 0.25, 0, 0, 7); ctx.fill();
        ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(p.x, yy, rx, R, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#9A6408'; ctx.lineWidth = Math.max(1, u * 0.02); ctx.stroke();
        if (rx > R * 0.5) { ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(p.x - rx * 0.3, yy - R * 0.35, rx * 0.25, R * 0.15, -0.6, 0, 7); ctx.fill(); } }
      else { const R = u * 0.2, gl = ctx.createRadialGradient(p.x, yy, R * 0.3, p.x, yy, R * 2); gl.addColorStop(0, o.k === 'magnet' ? 'rgba(255,90,120,.55)' : 'rgba(79,209,224,.55)'); gl.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(p.x, yy, R * 2, 0, 7); ctx.fill();
        ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(p.x, yy, R, 0, 7); ctx.fill(); ctx.strokeStyle = o.k === 'magnet' ? '#E8323C' : '#1D9BB8'; ctx.lineWidth = Math.max(1.5, R * 0.16); ctx.stroke();
        // 그림 아이콘 (이모지 글꼴이 없는 기기에서도 보이게): 🧲 U자 자석 · 🛡 방패
        ctx.save(); ctx.translate(p.x, yy); ctx.lineJoin = 'round';
        if (o.k === 'magnet') { ctx.lineCap = 'butt'; ctx.strokeStyle = '#E8323C'; ctx.lineWidth = R * 0.34; ctx.beginPath(); ctx.arc(0, R * 0.05, R * 0.42, 0, Math.PI); ctx.moveTo(-R * 0.42, R * 0.05); ctx.lineTo(-R * 0.42, -R * 0.35); ctx.moveTo(R * 0.42, R * 0.05); ctx.lineTo(R * 0.42, -R * 0.35); ctx.stroke();
          ctx.fillStyle = '#D9DEE6'; ctx.fillRect(-R * 0.59, -R * 0.62, R * 0.34, R * 0.28); ctx.fillRect(R * 0.25, -R * 0.62, R * 0.34, R * 0.28); }
        else { ctx.fillStyle = '#1D9BB8'; ctx.beginPath(); ctx.moveTo(0, -R * 0.62); ctx.lineTo(R * 0.5, -R * 0.4); ctx.quadraticCurveTo(R * 0.48, R * 0.3, 0, R * 0.62); ctx.quadraticCurveTo(-R * 0.48, R * 0.3, -R * 0.5, -R * 0.4); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = R * 0.1; ctx.beginPath(); ctx.moveTo(-R * 0.18, 0); ctx.lineTo(-R * 0.02, R * 0.18); ctx.lineTo(R * 0.24, -R * 0.16); ctx.stroke(); }
        ctx.restore(); } });
    // 속도선 (빠를수록)
    if (!this.gameOver && this.speed > 24) { ctx.strokeStyle = 'rgba(255,255,255,' + Math.min(0.35, (this.speed - 24) / 50).toFixed(2) + ')'; ctx.lineWidth = 1.5; for (let i = 0; i < 6; i++) { const a = ((i * 97 + Math.floor(this.run * 30) * 13) % 100) / 100, sd = i % 2 ? 1 : -1, x = W / 2 + sd * W * (0.38 + a * 0.12), y = H * (0.45 + a * 0.4); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + sd * W * 0.06, y + H * 0.06); ctx.stroke(); } }
    // 나 (뒷모습 · 점프 · 미끄러지기) — 테두리로 배경과 구별
    const me = this.P(this.lx, 0), u = U * me.s, jy = this.py * u * 0.55, sl = this.slide > 0, ol = '#16202E', olw = Math.max(1.5, u * 0.03);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(me.x, me.y - u * 0.02, u * 0.22 * (1 - this.py * 0.15), u * 0.07, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(me.x, me.y - jy); if (sl) ctx.scale(1.15, 0.5); ctx.lineWidth = olw; ctx.strokeStyle = ol; ctx.lineJoin = 'round';
    const leg = this.gameOver || this.py > 0.05 ? 0 : Math.sin(this.run * 18) * u * 0.07;
    ctx.fillStyle = '#23395B'; [[-u * 0.11, Math.max(0, leg)], [u * 0.02, Math.max(0, -leg)]].forEach(([x, d]) => { FX.rr(ctx, x, -u * 0.34 + d, u * 0.09, u * 0.3, u * 0.03); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#F5F7FA'; FX.rr(ctx, x - u * 0.01, -u * 0.06 + d, u * 0.11, u * 0.06, u * 0.02); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#23395B'; });
    ctx.fillStyle = '#FF7A1A'; FX.rr(ctx, -u * 0.17, -u * 0.68, u * 0.34, u * 0.4, u * 0.09); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2B9B5E'; FX.rr(ctx, -u * 0.12, -u * 0.64, u * 0.24, u * 0.26, u * 0.06); ctx.fill(); ctx.stroke();   // 책가방
    ctx.fillStyle = '#3A2A1E'; ctx.beginPath(); ctx.arc(0, -u * 0.79, u * 0.13, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1FBF6A'; ctx.beginPath(); ctx.arc(0, -u * 0.83, u * 0.135, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (this.shield) { ctx.strokeStyle = 'rgba(79,209,224,' + (0.6 + 0.3 * pulse).toFixed(2) + ')'; ctx.lineWidth = u * 0.045; ctx.beginPath(); ctx.arc(0, -u * 0.45, u * 0.46, 0, 7); ctx.stroke(); }
    ctx.restore();
    if (this.hitFlash) { ctx.fillStyle = 'rgba(255,60,60,' + (this.hitFlash * 0.35).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); }
    // 위 정보
    FX.text(ctx, Math.floor(this.dist) + 'm', cs * 0.4, cs * 0.75, { size: cs * 0.6, weight: 900, color: '#fff', stroke: 'rgba(0,0,0,.55)' });
    FX.text(ctx, '🪙 ' + this.coins, W - cs * 0.4, cs * 0.75, { size: cs * 0.5, weight: 900, color: '#FFE38A', align: 'right', stroke: 'rgba(0,0,0,.55)' });
    if (this.magnet > 0) FX.text(ctx, '🧲 ' + Math.ceil(this.magnet), W - cs * 0.4, cs * 1.5, { size: cs * 0.42, weight: 800, color: '#fff', align: 'right', stroke: 'rgba(0,0,0,.5)' });
    this.pops.forEach(p => { ctx.globalAlpha = Math.min(1, p.t * 1.5); FX.text(ctx, p.txt, W / 2, H * 0.22 - (1 - p.t) * cs, { size: cs * 0.55, weight: 900, color: '#FFE38A', align: 'center', stroke: 'rgba(0,0,0,.6)' }); ctx.globalAlpha = 1; });
    if (this.run < 3.5 && !this.gameOver) FX.text(ctx, '← → 줄 바꾸기 · ↑ 점프 · ↓ 미끄러지기', W / 2, H * 0.52, { size: cs * 0.36, weight: 800, color: '#fff', align: 'center', stroke: 'rgba(0,0,0,.6)' });
    if (this.gameOver) { ctx.fillStyle = 'rgba(10,14,28,.62)'; ctx.fillRect(0, 0, W, H);
      FX.text(ctx, this.crashed === 'train' ? '쾅! 열차에 부딪혔어요' : '차단봉에 걸렸어요', W / 2, H * 0.42, { size: cs * 0.6, weight: 900, color: '#fff', align: 'center' });
      FX.text(ctx, Math.floor(this.dist) + 'm · 동전 ' + this.coins + '개 · ' + this.score + '점', W / 2, H * 0.42 + cs * 0.85, { size: cs * 0.42, weight: 700, color: '#FFD166', align: 'center' }); }
  }
}
if (typeof window !== 'undefined') window.RunnerGame = RunnerGame;
