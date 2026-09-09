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
    meta: '개인전 · 점수 경쟁',
    primary: '68.5% 0.163 288', primaryContent: '100% 0 0', hex: '#8B7CF6',
    grid: { cols: 10, rows: 20 },
    adminView: 'grid',
    needsPeers: false, hasNext: true,
    controls: ['left', 'rotate', 'right', 'down', 'drop'],
    create: function (canvas, opts) { return new TetrisGame(canvas, opts.cellSize); },
    sync: function (g) { return { board: boardToRows(g.getSnapshot()), score: g.score }; }
  },

  kart: {
    type: 'canvas',
    name: '카트 레이싱',
    desc: '모두 함께 출발해 아이템을 쓰며 3바퀴를 먼저 도세요',
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
