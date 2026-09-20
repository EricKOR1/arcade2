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
  45: '#7D8798', // 소행성
  46: '#3B82F6', // 미로 - 벽
  47: '#FFD166', // 미로 - 셀
  48: '#4CC9F0', // 미로 - 파워 셀 / 목표
  49: '#FF5C7A', // 미로 - 드론
  50: '#3B5BDB', // 미로 - 겁먹은 드론
  51: '#4CC9F0', // 미사일 - 도시
  52: '#E8A05A', // 지네 - 버섯
  53: '#FFD166', // 지네 - 머리
  54: '#A78BFA', // 지네 - 몸
  55: '#FF5C7A', // 타워 - 발판
  56: '#4CC9F0', // 타워 - 사다리
  57: '#B98A55', // 타워 - 통
  58: '#134B73', // 태화강 - 강물
  59: '#1E2A3A', // 태화강 - 취수장
  60: '#B15DFF', // 태화강 - 오염물
  61: '#FF8A80', // (예비)
  62: '#0B1220', // 오염원 추적 - 지도 바탕
  63: '#5C6B85', // 젬 아레나 - 벽
  64: '#8B5CF6', // 젬 아레나 - 광산
  65: '#2E8B57', // 젬 아레나 - 수풀
  66: '#1F2B3E', // 젬 아레나 - 바닥
  67: '#B15DFF', // 젬 아레나 - 젬
  68: '#FF5C7A', // 젬 아레나 - 레드
  69: '#4CC9F0'  // 젬 아레나 - 블루
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
// 블록 셀 — 둥근 모서리 · 세로 그라데이션 · 윗면 광택 · 안쪽 그림자.
// 크기·색 조합마다 한 번만 그려 캐시해 두고 복사합니다 (테트리스 200칸 + 교사 미니보드 30개도 가볍게).
const _cellCache = new Map();
function _tintHex(hex, k) {
  const h = String(hex).replace('#', ''); if (h.length !== 6) return hex;
  const v = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  return '#' + v.map(c => Math.max(0, Math.min(255, Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k)))).toString(16).padStart(2, '0')).join('');
}
function _cellSprite(size, color) {
  const key = size + '|' + color; let c = _cellCache.get(key); if (c) return c;
  const S = Math.max(2, Math.round(size)); c = document.createElement('canvas'); c.width = S; c.height = S;
  const g = c.getContext('2d'), pad = Math.max(0.5, S * 0.06), r = Math.max(1.5, S * 0.18);
  const rr = (x, y, w, h, rad) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, rad); else g.rect(x, y, w, h); };
  // 본체
  const lg = g.createLinearGradient(0, pad, 0, S - pad); lg.addColorStop(0, _tintHex(color, 0.32)); lg.addColorStop(0.5, color); lg.addColorStop(1, _tintHex(color, -0.34));
  g.fillStyle = lg; rr(pad, pad, S - pad * 2, S - pad * 2, r); g.fill();
  // 윗면 광택
  g.fillStyle = 'rgba(255,255,255,0.30)'; rr(pad * 2, pad * 2, S - pad * 4, (S - pad * 4) * 0.36, r * 0.7); g.fill();
  // 안쪽 아래 그림자
  g.fillStyle = 'rgba(0,0,0,0.22)'; rr(pad * 2, S - pad * 2 - (S - pad * 4) * 0.22, S - pad * 4, (S - pad * 4) * 0.22, r * 0.7); g.fill();
  // 테두리
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = Math.max(0.8, S * 0.04); rr(pad, pad, S - pad * 2, S - pad * 2, r); g.stroke();
  if (_cellCache.size > 400) _cellCache.clear();
  _cellCache.set(key, c); return c;
}
function drawBevelCell(ctx, px, py, size, color) {
  ctx.drawImage(_cellSprite(size, color), px, py, size, size);
}

function boardToRows(board) {
  return board.map(row => row.join(','));
}

function rowsToBoard(rows) {
  return rows.map(r => r.split(',').map(Number));
}

// ── 진동 피드백 (지원 기기만 · 아주 짧게) ──
const Haptic = {
  on: true,
  tap()  { if (this.on && navigator.vibrate) navigator.vibrate(12); },
  hit()  { if (this.on && navigator.vibrate) navigator.vibrate([30, 30, 30]); },
  good() { if (this.on && navigator.vibrate) navigator.vibrate(20); },
  big()  { if (this.on && navigator.vibrate) navigator.vibrate([60, 40, 80]); }
};
