// 타워 오르기 — 굴러오는 통을 뛰어넘고 사다리를 타고 꼭대기까지. ← → 이동 · ▲ 사다리 오르기 · 점프.
// 꼭대기에 닿으면 다음 층(통이 더 자주, 더 빠르게). 통에 닿으면 목숨 -1 (3개).

const TW_COLS = 14, TW_ROWS = 22;

class TowerGame {
  constructor(canvas, cellSize) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.cellSize = cellSize;
    this.W = TW_COLS; this.H = TW_ROWS;
    // 층: y 좌표(발판 윗면). 사다리: [x, 아래층y, 위층y]
    this.floors = [21, 17, 13, 9, 5];
    this.ladders = [[11, 21, 17], [2, 17, 13], [10, 13, 9], [3, 9, 5], [7, 5, 1.5]];
    this.score = 0; this.lives = 3; this.level = 1; this.gameOver = false; this.climbed = 0;
    this.lastTime = 0; this.now = 0; this.steer = 0; this.upHeld = false;
    this.barrels = []; this.parts = []; this.spawnT = 0; this.invul = 1500;
    this.resetPlayer();
  }
  resetPlayer() { this.x = 1.5; this.y = this.floors[0]; this.vy = 0; this.onLadder = false; this.jumping = false; this.face = 1; }
  move(dir) { this.steer = dir; } releaseSteer(dir) { if (this.steer === dir) this.steer = 0; }
  up() { this.upHeld = true; }
  softDrop() { this.wantDown = true; }
  rotate() { this.jump(); } hardDrop() { this.jump(); } fire() { this.jump(); }
  jump() { if (this.gameOver || this.jumping || this.onLadder) return; this.jumping = true; this.vy = -0.42; if (window.Sound) Sound.rotate(); }

  floorAt(y) { return this.floors.find(fy => Math.abs(fy - y) < 0.3); }
  ladderAt(x, y) { return this.ladders.find(([lx, by, ty]) => Math.abs(lx + 0.5 - x) < 0.5 && y <= by + 0.3 && y >= ty - 0.3); }

  tick(now) {
    this.now = now;
    if (this.gameOver) return;
    const dt = this.lastTime ? Math.min(50, now - this.lastTime) : 16.7; this.lastTime = now; const f = dt / 16.7;
    if (this.invul > 0) this.invul -= dt;
    // 사다리
    const lad = this.ladderAt(this.x, this.y);
    if (!this.jumping && lad && (this.upHeld || this.wantDown)) { this.onLadder = true; this.x = lad[0] + 0.5; }
    if (this.onLadder) {
      if (this.upHeld) this.y -= 0.12 * f; if (this.wantDown) this.y += 0.12 * f;
      const [, by, ty] = lad || [0, this.y, this.y];
      if (this.y <= ty) { this.y = ty; this.onLadder = false; }
      if (this.y >= by) { this.y = by; this.onLadder = false; }
      if (!lad) this.onLadder = false;
    } else {
      this.x = Math.max(0.5, Math.min(this.W - 0.5, this.x + this.steer * 0.13 * f));
      if (this.steer) this.face = this.steer;
      if (this.jumping) { this.vy += 0.028 * f; this.y += this.vy * f;
        const fl = this.floors.find(fy => this.vy > 0 && this.y >= fy - 0.05 && this.y <= fy + 0.5);
        if (fl != null) { this.y = fl; this.jumping = false; this.vy = 0; } }
      else { const fl = this.floorAt(this.y); if (fl == null) { this.jumping = true; this.vy = 0; } }
    }
    this.wantDown = false; this.upHeld = false;
    // 꼭대기 도달
    if (this.y <= 1.6) { this.level++; this.climbed++; this.score += 500 * this.level; if (window.Sound) Sound.levelUp(); this.barrels = []; this.resetPlayer(); this.invul = 1500; }
    // 통 생성 · 이동 (맨 위 층 왼쪽에서 출발, 층 끝에서 아래로 떨어지고 방향 전환, 가끔 사다리로 내려감)
    this.spawnT -= dt; if (this.spawnT <= 0) { this.spawnT = Math.max(900, 2600 - this.level * 250); this.barrels.push({ x: 1, y: 5, dir: 1, vy: 0, falling: false, rot: 0 }); }
    const bs = 0.09 + this.level * 0.012;
    this.barrels.forEach(b => { b.rot += b.dir * 0.2 * f;
      if (b.falling) { b.vy += 0.03 * f; b.y += b.vy * f; const fl = this.floors.find(fy => b.y >= fy - 0.05 && b.y <= fy + 0.6); if (fl != null && b.y >= fl) { b.y = fl; b.falling = false; b.vy = 0; b.dir = -b.dir; } return; }
      b.x += b.dir * bs * f;
      const lad = this.ladders.find(([lx, by]) => by === b.y && Math.abs(lx + 0.5 - b.x) < 0.15);
      if (lad && Math.random() < 0.35 && !b.usedLadder) { b.usedLadder = true; b.falling = true; b.vy = 0.05; b.x = lad[0] + 0.5; return; }
      if (b.x < 0.5 || b.x > this.W - 0.5) { b.falling = true; b.vy = 0; b.x = Math.max(0.5, Math.min(this.W - 0.5, b.x)); b.usedLadder = false; }
    });
    this.barrels = this.barrels.filter(b => b.y < this.H + 1 && !(b.y >= this.floors[0] && (b.x <= 0.5 || b.x >= this.W - 0.5)));
    // 통과 충돌 · 뛰어넘기 점수
    this.barrels.forEach(b => { const dx = Math.abs(b.x - this.x), dy = this.y - b.y;
      if (!b.scored && dx < 0.5 && dy < -0.8 && dy > -2.2 && this.jumping) { b.scored = true; this.score += 50; }
      if (this.invul <= 0 && dx < 0.55 && Math.abs(dy) < 0.6) { this.lives--; this.invul = 2000; this.burst(this.x, this.y); if (window.Sound) Sound.crash();
        if (this.lives <= 0) { this.gameOver = true; if (window.Sound) Sound.gameOver(); } else { this.barrels = []; this.resetPlayer(); } } });
    this.parts.forEach(p => { p.x += p.vx * f; p.y += p.vy * f; p.l -= 0.05 * f; }); this.parts = this.parts.filter(p => p.l > 0);
    this.draw();
  }
  burst(x, y) { for (let i = 0; i < 10; i++) { const a = Math.random() * Math.PI * 2, v = 0.04 + Math.random() * 0.08; this.parts.push({ x, y: y - 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.05, l: 1, c: '#FF5C7A' }); } }

  getSnapshot() {
    const g = Array.from({ length: this.H }, () => Array(this.W).fill(0));
    const put = (x, y, v) => { const cx = Math.floor(x), cy = Math.floor(y); if (cx >= 0 && cx < this.W && cy >= 0 && cy < this.H) g[cy][cx] = v; };
    this.floors.forEach(fy => { for (let x = 0; x < this.W; x++) put(x, fy - 0.5, 55); });
    this.ladders.forEach(([lx, by, ty]) => { for (let y = ty; y < by; y++) put(lx, y, 56); });
    this.barrels.forEach(b => put(b.x, b.y - 0.6, 57)); put(this.x, this.y - 0.8, 23); put(7, 0.5, 48);
    return g;
  }

  draw() {
    const ctx = this.ctx, cs = this.cellSize, W = this.W * cs, H = this.H * cs, now = this.now;
    const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1B1030'); bg.addColorStop(1, '#0C0A1A'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    // 사다리
    this.ladders.forEach(([lx, by, ty]) => { const x = (lx + 0.5) * cs; ctx.strokeStyle = '#4CC9F0'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x - cs * .3, ty * cs); ctx.lineTo(x - cs * .3, by * cs); ctx.moveTo(x + cs * .3, ty * cs); ctx.lineTo(x + cs * .3, by * cs); ctx.stroke();
      ctx.lineWidth = 2; for (let y = ty + 0.5; y < by; y += 0.7) { ctx.beginPath(); ctx.moveTo(x - cs * .3, y * cs); ctx.lineTo(x + cs * .3, y * cs); ctx.stroke(); } });
    // 층 (강철 발판)
    this.floors.forEach(fy => { const y = fy * cs; ctx.fillStyle = '#FF5C7A'; ctx.fillRect(0, y, W, cs * 0.35); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(0, y, W, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; for (let x = 0; x < W; x += cs) ctx.fillRect(x + cs * 0.15, y + cs * 0.1, cs * 0.5, cs * 0.15); });
    // 꼭대기 목표
    ctx.fillStyle = '#FFD166'; ctx.beginPath(); ctx.moveTo(7.5 * cs, 0.4 * cs); ctx.lineTo(8.1 * cs, 1.5 * cs); ctx.lineTo(6.9 * cs, 1.5 * cs); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '800 ' + Math.round(cs * .5) + 'px Pretendard, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('GOAL', 7.5 * cs, 1.3 * cs); ctx.textAlign = 'left';
    // 통
    this.barrels.forEach(b => { const px = b.x * cs, py = (b.y - 0.45) * cs, r = cs * 0.42;
      ctx.save(); ctx.translate(px, py); ctx.rotate(b.rot); ctx.fillStyle = '#B98A55'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7A552F'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke(); ctx.restore(); });
    // 플레이어 (작은 등반가)
    if (!(this.invul > 0 && Math.floor(this.invul / 120) % 2 === 0)) { const px = this.x * cs, py = this.y * cs, r = cs * 0.38;
      ctx.fillStyle = '#06D6A0'; ctx.fillRect(px - r * 0.6, py - r * 2.0, r * 1.2, r * 1.3);
      ctx.fillStyle = '#FFD166'; ctx.beginPath(); ctx.arc(px, py - r * 2.4, r * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2B3140'; const sw = (this.steer || this.onLadder) ? Math.sin(now / 80) * r * 0.4 : 0;
      ctx.fillRect(px - r * 0.55, py - r * 0.7, r * 0.45, r * 0.7 + sw); ctx.fillRect(px + r * 0.1, py - r * 0.7, r * 0.45, r * 0.7 - sw);
      ctx.fillStyle = '#fff'; ctx.fillRect(px + this.face * r * 0.15, py - r * 2.5, r * 0.15, r * 0.15); }
    this.parts.forEach(p => { ctx.globalAlpha = Math.max(0, p.l); ctx.fillStyle = p.c; ctx.fillRect(p.x * cs - 1.5, p.y * cs - 1.5, 3, 3); }); ctx.globalAlpha = 1;
    for (let i = 0; i < this.lives; i++) { ctx.fillStyle = '#06D6A0'; ctx.fillRect(cs * (0.3 + i * 0.6), H - cs * 0.5, cs * 0.35, cs * 0.35); }
    if (this.gameOver) { ctx.fillStyle = 'rgba(11,13,18,0.55)'; ctx.fillRect(0, 0, W, H); }
  }
}
