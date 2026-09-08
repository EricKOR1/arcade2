// 테트리스 조각 모양·색상 정의와 보드 렌더링 함수
// 참가자 화면(index.html)과 관리자 화면(admin.html)이 함께 사용합니다.

const TETRIS_COLS = 10;
const TETRIS_ROWS = 20;

const PIECE_COLORS = {
  0: '#1e2129', // 빈 칸
  1: '#22d3ee', // I
  2: '#3b82f6', // J
  3: '#f97316', // L
  4: '#facc15', // O
  5: '#4ade80', // S
  6: '#a78bfa', // T
  7: '#f87171'  // Z
};

const PIECE_SHAPES = {
  1: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  2: [[2,0,0],[2,2,2],[0,0,0]],
  3: [[0,0,3],[3,3,3],[0,0,0]],
  4: [[4,4],[4,4]],
  5: [[0,5,5],[5,5,0],[0,0,0]],
  6: [[0,6,0],[6,6,6],[0,0,0]],
  7: [[7,7,0],[0,7,7],[0,0,0]]
};

// 2차원 보드 배열(숫자)을 캔버스에 그림
function drawBoardGrid(ctx, board, cellSize) {
  const cols = board[0] ? board[0].length : TETRIS_COLS;
  const rows = board.length;
  ctx.fillStyle = PIECE_COLORS[0];
  ctx.fillRect(0, 0, cols * cellSize, rows * cellSize);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const v = board[y][x];
      if (v !== 0) {
        ctx.fillStyle = PIECE_COLORS[v] || '#888';
        ctx.fillRect(x * cellSize, y * cellSize, cellSize - 1, cellSize - 1);
      }
    }
  }
}

// Firebase에 저장하기 좋은 형태(문자열 배열)로 압축
function boardToRows(board) {
  return board.map(row => row.join(''));
}

// Firebase에서 받은 문자열 배열을 다시 숫자 2차원 배열로 복원
function rowsToBoard(rows) {
  return rows.map(r => r.split('').map(Number));
}
