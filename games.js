// 게임 등록표
// 새 게임을 추가하려면 아래에 항목 하나를 추가하고,
// index.html / admin.html 아래쪽 <script> 목록에 엔진 파일을 넣어주세요.

const GAMES = {
  tetris: {
    name: '테트리스',
    desc: '블록을 쌓아 줄을 지우세요',
    cols: 10,
    rows: 20,
    hasNext: true,                             // 다음 블록 미리보기 사용
    controls: ['left', 'rotate', 'right', 'down', 'drop'],
    labels: { down: '↓', drop: '바로 내리기', rotate: '↻' },
    create: function (canvas, cellSize) { return new TetrisGame(canvas, cellSize); }
  },

  racing: {
    name: '자동차 레이싱',
    desc: '상대 차를 피해 멀리 달리세요',
    cols: 5,
    rows: 12,
    hasNext: false,
    controls: ['left', 'right', 'boost'],
    labels: { boost: '부스트 (꾹 누르기)' },
    create: function (canvas, cellSize) { return new RacingGame(canvas, cellSize); }
  }
};

function getGameId() {
  const params = new URLSearchParams(location.search);
  const id = params.get('game');
  return (id && GAMES[id]) ? id : 'tetris';
}
