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
      const speed = (0.016 + Math.random() * 0.016 + (this.level - 1) * 0.006) * dir;   // 1단계는 여유 있게
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
    const { dt, f } = FX.frame(this, now);
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

  // ── 스프라이트 (코드 생성 · 외부 파일 없음) ──
  buildSprites(cs) {
    const P = 16;
    const pal = { G: '#7DF58F', g: '#2FBF5C', d: '#12572A', w: '#FFFFFF', k: '#0B0D12', y: '#FFD166', p: '#FF8AB0', r: '#FF5C5C' };
    // 개구리: 정면을 보는 모습 (눈 · 앞발 · 뒷다리)
    const frog = [
      '................','...dd......dd...','..dGGd....dGGd..','..dGwGd..dGwGd..','..dGwkGddGwkGd..','..dGGGGGGGGGGd..','...dgggggggggd..',
      '..dgggggggggggd.','.dGgggggggggggGd','.dGgggddddgggGd.','.dGggggggggggGd.','..dGgggggggggd..','..ddGgggggggGdd.','.dd..dGGGGGd..dd',
      'dd....ddddd....d','................'];
    const frogHop = frog.map((r, y) => y >= 12 ? r.replace(/d/g, 'g') : r);
    const bake = grid => FX.sprite(grid, pal, cs);
    this._fs = { frog: bake(frog), frogHop: bake(frogHop) };
    this._fsCs = cs;
  }

  draw() {
    const ctx = this.ctx, cs = this.cellSize, W = FROG_COLS * cs, H = FROG_ROWS * cs;
    if (!this._fs || this._fsCs !== cs) this.buildSprites(cs);
    const T = this.time;

    this.lanes.forEach(l => {
      const y = l.y * cs;
      // ── 차선 바탕 ──
      if (l.kind === 'river') {
        const g = ctx.createLinearGradient(0, y, 0, y + cs); g.addColorStop(0, '#14538F'); g.addColorStop(1, '#0E3E६E'.replace('६','6'));
        ctx.fillStyle = g; ctx.fillRect(0, y, W, cs);
        // 물결: 흐르는 방향으로 이동
        ctx.strokeStyle = 'rgba(190,235,255,0.22)'; ctx.lineWidth = Math.max(1.5, cs * 0.06);
        for (let k = 0; k < 3; k++) { const oy = y + cs * (0.25 + k * 0.28);
          ctx.beginPath(); for (let x = -cs; x <= W + cs; x += cs * 0.5) {
            const ph = (T / 22 * l.dir + x * 0.6 + k * 40) ;
            ctx.lineTo(x, oy + Math.sin(ph / 30) * cs * 0.05); } ctx.stroke(); }
      } else if (l.kind === 'road') {
        ctx.fillStyle = '#31353F'; ctx.fillRect(0, y, W, cs);
        ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0, y, W, cs * 0.1); ctx.fillRect(0, y + cs * 0.9, W, cs * 0.1);
        ctx.fillStyle = 'rgba(255,255,255,0.30)';
        for (let x = 0; x < FROG_COLS; x += 2) ctx.fillRect(x * cs + cs * 0.22, y + cs / 2 - Math.max(1, cs * 0.03), cs * 0.56, Math.max(2, cs * 0.06));
      } else if (l.kind === 'home') {
        const g = ctx.createLinearGradient(0, y, 0, y + cs); g.addColorStop(0, '#1B4A32'); g.addColorStop(1, '#123424');
        ctx.fillStyle = g; ctx.fillRect(0, y, W, cs);
      } else {
        const g = ctx.createLinearGradient(0, y, 0, y + cs); g.addColorStop(0, '#39955A'); g.addColorStop(1, '#2C7A47');
        ctx.fillStyle = g; ctx.fillRect(0, y, W, cs);
        // 풀잎
        ctx.fillStyle = 'rgba(125,245,143,0.28)';
        for (let x = 0; x < FROG_COLS; x++) { const sd = (x * 37 + l.y * 91) % 11; if (sd > 4) continue;
          ctx.fillRect(x * cs + (sd + 2) * cs / 16, y + (sd * 2 + 4) * cs / 16, cs / 16, cs / 8); }
      }

      // ── 차 · 통나무 ──
      l.items.forEach(it => {
        const x = it.x * cs, w = it.len * cs;
        if (l.kind === 'river') {
          // 통나무: 나뭇결 + 양끝 단면
          ctx.fillStyle = 'rgba(0,0,0,0.25)'; FX.rr(ctx, x + cs * 0.06, y + cs * 0.24, w, cs * 0.66, cs * 0.3); ctx.fill();
          ctx.fillStyle = '#8B5A2B'; FX.rr(ctx, x, y + cs * 0.18, w, cs * 0.64, cs * 0.3); ctx.fill();
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          for (let q = 0; q < Math.max(1, Math.round(it.len)); q++) ctx.fillRect(x + cs * (0.45 + q), y + cs * 0.24, Math.max(1.5, cs * 0.05), cs * 0.52);
          ctx.fillStyle = '#A9713A'; ctx.beginPath(); ctx.ellipse(x + cs * 0.1, y + cs * 0.5, cs * 0.1, cs * 0.3, 0, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(x + w - cs * 0.1, y + cs * 0.5, cs * 0.1, cs * 0.3, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#6E4522'; ctx.beginPath(); ctx.ellipse(x + w - cs * 0.1, y + cs * 0.5, cs * 0.05, cs * 0.16, 0, 0, Math.PI * 2); ctx.fill();
        } else {
          // 차: 몸통 + 지붕(창) + 바퀴 + 전조등
          const fwd = l.dir > 0;
          ctx.fillStyle = 'rgba(0,0,0,0.30)'; FX.rr(ctx, x + cs * 0.06, y + cs * 0.26, w, cs * 0.6, cs * 0.16); ctx.fill();
          ctx.fillStyle = l.color; FX.rr(ctx, x, y + cs * 0.2, w, cs * 0.6, cs * 0.16); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.18)'; FX.rr(ctx, x + cs * 0.06, y + cs * 0.24, w - cs * 0.12, cs * 0.18, cs * 0.08); ctx.fill();
          ctx.fillStyle = 'rgba(190,235,255,0.75)';
          FX.rr(ctx, x + (fwd ? w - cs * 0.62 : cs * 0.16), y + cs * 0.3, cs * 0.46, cs * 0.34, cs * 0.08); ctx.fill();
          ctx.fillStyle = '#12161F';
          [0.18, 0.82].forEach(f2 => { ctx.beginPath(); ctx.ellipse(x + w * f2, y + cs * 0.84, cs * 0.14, cs * 0.1, 0, 0, Math.PI * 2); ctx.fill(); });
          ctx.fillStyle = '#FFE9A8'; ctx.beginPath();
          ctx.ellipse(x + (fwd ? w - cs * 0.06 : cs * 0.06), y + cs * 0.5, cs * 0.06, cs * 0.12, 0, 0, Math.PI * 2); ctx.fill();
        }
      });

      // ── 도착 칸 ──
      if (l.kind === 'home') for (let s2 = 0; s2 < 5; s2++) {
        const hx = (s2 / 4) * (FROG_COLS - 1) * cs + cs * 0.5;
        ctx.fillStyle = 'rgba(0,0,0,0.4)'; FX.rr(ctx, hx - cs * 0.44, y + cs * 0.08, cs * 0.88, cs * 0.84, cs * 0.2); ctx.fill();
        if (this.homes[s2]) { ctx.drawImage(this._fs.frog, hx - cs * 0.42, y + cs * 0.1, cs * 0.84, cs * 0.84); }
        else { ctx.strokeStyle = 'rgba(125,245,143,0.5)'; ctx.lineWidth = 2; FX.rr(ctx, hx - cs * 0.4, y + cs * 0.12, cs * 0.8, cs * 0.76, cs * 0.18); ctx.stroke(); }
      }
    });

    // ── 개구리 ──
    if (!this.gameOver && this.deathT <= 0) {
      const hop = Math.sin(this.hopT * Math.PI);
      const px2 = (this.fx + 0.5) * cs, py2 = (this.fy + 0.5) * cs - hop * cs * 0.4;
      ctx.fillStyle = 'rgba(0,0,0,' + (0.3 * (1 - hop * 0.7)).toFixed(2) + ')';
      ctx.beginPath(); ctx.ellipse(px2, (this.fy + 0.5) * cs + cs * 0.3, cs * 0.3 * (1 - hop * 0.3), cs * 0.1, 0, 0, Math.PI * 2); ctx.fill();
      const sc = 1 + hop * 0.12;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(hop > 0.15 ? this._fs.frogHop : this._fs.frog, px2 - cs * 0.5 * sc, py2 - cs * 0.5 * sc, cs * sc, cs * sc);
      ctx.imageSmoothingEnabled = true;
    } else if (this.deathT > 0) {
      const px2 = (this.fx + 0.5) * cs, py2 = (this.fy + 0.5) * cs;
      ctx.globalAlpha = this.deathT;
      ctx.fillStyle = '#FF5C7A'; ctx.beginPath(); ctx.arc(px2, py2, cs * 0.45 * (1.6 - this.deathT), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      FX.text(ctx, '✕', px2, py2, { size: cs * 0.8, weight: 800, color: '#fff', align: 'center', baseline: 'middle', shadow: 6 });
    }

    // 목숨
    for (let i = 0; i < this.lives; i++) { ctx.imageSmoothingEnabled = false; ctx.drawImage(this._fs.frog, cs * (0.15 + i * 0.6), H - cs * 0.78, cs * 0.55, cs * 0.55); ctx.imageSmoothingEnabled = true; }
    if (this.gameOver) { ctx.fillStyle = 'rgba(11,13,18,0.55)'; ctx.fillRect(0, 0, W, H); }
  }
}
