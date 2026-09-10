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
  12: '#2B303C', // 레이싱 - 도로 경계
  13: '#06D6A0', // 스네이크 - 몸통
  14: '#9BF6E0', // 스네이크 - 머리
  15: '#EF476F', // 스네이크 - 먹이
  16: '#EF476F', // 벽돌 1줄
  17: '#F79824', // 벽돌 2줄
  18: '#FFD166', // 벽돌 3줄
  19: '#06D6A0', // 벽돌 4줄
  20: '#4CC9F0', // 벽돌 5줄
  21: '#EAECF2', // 패들
  22: '#FFFFFF', // 공
  23: '#FFD166', // 새
  24: '#06D6A0', // 파이프
  25: '#4CC9F0', // 우주선
  26: '#EF476F', // 적
  27: '#FFD166', // 총알
  28: '#B15DFF', // 적 총알
  29: '#EEE4DA', 30: '#EDE0C8', 31: '#F2B179', 32: '#F59563', 33: '#F67C5F', 34: '#F65E3B',   // 2048: 2·4·8·16·32·64
  35: '#EDCF72', 36: '#EDCC61', 37: '#EDC850', 38: '#EDC53F', 39: '#EDC22E', 40: '#3C3A32',   // 128 … 4096
  41: '#1E5FA8', // 길건너기 - 강
  42: '#173D2A', // 길건너기 - 집
  43: '#8B5A2B', // 길건너기 - 통나무
  44: '#FF5C7A', // 길건너기 - 차
  45: '#7D8798'  // 소행성
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
