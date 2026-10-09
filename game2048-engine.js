// 2048 — 밀어서 같은 숫자를 합치세요. 2048 을 만들면 승리, 더 못 움직이면 끝.
// 판 크기: 시작 화면에서 4×4 ~ 8×8 중 고름. 캔버스는 늘 4칸 크기(정사각형) — 칸 크기만 N 에 맞춰 줄임.

const G2048_SIZES = [4, 5, 6, 7, 8];
const G2048_TIP = { 4: '기본 · 가장 어려움', 5: '조금 넉넉', 6: '넉넉 · 큰 숫자 도전', 7: '아주 넓음', 8: '끝없이 길게' };
// 판 크기별 점수 배수 — 큰 판은 칸이 남아 버티기만 해도 점수가 쌓임 (무작위 밀기 450번: 4×4 는 약 130번에 끝나 1.3천 · 6×6~8×8 은 안 끝나고 6.4천, 3000번이면 6.4만)
const G2048_MUL = { 4: 4, 5: 2.5, 6: 1.8, 7: 1.3, 8: 1 };
const G2048_COLORS = { 2: '#EEE4DA', 4: '#EDE0C8', 8: '#F2B179', 16: '#F59563', 32: '#F67C5F', 64: '#F65E3B',
  128: '#EDCF72', 256: '#EDCC61', 512: '#EDC850', 1024: '#EDC53F', 2048: '#EDC22E', 4096: '#3C3A32' };

