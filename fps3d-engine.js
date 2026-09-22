// 레이저 태그 3D (Three.js) — 1인칭 시점. 개인전 · 팀전.
// 왼쪽 조이스틱으로 이동, 화면을 끌어 조준(상하 포함), 오른쪽 발사(꾹) · 재장전.
// 낮의 야외 훈련장. 30발 탄창, 3발이면 다운(머리는 2발), 3초 뒤 재등장.

// ── 맵 생성: 44×44 야외 훈련장 (회전 대칭) ──
//  # 외벽·콘크리트(2.4)  = 금속 격벽(2.4)  B 벽돌(2.4)  H 건물(4.0)  X 상자(1.0)  L 낮은 방벽(0.6)  . 바닥
function f3BuildMap() {
  const N = 44, g = [];
  for (let y = 0; y < N; y++) { g.push(new Array(N).fill('.')); }
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = c; };
  const rect = (x0, y0, w, h, c, fill) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1; if (edge || fill) set(x, y, c); } };
  // 외벽
  rect(0, 0, N, N, '#');
  // 한 사분면을 그리고 4방향으로 회전 복사
  const quad = (fn) => { fn((x, y, c) => { set(x, y, c); set(N - 1 - y, x, c); set(N - 1 - x, N - 1 - y, c); set(y, N - 1 - x, c); }); };
  quad(put => {
    // 모서리 건물 (9×7) — 안쪽 두 면에 출입구
    for (let y = 3; y < 10; y++) for (let x = 3; x < 12; x++) { const edge = x === 3 || y === 3 || x === 11 || y === 9; if (edge) put(x, y, 'H'); }
    put(11, 6, '.'); put(7, 9, '.'); put(8, 9, '.');                   // 출입구
    put(6, 6, 'X');                                                    // 건물 안 상자
    // 건물 앞 낮은 방벽과 상자
    put(14, 5, 'L'); put(14, 6, 'L'); put(14, 7, 'L'); put(15, 11, 'X'); put(16, 11, 'X');
    // 옆으로 뻗은 벽돌 벽 (골목)
    for (let x = 3; x < 9; x++) put(x, 13, 'B'); put(9, 13, '.'); for (let x = 10; x < 14; x++) put(x, 13, 'B');
    // 금속 격벽 (사선 진입 차단) + 엄폐 상자
    for (let y = 15; y < 19; y++) put(6, y, '='); put(8, 17, 'X'); put(9, 17, 'X');
    put(12, 16, 'L'); put(12, 17, 'L');
  });
  // 중앙 광장: 금속 링(14×14) 에 4방향 출입구, 안에 십자 상자와 낮은 방벽
  rect(15, 15, 14, 14, '=');
  [[21, 15], [22, 15], [21, 28], [22, 28], [15, 21], [15, 22], [28, 21], [28, 22]].forEach(([x, y]) => set(x, y, '.'));
  [[19, 19], [24, 19], [19, 24], [24, 24]].forEach(([x, y]) => { set(x, y, 'X'); });
  [[21, 18], [22, 18], [21, 25], [22, 25], [18, 21], [18, 22], [25, 21], [25, 22]].forEach(([x, y]) => set(x, y, 'L'));
  set(21, 21, 'X'); set(22, 22, 'X');
  return g.map(r => r.join(''));
}
// 구조물 종류와 높이: # 콘크리트 벽 · = 금속 격벽 · B 벽돌 · H 높은 건물 · X 상자 · L 낮은 방벽
//                    P 기둥(원통) · T 나무 · R 바위(낮고 둥긂) · W 창문벽(1.2, 위로 쏠 수 있음)
const F3_HEIGHT = { '#': 2.4, '=': 2.4, 'B': 2.4, 'H': 4.0, 'X': 1.0, 'L': 0.6, 'P': 2.4, 'T': 3.2, 'R': 0.8, 'W': 1.2 };

// ── 맵 도구 ──
function f3Grid(N) {
  const g = []; for (let y = 0; y < N; y++) g.push(new Array(N).fill('.'));
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = c; };
  const rect = (x0, y0, w, h, c, fill) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1; if (edge || fill) set(x, y, c); } };
  const line = (x0, y0, x1, y1, c) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) set(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), c); };
  const sym = (fn) => fn((x, y, c) => { set(x, y, c); set(N - 1 - x, N - 1 - y, c); });   // 점대칭 (두 팀 공평)
  const quad = (fn) => fn((x, y, c) => { set(x, y, c); set(N - 1 - y, x, c); set(N - 1 - x, N - 1 - y, c); set(y, N - 1 - x, c); });
  return { g, N, set, rect, line, sym, quad, rows: () => g.map(r => r.join('')) };
}

// 사막 마을 — 긴 중앙 거리(저격 라인) + 양옆 골목 두 갈래. 3갈래 통로의 정석
function f3MapDesert() {
  const m = f3Grid(44), { set, rect, line, sym } = m;
  rect(0, 0, 44, 44, '#');
  sym(put => {
    // 팀 진영 건물 (왼쪽 위)
    for (let y = 2; y < 10; y++) for (let x = 2; x < 12; x++) { const e = x === 2 || y === 2 || x === 11 || y === 9; if (e) put(x, y, 'H'); }
    put(11, 5, '.'); put(11, 6, '.'); put(6, 9, '.'); put(7, 9, '.');
    put(5, 5, 'X'); put(8, 6, 'X');
    // 중앙 거리 양옆 건물 (긴 벽)
    for (let x = 14; x < 30; x++) put(x, 16, 'B'); put(19, 16, '.'); put(20, 16, '.'); put(26, 16, 'W'); put(27, 16, 'W');
    // 왼쪽 골목: 기둥 회랑
    for (let y = 12; y < 32; y += 4) put(4, y, 'P');
    for (let y = 14; y < 30; y += 4) put(8, y, 'P');
    put(6, 20, 'L'); put(6, 21, 'L'); put(7, 25, 'X');
    // 위쪽 골목: 상자와 바위
    put(16, 5, 'X'); put(17, 5, 'X'); put(24, 4, 'R'); put(25, 4, 'R'); put(30, 6, 'L'); put(30, 7, 'L');
    for (let x = 14; x < 20; x++) put(x, 10, 'B'); put(20, 10, '.'); for (let x = 21; x < 26; x++) put(x, 10, 'B');
    // 진영 앞 우물·바위
    put(12, 12, 'R'); put(13, 13, 'R');
  });
  // 중앙: 광장의 우물 (기둥 4개 + 낮은 벽)
  [[20, 20], [23, 20], [20, 23], [23, 23]].forEach(([x, y]) => set(x, y, 'P'));
  [[22, 19], [21, 24], [19, 21], [24, 22]].forEach(([x, y]) => set(x, y, 'L'));   // 네 방향에 틈
  set(21, 21, 'X'); set(22, 22, 'X');
  return { rows: m.rows(), spawns: [[6.5, 5.5], [37.5, 38.5], [4.5, 6.5], [39.5, 37.5], [8.5, 4.5], [35.5, 39.5], [5.5, 20.5], [38.5, 23.5], [21.5, 5.5], [22.5, 38.5], [12.5, 30.5], [31.5, 13.5]] };
}
// 창고 구역 — 실내. 선반(높은 벽) 줄이 통로를 만들고 상자 무더기가 엄폐. 근접전 위주
function f3MapWarehouse() {
  const m = f3Grid(40), { set, rect, sym } = m;
  rect(0, 0, 40, 40, '#');
  sym(put => {
    // 선반 줄 (세로) 3개, 사이사이 틈
    [8, 16, 24].forEach(cx => { for (let y = 4; y < 20; y++) { if (y === 9 || y === 10 || y === 15) continue; put(cx, y, 'H'); } });
    // 상자 무더기
    [[4, 4], [5, 4], [4, 5], [12, 6], [12, 7], [20, 5], [21, 5], [28, 8], [29, 8], [29, 9], [33, 4], [34, 4], [34, 5], [36, 12]].forEach(([x, y]) => put(x, y, 'X'));
    [[11, 12], [13, 12], [19, 12], [27, 12], [5, 14], [6, 14]].forEach(([x, y]) => put(x, y, 'L'));
    // 사무실 (벽돌) 모서리
    for (let y = 2; y < 8; y++) put(37, y, 'B'); for (let x = 32; x < 38; x++) put(x, 8, 'B'); put(37, 4, '.'); put(35, 8, '.');
    // 금속 격벽
    for (let x = 30; x < 38; x++) put(x, 16, '='); put(33, 16, '.'); put(34, 16, '.');
    put(31, 14, 'P'); put(36, 14, 'P');
  });
  // 중앙 하역장: 팔레트 상자 링
  [[17, 17], [22, 17], [17, 22], [22, 22]].forEach(([x, y]) => set(x, y, 'X'));
  [[20, 18], [19, 21], [18, 19], [21, 20]].forEach(([x, y]) => set(x, y, 'L'));   // 네 방향에 틈
  return { rows: m.rows(), spawns: [[3.5, 3.5], [36.5, 36.5], [3.5, 8.5], [36.5, 31.5], [10.5, 3.5], [29.5, 36.5], [3.5, 30.5], [36.5, 9.5], [30.5, 3.5], [9.5, 36.5], [14.5, 9.5], [25.5, 30.5]] };
}
// 설원 기지 — 넓은 눈밭에 중앙 관제탑(높은 블록)과 눈 둔덕(낮은 방벽). 중거리 교전
function f3MapArctic() {
  const m = f3Grid(44), { set, rect, sym, quad } = m;
  rect(0, 0, 44, 44, '#');
  quad(put => {
    // 모서리 격납고
    for (let y = 3; y < 9; y++) for (let x = 3; x < 11; x++) { const e = x === 3 || y === 3 || x === 10 || y === 8; if (e) put(x, y, '='); }
    put(10, 5, '.'); put(10, 6, '.'); put(6, 8, '.'); put(7, 8, '.');
    // 눈 둔덕 (낮은 방벽)
    [[13, 6], [14, 6], [15, 6], [6, 13], [6, 14], [6, 15]].forEach(([x, y]) => put(x, y, 'L'));
    // 바위
    [[16, 12], [12, 16], [17, 13]].forEach(([x, y]) => put(x, y, 'R'));
    // 소나무 숲
    [[3, 13], [4, 15], [3, 18], [13, 3], [15, 4], [18, 3]].forEach(([x, y]) => put(x, y, 'T'));
    // 보급 상자
    put(9, 12, 'X'); put(12, 9, 'X');
  });
  // 중앙 관제탑 (십자 높은 블록) + 주변 창문벽
  [[21, 21], [22, 21], [21, 22], [22, 22]].forEach(([x, y]) => set(x, y, 'H'));
  [[21, 18], [22, 18], [21, 25], [22, 25], [18, 21], [18, 22], [25, 21], [25, 22]].forEach(([x, y]) => set(x, y, 'W'));
  [[19, 19], [24, 19], [19, 24], [24, 24]].forEach(([x, y]) => set(x, y, 'P'));
  return { rows: m.rows(), spawns: [[6.5, 5.5], [37.5, 38.5], [37.5, 5.5], [6.5, 38.5], [22, 2.5], [2.5, 22], [41.5, 22], [22, 41.5], [9.5, 20.5], [34.5, 23.5], [20.5, 34.5], [23.5, 9.5]] };
}
// 네온 시티 — 밤. 건물 블록 사이 세 갈래 거리, 가로등 기둥과 차량(상자). 교차로 전투
function f3MapCity() {
  const m = f3Grid(44), { set, rect, sym } = m;
  rect(0, 0, 44, 44, '#');
  sym(put => {
    // 건물 블록 (높은 벽 사각형)
    [[3, 3, 8, 6], [14, 3, 7, 5], [3, 12, 6, 7], [12, 11, 9, 6], [24, 3, 8, 6], [35, 3, 6, 8], [3, 22, 7, 6]].forEach(([x, y, w, h]) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const e = xx === x || yy === y || xx === x + w - 1 || yy === y + h - 1; if (e) put(xx, yy, 'H'); } });
    // 건물 출입구 몇 개 (안으로 들어가 매복)
    put(6, 8, '.'); put(17, 7, '.'); put(8, 15, '.'); put(20, 13, '.'); put(27, 8, '.'); put(38, 10, '.'); put(35, 6, '.'); put(9, 24, '.'); put(6, 27, '.');
    // 가로등 기둥
    [[11, 9], [22, 9], [11, 20], [22, 20], [33, 12], [30, 20]].forEach(([x, y]) => put(x, y, 'P'));
    // 주차된 차량 (상자) · 화분(바위)
    [[12, 2], [13, 2], [23, 10], [24, 10], [9, 19], [10, 19], [32, 14], [32, 15]].forEach(([x, y]) => put(x, y, 'X'));
    [[10, 11], [22, 12], [29, 4]].forEach(([x, y]) => put(x, y, 'R'));
    // 공사 방벽
    [[26, 12], [27, 12], [28, 12]].forEach(([x, y]) => put(x, y, 'L'));
  });
  // 중앙 교차로: 분수(낮은 링) + 기둥
  // 분수: 낮은 링에 네 방향 틈 · 가운데 기둥 하나
  [[20, 20], [22, 20], [23, 20], [20, 23], [21, 23], [23, 23], [20, 21], [23, 22]].forEach(([x, y]) => set(x, y, 'L'));
  set(21, 21, 'P');
  return { rows: m.rows(), spawns: [[2.5, 10.5], [41.5, 33.5], [11.5, 1.5], [32.5, 42.5], [2.5, 20.5], [41.5, 23.5], [22.5, 1.5], [21.5, 42.5], [11.5, 30.5], [32.5, 13.5], [30.5, 30.5], [13.5, 13.5]] };
}
// 정글 유적 — 나무가 시야를 가르고, 중앙에 돌 신전. 매복과 우회
function f3MapJungle() {
  const m = f3Grid(44), { set, rect, sym, quad } = m;
  rect(0, 0, 44, 44, '#');
  // 나무 군락 (점대칭)
  sym(put => {
    [[4, 6], [6, 4], [9, 8], [13, 5], [5, 13], [10, 15], [16, 11], [3, 20], [8, 24], [14, 20], [19, 5], [24, 8], [29, 4], [34, 7], [38, 12], [12, 30], [17, 27], [6, 34], [4, 28], [21, 33]].forEach(([x, y]) => put(x, y, 'T'));
    [[7, 10], [15, 8], [11, 12], [20, 9], [9, 20], [26, 5], [36, 10], [30, 9]].forEach(([x, y]) => put(x, y, 'R'));
    // 무너진 돌담
    for (let x = 2; x < 9; x++) put(x, 17, 'B'); put(5, 17, '.'); for (let y = 2; y < 9; y++) put(17, y, 'B'); put(17, 5, '.');
    // 진영 오두막
    for (let y = 2; y < 6; y++) for (let x = 2; x < 6; x++) { const e = x === 2 || y === 2 || x === 5 || y === 5; if (e) put(x, y, 'B'); } put(5, 3, '.'); put(3, 5, '.');
    put(12, 24, 'W'); put(13, 24, 'W'); put(24, 13, 'W'); put(24, 12, 'W');
  });
  // 중앙 신전: 두 겹 돌 링 + 기둥
  quad(put => { for (let x = 16; x < 22; x++) put(x, 16, '='); put(19, 16, '.'); put(20, 16, '.'); put(17, 18, 'P'); });
  [[21, 21], [22, 21], [21, 22], [22, 22]].forEach(([x, y]) => set(x, y, 'H'));
  return { rows: m.rows(), spawns: [[3.5, 3.5], [40.5, 40.5], [7.5, 3.5], [36.5, 40.5], [3.5, 8.5], [40.5, 35.5], [22, 2.5], [22, 41.5], [2.5, 22], [41.5, 22], [12.5, 12.5], [31.5, 31.5]] };
}

