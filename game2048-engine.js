// 2048 — 밀어서 같은 숫자를 합치세요. 2048 을 만들면 승리, 더 못 움직이면 끝.

const G2048_N = 4;
const G2048_COLORS = { 2: '#EEE4DA', 4: '#EDE0C8', 8: '#F2B179', 16: '#F59563', 32: '#F67C5F', 64: '#F65E3B',
  128: '#EDCF72', 256: '#EDCC61', 512: '#EDC850', 1024: '#EDC53F', 2048: '#EDC22E', 4096: '#3C3A32' };

class Game2048 {
  constructor(canvas, cellSize) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.cellSize = cellSize;
    this.grid = Array.from({ length: G2048_N }, () => Array(G2048_N).fill(0));
    this.score = 0; this.best = 0; this.moves = 0; this.gameOver = false; this.won = false;
    this.anim = []; this.lastMove = 0;
    this.addTile(); this.addTile();
  }
  addTile() {
    const empty = [];
    for (let y = 0; y < G2048_N; y++) for (let x = 0; x < G2048_N; x++) if (!this.grid[y][x]) empty.push([x, y]);
    if (!empty.length) return;
    const [x, y] = empty[Math.floor(Math.random() * empty.length)];
    this.grid[y][x] = Math.random() < 0.9 ? 2 : 4;
    this.anim.push({ x, y, t: 1, kind: 'new' });
  }
  // 한 줄을 왼쪽으로 밀어 합치기
  slideRow(row) {
    const a = row.filter(v => v), out = []; let gained = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] === a[i + 1]) { out.push(a[i] * 2); gained += a[i] * 2; i++; } else out.push(a[i]);
    }
    while (out.length < G2048_N) out.push(0);
    return { row: out, gained };
  }
  push(dx, dy) {
    if (this.gameOver) return;
    const g = this.grid, N = G2048_N;
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
    lines.forEach(cells => {
      const vals = cells.map(([x, y]) => g[y][x]);
      const r = this.slideRow(vals);
      gained += r.gained;
      cells.forEach(([x, y], k) => { if (g[y][x] !== r.row[k]) moved = true; g[y][x] = r.row[k]; if (r.row[k] && r.row[k] !== vals[k]) this.anim.push({ x, y, t: 1, kind: 'merge' }); });
    });
    if (!moved) return;
    this.moves++; this.score += gained;
    this.best = Math.max(this.best, ...g.flat());
    if (gained && window.Sound) Sound.clear(gained >= 64 ? 2 : 1); else if (window.Sound) Sound.move();
    if (this.best >= 2048 && !this.won) { this.won = true; if (window.Sound) Sound.levelUp(); }
    this.addTile();
    if (!this.canMove()) { this.gameOver = true; if (window.Sound) Sound.gameOver(); }
  }
  canMove() {
    const g = this.grid, N = G2048_N;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!g[y][x]) return true;
      if (x + 1 < N && g[y][x] === g[y][x + 1]) return true;
      if (y + 1 < N && g[y][x] === g[y + 1][x]) return true;
    }
    return false;
  }
  move(dir) { this.push(dir, 0); }
  up() { this.push(0, -1); }
  down() { this.push(0, 1); }
  rotate() { this.up(); }
  softDrop() { if (!this._downLatch) { this._downLatch = true; this.down(); } }
  hardDrop() { this.down(); }

  tick(now) { if (!this.softDropping) this._downLatch = false; this.anim = this.anim.filter(a => (a.t -= 0.09) > 0); this.draw(); }

  getSnapshot() {
    // 교사 미니보드: 값의 로그를 색 번호로
    return this.grid.map(r => r.map(v => v ? 29 + Math.min(11, Math.round(Math.log2(v)) - 1) : 0));
  }

  draw() {
    const ctx = this.ctx, cs = this.cellSize, N = G2048_N, W = cs * N, H = cs * N;
    const pad = cs * 0.06;
    ctx.fillStyle = '#BBADA0'; ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const v = this.grid[y][x];
      const a = this.anim.find(q => q.x === x && q.y === y);
      const sc = a ? (a.kind === 'new' ? 1 - a.t * 0.6 : 1 + Math.sin(a.t * Math.PI) * 0.12) : 1;
      const w = (cs - pad * 2) * sc, x0 = x * cs + cs / 2 - w / 2, y0 = y * cs + cs / 2 - w / 2;
      ctx.fillStyle = v ? (G2048_COLORS[v] || '#3C3A32') : 'rgba(238,228,218,0.35)';
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x0, y0, w, w, cs * 0.08); else ctx.rect(x0, y0, w, w); ctx.fill();
      if (v) {
        ctx.fillStyle = v <= 4 ? '#776E65' : '#F9F6F2';
        const fs = v < 100 ? cs * 0.5 : v < 1000 ? cs * 0.4 : cs * 0.32;
        ctx.font = '800 ' + Math.round(fs * sc) + 'px Pretendard, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(v), x * cs + cs / 2, y * cs + cs / 2 + 1);
      }
    }
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    if (this.won && this.moves - (this.wonAt || 0) < 40) {
      if (!this.wonAt) this.wonAt = this.moves;
      ctx.fillStyle = 'rgba(237,194,46,0.35)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#776E65'; ctx.font = '800 ' + Math.round(cs * 0.5) + 'px Pretendard, sans-serif';
      ctx.textAlign = 'center'; ctx.fillText('2048 달성!', W / 2, H / 2); ctx.textAlign = 'left';
    }
    if (this.gameOver) { ctx.fillStyle = 'rgba(238,228,218,0.6)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#776E65'; ctx.font = '800 ' + Math.round(cs * 0.45) + 'px Pretendard, sans-serif';
      ctx.textAlign = 'center'; ctx.fillText('더 움직일 수 없어요', W / 2, H / 2); ctx.textAlign = 'left'; }
  }
}
