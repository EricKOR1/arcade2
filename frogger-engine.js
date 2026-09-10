// 길 건너기 — 차와 강을 피해 위쪽 집까지. 도착할 때마다 점수, 갈수록 빨라짐. 목숨 3개.

const FROG_COLS = 13, FROG_ROWS = 15;
// 줄 종류: 'road'(차) 'river'(통나무) 'safe'(풀) 'home'(도착) — 위에서 아래로
const FROG_LANES = ['home','river','river','river','river','safe','road','road','road','road','road','safe','road','road','start'];

class FroggerGame {
  constructor(canvas, cellSize) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.cellSize = cellSize;
    this.score = 0; this.lives = 3; this.crossed = 0; this.level = 1; this.gameOver = false;
    this.lastTime = 0; this.hopT = 0; this.deathT = 0; this.homes = [false, false, false, false, false];
    this.time = 0;
    this.build();
    this.resetFrog();
  }
  build() {
    // 각 줄에 움직이는 것들: dir(방향), speed, 길이, 간격
    this.lanes = FROG_LANES.map((kind, y) => {
      if (kind !== 'road' && kind !== 'river') return { kind, y, items: [] };
      const dir = (y % 2) ? 1 : -1;
      const speed = (0.02 + Math.random() * 0.02 + this.level * 0.005) * dir;
      const len = kind === 'river' ? 2 + Math.floor(Math.random() * 3) : 1 + Math.floor(Math.random() * 2);
      const gap = len + 2 + Math.floor(Math.random() * 3);
      const items = [];
      for (let x = -gap; x < FROG_COLS + gap; x += len + gap) items.push({ x: x + Math.random() * 2, len });
      return { kind, y, dir, speed, len, gap, items, color: kind === 'river' ? '#8B5A2B' : ['#FF5C7A', '#FFD166', '#4CC9F0', '#B15DFF'][y % 4] };
    });
  }
  resetFrog() { this.fx = Math.floor(FROG_COLS / 2); this.fy = FROG_ROWS - 1; this.onLog = null; this.hopT = 0; }

  hop(dx, dy) {
    if (this.gameOver || this.deathT > 0 || this.hopT > 0) return;
    const nx = Math.round(this.fx) + dx, ny = this.fy + dy;
    if (nx < 0 || nx >= FROG_COLS || ny < 0 || ny >= FROG_ROWS) return;
    this.fx = nx; this.fy = ny; this.hopT = 1;
    if (dy < 0) this.score += 5;
    if (window.Sound) Sound.move();
  }
  move(dir) { this.hop(dir, 0); }
  up() { this.hop(0, -1); }
  down() { this.hop(0, 1); }
  rotate() { this.up(); }
  softDrop() { if (!this._dl) { this._dl = true; this.down(); } }
  hardDrop() { this.up(); }

  die() {
    if (this.deathT > 0) return;
    this.deathT = 1; this.lives--;
    if (window.Sound) Sound.crash();
    if (this.lives <= 0) { this.gameOver = true; if (window.Sound) Sound.gameOver(); }
  }

  tick(now) {
    if (this.gameOver) return;
    const dt = this.lastTime ? Math.min(50, now - this.lastTime) : 16.7; this.lastTime = now; const f = dt / 16.7;
    if (!this.softDropping) this._dl = false;
    this.time += dt;
    if (this.hopT > 0) this.hopT = Math.max(0, this.hopT - 0.18 * f);
    if (this.deathT > 0) { this.deathT -= 0.03 * f; if (this.deathT <= 0) { this.deathT = 0; this.resetFrog(); } this.draw(); return; }

    // 줄 이동
    this.lanes.forEach(l => {
      if (!l.items.length) return;
      const span = FROG_COLS + l.gap * 2 + l.len;
      l.items.forEach(it => { it.x += l.speed * f; if (it.x > FROG_COLS + l.gap) it.x -= span; if (it.x < -l.gap - l.len) it.x += span; });
    });

    // 판정
    const lane = this.lanes[this.fy];
    if (lane.kind === 'road') {
      if (lane.items.some(it => this.fx + 0.6 > it.x && this.fx + 0.4 < it.x + it.len)) this.die();
    } else if (lane.kind === 'river') {
      const log = lane.items.find(it => this.fx + 0.5 >= it.x && this.fx + 0.5 <= it.x + it.len);
      if (log) { this.fx += lane.speed * f; if (this.fx < -0.5 || this.fx > FROG_COLS - 0.5) this.die(); }
      else this.die();
    } else if (lane.kind === 'home') {
      const slot = Math.round((this.fx / (FROG_COLS - 1)) * 4);
      if (this.homes[slot]) { this.die(); }
      else {
        this.homes[slot] = true; this.crossed++; this.score += 50 + Math.max(0, 30 - Math.floor(this.time / 1000)) ;
        if (window.Sound) Sound.levelUp();
        if (this.homes.every(h => h)) { this.level++; this.score += 200; this.homes = [false, false, false, false, false]; this.build(); }
        this.time = 0; this.resetFrog();
      }
    }
    this.draw();
  }

  getSnapshot() {
    const g = Array.from({ length: FROG_ROWS }, () => Array(FROG_COLS).fill(0));
    this.lanes.forEach(l => {
      if (l.kind === 'river') for (let x = 0; x < FROG_COLS; x++) g[l.y][x] = 41;      // 물
      if (l.kind === 'home') for (let x = 0; x < FROG_COLS; x++) g[l.y][x] = 42;
      l.items.forEach(it => { for (let k = 0; k < it.len; k++) { const x = Math.round(it.x + k); if (x >= 0 && x < FROG_COLS) g[l.y][x] = l.kind === 'river' ? 43 : 44; } });
    });
    const fx = Math.max(0, Math.min(FROG_COLS - 1, Math.round(this.fx)));
    if (!this.gameOver) g[this.fy][fx] = 13;
    return g;
  }

  draw() {
    const ctx = this.ctx, cs = this.cellSize, W = FROG_COLS * cs, H = FROG_ROWS * cs;
    this.lanes.forEach(l => {
      const y = l.y * cs;
      ctx.fillStyle = l.kind === 'river' ? '#1E5FA8' : l.kind === 'road' ? '#2B2F3A' : l.kind === 'home' ? '#173D2A' : '#2E7D46';
      ctx.fillRect(0, y, W, cs);
      if (l.kind === 'road') { ctx.fillStyle = 'rgba(255,255,255,0.25)'; for (let x = 0; x < FROG_COLS; x += 2) ctx.fillRect(x * cs + cs * 0.2, y + cs / 2 - 1, cs * 0.6, 2); }
      if (l.kind === 'river') { ctx.fillStyle = 'rgba(255,255,255,0.12)'; for (let x = 0; x < FROG_COLS; x++) ctx.fillRect(x * cs + ((this.time / 40 + l.y * 7) % cs), y + cs * 0.3, cs * 0.35, 2); }
      l.items.forEach(it => {
        const x = it.x * cs, w = it.len * cs;
        if (l.kind === 'river') {
          ctx.fillStyle = '#8B5A2B'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y + cs * 0.15, w, cs * 0.7, cs * 0.3); else ctx.rect(x, y + cs * 0.15, w, cs * 0.7); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x + cs * 0.2, y + cs * 0.25, w - cs * 0.4, cs * 0.12);
        } else {
          ctx.fillStyle = l.color; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y + cs * 0.15, w, cs * 0.7, cs * 0.18); else ctx.rect(x, y + cs * 0.15, w, cs * 0.7); ctx.fill();
          ctx.fillStyle = 'rgba(200,235,255,0.7)'; ctx.fillRect(x + (l.dir > 0 ? w - cs * 0.45 : cs * 0.15), y + cs * 0.25, cs * 0.3, cs * 0.5);
          ctx.fillStyle = '#1A1D24'; ctx.fillRect(x + cs * 0.1, y + cs * 0.82, cs * 0.25, cs * 0.12); ctx.fillRect(x + w - cs * 0.35, y + cs * 0.82, cs * 0.25, cs * 0.12);
        }
      });
      if (l.kind === 'home') for (let s = 0; s < 5; s++) {
        const hx = (s / 4) * (FROG_COLS - 1) * cs + cs * 0.5;
        ctx.fillStyle = this.homes[s] ? '#06D6A0' : 'rgba(0,0,0,0.35)';
        ctx.beginPath(); ctx.arc(hx, y + cs / 2, cs * 0.38, 0, Math.PI * 2); ctx.fill();
      }
    });
    // 개구리
    if (!this.gameOver && this.deathT <= 0) {
      const px = (this.fx + 0.5) * cs, py = (this.fy + 0.5) * cs - Math.sin(this.hopT * Math.PI) * cs * 0.35;
      const r = cs * 0.38;
      ctx.fillStyle = '#06D6A0'; ctx.beginPath(); ctx.ellipse(px, py, r, r * 0.85, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px - r * 0.4, py - r * 0.5, r * 0.28, 0, Math.PI * 2); ctx.arc(px + r * 0.4, py - r * 0.5, r * 0.28, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0B0D12'; ctx.beginPath(); ctx.arc(px - r * 0.4, py - r * 0.5, r * 0.13, 0, Math.PI * 2); ctx.arc(px + r * 0.4, py - r * 0.5, r * 0.13, 0, Math.PI * 2); ctx.fill();
    } else if (this.deathT > 0) {
      const px = (this.fx + 0.5) * cs, py = (this.fy + 0.5) * cs;
      ctx.fillStyle = 'rgba(255,92,122,' + this.deathT.toFixed(2) + ')';
      ctx.font = '800 ' + Math.round(cs * 0.9) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✕', px, py); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
    for (let i = 0; i < this.lives; i++) { ctx.fillStyle = '#06D6A0'; ctx.beginPath(); ctx.arc(cs * (0.5 + i * 0.7), H - cs * 0.5, cs * 0.18, 0, Math.PI * 2); ctx.fill(); }
    if (this.gameOver) { ctx.fillStyle = 'rgba(11,13,18,0.55)'; ctx.fillRect(0, 0, W, H); }
  }
}
