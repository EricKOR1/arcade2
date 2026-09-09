// 스네이크 — 먹이를 먹을수록 길어지고 빨라집니다. 벽이나 몸에 부딪히면 끝.

const SNAKE_COLS = 20, SNAKE_ROWS = 20;

class SnakeGame {
  constructor(canvas, cellSize) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cellSize = cellSize;
    const cx = Math.floor(SNAKE_COLS / 2), cy = Math.floor(SNAKE_ROWS / 2);
    this.body = [[cx, cy], [cx - 1, cy], [cx - 2, cy]];   // 머리가 맨 앞
    this.dir = [1, 0];
    this.nextDir = [1, 0];
    this.queue = [];                                     // 빠른 연타를 순서대로 처리
    this.food = null;
    this.score = 0;
    this.length = 3;
    this.level = 1;
    this.gameOver = false;
    this.lastStep = 0;
    this.eatFlash = 0;
    this.placeFood();
  }

  get stepMs() { return Math.max(70, 170 - (this.level - 1) * 12); }

  placeFood() {
    const taken = {};
    this.body.forEach(([x, y]) => { taken[x + ',' + y] = 1; });
    const free = [];
    for (let y = 0; y < SNAKE_ROWS; y++)
      for (let x = 0; x < SNAKE_COLS; x++)
        if (!taken[x + ',' + y]) free.push([x, y]);
    this.food = free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }

  // 방향 바꾸기 — 반대 방향으로는 못 꺾습니다
  turn(dx, dy) {
    if (this.gameOver) return;
    const last = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
    if (last[0] === -dx && last[1] === -dy) return;
    if (last[0] === dx && last[1] === dy) return;
    if (this.queue.length < 2) this.queue.push([dx, dy]);
    if (window.Sound) Sound.move();
  }
  move(dir) { this.turn(dir, 0); }
  up()      { this.turn(0, -1); }
  down()    { this.turn(0, 1); }
  rotate()  { this.up(); }          // 키보드 ↑
  softDrop(){ this.down(); }        // ↓ 버튼 · 키보드 ↓ 누름
  hardDrop(){ this.down(); }        // 스페이스

  tick(now) {
    if (this.gameOver) return;
    if (this.softDropping && this.dir[1] !== -1 && this.dir[1] !== 1) this.turn(0, 1);
    if (now - this.lastStep >= this.stepMs) {
      this.lastStep = now;
      this.step();
    }
    if (this.eatFlash > 0) this.eatFlash -= 0.08;
    this.draw();
  }

  step() {
    if (this.queue.length) this.dir = this.queue.shift();
    const head = this.body[0];
    const nx = head[0] + this.dir[0], ny = head[1] + this.dir[1];

    // 벽 · 몸에 부딪힘
    if (nx < 0 || nx >= SNAKE_COLS || ny < 0 || ny >= SNAKE_ROWS) return this.die();
    const willGrow = this.food && nx === this.food[0] && ny === this.food[1];
    const tailIdx = this.body.length - (willGrow ? 0 : 1);
    for (let i = 0; i < tailIdx; i++)
      if (this.body[i][0] === nx && this.body[i][1] === ny) return this.die();

    this.body.unshift([nx, ny]);
    if (willGrow) {
      this.length = this.body.length;
      this.score += 10 * this.level;
      this.eatFlash = 1;
      if (window.Sound) Sound.clear(1);
      const nl = 1 + Math.floor((this.length - 3) / 5);
      if (nl > this.level) { this.level = nl; if (window.Sound) Sound.levelUp(); }
      this.placeFood();
    } else {
      this.body.pop();
    }
  }

  die() {
    this.gameOver = true;
    if (window.Sound) Sound.gameOver();
  }

  getSnapshot() {
    const g = Array.from({ length: SNAKE_ROWS }, () => Array(SNAKE_COLS).fill(0));
    this.body.forEach(([x, y], i) => { g[y][x] = i === 0 ? 14 : 13; });
    if (this.food) g[this.food[1]][this.food[0]] = 15;
    return g;
  }

  draw() {
    const ctx = this.ctx, cs = this.cellSize;
    const W = SNAKE_COLS * cs, H = SNAKE_ROWS * cs;
    // 바닥 (체크무늬) — 한 번 그려 두고 재사용
    if (!this._bg || this._bgCs !== cs) {
      this._bg = document.createElement('canvas');
      this._bg.width = W; this._bg.height = H; this._bgCs = cs;
      const g = this._bg.getContext('2d');
      g.fillStyle = '#0B0D12'; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,0.025)';
      for (let y = 0; y < SNAKE_ROWS; y++)
        for (let x = 0; x < SNAKE_COLS; x++)
          if ((x + y) % 2 === 0) g.fillRect(x * cs, y * cs, cs, cs);
    }
    ctx.drawImage(this._bg, 0, 0);

    // 먹이
    if (this.food) {
      const fx = (this.food[0] + .5) * cs, fy = (this.food[1] + .5) * cs;
      const r = cs * (0.34 + Math.sin(performance.now() / 180) * 0.04);
      ctx.fillStyle = CELL_COLORS[15];
      ctx.beginPath(); ctx.arc(fx, fy, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath(); ctx.arc(fx - r * .3, fy - r * .3, r * .3, 0, Math.PI * 2); ctx.fill();
    }

    // 몸통 — 꼬리로 갈수록 가늘고 어둡게
    const n = this.body.length;
    for (let i = n - 1; i >= 0; i--) {
      const [x, y] = this.body[i];
      const t = i / Math.max(1, n - 1);
      const pad = cs * (0.06 + t * 0.14);
      ctx.fillStyle = i === 0 ? CELL_COLORS[14] : CELL_COLORS[13];
      ctx.globalAlpha = 1 - t * 0.45;
      const r = cs * 0.28;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x * cs + pad, y * cs + pad, cs - pad * 2, cs - pad * 2, r);
      else ctx.rect(x * cs + pad, y * cs + pad, cs - pad * 2, cs - pad * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 머리의 눈
    const [hx, hy] = this.body[0];
    const ex = (hx + .5) * cs, ey = (hy + .5) * cs;
    const ox = this.dir[1] !== 0 ? cs * .18 : 0, oy = this.dir[0] !== 0 ? cs * .18 : 0;
    const fx = this.dir[0] * cs * .12, fy = this.dir[1] * cs * .12;
    ctx.fillStyle = '#0B0D12';
    [[-1, 1], [1, -1]].forEach(([a, b]) => {
      ctx.beginPath(); ctx.arc(ex + fx + ox * a, ey + fy + oy * b, cs * .09, 0, Math.PI * 2); ctx.fill();
    });

    if (this.eatFlash > 0) {
      ctx.fillStyle = 'rgba(6,214,160,' + (this.eatFlash * 0.18).toFixed(2) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    if (this.gameOver) {
      ctx.fillStyle = 'rgba(11,13,18,0.55)'; ctx.fillRect(0, 0, W, H);
    }
  }
}
