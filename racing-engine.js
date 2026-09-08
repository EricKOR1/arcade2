// 자동차 레이싱 엔진 — 차선을 옮겨 다니며 상대 차를 피하는 게임

const RACE_LANES = 5;
const RACE_ROWS = 12; // 교사 화면 미니 보드 세로 칸 수

class RacingGame {
  constructor(canvas, cellSize) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cellSize = cellSize;
    this.w = RACE_LANES * cellSize;
    this.h = RACE_ROWS * cellSize;

    this.laneW = this.w / RACE_LANES;
    this.carW = this.laneW * 0.62;
    this.carH = this.carW * 1.7;

    this.lane = 2;              // 목표 차선 (0~4)
    this.carX = this.laneCenter(2);
    this.carY = this.h - this.carH - this.h * 0.06;

    this.obstacles = [];
    this.roadOffset = 0;
    this.speed = 2.6;           // px per frame 기준값
    this.score = 0;
    this.distance = 0;
    this.gameOver = false;
    this.spawnCooldown = 0;
    this.lastTime = 0;
    this.boosting = false;
    this.shakeUntil = 0;
  }

  laneCenter(i) { return this.laneW * i + this.laneW / 2; }

  resize(cellSize) {
    const ratioX = this.w ? (this.carX / this.w) : 0.5;
    this.cellSize = cellSize;
    this.w = RACE_LANES * cellSize;
    this.h = RACE_ROWS * cellSize;
    this.laneW = this.w / RACE_LANES;
    this.carW = this.laneW * 0.62;
    this.carH = this.carW * 1.7;
    this.carX = ratioX * this.w;
    this.carY = this.h - this.carH - this.h * 0.06;
  }

  move(dir) {
    if (this.gameOver) return;
    const next = Math.max(0, Math.min(RACE_LANES - 1, this.lane + dir));
    if (next !== this.lane) {
      this.lane = next;
      if (window.Sound) Sound.move();
    }
  }

  // 테트리스와 조작 이름을 맞추기 위한 별칭
  rotate() { this.setBoost(true); }
  softDrop() { this.setBoost(true); }
  hardDrop() { this.setBoost(true); }

  setBoost(v) { this.boosting = v; if (v && window.Sound) Sound.boost(); }

  spawnObstacle() {
    // 최소 한 개의 차선은 비워둬서 항상 피할 길이 있도록
    const count = Math.random() < 0.45 ? 2 : 1;
    const lanes = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5).slice(0, count);
    const colorPool = ['#f87171', '#facc15', '#a78bfa', '#3b82f6', '#f97316'];
    lanes.forEach(l => {
      this.obstacles.push({
        lane: l,
        y: -this.carH,
        color: colorPool[Math.floor(Math.random() * colorPool.length)],
        passed: false
      });
    });
  }

  tick(now) {
    if (this.gameOver) return;
    const dt = this.lastTime ? Math.min(50, now - this.lastTime) : 16;
    this.lastTime = now;
    const f = dt / 16.67;

    const level = 1 + Math.floor(this.distance / 900);
    const baseSpeed = 2.6 + level * 0.55;
    const speed = (this.boosting ? baseSpeed * 1.7 : baseSpeed) * (this.cellSize / 26);

    this.distance += speed * f;
    this.score = Math.floor(this.distance / 10);
    this.roadOffset = (this.roadOffset + speed * f) % (this.cellSize * 1.6);

    // 부드럽게 차선 이동
    const targetX = this.laneCenter(this.lane);
    this.carX += (targetX - this.carX) * Math.min(1, 0.22 * f);

    // 상대 차 생성
    this.spawnCooldown -= dt;
    if (this.spawnCooldown <= 0) {
      this.spawnObstacle();
      this.spawnCooldown = Math.max(380, 950 - level * 55);
    }

    // 상대 차 이동 + 충돌 검사
    const myLeft = this.carX - this.carW / 2, myRight = this.carX + this.carW / 2;
    const myTop = this.carY, myBottom = this.carY + this.carH;
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      o.y += speed * f;
      const ox = this.laneCenter(o.lane);
      const oLeft = ox - this.carW / 2, oRight = ox + this.carW / 2;
      if (myLeft < oRight - 4 && myRight > oLeft + 4 && myTop < o.y + this.carH - 4 && myBottom > o.y + 4) {
        this.gameOver = true;
        this.shakeUntil = now + 400;
        if (window.Sound) { Sound.crash(); Sound.gameOver(); }
      }
      if (!o.passed && o.y > this.carY + this.carH) {
        o.passed = true;
        this.score += 10;
        if (window.Sound) Sound.pass();
      }
      if (o.y > this.h + this.carH) this.obstacles.splice(i, 1);
    }

    this.draw();
  }

  drawCar(ctx, cx, y, color, isPlayer) {
    const w = this.carW, h = this.carH;
    const x = cx - w / 2;
    const r = Math.max(3, w * 0.18);

    // 차체
    ctx.fillStyle = color;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
    ctx.fill();

    // 창문
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fillRect(x + w * 0.16, y + h * (isPlayer ? 0.14 : 0.6), w * 0.68, h * 0.22);
    ctx.fillRect(x + w * 0.2, y + h * (isPlayer ? 0.62 : 0.16), w * 0.6, h * 0.16);

    // 바퀴
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const ww = w * 0.16, wh = h * 0.2;
    ctx.fillRect(x - ww * 0.4, y + h * 0.14, ww, wh);
    ctx.fillRect(x + w - ww * 0.6, y + h * 0.14, ww, wh);
    ctx.fillRect(x - ww * 0.4, y + h * 0.66, ww, wh);
    ctx.fillRect(x + w - ww * 0.6, y + h * 0.66, ww, wh);
  }

  draw() {
    const ctx = this.ctx;
    const w = this.w, h = this.h;

    ctx.save();
    if (performance.now() < this.shakeUntil) {
      ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
    }

    // 도로
    ctx.fillStyle = '#22252d';
    ctx.fillRect(0, 0, w, h);

    // 갓길
    ctx.fillStyle = '#2f333d';
    ctx.fillRect(0, 0, this.laneW * 0.12, h);
    ctx.fillRect(w - this.laneW * 0.12, 0, this.laneW * 0.12, h);

    // 흐르는 차선
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = Math.max(2, this.cellSize * 0.07);
    ctx.setLineDash([this.cellSize * 0.7, this.cellSize * 0.9]);
    ctx.lineDashOffset = -this.roadOffset;
    ctx.beginPath();
    for (let i = 1; i < RACE_LANES; i++) {
      ctx.moveTo(this.laneW * i, 0);
      ctx.lineTo(this.laneW * i, h);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // 상대 차
    this.obstacles.forEach(o => this.drawCar(ctx, this.laneCenter(o.lane), o.y, o.color, false));

    // 내 차
    this.drawCar(ctx, this.carX, this.carY, this.gameOver ? '#6b7280' : '#4ade80', true);

    // 부스트 불꽃
    if (this.boosting && !this.gameOver) {
      ctx.fillStyle = 'rgba(250, 204, 21, 0.75)';
      const fx = this.carX, fy = this.carY + this.carH;
      ctx.beginPath();
      ctx.moveTo(fx - this.carW * 0.22, fy);
      ctx.lineTo(fx + this.carW * 0.22, fy);
      ctx.lineTo(fx, fy + this.carH * (0.25 + Math.random() * 0.2));
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  // 교사 화면 미니 보드용 (5칸 x 12칸 격자로 단순화)
  getSnapshot() {
    const grid = Array.from({ length: RACE_ROWS }, () => Array(RACE_LANES).fill(0));
    const rowH = this.h / RACE_ROWS;
    this.obstacles.forEach(o => {
      const r = Math.floor((o.y + this.carH / 2) / rowH);
      if (r >= 0 && r < RACE_ROWS) grid[r][o.lane] = 11;
    });
    const myRow = Math.floor((this.carY + this.carH / 2) / rowH);
    const myLane = Math.max(0, Math.min(RACE_LANES - 1, Math.round((this.carX - this.laneW / 2) / this.laneW)));
    if (myRow >= 0 && myRow < RACE_ROWS) grid[myRow][myLane] = 10;
    return grid;
  }
}
