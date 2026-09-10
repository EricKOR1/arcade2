// 소행성 — 좌우로 돌고, ▲ 로 추진, 발사(꾹)로 소행성을 부수세요. 큰 소행성은 둘로 쪼개집니다. 목숨 3개.

const AST_COLS = 16, AST_ROWS = 20;

class AsteroidsGame {
  constructor(canvas, cellSize) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.cellSize = cellSize;
    this.W = AST_COLS; this.H = AST_ROWS;
    this.x = this.W / 2; this.y = this.H / 2; this.vx = 0; this.vy = 0; this.angle = -Math.PI / 2;
    this.turn = 0; this.thrust = false; this.upHeld = false; this.firing = false;
    this.bullets = []; this.rocks = []; this.parts = [];
    this.score = 0; this.lives = 3; this.wave = 1; this.gameOver = false;
    this.lastFire = 0; this.invul = 2000; this.lastTime = 0; this.now = 0;
    this.spawnWave();
  }
  spawnWave() {
    const n = 2 + this.wave;
    for (let i = 0; i < n; i++) {
      let x, y; do { x = Math.random() * this.W; y = Math.random() * this.H; } while (Math.hypot(x - this.x, y - this.y) < 5);
      const a = Math.random() * Math.PI * 2, sp = 0.02 + Math.random() * 0.02 + this.wave * 0.003;
      this.rocks.push(this.makeRock(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 3));
    }
  }
  makeRock(x, y, vx, vy, size) {
    const pts = []; const n = 9;
    for (let i = 0; i < n; i++) pts.push(0.7 + Math.random() * 0.45);
    return { x, y, vx, vy, size, r: size * 0.55, rot: Math.random() * 6, spin: (Math.random() - .5) * 0.03, pts };
  }
  move(dir) { this.turn = dir; }
  releaseSteer(dir) { if (this.turn === dir) this.turn = 0; }
  up() { this.thrust = true; }
  softDrop() {}
  rotate() { this.fire(); }
  hardDrop() { this.fire(); }
  fire() {
    const now = this.now;
    if (this.gameOver || now - this.lastFire < 220 || this.bullets.length >= 6) return;
    this.lastFire = now;
    this.bullets.push({ x: this.x + Math.cos(this.angle) * 0.6, y: this.y + Math.sin(this.angle) * 0.6, vx: Math.cos(this.angle) * 0.32 + this.vx, vy: Math.sin(this.angle) * 0.32 + this.vy, life: 55 });
    if (window.Sound) Sound.move();
  }
  wrap(o) { if (o.x < 0) o.x += this.W; if (o.x >= this.W) o.x -= this.W; if (o.y < 0) o.y += this.H; if (o.y >= this.H) o.y -= this.H; }

  tick(now) {
    this.now = now;
    if (this.gameOver) return;
    const dt = this.lastTime ? Math.min(50, now - this.lastTime) : 16.7; this.lastTime = now; const f = dt / 16.7;
    this.angle += this.turn * 0.075 * f;
    const thr = this.thrust || this.upHeld;
    if (thr) { this.vx += Math.cos(this.angle) * 0.006 * f; this.vy += Math.sin(this.angle) * 0.006 * f;
      if (Math.random() < 0.6) this.parts.push({ x: this.x - Math.cos(this.angle) * 0.5, y: this.y - Math.sin(this.angle) * 0.5, vx: -Math.cos(this.angle) * 0.08 + (Math.random() - .5) * 0.04, vy: -Math.sin(this.angle) * 0.08 + (Math.random() - .5) * 0.04, l: 1, c: '#FFD166' }); }
    this.thrust = false;
    const sp = Math.hypot(this.vx, this.vy); if (sp > 0.18) { this.vx *= 0.18 / sp; this.vy *= 0.18 / sp; }
    this.vx *= Math.pow(0.992, f); this.vy *= Math.pow(0.992, f);
    this.x += this.vx * f; this.y += this.vy * f; this.wrap(this);
    if (this.firing) this.fire();
    if (this.invul > 0) this.invul -= dt;

    this.bullets.forEach(b => { b.x += b.vx * f; b.y += b.vy * f; b.life -= f; this.wrap(b); });
    this.bullets = this.bullets.filter(b => b.life > 0);
    this.rocks.forEach(r => { r.x += r.vx * f; r.y += r.vy * f; r.rot += r.spin * f; this.wrap(r); });

    // 총알 ↔ 소행성
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      for (let j = this.rocks.length - 1; j >= 0; j--) {
        const r = this.rocks[j];
        if (Math.hypot(b.x - r.x, b.y - r.y) < r.r) {
          this.bullets.splice(i, 1); this.rocks.splice(j, 1);
          this.score += [0, 50, 30, 20][r.size];
          this.burst(r.x, r.y, 8, '#C9D1DC');
          if (r.size > 1) for (let k = 0; k < 2; k++) { const a = Math.random() * Math.PI * 2, s = 0.03 + Math.random() * 0.03; this.rocks.push(this.makeRock(r.x, r.y, Math.cos(a) * s, Math.sin(a) * s, r.size - 1)); }
          if (window.Sound) Sound.clear(1);
          break;
        }
      }
    }
    // 배 ↔ 소행성
    if (this.invul <= 0) {
      const hit = this.rocks.find(r => Math.hypot(r.x - this.x, r.y - this.y) < r.r + 0.35);
      if (hit) {
        this.lives--; this.burst(this.x, this.y, 16, '#4CC9F0');
        if (window.Sound) Sound.crash();
        if (this.lives <= 0) { this.gameOver = true; if (window.Sound) Sound.gameOver(); }
        else { this.x = this.W / 2; this.y = this.H / 2; this.vx = 0; this.vy = 0; this.invul = 2500; }
      }
    }
    if (!this.rocks.length) { this.wave++; this.score += 100 * this.wave; if (window.Sound) Sound.levelUp(); this.spawnWave(); }
    this.parts.forEach(p => { p.x += p.vx * f; p.y += p.vy * f; p.l -= 0.05 * f; });
    this.parts = this.parts.filter(p => p.l > 0);
    this.draw();
  }
  burst(x, y, n, c) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 0.03 + Math.random() * 0.08; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 1, c }); } }

  getSnapshot() {
    const g = Array.from({ length: this.H }, () => Array(this.W).fill(0));
    const put = (x, y, v) => { const cx = Math.floor(x), cy = Math.floor(y); if (cx >= 0 && cx < this.W && cy >= 0 && cy < this.H) g[cy][cx] = v; };
    this.rocks.forEach(r => { for (let dy = -r.size + 1; dy < r.size; dy++) for (let dx = -r.size + 1; dx < r.size; dx++) if (Math.hypot(dx, dy) < r.r) put(r.x + dx, r.y + dy, 45); });
    this.bullets.forEach(b => put(b.x, b.y, 27));
    put(this.x, this.y, 25);
    return g;
  }

  draw() {
    const ctx = this.ctx, cs = this.cellSize, W = this.W * cs, H = this.H * cs;
    ctx.fillStyle = '#070912'; ctx.fillRect(0, 0, W, H);
    if (!this._stars) { this._stars = Array.from({ length: 50 }, () => [Math.random() * W, Math.random() * H, 0.4 + Math.random() * 0.6]); }
    this._stars.forEach(s => { ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + s[2] * 0.5).toFixed(2) + ')'; ctx.fillRect(s[0], s[1], 1.5, 1.5); });
    // 소행성 (울퉁불퉁 다각형)
    this.rocks.forEach(r => {
      ctx.save(); ctx.translate(r.x * cs, r.y * cs); ctx.rotate(r.rot);
      ctx.beginPath();
      r.pts.forEach((k, i) => { const a = (i / r.pts.length) * Math.PI * 2, rr = r.r * k * cs; if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); });
      ctx.closePath(); ctx.fillStyle = '#4A5163'; ctx.fill(); ctx.strokeStyle = '#C9D1DC'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
    });
    // 총알
    ctx.fillStyle = '#FFD166'; this.bullets.forEach(b => { ctx.beginPath(); ctx.arc(b.x * cs, b.y * cs, cs * 0.12, 0, Math.PI * 2); ctx.fill(); });
    // 파편
    this.parts.forEach(p => { ctx.globalAlpha = Math.max(0, p.l); ctx.fillStyle = p.c; ctx.fillRect(p.x * cs - 1.5, p.y * cs - 1.5, 3, 3); }); ctx.globalAlpha = 1;
    // 배
    if (!(this.invul > 0 && Math.floor(this.invul / 120) % 2 === 0)) {
      ctx.save(); ctx.translate(this.x * cs, this.y * cs); ctx.rotate(this.angle);
      const r = cs * 0.5;
      ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(-r * 0.7, r * 0.6); ctx.lineTo(-r * 0.35, 0); ctx.lineTo(-r * 0.7, -r * 0.6); ctx.closePath();
      ctx.fillStyle = '#4CC9F0'; ctx.fill(); ctx.strokeStyle = '#E6F7FF'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
    }
    for (let i = 0; i < this.lives; i++) { ctx.save(); ctx.translate(cs * (0.7 + i * 0.7), H - cs * 0.55); ctx.rotate(-Math.PI / 2); ctx.beginPath(); ctx.moveTo(cs * .22, 0); ctx.lineTo(-cs * .16, cs * .14); ctx.lineTo(-cs * .16, -cs * .14); ctx.closePath(); ctx.fillStyle = '#4CC9F0'; ctx.fill(); ctx.restore(); }
    if (this.gameOver) { ctx.fillStyle = 'rgba(11,13,18,0.55)'; ctx.fillRect(0, 0, W, H); }
  }
}
