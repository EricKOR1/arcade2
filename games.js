// 게임 등록표
// 새 게임을 추가하려면 아래에 항목 하나를 추가하고,
// index.html / admin.html 아래쪽 <script> 목록에 엔진 파일을 넣어주세요.

const GAMES = {
  tetris: {
    name: '테트리스',
    desc: '떨어지는 블록을 빈틈없이 쌓아 가로줄을 지우세요',
    meta: '1인 플레이 · 점수 경쟁',
    accent: '#8B7CF6',
    accentSoft: 'rgba(139, 124, 246, 0.14)',
    cols: 10,
    rows: 20,
    hasNext: true,
    controls: ['left', 'rotate', 'right', 'down', 'drop'],
    create: function (canvas, cellSize) { return new TetrisGame(canvas, cellSize); }
  },

  racing: {
    name: '자동차 레이싱',
    desc: '차선을 옮겨가며 상대 차를 피해 최대한 멀리 달리세요',
    meta: '1인 플레이 · 거리 경쟁',
    accent: '#F5A524',
    accentSoft: 'rgba(245, 165, 36, 0.14)',
    cols: 5,
    rows: 12,
    hasNext: false,
    controls: ['left', 'right', 'boost'],
    create: function (canvas, cellSize) { return new RacingGame(canvas, cellSize); }
  }
};

function getGameId() {
  const params = new URLSearchParams(location.search);
  const id = params.get('game');
  return (id && GAMES[id]) ? id : 'tetris';
}

// 게임별 강조색을 화면 전체에 적용
function applyAccent(gameId) {
  const g = GAMES[gameId];
  if (!g) return;
  document.documentElement.style.setProperty('--accent', g.accent);
  document.documentElement.style.setProperty('--accent-soft', g.accentSoft);
}
