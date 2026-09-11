/* ══════════════════════════════════════════════════════════
   게임 등록표

   type: "canvas" — 캔버스 한 장에 그리는 아케이드 게임 (테트리스·카트)
   type: "html"   — 자체 화면을 가진 학습 게임. src 의 파일을 불러옵니다.
                    원본 파일을 고치지 않고 그대로 씁니다.
   ══════════════════════════════════════════════════════════ */

const GAMES = {
  /* ───────── 아케이드 ───────── */
  tetris: {
    type: 'canvas',
    name: '테트리스',
    desc: '떨어지는 블록을 빈틈없이 쌓아 가로줄을 지우세요',
    howto: '← → 이동 · ↻ 회전 · ↓ 천천히 · 바로 내리기',
    meta: '개인전 · 점수 경쟁',
    primary: '68.5% 0.163 288', primaryContent: '100% 0 0', hex: '#8B7CF6',
    grid: { cols: 10, rows: 20 },
    adminView: 'grid',
    needsPeers: false, hasNext: true,
    stats: [{ key: 'lines', label: 'LINES' }, { key: 'level', label: 'LEVEL' }],
    detail: function (g) { return g.lines + '줄 완성 · 레벨 ' + g.level; },
    controls: ['left', 'rotate', 'right', 'down', 'drop'],
    create: function (canvas, opts) { return new TetrisGame(canvas, opts.cellSize); },
    sync: function (g) { return { board: boardToRows(g.getSnapshot()), score: g.score }; }
  },

  snake: {
    type: 'canvas',
    name: '스네이크',
    desc: '먹이를 먹어 몸을 길게 키우세요. 벽이나 자기 몸에 부딪히면 끝',
    howto: '← → ↑ ↓ 로 방향 바꾸기 · 화면을 쓸어도 됨 · 첫 방향키를 누르면 출발',
    meta: '개인전 · 길이 경쟁',
    primary: '82% 0.16 165', primaryContent: '18% 0.05 165', hex: '#06D6A0',
    grid: { cols: 20, rows: 20 },
    adminView: 'grid',
    needsPeers: false, hasNext: false,
    stats: [{ key: 'length', label: '길이' }, { key: 'level', label: '속도' }],
    detail: function (g) { return '길이 ' + g.length + ' · 속도 단계 ' + g.level; },
    controls: ['up', 'left', 'down', 'right'],
    create: function (canvas, opts) { return new SnakeGame(canvas, opts.cellSize); },
    sync: function (g) { return { board: boardToRows(g.getSnapshot()), score: g.score, length: g.length }; }
  },

  breakout: {
    type: 'canvas',
    name: '벽돌깨기',
    desc: '패들로 공을 튕겨 벽돌을 모두 부수세요. 공을 놓치면 목숨이 줄어요',
    howto: '← → 패들 · 발사로 공 시작 · 떨어지는 캡슐을 패들로 받으면 아이템',
    meta: '개인전 · 점수 경쟁',
    primary: '80% 0.15 75', primaryContent: '20% 0.04 75', hex: '#FFD166',
    grid: { cols: 12, rows: 20 },
    adminView: 'grid',
    needsPeers: false, hasNext: false,
    stats: [{ key: 'left', label: '남은 벽돌' }, { key: 'level', label: '단계' }],
    detail: function (g) { return g.level + '단계까지 · 벽돌 ' + g.left + '개 남음'; },
    controls: ['left', 'fire', 'right'],
    labels: { fire: '발사' },
    create: function (canvas, opts) { return new BreakoutGame(canvas, opts.cellSize); },
    sync: function (g) { return { board: boardToRows(g.getSnapshot()), score: g.score, level: g.level }; }
  },

  flappy: {
    type: 'canvas',
    name: '하늘 날기',
    desc: '톡톡 눌러 날개짓하며 기둥 사이를 통과하세요. 어디에 닿아도 끝',
    howto: '점프 버튼(또는 화면 탭)으로 날개짓 · 기둥 틈을 통과',
    meta: '개인전 · 통과 수 경쟁',
    primary: '72% 0.13 240', primaryContent: '100% 0 0', hex: '#4CC9F0',
    grid: { cols: 12, rows: 20 },
    adminView: 'grid',
    needsPeers: false, hasNext: false,
    stats: [{ key: 'passed', label: '통과' }],
    detail: function (g) { return '기둥 ' + g.passed + '개 통과'; },
    controls: ['jump'],
    labels: { jump: '점프' },
    create: function (canvas, opts) { return new FlappyGame(canvas, opts.cellSize); },
    sync: function (g) { return { board: boardToRows(g.getSnapshot()), score: g.score, passed: g.passed }; }
  },

  fps: {
    type: 'canvas',
    name: '레이저 태그 3D (개인전)',
    desc: '낮의 야외 훈련장에서 1인칭 3D 대전. 조이스틱 이동, 화면을 끌어 조준(상하 포함), 헤드샷은 2발',
    howto: '왼쪽 짚고 끌면 이동 · 오른쪽 끌면 조준 · ● 꾹 누르면 연사 · 30발 뒤 자동 재장전',
    meta: '실시간 대전 · 개인전 · 3D',
    primary: '75% 0.18 25', primaryContent: '100% 0 0', hex: '#FF8A56',
    fullBleed: true, grid: { cols: 24, rows: 24 },
    adminView: 'arena', realtime: true, engine3d: true,
    needsPeers: true, hasNext: false,
    stats: [{ key: 'kills', label: 'KILLS' }, { key: 'hp', label: 'HP' }],
    detail: function (g) { return g.kills + '킬 · ' + g.deaths + '데스'; },
    controls: ['fire'], padLayout: 'joystick',
    labels: { fire: '발사' },
    create: function (canvas, opts) { return new Fps3DGame(canvas, opts); },
    sync: function (g) { return { score: g.score, kills: g.kills, deaths: g.deaths, hp: g.hp }; }
  },

  fpsteam: {
    type: 'canvas',
    name: '레이저 태그 3D (팀전)',
    desc: '레드 팀과 블루 팀. 같은 팀은 못 맞히고, 미니맵에는 우리 편만 보입니다',
    howto: '왼쪽 짚고 끌면 이동 · 오른쪽 끌면 조준 · ● 꾹 누르면 연사 · 같은 팀은 안 맞음',
    meta: '실시간 대전 · 팀전 · 3D',
    primary: '70% 0.2 350', primaryContent: '100% 0 0', hex: '#FF5C7A',
    fullBleed: true, grid: { cols: 24, rows: 24 },
    adminView: 'arena', realtime: true, engine3d: true,
    needsPeers: true, hasNext: false,
    stats: [{ key: 'kills', label: 'KILLS' }, { key: 'hp', label: 'HP' }],
    detail: function (g) { return (g.team === 'red' ? '레드 팀' : '블루 팀') + ' · ' + g.kills + '킬 ' + g.deaths + '데스'; },
    controls: ['fire'], padLayout: 'joystick',
    labels: { fire: '발사' },
    create: function (canvas, opts) { return new Fps3DGame(canvas, Object.assign({ teamMode: true }, opts)); },
    sync: function (g) { return { score: g.score, kills: g.kills, deaths: g.deaths, hp: g.hp, team: g.team }; }
  },

  fpsclassic: {
    type: 'canvas',
    name: '레이저 태그 클래식',
    desc: '옛날 아케이드 감성의 2D 레이캐스팅 버전. 3D 가 느린 기기용',
    howto: '↶ ↷ 회전 · ▲ 전진 ▼ 후진 · 발사 꾹 누르면 연사',
    meta: '실시간 대전 · 개인전 · 저사양',
    primary: '65% 0.12 25', primaryContent: '100% 0 0', hex: '#C97A4A',
    fullBleed: true, grid: { cols: 24, rows: 24 },
    adminView: 'arena', realtime: true,
    needsPeers: true, hasNext: false,
    stats: [{ key: 'kills', label: 'KILLS' }, { key: 'hp', label: 'HP' }],
    detail: function (g) { return g.kills + '킬 · ' + g.deaths + '데스'; },
    controls: ['up', 'left', 'down', 'right', 'fire'],
    labels: { up: '▲ 전진', down: '▼ 후진', left: '↶', right: '↷', fire: '발사 (꾹)' },
    create: function (canvas, opts) { return new FpsGame(canvas, opts); },
    sync: function (g) { return { score: g.score, kills: g.kills, deaths: g.deaths, hp: g.hp }; }
  },

  g2048: {
    type: 'canvas',
    name: '2048',
    desc: '밀어서 같은 숫자를 합치세요. 2048 을 만들면 승리, 더 못 움직이면 끝',
    howto: '← → ↑ ↓ 로 밀기 · 같은 숫자가 만나면 합쳐짐',
    meta: '개인전 · 퍼즐 · 점수 경쟁',
    primary: '80% 0.12 70', primaryContent: '25% 0.04 70', hex: '#EDC22E',
    grid: { cols: 4, rows: 4 },
    adminView: 'grid',
    needsPeers: false, hasNext: false,
    stats: [{ key: 'best', label: '최고 타일' }, { key: 'moves', label: '이동' }],
    detail: function (g) { return '최고 타일 ' + g.best + ' · ' + g.moves + '번 이동'; },
    controls: ['up', 'left', 'down', 'right'],
    create: function (canvas, opts) { return new Game2048(canvas, opts.cellSize); },
    sync: function (g) { return { board: boardToRows(g.getSnapshot()), score: g.score, best: g.best }; }
  },

  frogger: {
    type: 'canvas',
    name: '길 건너기',
    desc: '차와 강을 피해 위쪽 집까지. 다섯 집을 다 채우면 다음 단계',
    howto: '← → ↑ ↓ 한 칸씩 · 차를 피하고 통나무를 타고 위쪽 집으로',
    meta: '개인전 · 점수 경쟁',
    primary: '82% 0.16 165', primaryContent: '18% 0.05 165', hex: '#2E7D46',
    grid: { cols: 13, rows: 15 },
    adminView: 'grid',
    needsPeers: false, hasNext: false,
    stats: [{ key: 'crossed', label: '도착' }, { key: 'lives', label: '목숨' }],
    detail: function (g) { return g.crossed + '번 도착 · ' + g.level + '단계'; },
    controls: ['up', 'left', 'down', 'right'],
    create: function (canvas, opts) { return new FroggerGame(canvas, opts.cellSize); },
    sync: function (g) { return { board: boardToRows(g.getSnapshot()), score: g.score, crossed: g.crossed }; }
  },

  asteroids: {
    type: 'canvas',
    name: '소행성',
    desc: '좌우로 돌고 ▲ 로 나아가며 소행성을 쏘세요. 큰 것은 둘로 쪼개집니다',
    howto: '↶ ↷ 회전 · ▲ 추진(관성 있음) · 발사 · 화면 끝으로 나가면 반대편에서 나옴',
    meta: '개인전 · 점수 경쟁',
    primary: '75% 0.05 260', primaryContent: '20% 0.02 260', hex: '#C9D1DC',
    grid: { cols: 16, rows: 20 },
    adminView: 'grid',
    needsPeers: false, hasNext: false,
    stats: [{ key: 'wave', label: 'WAVE' }, { key: 'lives', label: '목숨' }],
    detail: function (g) { return g.wave + '번째 파도까지'; },
    controls: ['up', 'left', 'right', 'fire'],
    labels: { up: '▲ 추진', left: '↶', right: '↷', fire: '발사 (꾹)' },
    create: function (canvas, opts) { return new AsteroidsGame(canvas, opts.cellSize); },
    sync: function (g) { return { board: boardToRows(g.getSnapshot()), score: g.score, wave: g.wave }; }
  },

  shooter: {
    type: 'canvas',
    name: '우주 방어',
    desc: '내려오는 적을 쏘아 막으세요. 적이 줄수록 빨라지고, 파도가 갈수록 강해져요',
    howto: '← → 이동 · 발사 꾹 누르면 연사 · 적이 바닥에 닿기 전에 처치',
    meta: '개인전 · 점수 경쟁',
    primary: '68% 0.2 300', primaryContent: '100% 0 0', hex: '#B15DFF',
    grid: { cols: 12, rows: 20 },
    adminView: 'grid',
    needsPeers: false, hasNext: false,
    stats: [{ key: 'wave', label: 'WAVE' }, { key: 'lives', label: '목숨' }],
    detail: function (g) { return g.wave + '번째 파도까지 버팀'; },
    controls: ['left', 'fire', 'right'],
    labels: { fire: '발사 (꾹)' },
    create: function (canvas, opts) { return new ShooterGame(canvas, opts.cellSize); },
    sync: function (g) { return { board: boardToRows(g.getSnapshot()), score: g.score, wave: g.wave }; }
  },

  kart: {
    type: 'canvas',
    name: '카트 레이싱',
    desc: '모두 함께 출발해 아이템을 쓰며 3바퀴를 먼저 도세요',
    howto: '← → 조향 · 상자를 먹으면 아이템 · 아이템 버튼으로 사용 · 3바퀴',
    meta: '실시간 대전 · 순위 경쟁',
    primary: '77.5% 0.154 71', primaryContent: '18% 0.03 71', hex: '#F5A524',
    fullBleed: true,
    adminView: 'shared',
    needsPeers: true, hasNext: false, hasTracks: true,
    controls: ['left', 'item', 'right', 'discard'],
    create: function (canvas, opts) { return new KartGame(canvas, opts); },
    sync: function (g) { return { score: g.score }; }
  },

  /* ───────── 과학 학습 게임 ───────── */
  photo: {
    type: 'html',
    src: 'photo.html',
    appId: 'photo',
    name: '광합성 온실 관리자',
    desc: '빛·이산화탄소·온도를 나눠 주며 여러 식물을 살리는 실시간 관리 게임',
    meta: '중2 · 식물과 에너지',
    primary: '75% 0.19 140', primaryContent: '18% 0.04 140', hex: '#7BE04F',
    adminView: 'list'
  },

  force: {
    type: 'html',
    src: 'force.html',
    appId: 'force',
    name: '힘의 대결: 슈퍼 발사대',
    desc: '고무줄 힘으로 쏘아 구조물을 무너뜨리며 중력·탄성력·마찰력·부력을 배우는 게임',
    meta: '중1 · 여러 가지 힘',
    primary: '72% 0.17 45', primaryContent: '20% 0.04 45', hex: '#FF8A56',
    adminView: 'list'
  },

  body: {
    type: 'html',
    src: 'body.html',
    appId: 'body',
    name: '몸속 여행',
    desc: '영양소·적혈구·산소·요소가 되어 몸속을 여행하는 게임. 소화·순환·호흡·배설 4가지 모드',
    meta: '중2 · 동물과 에너지',
    primary: '78% 0.13 205', primaryContent: '18% 0.04 205', hex: '#4FD1E0',
    adminView: 'list',
    /* 교사가 대결을 출발시킬 수 있는 모드 목록.
       pos 는 게임 안 인체 지도의 기관 좌표(0~1)를 그대로 옮긴 것으로,
       교사 화면에서 같은 자리에 학생을 표시하는 데 씁니다. */
    rooms: [
      { level: 1, tab: '소화계', name: '소화계 — 영양소의 여행', hero: '#E8C070',
        pos: { '입': [.500,.100], '식도': [.497,.195], '위': [.560,.360],
               '소장': [.495,.470], '융털': [.540,.505], '모세혈관': [.578,.522] } },
      { level: 2, tab: '순환계', name: '순환계 — 적혈구의 한 바퀴', hero: '#C0453F',
        pos: { '대정맥': [.468,.230], '우심방': [.470,.268], '우심실': [.474,.312],
               '폐동맥': [.436,.272], '폐': [.392,.296], '폐정맥': [.516,.284],
               '좌심방': [.530,.268], '좌심실': [.536,.314], '대동맥': [.518,.222],
               '모세혈관': [.345,.660] } },
      { level: 3, tab: '호흡계', name: '호흡계 — 산소의 여행', hero: '#7FE3F5',
        pos: { '코': [.500,.068], '기관': [.500,.200], '기관지': [.500,.252],
               '폐포': [.398,.300], '모세혈관': [.408,.320],
               '조직 세포': [.340,.690], '폐': [.398,.300] } },
      { level: 4, tab: '배설계', name: '배설계 — 요소의 여행', hero: '#C9A6FF',
        pos: { '간': [.418,.352], '콩팥동맥': [.560,.398], '사구체': [.588,.412],
               '보먼주머니': [.602,.426], '세뇨관': [.592,.450], '오줌관': [.545,.492],
               '방광': [.500,.542], '요도': [.500,.590] } }
    ]
  }
};

function getGameId() {
  const params = new URLSearchParams(location.search);
  const id = params.get('game');
  return (id && GAMES[id]) ? id : 'tetris';
}

/* 게임별 강조색을 daisyUI 테마에 반영 */
function applyAccent(gameId) {
  const g = GAMES[gameId];
  if (!g) return;
  const r = document.documentElement.style;
  r.setProperty('--p', g.primary);
  r.setProperty('--pc', g.primaryContent);
  r.setProperty('--game-hex', g.hex);
}
