// 공용 색상표와 미니 보드 렌더링
// 학생 화면(index.html)과 교사 화면(admin.html)이 함께 사용합니다.

const CELL_COLORS = {
  0:  '#0B0D12', // 빈 칸
  1:  '#4CC9F0', // I
  2:  '#4361EE', // J
  3:  '#F79824', // L
  4:  '#FFD166', // O
  5:  '#06D6A0', // S
  6:  '#B15DFF', // T
  7:  '#EF476F', // Z
  8:  '#2B303C', // 고스트(착지 예상 위치)
  10: '#F5A524', // 레이싱 - 내 차
  11: '#EF476F', // 레이싱 - 상대 차
  12: '#2B303C'  // 레이싱 - 도로 경계
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
