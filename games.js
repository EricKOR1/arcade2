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
    needsPeers: true, hasTracks: true, trackKind: 'map', hasNext: false,
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
    needsPeers: true, hasTracks: true, trackKind: 'map', hasNext: false,
    stats: [{ key: 'kills', label: 'KILLS' }, { key: 'hp', label: 'HP' }],
    detail: function (g) { return (g.team === 'red' ? '레드 팀' : '블루 팀') + ' · ' + g.kills + '킬 ' + g.deaths + '데스'; },
    controls: ['fire'], padLayout: 'joystick',
    labels: { fire: '발사' },
    create: function (canvas, opts) { return new Fps3DGame(canvas, Object.assign({ teamMode: true }, opts)); },
    sync: function (g) { return { score: g.score, kills: g.kills, deaths: g.deaths, hp: g.hp, team: g.team }; }
  },

  arena: {
    type: 'canvas',
    name: '젬 아레나',
    desc: '탑다운 팀 대전. 캐릭터 6종 중 하나를 골라, 가운데 광산에서 솟는 젬을 모아 한 팀이 10개를 15초 동안 지키면 승리. 수풀에 숨고, 맞히면 궁극기가 찹니다',
    howto: '아래 카드에서 캐릭터 선택 · 조이스틱 이동(총구도 그 방향) · ● 발사(가까운 적 자동 조준, 꾹 = 연사) · ★ 궁극기 · 수풀에 들어가면 안 보임 · 쓰러지면 젬을 떨어뜨림',
    meta: '실시간 팀 대전 · 캐릭터 6종 · 맵 3종 · 최대 30명',
    primary: '75% 0.19 300', primaryContent: '100% 0 0', hex: '#B15DFF',
    grid: { cols: 36, rows: 48 },   // 미니보드용 (맵마다 실제 크기는 엔진이 알려줌)
    adminView: 'grid', fullBleed: true,
    needsPeers: true, realtime: true, hasNext: false, hasTracks: true, trackKind: 'map', mapRegistry: 'arena', chars: true,
    stats: [{ key: 'held', label: '◆ 젬' }, { key: 'kills', label: 'KO' }],
    detail: function (g) { return (g.team === 'r' ? '레드 팀' : '블루 팀') + ' · ' + (g.ch ? g.ch.name : '') + ' · 젬 ' + g.held + ' · KO ' + g.kills + (g.winner ? (g.winner === g.team ? ' · 승리' : ' · 패배') : ''); },
    controls: [], padLayout: 'arena',
    // 팀: 참가 순서대로 번갈아 (레드·블루·레드·…) — id 해시로 정하면 한 팀에 몰릴 수 있습니다
    create: function (canvas, opts) { const ti = opts.teamInfo; return new ArenaGame(canvas, Object.assign({}, opts, { team: ti ? ti.team : (((opts.slot || 0) % 2) ? 'b' : 'r'), teamSlot: ti ? ti.teamSlot : undefined, charId: opts.charId })); },
    sync: function (g) { return { board: boardToRows(g.getSnapshot()), score: g.score, held: g.held, kills: g.kills, team: g.team }; }
  },

  arena3d: {
    type: 'canvas',
    name: '젬 아레나 3D',
    desc: '탑다운 팀 대전. 캐릭터 6종 중 하나를 골라, 가운데 광산에서 솟는 젬을 모아 한 팀이 10개를 15초 동안 지키면 승리. 수풀에 숨고, 맞히면 궁극기가 찹니다',
    howto: '아래 카드에서 캐릭터 선택 · 조이스틱 이동(총구도 그 방향) · ● 발사(가까운 적 자동 조준, 꾹 = 연사) · ★ 궁극기 · 수풀에 들어가면 안 보임 · 쓰러지면 젬을 떨어뜨림',
    meta: '실시간 팀 대전 · 3D · 캐릭터 6종 · 맵 3종 · 최대 30명',
    primary: '75% 0.19 300', primaryContent: '100% 0 0', hex: '#B15DFF',
    grid: { cols: 36, rows: 48 },   // 미니보드용 (맵마다 실제 크기는 엔진이 알려줌)
    adminView: 'grid', fullBleed: true, engine3d: true,
    needsPeers: true, realtime: true, hasNext: false, hasTracks: true, trackKind: 'map', mapRegistry: 'arena', chars: true,
    stats: [{ key: 'held', label: '◆ 젬' }, { key: 'kills', label: 'KO' }],
    detail: function (g) { return (g.team === 'r' ? '레드 팀' : '블루 팀') + ' · ' + (g.ch ? g.ch.name : '') + ' · 젬 ' + g.held + ' · KO ' + g.kills + (g.winner ? (g.winner === g.team ? ' · 승리' : ' · 패배') : ''); },
    controls: [], padLayout: 'arena',
    // 팀: 참가 순서대로 번갈아 (레드·블루·레드·…) — id 해시로 정하면 한 팀에 몰릴 수 있습니다
    create: function (canvas, opts) { const ti = opts.teamInfo; return new ArenaGame3D(canvas, Object.assign({ maxDpr: 1.25 }, opts, { team: ti ? ti.team : (((opts.slot || 0) % 2) ? 'b' : 'r'), teamSlot: ti ? ti.teamSlot : undefined, charId: opts.charId })); },
    sync: function (g) { return { board: boardToRows(g.getSnapshot()), score: g.score, held: g.held, kills: g.kills, team: g.team }; }
  },

  slither: {
    type: 'canvas',
    name: '뱀 아레나',
    desc: '큰 뱀이 작은 뱀을 삼키며 자라는 실시간 대전. 먹이를 먹어 길이를 키우고, 1.5배 이상 크면 상대를 삼킬 수 있어요. 작으면 피하세요',
    howto: '조이스틱으로 방향 · 부스트 버튼(꾹)으로 가속(길이 소모) · 내 머리가 상대 몸에 닿으면 큰 쪽이 이김 · 경기장 벽에 닿으면 죽음',
    meta: '실시간 대전 · 최대 30명 · 개인전 · 맵 5종(인원별 크기)',
    primary: '75% 0.19 160', primaryContent: '100% 0 0', hex: '#06D6A0',
    grid: { cols: 30, rows: 30 },
    adminView: 'grid', fullBleed: true,
    needsPeers: true, realtime: true, hasNext: false, hasTracks: true, trackKind: 'map', mapRegistry: 'slither',   // 맵(인원별 크기) 선택
    stats: [{ key: 'len', label: '길이' }, { key: 'kills', label: '삼킴' }],
    detail: function (g) { return '길이 ' + Math.round(g.len) + ' · 최고 ' + Math.round(Math.max(g.best, g.len)) + ' · 삼킴 ' + g.kills; },
    controls: [], padLayout: 'slither',
    create: function (canvas, opts) { return new SlitherGame(canvas, opts); },
    sync: function (g) { return { board: boardToRows(g.getSnapshot()), score: Math.round(Math.max(g.best, g.len)), len: Math.round(g.len), kills: g.kills }; }
  },

  territory: {
    type: 'canvas',
    name: '땅따먹기 대전',
    desc: '내 땅 밖으로 나가 선을 긋고 돌아오면 둘러싼 곳이 모두 내 땅! 반 전체가 한 경기장에서 실시간으로 땅을 넓혀요',
    howto: '밀기·방향키로 방향 바꾸기 · 내 땅 밖에 있는 동안 꼬리를 밟히면 탈락 · 친구 꼬리를 밟으면 친구가 탈락 · 벽·내 꼬리 조심 · 3초 뒤 다시 시작',
    meta: '실시간 대전 · 최대 30명 · 개인전 · 인기 io 땅따먹기 장르',
    primary: '72% 0.15 230', primaryContent: '100% 0 0', hex: '#4CC9F0',
    grid: { cols: 12, rows: 18 },
    adminView: 'grid', fullBleed: true,
    needsPeers: true, realtime: true, hasNext: false,
    stats: [{ key: 'pct', label: '내 땅(%)' }, { key: 'kills', label: '자르기' }],
    detail: function (g) { return '최고 ' + (Math.round(g.best / 3136 * 1000) / 10) + '% · 꼬리 자르기 ' + g.kills + '번'; },
    controls: ['up', 'left', 'down', 'right'],
    create: function (canvas, opts) { return new TerritoryGame(canvas, opts); },
    sync: function (g) { return { board: boardToRows(g.getSnapshot()), score: g.best, pct: g.pct, kills: g.kills }; }
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

  blockpuzzle: {
    type: 'canvas',
    name: '블록 퍼즐',
    desc: '블록 3개를 8×8 판에 끌어다 놓아요. 가로·세로 한 줄이 꽉 차면 사라져요. 놓을 곳이 없으면 끝',
    howto: '아래 블록을 손가락(마우스)으로 끌어 판에 놓기 · 줄을 연달아 지우면 콤보 · 한 번에 여러 줄이면 큰 점수',
    meta: '개인전 · 퍼즐 · 2026 모바일 다운로드 1위 장르',
    primary: '70% 0.16 250', primaryContent: '100% 0 0', hex: '#4361EE',
    grid: { cols: 8, rows: 12 },
    adminView: 'grid',
    needsPeers: false, hasNext: false,
    stats: [{ key: 'lines', label: '지운 줄' }, { key: 'bestCombo', label: '최고 콤보' }],
    detail: function (g) { return g.lines + '줄 지움 · 최고 콤보 ' + g.bestCombo; },
    controls: [], padLayout: 'drag',
    create: function (canvas, opts) { return new BlockPuzzleGame(canvas, opts.cellSize); },
    sync: function (g) { return { board: boardToRows(g.getSnapshot()), score: g.score, lines: g.lines }; }
  },

  match3: {
    type: 'canvas',
    name: '보석 맞추기',
    desc: '이웃한 보석을 바꿔 같은 보석 3개 이상을 맞춰요. 4개 · L자 · 5개를 맞추면 특수 보석! 이동 안에 목표 점수',
    howto: '보석을 이웃 쪽으로 밀기(또는 두 개를 차례로 톡) · 4개 = 줄 지우기 · L·T자 = 폭탄 · 5개 = 무지개 · 목표를 넘으면 다음 단계(이동 +10)',
    meta: '개인전 · 퍼즐 · 인기 3매치 장르',
    primary: '65% 0.2 330', primaryContent: '100% 0 0', hex: '#D9468F',
    grid: { cols: 8, rows: 9 },
    adminView: 'grid',
    needsPeers: false, hasNext: false,
    stats: [{ key: 'level', label: '단계' }, { key: 'moves', label: '남은 이동' }],
    detail: function (g) { return g.level + '단계 · 최고 ' + g.bestChain + '연쇄 · 특수 보석 ' + g.specials + '개'; },
    controls: [], padLayout: 'drag',
    create: function (canvas, opts) { return new Match3Game(canvas, opts.cellSize); },
    sync: function (g) { return { board: boardToRows(g.getSnapshot()), score: g.score, level: g.level }; }
  },

  stack: {
    type: 'canvas',
    name: '블록 쌓기 타이밍',
    desc: '왔다 갔다 하는 블록을 톡 눌러 멈추세요. 아래 블록과 겹친 부분만 남고 삐져나온 곳은 잘려 떨어집니다',
    howto: '화면 톡(스페이스·↑) = 블록 멈추기 · 딱 맞추면 퍼펙트(크기 유지, 3번 연속부터 다시 커짐) · 완전히 빗나가면 끝 · 층마다 1점 + 퍼펙트 보너스',
    meta: '개인전 · 타이밍 · 하늘 끝까지 탑 쌓기',
    primary: '72% 0.17 330', primaryContent: '100% 0 0', hex: '#E86FC4',
    grid: { cols: 9, rows: 16 },
    adminView: 'grid',
    needsPeers: false, hasNext: false,
    stats: [{ key: 'height', label: '층' }, { key: 'perfects', label: '퍼펙트' }],
    detail: function (g) { return g.height + '층 · 퍼펙트 ' + g.perfects + '번 · 최고 연속 ' + g.bestStreak; },
    controls: [], padLayout: 'tap',
    create: function (canvas, opts) { return new StackGame(canvas, opts.cellSize); },
    sync: function (g) { return { board: boardToRows(g.getSnapshot()), score: g.score, height: g.height, perfects: g.perfects }; }
  },

  watersort: {
    type: 'canvas',
    name: '색깔 물 정리',
    desc: '시험관을 톡, 다른 시험관을 톡! 맨 위 같은 색 물을 옮겨 시험관마다 한 색으로 모으세요',
    howto: '시험관 톡 → 받을 시험관 톡 · 받는 쪽 맨 위가 같은 색이거나 비어 있어야 옮겨짐 · 되돌리기 5번 · 시험관+1 한 번 · 5분 동안 몇 단계 푸나',
    meta: '개인전 · 색 정렬 퍼즐 · 5분 동안 몇 단계?',
    primary: '72% 0.14 230', primaryContent: '100% 0 0', hex: '#4CC9F0',
    grid: { cols: 9, rows: 14 },
    adminView: 'grid',
    needsPeers: false, hasNext: false,
    stats: [{ key: 'level', label: '단계' }, { key: 'solved', label: '푼 수' }],
    detail: function (g) { return g.solved + '단계 풀기 · 옮김 ' + g.totalMoves + '번'; },
    controls: [], padLayout: 'tap',
    create: function (canvas, opts) { return new WaterSortGame(canvas, opts.cellSize); },
    sync: function (g) { return { board: boardToRows(g.getSnapshot()), score: g.score, level: g.level, solved: g.solved }; }
  },

  logic: {
    type: 'canvas',
    name: '두뇌 퍼즐 (스도쿠·네모로직)',
    desc: '해가 하나뿐인 스도쿠·네모로직이 끝없이 만들어집니다. 8분 동안 많이, 빨리, 틀리지 않고 풀어 점수를 모으세요',
    howto: '시작 화면에서 종류·난이도 톡 · 스도쿠: 빈칸 톡 → 아래 숫자 톡 (메모·지우개) · 네모로직: 힌트 숫자만큼 칸 칠하기 (칠하기/X 표시 버튼) · 실수 1번 −15점 · 다 풀면 다음 퍼즐 자동 · 키보드: 화살표 이동, 스페이스 선택/확정',
    meta: '개인전 · 두뇌 퍼즐 · 제한 시간 8분 점수 경쟁',
    primary: '58% 0.2 268', primaryContent: '100% 0 0', hex: '#4361EE',
    grid: { cols: 10, rows: 14 },
    adminView: 'grid',
    needsPeers: false, hasNext: false,
    stats: [{ key: 'solved', label: '푼 퍼즐' }, { key: 'mistakes', label: '실수' }],
    detail: function (g) { return '퍼즐 ' + g.solved + '개 풂 · 실수 ' + g.mistakes + '번'; },
    controls: [], padLayout: 'tap',
    create: function (canvas, opts) { return new LogicPuzzleGame(canvas, opts.cellSize); },
    sync: function (g) { return { board: boardToRows(g.getSnapshot()), score: g.score, solved: g.solved, mistakes: g.mistakes }; }
  },

  slingshot: {
    type: 'canvas',
    name: '새총 물리 놀이',
    desc: '새총으로 돌멩이·물방울을 날려 쓰레기 상자 탑을 무너뜨리고 쓰레기 봉투를 모두 치워요. 포물선 궤적·각도·세기로 배우는 물리',
    howto: '새총을 뒤로 끌었다 놓아 발사 · 끄는 동안 예상 궤적·각도(°)·세기(%) 표시 · 키보드 ←→ 각도, ↑↓ 세기, 스페이스 발사 · 봉투를 다 치우면 다음 단계(남은 공 1개당 +1000) · 공을 다 쓰면 끝',
    meta: '개인전 · 물리 퍼즐 · 포물선 운동',
    primary: '72% 0.17 150', primaryContent: '100% 0 0', hex: '#2FBF71',
    grid: { cols: 10, rows: 14 },
    adminView: 'grid',
    needsPeers: false, hasNext: false,
    stats: [{ key: 'level', label: '단계' }, { key: 'targetsHit', label: '치운 봉투' }],
    detail: function (g) { return '단계 ' + g.level + ' · 봉투 ' + g.targetsHit + '개 · 공 ' + g.shots + '개'; },
    controls: [], padLayout: 'drag',
    create: function (canvas, opts) { return new SlingshotGame(canvas, opts.cellSize); },
    sync: function (g) { return { board: boardToRows(g.getSnapshot()), score: g.score, level: g.level, targetsHit: g.targetsHit }; }
  },

  rhythm: {
    type: 'canvas',
    name: '리듬 터치',
    desc: '네 줄로 떨어지는 노트가 하얀 판정선에 닿을 때 그 줄을 톡! 직접 만든 곡 3개를 연주하세요',
    howto: '노트가 선에 닿을 때 그 줄(화면 아래쪽 절반)을 톡 · 키보드 D F J K 또는 ← ↓ ↑ → · 완벽 ±0.05초 / 좋음 ±0.11초 · 콤보를 이어 S 등급에 도전',
    meta: '개인전 · 리듬 · 곡 3개(쉬움·보통·어려움)',
    primary: '68% 0.2 300', primaryContent: '100% 0 0', hex: '#B15DFF',
    grid: { cols: 8, rows: 14 },
    adminView: 'grid',
    needsPeers: false, hasNext: false,
    stats: [{ key: 'maxCombo', label: '최대 콤보' }, { key: 'accuracy', label: '정확도' }],
    detail: function (g) { return (g.songName || '곡 고르는 중') + ' · ' + g.grade + ' 등급 · 정확도 ' + g.accuracy + '% · 최대 콤보 ' + g.maxCombo; },
    controls: [], padLayout: 'tap',
    create: function (canvas, opts) { return new RhythmGame(canvas, opts.cellSize); },
    sync: function (g) { return { board: boardToRows(g.getSnapshot()), score: g.score, maxCombo: g.maxCombo, accuracy: g.accuracy }; }
  },

  helix: {
    type: 'canvas',
    name: '나선 탑 내려가기',
    desc: '통통 튀는 공 아래로 탑을 돌려 원판의 빈 틈으로 떨어뜨려요. 빨간 조각에 닿으면 끝! 바닥 목표판에 닿으면 다음 단계',
    howto: '화면을 좌우로 끌어 탑 돌리기(←/→ 한 칸씩) · 틈으로 떨어질 때마다 점수 · 3층 이상 한 번에 떨어지면 불꽃 공이 되어 다음 판(빨간 조각도)을 부숨',
    meta: '개인전 · 하이퍼캐주얼 · 나선 탑 내려가기',
    primary: '78% 0.12 220', primaryContent: '0% 0 0', hex: '#4CC9F0',
    grid: { cols: 9, rows: 16 },
    adminView: 'grid',
    needsPeers: false, hasNext: false,
    stats: [{ key: 'level', label: '단계' }, { key: 'floorsPassed', label: '지난 층' }],
    detail: function (g) { return g.level + '단계 · ' + g.floorsPassed + '층 · 불꽃 ' + g.smashes + '번'; },
    controls: [], padLayout: 'drag',
    create: function (canvas, opts) { return new HelixGame(canvas, opts.cellSize); },
    sync: function (g) { return { board: boardToRows(g.getSnapshot()), score: g.score, level: g.level, floorsPassed: g.floorsPassed }; }
  },

  runner: {
    type: 'canvas',
    name: '지하철 달리기',
    desc: '철길 3줄을 달려요. 열차는 옆 줄로 피하고, 낮은 차단봉은 점프, 높은 차단봉은 미끄러지기. 동전을 모아요',
    howto: '← → (밀기) 줄 바꾸기 · ↑ (위로 밀기·톡) 점프 · ↓ (아래로 밀기) 미끄러지기 · 🧲 자석 · 🛡 방패(한 번 버팀)',
    meta: '개인전 · 무한 달리기 · 다운로드 상위 장르',
    primary: '72% 0.17 45', primaryContent: '100% 0 0', hex: '#FF7A1A',
    grid: { cols: 9, rows: 16 },
    adminView: 'grid',
    needsPeers: false, hasNext: false,
    stats: [{ key: 'best', label: '거리(m)' }, { key: 'coins', label: '동전' }],
    detail: function (g) { return Math.floor(g.dist) + 'm · 동전 ' + g.coins + '개'; },
    controls: ['up', 'left', 'down', 'right'],
    create: function (canvas, opts) { return new RunnerGame(canvas, opts.cellSize); },
    sync: function (g) { return { board: boardToRows(g.getSnapshot()), score: g.score, dist: Math.floor(g.dist), coins: g.coins }; }
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

  frogger3d: {
    type: 'canvas',
    name: '길 건너기 3D',
    desc: '차와 강을 피해 위쪽 집까지. 다섯 집을 다 채우면 다음 단계',
    howto: '화면을 톡 = 앞으로 · 쓸면 그 방향으로 · 방향 버튼도 가능 · ← → ↑ ↓ 한 칸씩 · 차를 피하고 통나무를 타고 위쪽 집으로',
    meta: '개인전 · 점수 경쟁',
    primary: '82% 0.16 165', primaryContent: '18% 0.05 165', hex: '#2E7D46',
    grid: { cols: 13, rows: 15 },
    adminView: 'grid', engine3d: true, fullBleed: true,
    needsPeers: false, hasNext: false,
    stats: [{ key: 'crossed', label: '도착' }, { key: 'lives', label: '목숨' }],
    detail: function (g) { return g.crossed + '번 도착 · ' + g.level + '단계'; },
    controls: ['up', 'left', 'down', 'right'],
    create: function (canvas, opts) { return new FroggerGame3D(canvas, opts); },
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

  maze: {
    type: 'canvas',
    name: '미로 추격',
    desc: '청소 로봇으로 미로의 에너지 셀을 모두 모으세요. 순찰 드론 넷이 쫓아옵니다',
    howto: '← → ↑ ↓ 로 방향 예약(갈림길에서 꺾임) · 파란 파워 셀을 먹으면 잠깐 드론을 잡을 수 있음 · 양옆 끝은 터널',
    meta: '개인전 · 역대 인기 1위 장르',
    primary: '82% 0.16 165', primaryContent: '18% 0.05 165', hex: '#06D6A0',
    grid: { cols: 19, rows: 21 },
    adminView: 'grid',
    needsPeers: false, hasNext: false,
    stats: [{ key: 'dotsLeft', label: '남은 셀' }, { key: 'lives', label: '목숨' }],
    detail: function (g) { return g.level + '단계 · 셀 ' + g.dotsLeft + '개 남음'; },
    controls: ['up', 'left', 'down', 'right'],
    create: function (canvas, opts) { return new MazeGame(canvas, opts.cellSize); },
    sync: function (g) { return { board: boardToRows(g.getSnapshot()), score: g.score, level: g.level }; }
  },

  tower: {
    type: 'canvas',
    name: '타워 오르기',
    desc: '굴러오는 통을 뛰어넘고 사다리를 타고 꼭대기까지. 올라갈수록 통이 빨라집니다',
    howto: '← → 이동 · ▲ 사다리 타기(내려올 땐 ▼) · 점프로 통 넘기(+50) · 꼭대기 GOAL 에 닿으면 다음 층',
    meta: '개인전 · 역대 인기 2위 장르',
    primary: '75% 0.18 350', primaryContent: '100% 0 0', hex: '#FF5C7A',
    grid: { cols: 14, rows: 22 },
    adminView: 'grid',
    needsPeers: false, hasNext: false,
    stats: [{ key: 'climbed', label: '등반' }, { key: 'lives', label: '목숨' }],
    detail: function (g) { return g.climbed + '번 등반 · ' + g.level + '층'; },
    controls: ['left', 'right', 'up', 'down', 'jump'], padLayout: 'climb',
    labels: { up: '▲ 오르기', down: '▼', jump: '점프' },
    create: function (canvas, opts) { return new TowerGame(canvas, opts.cellSize); },
    sync: function (g) { return { board: boardToRows(g.getSnapshot()), score: g.score, climbed: g.climbed }; }
  },

  missile: {
    type: 'canvas',
    name: '미사일 방어',
    desc: '화면을 톡 누르면 그 자리에 요격탄이 터집니다. 떨어지는 미사일에서 도시 여섯을 지키세요',
    howto: '미사일이 지나갈 자리를 톡 누르기 · 탄은 파도마다 정해져 있으니 아껴 쓰기 · 3파도마다 도시 하나 복구',
    meta: '개인전 · 역대 인기 6위 · 손가락으로 조준',
    primary: '75% 0.16 290', primaryContent: '100% 0 0', hex: '#7C6AF6',
    grid: { cols: 16, rows: 20 },
    adminView: 'grid',
    needsPeers: false, hasNext: false,
    stats: [{ key: 'wave', label: 'WAVE' }, { key: 'citiesLeft', label: '도시' }],
    detail: function (g) { return g.wave + '번째 파도까지 · 도시 ' + g.saved + '개 지킴'; },
    controls: [], padLayout: 'tap',
    create: function (canvas, opts) { return new MissileGame(canvas, opts.cellSize); },
    sync: function (g) { return { board: boardToRows(g.getSnapshot()), score: g.score, wave: g.wave }; }
  },

  centipede: {
    type: 'canvas',
    name: '지네 사냥',
    desc: '버섯밭 사이로 내려오는 지네를 쏘세요. 맞은 마디는 버섯이 되고 지네는 둘로 갈라집니다',
    howto: '← → 이동 · 발사(꾹) · 머리를 맞히면 100점 · 버섯은 3발에 사라짐 · 지네가 닿으면 목숨 -1',
    meta: '개인전 · 역대 인기 12위',
    primary: '75% 0.2 300', primaryContent: '100% 0 0', hex: '#A78BFA',
    grid: { cols: 16, rows: 24 },
    adminView: 'grid',
    needsPeers: false, hasNext: false,
    stats: [{ key: 'wave', label: 'WAVE' }, { key: 'lives', label: '목숨' }],
    detail: function (g) { return g.wave + '번째 지네까지'; },
    controls: ['left', 'fire', 'right'],
    labels: { fire: '발사 (꾹)' },
    create: function (canvas, opts) { return new CentipedeGame(canvas, opts.cellSize); },
    sync: function (g) { return { board: boardToRows(g.getSnapshot()), score: g.score, wave: g.wave }; }
  },

  source: {
    type: 'canvas',
    name: '오염원 추적 퍼즐',
    desc: '센서 몇 개의 값과 물·바람의 흐름으로 오염이 어디서 시작됐는지 알아맞히세요. 수질 사건과 악취 사건이 번갈아 나옵니다',
    howto: '화면을 톡 → 센서 설치(값 0~100) · 핀을 두 번 톡 → 지목 · 수질: 하류로 퍼지고 상류는 0 · 악취: 바람 방향으로 퍼짐 → 거슬러 올라가기 · 센서를 적게 쓰고 빨리 맞힐수록 고득점 · 틀리면 ♥ 하나',
    meta: '개인전 · 환경 × AI 추리 · 울산 특강 연계',
    primary: '75% 0.14 200', primaryContent: '100% 0 0', hex: '#4CC9F0',
    grid: { cols: 12, rows: 16 },
    adminView: 'grid',
    needsPeers: false, hasNext: false,
    stats: [{ key: 'solved', label: '해결' }, { key: 'lives', label: '♥' }],
    detail: function (g) { return g.round + '라운드 · ' + g.solved + '건 해결 · 오답 ' + g.wrong; },
    controls: [], padLayout: 'tap',
    create: function (canvas, opts) { return new SourceHuntGame(canvas, opts.cellSize); },
    sync: function (g) { return { board: boardToRows(g.getSnapshot()), score: g.score, solved: g.solved }; }
  },

  ulsan: {
    type: 'canvas',
    name: '울산 환경 수사대 3D',
    desc: '실제 울산 지도를 3D로 돌아다니며 직접 조사한 사실로 오염물질·범인 시설·정확한 배출 지점·배출 시각을 밝히는 추리 롤플레잉. 교사가 난이도·사건 수·사건당 시간을 정하고, 총점과 시간으로 순위를 매깁니다',
    howto: '조이스틱(WASD) 이동 · 🔍 조사/대화(E) · 왼쪽 위 할 일을 누르면 📋 자세히 · 📍·🚙 로 갈 곳 찾기 · ⚗️ 시약 실험 → 연구원 분석 · 🔬 물벼룩 독성 지도 / 🧭 바람길 → 시설 서류 · ⭐ 미니게임 별 · 🚨 긴급 추격 · 사건마다 제한 시간 안에 📝 보고서',
    meta: '개인 추리 RPG · 3D · 난이도 3단계 · 울산 특강 연계',
    primary: '70% 0.16 150', primaryContent: '100% 0 0', hex: '#1FBF6A',
    grid: { cols: 30, rows: 30 },
    adminView: 'grid', fullBleed: true, engine3d: true,
    needsPeers: false, feed: true, hasNext: false, overText: '수사 종료',   // feed: 반 친구 소식 (events) 만 받음
    hasTracks: true, trackKind: 'map', mapRegistry: 'ulsan',   // 교사 화면에서 난이도·사건 수·사건당 시간을 고름 (track = 'normal:2:20')
    stats: [{ key: 'evidenceCount', label: '증거' }, { key: 'score', label: '점수' }],
    detail: function (g) { return g.done ? ('수사 완료 · ' + g.casesStr + ' · ' + g.score + '/' + (g.caseTotal * 100) + '점 · ' + g.set.name) : ('사건 ' + g.caseNo + '/' + g.caseTotal + ' · ' + (g.results.length ? g.casesStr + ' · ' : '') + '증거 ' + g.evidenceCount + '건'); },
    controls: [], padLayout: 'rpg',
    create: function (canvas, opts) { return new UlsanRpgGame(canvas, opts); },
    // 순위표(교사 화면)용: 진행 사건 · 사건별 등급 · 해결 수 · 끝냈는지 · 걸린 시간(초)
    sync: function (g) { return { board: boardToRows(g.getSnapshot()), score: g.score, ev: g.evidenceCount, caseNo: g.caseNo, caseTotal: g.caseTotal, cases: g.casesStr, solved: g.solvedCount, done: g.done, secs: g.done ? g.elapsedSec : 0, left: Math.ceil(g.caseLeftSec / 5) * 5, sid: (g.opts && g.opts.seed) || 0 }; }   // 남은 시간은 5초 단위 · 걸린 시간은 끝났을 때만 (매초 바뀌면 매초 전송됨)
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
    detail: function (g) { const fmt = ms => { const s2 = ms / 1000; return Math.floor(s2 / 60) + ':' + (s2 % 60).toFixed(1).padStart(4, '0'); };
      return (g.finishRank ? g.finishRank + '위로 완주' : Math.max(1, g.lap + 1) + '바퀴째') + (g.bestLap ? ' · 최고 랩 ' + fmt(g.bestLap) : ''); },
    controls: [], padLayout: 'kart3dx',
    create: function (canvas, opts) { return new KartGame(canvas, opts); },
    sync: function (g) { return { score: g.score }; }
  },

  kart3d: {
    type: 'canvas',
    name: '카트 레이싱 3D',
    desc: '모두 함께 출발해 아이템을 쓰며 3바퀴를 먼저 도세요',
    howto: '← → 조향 · 상자를 먹으면 아이템 · 아이템 버튼으로 사용 · 3바퀴',
    meta: '실시간 대전 · 순위 경쟁',
    primary: '77.5% 0.154 71', primaryContent: '18% 0.03 71', hex: '#F5A524',
    fullBleed: true, engine3d: true,
    adminView: 'shared',
    needsPeers: true, hasNext: false, hasTracks: true,
    detail: function (g) { const fmt = ms => { const s2 = ms / 1000; return Math.floor(s2 / 60) + ':' + (s2 % 60).toFixed(1).padStart(4, '0'); };
      return (g.finishRank ? g.finishRank + '위로 완주' : Math.max(1, g.lap + 1) + '바퀴째') + (g.bestLap ? ' · 최고 랩 ' + fmt(g.bestLap) : ''); },
    controls: [], padLayout: 'kart3dx',
    create: function (canvas, opts) { return new KartGame3D(canvas, Object.assign({ maxDpr: 1.25 }, opts)); },
    sync: function (g) { return { score: g.score }; }
  },

  /* ───────── 과학 학습 게임 ───────── */
  kartpure: {
    type: 'canvas',
    name: '카트 레이싱 (노템전)',
    desc: '아이템 없이 주행 실력만으로 3바퀴. 부스터 발판과 코너 공략이 승부처',
    howto: '← → 조향만 · 아이템 없음 · 부스터 발판을 밟고 코너에서 안쪽을 노리세요',
    meta: '실시간 대전 · 순위 경쟁 · 노템전',
    primary: '78% 0.13 230', primaryContent: '20% 0.04 230', hex: '#4CC9F0',
    fullBleed: true,
    adminView: 'shared',
    needsPeers: true, hasNext: false, hasTracks: true,
    detail: function (g) { const fmt = ms => { const s2 = ms / 1000; return Math.floor(s2 / 60) + ':' + (s2 % 60).toFixed(1).padStart(4, '0'); };
      return (g.finishRank ? g.finishRank + '위로 완주' : Math.max(1, g.lap + 1) + '바퀴째') + (g.bestLap ? ' · 최고 랩 ' + fmt(g.bestLap) : ''); },
    controls: [], padLayout: 'kart3dx',
    create: function (canvas, opts) { return new KartGame(canvas, Object.assign({ noItems: true }, opts)); },
    sync: function (g) { return { score: g.score }; }
  },

  kartpure3d: {
    type: 'canvas',
    name: '카트 레이싱 3D (노템전)',
    desc: '아이템 없이 주행 실력만으로 3바퀴. 부스터 발판과 코너 공략이 승부처',
    howto: '← → 조향만 · 아이템 없음 · 부스터 발판을 밟고 코너에서 안쪽을 노리세요',
    meta: '실시간 대전 · 순위 경쟁 · 노템전',
    primary: '78% 0.13 230', primaryContent: '20% 0.04 230', hex: '#4CC9F0',
    fullBleed: true, engine3d: true,
    adminView: 'shared',
    needsPeers: true, hasNext: false, hasTracks: true,
    detail: function (g) { const fmt = ms => { const s2 = ms / 1000; return Math.floor(s2 / 60) + ':' + (s2 % 60).toFixed(1).padStart(4, '0'); };
      return (g.finishRank ? g.finishRank + '위로 완주' : Math.max(1, g.lap + 1) + '바퀴째') + (g.bestLap ? ' · 최고 랩 ' + fmt(g.bestLap) : ''); },
    controls: [], padLayout: 'kart3dx',
    create: function (canvas, opts) { return new KartGame3D(canvas, Object.assign({ noItems: true, maxDpr: 1.25 }, opts)); },
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