const F3_THEMES = {
  plaza:     { sky: ['#5FA8FF', '#A9D3FF', '#E8F3FF'], fog: [0xCFE6FF, 28, 95], sun: 0xFFF2D6, hemi: [0xCFE8FF, 0x8A7A5A], floor: ['#C9BFA6', 'rgba(0,0,0,0.18)'], ground: 0xC9B98E,
               walls: { '#': '#B9BFC9', '=': '#8F98A8', B: '#9A5A50', X: '#B98A55', P: '#C9CFD8', T: '#2E7D46', R: '#8A8F98', W: '#B9BFC9' }, far: 'hills', decor: 'barrels', night: false },
  desert:    { sky: ['#FF9A6A', '#FFC98A', '#FFE9C7'], fog: [0xF2C9A0, 24, 90], sun: 0xFFE3B0, hemi: [0xFFD9B0, 0xA3703E], floor: ['#D9B78A', 'rgba(120,70,20,0.18)'], ground: 0xD4A86A,
               walls: { '#': '#D8B98F', '=': '#9C8A70', B: '#C58C5A', X: '#B98A55', P: '#E0C8A0', T: '#5E8C3A', R: '#A8815A', W: '#D8B98F' }, far: 'mesas', decor: 'cactus', night: false },
  warehouse: { sky: ['#0B0F1C', '#161C2E', '#232B45'], fog: [0x141A2A, 14, 60], sun: 0xB9C6E8, hemi: [0x3A4460, 0x1A1C22], floor: ['#5A5F6C', 'rgba(0,0,0,0.35)'], ground: 0x2A2E38,
               walls: { '#': '#6C7484', '=': '#7C8798', B: '#7A4E45', X: '#A67C4E', P: '#8A93A3', T: '#2E7D46', R: '#6A6F78', W: '#6C7484' }, far: 'none', decor: 'lamps', night: true },
  arctic:    { sky: ['#9FCBFF', '#D6E9FF', '#F4F9FF'], fog: [0xE6F0FF, 26, 80], sun: 0xFFFFFF, hemi: [0xEAF4FF, 0x9FB4C8], floor: ['#EAF0F6', 'rgba(120,150,190,0.22)'], ground: 0xE3ECF4,
               walls: { '#': '#C9D6E6', '=': '#9FB4CC', B: '#8C9AB0', X: '#B8905C', P: '#DCE6F2', T: '#2F5F3E', R: '#B7C2CF', W: '#C9D6E6' }, far: 'peaks', decor: 'snow', night: false },
  city:      { sky: ['#0A0C1F', '#1B1F45', '#3A2C6E'], fog: [0x1E2244, 20, 70], sun: 0xC9B8FF, hemi: [0x6E5FCC, 0x1A1B2E], floor: ['#3E4250', 'rgba(255,255,255,0.10)'], ground: 0x2B2E3A,
               walls: { '#': '#3F4658', '=': '#586274', B: '#5A3E44', X: '#5B6CA8', P: '#9AA6B8', T: '#2E7D46', R: '#4C5262', W: '#3F4658' }, far: 'city', decor: 'neon', night: true },
  jungle:    { sky: ['#6FB5D6', '#BFE3EE', '#E9F6F2'], fog: [0xBFDCC8, 18, 70], sun: 0xFFF4CC, hemi: [0xD6F0DC, 0x3E5A2E], floor: ['#5E7A3E', 'rgba(0,0,0,0.22)'], ground: 0x4F6A34,
               walls: { '#': '#7E8A72', '=': '#8C9080', B: '#8A8A7A', X: '#A6804E', P: '#B4B8A6', T: '#2E7D46', R: '#7A7F70', W: '#7E8A72' }, far: 'hills', decor: 'trees', night: false }
};
const F3_MAPS = {
  plaza:     { name: '중앙 광장',   tag: '★2 · 균형', desc: '모서리 건물 4채와 가운데 금속 광장. 골목과 광장을 오가는 기본 맵',       theme: 'plaza',     build: () => ({ rows: f3BuildMap(), spawns: [[7.5, 7.5], [36.5, 7.5], [7.5, 36.5], [36.5, 36.5], [22, 2.5], [2.5, 22], [41.5, 22], [22, 41.5], [10.5, 16.5], [33.5, 10.5], [27.5, 33.5], [16.5, 27.5]] }) },
  desert:    { name: '사막 마을',   tag: '★3 · 저격', desc: '긴 중앙 거리는 스나이퍼의 무대. 양옆 기둥 회랑과 골목으로 우회하세요',   theme: 'desert',    build: f3MapDesert },
  warehouse: { name: '창고 구역',   tag: '★2 · 근접', desc: '어두운 실내. 선반 사이 좁은 통로와 상자 무더기. 모퉁이마다 조심',         theme: 'warehouse', build: f3MapWarehouse },
  arctic:    { name: '설원 기지',   tag: '★3 · 중거리', desc: '넓은 눈밭과 중앙 관제탑. 눈 둔덕 뒤에 엎드려 중거리 교전',            theme: 'arctic',    build: f3MapArctic },
  city:      { name: '네온 시티',   tag: '★4 · 교차로', desc: '밤거리. 건물 안으로 들어가 매복하거나 교차로를 장악하세요',            theme: 'city',      build: f3MapCity },
  jungle:    { name: '정글 유적',   tag: '★4 · 매복', desc: '나무가 시야를 가르고 중앙엔 돌 신전. 매복과 우회의 맵',                theme: 'jungle',    build: f3MapJungle }
};
const F3_MAP = F3_MAPS.plaza.build().rows;
const F3_SPAWNS = F3_MAPS.plaza.build().spawns;
const F3_TEAM = { red: 0xFF5C7A, blue: 0x2E9BFF };
const F3_TEAM_CSS = { red: '#FF5C7A', blue: '#2E9BFF' };
const F3_WEAPONS = {
  rifle:  { name: '라이플',  mag: 30, reload: 1400, rate: 110, dmgBody: 34, dmgHead: 60,  dmgFar: 26, spread: 1.0, zoomFov: 72 },
  sniper: { name: '스나이퍼', mag: 5,  reload: 2600, rate: 900, dmgBody: 90, dmgHead: 150, dmgFar: 90, spread: 0.15, zoomFov: 22 }   // 줌 상태에서만 정확
};
const F3_MAG = 30;
const F3_EYE = 1.6;

