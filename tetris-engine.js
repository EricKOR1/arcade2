// 테트리스 게임 엔진 — 참가자 화면(index.html) 전용

function createEmptyBoard() {
  return Array.from({ length: TETRIS_ROWS }, () => Array(TETRIS_COLS).fill(0));
}

function rotateMatrix(m) {
  const n = m.length;
  const result = Array.from({ length: n }, () => Array(n).fill(0));
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      result[x][n - 1 - y] = m[y][x];
    }
  }
  return result;
}

function randomPieceType() {
  return Math.floor(Math.random() * 7) + 1;
}

class TetrisGame {
  constructor(canvas, cellSize) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cellSize = cellSize;
    this.board = createEmptyBoard();
    this.score = 0;
    this.gameOver = false;
    this.dropInterval = 800; // ms — 이 값을 줄이면 더 빨리 떨어짐
    this.lastDrop = 0;
    this.spawnPiece();
  }

  spawnPiece() {
    const type = randomPieceType();
    const matrix = PIECE_SHAPES[type];
    this.piece = {
      type,
      matrix,
      x: Math.floor((TETRIS_COLS - matrix[0].length) / 2),
      y: 0
    };
    if (this.collides(this.piece, 0, 0)) {
      this.gameOver = true;
    }
  }

  collides(piece, offsetX, offsetY) {
    const m = piece.matrix;
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[y].length; x++) {
        if (!m[y][x]) continue;
        const boardX = piece.x + x + offsetX;
        const boardY = piece.y + y + offsetY;
        if (boardX < 0 || boardX >= TETRIS_COLS || boardY >= TETRIS_ROWS) return true;
        if (boardY >= 0 && this.board[boardY][boardX]) return true;
      }
    }
    return false;
  }

  merge() {
    const m = this.piece.matrix;
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[y].length; x++) {
        if (m[y][x]) {
          const boardY = this.piece.y + y;
          const boardX = this.piece.x + x;
          if (boardY >= 0) this.board[boardY][boardX] = this.piece.type;
        }
      }
    }
  }

  clearLines() {
    let cleared = 0;
    this.board = this.board.filter(row => {
      const full = row.every(cell => cell !== 0);
      if (full) cleared++;
      return !full;
    });
    while (this.board.length < TETRIS_ROWS) {
      this.board.unshift(Array(TETRIS_COLS).fill(0));
    }
    if (cleared > 0) {
      const points = [0, 100, 300, 500, 800];
      this.score += points[cleared] || cleared * 200;
    }
  }

  move(dx) {
    if (this.gameOver) return;
    if (!this.collides(this.piece, dx, 0)) this.piece.x += dx;
  }

  rotate() {
    if (this.gameOver) return;
    const rotated = rotateMatrix(this.piece.matrix);
    const test = Object.assign({}, this.piece, { matrix: rotated });
    if (!this.collides(test, 0, 0)) this.piece.matrix = rotated;
  }

  softDrop() {
    if (this.gameOver) return;
    if (!this.collides(this.piece, 0, 1)) {
      this.piece.y++;
    } else {
      this.lockPiece();
    }
  }

  hardDrop() {
    if (this.gameOver) return;
    while (!this.collides(this.piece, 0, 1)) this.piece.y++;
    this.lockPiece();
  }

  lockPiece() {
    this.merge();
    this.clearLines();
    this.spawnPiece();
  }

  tick(timestamp) {
    if (this.gameOver) return;
    if (timestamp - this.lastDrop > this.dropInterval) {
      this.softDrop();
      this.lastDrop = timestamp;
    }
    this.draw();
  }

  // 떨어지는 조각까지 합친 스냅샷 — 관리자 화면 전송용
  getSnapshot() {
    const snap = this.board.map(row => row.slice());
    const m = this.piece.matrix;
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[y].length; x++) {
        if (m[y][x]) {
          const by = this.piece.y + y;
          const bx = this.piece.x + x;
          if (by >= 0 && by < TETRIS_ROWS && bx >= 0 && bx < TETRIS_COLS) {
            snap[by][bx] = this.piece.type;
          }
        }
      }
    }
    return snap;
  }

  draw() {
    drawBoardGrid(this.ctx, this.getSnapshot(), this.cellSize);
  }
}
