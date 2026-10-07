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
    this.objs = []; this.nextRow = 26; this.gameOver = false; this.magnet = 0; this.shield = 0; this.hitFlash = 0; this.lastTime = 0; this.now = 0; this.pops = []; this.run = 0;
  }
  get best() { return Math.floor(this.dist); }
  // ── 조작 ──
  move(d) { if (this.gameOver) return; const n = Math.max(-1, Math.min(1, this.lane + d)); if (n !== this.lane) { this.lane = n; if (window.Sound) Sound.move(); } else if (window.Sound) Sound.bump(); }
  up() { if (this.gameOver) return; if (this.py <= 0.01) { this.vy = 9.5; this.slide = 0; if (window.Sound) Sound.jump(); } }
  down() { if (this.gameOver) return; if (this.py > 0.05) this.vy = Math.min(this.vy, -14); this.slide = 0.75; if (window.Sound && Sound.roll) Sound.roll(); }   // 공중이면 빠르게 내려와 미끄러짐
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
      if (this.softDropping && this.slide <= 0 && this.py <= 0.01) this.down();
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
          if (this.shield) { this.shield = 0; this.pops.push({ t: 1, txt: '🛡 방패가 막았어요!' }); if (window.Sound) Sound.bump(); if (o.k === 'train') this.lane = myLane === 0 ? (Math.random() < 0.5 ? -1 : 1) : 0; }
          else { this.gameOver = true; this.crashed = o.k; if (window.Sound) Sound.crash(); if (window.Sound) setTimeout(() => Sound.gameOver(), 350); } break; }
      }
      this.objs = this.objs.filter(o => !o.dead && o.z + o.len > -3);
    }
    this.draw();
  }
  getSnapshot() {
    const g = Array.from({ length: RN_ROWS }, () => Array(RN_COLS).fill(0)), col = l => 1 + (l + 1) * 3;
    this.objs.forEach(o => { for (let z = Math.max(0, o.z); z < Math.min(60, o.z + o.len + 0.01); z += 4) { const r = RN_ROWS - 3 - Math.floor(z / 4); if (r < 0) continue; const v = o.k === 'train' ? 11 : o.k === 'coin' ? 4 : o.k === 'low' || o.k === 'high' ? 12 : 6; g[r][col(o.lane)] = v; g[r][col(o.lane) + 1] = v; } });
    const c = col(Math.round(this.lx)); g[RN_ROWS - 2][c] = g[RN_ROWS - 2][c + 1] = 10; return g;
  }
  // ── 그리기: 소실점 원근 (멀수록 작고 위로) ──
  P(x, z) { const W = this.cellSize * RN_COLS, H = this.cellSize * RN_ROWS, hy = H * 0.3, s = RN_D / (RN_D + Math.max(-RN_D + 0.5, z)); return { x: W / 2 + x * W * 0.3 * s, y: hy + (H * 0.93 - hy) * s, s }; }
  draw() {
    const ctx = this.ctx, cs = this.cellSize, W = cs * RN_COLS, H = cs * RN_ROWS, hy = H * 0.3, sk = Math.floor(this.dist);
    const sky = ctx.createLinearGradient(0, 0, 0, hy); sky.addColorStop(0, '#5BB6F0'); sky.addColorStop(1, '#CFEAFB'); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, hy + 1);
    ctx.fillStyle = '#9FB7C9'; for (let i = 0; i < 9; i++) { const bw = W / 7, bx = ((i * bw * 1.3 - this.dist * 0.6) % (W + bw * 2) + W + bw * 2) % (W + bw * 2) - bw, bh = hy * (0.25 + ((i * 37) % 5) * 0.08); ctx.fillRect(bx, hy - bh, bw * 0.8, bh); }
    const gr = ctx.createLinearGradient(0, hy, 0, H); gr.addColorStop(0, '#7C8A6A'); gr.addColorStop(1, '#4E5B3F'); ctx.fillStyle = gr; ctx.fillRect(0, hy, W, H - hy);
    // 철길 바닥 (자갈) · 침목 · 레일
    const edge = (x, z) => this.P(x, z); ctx.fillStyle = '#8E8577'; ctx.beginPath(); const a = edge(-1.75, RN_FAR), b = edge(1.75, RN_FAR), c = edge(1.75, -RN_D + 1), d = edge(-1.75, -RN_D + 1); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.fill();
    for (let z = -(this.dist % 2.4) - 4; z < RN_FAR; z += 2.4) { const l = this.P(-1.6, z), r = this.P(1.6, z), t = Math.max(1, 6 * l.s); ctx.fillStyle = 'rgba(92,64,40,' + Math.min(1, 0.4 + l.s).toFixed(2) + ')'; ctx.fillRect(l.x, l.y - t / 2, r.x - l.x, t); }
    ctx.strokeStyle = '#C9CED6'; [-1, 0, 1].forEach(L => [-0.32, 0.32].forEach(o => { const p0 = this.P(L + o, RN_FAR), p1 = this.P(L + o, -RN_D + 1); ctx.lineWidth = Math.max(1, cs * 0.08); ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke(); }));
    // 물건 (먼 것부터)
    const list = this.objs.slice().sort((p, q) => q.z - p.z);
    list.forEach(o => { if (o.z > RN_FAR || o.z + o.len < -RN_D + 1) return; const z0 = Math.max(-RN_D + 1.2, o.z);
      if (o.k === 'train') { const f = this.P(o.lane, z0), bk = this.P(o.lane, Math.min(RN_FAR, o.z + o.len)), hw = W * 0.3 * 0.46, h = W * 0.3 * 1.15;
        ctx.fillStyle = o.moving ? '#B23A48' : '#2D6FB0'; ctx.beginPath(); ctx.moveTo(f.x - hw * f.s, f.y); ctx.lineTo(bk.x - hw * bk.s, bk.y); ctx.lineTo(bk.x - hw * bk.s, bk.y - h * bk.s); ctx.lineTo(f.x - hw * f.s, f.y - h * f.s); ctx.fill();   // 옆면 느낌
        ctx.fillStyle = o.moving ? '#D94F5C' : '#3D8BD6'; FX.rr(ctx, f.x - hw * f.s, f.y - h * f.s, hw * 2 * f.s, h * f.s, 6 * f.s); ctx.fill();
        ctx.fillStyle = '#BFE6FF'; FX.rr(ctx, f.x - hw * 0.75 * f.s, f.y - h * 0.86 * f.s, hw * 1.5 * f.s, h * 0.32 * f.s, 4 * f.s); ctx.fill();
        ctx.fillStyle = '#FFE38A'; [-0.55, 0.55].forEach(q => { ctx.beginPath(); ctx.arc(f.x + hw * q * f.s, f.y - h * 0.22 * f.s, hw * 0.13 * f.s, 0, 7); ctx.fill(); });
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(f.x - hw * f.s, f.y - h * 0.08 * f.s, hw * 2 * f.s, h * 0.08 * f.s); return; }
      const p = this.P(o.lane, z0), u = W * 0.3 * p.s;
      if (o.k === 'low' || o.k === 'high') { const top = o.k === 'low' ? 0.42 : 1.15, bar = o.k === 'low' ? 0.2 : 0.26;
        ctx.fillStyle = '#5A5F6B'; ctx.fillRect(p.x - u * 0.44, p.y - u * top, u * 0.06, u * top); ctx.fillRect(p.x + u * 0.38, p.y - u * top, u * 0.06, u * top);
        for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? '#FFFFFF' : '#E63946'; ctx.fillRect(p.x - u * 0.44 + i * u * 0.176, p.y - u * top, u * 0.176, u * bar); }
        if (o.k === 'high') { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(p.x - u * 0.44, p.y - u * 0.04, u * 0.88, u * 0.04); } return; }
      const yy = p.y - u * (o.high ? 0.75 : 0.28) - Math.abs(Math.sin(this.run * 4 + o.z)) * u * 0.05;
      if (o.k === 'coin') { const rx = u * 0.13 * Math.abs(Math.cos(this.run * 5 + o.z)) + 1; ctx.fillStyle = '#FFD166'; ctx.beginPath(); ctx.ellipse(p.x, yy, rx, u * 0.13, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#B7791F'; ctx.lineWidth = Math.max(1, u * 0.025); ctx.stroke(); }
      else { ctx.font = Math.round(u * 0.36) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.k === 'magnet' ? '🧲' : '🛡', p.x, yy); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; } });
    // 나 (뒷모습 · 점프 · 미끄러지기)
    const me = this.P(this.lx, 0), u = W * 0.3 * me.s, jy = this.py * u * 0.55, sl = this.slide > 0;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(me.x, me.y - u * 0.02, u * 0.2 * (1 - this.py * 0.15), u * 0.06, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(me.x, me.y - jy); if (sl) ctx.scale(1.15, 0.5);
    const leg = this.gameOver || this.py > 0.05 ? 0 : Math.sin(this.run * 18) * u * 0.07;
    ctx.fillStyle = '#23395B'; ctx.fillRect(-u * 0.11, -u * 0.32 + Math.max(0, leg), u * 0.09, u * 0.32); ctx.fillRect(u * 0.02, -u * 0.32 + Math.max(0, -leg), u * 0.09, u * 0.32);
    ctx.fillStyle = '#FF7A1A'; FX.rr(ctx, -u * 0.16, -u * 0.66, u * 0.32, u * 0.38, u * 0.08); ctx.fill();
    ctx.fillStyle = '#3A2A1E'; ctx.beginPath(); ctx.arc(0, -u * 0.76, u * 0.12, 0, 7); ctx.fill();
    ctx.fillStyle = '#1FBF6A'; ctx.beginPath(); ctx.arc(0, -u * 0.8, u * 0.125, Math.PI, 0); ctx.fill(); ctx.fillRect(-u * 0.02, -u * 0.8, u * 0.17, u * 0.035);
    if (this.shield) { ctx.strokeStyle = 'rgba(79,209,224,.8)'; ctx.lineWidth = u * 0.04; ctx.beginPath(); ctx.arc(0, -u * 0.45, u * 0.42, 0, 7); ctx.stroke(); }
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
