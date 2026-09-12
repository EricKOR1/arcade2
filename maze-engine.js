// 미로 추격 — 청소 로봇으로 미로의 에너지 셀을 모두 모으세요. 순찰 드론 넷이 쫓아옵니다.
// 파란 파워 셀을 먹으면 잠깐 드론을 잡을 수 있습니다. 목숨 3개.

const MZ_MAP = [
  '###################',
  '#........#........#',
  '#o##.###.#.###.##o#',
  '#.................#',
  '#.##.#.#####.#.##.#',
  '#....#...#...#....#',
  '####.###.#.###.####',
  '   #.#.......#.#   ',
  '####.#.##=##.#.####',
  '.......#GGG#.......',
  '####.#.#####.#.####',
  '   #.#.......#.#   ',
  '####.#.#####.#.####',
  '#........#........#',
  '#.##.###.#.###.##.#',
  '#o.#.....P.....#.o#',
  '##.#.#.#####.#.#.##',
  '#....#...#...#....#',
  '#.######.#.######.#',
  '#.................#',
  '###################'
];
const MZ_COLS = 19, MZ_ROWS = 21;
const MZ_DIRS = [[1,0],[-1,0],[0,1],[0,-1]];

class MazeGame {
  constructor(canvas, cellSize) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.cellSize = cellSize;
    this.score = 0; this.lives = 3; this.level = 1; this.gameOver = false;
    this.lastTime = 0; this.now = 0; this.started = false;
    this.build();
  }
  build() {
    this.walls = MZ_MAP.map(r => r.split('').map(c => c === '#' || c === '='));
    this.dots = MZ_MAP.map(r => r.split('').map(c => c === '.' ? 1 : (c === 'o' ? 2 : 0)));
    this.dotsLeft = 0; this.dots.forEach(r => r.forEach(v => { if (v) this.dotsLeft++; }));
    this.resetActors();
    this.powerUntil = 0; this.eatChain = 0;
  }
  resetActors() {
    this.px = 9; this.py = 15; this.dir = [0,0]; this.want = [0,0]; this.mouth = 0;
    this.drones = [0,1,2,3].map(i => ({ x: 8 + i % 3, y: 9, dir: [0,-1], home: true, out: this.now + 1500 + i * 2500, dead: 0, color: ['#FF5C7A','#FFB3C6','#4CC9F0','#FFA726'][i] }));
    this.deathT = 0;
  }
  free(x, y) { if (y < 0 || y >= MZ_ROWS) return false; if (x < 0 || x >= MZ_COLS) return true; return !this.walls[y][x]; }   // 좌우 끝은 터널

  // 조작: 다음 갈림길에서 꺾도록 예약
  turn(dx, dy) { if (this.gameOver) return; this.want = [dx, dy]; this.started = true; }
  move(dir) { this.turn(dir, 0); }
  up() { this.turn(0, -1); } down() { this.turn(0, 1); }
  rotate() { this.up(); } softDrop() { if (!this._dl) { this._dl = true; this.down(); } } hardDrop() { this.up(); }

  get speed() { return 0.075 + (this.level - 1) * 0.008; }

  // 격자 이동 공통: 이번 프레임에 칸 중심을 만나면 거기서 방향을 정하고 남은 거리만큼 더 갑니다
  stepActor(a, step, decide) {
    let left = step, guard = 0;
    while (left > 0 && guard++ < 4) {
      const moving = a.dir[0] || a.dir[1];
      const cx = Math.round(a.px), cy = Math.round(a.py);
      const dist = moving ? (a.dir[0] ? Math.abs(cx - a.px) : Math.abs(cy - a.py)) : 0;
      const towardCenter = !moving || ((cx - a.px) * a.dir[0] + (cy - a.py) * a.dir[1]) >= 0 || dist < 1e-6;
      if (dist <= left && towardCenter) {                 // 이번 걸음에 중심 도달
        a.px = cx; a.py = cy; left -= dist;
        decide();
        if (!(a.dir[0] || a.dir[1])) return;
        // 중심에서 새 방향으로 아주 조금 떠나야 다음 루프가 같은 중심을 다시 잡지 않음
        const nudge = Math.min(left, 1e-3); a.px += a.dir[0] * nudge; a.py += a.dir[1] * nudge; left -= nudge;
      } else { a.px += a.dir[0] * left; a.py += a.dir[1] * left; left = 0; }
    }
  }

  tick(now) {
    this.now = now;
    if (this.gameOver) return;
    const dt = this.lastTime ? Math.min(50, now - this.lastTime) : 16.7; this.lastTime = now; const f = dt / 16.7;
    if (!this.softDropping) this._dl = false;
    if (this.deathT > 0) { this.deathT -= 0.025 * f; if (this.deathT <= 0) { this.deathT = 0; this.resetActors(); this.started = false; } this.draw(); return; }
    if (!this.started) { this.draw(); return; }

    // 로봇 이동 — 칸 중심을 지나는 프레임에 방향을 정합니다 (되돌아 붙는 진동 없음)
    this.stepActor(this, this.speed * f, () => {
      const cx = this.px, cy = this.py;
      if ((this.want[0] || this.want[1]) && this.free(cx + this.want[0], cy + this.want[1])) this.dir = this.want.slice();
      if (!this.free(cx + this.dir[0], cy + this.dir[1])) this.dir = [0,0];
    });
    if (this.dir[0] || this.dir[1]) this.mouth += 0.25 * f;
    if (this.px < -1) this.px = MZ_COLS; if (this.px > MZ_COLS) this.px = -1;              // 터널
    // 셀 먹기
    const gx = Math.round(this.px), gy = Math.round(this.py);
    if (gx >= 0 && gx < MZ_COLS && this.dots[gy] && this.dots[gy][gx]) {
      const v = this.dots[gy][gx]; this.dots[gy][gx] = 0; this.dotsLeft--;
      this.score += v === 2 ? 50 : 10;
      if (v === 2) { this.powerUntil = now + Math.max(3000, 7000 - this.level * 600); this.eatChain = 0; this.drones.forEach(d => { if (!d.dead && !d.home) d.scared = true; }); if (window.Sound) Sound.levelUp(); }
      else if (window.Sound && Math.floor(this.mouth * 2) % 2 === 0) Sound.move();
      if (this.dotsLeft <= 0) { this.level++; this.score += 500; if (window.Sound) Sound.clear(2); this.build(); this.started = false; }
    }
    if (now > this.powerUntil) this.drones.forEach(d => { d.scared = false; });

    // 드론
    this.drones.forEach((d, i) => {
      if (d.dead > 0) { d.dead -= dt; if (d.dead <= 0) { d.dead = 0; d.x = 9; d.y = 9; d.home = true; d.out = now + 2000; } return; }
      if (d.home) { if (now > d.out) { d.home = false; d.x = 9; d.y = 7; d.dir = [i % 2 ? 1 : -1, 0]; } return; }
      const sp = (d.scared ? 0.045 : 0.068 + (this.level - 1) * 0.006) * f;
      const actor = { get px() { return d.x; }, set px(v) { d.x = v; }, get py() { return d.y; }, set py(v) { d.y = v; }, get dir() { return d.dir; }, set dir(v) { d.dir = v; } };
      this.stepActor(actor, sp, () => {
        const dcx = d.x, dcy = d.y;
        // 갈림길: 뒤로는 안 가고, 목표(로봇 또는 도망)에 가까운 쪽 (약간의 무작위)
        const opts = MZ_DIRS.filter(([ddx, ddy]) => !(ddx === -d.dir[0] && ddy === -d.dir[1]) && this.free(dcx + ddx, dcy + ddy) && !(dcy === 8 && ddy === 1));
        if (opts.length) {
          const tx = i === 0 ? this.px : (i === 1 ? this.px + this.dir[0] * 4 : (i === 2 ? this.px - this.dir[0] * 3 : (Math.hypot(this.px - d.x, this.py - d.y) > 6 ? this.px : 1)));
          const ty = i === 0 ? this.py : (i === 1 ? this.py + this.dir[1] * 4 : (i === 2 ? this.py - this.dir[1] * 3 : (Math.hypot(this.px - d.x, this.py - d.y) > 6 ? this.py : 19)));
          opts.sort((a, b) => { const da = Math.hypot(dcx + a[0] - tx, dcy + a[1] - ty), db = Math.hypot(dcx + b[0] - tx, dcy + b[1] - ty); return d.scared ? db - da : da - db; });
          d.dir = (Math.random() < 0.15 && opts.length > 1) ? opts[1] : opts[0];
        } else d.dir = [-d.dir[0], -d.dir[1]];
      });
      if (d.x < -1) d.x = MZ_COLS; if (d.x > MZ_COLS) d.x = -1;
      // 충돌
      if (Math.hypot(d.x - this.px, d.y - this.py) < 0.7) {
        if (d.scared) { d.dead = 1500; d.scared = false; this.eatChain++; this.score += 200 * this.eatChain; if (window.Sound) Sound.clear(1); }
        else { this.lives--; this.deathT = 1; if (window.Sound) Sound.crash(); if (this.lives <= 0) { this.gameOver = true; if (window.Sound) Sound.gameOver(); } }
      }
    });
    this.draw();
  }

  getSnapshot() {
    const g = MZ_MAP.map((r, y) => r.split('').map((c, x) => this.walls[y][x] ? 46 : (this.dots[y][x] === 2 ? 48 : (this.dots[y][x] ? 47 : 0))));
    const put = (x, y, v) => { const cx = Math.round(x), cy = Math.round(y); if (cx >= 0 && cx < MZ_COLS && cy >= 0 && cy < MZ_ROWS) g[cy][cx] = v; };
    this.drones.forEach(d => { if (!d.dead) put(d.x, d.y, d.scared ? 50 : 49); });
    put(this.px, this.py, 23);
    return g;
  }

  draw() {
    const ctx = this.ctx, cs = this.cellSize, W = MZ_COLS * cs, H = MZ_ROWS * cs, now = this.now;
    ctx.fillStyle = '#070912'; ctx.fillRect(0, 0, W, H);
    // 벽 — 둥근 네온 블록
    if (!this._wallLayer || this._wcs !== cs) {
      this._wallLayer = document.createElement('canvas'); this._wallLayer.width = W; this._wallLayer.height = H; this._wcs = cs;
      const g = this._wallLayer.getContext('2d');
      for (let y = 0; y < MZ_ROWS; y++) for (let x = 0; x < MZ_COLS; x++) if (this.walls[y][x]) {
        const gate = MZ_MAP[y][x] === '=';
        g.fillStyle = gate ? '#FF9AB8' : '#1E3A8A'; g.fillRect(x * cs + 1, y * cs + 1, cs - 2, cs - 2);
        g.fillStyle = gate ? '#FFC0D3' : '#3B82F6'; g.fillRect(x * cs + cs * .25, y * cs + cs * .25, cs * .5, cs * .5);
      }
    }
    ctx.drawImage(this._wallLayer, 0, 0);
    // 셀
    for (let y = 0; y < MZ_ROWS; y++) for (let x = 0; x < MZ_COLS; x++) {
      const v = this.dots[y][x]; if (!v) continue;
      if (v === 2) { ctx.fillStyle = 'rgba(76,201,240,' + (0.6 + Math.sin(now / 200) * 0.35).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(x * cs + cs / 2, y * cs + cs / 2, cs * .3, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.fillStyle = '#FFD166'; ctx.fillRect(x * cs + cs / 2 - cs * .08, y * cs + cs / 2 - cs * .08, cs * .16, cs * .16); }
    }
    // 드론
    this.drones.forEach(d => {
      if (d.dead) return;
      const x = d.x * cs + cs / 2, y = d.y * cs + cs / 2, r = cs * .42;
      const blink = d.scared && this.powerUntil - now < 1500 && Math.floor(now / 150) % 2 === 0;
      ctx.fillStyle = d.scared ? (blink ? '#E6EAF0' : '#3B5BDB') : d.color;
      ctx.beginPath(); ctx.moveTo(x - r, y + r * .8); ctx.lineTo(x - r, y - r * .2); ctx.arc(x, y - r * .2, r, Math.PI, 0); ctx.lineTo(x + r, y + r * .8);
      for (let k = 3; k >= 0; k--) ctx.lineTo(x - r + (k + 0.5) * r / 2, y + r * .8 - ((k + Math.floor(now / 120)) % 2 ? r * .25 : 0)); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - r * .35, y - r * .3, r * .22, 0, Math.PI * 2); ctx.arc(x + r * .35, y - r * .3, r * .22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1A1D24'; ctx.beginPath(); ctx.arc(x - r * .35 + d.dir[0] * r * .1, y - r * .3 + d.dir[1] * r * .1, r * .1, 0, Math.PI * 2); ctx.arc(x + r * .35 + d.dir[0] * r * .1, y - r * .3 + d.dir[1] * r * .1, r * .1, 0, Math.PI * 2); ctx.fill();
    });
    // 로봇 (둥근 청소 로봇 + 방향 라이트)
    if (this.deathT <= 0) {
      const x = this.px * cs + cs / 2, y = this.py * cs + cs / 2, r = cs * .44;
      ctx.fillStyle = '#06D6A0'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0B0D12'; ctx.beginPath(); ctx.arc(x, y, r * .55, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#9BF6E0'; ctx.beginPath(); ctx.arc(x, y, r * .28 + Math.sin(this.mouth) * r * .08, 0, Math.PI * 2); ctx.fill();
      if (this.dir[0] || this.dir[1]) { ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.arc(x + this.dir[0] * r * .85, y + this.dir[1] * r * .85, r * .18, 0, Math.PI * 2); ctx.fill(); }
    } else {
      const x = this.px * cs + cs / 2, y = this.py * cs + cs / 2;
      ctx.strokeStyle = 'rgba(6,214,160,' + this.deathT.toFixed(2) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, cs * (1 - this.deathT) * 1.2, 0, Math.PI * 2); ctx.stroke();
    }
    for (let i = 0; i < this.lives; i++) { ctx.fillStyle = '#06D6A0'; ctx.beginPath(); ctx.arc(cs * (0.6 + i * 0.6), H - cs * 0.5, cs * .18, 0, Math.PI * 2); ctx.fill(); }
    if (!this.started && !this.gameOver && this.deathT <= 0) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = '700 ' + Math.round(cs * .8) + 'px Pretendard, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('방향키를 누르면 출발', W / 2, cs * 11.6); ctx.textAlign = 'left'; }
    if (this.gameOver) { ctx.fillStyle = 'rgba(11,13,18,0.55)'; ctx.fillRect(0, 0, W, H); }
  }
}
