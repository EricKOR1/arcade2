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
    this.nextPipe = 10;
    this.wing = 0;
    this.clouds = Array.from({ length: 6 }, (_, i) => ({ x: i * 4 + Math.random() * 3, y: 1 + Math.random() * 8, s: 0.6 + Math.random() * 0.8 }));
  }

  // 난이도 — 처음엔 넓고 느리게, 통과할수록 아주 서서히 좁고 빨라집니다
  get gap()     { return Math.max(4.6, 7.8 - this.passed * 0.08); }        // 틈: 7.8칸 → 40개 통과 뒤 4.6칸
  get speed()   { return Math.min(0.12, 0.065 + this.passed * 0.0014); }   // 속도: 느리게 시작
  get gravity() { return Math.min(0.021, 0.014 + this.passed * 0.00025); } // 중력: 처음엔 살짝 가볍게
  get spacing() { return Math.max(4.8, 6.4 - this.passed * 0.04); }        // 기둥 간격: 처음엔 멀리

  jump() {
    if (this.gameOver) return;
    this.started = true;
    this.vy = -0.27;
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
    if (this.started) this.time = (this.time || 0) + dt;   // 배경 시차 스크롤용
    const f = dt / 16.7;

    if (this.started) {
      this.vy += this.gravity * f;                // 중력 (서서히 강해짐)
      this.vy = Math.min(this.vy, 0.42);
      this.y += this.vy * f;
      this.dist += this.speed * f;

      // 기둥 만들기
      if (this.dist >= this.nextPipe) {
        this.nextPipe += this.spacing;
        // 처음 몇 개는 화면 가운데 근처에 두고, 익숙해지면 위아래로 퍼집니다
        const range = Math.min(1, 0.35 + this.passed * 0.06);
        const mid = (FLAP_ROWS - 1 - this.gap) / 2;
        let gapY = 2.0 + mid * (1 - range) + Math.random() * (FLAP_ROWS - this.gap - 4.5) * range;
        // 바로 앞 틈보다 너무 높으면 낮춤: 기둥 사이에서 올라가야 할 높이가 초당 5번쯤 톡으로 오를 수 있는 만큼(0.15칸/프레임)을 넘지 않게
        // (예전: 30개 넘게 통과하면 기둥 40쌍에 1쌍꼴로 쉬지 않고 톡해도 못 지나는 높이 차가 나왔음)
        const prev = this.pipes[this.pipes.length - 1];
        if (prev) gapY = Math.max(gapY, prev.gapY + 0.72 - this.gap - 0.15 * (this.spacing - 1.84) / this.speed);
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
        if (this.x + 0.42 > p.x && this.x - 0.42 < p.x + 1 && this.hitsPipe(p)) this.die();
      });
      if (this.y + 0.4 >= FLAP_ROWS - 1) this.die();
      // 화면 위 끝은 천장 — 더 못 올라감 (예전: 위로 나가면 바로 끝이라, 시작하자마자 연타하면 1초 만에 보이지 않는 곳에서 끝남)
      if (this.y < 0.35) { this.y = 0.35; if (this.vy < 0) this.vy = 0; }
    } else {
      this.y = FLAP_ROWS / 2 + Math.sin(now / 300) * 0.4;   // 시작 전 둥실둥실
    }
    this.clouds.forEach(c => { c.x -= 0.012 * c.s * f; if (c.x < -3) c.x = FLAP_COLS + 2; });
    if (this.wing > 0) this.wing -= 0.08 * f;
    this.draw();
  }

  // 기둥 충돌 — 화면에 그린 몸통(기울어진 타원 0.42×0.34)의 테두리 24점이 기둥 몸통 안에 들어가면 닿음
  // (예전: 네모 판정이라 새 모서리 쪽은 그림이 안 닿았는데도 끝나는 경우가 죽음 10번 중 1번꼴)
  hitsPipe(p) {
    const tilt = Math.max(-0.5, Math.min(0.9, this.vy * 3)), c = Math.cos(tilt), s = Math.sin(tilt);
    for (let i = 0; i < 24; i++) {
      const a = i * Math.PI / 12, ex = Math.cos(a) * 0.42, ey = Math.sin(a) * 0.34;
      const px = this.x + ex * c - ey * s, py = this.y + ex * s + ey * c;
      if (px > p.x && px < p.x + 1 && (py < p.gapY || py > p.gapY + p.gapH)) return true;
    }
    return false;
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
    sky.addColorStop(0, '#1B2A4A'); sky.addColorStop(0.55, '#3B5B8F'); sky.addColorStop(1, '#8C6BA8');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // 해 (살짝 빛남)
    { const sx = W * 0.78, sy = H * 0.22, sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, cs * 2.4); sg.addColorStop(0, 'rgba(255,224,150,0.9)'); sg.addColorStop(0.35, 'rgba(255,209,102,0.55)'); sg.addColorStop(1, 'rgba(255,209,102,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, cs * 2.4, 0, Math.PI * 2); ctx.fill(); }
    // 먼 산 (두 겹, 천천히 지나감)
    if (!this._hills || this._hillsCs !== cs) { this._hills = [0, 1].map(k => { const c = document.createElement('canvas'); c.width = W * 2; c.height = H; const g = c.getContext('2d');
        g.fillStyle = k ? '#2B3F6B' : '#22335A'; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W * 2; x += cs * 0.5) { const yy = H - cs * (k ? 2.2 : 3.4) - Math.abs(Math.sin(x / (cs * (k ? 3.2 : 5.5)) + k)) * cs * (k ? 1.6 : 2.6); g.lineTo(x, yy); } g.lineTo(W * 2, H); g.closePath(); g.fill(); return c; }); this._hillsCs = cs; }
    const scroll = (this.time || 0) / 1000 * cs;
    this._hills.forEach((h, k) => { const off = -((scroll * (k ? 0.5 : 0.22)) % W); ctx.drawImage(h, off, 0); ctx.drawImage(h, off + W, 0); });

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
        g.addColorStop(0, '#067A5C'); g.addColorStop(0.35, '#06D6A0'); g.addColorStop(0.6, '#3DE8B5'); g.addColorStop(1, '#067A5C');
        ctx.fillStyle = g; ctx.fillRect(px, y, pw, h);
        ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(px + pw - cs * 0.14, y, cs * 0.14, h);
        // 끝단 캡: 둥근 모서리 + 그림자
        const capY = (y === 0) ? topH - cs * .5 : botY;
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; FX.rr(ctx, px - cs * .12, capY + cs * 0.08, pw + cs * .24, cs * .5, cs * 0.1); ctx.fill();
        const cg = ctx.createLinearGradient(px - cs * .12, 0, px + pw + cs * .12, 0); cg.addColorStop(0, '#067A5C'); cg.addColorStop(0.4, '#3DE8B5'); cg.addColorStop(1, '#067A5C');
        ctx.fillStyle = cg; FX.rr(ctx, px - cs * .12, capY, pw + cs * .24, cs * .5, cs * 0.1); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; FX.rr(ctx, px - cs * .06, capY + cs * 0.06, pw + cs * .12, cs * .12, cs * 0.06); ctx.fill();
      });
    });

    // 땅
    ctx.fillStyle = '#5B4636'; ctx.fillRect(0, H - cs, W, cs);
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; for (let x = ((-scroll * 1.2) % (cs * 0.8)); x < W; x += cs * 0.8) ctx.fillRect(x, H - cs * 0.55, cs * 0.35, cs * 0.12);
    ctx.fillStyle = '#7BA05B'; ctx.fillRect(0, H - cs, W, cs * .25);
    ctx.fillStyle = '#9BC46E'; for (let x = ((-scroll * 1.2) % (cs * 0.5)); x < W; x += cs * 0.5) ctx.fillRect(x, H - cs, cs * 0.25, cs * 0.12);

    // 새
    const bx = this.x * cs, by = this.y * cs;
    const tilt = Math.max(-0.5, Math.min(0.9, this.vy * 3));
    ctx.save(); ctx.translate(bx, by); ctx.rotate(tilt);
    const bg2 = ctx.createRadialGradient(-cs * 0.12, -cs * 0.12, cs * 0.05, 0, 0, cs * 0.45); bg2.addColorStop(0, '#FFE066'); bg2.addColorStop(1, '#E0A800');
    ctx.fillStyle = bg2; ctx.beginPath(); ctx.ellipse(0, 0, cs * .42, cs * .34, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = Math.max(1, cs * 0.04); ctx.stroke();
    ctx.fillStyle = '#FFF3C4'; ctx.beginPath(); ctx.ellipse(cs * 0.05, cs * 0.12, cs * .22, cs * .14, 0, 0, Math.PI * 2); ctx.fill();
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
