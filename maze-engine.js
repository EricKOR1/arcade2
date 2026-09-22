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
    // 단계별 드론 수: 1단계 2대 → 2단계 3대 → 3단계부터 4대. 출동 간격도 처음엔 길게
    const count = Math.min(4, 1 + this.level), gap = Math.max(2000, 5000 - this.level * 800);
    this.drones = [0,1,2,3].slice(0, count).map(i => ({ x: 8 + i % 3, y: 9, dir: [0,-1], home: true, out: this.now + 3000 + i * gap, dead: 0, color: ['#FF5C7A','#FFB3C6','#4CC9F0','#FFA726'][i] }));
    this.deathT = 0;
  }
  free(x, y) { if (y < 0 || y >= MZ_ROWS) return false; if (x < 0 || x >= MZ_COLS) return true; return !this.walls[y][x]; }   // 좌우 끝은 터널

  // 조작: 다음 갈림길에서 꺾도록 예약
  turn(dx, dy) { if (this.gameOver) return; this.want = [dx, dy]; this.started = true; }
  move(dir) { this.turn(dir, 0); }
  up() { this.turn(0, -1); } down() { this.turn(0, 1); }
  rotate() { this.up(); } softDrop() { if (!this._dl) { this._dl = true; this.down(); } } hardDrop() { this.up(); }

  // 목표 칸에서 모든 칸까지의 걸음 수 (터널 연결 포함). 목표 칸마다 한 번만 계산해 둡니다
  distMap(tx, ty) {
    tx = ((tx % MZ_COLS) + MZ_COLS) % MZ_COLS; ty = Math.max(0, Math.min(MZ_ROWS - 1, ty));
    const key = tx + ',' + ty; if (!this._dmaps) this._dmaps = {}; if (this._dmaps[key]) return this._dmaps[key];
    const dm = []; for (let y = 0; y < MZ_ROWS; y++) dm.push(new Array(MZ_COLS).fill(-1));
    if (!this.free(tx, ty)) { this._dmaps[key] = dm; return dm; }
    const q = [[tx, ty]]; dm[ty][tx] = 0;
    while (q.length) { const [x, y] = q.shift(); const dv = dm[y][x];
      MZ_DIRS.forEach(([dx, dy]) => { const nx = ((x + dx) % MZ_COLS + MZ_COLS) % MZ_COLS, ny = y + dy; if (ny < 0 || ny >= MZ_ROWS || dm[ny][nx] >= 0 || !this.free(nx, ny)) return; dm[ny][nx] = dv + 1; q.push([nx, ny]); }); }
    const keys = Object.keys(this._dmaps); if (keys.length > 60) delete this._dmaps[keys[0]];
    this._dmaps[key] = dm; return dm;
  }
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
    const { dt, f } = FX.frame(this, now);
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
      if (v === 2) { this.powerUntil = now + Math.max(3500, 9000 - this.level * 700); this.eatChain = 0; this.drones.forEach(d => { if (!d.dead && !d.home) d.scared = true; }); if (window.Sound) Sound.levelUp(); }
      else if (window.Sound && Math.floor(this.mouth * 2) % 2 === 0) Sound.move();
      if (this.dotsLeft <= 0) { this.level++; this.score += 500; if (window.Sound) Sound.clear(2); this.build(); this.started = false; }
    }
    if (now > this.powerUntil) this.drones.forEach(d => { d.scared = false; });

    // 드론
    this.drones.forEach((d, i) => {
      if (d.dead > 0) { d.dead -= dt; if (d.dead <= 0) { d.dead = 0; d.x = 9; d.y = 9; d.home = true; d.out = now + 2000; } return; }
      if (d.home) { if (now > d.out) { d.home = false; d.x = 9; d.y = 7; d.dir = [i % 2 ? 1 : -1, 0]; } return; }
      // 드론 속도: 1단계 로봇의 75% → 4단계쯤 로봇과 비슷 → 이후 조금 더 빠름
      const sp = (d.scared ? 0.045 : Math.min(0.086, 0.056 + (this.level - 1) * 0.008)) * f;
      const actor = { get px() { return d.x; }, set px(v) { d.x = v; }, get py() { return d.y; }, set py(v) { d.y = v; }, get dir() { return d.dir; }, set dir(v) { d.dir = v; } };
      this.stepActor(actor, sp, () => {
        const dcx = d.x, dcy = d.y;
        // 갈림길: 뒤로는 안 가고, 목표(로봇 또는 도망)에 가까운 쪽 (약간의 무작위)
        const opts = MZ_DIRS.filter(([ddx, ddy]) => !(ddx === -d.dir[0] && ddy === -d.dir[1]) && this.free(dcx + ddx, dcy + ddy) && !(dcy === 8 && dcx === 9 && ddy === 1));   // 집 문(9,8) 으로만 못 들어감 — 예전엔 8행 전체에서 아래로 못 가 드론이 위쪽에만 몰렸습니다
        if (opts.length) {
          const tx = i === 0 ? this.px : (i === 1 ? this.px + this.dir[0] * 4 : (i === 2 ? this.px - this.dir[0] * 3 : (Math.hypot(this.px - d.x, this.py - d.y) > 6 ? this.px : 1)));
          const ty = i === 0 ? this.py : (i === 1 ? this.py + this.dir[1] * 4 : (i === 2 ? this.py - this.dir[1] * 3 : (Math.hypot(this.px - d.x, this.py - d.y) > 6 ? this.py : 19)));
          // 목표까지 '실제 길 거리'(BFS) 가 짧은 쪽으로 — 직선 거리로 고르면 벽에 막혀 같은 자리를 맴돕니다
          const dm = this.distMap(Math.round(tx), Math.round(ty));
          const dd = (o) => { const x = ((dcx + o[0]) % MZ_COLS + MZ_COLS) % MZ_COLS, y = dcy + o[1]; const v = dm[y] && dm[y][x]; return (v == null || v < 0) ? 999 : v; };
          opts.sort((a, b) => d.scared ? dd(b) - dd(a) : dd(a) - dd(b));
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
      // 바닥: 아주 어두운 격자
      g.fillStyle = 'rgba(76,201,240,0.03)'; for (let y = 0; y < MZ_ROWS; y++) for (let x = 0; x < MZ_COLS; x++) if ((x + y) % 2) g.fillRect(x * cs, y * cs, cs, cs);
      // 벽: 이웃과 이어지는 네온 튜브 (블록이 아니라 선으로 보이게)
      const isW = (x, y) => y >= 0 && y < MZ_ROWS && x >= 0 && x < MZ_COLS && this.walls[y][x] && MZ_MAP[y][x] !== '=';
      const pass = (col, width, blur) => { g.strokeStyle = col; g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'round';
        if (blur) { g.shadowColor = col; g.shadowBlur = blur; } else g.shadowBlur = 0;
        for (let y = 0; y < MZ_ROWS; y++) for (let x = 0; x < MZ_COLS; x++) { if (!isW(x, y)) continue; const cx = x * cs + cs / 2, cy = y * cs + cs / 2;
          let any = false;
          if (isW(x + 1, y)) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + cs, cy); g.stroke(); any = true; }
          if (isW(x, y + 1)) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy + cs); g.stroke(); any = true; }
          if (!any && !isW(x - 1, y) && !isW(x, y - 1)) { g.beginPath(); g.arc(cx, cy, width / 2, 0, Math.PI * 2); g.fillStyle = col; g.fill(); } }
        g.shadowBlur = 0; };
      pass('rgba(59,130,246,0.35)', cs * 0.5, cs * 0.5);     // 바깥 광채
      pass('#1E3A8A', cs * 0.36, 0);                          // 튜브 본체
      pass('#60A5FA', cs * 0.12, 0);                          // 가운데 밝은 선
      // 출입문(=): 분홍 점선
      g.setLineDash([cs * 0.25, cs * 0.18]); g.strokeStyle = '#FF9AB8'; g.lineWidth = cs * 0.14; g.shadowColor = '#FF9AB8'; g.shadowBlur = cs * 0.4;
      for (let y = 0; y < MZ_ROWS; y++) for (let x = 0; x < MZ_COLS; x++) if (MZ_MAP[y][x] === '=') { g.beginPath(); g.moveTo(x * cs, y * cs + cs / 2); g.lineTo(x * cs + cs, y * cs + cs / 2); g.stroke(); }
      g.setLineDash([]); g.shadowBlur = 0;
    }
    ctx.drawImage(this._wallLayer, 0, 0);
    // 셀
    for (let y = 0; y < MZ_ROWS; y++) for (let x = 0; x < MZ_COLS; x++) {
      const v = this.dots[y][x]; if (!v) continue;
      if (v === 2) { const px = x * cs + cs / 2, py = y * cs + cs / 2, k = 0.6 + Math.sin(now / 200) * 0.35; const g2 = ctx.createRadialGradient(px, py, 0, px, py, cs * .55); g2.addColorStop(0, 'rgba(76,201,240,' + k.toFixed(2) + ')'); g2.addColorStop(0.5, 'rgba(76,201,240,0.35)'); g2.addColorStop(1, 'rgba(76,201,240,0)'); ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(px, py, cs * .55, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#E6F7FF'; ctx.beginPath(); ctx.arc(px, py, cs * .16, 0, Math.PI * 2); ctx.fill(); }
      else { ctx.fillStyle = 'rgba(255,209,102,0.35)'; ctx.beginPath(); ctx.arc(x * cs + cs / 2, y * cs + cs / 2, cs * .16, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#FFE59A'; ctx.beginPath(); ctx.arc(x * cs + cs / 2, y * cs + cs / 2, cs * .09, 0, Math.PI * 2); ctx.fill(); }
    }
    // 드론
    this.drones.forEach(d => {
      if (d.dead) return;
      const x = d.x * cs + cs / 2, y = d.y * cs + cs / 2, r = cs * .42;
      const blink = d.scared && this.powerUntil - now < 1500 && Math.floor(now / 150) % 2 === 0;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.95, r * 0.85, r * 0.25, 0, 0, Math.PI * 2); ctx.fill();
      if (!d.scared) { const g4 = ctx.createRadialGradient(x, y, 0, x, y, r * 1.5); g4.addColorStop(0, FX.tint(d.color, 0) + '55'); g4.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g4; ctx.beginPath(); ctx.arc(x, y, r * 1.5, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = d.scared ? (blink ? '#E6EAF0' : '#3B5BDB') : d.color;
      ctx.beginPath(); ctx.moveTo(x - r, y + r * .8); ctx.lineTo(x - r, y - r * .2); ctx.arc(x, y - r * .2, r, Math.PI, 0); ctx.lineTo(x + r, y + r * .8);
      for (let k = 3; k >= 0; k--) ctx.lineTo(x - r + (k + 0.5) * r / 2, y + r * .8 - ((k + Math.floor(now / 120)) % 2 ? r * .25 : 0)); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - r * .35, y - r * .3, r * .22, 0, Math.PI * 2); ctx.arc(x + r * .35, y - r * .3, r * .22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1A1D24'; ctx.beginPath(); ctx.arc(x - r * .35 + d.dir[0] * r * .1, y - r * .3 + d.dir[1] * r * .1, r * .1, 0, Math.PI * 2); ctx.arc(x + r * .35 + d.dir[0] * r * .1, y - r * .3 + d.dir[1] * r * .1, r * .1, 0, Math.PI * 2); ctx.fill();
    });
    // 잡혔을 때: 빙글 돌며 작아지는 연출 (예전엔 그냥 사라져 '캐릭터가 없어진' 것처럼 보였습니다)
    if (this.deathT > 0) {
      const x = this.px * cs + cs / 2, y = this.py * cs + cs / 2, k = this.deathT, r = cs * .44 * k;
      ctx.save(); ctx.translate(x, y); ctx.rotate((1 - k) * Math.PI * 4); ctx.globalAlpha = Math.max(0, k);
      ctx.fillStyle = '#06D6A0'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#FF5C7A'; ctx.lineWidth = 3; for (let q = 0; q < 6; q++) { const a = q / 6 * Math.PI * 2, d = cs * (1.4 - k) ; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d); ctx.stroke(); }
      ctx.restore();
      FX.text(ctx, '잡혔다!', x, y - cs * 1.2, { size: cs * 0.7, weight: 800, color: '#FF5C7A', align: 'center', shadow: 6 });
    }
    // 로봇 (둥근 청소 로봇 + 방향 라이트)
    if (this.deathT <= 0) {
      const x = this.px * cs + cs / 2, y = this.py * cs + cs / 2, r = cs * .44;
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.7, r * 0.9, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      const g3 = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6); g3.addColorStop(0, 'rgba(6,214,160,0.35)'); g3.addColorStop(1, 'rgba(6,214,160,0)'); ctx.fillStyle = g3; ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, Math.PI * 2); ctx.fill();
      const rg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); rg.addColorStop(0, '#7FF5D2'); rg.addColorStop(1, '#049C6F');
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = Math.max(1, cs * 0.05); ctx.stroke();
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
