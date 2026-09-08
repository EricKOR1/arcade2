// 게임 등록표
// 새 게임을 추가하려면 아래에 항목 하나를 추가하고,
// index.html / admin.html 아래쪽 <script> 목록에 엔진 파일을 넣어주세요.

const GAMES = {
  tetris: {
    name: '테트리스',
    desc: '떨어지는 블록을 빈틈없이 쌓아 가로줄을 지우세요',
    meta: '개인전 · 점수 경쟁',
    // daisyUI primary 색 (oklch: 밝기 채도 색상)
    primary: '68.5% 0.163 288', primaryContent: '100% 0 0',
    hex: '#8B7CF6',
    grid: { cols: 10, rows: 20 },     // 캔버스를 격자 비율로 맞춤
    adminView: 'grid',                // 교사 화면: 학생별 미니 보드
    needsPeers: false,
    hasNext: true,
    controls: ['left', 'rotate', 'right', 'down', 'drop'],
    create: function (canvas, opts) { return new TetrisGame(canvas, opts.cellSize); },
    sync: function (g) { return { board: boardToRows(g.getSnapshot()), score: g.score }; }
  },

  kart: {
    name: '카트 레이싱',
    desc: '모두 함께 출발해 아이템을 쓰며 3바퀴를 먼저 도세요',
    meta: '실시간 대전 · 순위 경쟁',
    primary: '77.5% 0.154 71', primaryContent: '18% 0.03 71',
    hex: '#F5A524',
    fullBleed: true,                  // 캔버스가 화면 전체를 채움
    adminView: 'shared',              // 교사 화면: 모두가 한 맵에
    needsPeers: true,
    hasNext: false,
    hasTracks: true,
    controls: ['left', 'item', 'right'],
    create: function (canvas, opts) {
      return new KartGame(canvas, opts);
    },
    sync: function (g) { return { score: g.score }; }
  }
};

function getGameId() {
  const params = new URLSearchParams(location.search);
  const id = params.get('game');
  return (id && GAMES[id]) ? id : 'tetris';
}

// 게임별 강조색을 daisyUI 테마에 반영
function applyAccent(gameId) {
  const g = GAMES[gameId];
  if (!g) return;
  const r = document.documentElement.style;
  r.setProperty('--p', g.primary);
  r.setProperty('--pc', g.primaryContent);
  r.setProperty('--game-hex', g.hex);
}
