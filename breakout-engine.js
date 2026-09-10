// 벽돌깨기 — 패들로 공을 튕겨 벽돌을 모두 부수세요. 공을 놓치면 목숨이 줄어듭니다.

const BRICK_COLS = 12, BRICK_ROWS = 20;

class BreakoutGame {
  constructor(canvas, cellSize) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cellSize = cellSize;
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.gameOver = false;
    this.steer = 0;
    this.lastTime = 0;
    this.shake = 0;
    this.flash = [];
    this.balls = [];            // 공 여러 개
    this.drops = [];            // 떨어지는 아이템 캡슐
    this.wideUntil = 0;         // 넓은 패들
    this.slowUntil = 0;         // 느린 공
    this.pierceUntil = 0;       // 관통 공
    this.hits = 0;              // 패들에 튕긴 횟수 (속도 상승)
    this.msg = null;            // 아이템 획득 문구
    this.resetLevel(true);
  }

  // 좌표는 "칸" 단위 — 화면 크기와 무관하게 동작합니다
  resetLevel(first) {
    const rows = Math.min(7, 4 + this.level);
    this.bricks = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < BRICK_COLS; c++) {
        // 위쪽 줄은 두 번 맞아야 깨집니다 (레벨 2부터)
        const hp = (this.level >= 2 && r < 2) ? 2 : 1;
        this.bricks.push({ x: c, y: 1 + r, hp: hp, color: 16 + (r % 5) });
      }
    this.left = this.bricks.length;
    this.paddleW = Math.max(2.2, 3.6 - (this.level - 1) * 0.25);
    this.wideUntil = 0; this.slowUntil = 0; this.pierceUntil = 0;
    this.paddleX = (BRICK_COLS - this.paddleW) / 2;
    this.paddleY = BRICK_ROWS - 1.4;
    this.serve();
  }

  get paddleW() { return this._pw * ((this.lastTime && this.lastTime < this.wideUntil) ? 1.6 : 1); }
  set paddleW(v) { this._pw = v; }

  serve() {
    this.balls = [{ x: this.paddleX + this.paddleW / 2, y: this.paddleY - 0.4, vx: 0, vy: 0, r: 0.28 }];
    this.drops = [];
    this.launched = false;
    this.hits = 0;
  }
  get ball() { return this.balls[0]; }     // 호환용 (테스트 · 미리보기)

  // 아이템 정의 — 벽돌을 깨면 가끔 떨어집니다
  static get ITEMS() {
    return {
      multi:  { color: '#4CC9F0', label: '멀티볼',   icon: '●●' },
      wide:   { color: '#06D6A0', label: '넓은 패들', icon: '⟷' },
      slow:   { color: '#FFD166', label: '느린 공',   icon: '◔' },
      life:   { color: '#EF476F', label: '목숨 +1',   icon: '♥' },
      pierce: { color: '#B15DFF', label: '관통 공',   icon: '⇑' }
    };
  }

  move(dir) { this.steer = dir; }
  releaseSteer(dir) { if (this.steer === dir) this.steer = 0; }
  fire() { this.launch(); }
  hardDrop() { this.launch(); }
  rotate() { this.launch(); }
  softDrop() {}

  get baseSpeed() { return 0.15 + (this.level - 1) * 0.02; }

  launch() {
    if (this.gameOver || this.launched) return;
    const speed = this.baseSpeed;
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
    this.balls.forEach(b => { b.vx = Math.cos(ang) * speed; b.vy = Math.sin(ang) * speed; });
    this.launched = true;
    if (window.Sound) Sound.start();
  }

  tick(now) {
    if (this.gameOver) return;
    const dt = this.lastTime ? Math.min(40, now - this.lastTime) : 16.7;
    this.lastTime = now;
    const f = dt / 16.7;

    // 패들
    this.paddleX += this.steer * 0.32 * f;
    this.paddleX = Math.max(0, Math.min(BRICK_COLS - this.paddleW, this.paddleX));
    if (!this.launched) this.balls.forEach(b => { b.x = this.paddleX + this.paddleW / 2; });

    // 공 — 빠를 때 벽돌을 뚫고 지나가지 않도록 잘게 나눠 움직입니다
    if (this.launched) {
      const steps = 4;
      for (let i = 0; i < steps; i++) {
        this.stepBalls(f / steps, now);
        if (this.gameOver || !this.launched) break;   // 놓치거나 끝나면 같은 프레임에서 더 계산하지 않음
      }
    }

    // 떨어지는 아이템 — 패들로 받으면 효과
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.y += 0.045 * f; d.a += 0.08 * f;
      const caught = d.y + 0.3 >= this.paddleY && d.y - 0.3 <= this.paddleY + 0.5 &&
                     d.x >= this.paddleX - 0.3 && d.x <= this.paddleX + this.paddleW + 0.3;
      if (caught) { this.drops.splice(i, 1); this.applyItem(d.kind, now); }
      else if (d.y > BRICK_ROWS + 1) this.drops.splice(i, 1);
    }
    if (this.msg && now > this.msg.until) this.msg = null;
    if (this.shake > 0) this.shake -= 0.06 * f;
    this.flash = this.flash.filter(x => (x.t -= 0.05 * f) > 0);
    this.draw();
  }

  applyItem(kind, now) {
    const it = BreakoutGame.ITEMS[kind];
    this.msg = { text: it.label, color: it.color, until: now + 1400 };
    this.score += 20;
    if (kind === 'multi') {
      // 공마다 좌우로 하나씩 갈라짐 (최대 6개)
      const add = [];
      this.balls.forEach(b => {
        if (this.balls.length + add.length >= 6) return;
        const sp = Math.hypot(b.vx, b.vy) || this.baseSpeed;
        [0.5, -0.5].forEach(da => {
          if (this.balls.length + add.length >= 6) return;
          const a = Math.atan2(b.vy || -1, b.vx || 0) + da;
          add.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: b.r });
        });
      });
      this.balls = this.balls.concat(add);
    } else if (kind === 'wide')   this.wideUntil = now + 12000;
    else if (kind === 'slow') {
      this.slowUntil = now + 8000;
      this.balls.forEach(b => { b.vx *= 0.65; b.vy *= 0.65; });
    }
    else if (kind === 'life')   this.lives = Math.min(5, this.lives + 1);
    else if (kind === 'pierce') this.pierceUntil = now + 7000;
    if (window.Sound) Sound.levelUp();
  }

  stepBalls(f, now) {
    const pierce = now < this.pierceUntil;
    const minSpeed = this.baseSpeed * (now < this.slowUntil ? 0.65 : 1);
    for (let bi = this.balls.length - 1; bi >= 0; bi--) {
      const b = this.balls[bi];
      b.x += b.vx * f; b.y += b.vy * f;

      // 벽
      if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx); if (window.Sound) Sound.move(); }
      if (b.x + b.r > BRICK_COLS) { b.x = BRICK_COLS - b.r; b.vx = -Math.abs(b.vx); if (window.Sound) Sound.move(); }
      if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy); if (window.Sound) Sound.move(); }

      // 패들 — 맞은 위치에 따라 각도가 달라지고, 튕길 때마다 조금씩 빨라집니다
      if (b.vy > 0 && b.y + b.r >= this.paddleY && b.y - b.r <= this.paddleY + 0.5 &&
          b.x >= this.paddleX - b.r && b.x <= this.paddleX + this.paddleW + b.r) {
        const rel = (b.x - (this.paddleX + this.paddleW / 2)) / (this.paddleW / 2);
        this.hits++;
        // 튕길 때마다 1.2% 빨라지되, 기본 속도의 1.7배를 넘지 않습니다
        const speed = Math.min(this.baseSpeed * 1.7, Math.max(minSpeed, Math.hypot(b.vx, b.vy)) * 1.012);
        const ang = -Math.PI / 2 + rel * 1.05;
        b.vx = Math.cos(ang) * speed; b.vy = Math.sin(ang) * speed;
        b.y = this.paddleY - b.r;
        if (window.Sound) Sound.rotate();
      }

      // 벽돌
      for (let i = this.bricks.length - 1; i >= 0; i--) {
        const k = this.bricks[i];
        if (b.x + b.r < k.x || b.x - b.r > k.x + 1 || b.y + b.r < k.y || b.y - b.r > k.y + 1) continue;
        if (!pierce) {
          const ox = Math.min(b.x + b.r - k.x, k.x + 1 - (b.x - b.r));
          const oy = Math.min(b.y + b.r - k.y, k.y + 1 - (b.y - b.r));
          if (ox < oy) b.vx = -b.vx; else b.vy = -b.vy;
        }
        k.hp -= pierce ? 2 : 1;
        this.flash.push({ x: k.x, y: k.y, t: 1, color: k.color });
        if (k.hp <= 0) {
          this.bricks.splice(i, 1);
          this.left--;
          this.score += 10 * this.level;
          // 벽돌 12개 중 1개꼴로 아이템이 떨어집니다 (같은 종류가 이미 떨어지는 중이면 건너뜀)
          if (Math.random() < 0.085 && this.drops.length < 3) {
            const kinds = Object.keys(BreakoutGame.ITEMS);
            const kind = kinds[Math.floor(Math.random() * kinds.length)];
            if (!this.drops.some(d => d.kind === kind)) this.drops.push({ x: k.x + 0.5, y: k.y + 0.5, kind: kind, a: 0 });
          }
          if (window.Sound) Sound.clear(1);
        } else {
          if (window.Sound) Sound.lock();
        }
        this.shake = 0.4;
        if (!pierce) break;
      }

      // 놓침 — 마지막 공일 때만 목숨이 줄어듭니다
      if (b.y - b.r > BRICK_ROWS) {
        this.balls.splice(bi, 1);
        if (this.balls.length === 0) {
          this.lives--;
          if (window.Sound) Sound.crash();
          if (this.lives <= 0) { this.gameOver = true; if (window.Sound) Sound.gameOver(); return; }
          this.serve();
          return;
        }
      }
    }

    // 다 깼음
    if (this.left <= 0) {
      this.level++;
      this.score += 100 * this.level;
      if (window.Sound) Sound.levelUp();
      this.resetLevel();
    }
  }

  brickLayer(cs) {
    const sig = cs + ':' + this.bricks.map(k => k.x + ',' + k.y + ',' + k.hp).join('|');
    if (this._layerSig === sig && this._layer) return this._layer;
    const W = BRICK_COLS * cs, H = BRICK_ROWS * cs;
    if (!this._layer) this._layer = document.createElement('canvas');
    if (this._layer.width !== W || this._layer.height !== H) { this._layer.width = W; this._layer.height = H; }
    const g = this._layer.getContext('2d');
    g.clearRect(0, 0, W, H);
    this.bricks.forEach(k => {
      drawBevelCell(g, k.x * cs, k.y * cs, cs, CELL_COLORS[k.color]);
      if (k.hp > 1) {                                   // 단단한 벽돌 표시
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.fillRect(k.x * cs + cs * .3, k.y * cs + cs * .42, cs * .4, cs * .16);
      }
    });
    this._layerSig = sig;
    return this._layer;
  }

  getSnapshot() {
    const g = Array.from({ length: BRICK_ROWS }, () => Array(BRICK_COLS).fill(0));
    this.bricks.forEach(k => { g[k.y][k.x] = k.color; });
    const px0 = Math.max(0, Math.floor(this.paddleX)), px1 = Math.min(BRICK_COLS - 1, Math.ceil(this.paddleX + this.paddleW) - 1);
    const py = Math.min(BRICK_ROWS - 1, Math.floor(this.paddleY));
    for (let x = px0; x <= px1; x++) g[py][x] = 21;
    this.balls.forEach(b => {
      const bx = Math.max(0, Math.min(BRICK_COLS - 1, Math.floor(b.x)));
      const by = Math.max(0, Math.min(BRICK_ROWS - 1, Math.floor(b.y)));
      g[by][bx] = 22;
    });
    return g;
  }

  draw() {
    const ctx = this.ctx, cs = this.cellSize;
    const W = BRICK_COLS * cs, H = BRICK_ROWS * cs;
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - .5) * this.shake * 6, (Math.random() - .5) * this.shake * 6);
    ctx.fillStyle = '#0B0D12'; ctx.fillRect(-10, -10, W + 20, H + 20);

    // 벽돌 — 바뀔 때만 다시 그려 두고 이미지로 붙입니다 (태블릿 부담 감소)
    ctx.drawImage(this.brickLayer(cs), 0, 0);
    // 맞은 순간 번쩍
    this.flash.forEach(x => {
      ctx.fillStyle = 'rgba(255,255,255,' + (x.t * .6).toFixed(2) + ')';
      ctx.fillRect(x.x * cs, x.y * cs, cs, cs);
    });

    // 패들
    const px = this.paddleX * cs, py = this.paddleY * cs, pw = this.paddleW * cs, ph = cs * .5;
    const wide = this.lastTime < this.wideUntil;
    const g = ctx.createLinearGradient(0, py, 0, py + ph);
    g.addColorStop(0, wide ? '#B9FFE9' : '#FFFFFF'); g.addColorStop(1, wide ? '#06D6A0' : '#9AA3B2');
    ctx.fillStyle = g;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(px, py, pw, ph, ph / 2); else ctx.rect(px, py, pw, ph);
    ctx.fill();

    // 떨어지는 아이템
    this.drops.forEach(d => {
      const it = BreakoutGame.ITEMS[d.kind];
      ctx.save(); ctx.translate(d.x * cs, d.y * cs); ctx.rotate(Math.sin(d.a) * 0.15);
      ctx.fillStyle = it.color;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-cs * .48, -cs * .26, cs * .96, cs * .52, cs * .26); else ctx.rect(-cs * .48, -cs * .26, cs * .96, cs * .52);
      ctx.fill();
      ctx.fillStyle = '#0B0D12'; ctx.font = '800 ' + Math.round(cs * .34) + 'px Pretendard, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(it.icon, 0, 1);
      ctx.restore();
    });
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';

    // 공
    const pierce = this.lastTime < this.pierceUntil;
    this.balls.forEach(b => {
      ctx.fillStyle = pierce ? 'rgba(177,93,255,0.35)' : 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.arc(b.x * cs, b.y * cs, b.r * cs * 1.9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pierce ? '#E9D5FF' : '#FFFFFF';
      ctx.beginPath(); ctx.arc(b.x * cs, b.y * cs, b.r * cs, 0, Math.PI * 2); ctx.fill();
    });

    // 효과 남은 시간 (위쪽 작은 막대)
    let bx0 = cs * 0.4;
    [['wide', this.wideUntil, 12000, '#06D6A0'], ['slow', this.slowUntil, 8000, '#FFD166'], ['pierce', this.pierceUntil, 7000, '#B15DFF']].forEach(([k, until, total, col]) => {
      const left = until - this.lastTime;
      if (left <= 0) return;
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(bx0, cs * 0.3, cs * 2.2, cs * 0.22);
      ctx.fillStyle = col; ctx.fillRect(bx0, cs * 0.3, cs * 2.2 * (left / total), cs * 0.22);
      bx0 += cs * 2.6;
    });

    // 아이템 획득 문구
    if (this.msg) {
      ctx.fillStyle = this.msg.color; ctx.font = '800 ' + Math.round(cs * .8) + 'px Pretendard, sans-serif';
      ctx.textAlign = 'center'; ctx.fillText(this.msg.text, W / 2, H * 0.55); ctx.textAlign = 'left';
    }

    // 목숨
    for (let i = 0; i < this.lives; i++) {
      ctx.fillStyle = '#EF476F';
      ctx.beginPath(); ctx.arc(cs * (0.6 + i * 0.7), H - cs * .45, cs * .18, 0, Math.PI * 2); ctx.fill();
    }

    if (!this.launched && !this.gameOver) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = '600 ' + Math.round(cs * .7) + 'px Pretendard, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('발사 버튼을 누르세요', W / 2, H * .62);
      ctx.textAlign = 'left';
    }
    if (this.gameOver) { ctx.fillStyle = 'rgba(11,13,18,0.55)'; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }
}
