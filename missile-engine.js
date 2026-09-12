// 미사일 방어 — 화면을 톡 누르면 그 자리에 요격탄이 터집니다. 떨어지는 미사일에서 도시 여섯을 지키세요.
// 파도마다 미사일이 늘고 빨라집니다. 도시가 다 무너지면 끝.

const MS_COLS = 16, MS_ROWS = 20;

class MissileGame {
  constructor(canvas, cellSize) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.cellSize = cellSize;
    this.W = MS_COLS; this.H = MS_ROWS;
    this.cities = [1.5, 4, 6.5, 9.5, 12, 14.5].map(x => ({ x, alive: true }));
    this.bases = [{ x: 8, ammo: 12 }];
    this.missiles = []; this.shots = []; this.blasts = []; this.parts = [];
    this.score = 0; this.wave = 1; this.gameOver = false; this.saved = 0;
    this.lastTime = 0; this.now = 0; this.spawnLeft = 0; this.spawnTimer = 0; this.waveClear = 0;
    this.startWave();
  }
  get citiesLeft() { return this.cities.filter(c => c.alive).length; }
  startWave() { this.spawnLeft = 5 + this.wave * 3; this.spawnTimer = 800; this.bases[0].ammo = 10 + Math.min(10, this.wave * 2); this.waveClear = 0; }

  // 톡 누른 자리(칸 단위)로 요격탄 발사
  tapAt(x, y) {
    if (this.gameOver || this.waveClear) return;
    const b = this.bases[0]; if (b.ammo <= 0) return;
    if (y > this.H - 2.5) y = this.H - 2.5;
    b.ammo--;
    const dx = x - b.x, dy = y - (this.H - 1.2), d = Math.hypot(dx, dy) || 1;
    this.shots.push({ x: b.x, y: this.H - 1.2, tx: x, ty: y, vx: dx / d * 0.32, vy: dy / d * 0.32 });
    if (window.Sound) Sound.move();
  }
  move() {} rotate() {} softDrop() {} hardDrop() {}

  tick(now) {
    this.now = now;
    if (this.gameOver) return;
    const dt = this.lastTime ? Math.min(50, now - this.lastTime) : 16.7; this.lastTime = now; const f = dt / 16.7;

    // 적 미사일 생성
    if (this.spawnLeft > 0) { this.spawnTimer -= dt; if (this.spawnTimer <= 0) { this.spawnTimer = Math.max(350, 1400 - this.wave * 100) * (0.6 + Math.random() * 0.8); this.spawnLeft--;
      const targets = this.cities.filter(c => c.alive).map(c => c.x).concat([this.bases[0].x]);
      const tx = targets[Math.floor(Math.random() * targets.length)], sx = Math.random() * this.W;
      const sp = 0.018 + this.wave * 0.003 + Math.random() * 0.01, d = Math.hypot(tx - sx, this.H - 1) || 1;
      this.missiles.push({ x: sx, y: 0, sx, sy: 0, vx: (tx - sx) / d * sp, vy: (this.H - 1) / d * sp }); } }

    // 요격탄
    for (let i = this.shots.length - 1; i >= 0; i--) { const s = this.shots[i]; s.x += s.vx * f; s.y += s.vy * f;
      if (Math.hypot(s.x - s.tx, s.y - s.ty) < 0.3 || s.y < 0) { this.shots.splice(i, 1); this.blasts.push({ x: s.tx, y: s.ty, r: 0.2, t: 0 }); if (window.Sound) Sound.lock(); } }
    // 폭발 (커졌다 줄어듦)
    for (let i = this.blasts.length - 1; i >= 0; i--) { const b = this.blasts[i]; b.t += dt; b.r = b.t < 500 ? 0.2 + b.t / 500 * 1.6 : Math.max(0, 1.8 - (b.t - 500) / 500 * 1.8); if (b.t > 1000) this.blasts.splice(i, 1); }
    // 적 미사일: 폭발에 닿으면 소멸, 바닥에 닿으면 도시 파괴
    for (let i = this.missiles.length - 1; i >= 0; i--) { const m = this.missiles[i]; m.x += m.vx * f; m.y += m.vy * f;
      const hit = this.blasts.some(b => Math.hypot(b.x - m.x, b.y - m.y) < b.r);
      if (hit) { this.missiles.splice(i, 1); this.score += 25 * this.wave; this.burst(m.x, m.y, '#FFD166'); if (window.Sound) Sound.clear(1); continue; }
      if (m.y >= this.H - 1) { this.missiles.splice(i, 1); this.burst(m.x, this.H - 1, '#FF5C7A');
        const c = this.cities.find(c => c.alive && Math.abs(c.x - m.x) < 0.9); if (c) { c.alive = false; if (window.Sound) Sound.crash(); }
        if (Math.abs(this.bases[0].x - m.x) < 0.9) { this.bases[0].ammo = Math.max(0, this.bases[0].ammo - 4); if (window.Sound) Sound.crash(); }
        if (this.citiesLeft === 0) { this.gameOver = true; if (window.Sound) Sound.gameOver(); } } }
    // 파도 끝: 남은 도시·탄약 보너스
    if (this.spawnLeft === 0 && !this.missiles.length && !this.waveClear) { this.waveClear = now + 2200; this.score += this.citiesLeft * 100 + this.bases[0].ammo * 5; this.saved += this.citiesLeft; if (window.Sound) Sound.levelUp(); }
    if (this.waveClear && now > this.waveClear) { this.wave++; if (this.wave % 3 === 0) { const d = this.cities.find(c => !c.alive); if (d) d.alive = true; } this.startWave(); }
    this.parts.forEach(p => { p.x += p.vx * f; p.y += p.vy * f; p.l -= 0.04 * f; }); this.parts = this.parts.filter(p => p.l > 0);
    this.draw();
  }
  burst(x, y, c) { for (let i = 0; i < 8; i++) { const a = Math.random() * Math.PI * 2, v = 0.03 + Math.random() * 0.06; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 1, c }); } }

  getSnapshot() {
    const g = Array.from({ length: this.H }, () => Array(this.W).fill(0));
    const put = (x, y, v) => { const cx = Math.floor(x), cy = Math.floor(y); if (cx >= 0 && cx < this.W && cy >= 0 && cy < this.H) g[cy][cx] = v; };
    this.cities.forEach(c => { if (c.alive) { put(c.x, this.H - 1, 51); put(c.x - 0.6, this.H - 1, 51); } });
    put(this.bases[0].x, this.H - 1, 25);
    this.missiles.forEach(m => put(m.x, m.y, 26)); this.shots.forEach(s => put(s.x, s.y, 27));
    this.blasts.forEach(b => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (Math.hypot(dx, dy) < b.r) put(b.x + dx, b.y + dy, 23); });
    return g;
  }

  draw() {
    const ctx = this.ctx, cs = this.cellSize, W = this.W * cs, H = this.H * cs, now = this.now;
    const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#04061A'); sky.addColorStop(1, '#1A1440'); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    if (!this._stars) this._stars = Array.from({ length: 40 }, () => [Math.random() * W, Math.random() * H * 0.8, Math.random()]);
    this._stars.forEach(s => { ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + s[2] * 0.5).toFixed(2) + ')'; ctx.fillRect(s[0], s[1], 1.5, 1.5); });
    // 땅 · 도시
    ctx.fillStyle = '#3A2E5A'; ctx.fillRect(0, H - cs, W, cs);
    this.cities.forEach(c => { const x = c.x * cs, y = H - cs;
      if (c.alive) { ctx.fillStyle = '#4CC9F0'; [[-0.7, 0.6], [-0.3, 0.9], [0.1, 0.5], [0.4, 0.8]].forEach(([o, h]) => ctx.fillRect(x + o * cs, y - h * cs, cs * 0.28, h * cs));
        ctx.fillStyle = 'rgba(255,214,102,0.8)'; ctx.fillRect(x - 0.6 * cs, y - 0.45 * cs, cs * .1, cs * .1); ctx.fillRect(x + 0.2 * cs, y - 0.35 * cs, cs * .1, cs * .1); }
      else { ctx.fillStyle = '#5A4A6A'; ctx.fillRect(x - 0.7 * cs, y - cs * 0.15, cs * 1.3, cs * 0.15); } });
    // 기지
    const b = this.bases[0], bx = b.x * cs, by = H - cs;
    ctx.fillStyle = '#7C6AF6'; ctx.beginPath(); ctx.moveTo(bx - cs * 0.9, by); ctx.lineTo(bx, by - cs * 0.9); ctx.lineTo(bx + cs * 0.9, by); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '800 ' + Math.round(cs * .45) + 'px Pretendard, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(b.ammo), bx, by - cs * 0.15); ctx.textAlign = 'left';
    // 적 미사일 궤적
    this.missiles.forEach(m => { ctx.strokeStyle = 'rgba(255,92,122,0.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(m.sx * cs, m.sy * cs); ctx.lineTo(m.x * cs, m.y * cs); ctx.stroke();
      ctx.fillStyle = '#FF5C7A'; ctx.beginPath(); ctx.arc(m.x * cs, m.y * cs, cs * .14, 0, Math.PI * 2); ctx.fill(); });
    // 요격탄
    this.shots.forEach(s => { ctx.strokeStyle = 'rgba(76,201,240,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b.x * cs, (this.H - 1.2) * cs); ctx.lineTo(s.x * cs, s.y * cs); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillRect(s.tx * cs - 3, s.ty * cs - 3, 6, 6); });
    // 폭발
    this.blasts.forEach(bl => { const g = ctx.createRadialGradient(bl.x * cs, bl.y * cs, 0, bl.x * cs, bl.y * cs, bl.r * cs); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.5, 'rgba(255,214,102,0.8)'); g.addColorStop(1, 'rgba(255,92,122,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bl.x * cs, bl.y * cs, bl.r * cs, 0, Math.PI * 2); ctx.fill(); });
    this.parts.forEach(p => { ctx.globalAlpha = Math.max(0, p.l); ctx.fillStyle = p.c; ctx.fillRect(p.x * cs - 1.5, p.y * cs - 1.5, 3, 3); }); ctx.globalAlpha = 1;
    if (this.waveClear) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = '800 ' + Math.round(cs * .9) + 'px Pretendard, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('WAVE ' + this.wave + ' 방어 성공', W / 2, H * 0.4); ctx.font = '600 ' + Math.round(cs * .5) + 'px Pretendard, sans-serif'; ctx.fillText('도시 ' + this.citiesLeft + '개 · 남은 탄 ' + b.ammo + ' 보너스', W / 2, H * 0.4 + cs); ctx.textAlign = 'left'; }
    if (this.wave === 1 && this.spawnLeft > 5 + 3 - 2 && !this.missiles.length) { ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '700 ' + Math.round(cs * .6) + 'px Pretendard, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('미사일이 지나갈 자리를 톡 누르세요', W / 2, H * 0.55); ctx.textAlign = 'left'; }
    if (this.gameOver) { ctx.fillStyle = 'rgba(11,13,18,0.55)'; ctx.fillRect(0, 0, W, H); }
  }
}