class Fps3DGame {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.opts = opts || {};
    this.myId = this.opts.myId || 'me';
    this.myName = this.opts.myName || '';
    this.teamMode = !!this.opts.teamMode;
    this.team = this.teamMode ? Fps3DGame.teamOf(this.myId) : null;
    this.mapId = (this.opts.trackId && F3_MAPS[this.opts.trackId]) ? this.opts.trackId : 'plaza';
    this.mapDef = F3_MAPS[this.mapId]; this.theme = F3_THEMES[this.mapDef.theme];
    const built = this.mapDef.build(); this.map = built.rows; this.spawns = built.spawns;
    this.peers = {}; this.models = {};
    this.hp = 100; this.kills = 0; this.deaths = 0; this.score = 0; this.streak = 0;
    this.weapon = 'rifle'; this.zoomed = false; this.zoomK = 0;
    this.z = 0; this.vz = 0; this.onGround = true;           // 점프 높이
    this.rollUntil = 0; this.rollCdUntil = 0; this.rollDir = [0, 0];   // 구르기(회피)
    this.ammo = F3_MAG; this.reloadUntil = 0;
    this.mx = 0; this.my = 0; this.firing = false; this.turn = 0; this.upHeld = false; this.fwd = 0;
    this.yaw = 0; this.pitch = 0;
    this.lastFire = 0; this.muzzle = 0; this.recoil = 0; this.hurt = 0; this.deadUntil = 0;
    // 팀전 라운드: 5판 3선승. 죽으면 그 판이 끝날 때까지 부활 없음
    this.round = 1; this.wins = { red: 0, blue: 0 }; this.roundEndAt = 0; this.roundWinner = null; this.matchWinner = null; this.roundStartAt = 0;
    this.kickPitch = 0; this.kickRoll = 0; this.boltT = 0; this.shells = [];   // 반동·볼트액션·탄피
    this.hitMarker = 0; this.dmgDir = null; this.bob = 0; this.moving = 0;
    this.gameOver = false; this.toast = null; this.feed = []; this.tracers = [];
    this.lastTime = 0; this.now = 0;
    this.spawnAt(this.opts.slot || 0);
    this.initScene();
  }

  static teamOf(id) { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return (h & 1) ? 'red' : 'blue'; }
  static parse(raw) {
    const a = String(raw).split(',');
    return { x: +a[0], y: +a[1], angle: +a[2], hp: +a[3], kills: +a[4], deaths: +a[5], team: a[6] || null, fire: a[7] === '1', dead: a[8] === '1', moving: a[9] === '1', pitch: +a[10] || 0, z: +a[11] || 0, rollT: (a[12] === undefined ? -1 : +a[12]), roll: (a[12] !== undefined && +a[12] >= 0), round: +a[13] || 1, wr: +a[14] || 0, wb: +a[15] || 0 };
  }
  get isDead() { return this.now < this.deadUntil; }
  get reloading() { return this.now < this.reloadUntil || this.now < (this.readyUntil || 0); }   // 재장전 중이거나 무기 전환 준비 중
  get wpn() { return F3_WEAPONS[this.weapon] || F3_WEAPONS.rifle; }
  get magSize() { return this.wpn.mag; }
  clock() { return this.now || performance.now(); }

  // 프레임 간격에 맞춘 보간 비율 (프레임 수에 좌우되지 않게)
  smooth(k, f) { return 1 - Math.pow(1 - k, Math.max(0.2, f || 1)); }
  cell(x, y) { const r = this.map[Math.floor(y)]; return (r && r[Math.floor(x)]) || '#'; }
  wall(x, y) { return this.cell(x, y) !== '.'; }

  spawnAt(slot) {
    let best = null, bestD = -1;
    this.spawns.forEach((sp, i) => {
      let d = 1e9;
      Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (p.dead || (this.teamMode && p.team === this.team)) return; d = Math.min(d, Math.hypot(p.x - sp[0], p.y - sp[1])); });
      if (d === 1e9) d = 100 + ((i + slot) % this.spawns.length);
      if (d > bestD) { bestD = d; best = sp; }
    });
    this.x = best[0]; this.y = best[1];
    const C = this.map.length / 2; this.yaw = Math.atan2(C - this.y, C - this.x); this.pitch = 0;
    this.ammo = this.magSize; this.reloadUntil = 0; this.zoomed = false;
  }

  // ── 장면 구성 ──
  initScene() {
    if (typeof THREE === 'undefined') { this.noGL = true; return; }
    const T = THREE;
    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x9ED4FF);
    const th = this.theme || F3_THEMES.plaza;
    this.scene.fog = new T.Fog(th.fog[0], th.fog[1], th.fog[2]);
    this.camera = new T.PerspectiveCamera(72, 1, 0.05, 140);

    // 조명: 하늘빛 + 태양
    this.scene.add(new T.HemisphereLight(th.hemi[0], th.hemi[1], th.night ? 0.6 : 0.85));
    const sun = new T.DirectionalLight(th.sun, th.night ? 0.55 : 1.0); sun.position.set(20, 30, 10); this.scene.add(sun);

    // 바닥 (모래빛 콘크리트) — 타일 텍스처
    const N = this.map.length;
    const floorTex = new T.CanvasTexture(Fps3DGame.texCanvas('floor', th)); floorTex.wrapS = floorTex.wrapT = T.RepeatWrapping; floorTex.repeat.set(N, N); floorTex.encoding = T.sRGBEncoding;
    const floor = new T.Mesh(new T.PlaneGeometry(N, N), new T.MeshLambertMaterial({ map: floorTex }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(N / 2, 0, N / 2); this.scene.add(floor);
    // 바깥 지면 (넓게)
    const ground = new T.Mesh(new T.PlaneGeometry(400, 400), new T.MeshLambertMaterial({ color: th.ground }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(N / 2, -0.01, N / 2); this.scene.add(ground);

    // 벽 — 종류별 InstancedMesh (드로우콜 4개)
    const cellsOf = k => { const cells = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (this.map[y][x] === k) cells.push([x, y]); return cells; };
    const place = (mesh, cells, h, yOff) => { const m = new T.Matrix4(); cells.forEach(([x, y], i) => { m.makeTranslation(x + 0.5, (yOff != null ? yOff : h / 2), y + 0.5); mesh.setMatrixAt(i, m); }); this.scene.add(mesh); };
    const wc = th.walls || {};
    // 상자형 구조물 (텍스처) — 종류별 InstancedMesh
    ['#', '=', 'B', 'H', 'X', 'L'].forEach(k => {
      const cells = cellsOf(k); if (!cells.length) return;
      const tex = new T.CanvasTexture(Fps3DGame.texCanvas(k === 'H' ? '#' : (k === 'L' ? '=' : k), th)); tex.encoding = T.sRGBEncoding;
      if (k === 'H') { tex.wrapT = T.RepeatWrapping; tex.repeat.set(1, 1.7); }
      const h = F3_HEIGHT[k];
      place(new T.InstancedMesh(new T.BoxGeometry(1, h, 1), new T.MeshLambertMaterial({ map: tex }), cells.length), cells, h);
    });
    // 창문벽 W: 낮은 벽 + 위쪽 창틀 (위로는 쏠 수 있음)
    { const cells = cellsOf('W'); if (cells.length) {
        const tex = new T.CanvasTexture(Fps3DGame.texCanvas('#', th)); tex.encoding = T.sRGBEncoding;
        place(new T.InstancedMesh(new T.BoxGeometry(1, 1.2, 1), new T.MeshLambertMaterial({ map: tex }), cells.length), cells, 1.2);
        place(new T.InstancedMesh(new T.BoxGeometry(1, 0.08, 0.3), new T.MeshLambertMaterial({ color: 0x3A4256 }), cells.length), cells, 0, 1.24); } }
    // 기둥 P: 원통 + 받침
    { const cells = cellsOf('P'); if (cells.length) {
        const col = new T.Color(wc.P || '#C9CFD8');
        place(new T.InstancedMesh(new T.CylinderGeometry(0.28, 0.32, 2.4, 10), new T.MeshLambertMaterial({ color: col }), cells.length), cells, 2.4);
        place(new T.InstancedMesh(new T.CylinderGeometry(0.45, 0.5, 0.2, 10), new T.MeshLambertMaterial({ color: col.clone().multiplyScalar(0.75) }), cells.length), cells, 0, 0.1); } }
    // 나무 T: 줄기 + 원뿔 잎 두 단
    { const cells = cellsOf('T'); if (cells.length) {
        const leaf = new T.Color(wc.T || '#2E7D46');
        place(new T.InstancedMesh(new T.CylinderGeometry(0.12, 0.18, 1.2, 6), new T.MeshLambertMaterial({ color: 0x6B4A2B }), cells.length), cells, 0, 0.6);
        place(new T.InstancedMesh(new T.ConeGeometry(0.9, 1.6, 8), new T.MeshLambertMaterial({ color: leaf }), cells.length), cells, 0, 1.6);
        place(new T.InstancedMesh(new T.ConeGeometry(0.65, 1.3, 8), new T.MeshLambertMaterial({ color: leaf.clone().multiplyScalar(1.15) }), cells.length), cells, 0, 2.5); } }
    // 바위 R: 낮게 눌린 구
    { const cells = cellsOf('R'); if (cells.length) {
        const mesh = new T.InstancedMesh(new T.DodecahedronGeometry(0.55, 0), new T.MeshLambertMaterial({ color: new T.Color(wc.R || '#8A8F98') }), cells.length);
        const m = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(1.1, 0.7, 1.0);
        cells.forEach(([x, y], i) => { q.setFromEuler(new T.Euler(0, (x * 7 + y * 3) % 6, 0)); m.compose(new T.Vector3(x + 0.5, 0.35, y + 0.5), q, sc); mesh.setMatrixAt(i, m); });
        this.scene.add(mesh); } }

    // 하늘 돔 (그라데이션) + 태양
    const skyTex = new T.CanvasTexture(Fps3DGame.texCanvas('sky', th)); skyTex.encoding = T.sRGBEncoding;
    const dome = new T.Mesh(new T.SphereGeometry(180, 24, 12), new T.MeshBasicMaterial({ map: skyTex, side: T.BackSide, fog: false }));
    dome.position.set(N / 2, 0, N / 2); this.scene.add(dome);
    const sunTex = new T.CanvasTexture(Fps3DGame.texCanvas('flash')); sunTex.encoding = T.sRGBEncoding;
    const sunSp = new T.Sprite(new T.SpriteMaterial({ map: sunTex, transparent: true, fog: false, depthWrite: false })); sunSp.scale.set(40, 40, 1); sunSp.position.set(N / 2 + 90, 70, N / 2 - 60); this.scene.add(sunSp);

    // 벽 위 어두운 트림 · 바닥 접지 그림자 띠 (입체감)
    const trimMat = new T.MeshLambertMaterial({ color: 0x3A4256 });
    const trimCells = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const k = this.map[y][x]; if (k === '#' || k === '=' || k === 'B' || k === 'H' || k === 'W') trimCells.push([x, y, F3_HEIGHT[k]]); }
    const trim = new T.InstancedMesh(new T.BoxGeometry(1.04, 0.08, 1.04), trimMat, trimCells.length);
    const shadowMat = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false });
    const shadow = new T.InstancedMesh(new T.PlaneGeometry(1.6, 1.6), shadowMat, trimCells.length);
    { const m = new T.Matrix4(), q = new T.Quaternion().setFromEuler(new T.Euler(-Math.PI / 2, 0, 0)), one = new T.Vector3(1, 1, 1);
      trimCells.forEach(([x, y, h], i) => { m.makeTranslation(x + 0.5, h + 0.04, y + 0.5); trim.setMatrixAt(i, m);
        m.compose(new T.Vector3(x + 0.5, 0.012, y + 0.5), q, one); shadow.setMatrixAt(i, m); }); }
    this.scene.add(trim);
    // 바닥 얼룩 (타이어 자국·먼지) — 화질을 낮추면 숨김
    this.decor = new T.Group(); this.scene.add(this.decor);
    const decMat = new T.MeshBasicMaterial({ color: 0x5A4A36, transparent: true, opacity: 0.18, depthWrite: false });
    for (let i = 0; i < 28; i++) {
      let x, y; do { x = 2 + Math.random() * (N - 4); y = 2 + Math.random() * (N - 4); } while (this.wall(x, y));
      const dec = new T.Mesh(new T.PlaneGeometry(1.2 + Math.random() * 2, 0.5 + Math.random() * 1.5), decMat);
      dec.rotation.x = -Math.PI / 2; dec.rotation.z = Math.random() * Math.PI; dec.position.set(x, 0.008, y); this.decor.add(dec);
    }
    this.decor.add(shadow);

    // 원경 · 소품 — 테마별
    this.farScenery = new T.Group(); this.scene.add(this.farScenery);
    this.buildFarScenery(th, N);
    this.buildDecor(th, N);

    // 총 (카메라에 붙임)
    this.rifleModel = this.buildWeapon(); this.sniperModel = this.buildSniper();
    this.camera.add(this.rifleModel); this.camera.add(this.sniperModel); this.sniperModel.visible = false;
    this.weaponModel = this.rifleModel; this.scene.add(this.camera);
    // 탄피 메시 풀 (6개)
    this.shellMeshes = []; const shellMat = new T.MeshLambertMaterial({ color: 0xD9B24C });
    for (let i = 0; i < 6; i++) { const m = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.03, 6), shellMat); m.visible = false; this.camera.add(m); this.shellMeshes.push(m); }
    // 총구 섬광
    const flashTex = new T.CanvasTexture(Fps3DGame.texCanvas('flash')); flashTex.encoding = T.sRGBEncoding;
    this.flash = new T.Sprite(new T.SpriteMaterial({ map: flashTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    this.flash.scale.set(0.35, 0.35, 1); this.flash.position.set(0.22, -0.18, -1.05); this.flash.visible = false; this.camera.add(this.flash);
    // HUD 2D 오버레이 캔버스
    this.hud = document.createElement('canvas');
    this.hud.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
    if (this.canvas.parentElement) { this.canvas.parentElement.style.position = 'relative'; this.canvas.parentElement.appendChild(this.hud); }
    this.hctx = this.hud.getContext('2d');
    // 궤적용
    this.tracerMat = new T.LineBasicMaterial({ color: 0x8FE3FF, transparent: true, opacity: 0.9 });
    // 렌더러 (WebGL 이 없으면 장면 갱신만 하고 그리지 않음)
    try {
      this.renderer = new T.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(Math.min(1.25, (typeof window !== 'undefined' && window.devicePixelRatio) || 1));
      this.renderer.outputEncoding = T.sRGBEncoding;
    } catch (e) { this.noGL = true; }
  }

  static texCanvas(kind, theme) {
    const S = 128, cv = document.createElement('canvas'); cv.width = S; cv.height = S; const g = cv.getContext('2d');
    const th = theme || F3_THEMES.plaza, wc = (th.walls || {});
    // 테마 색으로 재질을 다시 칠합니다 (기본 팔레트를 덮어씀)
    const base = { floor: th.floor ? th.floor[0] : '#C9BFA6', '#': wc['#'] || '#B9BFC9', '=': wc['='] || '#8F98A8', X: wc.X || '#B98A55', B: wc.B || '#9A5A50' };
    const noise = (a, n) => { for (let i = 0; i < (n || 500); i++) { g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '0,0,0' : '255,255,255') + ',' + a + ')'; g.fillRect(Math.random() * S, Math.random() * S, 3, 3); } };
    if (kind === 'floor') { g.fillStyle = base.floor; g.fillRect(0, 0, S, S); noise(0.06, 900); g.strokeStyle = th.floor ? th.floor[1] : 'rgba(0,0,0,0.18)'; g.lineWidth = 3; g.strokeRect(1, 1, S - 2, S - 2); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(4, 4, S - 8, 4); }
    else if (kind === '#') { g.fillStyle = base['#']; g.fillRect(0, 0, S, S); noise(0.07); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 4; g.strokeRect(3, 3, S - 6, S - 6); g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(6, 6, S - 12, 5); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(6, S - 12, S - 12, 6); g.fillStyle = '#6B7280'; [16, 112].forEach(x => [16, 112].forEach(y => { g.beginPath(); g.arc(x, y, 4, 0, 6.3); g.fill(); })); }
    else if (kind === '=') { g.fillStyle = base['=']; g.fillRect(0, 0, S, S); noise(0.05); for (let y = 0; y < S; y += 32) { g.fillStyle = (y / 32) % 2 ? '#8A93A3' : '#9CA5B5'; g.fillRect(0, y, S, 32); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, y, S, 3); }
      g.fillStyle = '#FFC533'; for (let x = -32; x < S + 32; x += 32) { g.beginPath(); g.moveTo(x, S - 26); g.lineTo(x + 16, S - 26); g.lineTo(x, S - 8); g.lineTo(x - 16, S - 8); g.closePath(); g.fill(); }
      g.fillStyle = '#2B2F3A'; for (let x = -16; x < S + 32; x += 32) { g.beginPath(); g.moveTo(x, S - 26); g.lineTo(x + 16, S - 26); g.lineTo(x, S - 8); g.lineTo(x - 16, S - 8); g.closePath(); g.fill(); } }
    else if (kind === 'X') { g.fillStyle = base.X; g.fillRect(0, 0, S, S); noise(0.07); g.strokeStyle = '#7A552F'; g.lineWidth = 8; g.strokeRect(6, 6, S - 12, S - 12); g.beginPath(); g.moveTo(8, 8); g.lineTo(S - 8, S - 8); g.moveTo(S - 8, 8); g.lineTo(8, S - 8); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(12, 12, S - 24, 4); }
    else if (kind === 'B') { g.fillStyle = base.B; g.fillRect(0, 0, S, S); for (let y = 0; y < S; y += 32) for (let x = ((y / 32) % 2) * 32 - 32; x < S; x += 64) { g.fillStyle = (x + y) % 3 ? '#C27A6C' : '#B36E61'; g.fillRect(x + 3, y + 3, 58, 26); } noise(0.05); }
    else if (kind === 'sky') { const sk = th.sky || ['#5FA8FF', sk[1], sk[2]]; const r = g.createLinearGradient(0, 0, 0, S); r.addColorStop(0, sk[0]); r.addColorStop(0.55, '#A9D6FF'); r.addColorStop(1, '#E6F1FF'); g.fillStyle = r; g.fillRect(0, 0, S, S);
      g.fillStyle = 'rgba(255,255,255,0.55)'; for (let i = 0; i < 8; i++) { const cx = Math.random() * S, cy = S * (0.35 + Math.random() * 0.25); [0, 10, -8, 6].forEach(o => { g.beginPath(); g.ellipse(cx + o, cy + (o % 3), 14, 6, 0, 0, Math.PI * 2); g.fill(); }); } }
    else if (kind === 'flash') { const r = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(160,235,255,0.9)'); r.addColorStop(1, 'rgba(160,235,255,0)'); g.fillStyle = r; g.fillRect(0, 0, S, S); }
    return cv;
  }

  // 원경: 언덕 / 사막 메사 / 도시 스카이라인 / 설산 / 없음
  buildFarScenery(th, N) {
    const T = THREE, G = this.farScenery, cx = N / 2, cz = N / 2;
    if (th.far === 'hills') {
      const hillMat = new T.MeshLambertMaterial({ color: th.night ? 0x2A3B2A : 0x9CBF7A });
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, r = 80 + (i % 3) * 10;
        const hill = new T.Mesh(new T.SphereGeometry(14 + (i % 4) * 5, 10, 6), hillMat); hill.position.set(cx + Math.cos(a) * r, -8, cz + Math.sin(a) * r); hill.scale.y = 0.5; G.add(hill); }
      const bMat = new T.MeshLambertMaterial({ color: 0xD8DEE8 });
      for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2, r = 62;
        const b = new T.Mesh(new T.BoxGeometry(6 + (i % 3) * 3, 6 + (i % 4) * 4, 6), bMat); b.position.set(cx + Math.cos(a) * r, b.geometry.parameters.height / 2, cz + Math.sin(a) * r); G.add(b); }
    } else if (th.far === 'mesas') {
      const mat = new T.MeshLambertMaterial({ color: 0xB5643B }), top = new T.MeshLambertMaterial({ color: 0xD08A5A });
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + 0.2, r = 75 + (i % 3) * 12, w = 14 + (i % 4) * 6, h = 8 + (i % 3) * 5;
        const m = new T.Mesh(new T.CylinderGeometry(w * 0.6, w, h, 7), mat); m.position.set(cx + Math.cos(a) * r, h / 2 - 1, cz + Math.sin(a) * r); G.add(m);
        const t = new T.Mesh(new T.CylinderGeometry(w * 0.6, w * 0.62, 0.6, 7), top); t.position.set(m.position.x, h - 0.7, m.position.z); G.add(t); }
      const dune = new T.MeshLambertMaterial({ color: 0xE0B57A });
      for (let i = 0; i < 12; i++) { const a = (i + 0.5) / 12 * Math.PI * 2, r = 58; const d = new T.Mesh(new T.SphereGeometry(10 + (i % 3) * 4, 8, 5), dune); d.position.set(cx + Math.cos(a) * r, -7, cz + Math.sin(a) * r); d.scale.y = 0.35; G.add(d); }
    } else if (th.far === 'city') {
      // 밤 도시: 불 켜진 창문 텍스처 빌딩
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const g = cv.getContext('2d');
      g.fillStyle = '#141A2E'; g.fillRect(0, 0, 64, 128); for (let y = 6; y < 128; y += 10) for (let x = 6; x < 64; x += 10) { g.fillStyle = Math.random() < 0.55 ? (Math.random() < 0.3 ? '#FFD166' : '#CFE6FF') : '#1C2340'; g.fillRect(x, y, 5, 6); }
      const tex = new T.CanvasTexture(cv); tex.encoding = T.sRGBEncoding; tex.wrapS = tex.wrapT = T.RepeatWrapping;
      for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2, r = 62 + (i % 4) * 9, w = 5 + (i % 3) * 3, h = 12 + ((i * 7) % 5) * 7;
        const t2 = tex.clone(); t2.needsUpdate = true; t2.repeat.set(1, h / 12);
        const b = new T.Mesh(new T.BoxGeometry(w, h, w), new T.MeshLambertMaterial({ map: t2 })); b.position.set(cx + Math.cos(a) * r, h / 2 - 0.5, cz + Math.sin(a) * r); G.add(b);
        if (i % 5 === 0) { const ant = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 5, 4), new T.MeshBasicMaterial({ color: 0xFF5C7A })); ant.position.set(b.position.x, h + 2.5, b.position.z); G.add(ant); } }
    } else if (th.far === 'peaks') {
      const rock = new T.MeshLambertMaterial({ color: 0x8FA3BF }), snow = new T.MeshLambertMaterial({ color: 0xFFFFFF });
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, r = 85 + (i % 3) * 14, h = 26 + (i % 4) * 9, w = 16 + (i % 3) * 6;
        const m = new T.Mesh(new T.ConeGeometry(w, h, 6), rock); m.position.set(cx + Math.cos(a) * r, h / 2 - 3, cz + Math.sin(a) * r); G.add(m);
        const c = new T.Mesh(new T.ConeGeometry(w * 0.42, h * 0.42, 6), snow); c.position.set(m.position.x, h - h * 0.21 - 3, m.position.z); G.add(c); }
      const bank = new T.MeshLambertMaterial({ color: 0xEAF0F6 });
      for (let i = 0; i < 10; i++) { const a = (i + 0.5) / 10 * Math.PI * 2, r = 60; const d = new T.Mesh(new T.SphereGeometry(9 + (i % 3) * 3, 8, 5), bank); d.position.set(cx + Math.cos(a) * r, -6, cz + Math.sin(a) * r); d.scale.y = 0.35; G.add(d); }
    }
    // 'none' 은 원경 없음 (실내)
  }

  // 소품: 드럼통 / 선인장 / 램프 / 눈사람·얼음 / 네온 간판 / 덤불 — 벽이 아닌 칸에 무작위로, 충돌 없음
  buildDecor(th, N) {
    const T = THREE; this.props = new T.Group(); this.scene.add(this.props);
    const spot = () => { let x, y, tries = 0; do { x = 2 + Math.random() * (N - 4); y = 2 + Math.random() * (N - 4); tries++; } while (this.wall(x, y) && tries < 40); return [x, y]; };
    const nearWall = () => { let x, y, tries = 0; do { [x, y] = spot(); tries++; } while (!(this.wall(x + 1, y) || this.wall(x - 1, y) || this.wall(x, y + 1) || this.wall(x, y - 1)) && tries < 60); return [x, y]; };
    const add = (mesh, x, y, yy) => { mesh.position.set(x, yy || 0, y); this.props.add(mesh); };
    const n = 14;
    if (th.decor === 'barrels' || th.decor === 'lamps') {
      const mat = new T.MeshLambertMaterial({ color: 0x4E6BC2 }), band = new T.MeshLambertMaterial({ color: 0xD9DEE8 });
      for (let i = 0; i < n; i++) { const [x, y] = nearWall(); const b = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 0.6, 10), mat); add(b, x, y, 0.3);
        const r = new T.Mesh(new T.CylinderGeometry(0.23, 0.23, 0.06, 10), band); add(r, x, y, 0.45); }
      if (th.decor === 'lamps') { // 천장 램프: 노란 원판 + 빛 스프라이트
        const lm = new T.MeshBasicMaterial({ color: 0xFFE9A8 });
        for (let i = 0; i < 10; i++) { const [x, y] = spot(); const l = new T.Mesh(new T.CylinderGeometry(0.35, 0.35, 0.08, 10), lm); add(l, x, y, 3.6);
          if (i % 3 === 0) { const pt = new T.PointLight(0xFFE0A0, 0.55, 12); pt.position.set(x, 3.4, y); this.props.add(pt); } } }   // 빛은 3개 중 1개만 (점광원은 태블릿에서 무겁습니다)
    } else if (th.decor === 'cactus') {
      const mat = new T.MeshLambertMaterial({ color: 0x4F8A3A });
      for (let i = 0; i < n; i++) { const [x, y] = spot(); const c = new T.Mesh(new T.CylinderGeometry(0.16, 0.2, 1.4, 7), mat); add(c, x, y, 0.7);
        const arm = new T.Mesh(new T.CylinderGeometry(0.1, 0.12, 0.6, 7), mat); arm.position.set(x + 0.28, 0.9, y); this.props.add(arm); }
    } else if (th.decor === 'snow') {
      const ice = new T.MeshLambertMaterial({ color: 0xBFE3FF, transparent: true, opacity: 0.85 });
      for (let i = 0; i < n; i++) { const [x, y] = spot(); const c = new T.Mesh(new T.ConeGeometry(0.35, 0.9 + Math.random() * 0.6, 5), ice); add(c, x, y, 0.45); }
    } else if (th.decor === 'neon') {
      const cols = [0xFF5C7A, 0x4CC9F0, 0xB15DFF, 0xFFD166];
      for (let i = 0; i < 16; i++) { const [x, y] = nearWall(); const sign = new T.Mesh(new T.BoxGeometry(0.9, 0.3, 0.06), new T.MeshBasicMaterial({ color: cols[i % 4] })); add(sign, x, y, 1.9);
        if (i % 4 === 0) { const pl = new T.PointLight(cols[i % 4], 0.8, 9); pl.position.set(x, 1.9, y); this.props.add(pl); } }   // 간판 16개 · 빛은 4개만
    } else if (th.decor === 'trees') {
      const mat = new T.MeshLambertMaterial({ color: 0x3F8F4F });
      for (let i = 0; i < n; i++) { const [x, y] = spot(); const b = new T.Mesh(new T.SphereGeometry(0.4 + Math.random() * 0.25, 7, 5), mat); b.scale.y = 0.7; add(b, x, y, 0.3); }
    }
  }

  buildWeapon() {
    const T = THREE, g = new T.Group();
    const dark = new T.MeshLambertMaterial({ color: 0x2B3140 }), mid = new T.MeshLambertMaterial({ color: 0x4A5163 });
    const teamC = new T.MeshBasicMaterial({ color: this.team ? F3_TEAM[this.team] : 0xFFD166 });
    const add = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
    add(new T.BoxGeometry(0.09, 0.12, 0.5), mid, 0, 0, 0);            // 총몸
    add(new T.BoxGeometry(0.05, 0.05, 0.45), dark, 0, 0.02, -0.45);   // 총열
    add(new T.BoxGeometry(0.06, 0.16, 0.08), dark, 0, -0.12, 0.05);   // 탄창
    add(new T.BoxGeometry(0.05, 0.04, 0.16), dark, 0, 0.09, 0.02);    // 조준경
    add(new T.BoxGeometry(0.095, 0.015, 0.4), teamC, 0, 0.065, -0.05); // 팀 색 발광선
    add(new T.BoxGeometry(0.06, 0.06, 0.06), teamC, 0, -0.03, -0.66);  // 총구 링
    add(new T.BoxGeometry(0.08, 0.1, 0.12), new T.MeshLambertMaterial({ color: 0x6B5B4E }), 0.02, -0.1, 0.18); // 손
    g.position.set(0.28, -0.26, -0.55); g.rotation.y = -0.06;
    return g;
  }
  buildSniper() {
    const T = THREE, g = new T.Group();
    const dark = new T.MeshLambertMaterial({ color: 0x1F2430 }), mid = new T.MeshLambertMaterial({ color: 0x3B4354 }), wood = new T.MeshLambertMaterial({ color: 0x5A4030 });
    const teamC = new T.MeshBasicMaterial({ color: this.team ? F3_TEAM[this.team] : 0xFFD166 });
    const add = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
    add(new T.BoxGeometry(0.08, 0.11, 0.55), wood, 0, -0.01, 0.05);             // 개머리판·총몸 (나무)
    add(new T.BoxGeometry(0.06, 0.07, 0.75), mid, 0, 0.02, -0.55);              // 긴 총열 덮개
    add(new T.CylinderGeometry(0.018, 0.018, 0.5, 8), dark, 0, 0.03, -1.05).rotation.x = Math.PI / 2;   // 총열
    add(new T.CylinderGeometry(0.03, 0.03, 0.08, 8), dark, 0, 0.03, -1.32).rotation.x = Math.PI / 2;    // 소염기
    const scope = add(new T.CylinderGeometry(0.035, 0.035, 0.32, 10), dark, 0, 0.11, -0.18); scope.rotation.x = Math.PI / 2;   // 조준경
    add(new T.CylinderGeometry(0.04, 0.03, 0.05, 10), dark, 0, 0.11, -0.36).rotation.x = Math.PI / 2;
    add(new T.CircleGeometry(0.028, 10), new T.MeshBasicMaterial({ color: 0x9DE9FF }), 0, 0.11, -0.385).rotation.y = Math.PI;   // 렌즈
    add(new T.BoxGeometry(0.02, 0.05, 0.1), mid, 0, 0.06, -0.1); add(new T.BoxGeometry(0.02, 0.05, 0.1), mid, 0, 0.06, -0.26);   // 마운트
    add(new T.BoxGeometry(0.05, 0.12, 0.06), dark, 0, -0.1, -0.05);              // 탄창
    add(new T.BoxGeometry(0.08, 0.012, 0.5), teamC, 0, 0.045, -0.5);            // 팀 색 선
    const bolt = add(new T.CylinderGeometry(0.012, 0.012, 0.08, 6), dark, 0.05, 0.03, -0.02); bolt.rotation.z = Math.PI / 2;   // 볼트 손잡이
    add(new T.SphereGeometry(0.018, 6, 6), dark, 0.09, 0.03, -0.02).userData.knob = true;
    add(new T.BoxGeometry(0.08, 0.1, 0.12), new T.MeshLambertMaterial({ color: 0x6B5B4E }), 0.02, -0.1, 0.22);   // 손
    add(new T.BoxGeometry(0.07, 0.08, 0.1), new T.MeshLambertMaterial({ color: 0x6B5B4E }), -0.01, -0.03, -0.62);  // 앞손
    g.position.set(0.28, -0.26, -0.55); g.rotation.y = -0.06; g.userData = { bolt };
    return g;
  }

  buildSoldier(team, name) {
    const T = THREE, g = new T.Group();
    const armor = new T.MeshLambertMaterial({ color: 0x5C6678 }), skin = new T.MeshLambertMaterial({ color: 0x3A4256 });   // 모델마다 새로 만듦 (피격 번쩍임이 개별로 보이도록)
    const tc = new T.MeshBasicMaterial({ color: team ? F3_TEAM[team] : 0xFFD166 });
    const add = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
    const legL = add(new T.BoxGeometry(0.16, 0.7, 0.18), skin, -0.11, 0.35, 0), legR = add(new T.BoxGeometry(0.16, 0.7, 0.18), skin, 0.11, 0.35, 0);
    add(new T.BoxGeometry(0.46, 0.6, 0.28), armor, 0, 1.0, 0);
    add(new T.BoxGeometry(0.2, 0.32, 0.29), tc, 0, 1.02, 0);                  // 팀 색 가슴판
    add(new T.BoxGeometry(0.48, 0.05, 0.3), tc, 0, 1.3, 0);                   // 어깨 띠
    add(new T.BoxGeometry(0.13, 0.5, 0.14), skin, -0.32, 1.0, 0);             // 왼팔
    const armR = add(new T.BoxGeometry(0.13, 0.4, 0.14), skin, 0.3, 1.05, -0.15);
    add(new T.BoxGeometry(0.06, 0.08, 0.5), new T.MeshLambertMaterial({ color: 0x1A1D24 }), 0.3, 1.05, -0.45); // 총
    add(new T.BoxGeometry(0.3, 0.32, 0.3), armor, 0, 1.55, 0);                // 헬멧
    add(new T.BoxGeometry(0.26, 0.08, 0.05), tc, 0, 1.55, -0.15);             // 바이저
    // 이름표 스프라이트
    const tag = this.makeTag(name || '', team); tag.position.set(0, 2.0, 0); g.add(tag);
    g.userData = { legL, legR, armR, tag };
    return g;
  }
  // 이름표: 이름은 한 번만 그리고(텍스처), 체력은 색 스프라이트 두 장을 늘였다 줄이는 막대로 표시합니다.
  // 예전엔 체력이 바뀔 때마다 이름표 그림을 통째로 다시 만들어 30명 교전 시 초당 40장 넘는 텍스처를 GPU 에 올렸습니다 (렉의 원인).
  makeTag(name, team, hp) {
    const T = THREE, g0 = new T.Group();
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 48; const g = cv.getContext('2d');
    g.fillStyle = 'rgba(8,10,16,0.65)'; g.beginPath(); if (g.roundRect) g.roundRect(28, 4, 200, 38, 10); else g.rect(28, 4, 200, 38); g.fill();
    g.fillStyle = team ? F3_TEAM_CSS[team] : '#FFD166'; g.font = '800 26px Pretendard, sans-serif'; g.textAlign = 'center'; g.fillText(name, 128, 32);
    const tex = new T.CanvasTexture(cv); tex.encoding = T.sRGBEncoding;
    const nameSp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false })); nameSp.scale.set(1.6, 0.3, 1); nameSp.position.y = 0.12; g0.add(nameSp);
    const back = new T.Sprite(new T.SpriteMaterial({ color: 0x1A1D24, transparent: true, opacity: 0.7, depthTest: false })); back.scale.set(1.0, 0.07, 1); back.position.y = -0.12; g0.add(back);
    const fill = new T.Sprite(new T.SpriteMaterial({ color: 0x06D6A0, depthTest: false })); fill.scale.set(1.0, 0.05, 1); fill.position.y = -0.12; fill.center.set(0, 0.5); fill.position.x = -0.5; g0.add(fill);
    g0.userData = { name, team, hp: hp == null ? 100 : hp, fill, material: nameSp.material };
    this.setTagHp(g0, hp == null ? 100 : hp);
    return g0;
  }
  setTagHp(tag, hp) {
    const u = tag.userData; if (!u || !u.fill) return; const k = Math.max(0, Math.min(1, hp / 100));
    u.fill.scale.x = Math.max(0.001, 1.0 * k); u.fill.material.color.setHex(hp > 40 ? 0x06D6A0 : 0xFF5C7A); u.hp = hp;
  }

  // ── 조작 (플랫폼 계약 + 조이스틱) ──
  setMove(x, y) { this.mx = Math.max(-1, Math.min(1, x)); this.my = Math.max(-1, Math.min(1, y)); }
  look(dx, dy) { if (this.spectator) return; const k = this.zoomed ? 0.3 : 1; this.yaw += dx * 0.0042 * k; this.pitch = Math.max(-1.1, Math.min(1.1, this.pitch - dy * 0.0036 * k)); }
  move(dir) { this.turn = dir; }                       // 키보드 ← → 는 회전
  releaseSteer(dir) { if (this.turn === dir) this.turn = 0; }
  up() { this.upHeld = true; }
  softDrop() { this.fwd = -1; }
  rotate() { this.fire(); }
  hardDrop() { this.fire(); }
  fire() { this.shoot(); }
  reload() { if (this.reloading || this.ammo === this.magSize || this.isDead) return; this.reloadUntil = this.clock() + this.wpn.reload; if (window.Sound) Sound.softDrop(); }
  // 무기 전환: 라이플 ↔ 스나이퍼 (전환에 0.8초, 탄약은 새 탄창)
  switchWeapon() {
    if (this.isDead || this.spectator) return;
    this.weapon = this.weapon === 'rifle' ? 'sniper' : 'rifle';
    if (this.rifleModel && this.sniperModel) { this.rifleModel.visible = this.weapon === 'rifle'; this.sniperModel.visible = this.weapon === 'sniper'; this.weaponModel = this.weapon === 'sniper' ? this.sniperModel : this.rifleModel; this.swapT = 1; }
    this.zoomed = false; this.ammo = this.magSize; this.reloadUntil = 0; this.readyUntil = this.clock() + 800;
    this.showToast(this.wpn.name + (this.weapon === 'sniper' ? ' — 🔍 줌으로 조준하세요' : ''), '#FFD166');
    if (window.Sound) Sound.rotate();
  }
  // 줌 토글 (스나이퍼 전용): 시야 72° → 22°, 이동 느려짐, 조준 감도 낮아짐
  toggleZoom() { if (this.weapon !== 'sniper' || this.isDead) return; this.zoomed = !this.zoomed; if (window.Sound) Sound.move(); }

  // 점프 — 땅에 있을 때만. 공중에서는 조향은 되지만 속도가 조금 줄어듭니다
  jump() {
    if (this.isDead || this.spectator || !this.onGround || this.now < this.rollUntil) return;
    this.vz = 0.115; this.onGround = false; this.zoomed = false;
    if (window.Sound) Sound.rotate(); if (window.Haptic) Haptic.tap();
  }
  // 구르기 — 0.45초간 빠르게 미끄러지며 총알 판정이 낮아집니다. 3초 쿨다운
  roll() {
    const now = this.clock();
    if (this.isDead || this.spectator || now < this.rollCdUntil || !this.onGround) return;
    let sx = this.mx, sy = this.my; if (this.upHeld) sy = 1;
    const len = Math.hypot(sx, sy);
    if (len < 0.15) { sy = 1; sx = 0; }                       // 방향 입력이 없으면 앞으로
    const l2 = Math.hypot(sx, sy) || 1;
    this.rollDir = [(Math.cos(this.yaw) * sy - Math.sin(this.yaw) * sx) / l2,
                    (Math.sin(this.yaw) * sy + Math.cos(this.yaw) * sx) / l2];
    this.rollSide = sx >= 0 ? 1 : -1;
    this.rollUntil = now + 700; this.rollStart = now; this.rollCdUntil = now + 3000; this.zoomed = false;
    this.showToast('회피!', '#4CC9F0'); if (window.Sound) Sound.softDrop(); if (window.Haptic) Haptic.good();
  }
  get rolling() { return this.now < this.rollUntil; }
  // 구르기 진행률 0~1
  get rollT() { return this.rolling ? Math.max(0, Math.min(1, (this.now - this.rollStart) / 700)) : -1; }
  get eyeZ() {
    // 구르는 동안 시점이 아래로 내려갔다 돌아옵니다 (몸을 낮췄다 일어나는 느낌)
    if (!this.rolling) return F3_EYE + this.z;
    const k = this.rollT;
    return F3_EYE + this.z - Math.sin(Math.min(1, k * 1.15) * Math.PI) * 0.95;
  }

  shoot() {
    const now = this.clock();
    if (this.isDead || this.spectator || this.reloading) return;
    if (this.rolling) return;                              // 구르는 중엔 쏠 수 없습니다
    if (this.ammo <= 0) { this.reload(); return; }
    if (now - this.lastFire < this.wpn.rate) return;
    this.lastFire = now; this.muzzle = 1; this.ammo--;
    if (this.ammo <= 0) this.reload();
    if (window.Sound) Sound.hardDrop();
    // 산탄: 스나이퍼는 줌 상태면 거의 정확, 줌 없이 쏘면 많이 튐
    const base = 0.01 * this.recoil + (this.moving ? 0.012 : 0);
    const spread = this.weapon === 'sniper' ? (this.zoomed ? base * 0.15 : 0.06) : base;
    const yaw = this.yaw + (Math.random() - 0.5) * spread * 2, pitch = this.pitch + (Math.random() - 0.5) * spread;
    // 반동: 라이플은 짧게 톡, 스나이퍼는 크게 걷어차고 볼트를 당깁니다
    if (this.weapon === 'sniper') {
      this.recoil = 1; this.kickVis = 0.13; this.pitch = Math.min(1.1, this.pitch + 0.02); this.kickRoll = (Math.random() - 0.5) * 0.08;   // 화면이 7° 확 튀었다 돌아오고, 조준은 1° 남음
      this.boltT = 1; this.muzzle = 1.6; this.flashBig = true;
      this.zoomFlinch = this.zoomed ? 1 : 0;                                                     // 줌 중이면 스코프가 잠깐 흔들려 시야가 튐
      this.shells.push({ t: 0, vx: 0.9 + Math.random() * 0.4, vy: 0.9, vz: -0.2 });          // 탄피 (볼트 당길 때 튀어나옴)
      if (window.Haptic) Haptic.big();
    } else {
      this.recoil = Math.min(1, this.recoil + 0.3); this.kickVis = Math.min(0.05, (this.kickVis || 0) + 0.02); this.pitch = Math.min(1.1, this.pitch + 0.004); this.kickRoll += (Math.random() - 0.5) * 0.01; this.flashBig = false;
      this.shells.push({ t: 0, vx: 0.6 + Math.random() * 0.3, vy: 0.5, vz: -0.1 });
    }
    // 조준선을 따라 전진하며 벽 또는 사람에 닿는 첫 지점
    const dx = Math.cos(yaw) * Math.cos(pitch), dy = Math.sin(yaw) * Math.cos(pitch), dz = Math.sin(pitch);
    let best = null, bestD = 1e9, hitZ = 0;
    Object.keys(this.peers).forEach(id => {
      const p = this.peers[id];
      if (p.dead || (this.teamMode && p.team === this.team)) return;
      const rx = p.x - this.x, ry = p.y - this.y;
      const t = rx * dx + ry * dy; if (t <= 0 || t > (this.weapon === 'sniper' ? 60 : 30)) return;
      const px = this.x + dx * t, py = this.y + dy * t, pz = this.eyeZ + dz * t;
      const lateral = Math.hypot(px - p.x, py - p.y);
      // 터치 조준을 감안해 판정을 넉넉하게: 몸통 반지름 0.5 + 거리 비례 (10칸에서 약 3.5도)
      const tol = Math.max(0.5, t * 0.06);
      // 상대의 발 높이(점프 중이면 +z) 와 키(구르는 중이면 낮아짐)
      const base = p.z || 0, top = base + (p.roll ? 1.05 : 1.85);
      if (lateral > tol || pz < base - 0.2 || pz > top) return;
      if (this.blocked(this.x, this.y, p.x, p.y)) return;
      // 여러 명이 겹치면 조준선에 가장 가까운 쪽 (같으면 가까운 쪽)
      const score = lateral / tol + t * 0.01;
      if (score < bestD) { bestD = score; best = id; hitZ = pz; this._bestT = t; }
    });
    if (best) bestD = this._bestT;
    let ex = this.x, ey = this.y, ez = this.eyeZ, n = 0;
    while (!this.wall(ex, ey) && ez > 0 && ez < 2.2 && n++ < 400) { ex += dx * 0.08; ey += dy * 0.08; ez += dz * 0.08; }
    if (best) { const p = this.peers[best]; ex = p.x; ey = p.y; ez = hitZ; }
    this.tracers.push({ from: [this.x, this.y, this.eyeZ - 0.1], to: [ex, ey, ez], until: now + 80 });
    if (best) {
      const head = hitZ > 1.66;                                 // 눈높이(1.6) 직사는 몸통, 살짝 올려야 머리
      const dmg = head ? this.wpn.dmgHead : (bestD < 8 ? this.wpn.dmgBody : this.wpn.dmgFar);
      this.pops = this.pops || []; this.pops.push({ x: ex, y: ey, z: ez + 0.2, val: dmg, head: head, until: now + 800 });
      if (this.opts.onAttack) this.opts.onAttack('hit', best, { dmg: dmg, head: head ? 1 : 0 });
      this.hitMarker = head ? 1.4 : 1; this.score += head ? 5 : 3;
      if (this.models[best]) this.models[best].userData.flash = now + 150;
      if (window.Sound) Sound.lock();
    }
  }
  // 서 있는 자리의 바닥 높이 — 낮은 구조물(상자 1m · 방벽 0.6m) 위에는 올라설 수 있습니다
  floorAt(x, y) {
    const c = this.cell(x, y), h = F3_HEIGHT[c];
    return (c === 'X' || c === 'L') ? h : 0;
  }

  // 원(반지름 R) 이 주변 벽 칸과 겹치면 가장 가까운 면으로 밀어냅니다
  pushOut() {
    const R = 0.3, cx = Math.floor(this.x), cy = Math.floor(this.y);
    for (let gy = cy - 1; gy <= cy + 1; gy++) for (let gx = cx - 1; gx <= cx + 1; gx++) {
      if (!this.wall(gx + 0.5, gy + 0.5)) continue;
      const hh = F3_HEIGHT[this.cell(gx + 0.5, gy + 0.5)] || 2.4;
      if (this.z >= hh - 0.02) continue;                    // 그 구조물보다 높이 있으면 통과 (위로 올라섬)
      const nx = Math.max(gx, Math.min(gx + 1, this.x)), ny = Math.max(gy, Math.min(gy + 1, this.y));   // 칸에서 가장 가까운 점
      let dx = this.x - nx, dy = this.y - ny, d = Math.hypot(dx, dy);
      if (d >= R) continue;
      if (d < 1e-6) {                                     // 정확히 면 위: 이동 방향 반대로
        const ex = Math.abs(this.x - (gx + 0.5)), ey = Math.abs(this.y - (gy + 0.5));
        if (ex > ey) { dx = Math.sign(this.x - (gx + 0.5)) || 1; dy = 0; } else { dy = Math.sign(this.y - (gy + 0.5)) || 1; dx = 0; }
        d = 1;
      }
      this.x += dx / d * (R - d); this.y += dy / d * (R - d);
    }
    // 맵 밖으로는 절대 못 나가게
    const N = this.map.length; this.x = Math.max(1 + R, Math.min(N - 1 - R, this.x)); this.y = Math.max(1 + R, Math.min(N - 1 - R, this.y));
  }

  blocked(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d * 8);
    for (let i = 1; i < n; i++) { const t = i / n; const c = this.cell(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t); if (c === '#' || c === '=' || c === 'B' || c === 'H') return true; }
    return false;   // 상자(X)·낮은 방벽(L)은 낮아서 위로 쏠 수 있음
  }

  onEvent(e) {
    if (!e) return;
    if (e.type === 'hit' && e.target === this.myId) {
      if (this.isDead) return;
      this.hp = Math.max(0, this.hp - (e.dmg || 26)); this.hurt = 1;
      if (window.Haptic) Haptic.hit();
      const p = this.peers[e.by];
      if (p) { let da = Math.atan2(p.y - this.y, p.x - this.x) - this.yaw; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; this.dmgDir = { a: da, until: this.clock() + 900 }; }
      if (window.Sound) Sound.crash();
      const who = this.nameOf(e.by);
      if (this.hp <= 0) {
        this.deaths++; this.streak = 0; this.deadUntil = this.clock() + (this.roundMode ? 1e12 : 3000); this.score = Math.max(0, this.score - 20); this.killer = who; this.killHead = !!e.head;
        this.pushFeed(who, this.myName, '#FF5C7A', !!e.head);
        if (this.opts.onAttack) this.opts.onAttack('kill', e.by, { victim: this.myId, head: e.head ? 1 : 0 });
        if (window.Sound) Sound.gameOver();
      }
    } else if (e.type === 'kill' && e.target === this.myId) {
      this.kills++; this.streak++; this.score += 100 + (e.head ? 50 : 0) + (this.streak >= 3 ? 50 : 0);
      if (window.Haptic) Haptic.good();
      this.pushFeed(this.myName, this.nameOf(e.victim), '#06D6A0', !!e.head);
      this.showToast(e.head ? '🎯 헤드샷!  +150' : (this.streak >= 3 ? this.streak + '연속 킬  +150' : this.nameOf(e.victim) + ' 처치  +100'), e.head || this.streak >= 3 ? '#FFD166' : '#06D6A0');
      if (window.Sound) Sound.levelUp();
    } else if (e.type === 'kill') this.pushFeed(this.nameOf(e.by), this.nameOf(e.victim), '#9AA3B2', !!e.head);
  }
  nameOf(id) { if (this.peers[id] && this.peers[id].name) return this.peers[id].name; if (this.opts.nameOf) return this.opts.nameOf(id) || '?'; return '?'; }
  pushFeed(a, b, color, head) { this.feed.unshift({ a, b, color, head, until: this.clock() + 5000 }); this.feed = this.feed.slice(0, 5); }
  showToast(text, color) { this.toast = { text, color, until: this.clock() + 1600 }; }

  serialize() {
    return [this.x.toFixed(2), this.y.toFixed(2), this.yaw.toFixed(2), this.hp, this.kills, this.deaths, this.team || '',
            this.muzzle > 0.5 ? 1 : 0, this.isDead ? 1 : 0, this.moving ? 1 : 0, this.pitch.toFixed(2),
            this.z.toFixed(2), this.rollT.toFixed(2), this.round, this.wins.red, this.wins.blue].join(',');
  }
  applyPeerRaw(id, raw, name) {
    const d = Fps3DGame.parse(raw);
    if (!this.peers[id]) this.peers[id] = { x: d.x, y: d.y, angle: d.angle, walk: 0, vx: 0, vy: 0, at: 0 };
    const p = this.peers[id];
    const now = this.clock();
    // 같은 값이 다시 오면(변화 없음) 무시 — 속도 추정이 0 으로 흐트러지지 않게
    if (p.tx != null && Math.abs(p.tx - d.x) < 1e-4 && Math.abs(p.ty - d.y) < 1e-4 && Math.abs((p.tangle || 0) - d.angle) < 1e-4 && p.hp === d.hp && p.dead === d.dead && !!p.roll === !!d.roll) { p.fire = d.fire; return; }
    // 마지막 두 신호로 속도 추정 (다음 신호까지 예측 이동에 씀)
    if (p.at && p.tx != null) { const dt = Math.min(600, Math.max(50, now - p.at)) / 1000;
      const nvx = (d.x - p.tx) / dt, nvy = (d.y - p.ty) / dt;
      if (Math.hypot(nvx, nvy) < 12) { p.vx = nvx; p.vy = nvy; } else { p.vx = 0; p.vy = 0; } }   // 순간이동(리스폰)은 예측 안 함
    p.at = now;
    Object.assign(p, { tx: d.x, ty: d.y, tangle: d.angle, hp: d.hp, kills: d.kills, deaths: d.deaths, team: d.team, fire: d.fire, dead: d.dead, moving: d.moving, pitch: d.pitch, z: d.z, roll: d.roll, rollT: d.rollT, round: d.round, wr: d.wr, wb: d.wb });
    // 라운드가 더 앞선 기기가 있으면 따라갑니다 (같은 판·같은 점수를 보도록)
    if (this.teamMode && d.round > this.round) { this.round = d.round; this.wins.red = Math.max(this.wins.red, d.wr); this.wins.blue = Math.max(this.wins.blue, d.wb); this.beginRound(); }
    // 구르기는 신호가 드물어도 끊기지 않도록, 받은 시점을 기록해 두고 화면에서 이어서 재생합니다
    if (d.roll && !p.rollPlaying) { p.rollPlaying = true; p.rollAt = now - d.rollT * 700; }
    if (p.rollPlaying && now - (p.rollAt || 0) >= 700) p.rollPlaying = false;
    if (name) p.name = name;
  }
  removePeer(id) { delete this.peers[id]; if (this.models[id] && this.scene) { this.scene.remove(this.models[id]); delete this.models[id]; } }
  setPeers(map) { Object.keys(map).forEach(id => { const d = map[id]; if (d.raw) this.applyPeerRaw(id, d.raw, d.name); }); Object.keys(this.peers).forEach(id => { if (!map[id]) this.removePeer(id); }); }
  spectate(id) { this.spectator = true; this.followId = id; }

  // 화질 단계 (2 최고 · 0 최저): 해상도 배율 · 바닥 장식 · 원경
  setQuality(q) {
    this.q = Math.max(0, Math.min(2, q | 0));
    if (this.renderer) this.renderer.setPixelRatio(Math.min([0.75, 1.0, 1.25][this.q], (typeof window !== 'undefined' && window.devicePixelRatio) || 1));
    if (this.decor) this.decor.visible = this.q >= 1;
    if (this.farScenery) this.farScenery.visible = this.q >= 1;
    this._w = 0;                                         // 크기 다시 맞춤
  }

  // ── 프레임 ──
  tick(now) {
    this.now = now;
    const { dt, f } = FX.frame(this, now); this.lastF = f;
    Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (p.tx == null) return;
      // 예측 이동: 마지막 신호 이후 최대 0.25초까지는 추정 속도로 목표점을 앞당김
      const since = Math.min(250, now - (p.at || now)) / 1000;
      const gx = p.tx + (p.vx || 0) * since, gy = p.ty + (p.vy || 0) * since;
      const sk = this.smooth(0.45, f), sa = this.smooth(0.4, f);
      if (!p.dead && !this.wall(gx, gy)) { p.x += (gx - p.x) * sk; p.y += (gy - p.y) * sk; }
      else { p.x += (p.tx - p.x) * sk; p.y += (p.ty - p.y) * sk; }
      let da = p.tangle - p.angle; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; p.angle += da * sa;
      p.walk = (p.walk || 0) + (p.moving ? 0.22 * f : 0); });
    this.tracers = this.tracers.filter(t => t.until > now);
    this.muzzle = Math.max(0, this.muzzle - (this.flashBig ? 0.12 : 0.2) * f); this.recoil = Math.max(0, this.recoil - (this.weapon === 'sniper' ? 0.035 : 0.06) * f);
    // 킥: 총구가 튀어 오른 만큼 시선이 올라갔다가 되돌아옵니다 (스나이퍼는 크고 느리게)
    { const k = 1 - Math.pow(1 - (this.weapon === 'sniper' ? 0.07 : 0.2), f); this.kickVis = (this.kickVis || 0) * (1 - k); this.kickRoll = (this.kickRoll || 0) * (1 - k * 0.8); }
    if (this.zoomFlinch > 0) this.zoomFlinch = Math.max(0, this.zoomFlinch - 0.05 * f);
    if (this.boltT > 0) this.boltT = Math.max(0, this.boltT - 0.022 * f);                   // 볼트액션: 0.75초
    for (let i = this.shells.length - 1; i >= 0; i--) { const sh = this.shells[i]; sh.t += 0.05 * f; if (sh.t > 1) this.shells.splice(i, 1); }
    this.hurt = Math.max(0, this.hurt - 0.04 * f); this.hitMarker = Math.max(0, this.hitMarker - 0.08 * f);

    if (this.spectator) {
      const p = this.peers[this.followId];
      if (p) { this.x = p.x; this.y = p.y; this.z = p.z || 0; if (p.roll) { this.rollStart = now - p.rollT * 700; this.rollUntil = this.rollStart + 700; } else this.rollUntil = 0; this.yaw = p.angle; this.pitch = p.pitch || 0; this.hp = p.hp; this.kills = p.kills; this.deaths = p.deaths; this.team = p.team; this.myName = p.name || ''; this.deadUntil = p.dead ? now + 100 : 0; this.moving = p.moving; if (p.fire) this.muzzle = 1; }
      this.draw(); return;
    }
    this.stepRounds(now);
    if (this.isDead) {
      if (!this._respawned && this.deadUntil - now < 50) { this._respawned = true; this.hp = 100; this.spawnAt(Math.floor(Math.random() * 12)); this.dmgDir = null; }
      this.draw(); return;
    }
    this._respawned = false;
    if (this.reloadUntil && now >= this.reloadUntil && this.ammo < this.magSize) { this.ammo = this.magSize; this.reloadUntil = 0; if (window.Sound) Sound.rotate(); }

    this.yaw += this.turn * 0.05 * f;
    // 이동: 조이스틱(mx: 옆, my: 앞) + 키보드
    let sx = this.mx, sy = this.my;
    if (this.upHeld) sy = 1; if (this.fwd) sy = this.fwd; this.fwd = 0;
    const len = Math.hypot(sx, sy);
    this.moving = len > 0.15 ? 1 : 0;
    // 구르기: 방향·속도가 고정되고 조작을 받지 않습니다
    if (this.rolling) {
      // 처음에 밀고 나가다 서서히 멈춥니다 (등속이면 순간이동처럼 보입니다). 총 약 4칸
      const k0 = this.rollT;
      // 처음 0.12 구간은 부드럽게 붙고(순간이동처럼 튀지 않게) 이후 서서히 멈춥니다
      const ramp = Math.min(1, k0 / 0.12);
      const sp = 0.30 * ramp * Math.pow(1 - k0, 2.6) * f;   // 끝에서 확실히 멈춥니다
      const steps = Math.max(1, Math.ceil(sp / 0.12));
      for (let q = 0; q < steps; q++) { this.x += this.rollDir[0] * sp / steps; this.y += this.rollDir[1] * sp / steps; this.pushOut(); }
      this.moving = 1;
    } else if (this.moving) {
      const sp = 0.095 * f * Math.min(1, len) * (this.zoomed ? 0.4 : 1) * (this.onGround ? 1 : 0.8);   // 줌 중엔 천천히, 공중에선 조금 느리게
      const ux = (Math.cos(this.yaw) * sy - Math.sin(this.yaw) * sx) / (len || 1), uy = (Math.sin(this.yaw) * sy + Math.cos(this.yaw) * sx) / (len || 1);
      // 한 프레임에 너무 멀리 가지 않게 잘게 나눠 움직이고, 매번 벽에서 밀어냅니다
      const steps = Math.max(1, Math.ceil(sp / 0.12));
      for (let k = 0; k < steps; k++) { this.x += ux * sp / steps; this.y += uy * sp / steps; this.pushOut(); }
      if (this.onGround) this.bob += 0.2 * f;
    }
    // 점프 · 중력 (상자 1m · 낮은 방벽 0.6m 위에 올라설 수 있습니다)
    this.vz -= 0.0062 * f;
    this.z += this.vz * f;
    const floor = this.floorAt(this.x, this.y);
    if (this.z <= floor) { if (!this.onGround && this.vz < -0.03) { this.landDip = Math.min(0.35, -this.vz * 2.2); if (window.Sound) Sound.lock(); } this.z = floor; this.vz = 0; this.onGround = true; }
    else this.onGround = false;
    this.updateFov();
    if (this.firing) this.shoot();
    this.draw();
  }

  // 시야각: 줌·반동·이동 반영 (렌더러 없이도 동작하도록 tick 에서 호출)
  updateFov() {
    if (!this.camera) return;
    this.zoomK += ((this.zoomed ? 1 : 0) - this.zoomK) * this.smooth(0.25, this.lastF || 1);
    const fov = (72 + (this.wpn.zoomFov - 72) * this.zoomK) + this.recoil * 2.5 * (1 - this.zoomK) + (this.moving ? 1.5 : 0);
    if (Math.abs(this.camera.fov - fov) > 0.02) { this.camera.fov += (fov - this.camera.fov) * this.smooth(0.35, this.lastF || 1); this.camera.updateProjectionMatrix(); }
  }

  // 라운드 모드: 팀전이면서 양 팀에 최소 한 명씩 있을 때만 (혼자 연습하면 그냥 부활)
  get roundMode() { if (!this.teamMode) return false; const c = this.teamCounts(); return c.red.total > 0 && c.blue.total > 0; }
  teamCounts() {
    const c = { red: { total: 0, alive: 0 }, blue: { total: 0, alive: 0 } };
    const add = (team, dead) => { if (!c[team]) return; c[team].total++; if (!dead) c[team].alive++; };
    if (!this.spectator) add(this.team, this.isDead);
    Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (p.team) add(p.team, !!p.dead); });
    return c;
  }
  // 새 판 시작: 전원 부활 · 위치 초기화 · 탄약 가득
  beginRound() {
    const now = this.clock();
    this.roundStartAt = now; this.roundEndAt = 0; this.roundWinner = null;
    this.hp = 100; this.deadUntil = 0; this.dmgDir = null; this.ammo = this.magSize; this.reloadUntil = 0; this.zoomed = false;
    this.spawnAt((this.opts.slot || 0) + this.round);
    this.showToast('ROUND ' + this.round + '  ' + this.wins.red + ' : ' + this.wins.blue, '#FFD166');
  }
  stepRounds(now) {
    if (!this.roundMode || this.matchWinner) return;
    const c = this.teamCounts();
    // 판이 끝났다: 한 팀이 전멸 (판 시작 직후 1.5초는 판정 유예 — 신호가 아직 안 온 기기 보호)
    if (!this.roundEndAt && now - this.roundStartAt > 1500) {
      const redOut = c.red.alive === 0, blueOut = c.blue.alive === 0;
      if (redOut !== blueOut) {
        this.roundWinner = redOut ? 'blue' : 'red'; this.wins[this.roundWinner]++; this.roundEndAt = now + 3000;
        this.showToast((this.roundWinner === 'red' ? '레드' : '블루') + ' 팀 라운드 승리!  ' + this.wins.red + ' : ' + this.wins.blue, F3_TEAM_CSS[this.roundWinner]);
        if (window.Sound) Sound.levelUp();
        if (this.wins[this.roundWinner] >= 3) { this.matchWinner = this.roundWinner; this.gameOver = true; if (this.opts.onFinish) this.opts.onFinish(this.matchWinner === this.team); }
      }
    }
    if (this.roundEndAt && now >= this.roundEndAt && !this.matchWinner) { this.round++; this.beginRound(); }
  }

  // 학생 화면이 조작 버튼 위치(캔버스 좌표)를 알려 줍니다: 조이스틱 위쪽 · 오른쪽, 오른쪽 아래 버튼들의 왼쪽 끝
  setHudSafe(sf) { this.hudSafe = sf; }
  hudLayout(W, H) {
    const CW = 156, CH = 50, gap = 8, sf = this.hudSafe;
    if (!sf) return { hx: 14, hy: H - 66, ax: W - CW - 14, ay: H - 66 };            // 조작 버튼이 없을 때 (관전 등)
    const bottom = Math.min(H - 12, sf.joyBottom);
    // 가로 여유: 조이스틱 오른쪽 ~ 오른쪽 버튼 왼쪽 사이에 카드 두 장이 들어가면 바닥에 나란히
    if (sf.rightLeft - sf.joyRight >= CW * 2 + gap * 3) {
      const x0 = sf.joyRight + gap * 1.5;
      return { hx: x0, hy: bottom - CH, ax: x0 + CW + gap, ay: bottom - CH };
    }
    // 아니면 조이스틱 위에 세로로 (위가 체력, 아래가 탄약)
    const ay = sf.joyTop - gap - CH, hy = ay - gap - CH;
    return { hx: 14, hy, ax: 14, ay };
  }

  getSnapshot() { return null; }

  draw() {
    if (!this.scene) return;
    this.updateModels();
    if (this.noGL || !this.renderer) return;
    const T = THREE, now = this.clock();
    const W = this.canvas.clientWidth || 300, H = this.canvas.clientHeight || 300;
    if (this._w !== W || this._h !== H) { this._w = W; this._h = H; this.renderer.setSize(W, H, false); this.camera.aspect = W / H; this.camera.updateProjectionMatrix();
      const dpr = Math.min(1.5, window.devicePixelRatio || 1); this.hud.width = Math.round(W * dpr); this.hud.height = Math.round(H * dpr); this.hctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    // 카메라
    this.landDip = Math.max(0, (this.landDip || 0) - 0.03 * (this.lastF || 1));
    const bobY = (this.moving ? Math.sin(this.bob) * 0.03 : 0) - Math.sin(Math.min(1, this.landDip) * Math.PI) * 0.12;
    const shake = this.hurt > 0.5 ? (this.hurt - 0.5) * 0.06 : 0;
    this.camera.position.set(this.x + (Math.random() - 0.5) * shake, this.eyeZ + bobY + (Math.random() - 0.5) * shake, this.y + (Math.random() - 0.5) * shake);
    this.updateFov();
    this.camera.rotation.order = 'YXZ';
    const fl = (this.zoomFlinch || 0);
    this.camera.rotation.y = -this.yaw - Math.PI / 2 + Math.sin(fl * 40) * fl * 0.02; this.camera.rotation.x = this.pitch + (this.kickVis || 0) + Math.cos(fl * 33) * fl * 0.015; this.camera.rotation.z = (this.mx || 0) * -0.02 + (this.kickRoll || 0);   // 시선 = 이동 방향 · 옆걸음 기울기 · 반동 비틀림
    // 총 흔들림 · 반동 · 재장전
    const rel = this.reloading ? Math.sin(((this.reloadUntil - now) / this.wpn.reload) * Math.PI) * 0.25 : 0;
    // 시선 흔들림(sway): 시선이 움직인 만큼 총이 살짝 늦게 따라옵니다
    this.swayX = (this.swayX || 0) + ((this._lastYaw != null ? (this.yaw - this._lastYaw) : 0) * 0.35 - (this.swayX || 0)) * 0.15;
    this.swayY = (this.swayY || 0) + ((this._lastPitch != null ? (this.pitch - this._lastPitch) : 0) * 0.35 - (this.swayY || 0)) * 0.15;
    this._lastYaw = this.yaw; this._lastPitch = this.pitch;
    const sn = this.weapon === 'sniper', bolt = this.boltT;
    // 볼트액션: 총이 오른쪽 아래로 기울며 손이 볼트를 당기는 동작 (0 → 1 → 0 곡선)
    const bk = bolt > 0 ? Math.sin(Math.min(1, bolt) * Math.PI) : 0;
    const bobX = this.moving ? Math.sin(this.bob * 0.5) * (sn ? 0.006 : 0.01) : 0, bobY2 = this.moving ? Math.abs(Math.cos(this.bob * 0.5)) * (sn ? 0.006 : 0.01) : 0;
    const kickZ = this.recoil * (sn ? 0.16 : 0.06), kickY = this.recoil * (sn ? 0.05 : 0.01);
    this.weaponModel.position.set(0.28 + bobX - this.swayX * 0.6 + bk * 0.05, -0.26 - rel + bobY2 + kickY + this.swayY * 0.4 - bk * 0.06, -0.55 + kickZ + bk * 0.05);
    this.weaponModel.rotation.x = -rel * 1.5 + this.recoil * (sn ? 0.22 : 0.1) + this.swayY * 0.5 - bk * 0.12;
    this.weaponModel.rotation.z = this.recoil * (sn ? 0.06 : 0.02) + bk * 0.28;
    this.weaponModel.rotation.y = -0.06 - this.swayX * 0.5 + bk * 0.15;
    this.weaponModel.visible = !this.spectator && !this.isDead && this.zoomK < 0.5;
    if (this.rifleModel && this.rifleModel !== this.weaponModel) this.rifleModel.visible = false; if (this.sniperModel && this.sniperModel !== this.weaponModel) this.sniperModel.visible = false;
    // 볼트 손잡이 애니메이션 (스나이퍼 모델에만 있음)
    if (this.weaponModel.userData && this.weaponModel.userData.bolt) { const b = this.weaponModel.userData.bolt; b.position.z = -0.02 + bk * 0.12; b.rotation.z = bk * 1.2; }
    this.flash.visible = this.muzzle > 0.15; this.flash.material.opacity = Math.min(1, this.muzzle); this.flash.scale.setScalar((0.25 + this.muzzle * 0.25) * (this.flashBig ? 1.9 : 1));
    // 탄피: 오른쪽으로 튀어 나가 떨어짐
    if (this.shellMeshes) this.shellMeshes.forEach((m, i) => { const sh = this.shells[i]; if (!sh) { m.visible = false; return; } m.visible = true;
      const tt = sh.t; m.position.set(0.32 + sh.vx * tt * 0.5, -0.2 + sh.vy * tt - 2.2 * tt * tt, -0.5 + sh.vz * tt); m.rotation.x = tt * 12; m.rotation.z = tt * 9; });

    // 궤적
    this.tracers.forEach(t => {
      if (!t.line) { const geo = new T.BufferGeometry().setFromPoints([new T.Vector3(t.from[0], t.from[2], t.from[1]), new T.Vector3(t.to[0], t.to[2], t.to[1])]); t.line = new T.Line(geo, this.tracerMat); this.scene.add(t.line); }
    });
    if (this._oldTracers) this._oldTracers.forEach(t => { if (t.line && this.tracers.indexOf(t) < 0) { this.scene.remove(t.line); t.line.geometry.dispose(); } });
    this._oldTracers = this.tracers.slice();

    this.renderer.render(this.scene, this.camera);
    this.drawHud(this.hctx, W, H, now);
  }

  // 상대 모델 갱신 (위치 · 걷기 · 다운 · 이름표 · 피격 번쩍임)
  updateModels() {
    const now = this.clock();
    Object.keys(this.peers).forEach(id => {
      if (this.spectator && id === this.followId) { if (this.models[id]) this.models[id].visible = false; return; }
      const p = this.peers[id];
      let m = this.models[id];
      if (!m || m.userData.team !== p.team) { if (m) this.scene.remove(m); m = this.buildSoldier(p.team, p.name); m.userData.team = p.team; this.models[id] = m; this.scene.add(m); }
      const far = Math.hypot(p.x - this.x, p.y - this.y) > 45;
      m.visible = !far; if (far) return;
      m.rotation.order = 'YXZ';                 // 방향(y) 을 먼저 적용해야 앞으로 구르는 회전이 자연스럽습니다
      m.rotation.y = -p.angle - Math.PI / 2;
      if (p.rollPlaying && now - (p.rollAt || 0) >= 700) { p.rollPlaying = false; p.roll = false; p.rollT = -1; }   // 재생이 끝나면 정리
      const playing = p.rollPlaying;
      if (playing || p.roll) {
        // 재생 중이면 시계 기준으로만 진행 — 늦게 도착한 신호 때문에 동작이 뒤로 가지 않습니다
        const k = Math.max(0, Math.min(1, playing ? (now - p.rollAt) / 640 : Math.max(0, p.rollT)));   // 640ms 에 한 바퀴를 마치고 마지막은 착지 자세
        m.rotation.x = k * Math.PI * 2;                                     // 앞으로 한 바퀴
        m.position.set(p.x, (p.z || 0) + Math.sin(k * Math.PI) * 0.55, p.y); // 몸이 뜨면서 구름
        m.scale.y = 1;
      } else { m.rotation.x = 0; m.position.set(p.x, p.z || 0, p.y); m.scale.y = 1; }
      const u = m.userData;
      const sw = p.moving ? Math.sin(p.walk) * 0.5 : 0;
      u.legL.rotation.x = sw; u.legR.rotation.x = -sw; u.armR.rotation.x = -(p.pitch || 0) - (p.fire ? 0.35 : 0);
      if (!(playing || p.roll)) { const hop = p.moving ? Math.abs(Math.sin(p.walk)) * 0.05 : 0; m.position.y = (p.z || 0) + hop; m.rotation.z = p.moving ? Math.sin(p.walk) * 0.03 : 0; }
      // 다운: 쓰러짐
      // 다운: 쓰러짐 (구르는 중에는 건드리지 않습니다 — 회전이 깎이면 한 바퀴가 안 돕니다)
      if (!(playing || p.roll)) { const fall = p.dead ? 1 : 0; m.rotation.x += (fall * -Math.PI / 2 - m.rotation.x) * 0.2; }
      // 이름표 체력 갱신 (바뀔 때만)
      if (this.teamMode && p.team === this.team) {
        if (u.tag.userData.name !== p.name) { const nt = this.makeTag(p.name || '', p.team, p.hp); nt.position.copy(u.tag.position); m.remove(u.tag); if (u.tag.userData.material && u.tag.userData.material.map) u.tag.userData.material.map.dispose(); u.tag = nt; m.add(nt); }
        else if (u.tag.userData.hp !== p.hp) this.setTagHp(u.tag, p.hp || 0);
      }
      u.tag.visible = !p.dead && this.teamMode && p.team === this.team;      // 이름표·체력은 같은 팀만 (적은 보이지 않음)
      // 피격 번쩍임
      const fl = !!(u.flash && now < u.flash);
      if (fl !== !!u.flashOn) { u.flashOn = fl; m.traverse(o => { if (o.isMesh && o.material && o.material.emissive) o.material.emissive.setHex(fl ? 0xFFFFFF : 0x000000); }); }
    });
  }

  drawHud(ctx, W, H, now) {
    ctx.clearRect(0, 0, W, H);
    const hy = H / 2, teamC = this.team ? F3_TEAM_CSS[this.team] : '#FFD166';
    // 유리 카드 — 반투명 + 밝은 테두리
    const rr = (x, y, w, h, r, fill) => { ctx.fillStyle = fill; FX.rr(ctx, x, y, w, h, r); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1; ctx.stroke(); };

    // 피해 숫자 — 맞은 자리에서 떠오름 (3D → 화면 좌표)
    if (this.pops && this.camera) {
      this.pops = this.pops.filter(p => p.until > now);
      const v = new THREE.Vector3();
      this.pops.forEach(p => {
        const k = (p.until - now) / 800;
        v.set(p.x, p.z + (1 - k) * 0.6, p.y).project(this.camera);
        if (v.z > 1) return;
        const sx = (v.x + 1) / 2 * W, sy = (1 - v.y) / 2 * H;
        ctx.globalAlpha = Math.min(1, k * 2);
        ctx.font = '800 ' + (p.head ? 22 : 17) + 'px Pretendard, sans-serif'; ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4;
        ctx.fillStyle = p.head ? '#FFD166' : '#FFFFFF'; ctx.fillText((p.head ? '🎯 ' : '') + '-' + p.val, sx, sy);
        ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.textAlign = 'left';
      });
    }

    // 나침반 띠 (위쪽)
    {
      const cw = Math.min(260, W * 0.6), cx0 = W / 2 - cw / 2, cy0 = this.teamMode ? 56 : 52;
      rr(cx0, cy0, cw, 18, 9, 'rgba(8,10,16,0.45)');
      ctx.save(); ctx.beginPath(); ctx.rect(cx0, cy0, cw, 18); ctx.clip();
      const labels = ['E', 'S', 'W', 'N'];
      for (let k = -8; k <= 8; k++) {
        const a = k * Math.PI / 4;
        let da = a - this.yaw; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
        const px = W / 2 + da / (Math.PI / 2) * (cw / 2);
        if (px < cx0 - 10 || px > cx0 + cw + 10) continue;
        const major = ((k % 2) + 2) % 2 === 0;
        ctx.fillStyle = major ? '#fff' : 'rgba(255,255,255,0.4)';
        if (major) { ctx.font = '800 11px Pretendard, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(labels[(((k / 2) % 4) + 4) % 4], px, cy0 + 13); }
        else ctx.fillRect(px - 0.5, cy0 + 6, 1, 6);
      }
      ctx.restore(); ctx.textAlign = 'left';
      ctx.fillStyle = '#FFD166'; ctx.fillRect(W / 2 - 1, cy0 - 3, 2, 24);
    }
    // 스코프 (스나이퍼 줌)
    if (this.zoomK > 0.05) {
      const R = Math.min(W, H) * 0.42, k = this.zoomK;
      ctx.save(); ctx.globalAlpha = k;
      ctx.fillStyle = 'rgba(0,0,0,0.92)'; ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(W / 2, hy, R, 0, Math.PI * 2, true); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(W / 2, hy, R, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(W / 2 - R, hy); ctx.lineTo(W / 2 + R, hy); ctx.moveTo(W / 2, hy - R); ctx.lineTo(W / 2, hy + R); ctx.stroke();
      for (let i = 1; i <= 4; i++) { const d = R * i / 5; ctx.beginPath(); ctx.moveTo(W / 2 - 8, hy + d); ctx.lineTo(W / 2 + 8, hy + d); ctx.moveTo(W / 2 - d, hy - 6); ctx.lineTo(W / 2 - d, hy + 6); ctx.moveTo(W / 2 + d, hy - 6); ctx.lineTo(W / 2 + d, hy + 6); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(255,60,80,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(W / 2, hy, 6, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    // 조준점 + 히트마커
    const gap = 6 + this.recoil * 10 + (this.moving ? 5 : 0);
    if (this.zoomK > 0.5) { /* 스코프 중엔 십자선이 대신함 */ }
    if (this.zoomK < 0.5) {
      ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 3;
      const g2 = this.weapon === 'sniper' ? gap + 10 : gap;   // 스나이퍼는 줌 없이 쏘면 산탄이 큼을 표시
      [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([ax, ay]) => { ctx.beginPath(); ctx.moveTo(W / 2 + ax * g2, hy + ay * g2); ctx.lineTo(W / 2 + ax * (g2 + 8), hy + ay * (g2 + 8)); ctx.stroke(); });
      ctx.shadowBlur = 0;
    }
    if (this.hitMarker > 0) { const hm = Math.min(1, this.hitMarker); ctx.strokeStyle = this.hitMarker > 1 ? 'rgba(255,214,102,' + hm + ')' : 'rgba(255,80,80,' + hm + ')'; ctx.lineWidth = 3;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([ax, ay]) => { ctx.beginPath(); ctx.moveTo(W / 2 + ax * 6, hy + ay * 6); ctx.lineTo(W / 2 + ax * 16, hy + ay * 16); ctx.stroke(); }); }
    if (this.dmgDir && now < this.dmgDir.until) { const k = (this.dmgDir.until - now) / 900; ctx.save(); ctx.translate(W / 2, hy); ctx.rotate(this.dmgDir.a); ctx.strokeStyle = 'rgba(255,60,80,' + (k * 0.9).toFixed(2) + ')'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, Math.min(W, H) * 0.22, -0.35, 0.35); ctx.stroke(); ctx.restore(); }
    if (this.hurt > 0 || (this.hp <= 30 && !this.isDead)) { const a = Math.max(this.hurt * 0.6, this.hp <= 30 && !this.isDead ? 0.25 + Math.sin(now / 180) * 0.12 : 0); const g = ctx.createRadialGradient(W / 2, hy, H * 0.25, W / 2, hy, H * 0.85); g.addColorStop(0, 'rgba(255,40,70,0)'); g.addColorStop(1, 'rgba(255,40,70,' + a.toFixed(2) + ')'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    // ── 체력 · 탄약 카드: 조작 버튼을 피해 빈자리에 ──
    // 학생 화면이 버튼 위치를 재서 알려 줍니다 (setHudSafe). 가로가 넉넉하면 조이스틱 오른쪽 바닥에 나란히,
    // 좁으면 조이스틱 위에 세로로 쌓습니다.
    const L = this.hudLayout(W, H), CW = 156, CH = 50;
    const cx0 = L.hx, cy0 = L.hy, ax = L.ax, ay = L.ay;
    // 체력 (+ 오른쪽 안에 구르기 쿨다운 링)
    rr(cx0, cy0, CW, CH, 14, 'rgba(8,10,16,0.72)');
    ctx.fillStyle = this.hp > 40 ? '#06D6A0' : '#FF5C7A'; ctx.font = '800 24px Pretendard, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('+', cx0 + 12, cy0 + 32); ctx.fillText(String(this.hp), cx0 + 32, cy0 + 32);
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(cx0 + 12, cy0 + 38, 100, 5); ctx.fillStyle = this.hp > 40 ? '#06D6A0' : '#FF5C7A'; ctx.fillRect(cx0 + 12, cy0 + 38, 100 * this.hp / 100, 5);
    { const cd = Math.max(0, (this.rollCdUntil - now) / 3000), rx = cx0 + CW - 22, ry = cy0 + CH / 2, r2 = 13;
      ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(rx, ry, r2, 0, Math.PI * 2); ctx.stroke();
      if (cd > 0) { ctx.strokeStyle = '#4CC9F0'; ctx.beginPath(); ctx.arc(rx, ry, r2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - cd)); ctx.stroke(); }
      ctx.fillStyle = cd > 0 ? 'rgba(255,255,255,0.45)' : '#4CC9F0'; ctx.font = '800 13px Pretendard, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⤻', rx, ry + 1); ctx.textBaseline = 'alphabetic'; }
    // 탄약
    rr(ax, ay, CW, CH, 14, 'rgba(8,10,16,0.72)');
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FFD166'; ctx.font = '800 11px Pretendard, sans-serif'; ctx.fillText(this.wpn.name + (this.weapon === 'sniper' ? ' 🔍' : ''), ax + CW - 12, ay + 15);
    if (this.reloading) {
      ctx.fillStyle = '#FFD166'; ctx.font = '800 15px Pretendard, sans-serif'; ctx.fillText(this.reloadUntil > now ? '재장전 중…' : '무기 준비…', ax + CW - 12, ay + 34);
      const rl = this.reloadUntil > now ? (1 - (this.reloadUntil - now) / this.wpn.reload) : (1 - ((this.readyUntil || 0) - now) / 800);
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(ax + 12, ay + 40, CW - 24, 5); ctx.fillStyle = '#FFD166'; ctx.fillRect(ax + 12, ay + 40, (CW - 24) * Math.max(0, Math.min(1, rl)), 5);
    } else {
      ctx.fillStyle = this.ammo > (this.magSize > 10 ? 6 : 1) ? '#FFFFFF' : '#FF5C7A'; ctx.font = '800 24px Pretendard, sans-serif'; ctx.fillText(String(this.ammo), ax + CW - 46, ay + 35);
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '700 12px Pretendard, sans-serif'; ctx.fillText('/ ' + this.magSize, ax + CW - 12, ay + 35);
      const ticks = Math.min(15, this.magSize), per = this.magSize / ticks, tw = (CW - 24) / ticks;
      for (let k = 0; k < ticks; k++) { ctx.fillStyle = k < Math.ceil(this.ammo / per) ? (this.ammo > (this.magSize > 10 ? 6 : 1) ? '#FFD166' : '#FF5C7A') : 'rgba(255,255,255,0.15)'; ctx.fillRect(ax + 12 + k * tw, ay + 41, Math.max(3, tw - 2), 5); }
    }
    ctx.textAlign = 'left';
    // 점수판
    if (this.teamMode) {
      let red = 0, blue = 0; const add = (t, k) => { if (t === 'red') red += k; else if (t === 'blue') blue += k; };
      add(this.team, this.kills); Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (this.spectator && id === this.followId) return; add(p.team, p.kills || 0); });
      rr(W / 2 - 84, 10, 168, 40, 14, 'rgba(8,10,16,0.72)'); ctx.textAlign = 'center'; ctx.font = '800 22px Pretendard, sans-serif';
      ctx.fillStyle = F3_TEAM_CSS.red; ctx.fillText(String(red), W / 2 - 40, 39); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '700 14px Pretendard, sans-serif'; ctx.fillText('RED   BLUE', W / 2, 38);
      ctx.fillStyle = F3_TEAM_CSS.blue; ctx.font = '800 22px Pretendard, sans-serif'; ctx.fillText(String(blue), W / 2 + 40, 39); ctx.textAlign = 'left';
      ctx.fillStyle = teamC; ctx.font = '800 12px Pretendard, sans-serif'; ctx.fillText(this.team === 'red' ? '🔴 RED' : '🔵 BLUE', 62, 28);
    } else { rr(W / 2 - 64, 10, 128, 36, 14, 'rgba(8,10,16,0.72)'); ctx.textAlign = 'center'; ctx.font = '800 16px Pretendard, sans-serif'; ctx.fillStyle = '#FFD166'; ctx.fillText('K ' + this.kills + '   D ' + this.deaths, W / 2, 34); ctx.textAlign = 'left'; }
    // 킬 피드
    this.feed = this.feed.filter(x => x.until > now); ctx.font = '700 12px Pretendard, sans-serif'; ctx.textAlign = 'right';
    this.feed.forEach((x, i) => { const y = 66 + i * 20, t = x.a + (x.head ? '  🎯  ' : '  ⚡  ') + x.b; const tw = ctx.measureText(t).width + 16; rr(W - 14 - tw, y - 14, tw, 19, 8, 'rgba(8,10,16,0.6)'); ctx.fillStyle = x.color; ctx.fillText(t, W - 22, y); });
    ctx.textAlign = 'left';

    // 팀전 라운드 점수판: 위 가운데 '레드 2 : 1 블루 · ROUND 4'
    if (this.teamMode) {
      const c = this.teamCounts(), w = 220, x0 = W / 2 - w / 2, y0 = 10;
      FX.glass(ctx, x0, y0, w, 44, 14, this.roundWinner ? F3_TEAM_CSS[this.roundWinner] : undefined);
      FX.text(ctx, String(this.wins.red), W / 2 - 46, y0 + 30, { size: 24, weight: 800, color: F3_TEAM_CSS.red, align: 'center' });
      FX.text(ctx, ':', W / 2, y0 + 29, { size: 20, weight: 800, color: 'rgba(255,255,255,0.6)', align: 'center' });
      FX.text(ctx, String(this.wins.blue), W / 2 + 46, y0 + 30, { size: 24, weight: 800, color: F3_TEAM_CSS.blue, align: 'center' });
      FX.text(ctx, this.roundMode ? ('R' + this.round + '  ' + c.red.alive + 'v' + c.blue.alive) : '5판 3선승', W / 2, y0 + 41, { size: 10, weight: 700, color: 'rgba(255,255,255,0.55)', align: 'center' });
      // 남은 인원 점: 왼쪽 레드, 오른쪽 블루
      for (let i = 0; i < Math.min(8, c.red.total); i++) { ctx.fillStyle = i < c.red.alive ? F3_TEAM_CSS.red : 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(x0 - 10 - i * 11, y0 + 22, 3.5, 0, Math.PI * 2); ctx.fill(); }
      for (let i = 0; i < Math.min(8, c.blue.total); i++) { ctx.fillStyle = i < c.blue.alive ? F3_TEAM_CSS.blue : 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(x0 + w + 10 + i * 11, y0 + 22, 3.5, 0, Math.PI * 2); ctx.fill(); }
    }
    if (this.matchWinner) {
      ctx.fillStyle = 'rgba(8,10,16,0.7)'; ctx.fillRect(0, 0, W, H); const win = this.matchWinner === this.team;
      FX.text(ctx, win ? '승리!' : '패배', W / 2, H * 0.42, { size: 56, weight: 800, color: win ? '#FFD166' : '#9AA3B2', align: 'center', baseline: 'middle', shadow: 14 });
      FX.text(ctx, (this.matchWinner === 'red' ? '레드' : '블루') + ' 팀  ' + this.wins.red + ' : ' + this.wins.blue, W / 2, H * 0.42 + 48, { size: 22, weight: 800, color: F3_TEAM_CSS[this.matchWinner], align: 'center', baseline: 'middle' });
    }
    this.drawMinimap(ctx, W, H);
    if (this.toast && now < this.toast.until) { ctx.textAlign = 'center'; ctx.font = '800 18px Pretendard, sans-serif'; ctx.fillStyle = this.toast.color; ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4; ctx.fillText(this.toast.text, W / 2, hy + 80); ctx.shadowBlur = 0; ctx.textAlign = 'left'; }
    if (this.isDead) {
      ctx.fillStyle = 'rgba(8,10,16,0.55)'; ctx.fillRect(0, 0, W, H); const left = this.roundMode ? 0 : (this.deadUntil - now) / 3000;
      if (this.roundMode) {
        const c = this.teamCounts();
        FX.text(ctx, '쓰러졌습니다 — 이번 판은 관전', W / 2, hy - 24, { size: 22, weight: 800, color: '#FF5C7A', align: 'center', shadow: 8 });
        FX.text(ctx, '레드 ' + c.red.alive + '명 · 블루 ' + c.blue.alive + '명 남음', W / 2, hy + 10, { size: 16, weight: 700, color: '#fff', align: 'center', shadow: 6 });
      } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(W / 2, hy, 48, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#FF5C7A'; ctx.beginPath(); ctx.arc(W / 2, hy, 48, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - left)); ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '800 30px Pretendard, sans-serif'; ctx.fillText(String(Math.ceil(left * 3)), W / 2, hy + 11);
      ctx.fillStyle = '#FF5C7A'; ctx.font = '800 20px Pretendard, sans-serif'; ctx.fillText((this.killer || '누군가') + (this.killHead ? ' 의 헤드샷' : ' 에게 당했다'), W / 2, hy - 74);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '600 13px Pretendard, sans-serif'; ctx.fillText('잠시 후 다시 등장합니다', W / 2, hy + 78); ctx.textAlign = 'left';
    }
    if (this.spectator) { ctx.textAlign = 'center'; ctx.font = '700 13px Pretendard, sans-serif'; ctx.fillStyle = '#FFD166'; ctx.fillText('👁 ' + this.myName + ' 의 화면', W / 2, this.teamMode ? 66 : 64); ctx.textAlign = 'left'; }
    if (this.showBoard) this.drawScoreboard(ctx, W, H);
  }

  // 점수판 — 전원 킬/데스 (팀전은 팀별로 나눔)
  drawScoreboard(ctx, W, H) {
    const rows = [{ id: this.myId, name: this.myName || '나', k: this.kills, d: this.deaths, team: this.team, me: true, dead: this.isDead }];
    Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (this.spectator && id === this.followId) return; rows.push({ id, name: p.name || '학생', k: p.kills || 0, d: p.deaths || 0, team: p.team, me: false, dead: p.dead }); });
    rows.sort((a, b) => (b.k - a.k) || (a.d - b.d));
    const groups = this.teamMode ? [['red', rows.filter(r => r.team === 'red')], ['blue', rows.filter(r => r.team === 'blue')]] : [[null, rows]];
    const rowH = 22, bw = Math.min(W - 24, 360);
    let bh = 34; groups.forEach(([t, g]) => { bh += (t ? 26 : 0) + Math.min(g.length, 10) * rowH + 8; });
    const x0 = W / 2 - bw / 2, y0 = Math.max(60, H / 2 - bh / 2);
    ctx.save();
    ctx.fillStyle = 'rgba(8,10,16,0.88)'; FX.rr(ctx, x0, y0, bw, bh, 18); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.textBaseline = 'middle';
    ctx.font = '800 13px Pretendard, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.textAlign = 'left'; ctx.fillText('점수판', x0 + 16, y0 + 18);
    ctx.textAlign = 'right'; ctx.font = '700 11px Pretendard, sans-serif'; ctx.fillText('K      D', x0 + bw - 18, y0 + 18);
    let y = y0 + 34;
    groups.forEach(([t, g]) => {
      if (t) { ctx.textAlign = 'left'; ctx.font = '800 12px Pretendard, sans-serif'; ctx.fillStyle = F3_TEAM_CSS[t];
        const tk = g.reduce((a, r) => a + r.k, 0); ctx.fillText((t === 'red' ? '🔴 RED' : '🔵 BLUE') + '  ' + tk, x0 + 16, y + 13); y += 26; }
      g.slice(0, 10).forEach((r, i) => {
        if (r.me) { ctx.fillStyle = 'rgba(255,255,255,0.10)'; FX.rr(ctx, x0 + 8, y + 1, bw - 16, rowH - 2, 7); ctx.fill(); }
        ctx.textAlign = 'left'; ctx.font = (r.me ? '800' : '600') + ' 13px Pretendard, sans-serif';
        ctx.fillStyle = r.dead ? 'rgba(255,255,255,0.4)' : (r.team ? F3_TEAM_CSS[r.team] : '#fff');
        ctx.fillText((i + 1) + '.  ' + r.name, x0 + 16, y + rowH / 2);
        ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.font = '700 13px Pretendard, sans-serif';
        ctx.fillText(r.k + '      ' + r.d, x0 + bw - 18, y + rowH / 2);
        y += rowH;
      });
      y += 8;
    });
    ctx.restore(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  drawMinimap(ctx, W, H) {
    const n = this.map.length, R = Math.min(58, W * 0.16), cx = 14 + R, cy = 62 + R, cs = 4.6;   // 1칸 = 4.6px (반지름 58 → 약 12칸 시야)
    // 벽 이미지는 한 번만 (맵 전체)
    if (!this._mm) {
      const px = 6; this._mm = document.createElement('canvas'); this._mm.width = n * px; this._mm.height = n * px;
      const g = this._mm.getContext('2d'); g.fillStyle = 'rgba(255,255,255,0.32)';
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (this.map[y][x] !== '.') g.fillRect(x * px, y * px, px, px);
      this._mmPx = px;
    }
    ctx.save();
    // 둥근 창 + 바탕
    ctx.beginPath(); ctx.arc(cx, cy, R + 4, 0, Math.PI * 2); ctx.fillStyle = 'rgba(8,10,16,0.72)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    // 내 시선이 위쪽(12시)이 되도록 맵을 회전해서 붙임
    ctx.translate(cx, cy); ctx.rotate(-this.yaw - Math.PI / 2);
    const k = cs / this._mmPx;
    ctx.drawImage(this._mm, -this.x * cs, -this.y * cs, this._mm.width * k, this._mm.height * k);
    // 다른 플레이어: 적은 빨강 · 같은 팀은 팀색 · 다운은 회색
    Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (this.spectator && id === this.followId) return;
      const ally = this.teamMode && p.team === this.team;
      ctx.fillStyle = p.dead ? '#6B7280' : (ally ? F3_TEAM_CSS[p.team] : '#FF4D6D');
      ctx.beginPath(); ctx.arc((p.x - this.x) * cs, (p.y - this.y) * cs, ally ? 3 : 3.4, 0, Math.PI * 2); ctx.fill();
      if (!ally && !p.dead) { ctx.strokeStyle = 'rgba(255,77,109,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc((p.x - this.x) * cs, (p.y - this.y) * cs, 6, 0, Math.PI * 2); ctx.stroke(); } });
    ctx.restore();
    // 나 (중심, 항상 위를 봄) + 시야 부채꼴
    ctx.save(); ctx.translate(cx, cy);
    ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, -Math.PI / 2 - Math.PI / 6, -Math.PI / 2 + Math.PI / 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4.5, 4); ctx.lineTo(0, 2); ctx.lineTo(-4.5, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
    // 북쪽 표시 (원 테두리 위)
    const na = -this.yaw - Math.PI / 2 + (-Math.PI / 2);   // 북(-y 방향)이 화면에서 가리키는 각
    ctx.fillStyle = '#FFD166'; ctx.font = '800 10px Pretendard, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('N', cx + Math.cos(na) * (R + 4), cy + Math.sin(na) * (R + 4)); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  destroy() {
    if (this.hud && this.hud.parentElement) this.hud.parentElement.removeChild(this.hud);
    if (this.renderer) { try { this.renderer.dispose(); } catch (e) {} }
  }
}
