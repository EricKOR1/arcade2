// 우주 방어 — 좌우로 움직이며 내려오는 적을 쏘세요. 적이 바닥에 닿거나 부딪히면 목숨이 줄어듭니다.

const SHOT_COLS = 12, SHOT_ROWS = 20;

class ShooterGame {
  constructor(canvas, cellSize) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cellSize = cellSize;
    this.x = SHOT_COLS / 2;
    this.y = SHOT_ROWS - 1.6;
    this.steer = 0;
    this.bullets = [];
    this.enemyShots = [];
    this.enemies = [];
    this.parts = [];
    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.gameOver = false;
    this.firing = false;
    this.lastFire = 0;
    this.lastTime = 0;
    this.invul = 0;
    this.stars = Array.from({ length: 40 }, () => ({ x: Math.random() * SHOT_COLS, y: Math.random() * SHOT_ROWS, s: 0.3 + Math.random() * 0.7 }));
    this.spawnWave();
  }

  spawnWave() {
    const rows = Math.min(5, 2 + Math.floor(this.wave / 2));
    const cols = Math.min(8, 5 + Math.floor(this.wave / 3));
    const x0 = (SHOT_COLS - cols) / 2 + 0.5;
    this.enemies = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        this.enemies.push({ x: x0 + c, y: 1.2 + r * 1.1, hp: (r === 0 && this.wave >= 3) ? 2 : 1, kind: r % 3 });
    this.dir = 1;
    this.speed = 0.012 + this.wave * 0.004;
    this.dropTimer = 0;
  }

  move(dir) { this.steer = dir; }
  releaseSteer(dir) { if (this.steer === dir) this.steer = 0; }
  fire() { this.shoot(performance.now()); }
  hardDrop() { this.shoot(performance.now()); }
  rotate() { this.shoot(performance.now()); }
  softDrop() { this.firing = true; }

  shoot(now) {
    if (this.gameOver) return;
    if (now - this.lastFire < 220) return;
    this.lastFire = now;
    this.bullets.push({ x: this.x, y: this.y - 0.6, vy: -0.42 });
    if (window.Sound) Sound.move();
  }

  tick(now) {
    if (this.gameOver) return;
    const dt = this.lastTime ? Math.min(40, now - this.lastTime) : 16.7;
    this.lastTime = now;
    const f = dt / 16.7;

    // 내 우주선
    this.x += this.steer * 0.26 * f;
    this.x = Math.max(0.5, Math.min(SHOT_COLS - 0.5, this.x));
    if (this.firing || this.softDropping) this.shoot(now);
    if (this.invul > 0) this.invul -= dt;

    // 내 총알
    this.bullets.forEach(b => { b.y += b.vy * f; });
    this.bullets = this.bullets.filter(b => b.y > -1);

    // 적 무리 — 좌우로 왔다 갔다 하다가 벽에 닿으면 한 칸 내려옵니다
    if (this.enemies.length) {
      let minX = Infinity, maxX = -Infinity;
      this.enemies.forEach(e => { minX = Math.min(minX, e.x); maxX = Math.max(maxX, e.x); });
      const sp = this.speed * (1 + (1 - this.enemies.length / 40) * 1.6);   // 적이 줄수록 빨라짐
      if ((this.dir > 0 && maxX + 0.5 >= SHOT_COLS) || (this.dir < 0 && minX - 0.5 <= 0)) {
        this.dir = -this.dir;
        this.enemies.forEach(e => { e.y += 0.5; });
      } else {
        this.enemies.forEach(e => { e.x += this.dir * sp * f; });
      }
      // 적의 공격
      if (Math.random() < 0.012 * f * (1 + this.wave * 0.15)) {
        const e = this.enemies[Math.floor(Math.random() * this.enemies.length)];
        this.enemyShots.push({ x: e.x, y: e.y + 0.5, vy: 0.14 + this.wave * 0.01 });
      }
    } else {
      this.wave++;
      this.score += 50 * this.wave;
      if (window.Sound) Sound.levelUp();
      this.spawnWave();
    }
    this.enemyShots.forEach(s => { s.y += s.vy * f; });
    this.enemyShots = this.enemyShots.filter(s => s.y < SHOT_ROWS + 1);

    // 총알 ↔ 적
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        if (Math.abs(b.x - e.x) < 0.5 && Math.abs(b.y - e.y) < 0.5) {
          this.bullets.splice(i, 1);
          e.hp--;
          if (e.hp <= 0) {
            this.enemies.splice(j, 1);
            this.score += 10 + e.kind * 5;
            this.burst(e.x, e.y, CELL_COLORS[26]);
            if (window.Sound) Sound.clear(1);
          } else if (window.Sound) Sound.lock();
          break;
        }
      }
    }

    // 피격
    if (this.invul <= 0) {
      let hit = false;
      for (let i = this.enemyShots.length - 1; i >= 0; i--) {
        const s = this.enemyShots[i];
        if (Math.abs(s.x - this.x) < 0.45 && Math.abs(s.y - this.y) < 0.5) { this.enemyShots.splice(i, 1); hit = true; }
      }
      this.enemies.forEach(e => {
        if (Math.abs(e.x - this.x) < 0.7 && Math.abs(e.y - this.y) < 0.7) hit = true;
        if (e.y >= this.y) hit = true;                       // 바닥까지 내려옴
      });
      if (hit) this.hurt();
    }

    this.parts.forEach(p => { p.x += p.vx * f; p.y += p.vy * f; p.l -= 0.04 * f; });
    this.parts = this.parts.filter(p => p.l > 0);
    this.stars.forEach(s => { s.y += 0.02 * s.s * f; if (s.y > SHOT_ROWS) s.y -= SHOT_ROWS; });
    this.draw();
  }

  hurt() {
    this.lives--;
    this.invul = 1500;
    this.burst(this.x, this.y, CELL_COLORS[25]);
    if (window.Sound) Sound.crash();
    if (this.lives <= 0) { this.gameOver = true; if (window.Sound) Sound.gameOver(); return; }
    // 너무 내려온 적은 살짝 밀어 올림
    this.enemies.forEach(e => { e.y = Math.min(e.y, this.y - 4); });
    this.enemyShots = [];
  }

  burst(x, y, color) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2, v = 0.05 + Math.random() * 0.12;
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 1, c: color });
    }
  }

  getSnapshot() {
    const g = Array.from({ length: SHOT_ROWS }, () => Array(SHOT_COLS).fill(0));
    const put = (x, y, v) => {
      const cx = Math.round(x), cy = Math.round(y);
      if (cx >= 0 && cx < SHOT_COLS && cy >= 0 && cy < SHOT_ROWS) g[cy][cx] = v;
    };
    this.enemies.forEach(e => put(e.x, e.y, 26));
    this.bullets.forEach(b => put(b.x, b.y, 27));
    this.enemyShots.forEach(s => put(s.x, s.y, 28));
    put(this.x, this.y, 25);
    return g;
  }

  draw() {
    const ctx = this.ctx, cs = this.cellSize;
    const W = SHOT_COLS * cs, H = SHOT_ROWS * cs;
    ctx.fillStyle = '#070912'; ctx.fillRect(0, 0, W, H);

    // 별
    this.stars.forEach(s => {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + s.s * 0.5).toFixed(2) + ')';
      ctx.fillRect(s.x * cs, s.y * cs, cs * 0.08 * s.s + 1, cs * 0.08 * s.s + 1);
    });

    // 적
    this.enemies.forEach(e => {
      const x = e.x * cs, y = e.y * cs, r = cs * 0.38;
      ctx.fillStyle = e.hp > 1 ? '#B15DFF' : CELL_COLORS[26];
      ctx.beginPath();
      if (e.kind === 0) { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r * .6); ctx.lineTo(x - r, y + r * .6); }
      else if (e.kind === 1) { ctx.rect(x - r * .8, y - r * .6, r * 1.6, r * 1.2); }
      else { ctx.arc(x, y, r * .8, 0, Math.PI * 2); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(x - r * .35, y - r * .1, r * .25, r * .25); ctx.fillRect(x + r * .1, y - r * .1, r * .25, r * .25);
    });

    // 총알
    ctx.fillStyle = CELL_COLORS[27];
    this.bullets.forEach(b => ctx.fillRect(b.x * cs - cs * .06, b.y * cs - cs * .3, cs * .12, cs * .6));
    ctx.fillStyle = CELL_COLORS[28];
    this.enemyShots.forEach(s => { ctx.beginPath(); ctx.arc(s.x * cs, s.y * cs, cs * .12, 0, Math.PI * 2); ctx.fill(); });

    // 내 우주선
    if (!(this.invul > 0 && Math.floor(this.invul / 100) % 2 === 0)) {
      const x = this.x * cs, y = this.y * cs, r = cs * 0.5;
      ctx.fillStyle = CELL_COLORS[25];
      ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * .8, y + r * .7); ctx.lineTo(x, y + r * .35); ctx.lineTo(x - r * .8, y + r * .7); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath(); ctx.arc(x, y - r * .15, r * .18, 0, Math.PI * 2); ctx.fill();
      // 엔진 불꽃
      ctx.fillStyle = 'rgba(255,209,102,' + (0.5 + Math.random() * 0.4).toFixed(2) + ')';
      ctx.beginPath(); ctx.moveTo(x - r * .25, y + r * .5); ctx.lineTo(x + r * .25, y + r * .5); ctx.lineTo(x, y + r * (0.9 + Math.random() * 0.4)); ctx.closePath(); ctx.fill();
    }

    // 파편
    this.parts.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.l); ctx.fillStyle = p.c;
      ctx.fillRect(p.x * cs - 2, p.y * cs - 2, 4, 4);
    });
    ctx.globalAlpha = 1;

    // 목숨
    for (let i = 0; i < this.lives; i++) {
      ctx.fillStyle = CELL_COLORS[25];
      const x = cs * (0.6 + i * 0.7), y = H - cs * .45, r = cs * .18;
      ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r); ctx.lineTo(x - r, y + r); ctx.closePath(); ctx.fill();
    }
    if (this.gameOver) { ctx.fillStyle = 'rgba(11,13,18,0.55)'; ctx.fillRect(0, 0, W, H); }
  }
}
