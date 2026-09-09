// 하늘 날기 — 톡 눌러 날개짓하며 기둥 사이를 통과하세요. 기둥이나 바닥에 닿으면 끝.

const FLAP_COLS = 12, FLAP_ROWS = 20;

class FlappyGame {
  constructor(canvas, cellSize) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cellSize = cellSize;
    this.x = 3;
    this.y = FLAP_ROWS / 2;
    this.vy = 0;
    this.pipes = [];
    this.score = 0;
    this.passed = 0;
    this.best = 0;
    this.gameOver = false;
    this.started = false;
    this.lastTime = 0;
    this.dist = 0;
    this.nextPipe = 8;
    this.wing = 0;
    this.clouds = Array.from({ length: 6 }, (_, i) => ({ x: i * 4 + Math.random() * 3, y: 1 + Math.random() * 8, s: 0.6 + Math.random() * 0.8 }));
  }

  get gap()   { return Math.max(4.2, 6.2 - this.passed * 0.06); }
  get speed() { return Math.min(0.13, 0.085 + this.passed * 0.002); }

  jump() {
    if (this.gameOver) return;
    this.started = true;
    this.vy = -0.30;
    this.wing = 1;
    if (window.Sound) Sound.rotate();
  }
  rotate()   { this.jump(); }
  hardDrop() { this.jump(); }
  fire()     { this.jump(); }
  move()     {}
  softDrop() {}

  tick(now) {
    if (this.gameOver) return;
    const dt = this.lastTime ? Math.min(40, now - this.lastTime) : 16.7;
    this.lastTime = now;
    const f = dt / 16.7;

    if (this.started) {
      this.vy += 0.021 * f;                       // 중력
      this.vy = Math.min(this.vy, 0.42);
      this.y += this.vy * f;
      this.dist += this.speed * f;

      // 기둥 만들기
      if (this.dist >= this.nextPipe) {
        this.nextPipe += 5.2;
        const gapY = 2.5 + Math.random() * (FLAP_ROWS - this.gap - 5);
        this.pipes.push({ x: FLAP_COLS + 1, gapY: gapY, gapH: this.gap, passed: false });
      }
      this.pipes.forEach(p => { p.x -= this.speed * f; });
      this.pipes = this.pipes.filter(p => p.x > -2);

      // 통과 · 충돌
      this.pipes.forEach(p => {
        if (!p.passed && p.x + 1 < this.x) {
          p.passed = true; this.passed++; this.score += 10;
          if (window.Sound) Sound.clear(1);
        }
        const inX = this.x + 0.42 > p.x && this.x - 0.42 < p.x + 1;
        const inGap = this.y - 0.36 > p.gapY && this.y + 0.36 < p.gapY + p.gapH;
        if (inX && !inGap) this.die();
      });
      if (this.y + 0.4 >= FLAP_ROWS - 1 || this.y < -1) this.die();
    } else {
      this.y = FLAP_ROWS / 2 + Math.sin(now / 300) * 0.4;   // 시작 전 둥실둥실
    }
    this.clouds.forEach(c => { c.x -= 0.012 * c.s * f; if (c.x < -3) c.x = FLAP_COLS + 2; });
    if (this.wing > 0) this.wing -= 0.08 * f;
    this.draw();
  }

  die() {
    if (this.gameOver) return;
    this.gameOver = true;
    if (window.Sound) { Sound.crash(); Sound.gameOver(); }
  }

  getSnapshot() {
    const g = Array.from({ length: FLAP_ROWS }, () => Array(FLAP_COLS).fill(0));
    this.pipes.forEach(p => {
      const c = Math.round(p.x);
      if (c < 0 || c >= FLAP_COLS) return;
      for (let y = 0; y < FLAP_ROWS - 1; y++)
        if (y < p.gapY || y >= p.gapY + p.gapH) g[y][c] = 24;
    });
    for (let x = 0; x < FLAP_COLS; x++) g[FLAP_ROWS - 1][x] = 12;
    const bx = Math.max(0, Math.min(FLAP_COLS - 1, Math.round(this.x)));
    const by = Math.max(0, Math.min(FLAP_ROWS - 1, Math.round(this.y)));
    g[by][bx] = 23;
    return g;
  }

  draw() {
    const ctx = this.ctx, cs = this.cellSize;
    const W = FLAP_COLS * cs, H = FLAP_ROWS * cs;

    // 하늘
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1B2A4A'); sky.addColorStop(1, '#3B5B8F');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

    // 구름
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    this.clouds.forEach(c => {
      const x = c.x * cs, y = c.y * cs, r = cs * c.s;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2); ctx.arc(x + r, y - r * .3, r * .8, 0, Math.PI * 2);
      ctx.arc(x + r * 1.9, y, r * .7, 0, Math.PI * 2); ctx.fill();
    });

    // 기둥
    this.pipes.forEach(p => {
      const px = p.x * cs, pw = cs;
      const topH = p.gapY * cs, botY = (p.gapY + p.gapH) * cs;
      [[0, topH], [botY, H - cs - botY]].forEach(([y, h]) => {
        if (h <= 0) return;
        const g = ctx.createLinearGradient(px, 0, px + pw, 0);
        g.addColorStop(0, '#0AA57C'); g.addColorStop(0.5, '#06D6A0'); g.addColorStop(1, '#078F6C');
        ctx.fillStyle = g; ctx.fillRect(px, y, pw, h);
        // 끝단 테두리
        ctx.fillStyle = '#0AA57C';
        const capY = (y === 0) ? topH - cs * .5 : botY;
        ctx.fillRect(px - cs * .12, capY, pw + cs * .24, cs * .5);
      });
    });

    // 땅
    ctx.fillStyle = '#5B4636'; ctx.fillRect(0, H - cs, W, cs);
    ctx.fillStyle = '#7BA05B'; ctx.fillRect(0, H - cs, W, cs * .25);

    // 새
    const bx = this.x * cs, by = this.y * cs;
    const tilt = Math.max(-0.5, Math.min(0.9, this.vy * 3));
    ctx.save(); ctx.translate(bx, by); ctx.rotate(tilt);
    ctx.fillStyle = CELL_COLORS[23];
    ctx.beginPath(); ctx.ellipse(0, 0, cs * .42, cs * .34, 0, 0, Math.PI * 2); ctx.fill();
    // 날개
    ctx.fillStyle = '#F5A524';
    ctx.beginPath();
    ctx.ellipse(-cs * .08, cs * .05 - this.wing * cs * .18, cs * .26, cs * .16, -0.4, 0, Math.PI * 2);
    ctx.fill();
    // 눈 · 부리
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cs * .16, -cs * .1, cs * .12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0B0D12'; ctx.beginPath(); ctx.arc(cs * .2, -cs * .1, cs * .06, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#EF476F';
    ctx.beginPath(); ctx.moveTo(cs * .4, -cs * .02); ctx.lineTo(cs * .62, cs * .06); ctx.lineTo(cs * .4, cs * .14); ctx.closePath(); ctx.fill();
    ctx.restore();

    if (!this.started && !this.gameOver) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '600 ' + Math.round(cs * .68) + 'px Pretendard, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('점프를 눌러 시작', W / 2, H * .3);
      ctx.textAlign = 'left';
    }
    if (this.gameOver) { ctx.fillStyle = 'rgba(11,13,18,0.5)'; ctx.fillRect(0, 0, W, H); }
  }
}
