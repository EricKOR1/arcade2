// 게임 목록 등록표
// 새 게임을 추가하려면 아래 GAMES 객체에 항목 하나를 추가하고,
// index.html / admin.html 하단의 <script> 목록에 게임 엔진 파일을 넣어주세요.

const GAMES = {
  tetris: {
    name: '테트리스',
    desc: '블록을 쌓아 줄을 지우세요',
    cols: 10,
    rows: 20,
    create: function (canvas, cellSize) { return new TetrisGame(canvas, cellSize); }
  }
  // 예시) 다음에 게임을 추가할 때:
  // snake: {
  //   name: '스네이크',
  //   desc: '먹이를 먹고 길어지세요',
  //   cols: 16, rows: 16,
  //   create: function (canvas, cellSize) { return new SnakeGame(canvas, cellSize); }
  // }
};

function getGameId() {
  const params = new URLSearchParams(location.search);
  return params.get('game') || 'tetris';
}
