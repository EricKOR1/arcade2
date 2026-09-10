// 테트리스 엔진 — 고스트 블록, 다음 블록 미리보기, 레벨, 락 딜레이 포함

const TETRIS_COLS = 10;
const TETRIS_ROWS = 20;

const PIECE_SHAPES = {
  1: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  2: [[2,0,0],[2,2,2],[0,0,0]],
  3: [[0,0,3],[3,3,3],[0,0,0]],
  4: [[4,4],[4,4]],
  5: [[0,5,5],[5,5,0],[0,0,0]],
  6: [[0,6,0],[6,6,6],[0,0,0]],
  7: [[7,7,0],[0,7,7],[0,0,0]]
};

function rotateMatrix(m) {
  const n = m.length;
  const r = Array.from({ length: n }, () => Array(n).fill(0));
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) r[x][n - 1 - y] = m[y][x];
  return r;
}

class TetrisGame {
  constructor(canvas, cellSize) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cellSize = cellSize;
    this.board = Array.from({ length: TETRIS_ROWS }, () => Array(TETRIS_COLS).fill(0));
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.gameOver = false;
    this.bag = [];
    this.nextType = this.drawFromBag();
    this.lastDrop = 0;
    this.lockTimer = null;
    this.lockResets = 0;
    this.softDropping = false;
    this.flashRows = [];
    this.flashUntil = 0;
    this.onNextChange = null;
    this.spawnPiece();
  }

  // 낙하 간격 — 줄을 못 지워도 30초마다 한 단계씩 빨라집니다 (줄 레벨과 시간 레벨 중 높은 쪽)
  get dropInterval() {
    const timeLevel = 1 + Math.floor((this.elapsed || 0) / 30000);
    const lv = Math.max(this.level, timeLevel);
    return Math.max(110, 800 - (lv - 1) * 60);
  }

  // 7종을 골고루 섞어 뽑기 (정식 테트리스 방식)
  drawFromBag() {
    if (this.bag.length === 0) {
      this.bag = [1, 2, 3, 4, 5, 6, 7];
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    return this.bag.pop();
  }

  spawnPiece() {
    const type = this.nextType;
    this.nextType = this.drawFromBag();
    if (this.onNextChange) this.onNextChange(this.nextType);
    const matrix = PIECE_SHAPES[type].map(r => r.slice());
    this.piece = { type, matrix, x: Math.floor((TETRIS_COLS - matrix[0].length) / 2), y: 0 };
    this.lockTimer = null;
    this.lockResets = 0;
    if (this.collides(this.piece, 0, 0)) {
      this.gameOver = true;
      if (window.Sound) Sound.gameOver();
    }
  }

  collides(piece, ox, oy) {
    const m = piece.matrix;
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[y].length; x++) {
        if (!m[y][x]) continue;
        const bx = piece.x + x + ox, by = piece.y + y + oy;
        if (bx < 0 || bx >= TETRIS_COLS || by >= TETRIS_ROWS) return true;
        if (by >= 0 && this.board[by][bx]) return true;
      }
    }
    return false;
  }

  ghostY() {
    let dy = 0;
    while (!this.collides(this.piece, 0, dy + 1)) dy++;
    return this.piece.y + dy;
  }

  touchingGround() { return this.collides(this.piece, 0, 1); }

  // 바닥에 닿아도 잠깐 여유를 줘서 옆으로 밀어넣을 수 있게 함
  startLockDelay(now) {
    if (this.lockTimer === null) this.lockTimer = now;
  }
  resetLockDelay(now) {
    if (this.lockTimer !== null && this.lockResets < 15) {
      this.lockTimer = now;
      this.lockResets++;
    }
  }

  move(dx) {
    if (this.gameOver) return;
    if (!this.collides(this.piece, dx, 0)) {
      this.piece.x += dx;
      if (window.Sound) Sound.move();
      if (this.touchingGround()) this.resetLockDelay(performance.now());
    }
  }

  rotate() {
    if (this.gameOver) return;
    const rotated = rotateMatrix(this.piece.matrix);
    const test = { type: this.piece.type, matrix: rotated, x: this.piece.x, y: this.piece.y };
    // 벽에 붙어 있을 때 살짝 밀어서 회전 (월킥)
    for (const kick of [0, -1, 1, -2, 2]) {
      test.x = this.piece.x + kick;
      if (!this.collides(test, 0, 0)) {
        this.piece.matrix = rotated;
        this.piece.x = test.x;
        if (window.Sound) Sound.rotate();
        if (this.touchingGround()) this.resetLockDelay(performance.now());
        return;
      }
    }
  }

  softDrop() {
    if (this.gameOver) return;
    if (!this.collides(this.piece, 0, 1)) {
      this.piece.y++;
      this.score += 1;
      if (window.Sound) Sound.softDrop();
    } else {
      this.startLockDelay(performance.now());
    }
  }

  hardDrop() {
    if (this.gameOver) return;
    let dist = 0;
    while (!this.collides(this.piece, 0, 1)) { this.piece.y++; dist++; }
    this.score += dist * 2;
    if (window.Sound) Sound.hardDrop();
    this.lockPiece();
  }

  merge() {
    const m = this.piece.matrix;
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[y].length; x++) {
        if (m[y][x]) {
          const by = this.piece.y + y, bx = this.piece.x + x;
          if (by >= 0) this.board[by][bx] = this.piece.type;
        }
      }
    }
  }

  clearLines() {
    const cleared = [];
    for (let y = 0; y < TETRIS_ROWS; y++) {
      if (this.board[y].every(c => c !== 0)) cleared.push(y);
    }
    if (cleared.length === 0) return;
    this.flashRows = cleared;
    this.flashUntil = performance.now() + 130;
    this.board = this.board.filter((_, y) => cleared.indexOf(y) === -1);
    while (this.board.length < TETRIS_ROWS) this.board.unshift(Array(TETRIS_COLS).fill(0));

    const points = [0, 100, 300, 500, 800];
    this.score += (points[cleared.length] || 0) * this.level;
    this.lines += cleared.length;
    if (window.Sound) Sound.clear(cleared.length);

    const newLevel = Math.floor(this.lines / 10) + 1;
    if (newLevel > this.level) {
      this.level = newLevel;
      if (window.Sound) Sound.levelUp();
    }
  }

  lockPiece() {
    this.merge();
    if (window.Sound) Sound.lock();
    this.clearLines();
    this.spawnPiece();
  }

  tick(now) {
    if (this.gameOver) return;
    if (!this.startAt) this.startAt = now;
    this.elapsed = now - this.startAt;
    // 시간이 흘러 레벨이 오르면 표시도 함께 올립니다
    const timeLevel = 1 + Math.floor(this.elapsed / 30000);
    if (timeLevel > this.level) { this.level = timeLevel; if (window.Sound) Sound.levelUp(); }
    const interval = this.softDropping ? 45 : this.dropInterval;
    if (now - this.lastDrop > interval) {
      if (!this.collides(this.piece, 0, 1)) {
        this.piece.y++;
        if (this.softDropping) this.score += 1;
      } else {
        this.startLockDelay(now);
      }
      this.lastDrop = now;
    }
    if (this.lockTimer !== null) {
      if (!this.touchingGround()) {
        this.lockTimer = null;
      } else if (now - this.lockTimer > 480) {
        this.lockPiece();
      }
    }
    this.draw();
  }

  // 교사 화면 전송용 스냅샷 (고정된 블록 + 현재 블록)
  getSnapshot() {
    const snap = this.board.map(r => r.slice());
    const m = this.piece.matrix;
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[y].length; x++) {
        if (m[y][x]) {
          const by = this.piece.y + y, bx = this.piece.x + x;
          if (by >= 0 && by < TETRIS_ROWS && bx >= 0 && bx < TETRIS_COLS) snap[by][bx] = this.piece.type;
        }
      }
    }
    return snap;
  }

  draw() {
    const ctx = this.ctx, cs = this.cellSize;
    const w = TETRIS_COLS * cs, h = TETRIS_ROWS * cs;

    ctx.fillStyle = '#0B0D12';
    ctx.fillRect(0, 0, w, h);

    // 배경 격자
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < TETRIS_COLS; x++) { ctx.moveTo(x * cs, 0); ctx.lineTo(x * cs, h); }
    for (let y = 1; y < TETRIS_ROWS; y++) { ctx.moveTo(0, y * cs); ctx.lineTo(w, y * cs); }
    ctx.stroke();

    // 쌓인 블록
    for (let y = 0; y < TETRIS_ROWS; y++) {
      for (let x = 0; x < TETRIS_COLS; x++) {
        const v = this.board[y][x];
        if (v) drawBevelCell(ctx, x * cs, y * cs, cs, CELL_COLORS[v]);
      }
    }

    if (!this.gameOver) {
      // (착지 예상 위치 표시는 뺐습니다 — 어디에 떨어질지 스스로 판단하도록)
      const m = this.piece.matrix;
      // 현재 블록
      for (let y = 0; y < m.length; y++) {
        for (let x = 0; x < m[y].length; x++) {
          if (m[y][x]) {
            const by = this.piece.y + y;
            if (by >= 0) drawBevelCell(ctx, (this.piece.x + x) * cs, by * cs, cs, CELL_COLORS[this.piece.type]);
          }
        }
      }
    }

    // 줄 삭제 순간 번쩍임
    if (performance.now() < this.flashUntil) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      this.flashRows.forEach(y => ctx.fillRect(0, y * cs, w, cs));
    }
  }

  // 다음 블록 미리보기 그리기
  drawNext(ctx, size) {
    const m = PIECE_SHAPES[this.nextType];
    ctx.clearRect(0, 0, size * 4, size * 4);
    let minX = 4, maxX = -1, minY = 4, maxY = -1;
    for (let y = 0; y < m.length; y++) for (let x = 0; x < m[y].length; x++) {
      if (m[y][x]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    }
    const pw = (maxX - minX + 1), ph = (maxY - minY + 1);
    const offX = (4 - pw) / 2 - minX, offY = (4 - ph) / 2 - minY;
    for (let y = 0; y < m.length; y++) for (let x = 0; x < m[y].length; x++) {
      if (m[y][x]) drawBevelCell(ctx, (x + offX) * size, (y + offY) * size, size, CELL_COLORS[this.nextType]);
    }
  }
}