class Game2048 {
  constructor(canvas, cellSize) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.cellSize = cellSize;
    this.N = 4; this.grid = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    this.score = 0; this.best = 0; this.moves = 0; this.gameOver = false; this.won = false;
    this.anim = []; this.lastMove = 0;
    this.menu = true; this.sel = 0; this.sizeLabel = '-'; this._blockUntil = 0; this.mul = 1; this._ptr = null;
    // 손가락·마우스 밀기와 크기 고르기 톡은 캔버스에 직접 한 번만 붙임 — 페이지의 기본 스와이프는 세로 밀기에 두 칸(약 180px)이 필요했고,
    // 짧은 아래 밀기·그냥 톡이 '위로 밀기'가 되고, 길게 밀면 두 번 움직였음. 손가락이 캔버스에 닿아 있는 동안 페이지 쪽 호출은 무시
    if (!canvas.__g2048Bound) {
      canvas.__g2048Bound = true;
      canvas.style.touchAction = 'none';
      const cur = () => { const g = canvas.__g2048; return g && !(window.__game && window.__game !== g) ? g : null; };
      canvas.addEventListener('pointerdown', e => {
        const g = cur(); if (!g) return;
        g._ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), done: false };
        try { canvas.setPointerCapture(e.pointerId); } catch (x) {}
      });
      canvas.addEventListener('pointermove', e => {
        const g = cur(), p = g && g._ptr; if (!p || p.done || p.id !== e.pointerId) return;
        const d = g.swipeDir(e.clientX - p.x, e.clientY - p.y, canvas.getBoundingClientRect().width);
        if (d) { p.done = true; g.swipe(d); }
      });
      const end = e => {
        const g = cur(), p = g && g._ptr; if (!p || p.id !== e.pointerId) return;
        g._ptr = null; if (p.done || e.type !== 'pointerup') return;
        const r = canvas.getBoundingClientRect(), d = g.swipeDir(e.clientX - p.x, e.clientY - p.y, r.width);
        if (d) g.swipe(d);
        else if (g.menu) { const k = (g.cellSize * 4) / r.width; g.menuTap((e.clientX - r.left) * k, (e.clientY - r.top) * k); }
      };
      canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    }
    canvas.__g2048 = this;
  }
  // ── 판 크기 고르기 ──
  menuRects() {
    const W = this.cellSize * 4, bw = W * 0.84, bh = W * 0.118, gap = W * 0.024, y0 = W * 0.2;
    return G2048_SIZES.map((n, i) => ({ n, x: (W - bw) / 2, y: y0 + i * (bh + gap), w: bw, h: bh }));
  }
  menuTap(x, y) {
    const hit = this.menuRects().find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
    if (hit) this.startSize(hit.n);
  }
  startSize(n) {
    this.N = n; this.sizeLabel = n + '×' + n; this.menu = false; this.mul = G2048_MUL[n] || 1;
    this.grid = Array.from({ length: n }, () => Array(n).fill(0));
    this.anim = []; this.slide = null;
    this.addTile(); this.addTile();
    this._blockUntil = performance.now() + 300;          // 고른 톡이 첫 밀기로 이어지지 않게
    if (window.Sound) Sound.start();
  }
  menuStep(d) { this.sel = (this.sel + d + G2048_SIZES.length) % G2048_SIZES.length; if (window.Sound) Sound.move(); }
  blocked() { return performance.now() < this._blockUntil; }
  // 손가락이 캔버스에 닿아 있는 중 (페이지 기본 스와이프가 부르는 move·up·down 은 무시 — 밀기는 위 포인터 처리가 한 번만)
  touching() { return !!this._ptr && performance.now() - this._ptr.t < 4000; }
  // 밀기 방향: 캔버스 폭의 7%(최소 18px) 넘게 움직이면 큰 쪽으로
  swipeDir(dx, dy, w) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < Math.max(18, w * 0.07)) return null;
    return Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
  }
  swipe(d) { if (!this.menu) this.push(d[0], d[1]); }
  addTile() {
    const empty = [];
    for (let y = 0; y < this.N; y++) for (let x = 0; x < this.N; x++) if (!this.grid[y][x]) empty.push([x, y]);
    if (!empty.length) return;
    const [x, y] = empty[Math.floor(Math.random() * empty.length)];
    this.grid[y][x] = Math.random() < 0.9 ? 2 : 4;
    this.anim.push({ x, y, t: 1, kind: 'new' });
  }
  // 한 줄을 왼쪽으로 밀어 합치기
  slideRow(row) {
    const idx = [], a = [];
    row.forEach((v, i) => { if (v) { a.push(v); idx.push(i); } });
    const out = [], src = []; let gained = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] === a[i + 1]) { out.push(a[i] * 2); src.push([idx[i], idx[i + 1]]); gained += a[i] * 2; i++; }
      else { out.push(a[i]); src.push([idx[i]]); }
    }
    while (out.length < this.N) { out.push(0); src.push([]); }
    return { row: out, gained, src };
  }
  push(dx, dy) {
    if (this.gameOver || this.menu || this.blocked()) return;
    const g = this.grid, N = this.N;
    let moved = false, gained = 0;
    const lines = [];
    for (let i = 0; i < N; i++) {
      const cells = [];
      for (let j = 0; j < N; j++) {
        const x = dx ? (dx > 0 ? N - 1 - j : j) : i, y = dy ? (dy > 0 ? N - 1 - j : j) : i;
        cells.push([x, y]);
      }
      lines.push(cells);
    }
    const slides = [];
    lines.forEach(cells => {
      const vals = cells.map(([x, y]) => g[y][x]);
      const r = this.slideRow(vals);
      gained += r.gained;
      cells.forEach(([x, y], k) => {
        if (g[y][x] !== r.row[k]) moved = true;
        // 이 칸으로 미끄러져 오는 타일들 (합쳐지면 둘 다 같은 칸으로)
        (r.src[k] || []).forEach(from => { const [fx, fy] = cells[from]; slides.push({ fx, fy, tx: x, ty: y, v: vals[from] }); });
        g[y][x] = r.row[k];
        if (r.row[k] && r.src[k] && r.src[k].length === 2) this.anim.push({ x, y, t: 1, kind: 'merge', delay: 1 });
      });
    });
    if (!moved) return;
    this.slide = { t: 0, tiles: slides };                 // 120ms 동안 미끄러지는 그림
    this.moves++; this.score += Math.round(gained * this.mul);
    this.best = Math.max(this.best, ...g.flat());
    if (gained && window.Sound) Sound.clear(gained >= 64 ? 2 : 1); else if (window.Sound) Sound.move();
    if (this.best >= 2048 && !this.won) { this.won = true; if (window.Sound) Sound.levelUp(); }
    this.addTile();
    if (!this.canMove()) { this.gameOver = true; if (window.Sound) Sound.gameOver(); }
  }
  canMove() {
    const g = this.grid, N = this.N;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!g[y][x]) return true;
      if (x + 1 < N && g[y][x] === g[y][x + 1]) return true;
      if (y + 1 < N && g[y][x] === g[y + 1][x]) return true;
    }
    return false;
  }
  move(dir) { if (this.touching()) return; if (this.menu) { this.menuStep(dir); return; } this.push(dir, 0); }
  up() { if (this.touching()) return; if (this.menu) { this.menuStep(-1); return; } this.push(0, -1); }
  down() { if (this.touching()) return; if (this.menu) { this.menuStep(1); return; } this.push(0, 1); }
  rotate() {}                                            // 페이지 스와이프의 '그냥 톡' — 2048 에서는 아무 일도 안 함 (예전: 위로 밀기)
  // ↓ 키·↓ 버튼: 페이지는 softDropping 만 켬 → 켜지는 순간 한 번 밀기 (예전엔 ↓ 키가 메뉴·판 모두에서 안 먹었음)
  set softDropping(v) { if (v && !this._sd) this.down(); this._sd = !!v; }
  get softDropping() { return !!this._sd; }
  softDrop() {}
  hardDrop() { if (this.menu) { this.startSize(G2048_SIZES[this.sel]); return; } this.down(); }

  tick(now) {
    const dt = this.lastTick ? Math.min(50, now - this.lastTick) : 16.7; this.lastTick = now;
    if (this.slide) { this.slide.t += dt / 120; if (this.slide.t >= 1) this.slide = null; }
    if (!this.slide) this.anim = this.anim.filter(a => { if (a.delay) { a.delay = 0; return true; } return (a.t -= 0.09 * dt / 16.7) > 0; });
    this.draw();
  }

  getSnapshot() {
    // 교사 미니보드: 값의 로그를 색 번호로
    return this.grid.map(r => r.map(v => v ? 29 + Math.min(11, Math.round(Math.log2(v)) - 1) : 0));
  }

  // 타일 한 장: 그림자 → 세로 그라데이션 → 윗면 광택 → 512 이상은 금빛 광채
  tile(ctx, x0, y0, w, v, cs, sc) {
    const col = G2048_COLORS[v] || '#3C3A32', r = w * 0.12;
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; FX.rr(ctx, x0, y0 + w * 0.06, w, w, r); ctx.fill();
    if (v >= 512) { ctx.save(); ctx.shadowColor = '#FFD166'; ctx.shadowBlur = cs * 0.35; ctx.fillStyle = col; FX.rr(ctx, x0, y0, w, w, r); ctx.fill(); ctx.restore(); }
    const g = ctx.createLinearGradient(0, y0, 0, y0 + w); g.addColorStop(0, FX.tint(col, 0.18)); g.addColorStop(1, FX.tint(col, -0.12));
    ctx.fillStyle = g; FX.rr(ctx, x0, y0, w, w, r); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; FX.rr(ctx, x0 + w * 0.08, y0 + w * 0.07, w * 0.84, w * 0.3, r * 0.8); ctx.fill();
    ctx.fillStyle = v <= 4 ? '#776E65' : '#F9F6F2';
    const fs = v < 100 ? cs * 0.5 : v < 1000 ? cs * 0.4 : cs * 0.32;
    ctx.font = '800 ' + Math.round(fs * (sc || 1)) + 'px Pretendard, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (v > 4) { ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 3; }
    ctx.fillText(String(v), x0 + w / 2, y0 + w / 2 + 1); ctx.shadowBlur = 0;
  }
  drawMenu() {
    const ctx = this.ctx, W = this.cellSize * 4;
    const bg = ctx.createLinearGradient(0, 0, W, W); bg.addColorStop(0, '#C9B9A8'); bg.addColorStop(1, '#AE9F90'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, W);
    FX.text(ctx, '판 크기를 고르세요', W / 2, W * 0.1, { size: W * 0.07, weight: 800, color: '#5E544B', align: 'center' });
    FX.text(ctx, '톡 · 또는 ↑↓ 고르고 스페이스', W / 2, W * 0.155, { size: W * 0.036, weight: 600, color: '#776E65', align: 'center' });
    this.menuRects().forEach((b, i) => {
      const on = i === this.sel;
      ctx.fillStyle = 'rgba(0,0,0,0.16)'; FX.rr(ctx, b.x, b.y + b.h * 0.08, b.w, b.h, b.h * 0.28); ctx.fill();
      ctx.fillStyle = on ? '#F65E3B' : '#EEE4DA'; FX.rr(ctx, b.x, b.y, b.w, b.h, b.h * 0.28); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; FX.rr(ctx, b.x + b.h * 0.15, b.y + b.h * 0.1, b.w - b.h * 0.3, b.h * 0.32, b.h * 0.2); ctx.fill();
      // 작은 판 미리보기
      const ps = b.h * 0.7, px = b.x + b.h * 0.25, py = b.y + b.h * 0.15, c = ps / b.n;
      ctx.fillStyle = on ? 'rgba(255,255,255,0.35)' : 'rgba(119,110,101,0.25)'; FX.rr(ctx, px, py, ps, ps, c * 0.4); ctx.fill();
      ctx.fillStyle = on ? '#FFFFFF' : '#C9B9A8';
      for (let y = 0; y < b.n; y++) for (let x = 0; x < b.n; x++) ctx.fillRect(px + x * c + c * 0.15, py + y * c + c * 0.15, c * 0.7, c * 0.7);
      FX.text(ctx, b.n + ' × ' + b.n, b.x + b.h * 1.25, b.y + b.h * 0.53, { size: b.h * 0.42, weight: 800, color: on ? '#FFFFFF' : '#5E544B', baseline: 'middle' });
      FX.text(ctx, G2048_TIP[b.n], b.x + b.w - b.h * 0.3, b.y + b.h * 0.36, { size: b.h * 0.24, weight: 600, color: on ? '#FFF3E0' : '#8F857B', align: 'right', baseline: 'middle' });
      FX.text(ctx, '점수 ' + G2048_MUL[b.n] + '배', b.x + b.w - b.h * 0.3, b.y + b.h * 0.72, { size: b.h * 0.27, weight: 800, color: on ? '#FFFFFF' : '#C2552E', align: 'right', baseline: 'middle' });
    });
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  }
  draw() {
    if (this.menu) { this.drawMenu(); return; }
    const N = this.N, W = this.cellSize * 4, H = W, cs = W / N, ctx = this.ctx;
    const pad = cs * 0.06;
    const bg = ctx.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#C9B9A8'); bg.addColorStop(1, '#AE9F90'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    if (this.slide) {
      // 빈 칸 바탕
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        ctx.fillStyle = 'rgba(238,228,218,0.35)'; FX.rr(ctx, x * cs + pad, y * cs + pad, cs - pad * 2, cs - pad * 2, cs * 0.08); ctx.fill();
      }
      const k = this.slide.t, e = 1 - Math.pow(1 - k, 3);
      this.slide.tiles.forEach(tl => {
        const x = tl.fx + (tl.tx - tl.fx) * e, y = tl.fy + (tl.ty - tl.fy) * e, w = cs - pad * 2;
        this.tile(ctx, x * cs + pad, y * cs + pad, w, tl.v, cs, 1);
      });
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      return;
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const v = this.grid[y][x];
      const a = this.anim.find(q => q.x === x && q.y === y);
      const sc = a ? (a.kind === 'new' ? 1 - a.t * 0.6 : 1 + Math.sin(a.t * Math.PI) * 0.12) : 1;
      const w = (cs - pad * 2) * sc, x0 = x * cs + cs / 2 - w / 2, y0 = y * cs + cs / 2 - w / 2;
      if (!v) { ctx.fillStyle = 'rgba(238,228,218,0.35)'; FX.rr(ctx, x0, y0, w, w, cs * 0.08); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,0.05)'; FX.rr(ctx, x0, y0, w, w * 0.5, cs * 0.08); ctx.fill(); }
      else this.tile(ctx, x0, y0, w, v, cs, sc);
    }
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    if (this.won && this.moves - (this.wonAt || 0) < 40) {
      if (!this.wonAt) this.wonAt = this.moves;
      ctx.fillStyle = 'rgba(237,194,46,0.35)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#776E65'; ctx.font = '800 ' + Math.round(W * 0.125) + 'px Pretendard, sans-serif';
      ctx.textAlign = 'center'; ctx.fillText('2048 달성!', W / 2, H / 2); ctx.textAlign = 'left';
    }
    if (this.gameOver) { ctx.fillStyle = 'rgba(238,228,218,0.6)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#776E65'; ctx.font = '800 ' + Math.round(W * 0.1) + 'px Pretendard, sans-serif';
      ctx.textAlign = 'center'; ctx.fillText('더 움직일 수 없어요', W / 2, H / 2); ctx.textAlign = 'left'; }
  }
}
