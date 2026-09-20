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

    this.parts = FX.stepParts(this.parts, f, 0.04);
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

  buildSprites(cs) {
    const pal = { s: '#4CC9F0', S: '#2AA3CC', d: '#155E78', w: '#FFFFFF', y: '#FFD166', o: '#FF7A3D', k: '#12303F' };
    const ship = [
      '.......ss.......','.......ss.......','......ssss......','......swws......','.....sSwwSs.....','.....sSwwSs.....','....ssSSSSss....','...sssSSSSsss...',
      '..ssSSSssSSSss..','..sSSSS..SSSSs..','.ssSSS....SSSss.','.sSSS......SSSs.','.dd..d....d..dd.','.....dd..dd.....','......oyyo......','.......yy.......'];
    const ep = { a: '#B15DFF', A: '#D9B3FF', d: '#5B3AAF', w: '#FFFFFF', k: '#1A1D24', r: '#FF5C7A', R: '#FFB3C6', g: '#06D6A0', G: '#9AF0D1' };
    // 적 3종: 삼각(정찰기) · 사각(전투기) · 원(보스급)
    const e0 = ['................','................','.......rr.......','......rRRr......','.....rRRRRr.....','....rRRwwRRr....','...rRRRwwRRRr...','..rRRRRRRRRRRr..',
                '.rRRRRRRRRRRRRr.','.rrrRRRRRRRRrrr.','...rrrRRRRrrr...','.....rrRRrr.....','.......rr.......','................','................','................'];
    const e1 = ['................','..a..........a..','..aa........aa..','..aaaAAAAAAaaa..','..aAAAAAAAAAAa..','.aaAAwwAAwwAAaa.','.aAAAkwAAkwAAAa.','.aAAAAAAAAAAAAa.',
                '.aAAAAAAAAAAAAa.','..aAAAAAAAAAAa..','..aaaAAAAAAaaa..','....a.a..a.a....','....d.d..d.d....','................','................','................'];
    const e2 = ['................','......gggg......','....ggGGGGgg....','...gGGGGGGGGg...','..gGGwwGGwwGGg..','..gGGkwGGkwGGg..','.gGGGGGGGGGGGGg.','.gGGGGkkkkGGGGg.',
                '.gGGGkGGGGkGGGg.','..gGGGGGGGGGGg..','..gGGGGGGGGGGg..','...gGGGGGGGGg...','....ggGGGGgg....','......gggg......','................','................'];
    this._ss = { ship: FX.sprite(ship, pal, cs * 1.2), e: [FX.sprite(e0, ep, cs), FX.sprite(e1, ep, cs), FX.sprite(e2, ep, cs)] };
    this._ssCs = cs;
  }

  draw() {
    const ctx = this.ctx, cs = this.cellSize;
    const W = SHOT_COLS * cs, H = SHOT_ROWS * cs, now = this.now || 0;
    if (!this._ss || this._ssCs !== cs) this.buildSprites(cs);
    const SP = this._ss;
    // 우주 배경: 그라데이션 + 성운
    const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#05070F'); bg.addColorStop(0.6, '#0B1024'); bg.addColorStop(1, '#141A33');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const neb = ctx.createRadialGradient(W * 0.7, H * 0.35, 0, W * 0.7, H * 0.35, W * 0.7);
    neb.addColorStop(0, 'rgba(177,93,255,0.16)'); neb.addColorStop(1, 'rgba(177,93,255,0)'); ctx.fillStyle = neb; ctx.fillRect(0, 0, W, H);
    this.stars.forEach(s2 => { ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + s2.s * 0.5).toFixed(2) + ')'; ctx.fillRect(s2.x * cs, s2.y * cs, cs * 0.08 * s2.s + 1, cs * 0.08 * s2.s + 1); });

    ctx.imageSmoothingEnabled = false;
    // 적: 스프라이트 + 강한 적은 보라 광채
    this.enemies.forEach(e => { const x = e.x * cs, y = e.y * cs, k = Math.min(2, e.kind | 0);
      if (e.hp > 1) { const g = ctx.createRadialGradient(x, y, 0, x, y, cs * 0.7); g.addColorStop(0, 'rgba(177,93,255,0.35)'); g.addColorStop(1, 'rgba(177,93,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, cs * 0.7, 0, Math.PI * 2); ctx.fill(); }
      const bob = Math.sin(now / 300 + e.x * 2) * cs * 0.04;
      ctx.drawImage(SP.e[k], x - cs * 0.5, y - cs * 0.5 + bob, cs, cs); });
    // 내 탄: 빛나는 레이저
    this.bullets.forEach(b => { const bx = b.x * cs, by = b.y * cs;
      const g = ctx.createLinearGradient(bx, by - cs * 0.4, bx, by + cs * 0.3); g.addColorStop(0, 'rgba(76,201,240,0)'); g.addColorStop(0.6, '#9DE9FF'); g.addColorStop(1, '#FFFFFF');
      ctx.fillStyle = g; FX.rr(ctx, bx - cs * 0.07, by - cs * 0.4, cs * 0.14, cs * 0.7, cs * 0.07); ctx.fill();
      ctx.fillStyle = 'rgba(76,201,240,0.25)'; ctx.beginPath(); ctx.arc(bx, by, cs * 0.22, 0, Math.PI * 2); ctx.fill(); });
    // 적 탄: 빨간 구체
    this.enemyShots.forEach(s2 => { const sx = s2.x * cs, sy = s2.y * cs;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, cs * 0.3); g.addColorStop(0, '#FFE1E8'); g.addColorStop(0.4, '#FF5C7A'); g.addColorStop(1, 'rgba(255,92,122,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, cs * 0.3, 0, Math.PI * 2); ctx.fill(); });
    // 내 우주선: 스프라이트 + 엔진 불꽃 + 실드 링(무적)
    if (!(this.invul > 0 && Math.floor(this.invul / 100) % 2 === 0)) {
      const x = this.x * cs, y = this.y * cs, sw = cs * 1.2;
      const fl = 0.7 + Math.random() * 0.5;
      const fg = ctx.createLinearGradient(x, y + sw * 0.3, x, y + sw * 0.3 + cs * 0.7 * fl); fg.addColorStop(0, '#FFF3C4'); fg.addColorStop(0.5, '#FF9F43'); fg.addColorStop(1, 'rgba(255,92,50,0)');
      ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(x - cs * 0.16, y + sw * 0.3); ctx.lineTo(x + cs * 0.16, y + sw * 0.3); ctx.lineTo(x, y + sw * 0.3 + cs * 0.7 * fl); ctx.closePath(); ctx.fill();
      ctx.drawImage(SP.ship, x - sw / 2, y - sw / 2, sw, sw);
      if (this.invul > 0) { ctx.strokeStyle = 'rgba(76,201,240,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, cs * 0.8, 0, Math.PI * 2); ctx.stroke(); }
    }
    for (let i = 0; i < this.lives; i++) ctx.drawImage(SP.ship, cs * (0.25 + i * 0.7), H - cs * 0.75, cs * 0.6, cs * 0.6);
    ctx.imageSmoothingEnabled = true;
    FX.drawParts(ctx, this.parts, cs, 4);
    if (this.gameOver) { ctx.fillStyle = 'rgba(11,13,18,0.55)'; ctx.fillRect(0, 0, W, H); }
  }
}
