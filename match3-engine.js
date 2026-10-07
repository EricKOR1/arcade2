// 보석 맞추기 — 이웃한 보석 두 개를 바꿔 같은 보석 3개 이상을 한 줄로 맞추면 터져요.
//   4개 = 줄 보석(한 줄을 지움) · L·T 모양 = 폭탄 보석(둘레 3×3) · 5개 = 무지개 보석(바꾼 보석과 같은 색을 모두)
//   이동 횟수 안에 목표 점수를 넘으면 다음 단계(이동 +10) · 이동을 다 쓰면 끝
//   (모바일 인기 '3매치 퍼즐' 장르를 학교용으로 새로 만든 것 — 이름·그림은 모두 새로 그림)

const M3_N = 8, M3_ROWS = 9, M3_K = 6;
const M3_COLORS = [null, '#EF476F', '#F79824', '#FFD166', '#06D6A0', '#4CC9F0', '#B15DFF'];

class Match3Game {
  constructor(canvas, cellSize) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.cellSize = cellSize;
    this.score = 0; this.level = 1; this.goal = 600; this.moves = 25; this.used = 0; this.bestChain = 0; this.specials = 0;
    this.gameOver = false; this.state = 'idle'; this.t = 0; this.sel = null; this.ptr = null; this.chain = 0;
    this.pops = []; this.parts = []; this.beams = []; this.lastTime = 0; this.now = 0; this.hint = null; this.idleT = 0;
    this.g = []; for (let y = 0; y < M3_N; y++) { this.g.push([]); for (let x = 0; x < M3_N; x++) { let c; do { c = this.rc(); } while ((x >= 2 && this.g[y][x - 1].c === c && this.g[y][x - 2].c === c) || (y >= 2 && this.g[y - 1][x].c === c && this.g[y - 2][x].c === c)); this.g[y].push({ c, sp: null, oy: -(M3_N - y) - Math.random(), pop: 0 }); } }
    this.state = 'fall';
    if (!this.anyMove()) this.shuffle();
  }
  rc() { return 1 + Math.floor(Math.random() * M3_K); }
  get best() { return this.level; }
  // ── 입력: 누른 보석에서 손가락을 이웃 쪽으로 밀거나, 두 보석을 차례로 톡 ──
  pointer(type, x, y) {
    if (this.gameOver) return; const cx = Math.floor(x), cy = Math.floor(y), inB = cx >= 0 && cy >= 0 && cx < M3_N && cy < M3_N;
    if (type === 'down') { this.ptr = inB ? { x: cx, y: cy, sx: x, sy: y, swiped: false } : null; return; }
    const P = this.ptr; if (!P) return;
    if (type === 'move' && !P.swiped) { const dx = x - P.sx, dy = y - P.sy; if (Math.max(Math.abs(dx), Math.abs(dy)) > 0.45) { P.swiped = true; const [ux, uy] = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]; this.sel = null; this.trySwap(P.x, P.y, P.x + ux, P.y + uy); } return; }
    if (type === 'up') { this.ptr = null; if (P.swiped || !inB) return;
      if (this.sel && Math.abs(this.sel.x - cx) + Math.abs(this.sel.y - cy) === 1) { const s = this.sel; this.sel = null; this.trySwap(s.x, s.y, cx, cy); }
      else { this.sel = this.sel && this.sel.x === cx && this.sel.y === cy ? null : { x: cx, y: cy }; if (window.Sound) Sound.move(); } }
  }
  tapAt(x, y) { this.pointer('down', x, y); this.pointer('up', x, y); }
  move() {} rotate() {} softDrop() {} hardDrop() {}
  trySwap(ax, ay, bx, by) {
    if (this.state !== 'idle' || this.gameOver || bx < 0 || by < 0 || bx >= M3_N || by >= M3_N) return;
    this.hint = null; this.idleT = 0; this.swap = { ax, ay, bx, by, back: false }; this.state = 'swap'; this.t = 0;
  }
  sw(ax, ay, bx, by) { const t = this.g[ay][ax]; this.g[ay][ax] = this.g[by][bx]; this.g[by][bx] = t; }
  // 한 줄로 3개 이상 — 가로·세로 줄 목록
  runs() {
    const out = [], G = this.g;
    for (let y = 0; y < M3_N; y++) for (let x = 0; x < M3_N;) { const c = G[y][x] && G[y][x].c; let e = x + 1; while (c && e < M3_N && G[y][e] && G[y][e].c === c) e++; if (c && e - x >= 3) out.push({ h: true, cells: Array.from({ length: e - x }, (_, i) => [x + i, y]) }); x = e; }
    for (let x = 0; x < M3_N; x++) for (let y = 0; y < M3_N;) { const c = G[y][x] && G[y][x].c; let e = y + 1; while (c && e < M3_N && G[e][x] && G[e][x].c === c) e++; if (c && e - y >= 3) out.push({ h: false, cells: Array.from({ length: e - y }, (_, i) => [x, y + i]) }); y = e; }
    return out;
  }
  anyMove() {   // 바꿔서 맞출 수 있는 곳이 있나 (힌트용 자리도 기억)
    for (let y = 0; y < M3_N; y++) for (let x = 0; x < M3_N; x++) for (const [dx, dy] of [[1, 0], [0, 1]]) { const X = x + dx, Y = y + dy; if (X >= M3_N || Y >= M3_N) continue;
      if (this.g[y][x].sp === 'rainbow' || this.g[Y][X].sp === 'rainbow') { this._hint = [x, y, X, Y]; return true; }
      this.sw(x, y, X, Y); const ok = this.runs().length > 0; this.sw(x, y, X, Y); if (ok) { this._hint = [x, y, X, Y]; return true; } }
    return false;
  }
  shuffle() { const all = this.g.flat(); for (let k = 0; k < 50; k++) { for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
      for (let y = 0; y < M3_N; y++) for (let x = 0; x < M3_N; x++) this.g[y][x] = all[y * M3_N + x];
      if (!this.runs().length && this.anyMove()) break; }
    this.pops.push({ x: M3_N / 2, y: M3_N / 2, t: 1.2, txt: '🔀 섞는 중' }); }
  // 바꾼 뒤: 맞은 줄 → 터질 칸 · 특수 보석 만들기
  resolve(swapAt) {
    const R = this.runs(), kill = new Map(), make = [], key = (x, y) => x + ',' + y;
    if (this._rain) { const { x, y, c } = this._rain; this._rain = null; this.g[y][x].used = true; kill.set(key(x, y), [x, y]); for (let yy = 0; yy < M3_N; yy++) for (let xx = 0; xx < M3_N; xx++) if (this.g[yy][xx].c === c) kill.set(key(xx, yy), [xx, yy]); this.beams.push({ x, y, all: c, t: 1 }); }
    if (!R.length && !kill.size) return false;
    const cnt = {}; R.forEach(r => r.cells.forEach(([x, y]) => { kill.set(key(x, y), [x, y]); cnt[key(x, y)] = (cnt[key(x, y)] || 0) + 1; }));
    R.forEach(r => { const n = r.cells.length, at = (swapAt && r.cells.find(([x, y]) => swapAt.some(s => s[0] === x && s[1] === y))) || r.cells[Math.floor(n / 2)], cross = r.cells.find(([x, y]) => cnt[key(x, y)] > 1);
      if (n >= 5) make.push({ at, sp: 'rainbow', c: 0 }); else if (cross) { if (!make.some(m => m.at[0] === cross[0] && m.at[1] === cross[1])) make.push({ at: cross, sp: 'bomb', c: this.g[cross[1]][cross[0]].c }); } else if (n === 4) make.push({ at, sp: r.h ? 'v' : 'h', c: this.g[at[1]][at[0]].c }); });
    // 터지는 특수 보석은 효과가 번짐 (연쇄)
    const q = [...kill.values()]; while (q.length) { const [x, y] = q.shift(), gm = this.g[y][x]; if (!gm || !gm.sp || gm.used) continue; gm.used = true; const add = (X, Y) => { if (X < 0 || Y < 0 || X >= M3_N || Y >= M3_N) return; const k = key(X, Y); if (!kill.has(k)) { kill.set(k, [X, Y]); q.push([X, Y]); } };
      if (gm.sp === 'h') { for (let X = 0; X < M3_N; X++) add(X, y); this.beams.push({ x, y, h: true, t: 1 }); }
      if (gm.sp === 'v') { for (let Y = 0; Y < M3_N; Y++) add(x, Y); this.beams.push({ x, y, h: false, t: 1 }); }
      if (gm.sp === 'bomb') { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) add(x + a, y + b); this.beams.push({ x, y, bomb: true, t: 1 }); }
      if (gm.sp === 'rainbow') { const c = this.rc(); for (let Y = 0; Y < M3_N; Y++) for (let X = 0; X < M3_N; X++) if (this.g[Y][X].c === c) add(X, Y); } }
    this.chain++; this.bestChain = Math.max(this.bestChain, this.chain);
    const gain = kill.size * 10 * this.chain + make.length * 30; this.score += gain;
    let mx = 0, my = 0; kill.forEach(([x, y]) => { mx += x; my += y; this.g[y][x].pop = 1; const col = M3_COLORS[this.g[y][x].c] || '#fff'; for (let i = 0; i < 4; i++) this.parts.push({ x: x + 0.5, y: y + 0.5, vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.8) * 0.25, g: 0.012, l: 1, c: col }); });
    this.pops.push({ x: mx / kill.size + 0.5, y: my / kill.size + 0.5, t: 1, txt: (this.chain > 1 ? this.chain + '연쇄! ' : '') + '+' + gain });
    this._make = make; this._kill = kill; this.specials += make.length;
    if (window.Sound) { if (make.some(m => m.sp === 'rainbow') || this.chain >= 4) Sound.levelUp(); else Sound.clear(Math.min(4, this.chain)); }
    return true;
  }
  // 터진 칸을 비우고 · 특수 보석을 놓고 · 위에서 떨어뜨림
  collapse() {
    this._kill.forEach(([x, y]) => { this.g[y][x] = null; }); this._make.forEach(m => { this.g[m.at[1]][m.at[0]] = { c: m.sp === 'rainbow' ? 0 : m.c, sp: m.sp, oy: 0, pop: 0, born: 1 }; });
    for (let x = 0; x < M3_N; x++) { let w = M3_N - 1; for (let y = M3_N - 1; y >= 0; y--) { const gm = this.g[y][x]; if (gm) { if (w !== y) { this.g[w][x] = gm; this.g[y][x] = null; gm.oy -= (w - y); } w--; } }
      for (let y = w, k = 1; y >= 0; y--, k++) this.g[y][x] = { c: this.rc(), sp: null, oy: -(w + 1) - 0.3 * k, pop: 0 }; }
  }
  tick(now) {
    const { dt, f } = FX.frame(this, now), k = dt / 1000;
    this.pops = this.pops.filter(e => (e.t -= 0.018 * f) > 0); this.beams = this.beams.filter(e => (e.t -= 0.05 * f) > 0); this.parts = FX.stepParts(this.parts, f, 0.035);
    if (this.state === 'swap') { this.t += k / 0.16; if (this.t >= 1) { const s = this.swap; this.sw(s.ax, s.ay, s.bx, s.by); this.t = 0;
        if (s.back) { this.state = 'idle'; return this.draw(); }
        const A = this.g[s.ay][s.ax], B = this.g[s.by][s.bx]; this.chain = 0;
        if (A.sp === 'rainbow' || B.sp === 'rainbow') { const r = A.sp === 'rainbow' ? [s.ax, s.ay, B] : [s.bx, s.by, A]; this._rain = { x: r[0], y: r[1], c: r[2].c || this.rc() }; }
        if (this.resolve([[s.ax, s.ay], [s.bx, s.by]])) { this.moves--; this.used++; this.state = 'pop'; }
        else { s.back = true; this.state = 'swap'; if (window.Sound) Sound.bump(); } } }
    else if (this.state === 'pop') { this.t += k / 0.2; if (this.t >= 1) { this.collapse(); this.state = 'fall'; this.t = 0; } }
    else if (this.state === 'fall') { let moving = false; this.g.forEach(r => r.forEach(gm => { if (gm.oy < 0) { gm.vy = (gm.vy || 0) + 40 * k; gm.oy = Math.min(0, gm.oy + gm.vy * k); moving = true; if (!gm.oy) gm.vy = 0; } }));
      if (!moving) { if (this.resolve(null)) { this.state = 'pop'; this.t = 0; }
        else { this.state = 'idle'; this.chain = 0;
          if (this.score >= this.goal) { this.level++; this.moves += 10; this.goal += 600 + this.level * 300; this.pops.push({ x: M3_N / 2, y: M3_N / 2, t: 1.6, txt: '🎉 ' + this.level + '단계! 이동 +10' }); if (window.Sound) Sound.levelUp(); }
          if (this.moves <= 0) { this.gameOver = true; if (window.Sound) Sound.gameOver(); }
          else if (!this.anyMove()) this.shuffle(); } } }
    else if (this.state === 'idle') { this.idleT += dt; if (this.idleT > 6000 && !this.hint && this.anyMove()) this.hint = this._hint; }
    this.g.forEach(r => r.forEach(gm => { if (gm && gm.born) gm.born = Math.max(0, gm.born - 0.06 * f); }));
    this.draw();
  }
  getSnapshot() { const m = [0, 7, 3, 4, 5, 1, 6]; const out = this.g.map(r => r.map(gm => gm ? (gm.sp === 'rainbow' ? 22 : m[gm.c] || 0) : 0)); out.push(Array(M3_N).fill(0)); return out; }
  gem(ctx, cx, cy, r, gm, a) {   // 색마다 모양이 달라요 (색약 학생도 구별)
    const c = gm.c, col = gm.sp === 'rainbow' ? '#FFFFFF' : M3_COLORS[c] || '#888'; ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, cy);
    const gr = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.1); gr.addColorStop(0, FX.tint(col, 0.55)); gr.addColorStop(0.5, col); gr.addColorStop(1, FX.tint(col, -0.35)); ctx.fillStyle = gr;
    ctx.beginPath();
    if (gm.sp === 'rainbow') { ctx.arc(0, 0, r, 0, 7); const rg = ctx.createConicGradient ? ctx.createConicGradient(this.now / 400, 0, 0) : null; if (rg) { ['#EF476F', '#F79824', '#FFD166', '#06D6A0', '#4CC9F0', '#B15DFF', '#EF476F'].forEach((q, i) => rg.addColorStop(i / 6, q)); ctx.fillStyle = rg; } }
    else if (c === 1) { ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); }                     // 다이아
    else if (c === 2) { ctx.arc(0, 0, r * 0.92, 0, 7); }                                                               // 동그라미
    else if (c === 3) { for (let i = 0; i < 10; i++) { const an = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.48 : r; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } }   // 별
    else if (c === 4) { FX.rr(ctx, -r * 0.82, -r * 0.82, r * 1.64, r * 1.64, r * 0.3); }                                 // 네모
    else if (c === 5) { ctx.moveTo(0, -r); ctx.lineTo(r * 0.95, r * 0.75); ctx.lineTo(-r * 0.95, r * 0.75); }            // 세모
    else { for (let i = 0; i < 6; i++) { const an = i * Math.PI / 3; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); } }  // 육각형
    ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = Math.max(1, r * 0.08); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.ellipse(-r * 0.25, -r * 0.38, r * 0.3, r * 0.14, -0.5, 0, 7); ctx.fill();
    if (gm.sp === 'h' || gm.sp === 'v') { ctx.fillStyle = 'rgba(255,255,255,.9)'; for (let i = -1; i <= 1; i++) if (gm.sp === 'h') ctx.fillRect(-r * 0.7, i * r * 0.32 - r * 0.06, r * 1.4, r * 0.12); else ctx.fillRect(i * r * 0.32 - r * 0.06, -r * 0.7, r * 0.12, r * 1.4); }
    if (gm.sp === 'bomb') { ctx.strokeStyle = '#fff'; ctx.lineWidth = r * 0.14; ctx.beginPath(); ctx.arc(0, 0, r * 0.5 + Math.sin(this.now / 150) * r * 0.06, 0, 7); ctx.stroke(); }
    ctx.restore();
  }
  draw() {
    const ctx = this.ctx, cs = this.cellSize, W = cs * M3_N, H = cs * M3_ROWS, B = cs * M3_N;
    const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#3A1F5C'); bg.addColorStop(1, '#170D2E'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < M3_N; y++) for (let x = 0; x < M3_N; x++) { ctx.fillStyle = (x + y) % 2 ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.12)'; ctx.fillRect(x * cs, y * cs, cs, cs); }
    const s = this.state === 'swap' ? this.swap : null, e = s ? (1 - Math.pow(1 - Math.min(1, this.t), 3)) : 0;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, B); ctx.clip();
    for (let y = 0; y < M3_N; y++) for (let x = 0; x < M3_N; x++) { const gm = this.g[y][x]; if (!gm) continue;
      let px = x, py = y + (gm.oy || 0);
      if (s) { if (x === s.ax && y === s.ay) { px += (s.bx - s.ax) * e; py += (s.by - s.ay) * e; } else if (x === s.bx && y === s.by) { px += (s.ax - s.bx) * e; py += (s.ay - s.by) * e; } }
      const popK = this.state === 'pop' && gm.pop ? 1 - this.t : 1, sc = popK * (1 + (gm.born || 0) * 0.4), sel = this.sel && this.sel.x === x && this.sel.y === y, hi = this.hint && ((this.hint[0] === x && this.hint[1] === y) || (this.hint[2] === x && this.hint[3] === y));
      if (sel || hi) { ctx.fillStyle = sel ? 'rgba(255,255,255,.3)' : 'rgba(255,230,140,' + (0.15 + 0.15 * Math.sin(this.now / 200)).toFixed(2) + ')'; FX.rr(ctx, px * cs + 2, py * cs + 2, cs - 4, cs - 4, cs * 0.2); ctx.fill(); }
      this.gem(ctx, (px + 0.5) * cs, (py + 0.5) * cs, cs * 0.38 * sc * (sel ? 1.08 : 1), gm, popK); }
    this.beams.forEach(b => { ctx.globalAlpha = b.t; ctx.fillStyle = '#FFF6C8';
      if (b.bomb) { ctx.beginPath(); ctx.arc((b.x + 0.5) * cs, (b.y + 0.5) * cs, cs * (1.6 - b.t), 0, 7); ctx.fill(); }
      else if (b.all) { ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(0, 0, W, B); }
      else if (b.h) ctx.fillRect(0, (b.y + 0.5 - b.t * 0.3) * cs, W, b.t * 0.6 * cs); else ctx.fillRect((b.x + 0.5 - b.t * 0.3) * cs, 0, b.t * 0.6 * cs, B); ctx.globalAlpha = 1; });
    FX.drawParts(ctx, this.parts, cs, Math.max(3, cs * 0.12)); ctx.restore();
    // 아래 정보 줄: 남은 이동 · 단계 목표
    const y0 = B + cs * 0.12, h = cs * 0.76; ctx.fillStyle = 'rgba(0,0,0,.3)'; FX.rr(ctx, cs * 0.1, y0, W - cs * 0.2, h, cs * 0.25); ctx.fill();
    FX.text(ctx, '🎯 ' + this.level + '단계', cs * 0.35, y0 + h * 0.68, { size: cs * 0.34, weight: 800, color: '#FFE38A' });
    const p = Math.min(1, this.score / this.goal), bx = cs * 2.2, bw = W - cs * 4.6; ctx.fillStyle = 'rgba(255,255,255,.12)'; FX.rr(ctx, bx, y0 + h * 0.32, bw, h * 0.36, h * 0.18); ctx.fill();
    ctx.fillStyle = '#06D6A0'; FX.rr(ctx, bx, y0 + h * 0.32, Math.max(h * 0.36, bw * p), h * 0.36, h * 0.18); ctx.fill();
    FX.text(ctx, this.score + ' / ' + this.goal, bx + bw / 2, y0 + h * 0.62, { size: cs * 0.24, weight: 800, color: '#fff', align: 'center', stroke: 'rgba(0,0,0,.5)' });
    FX.text(ctx, '👆 ' + this.moves, W - cs * 0.35, y0 + h * 0.68, { size: cs * 0.36, weight: 900, color: this.moves <= 5 ? '#FF8A8A' : '#fff', align: 'right' });
    this.pops.forEach(q => { ctx.globalAlpha = Math.min(1, q.t * 1.5); FX.text(ctx, q.txt, q.x * cs, (q.y - (1 - q.t)) * cs, { size: cs * 0.5, weight: 900, color: '#FFE38A', align: 'center', stroke: 'rgba(40,10,40,.85)' }); ctx.globalAlpha = 1; });
    if (this.gameOver) { ctx.fillStyle = 'rgba(15,6,30,.72)'; ctx.fillRect(0, 0, W, H);
      FX.text(ctx, '이동을 다 썼어요', W / 2, H * 0.42, { size: cs * 0.6, weight: 900, color: '#fff', align: 'center' });
      FX.text(ctx, this.score + '점 · ' + this.level + '단계', W / 2, H * 0.42 + cs * 0.8, { size: cs * 0.42, weight: 700, color: '#FFD166', align: 'center' }); }
  }
}
if (typeof window !== 'undefined') window.Match3Game = Match3Game;
