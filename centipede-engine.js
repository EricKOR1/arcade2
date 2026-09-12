// 지네 사냥 — 버섯밭 사이로 내려오는 지네를 쏘세요. 맞은 마디는 버섯이 되고, 지네는 둘로 갈라집니다.
// ← → 이동 · 발사(꾹). 지네가 바닥까지 오거나 부딪히면 목숨 -1.

const CP_COLS = 16, CP_ROWS = 24;

class CentipedeGame {
  constructor(canvas, cellSize) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.cellSize = cellSize;
    this.W = CP_COLS; this.H = CP_ROWS;
    this.x = this.W / 2; this.y = this.H - 1.5; this.steer = 0; this.firing = false; this.lastFire = 0;
    this.bullets = []; this.parts = [];
    this.score = 0; this.lives = 3; this.wave = 1; this.gameOver = false; this.lastTime = 0; this.now = 0; this.invul = 0;
    this.mush = Array.from({ length: this.H }, () => Array(this.W).fill(0));
    for (let i = 0; i < 26; i++) { const x = Math.floor(Math.random() * this.W), y = 1 + Math.floor(Math.random() * (this.H - 6)); this.mush[y][x] = 3; }
    this.spawnWave();
  }
  spawnWave() {
    const len = Math.min(12, 6 + this.wave * 2);
    this.chains = [{ segs: Array.from({ length: len }, (_, i) => ({ x: -i, y: 0 })), dir: 1, speed: 0.045 + this.wave * 0.008, t: 0 }];
  }
  move(dir) { this.steer = dir; } releaseSteer(dir) { if (this.steer === dir) this.steer = 0; }
  rotate() { this.fire(); } hardDrop() { this.fire(); } softDrop() {} up() {}
  fire() { if (this.gameOver || this.now - this.lastFire < 170 || this.bullets.length >= 3) return; this.lastFire = this.now; this.bullets.push({ x: this.x, y: this.y - 0.5 }); if (window.Sound) Sound.move(); }

  tick(now) {
    this.now = now;
    if (this.gameOver) return;
    const dt = this.lastTime ? Math.min(50, now - this.lastTime) : 16.7; this.lastTime = now; const f = dt / 16.7;
    this.x = Math.max(0.5, Math.min(this.W - 0.5, this.x + this.steer * 0.16 * f));
    if (this.firing) this.fire();
    if (this.invul > 0) this.invul -= dt;
    // 총알
    for (let i = this.bullets.length - 1; i >= 0; i--) { const b = this.bullets[i]; b.y -= 0.5 * f; if (b.y < 0) { this.bullets.splice(i, 1); continue; }
      const cx = Math.floor(b.x), cy = Math.floor(b.y);
      if (this.mush[cy] && this.mush[cy][cx] > 0) { this.mush[cy][cx]--; this.bullets.splice(i, 1); if (!this.mush[cy][cx]) this.score += 1; continue; }
      let hit = false;
      this.chains.forEach(ch => { const k = ch.segs.findIndex(s => Math.abs(s.x + 0.5 - b.x) < 0.55 && Math.abs(s.y + 0.5 - b.y) < 0.55);
        if (k >= 0 && !hit) { hit = true; const s = ch.segs[k]; this.mush[Math.max(0, Math.round(s.y))][Math.max(0, Math.min(this.W - 1, Math.round(s.x)))] = 3;
          this.score += k === 0 ? 100 : 10; this.burst(s.x + 0.5, s.y + 0.5);
          const tail = ch.segs.splice(k + 1); ch.segs.splice(k, 1);
          if (tail.length) this.chains.push({ segs: tail, dir: -ch.dir, speed: ch.speed, t: 0 });
          if (window.Sound) Sound.clear(1); } });
      if (hit) this.bullets.splice(i, 1);
    }
    this.chains = this.chains.filter(ch => ch.segs.length);
    // 지네 이동: 머리가 격자 단위로 진행, 벽·버섯을 만나면 한 줄 내려가고 방향 전환
    this.chains.forEach(ch => { ch.t += ch.speed * f; if (ch.t < 1) return; ch.t = 0;
      const head = ch.segs[0]; let nx = head.x + ch.dir, ny = head.y;
      const blocked = nx < 0 || nx >= this.W || (this.mush[ny] && this.mush[ny][nx] > 0);
      if (blocked) { ny = head.y + 1; nx = head.x; ch.dir = -ch.dir; if (ny >= this.H - 1) { ny = this.H - 1; } }
      for (let i = ch.segs.length - 1; i > 0; i--) { ch.segs[i].x = ch.segs[i - 1].x; ch.segs[i].y = ch.segs[i - 1].y; }
      head.x = nx; head.y = ny;
      if (ny >= this.H - 1 && nx === head.x) { /* 바닥 도달: 위로 튕겨 다시 내려옴 */ if (head.y >= this.H - 1 && Math.random() < 0.5) head.y = this.H - 4; }
    });
    // 충돌
    if (this.invul <= 0 && this.chains.some(ch => ch.segs.some(s => Math.abs(s.x + 0.5 - this.x) < 0.7 && Math.abs(s.y + 0.5 - this.y) < 0.7))) {
      this.lives--; this.invul = 2000; this.burst(this.x, this.y, '#4CC9F0'); if (window.Sound) Sound.crash();
      if (this.lives <= 0) { this.gameOver = true; if (window.Sound) Sound.gameOver(); }
      else { this.chains.forEach(ch => ch.segs.forEach(s => { s.y = Math.max(0, s.y - 8); })); }
    }
    if (!this.chains.length) { this.wave++; this.score += 100 * this.wave; if (window.Sound) Sound.levelUp(); this.spawnWave(); }
    this.parts.forEach(p => { p.x += p.vx * f; p.y += p.vy * f; p.l -= 0.05 * f; }); this.parts = this.parts.filter(p => p.l > 0);
    this.draw();
  }
  burst(x, y, c) { for (let i = 0; i < 6; i++) { const a = Math.random() * Math.PI * 2, v = 0.03 + Math.random() * 0.05; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 1, c: c || '#B15DFF' }); } }

  getSnapshot() {
    const g = this.mush.map(r => r.map(v => v ? 52 : 0));
    const put = (x, y, v) => { const cx = Math.floor(x), cy = Math.floor(y); if (cx >= 0 && cx < this.W && cy >= 0 && cy < this.H) g[cy][cx] = v; };
    this.chains.forEach(ch => ch.segs.forEach((s, i) => put(s.x + 0.5, s.y + 0.5, i === 0 ? 53 : 54)));
    this.bullets.forEach(b => put(b.x, b.y, 27)); put(this.x, this.y, 25);
    return g;
  }

  draw() {
    const ctx = this.ctx, cs = this.cellSize, W = this.W * cs, H = this.H * cs;
    ctx.fillStyle = '#0A1410'; ctx.fillRect(0, 0, W, H);
    // 버섯
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) { const v = this.mush[y][x]; if (!v) continue;
      const px = x * cs + cs / 2, py = y * cs + cs / 2, r = cs * (0.22 + v * 0.07);
      ctx.fillStyle = ['#8A6238', '#C97A4A', '#E8A05A'][v - 1] || '#E8A05A'; ctx.beginPath(); ctx.arc(px, py - r * 0.2, r, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#F0DDB0'; ctx.fillRect(px - r * 0.3, py - r * 0.2, r * 0.6, r * 0.9);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(px - r * 0.3, py - r * 0.5, r * 0.18, 0, Math.PI * 2); ctx.fill(); }
    // 지네
    this.chains.forEach(ch => ch.segs.forEach((s, i) => { const px = (s.x + 0.5) * cs, py = (s.y + 0.5) * cs, r = cs * 0.4;
      ctx.fillStyle = i === 0 ? '#FFD166' : (i % 2 ? '#7C3AED' : '#A78BFA'); ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(px - r, py + r * 0.6, r * 0.5, r * 0.5); ctx.fillRect(px + r * 0.5, py + r * 0.6, r * 0.5, r * 0.5);
      if (i === 0) { ctx.fillStyle = '#1A1D24'; ctx.beginPath(); ctx.arc(px - r * 0.3, py - r * 0.2, r * 0.18, 0, Math.PI * 2); ctx.arc(px + r * 0.3, py - r * 0.2, r * 0.18, 0, Math.PI * 2); ctx.fill(); } }));
    // 총알 · 내 캐릭터
    ctx.fillStyle = '#FFD166'; this.bullets.forEach(b => ctx.fillRect(b.x * cs - 1.5, b.y * cs - cs * 0.3, 3, cs * 0.5));
    if (!(this.invul > 0 && Math.floor(this.invul / 120) % 2 === 0)) { const px = this.x * cs, py = this.y * cs, r = cs * 0.45;
      ctx.fillStyle = '#4CC9F0'; ctx.beginPath(); ctx.moveTo(px, py - r); ctx.lineTo(px + r * 0.9, py + r * 0.7); ctx.lineTo(px, py + r * 0.3); ctx.lineTo(px - r * 0.9, py + r * 0.7); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(px, py - r * 0.2, r * 0.18, 0, Math.PI * 2); ctx.fill(); }
    this.parts.forEach(p => { ctx.globalAlpha = Math.max(0, p.l); ctx.fillStyle = p.c; ctx.fillRect(p.x * cs - 1.5, p.y * cs - 1.5, 3, 3); }); ctx.globalAlpha = 1;
    for (let i = 0; i < this.lives; i++) { ctx.fillStyle = '#4CC9F0'; ctx.fillRect(cs * (0.3 + i * 0.6), H - cs * 0.5, cs * 0.35, cs * 0.35); }
    if (this.gameOver) { ctx.fillStyle = 'rgba(11,13,18,0.55)'; ctx.fillRect(0, 0, W, H); }
  }
}
