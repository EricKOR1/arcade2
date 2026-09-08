// 공용 색상표와 미니 보드 렌더링
// 학생 화면(index.html)과 교사 화면(admin.html)이 함께 사용합니다.

const CELL_COLORS = {
  0:  '#161820', // 빈 칸
  1:  '#2ad4e6', // I
  2:  '#3b82f6', // J
  3:  '#f97316', // L
  4:  '#facc15', // O
  5:  '#4ade80', // S
  6:  '#a78bfa', // T
  7:  '#f87171', // Z
  8:  '#3a3f4b', // 고스트(착지 예상 위치)
  10: '#4ade80', // 레이싱 - 내 차
  11: '#f87171', // 레이싱 - 상대 차
  12: '#2a2e38'  // 레이싱 - 도로 경계
};

// 숫자 2차원 배열을 캔버스에 그림 (교사 화면 미니 보드용)
function drawBoardGrid(ctx, board, cellSize) {
  const rows = board.length;
  const cols = board[0] ? board[0].length : 0;
  ctx.fillStyle = CELL_COLORS[0];
  ctx.fillRect(0, 0, cols * cellSize, rows * cellSize);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const v = board[y][x];
      if (v !== 0) {
        ctx.fillStyle = CELL_COLORS[v] || '#888';
        ctx.fillRect(x * cellSize, y * cellSize, cellSize - 1, cellSize - 1);
      }
    }
  }
}

// 입체감 있는 블록 (학생 화면용)
function drawBevelCell(ctx, px, py, size, color) {
  const g = 1;
  ctx.fillStyle = color;
  ctx.fillRect(px + g, py + g, size - g * 2, size - g * 2);
  const inset = Math.max(2, Math.floor(size * 0.16));
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.fillRect(px + g, py + g, size - g * 2, inset);
  ctx.fillRect(px + g, py + g, inset, size - g * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.fillRect(px + g, py + size - g - inset, size - g * 2, inset);
  ctx.fillRect(px + size - g - inset, py + g, inset, size - g * 2);
}

function boardToRows(board) {
  return board.map(row => row.join(','));
}

function rowsToBoard(rows) {
  return rows.map(r => r.split(',').map(Number));
}
