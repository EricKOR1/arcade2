// 레이저 태그 3D (Three.js) — 1인칭 시점. 개인전 · 팀전 · 매칭전(N:N 자동 매칭).
// 30명 기준: 상대는 부위별 InstancedMesh 로 한 번에 그리고, 위치는 '보낸 시각 + 속도' 로 지금 위치를 예측해 그립니다. 맵은 인원에 맞춰 넓어집니다.
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

// ── 인원에 맞춘 맵 크기 ──
// 교사 화면이 시작할 때 접속 인원을 맵 이름 뒤에 붙여 알려 줍니다 ('plaza:24'). 모든 학생(늦게 들어온 학생 포함)이 같은 값을 받아 같은 맵을 만듭니다.
// 8명까지 기본(1배), 그 위로는 √(인원/8) 배를 0.25 단위로: 12명 1.25 · 16명 1.5 · 24명 1.75 · 30명 2배
function f3ScaleFor(n) { n = +n || 0; if (n <= 8) return 1; return Math.min(2, Math.max(1, Math.round(Math.sqrt(n / 8) * 4) / 4)); }
// 기기마다 똑같이 나오는 난수 (Math.random 대신 — 벽 위치가 기기마다 다르면 안 됨)
function f3Hash(a, b, c) { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
const F3_LINE = '#=BHWLX';   // 이어진 줄로 늘리는 구조물 (P 기둥 · T 나무 · R 바위는 낱개로 자리만 옮김)
// 맵을 s 배로 넓힘: 각 칸을 새 자리로 옮기고, 이어져 있던 벽은 그 사이를 다시 이어 붙입니다 (벽 두께는 1칸 그대로 · 방·골목이 넓어짐)
function f3Scale(rows, spawns, s) {
  const N0 = rows.length, N1 = Math.round(N0 * s), half = (N0 - 1) / 2;
  // 점대칭이 그대로 유지되는 자리 옮김 (바깥 벽은 새 맵의 바깥 벽으로)
  const f = p => p <= 0 ? 0 : (p >= N0 - 1 ? N1 - 1 : (p <= half ? Math.floor((p + 0.5) * s) : N1 - 1 - Math.floor((N0 - 1 - p + 0.5) * s)));
  const m = f3Grid(N1), { set } = m; m.rect(0, 0, N1, N1, '#');
  const at = (x, y) => (rows[y] && rows[y][x]) || '.';
  for (let y = 0; y < N0; y++) for (let x = 0; x < N0; x++) {
    const c = at(x, y); if (c === '.') continue;
    const X = f(x), Y = f(y); set(X, Y, c);
    if (F3_LINE.indexOf(c) < 0) continue;
    // 바로 옆(오른쪽·아래)이 같은 구조물이면 그 사이를 이어 붙임 (바깥 벽에 붙은 벽도 그대로 붙어 있음)
    if (at(x + 1, y) === c) for (let k = X + 1; k < f(x + 1); k++) set(k, Y, c);
    if (at(x, y + 1) === c) for (let k = Y + 1; k < f(y + 1); k++) set(X, k, c);
    if (at(x + 1, y) === c && at(x, y + 1) === c && at(x + 1, y + 1) === c) for (let yy = Y + 1; yy < f(y + 1); yy++) for (let xx = X + 1; xx < f(x + 1); xx++) set(xx, yy, c);
  }
  const sp = spawns.map(([sx, sy]) => { const cx = Math.min(N0 - 1, Math.floor(sx)), cy = Math.min(N0 - 1, Math.floor(sy)); return [f(cx) + (sx - cx), f(cy) + (sy - cy)]; });
  return { m, spawns: sp };
}
// 가운데를 S×S 로 잘라 작은 맵 (매칭전 1:1 ~ 5:5). 점대칭은 그대로
function f3Crop(rows, spawns, S) {
  const N0 = rows.length, m = f3Grid(Math.min(S, N0)), o = Math.max(0, (N0 - m.N) >> 1);
  for (let y = 0; y < m.N; y++) for (let x = 0; x < m.N; x++) m.g[y][x] = rows[y + o][x + o];
  m.rect(0, 0, m.N, m.N, '#');
  const sp = spawns.map(([x, y]) => [x - o, y - o]).filter(([x, y]) => x > 1.4 && y > 1.4 && x < m.N - 1.4 && y < m.N - 1.4 && m.g[Math.floor(y)][Math.floor(x)] === '.');
  return { m, spawns: sp };
}
// 넓어진 빈터에 까는 엄폐물 — 테마별 [낮은 엄폐물], [시야를 가리는 큰 구조물], 큰 구조물 벽 재질(*)
const F3_PIECES = {
  crate: [[0, 0, 'X']], crate2: [[0, 0, 'X'], [1, 0, 'X']], crates3: [[0, 0, 'X'], [1, 0, 'X'], [0, 1, 'X']], low3: [[-1, 0, 'L'], [0, 0, 'L'], [1, 0, 'L']], bunker: [[-1, 0, 'L'], [0, 0, 'X'], [1, 0, 'L']],
  rock: [[0, 0, 'R']], rock2: [[0, 0, 'R'], [1, 1, 'R']], pillar: [[0, 0, 'P']], pillars: [[-1, 0, 'P'], [1, 0, 'P']], trees: [[0, 0, 'T'], [1, 1, 'T'], [-1, 1, 'T']],
  seg3: [[-1, 0, '*'], [0, 0, '*'], [1, 0, '*']], seg4: [[-1, 0, '*'], [0, 0, '*'], [1, 0, '*'], [2, 0, '*']], corner: [[-1, -1, '*'], [0, -1, '*'], [1, -1, '*'], [-1, 0, '*'], [-1, 1, '*']],
  window: [[-1, 0, 'W'], [0, 0, 'W'], [1, 0, 'W']], block: [[0, 0, '*'], [1, 0, '*'], [0, 1, '*'], [1, 1, '*']], cover: [[-1, 0, '*'], [0, 0, '*'], [1, 0, '*'], [0, 1, 'X']]
};
const F3_COVER = {
  plaza: [['crate', 'crate2', 'low3', 'bunker', 'crates3'], ['seg3', 'corner', 'cover', 'seg4'], 'B'],
  desert: [['crate', 'rock2', 'low3', 'crate2'], ['seg3', 'corner', 'pillars', 'cover'], 'B'],
  warehouse: [['crate', 'crate2', 'low3', 'bunker', 'crates3'], ['seg4', 'corner', 'block'], 'H'],
  arctic: [['low3', 'rock2', 'crate'], ['trees', 'window', 'corner', 'seg3'], '='],
  city: [['crate2', 'rock', 'low3'], ['block', 'corner', 'pillars', 'seg3'], 'H'],
  jungle: [['rock2', 'crate', 'rock'], ['trees', 'corner', 'seg3', 'trees'], 'B']
};
// 빈칸마다 가장 가까운 구조물까지의 거리 (8방향 칸 수)
function f3Clear(m) {
  const N = m.N, D = new Int16Array(N * N).fill(-1), q = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (m.g[y][x] !== '.') { D[y * N + x] = 0; q.push(y * N + x); }
  for (let h = 0; h < q.length; h++) { const i = q[h], x = i % N, y = (i / N) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue; const j = ny * N + nx; if (D[j] < 0) { D[j] = D[i] + 1; q.push(j); } } }
  return D;
}
// 마무리: 빈터에 엄폐물 · 출발 위치 더하기 · 막힌 곳 뚫기 (모두 점대칭 · 결정적)
function f3Finish(m, spawns, o) {
  const N = m.N, g = m.g, seed = o.seed | 0, open = o.passable || '.XLR';   // 지나갈 수 있는 칸 (상자·방벽·바위는 점프로 넘음)
  const mir = (x, y) => [N - 1 - x, N - 1 - y];
  const nearSpawn = (x, y, r) => spawns.some(s => Math.abs(s[0] - x - 0.5) < r && Math.abs(s[1] - y - 0.5) < r);
  if (o.fill) {
    const D = f3Clear(m), cover = F3_COVER[o.theme] || F3_COVER.plaza, step = o.step || 6;
    for (let y0 = 3; y0 < N - 3; y0 += step) for (let x0 = 3; x0 < N - 3; x0 += step) {
      const x = x0 + Math.floor(f3Hash(x0, y0, seed) * 3) - 1, y = y0 + Math.floor(f3Hash(y0, x0, seed + 7) * 3) - 1;
      if (y * N + x >= (N * N) / 2 || Math.abs(x - (N - 1) / 2) < 3 && Math.abs(y - (N - 1) / 2) < 3) continue;   // 앞 절반만 놓고 거울로 복사 · 한가운데는 비움
      const d = D[y * N + x], r = f3Hash(x, y, seed + 3);
      if (d < 3 || r > (o.density || 0.8)) continue;
      const tall = d >= 4 && f3Hash(x, y, seed + 5) < (o.tall || 0.5), list = cover[tall ? 1 : 0], piece = F3_PIECES[list[Math.floor(f3Hash(x, y, seed + 9) * list.length)]];
      const rot = Math.floor(f3Hash(x, y, seed + 11) * 4), cells = piece.map(([dx, dy, c]) => { const ax = rot & 1 ? dy : dx, ay = rot & 1 ? dx : dy, sx = rot & 2 ? -1 : 1; return [x + ax * sx, y + ay * sx, c === '*' ? cover[2] : c]; });   // 네 방향으로 돌려 놓기
      const mine = (ax, ay) => cells.some(([cx, cy]) => cx === ax && cy === ay);
      const freeAround = (cx, cy) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g[cy + dy][cx + dx] !== '.' && !mine(cx + dx, cy + dy)) return false; return true; };   // 먼저 놓은 엄폐물과 붙지 않게 (통로가 막히지 않게)
      const ok = cells.every(([cx, cy]) => { const [mx, my] = mir(cx, cy); return cx > 1 && cy > 1 && cx < N - 2 && cy < N - 2 && g[cy][cx] === '.' && D[cy * N + cx] >= 2 && freeAround(cx, cy) && g[my][mx] === '.' && !nearSpawn(cx, cy, 1.6) && !nearSpawn(mx, my, 1.6) && !(Math.abs(cx - mx) < 2 && Math.abs(cy - my) < 2); });
      if (ok) cells.forEach(([cx, cy, c]) => { const [mx, my] = mir(cx, cy); g[cy][cx] = c; g[my][mx] = c; });
    }
  }
  // 막힌 곳(잘린 맵의 닫힌 방 등): 첫 출발점에서 갈 수 없는 빈칸 무리는 벽 한 칸을 뚫어 잇고, 안 되면 메움
  const reach = () => { const R = new Uint8Array(N * N), q = []; let st = spawns.find(s => g[Math.floor(s[1])] && open.indexOf(g[Math.floor(s[1])][Math.floor(s[0])]) >= 0);
    if (!st) { for (let y = 1; y < N - 1 && !st; y++) for (let x = 1; x < N - 1; x++) if (g[y][x] === '.') { st = [x + 0.5, y + 0.5]; break; } }
    if (!st) return R; const s0 = Math.floor(st[1]) * N + Math.floor(st[0]); R[s0] = 1; q.push(s0);
    for (let h = 0; h < q.length; h++) { const i = q[h], x = i % N, y = (i / N) | 0; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const j = (y + dy) * N + x + dx; if (!R[j] && open.indexOf(g[y + dy][x + dx]) >= 0) { R[j] = 1; q.push(j); } }); }
    return R; };
  for (let pass = 0; pass < 12; pass++) {
    const R = reach(); let fixed = false, lost = null;
    for (let y = 1; y < N - 1 && !fixed; y++) for (let x = 1; x < N - 1 && !fixed; x++) {
      if (g[y][x] !== '.' || R[y * N + x]) continue;
      lost = lost || [x, y];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        for (let t = 1; t <= 2 && !fixed; t++) {   // 두께 1~2칸 벽
          const bx = x + dx * (t + 1), by = y + dy * (t + 1); if (bx < 1 || by < 1 || bx > N - 2 || by > N - 2) break;
          let wallOk = true; for (let k = 1; k <= t; k++) { const wx = x + dx * k, wy = y + dy * k; if (wx < 1 || wy < 1 || wx > N - 2 || wy > N - 2 || open.indexOf(g[wy][wx]) >= 0) wallOk = false; }
          if (wallOk && R[by * N + bx]) { for (let k = 1; k <= t; k++) { const wx = x + dx * k, wy = y + dy * k, [mx, my] = mir(wx, wy); g[wy][wx] = '.'; g[my][mx] = '.'; } fixed = true; }
        }
        if (fixed) break;
      }
    }
    if (!fixed) { if (lost) { for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) if (g[y][x] === '.' && !R[y * N + x]) g[y][x] = '#'; } break; }
  }
  const R = reach();
  spawns = spawns.filter(([x, y]) => R[Math.floor(y) * N + Math.floor(x)] && g[Math.floor(y)][Math.floor(x)] === '.');
  // 출발 위치 더하기: 넓게 흩어진 빈칸 (점대칭 짝으로)
  const want = o.want || spawns.length;
  if (spawns.length < want) {
    const D = f3Clear(m), cand = [];
    const sc = o.spawnClear || 2;
    for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) if ((x + y) % 2 === 0 && y * N + x < (N * N) / 2 && D[y * N + x] >= sc && R[y * N + x] && g[y][x] === '.') cand.push([x, y, f3Hash(x, y, seed + 21)]);
    cand.sort((a, b) => a[2] - b[2]);
    for (let gap = Math.max(5, N / 6); gap >= 3 && spawns.length < want; gap -= 1.5)
      for (const [x, y] of cand) { if (spawns.length >= want) break; const [mx, my] = mir(x, y);
        if (spawns.some(s => Math.hypot(s[0] - x - 0.5, s[1] - y - 0.5) < gap || Math.hypot(s[0] - mx - 0.5, s[1] - my - 0.5) < gap)) continue;
        spawns.push([x + 0.5, y + 0.5], [mx + 0.5, my + 0.5]); }
  }
  return { rows: m.rows(), spawns };
}
// 여러 도형을 한 도형으로 합침 (같은 재질이면 그리기 호출 한 번) — position · normal · uv · color 를 이어 붙임
function f3MergeGeos(list) {
  const T = THREE, out = new T.BufferGeometry(), keys = ['position', 'normal', 'uv', 'color', 'sfx'].filter(k => list.every(g => g.attributes[k]));
  const arr = {}, idx = []; keys.forEach(k => arr[k] = []); let base = 0;
  list.forEach(g => { keys.forEach(k => { const a = g.attributes[k].array; for (let i = 0; i < a.length; i++) arr[k].push(a[i]); });
    const n = g.attributes.position.count; if (g.index) { const ia = g.index.array; for (let i = 0; i < ia.length; i++) idx.push(ia[i] + base); } else for (let i = 0; i < n; i++) idx.push(i + base);
    base += n; g.dispose(); });
  keys.forEach(k => out.setAttribute(k, new T.BufferAttribute(new Float32Array(arr[k]), k === 'uv' ? 2 : 3)));
  out.setIndex(idx); return out;
}

// ── 화질 (R10): 기기 단계 · 절차적 재질 · 굽힌 바닥 그림자 · 그린 하늘 ──────────────────
//   high(PC)  : 물리 재질(노멀맵) + HDR 환경광 + 내 주변 실시간 태양 그림자 + 블룸·비네트·MSAA + 총구 섬광 빛 · 연기
//   mid(태블릿): 물리 재질(노멀맵) + 그린 하늘 환경광 + 굽힌 그림자(바닥 · 병사 명암) — 그리기 호출은 low 와 거의 같음
//   low(저사양 · 소프트웨어 렌더러): 예전처럼 Lambert(꼭짓점 조명) — 새 무늬와 굽힌 그림자만 (실행 부담 그대로)
//   주소 ?q=high|mid|low 로 고정. 느리면 단계별로 내림: 그림자 → 후처리 → (mid 는 low 로) → 해상도. 다시 올리지 않음
const F3_SUN = (() => { const v = [0.55, 0.75, -0.37], l = Math.hypot(v[0], v[1], v[2]); return v.map(k => k / l); })();   // 해 방향 (x · 위 · z=지도 y): 하늘의 해 · 그림자 · 굽힌 그림자가 모두 같은 쪽
const F3_HDR = { plaza: 'quarry_01_1k', desert: 'blouberg_sunrise_2_1k', arctic: 'quarry_01_1k', jungle: 'spruit_sunrise_1k' };   // high 에서만 내려받는 환경광 (밤 맵은 그린 하늘)
function f3PickTier(renderer, opts) {
  const m = typeof location !== 'undefined' && /[?&]q=(high|mid|low)\b/.exec(location.search); if (m) return { t: m[1], locked: true };
  if (opts && /^(high|mid|low)$/.test(opts.quality || '')) return { t: opts.quality, locked: true };
  let gpu = ''; try { const gl = renderer.getContext(), e = gl.getExtension('WEBGL_debug_renderer_info'); gpu = e ? String(gl.getParameter(e.UNMASKED_RENDERER_WEBGL)) : ''; } catch (e) {}
  if (/swiftshader|llvmpipe|software|basic render/i.test(gpu)) return { t: 'low' };
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches, cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
  if (coarse) return { t: (cores < 4 || mem < 3 || /mali-[4t]|adreno \(tm\) [2-5]\d\d|powervr sgx|videocore/i.test(gpu)) ? 'low' : 'mid' };
  if (/intel.*hd graphics( [2-5]\d{2,3})?$|intel.*gma|mali|adreno|powervr/i.test(gpu)) return { t: 'mid' };
  return { t: 'high' };
}
function f3Rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function f3StrHash(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
function f3Cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; }
function f3Shade(hex, k) { const c = new THREE.Color(hex); if (k > 0) c.lerp(new THREE.Color(1, 1, 1), k); else c.multiplyScalar(1 + k); return '#' + c.getHexString(); }
// 높이 캔버스 → 노멀맵 (탄젠트 공간 · 초록 = 위). 가장자리는 반대편과 이어서 계산 (반복해도 이음매 없음)
function f3NormalCv(hc, str) {
  const W = hc.width, H = hc.height, src = hc.getContext('2d').getImageData(0, 0, W, H).data, out = f3Cv(W, H), og = out.getContext('2d'), img = og.createImageData(W, H), d = img.data;
  const at = (x, y) => src[(((y + H) % H) * W + ((x + W) % W)) * 4] / 255;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let nx = (at(x - 1, y) - at(x + 1, y)) * str, ny = (at(x, y + 1) - at(x, y - 1)) * str; const l = Math.hypot(nx, ny, 1), i = (y * W + x) * 4;
    d[i] = (nx / l * 0.5 + 0.5) * 255; d[i + 1] = (ny / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255; }
  og.putImageData(img, 0, 0); return out;
}
// 절차적 표면 무늬 — 색(g)과 높이(k: 회색 128 기준, 밝을수록 튀어나옴)를 같이 그림. 기기마다 같은 무늬(시드 난수)
//   kind: floor(테마별) · '#' 콘크리트 패널 · 'H' 높은 건물 · '=' 금속 골판 + 경고 줄무늬 · 'B' 벽돌 · 'X' 군용 상자 · 'L' 방호벽(가로 2m × 0.6m)
function f3Surface(kind, th, themeKey, S) {
  const W = S, H = kind === 'L' ? S / 2 : S, c = f3Cv(W, H), hc = f3Cv(W, H), g = c.getContext('2d'), k = hc.getContext('2d'), R = f3Rng(f3StrHash(kind + '|' + themeKey));
  k.fillStyle = '#808080'; k.fillRect(0, 0, W, H);
  const wc = th.walls || {}, fl = th.floor || ['#C9BFA6'];
  const wrap9 = fn => { for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) fn(ox, oy); };
  // 부드러운 얼룩 (가장자리를 넘으면 반대편에도)
  const blot = (ctx, n, r0, r1, rgb, a0, a1, squash) => { for (let i = 0; i < n; i++) { const x = R() * W, y = R() * H, r = r0 + R() * (r1 - r0), a = a0 + R() * (a1 - a0);
    wrap9((ox, oy) => { if (x + ox + r < 0 || x + ox - r > W || y + oy + r < 0 || y + oy - r > H) return; const gr = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); gr.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + rgb + ',0)'); ctx.fillStyle = gr;
      ctx.save(); ctx.translate(x + ox, y + oy); ctx.scale(1, squash || 1); ctx.translate(-x - ox, -y - oy); ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2); ctx.restore(); }); } };
  const speck = (ctx, n, s0, s1, cols) => { for (let i = 0; i < n; i++) { const s = s0 + R() * (s1 - s0); ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(R() * W, R() * H, s, s); } };
  const grime = (h0, a, rgb) => { const gr = g.createLinearGradient(0, H, 0, H * (1 - h0)); gr.addColorStop(0, 'rgba(' + (rgb || '45,36,26') + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + (rgb || '45,36,26') + ',0)'); g.fillStyle = gr; g.fillRect(0, H * (1 - h0), W, H * h0); };
  const streaks = (n, a) => { for (let i = 0; i < n; i++) { const x = R() * W, y0 = R() * H * 0.25, len = H * (0.15 + R() * 0.5), w = 1 + R() * 2.5, gr = g.createLinearGradient(0, y0, 0, y0 + len); gr.addColorStop(0, 'rgba(30,26,22,' + (a * (0.5 + R())) + ')'); gr.addColorStop(1, 'rgba(30,26,22,0)'); g.fillStyle = gr; g.fillRect(x, y0, w, len); } };
  const crack = (n, a) => { for (let i = 0; i < n; i++) { let x = R() * W, y = R() * H, ang = R() * 6.28; g.strokeStyle = 'rgba(20,18,16,' + a + ')'; k.strokeStyle = '#4a4a4a'; g.lineWidth = 1; k.lineWidth = 1.5; g.beginPath(); k.beginPath(); g.moveTo(x, y); k.moveTo(x, y);
    for (let s = 0; s < 9; s++) { ang += (R() - 0.5) * 1.2; x += Math.cos(ang) * W * 0.03; y += Math.sin(ang) * W * 0.03; g.lineTo(x, y); k.lineTo(x, y); } g.stroke(); k.stroke(); } };
  const line = (x, y, w, h, dark, hgt) => { g.fillStyle = 'rgba(0,0,0,' + dark + ')'; g.fillRect(x, y, w, h); k.fillStyle = hgt; k.fillRect(x, y, w, h); };
  const bevelRect = (x, y, w, h, b, hi, lo) => { for (let i = 0; i < b; i++) { const t = i / b, v = Math.round(lo + (hi - lo) * t); k.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; k.fillRect(x + i, y + i, w - i * 2, h - i * 2); } };
  if (kind === 'floor') {
    g.fillStyle = fl[0]; g.fillRect(0, 0, W, H);
    if (themeKey === 'desert') {
      blot(g, 30, W * 0.08, W * 0.3, '120,80,40', 0.03, 0.08); blot(g, 20, W * 0.06, W * 0.2, '255,240,210', 0.03, 0.08);
      for (let i = 0; i < 9; i++) { const y0 = R() * H, amp = 4 + R() * 6, ph = R() * 6; g.strokeStyle = 'rgba(255,245,220,0.12)'; k.strokeStyle = '#a0a0a0'; g.lineWidth = 3; k.lineWidth = 5; g.beginPath(); k.beginPath();
        for (let x = -4; x <= W + 4; x += 8) { const y = y0 + Math.sin(x / W * Math.PI * 4 + ph) * amp; if (x < 0) { g.moveTo(x, y); k.moveTo(x, y); } else { g.lineTo(x, y); k.lineTo(x, y); } } g.stroke(); k.stroke(); }
      speck(g, 1800, 1, 2.5, ['rgba(90,60,30,0.18)', 'rgba(255,240,210,0.15)']); for (let i = 0; i < 90; i++) { const x = R() * W, y = R() * H, r = 1 + R() * 2.5; g.fillStyle = 'rgba(110,80,50,0.45)'; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); k.fillStyle = '#c8c8c8'; k.beginPath(); k.arc(x, y, r, 0, 6.3); k.fill(); }
    } else if (themeKey === 'arctic') {
      blot(g, 26, W * 0.1, W * 0.35, '150,175,210', 0.05, 0.14); blot(g, 18, W * 0.06, W * 0.2, '255,255,255', 0.2, 0.4); blot(k, 26, W * 0.1, W * 0.3, '200,200,200', 0.2, 0.4); blot(k, 20, W * 0.08, W * 0.25, '60,60,60', 0.15, 0.3);
      speck(g, 700, 1, 1.6, ['rgba(255,255,255,0.9)', 'rgba(170,195,230,0.35)']);
    } else if (themeKey === 'jungle') {
      blot(g, 16, W * 0.08, W * 0.22, '95,70,40', 0.35, 0.6); blot(g, 20, W * 0.08, W * 0.25, '40,70,25', 0.15, 0.3);
      for (let i = 0; i < 2600; i++) { const x = R() * W, y = R() * H, l = 3 + R() * 6, a = -1.2 - R() * 0.7; g.strokeStyle = ['rgba(120,170,70,0.5)', 'rgba(60,110,40,0.5)', 'rgba(150,180,90,0.35)', 'rgba(40,70,30,0.45)'][i & 3]; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l * 0.4, y + Math.sin(a) * l); g.stroke(); }
      speck(k, 2400, 1, 2, ['#9a9a9a', '#6a6a6a']); for (let i = 0; i < 40; i++) { g.fillStyle = ['rgba(170,150,60,0.6)', 'rgba(120,90,40,0.6)'][i & 1]; g.beginPath(); g.ellipse(R() * W, R() * H, 3 + R() * 3, 1.5 + R(), R() * 3, 0, 6.3); g.fill(); }
    } else if (themeKey === 'city') {
      blot(g, 24, W * 0.08, W * 0.3, '0,0,0', 0.05, 0.14); blot(g, 10, W * 0.06, W * 0.18, '30,25,40', 0.12, 0.25);
      speck(g, 5000, 1, 2.2, ['rgba(255,255,255,0.10)', 'rgba(0,0,0,0.25)', 'rgba(180,180,200,0.12)']); speck(k, 4000, 1, 2, ['#9c9c9c', '#666666']); crack(5, 0.5);
    } else {   // 광장 · 창고: 콘크리트 판 (1m 판 · 줄눈) · 얼룩 · 금
      const dark = themeKey === 'warehouse';
      blot(g, 30, W * 0.06, W * 0.3, '0,0,0', 0.02, dark ? 0.1 : 0.07); blot(g, 22, W * 0.05, W * 0.22, '255,255,255', 0.02, dark ? 0.05 : 0.08); blot(g, dark ? 8 : 5, W * 0.04, W * 0.12, '40,30,20', 0.12, 0.25);
      speck(g, 3200, 1, 2, ['rgba(0,0,0,0.10)', 'rgba(255,255,255,0.09)', 'rgba(60,50,40,0.08)']); speck(k, 2400, 1, 2, ['#8a8a8a', '#767676']);
      [0, W / 2].forEach(p => { line(p - 1.5, 0, 3, H, 0.32, '#3a3a3a'); line(0, p - 1.5, W, 3, 0.32, '#3a3a3a'); g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(p + 1.5, 0, 1, H); g.fillRect(0, p + 1.5, W, 1); });
      line(W - 1.5, 0, 1.5, H, 0.32, '#3a3a3a'); line(0, H - 1.5, W, 1.5, 0.32, '#3a3a3a');
      crack(2, 0.28); if (dark) { g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(R() * W, R() * H, 10 + R() * 30, R() * 6, R() * 6 + 1.5); g.stroke(); } }
    }
  } else if (kind === '#' || kind === 'H') {
    g.fillStyle = kind === 'H' ? f3Shade(wc['#'] || '#B9BFC9', -0.07) : (wc['#'] || '#B9BFC9'); g.fillRect(0, 0, W, H);
    blot(g, 28, W * 0.06, W * 0.28, '0,0,0', 0.02, 0.08); blot(g, 18, W * 0.05, W * 0.22, '255,255,255', 0.02, 0.07);
    speck(g, 2600, 1, 2, ['rgba(0,0,0,0.10)', 'rgba(255,255,255,0.08)', 'rgba(0,0,0,0.05)']); speck(k, 2200, 1, 2, ['#8c8c8c', '#727272']);
    line(0, 0, 3, H, 0.3, '#303030'); g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(3, 0, 1, H);                              // 2m 마다 패널 세로 줄눈
    (kind === 'H' ? [0.25, 0.5, 0.75] : [0.42]).forEach(t => { line(0, H * t - 1, W, 2.5, 0.26, '#3a3a3a'); g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(0, H * t + 1.5, W, 1); });   // 거푸집 가로 줄
    [0.25, 0.75].forEach(tx => (kind === 'H' ? [0.12, 0.37, 0.62, 0.87] : [0.2, 0.62, 0.9]).forEach(ty => { const x = W * tx, y = H * ty, r = W * 0.013; g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.arc(x + 0.8, y + 0.8, r * 0.6, 0, 6.3); g.fill(); k.fillStyle = '#202020'; k.beginPath(); k.arc(x, y, r, 0, 6.3); k.fill(); }));   // 거푸집 구멍
    if (kind === 'H') { const x0 = W * 0.38, y0 = H * 0.06, w = W * 0.24, h = H * 0.1; g.fillStyle = 'rgba(40,44,52,0.85)'; g.fillRect(x0, y0, w, h); bevelRect(x0 - 3, y0 - 3, w + 6, h + 6, 3, 170, 128); k.fillStyle = '#404040'; k.fillRect(x0, y0, w, h);
      for (let i = 1; i < 6; i++) { g.fillStyle = 'rgba(160,168,180,0.7)'; g.fillRect(x0 + 2, y0 + h * i / 6 - 1, w - 4, 2); k.fillStyle = '#b0b0b0'; k.fillRect(x0 + 2, y0 + h * i / 6 - 1, w - 4, 2); } }   // 환풍구
    streaks(kind === 'H' ? 34 : 24, 0.08); grime(0.28, 0.4); blot(g, 6, W * 0.04, W * 0.1, '60,70,40', 0.08, 0.18, 0.5);
  } else if (kind === '=') {
    g.fillStyle = wc['='] || '#8F98A8'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 8; i++) { const x = i * W / 8, gr = g.createLinearGradient(x, 0, x + W / 8, 0), gk = k.createLinearGradient(x, 0, x + W / 8, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0.14)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.16)'); gr.addColorStop(1, 'rgba(255,255,255,0.14)'); g.fillStyle = gr; g.fillRect(x, 0, W / 8, H);
      gk.addColorStop(0, '#b4b4b4'); gk.addColorStop(0.5, '#4c4c4c'); gk.addColorStop(1, '#b4b4b4'); k.fillStyle = gk; k.fillRect(x, 0, W / 8, H); }   // 골판
    blot(g, 20, W * 0.05, W * 0.25, '0,0,0', 0.03, 0.09); speck(g, 1400, 1, 2, ['rgba(255,255,255,0.08)', 'rgba(0,0,0,0.10)']);
    for (let i = 0; i < 70; i++) { const x = R() * W, y = R() * H * 0.85, l = 4 + R() * 14, a = R() * 6.3; g.strokeStyle = 'rgba(255,255,255,' + (0.1 + R() * 0.15) + ')'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }   // 긁힘
    [0, H * 0.5].forEach(y => { line(0, y - 1.5, W, 3, 0.35, '#2a2a2a'); for (let x = W / 32; x < W; x += W / 16) [y - 6, y + 6].forEach(yy => { if (yy < 0) return; g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(x + 0.6, yy + 0.6, 2.4, 0, 6.3); g.fill(); g.fillStyle = 'rgba(230,236,245,0.55)'; g.beginPath(); g.arc(x, yy, 2, 0, 6.3); g.fill(); k.fillStyle = '#e0e0e0'; k.beginPath(); k.arc(x, yy, 2.2, 0, 6.3); k.fill(); }); });   // 이음매 · 리벳
    blot(g, 10, W * 0.03, W * 0.1, '120,60,25', 0.15, 0.35, 0.6); grime(0.3, 0.38, '60,40,25');
    const y0 = H * 0.855, y1 = H * 0.975; g.save(); g.beginPath(); g.rect(0, y0, W, y1 - y0); g.clip(); g.fillStyle = '#E8B21E'; g.fillRect(0, y0, W, y1 - y0); g.fillStyle = '#1E2026';
    for (let x = -W / 8; x < W + W / 8; x += W / 8) { g.beginPath(); g.moveTo(x, y1); g.lineTo(x + W / 16, y1); g.lineTo(x + W / 16 + (y1 - y0), y0); g.lineTo(x + (y1 - y0), y0); g.closePath(); g.fill(); }
    speck(g, 260, 1, 3, ['rgba(70,60,50,0.5)', 'rgba(255,255,255,0.25)']); g.restore(); line(0, y0 - 1, W, 2, 0.3, '#909090'); line(0, y1, W, 2, 0.3, '#909090');   // 경고 줄무늬 띠
  } else if (kind === 'B') {
    g.fillStyle = '#8E877A'; g.fillRect(0, 0, W, H); k.fillStyle = '#4a4a4a'; k.fillRect(0, 0, W, H); speck(g, 1500, 1, 2, ['rgba(0,0,0,0.15)', 'rgba(255,255,255,0.1)']);
    const rows = 16, rh = H / rows, bw = W / 4, base = new THREE.Color(wc.B || '#9A5A50');
    for (let r = 0; r < rows; r++) for (let b = -1; b < 5; b++) { const x = b * bw + (r % 2) * bw / 2, y = r * rh, cc = base.clone().multiplyScalar(0.82 + R() * 0.32); if (R() < 0.12) cc.multiplyScalar(0.7);
      g.fillStyle = '#' + cc.getHexString(); g.fillRect(x + 2, y + 2, bw - 3, rh - 3); bevelRect(x + 2, y + 2, bw - 3, rh - 3, 2, 175, 120);
      for (let s = 0; s < 14; s++) { g.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,230,210,0.10)'; g.fillRect(x + 2 + R() * (bw - 5), y + 2 + R() * (rh - 5), 2, 2); } }
    blot(g, 8, W * 0.05, W * 0.12, '235,235,225', 0.08, 0.2); streaks(16, 0.07); grime(0.3, 0.42);
  } else if (kind === 'X') {
    const base = new THREE.Color(wc.X || '#B98A55'); g.fillStyle = '#' + base.getHexString(); g.fillRect(0, 0, W, H);
    for (let p = 0; p < 4; p++) { const y = p * H / 4, cc = base.clone().multiplyScalar(0.86 + R() * 0.24); g.fillStyle = '#' + cc.getHexString(); g.fillRect(0, y, W, H / 4);
      for (let l = 0; l < 12; l++) { const yy = y + R() * H / 4, ph = R() * 6, amp = 1 + R() * 2; g.strokeStyle = 'rgba(70,40,15,' + (0.1 + R() * 0.15) + ')'; g.lineWidth = 0.8 + R(); g.beginPath(); for (let x = 0; x <= W; x += 8) { const v = yy + Math.sin(x * 0.03 + ph) * amp; if (x) g.lineTo(x, v); else g.moveTo(x, v); } g.stroke(); }
      line(0, y - 1.5, W, 3, 0.45, '#2a2a2a'); }   // 널빤지 · 나뭇결 · 틈
    const b = W * 0.1; g.fillStyle = 'rgba(60,35,15,0.28)'; g.fillRect(0, 0, W, b); g.fillRect(0, H - b, W, b); g.fillRect(0, 0, b, H); g.fillRect(W - b, 0, b, H);
    k.fillStyle = '#a8a8a8'; k.fillRect(0, 0, W, b); k.fillRect(0, H - b, W, b); k.fillRect(0, 0, b, H); k.fillRect(W - b, 0, b, H); bevelRect(0, 0, W, H, 5, 168, 70);   // 테두리 틀 (모서리 깎임)
    g.strokeStyle = 'rgba(60,35,15,0.3)'; g.lineWidth = b * 0.7; g.beginPath(); g.moveTo(b, b); g.lineTo(W - b, H - b); g.stroke(); k.strokeStyle = '#a0a0a0'; k.lineWidth = b * 0.7; k.beginPath(); k.moveTo(b, b); k.lineTo(W - b, H - b); k.stroke();   // 대각 버팀목
    const cs = W * 0.17; [[0, 0, 1, 1], [W, 0, -1, 1], [0, H, 1, -1], [W, H, -1, -1]].forEach(([x, y, sx, sy]) => { g.fillStyle = '#3C4046'; k.fillStyle = '#d8d8d8'; [g, k].forEach(cx => { cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x + sx * cs, y); cx.lineTo(x + sx * cs, y + sy * cs * 0.35); cx.lineTo(x + sx * cs * 0.35, y + sy * cs * 0.35); cx.lineTo(x + sx * cs * 0.35, y + sy * cs); cx.lineTo(x, y + sy * cs); cx.closePath(); cx.fill(); });
      [[0.18, 0.18], [0.7, 0.18], [0.18, 0.7]].forEach(([a, bb]) => { g.fillStyle = 'rgba(200,205,210,0.8)'; g.beginPath(); g.arc(x + sx * cs * a, y + sy * cs * bb, 2.2, 0, 6.3); g.fill(); }); });   // 금속 모서리 · 리벳
    g.font = '900 ' + Math.round(W * 0.12) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(25,25,20,0.55)'; g.fillText('LT-07', W / 2, H * 0.47); g.font = '800 ' + Math.round(W * 0.06) + 'px sans-serif'; g.fillText('▲ ▲  2026', W / 2, H * 0.6);
    speck(g, 500, 1, 2.5, ['rgba(255,240,220,0.18)', 'rgba(40,25,10,0.15)']);
  } else if (kind === 'L') {
    g.fillStyle = f3Shade(wc['#'] || '#B9BFC9', 0.12); g.fillRect(0, 0, W, H); blot(g, 16, W * 0.04, W * 0.14, '0,0,0', 0.03, 0.08); speck(g, 1400, 1, 2, ['rgba(0,0,0,0.1)', 'rgba(255,255,255,0.08)']); speck(k, 900, 1, 2, ['#8a8a8a', '#747474']);
    const y0 = H * 0.3, y1 = H * 0.62; g.save(); g.beginPath(); g.rect(0, y0, W, y1 - y0); g.clip(); g.fillStyle = '#F2F2EE'; g.fillRect(0, y0, W, y1 - y0); g.fillStyle = '#D9363E';
    for (let x = -W / 4; x < W + W / 4; x += W / 4) { g.beginPath(); g.moveTo(x, y1); g.lineTo(x + W / 8, y1); g.lineTo(x + W / 8 + (y1 - y0), y0); g.lineTo(x + (y1 - y0), y0); g.closePath(); g.fill(); }
    speck(g, 220, 1, 3, ['rgba(60,50,40,0.45)']); g.restore();
    const gk = k.createLinearGradient(0, H * 0.72, 0, H); gk.addColorStop(0, '#808080'); gk.addColorStop(1, '#303030'); k.fillStyle = gk; k.fillRect(0, H * 0.72, W, H * 0.28);   // 아래로 넓어지는 방호벽 모양
    line(0, 0, 3, H, 0.35, '#202020'); for (let i = 0; i < 10; i++) { const x = R() * W, w = 3 + R() * 8; g.fillStyle = 'rgba(80,80,80,0.5)'; g.fillRect(x, 0, w, 2 + R() * 3); k.fillStyle = '#404040'; k.fillRect(x, 0, w, 3); }   // 이음매 · 윗모서리 깨짐
    grime(0.35, 0.45);
  }
  return { c, h: hc };
}
// 바닥 굽기: 벽 주변 어둠(AO) + 해 그림자(지도 칸 높이로 해 쪽을 따라가 막히면 그림자) + 넓은 얼룩(타일 반복 감추기)
//   bake: AO × 해 그림자 (모든 단계 — high 의 실시간 그림자는 병사·소품만) · lit[]: 칸 안 밝기(병사 명암에 씀). 맵마다 한 번 (캐시)
function f3BakeFloor(rows, night) {
  const N = rows.length, s = N > 60 ? 4 : 6, W = N * s, occ = new Float32Array(W * W), lit = new Float32Array(W * W).fill(1), mac = new Float32Array(W * W);
  const hAt = (x, y) => { const cx = Math.floor(x), cy = Math.floor(y), r = rows[cy], c = r && r[cx]; if (!c || c === '.') return 0; const bh = F3_BOXH[c]; if (bh) return bh;
    const d = Math.hypot(x - cx - 0.5, y - cy - 0.5); return c === 'P' ? (d < 0.33 ? 2.4 : d < 0.48 ? 0.2 : 0) : c === 'T' ? (d < 0.16 ? 1.2 : d < 0.8 ? 2.9 - d * 1.2 : 0) : c === 'R' ? (d < 0.52 ? 0.68 : 0) : 0; };
  const tanE = F3_SUN[1] / Math.hypot(F3_SUN[0], F3_SUN[2]), sx = F3_SUN[0] / Math.hypot(F3_SUN[0], F3_SUN[2]), sy = F3_SUN[2] / Math.hypot(F3_SUN[0], F3_SUN[2]), maxD = 4.2 / tanE, st = 1 / s;
  const R = f3Rng(N * 7 + 3), G = 9, gv = []; for (let i = 0; i < G * G; i++) gv.push(R());
  const vn = (u, v) => { const x = u * (G - 1), y = v * (G - 1), x0 = Math.min(G - 2, Math.floor(x)), y0 = Math.min(G - 2, Math.floor(y)), fx = x - x0, fy = y - y0, ax = fx * fx * (3 - 2 * fx), ay = fy * fy * (3 - 2 * fy);
    return (gv[y0 * G + x0] * (1 - ax) + gv[y0 * G + x0 + 1] * ax) * (1 - ay) + (gv[(y0 + 1) * G + x0] * (1 - ax) + gv[(y0 + 1) * G + x0 + 1] * ax) * ay; };
  for (let py = 0; py < W; py++) for (let px = 0; px < W; px++) {
    const i = py * W + px, x = (px + 0.5) / s, y = (py + 0.5) / s, h0 = hAt(x, y);
    occ[i] = Math.min(1, h0 / 1.6); mac[i] = 0.93 + 0.12 * vn(x / N, y / N) + 0.04 * vn((x * 3.7 % N) / N, (y * 3.7 % N) / N);
    if (h0 > 0.05) continue;
    for (let d = st; d < maxD; d += st * 1.5) if (hAt(x + sx * d, y + sy * d) > d * tanE) { lit[i] = 0; break; }
  }
  const blur = (a, r) => { const t = new Float32Array(W * W), k = 1 / (r * 2 + 1);
    for (let y = 0; y < W; y++) { let acc = 0; for (let x = -r; x <= r; x++) acc += a[y * W + Math.max(0, Math.min(W - 1, x))]; for (let x = 0; x < W; x++) { t[y * W + x] = acc * k; acc += a[y * W + Math.min(W - 1, x + r + 1)] - a[y * W + Math.max(0, x - r)]; } }
    for (let x = 0; x < W; x++) { let acc = 0; for (let y = -r; y <= r; y++) acc += t[Math.max(0, Math.min(W - 1, y)) * W + x]; for (let y = 0; y < W; y++) { a[y * W + x] = acc * k; acc += t[Math.min(W - 1, y + r + 1) * W + x] - t[Math.max(0, y - r) * W + x]; } } };
  blur(occ, Math.round(s * 0.45)); blur(occ, Math.round(s * 0.3)); blur(lit, Math.max(1, Math.round(s * 0.25))); blur(lit, 1);   // 그림자 가장자리 부드럽게
  const bkC = f3Cv(W), a2 = bkC.getContext('2d').createImageData(W, W), sd = night ? 0.72 : 0.5;
  for (let i = 0; i < W * W; i++) { const ao = Math.max(0.35, 1 - occ[i] * 0.62) * mac[i], b = ao * (sd + (1 - sd) * lit[i]), j = i * 4;
    a2.data[j] = a2.data[j + 1] = a2.data[j + 2] = Math.min(255, b * 235); a2.data[j + 3] = 255; }
  bkC.getContext('2d').putImageData(a2, 0, 0);
  return { bake: bkC, lit, s, W, sd };
}
// 하늘 (등장방형 그림): 테마 색 그라데이션 + 해 · 해무리 + 구름 (밤: 달 — 별은 하늘 셰이더가 화면 해상도로 찍음). 지평선 띠는 안개 색과 같게 → 먼 곳이 하늘로 자연스럽게 녹음
function f3SkyCanvas(th, W) {
  const H = W / 2, c = f3Cv(W, H), g = c.getContext('2d'), sk = th.sky || ['#5FA8FF', '#A9D3FF', '#E8F3FF'], fog = '#' + new THREE.Color(th.fog[0]).getHexString(), R = f3Rng(f3StrHash(sk.join('')));
  const yOf = e => (0.5 - e / Math.PI) * H;   // 고도(라디안) → 세로 위치
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, sk[0]); gr.addColorStop(0.5 - 0.35 / Math.PI, sk[1]); gr.addColorStop(0.5 - 0.08 / Math.PI, sk[2]); gr.addColorStop(0.5, fog); gr.addColorStop(0.56, fog);
  gr.addColorStop(1, '#' + new THREE.Color(th.ground || 0x888888).multiplyScalar(th.night ? 0.25 : 0.6).getHexString()); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const su = Math.atan2(F3_SUN[2], F3_SUN[0]) / (Math.PI * 2) + 0.5, sv = Math.asin(F3_SUN[1]), sxp = su * W, syp = yOf(sv);
  const glow = (x, y, r, col, a) => { for (const ox of [-W, 0, W]) { const q = g.createRadialGradient(x + ox, y, 0, x + ox, y, r); q.addColorStop(0, 'rgba(' + col + ',' + a + ')'); q.addColorStop(1, 'rgba(' + col + ',0)'); g.fillStyle = q; g.fillRect(x + ox - r, y - r, r * 2, r * 2); } };
  if (th.night) {
    glow(sxp, syp, W * 0.05, '200,210,255', 0.35); g.fillStyle = '#EEF0FF'; g.beginPath(); g.arc(sxp, syp, W * 0.006, 0, 6.3); g.fill();
    glow(W * 0.3, yOf(0.02), W * 0.25, '255,120,200', th.decor === 'neon' ? 0.12 : 0.04); glow(W * 0.8, yOf(0.02), W * 0.2, '120,160,255', 0.08);   // 도시 불빛 노을
  } else {
    glow(sxp, syp, W * 0.16, '255,244,220', 0.35); glow(sxp, syp, W * 0.045, '255,250,235', 0.75); g.fillStyle = '#FFFDF4'; g.beginPath(); g.arc(sxp, syp, W * 0.007, 0, 6.3); g.fill();
    const cl = th.decor === 'cactus' ? 14 : th.decor === 'snow' ? 34 : 26;
    for (let i = 0; i < cl; i++) { const x = R() * W, e = 0.05 + Math.pow(R(), 1.6) * 0.65, y = yOf(e), sc = 1 - e * 0.6, rw = W * (0.02 + R() * 0.035) * sc, n = 5 + Math.floor(R() * 6);
      for (let j = 0; j < n; j++) { const bx = x + (R() - 0.5) * rw * 3, by = y + (R() - 0.5) * rw * 0.35, br = rw * (0.5 + R() * 0.6);
        for (const ox of [-W, 0, W]) { const q = g.createRadialGradient(bx + ox, by - br * 0.15, 0, bx + ox, by, br); q.addColorStop(0, 'rgba(255,255,255,0.85)'); q.addColorStop(0.6, 'rgba(244,247,252,0.55)'); q.addColorStop(1, 'rgba(225,232,245,0)');
          g.fillStyle = q; g.save(); g.translate(bx + ox, by); g.scale(1, 0.42 + e * 0.4); g.beginPath(); g.arc(0, 0, br, 0, 6.3); g.fill(); g.restore(); } } }
  }
  const hz = g.createLinearGradient(0, yOf(0.12), 0, yOf(-0.02)); hz.addColorStop(0, 'rgba(255,255,255,0)'); hz.addColorStop(1, fog); g.fillStyle = hz; g.fillRect(0, yOf(0.12), W, yOf(-0.02) - yOf(0.12));   // 지평선 안개
  return c;
}

// ── 병사 모델 (군인) ──────────────────────────────────────────────
// 판정 상자(F3_PARTS)에 맞춰 그린 사람 비율의 군인: 머리 1.39~1.71 · 몸통 0.7~1.325 · 다리 0~0.7 (몸 기준: x 오른쪽, y 위, z 앞이 -)
// 부위마다 InstancedMesh 하나 (모든 병사가 같이 씀) — 인원과 상관없이 그리기 호출 약 10번. 재질은 한 개(셰이더 한 벌):
//   꼭짓점마다 sfx = (팀색 섞기 — 1 밝은 팀색 · 2 진한 팀색(조끼), 빛남, 위장 무늬) · 병사마다 instanceColor = 팀(개인전은 학생별) 색 · iMul = 피격 번쩍임/무적 색
const F3_FFA_COLS = [0xFFD166, 0x06D6A0, 0xFF8C42, 0xC77DFF, 0x4CC9F0, 0xF15BB5, 0xB8F35D, 0xF4F4F4, 0xFFB4A2, 0x80FFDB];
function f3PlayerCol(id) { let h = 7; for (const c of String(id)) h = (h * 131 + c.charCodeAt(0)) >>> 0; return F3_FFA_COLS[h % F3_FFA_COLS.length]; }
const F3_SK = { hipX: 0.1, hipY: 0.76, thigh: 0.37, shin: 0.41, shX: 0.2, shY: 1.29, uarm: 0.28, farm: 0.3, waist: 0.9,
  butt: [0.13, 1.285, -0.125],                          // 개머리판이 닿는 오른쪽 어깨 앞
  grip: { r: [[0, -0.05, -0.2], [0, -0.035, -0.38]], s: [[0, -0.05, -0.24], [0, -0.035, -0.42]] },   // [오른손 손잡이, 왼손 덮개]
  muzzle: { r: -0.86, s: -1.29 } };
// 두 마디 팔다리: 어깨(엉덩이) s → 손(발) h, 마디 길이 L1·L2, 팔꿈치(무릎)가 향할 쪽 p → out = [팔꿈치 xyz, 손끝 xyz]
function f3IK(s, h, L1, L2, p, out) {
  let dx = h[0] - s[0], dy = h[1] - s[1], dz = h[2] - s[2]; const d0 = Math.hypot(dx, dy, dz) || 1e-6; dx /= d0; dy /= d0; dz /= d0;
  const d = Math.min(L1 + L2 - 1e-3, Math.max(Math.abs(L1 - L2) + 1e-3, d0)), a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const pd = p[0] * dx + p[1] * dy + p[2] * dz; let qx = p[0] - dx * pd, qy = p[1] - dy * pd, qz = p[2] - dz * pd; const ql = Math.hypot(qx, qy, qz) || 1;
  out[0] = s[0] + dx * a + qx / ql * hh; out[1] = s[1] + dy * a + qy / ql * hh; out[2] = s[2] + dz * a + qz / ql * hh;
  out[3] = s[0] + dx * d; out[4] = s[1] + dy * d; out[5] = s[2] + dz * d; return out;
}
// 마디 행렬: a 에서 시작해 b 쪽으로 (도형은 -y 방향으로 만들어 둠)
function f3SegM(out, ax, ay, az, bx, by, bz, S) {
  let dx = bx - ax, dy = by - ay, dz = bz - az; const l = Math.hypot(dx, dy, dz) || 1;
  S.q.setFromUnitVectors(S.down, S.v.set(dx / l, dy / l, dz / l)); return out.compose(S.v.set(ax, ay, az), S.q, S.one);
}
// 위장 무늬 (우드랜드) — 이어 붙여도 이음매가 없게 가장자리를 넘는 얼룩은 반대편에도 그림
function f3CamoCanvas() {
  const S = 128, cv = document.createElement('canvas'); cv.width = S; cv.height = S; const g = cv.getContext('2d');
  g.fillStyle = '#6F7148'; g.fillRect(0, 0, S, S);
  const blob = (col, n, r0, r1) => { g.fillStyle = col; for (let i = 0; i < n; i++) { const x = Math.random() * S, y = Math.random() * S, rx = r0 + Math.random() * (r1 - r0), ry = rx * (0.45 + Math.random() * 0.5), a = Math.random() * Math.PI;
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { g.beginPath(); g.ellipse(x + ox, y + oy, rx, ry, a, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(x + ox + rx * 0.6, y + oy + ry * 0.4, rx * 0.6, ry * 0.7, a + 0.8, 0, Math.PI * 2); g.fill(); } } };
  blob('#8E7E55', 7, 9, 16); blob('#454A2C', 8, 8, 15); blob('#2E3222', 9, 4, 8); blob('#A39A6C', 5, 3, 6);
  for (let i = 0; i < 400; i++) { g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '0,0,0' : '255,255,230') + ',0.06)'; g.fillRect(Math.random() * S, Math.random() * S, 2, 2); }
  return cv;
}
// 병사 재질: Lambert + (팀색 섞기 · 빛남 · 위장 무늬) — onBeforeCompile 로 꼭짓점 색 계산만 바꿈
function f3SoldierMat(tex, lit) {
  const T = THREE, m = lit ? new T.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 0.82, metalness: 0, envMapIntensity: 0.8 }) : new T.MeshLambertMaterial({ map: tex, vertexColors: true });   // mid·high: 물리 재질 (환경광 · 그림자와 어울리게)
  m.onBeforeCompile = sh => {
    sh.vertexShader = 'attribute vec3 sfx;\nattribute vec3 iMul;\nvarying vec3 vSfx;\n' + sh.vertexShader.replace('#include <color_vertex>',
      'vec3 tc = sfx.x > 1.5 ? instanceColor.xyz * instanceColor.xyz : instanceColor.xyz; vColor = color * mix(vec3(1.0), tc, min(sfx.x, 1.0)) * iMul; vSfx = sfx;');
    sh.fragmentShader = 'varying vec3 vSfx;\n' + sh.fragmentShader.replace('#include <map_fragment>',
      'vec4 texelColor = mapTexelToLinear(texture2D(map, vUv)); diffuseColor.rgb *= mix(vec3(1.0), texelColor.rgb, vSfx.z);')
      .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance += diffuseColor.rgb * vSfx.y;');
  };
  m.customProgramCacheKey = () => 'f3soldier' + (lit ? 'S' : 'L');
  return m;
}
// 부품을 칠하고(색 · sfx · 위장 무늬 UV) 목록에 넣는 도우미. o: { x,y,z, rx,ry,rz, s:[sx,sy,sz], t: 팀색(0~1), g: 빛남, c: 위장(0~1) }
function f3Put(list, geo, hex, o) {
  o = o || {}; const T = THREE;
  if (o.s) geo.scale(o.s[0], o.s[1], o.s[2]); if (o.rx) geo.rotateX(o.rx); if (o.ry) geo.rotateY(o.ry); if (o.rz) geo.rotateZ(o.rz); geo.translate(o.x || 0, o.y || 0, o.z || 0);
  const n = geo.attributes.position.count, col = new Float32Array(n * 3), sfx = new Float32Array(n * 3), c = new T.Color(hex), P = geo.attributes.position.array, N = geo.attributes.normal.array;
  const uv = geo.attributes.uv.array, K = 3.6;   // 위장 무늬: 0.28 칸마다 한 번 (얼룩 약 4~8cm)
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; sfx[i * 3] = o.t || 0; sfx[i * 3 + 1] = o.g || 0; sfx[i * 3 + 2] = o.c || 0;
    if (o.c) { const ax = Math.abs(N[i * 3]), ay = Math.abs(N[i * 3 + 1]), az = Math.abs(N[i * 3 + 2]), x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      if (ax >= ay && ax >= az) { uv[i * 2] = z * K; uv[i * 2 + 1] = y * K; } else if (ay >= az) { uv[i * 2] = x * K; uv[i * 2 + 1] = z * K; } else { uv[i * 2] = x * K + 0.37; uv[i * 2 + 1] = y * K; } } }
  geo.setAttribute('color', new T.BufferAttribute(col, 3)); geo.setAttribute('sfx', new T.BufferAttribute(sfx, 3));
  list.push(geo); return geo;
}
// 부위별 도형 (몸 기준 좌표). lo = 멀리 있는 병사 · 낮은 화질용 (장식 생략)
function f3SoldierGeos() {
  const T = THREE, B = (w, h, d) => new T.BoxGeometry(w, h, d), C = (rt, rb, h, n, open) => new T.CylinderGeometry(rt, rb, h, n || 8, 1, !!open), Pl = (w, h) => new T.PlaneGeometry(w, h), Sp = (r, w, h, t0, t1) => new T.SphereGeometry(r, w, h, 0, Math.PI * 2, t0 || 0, t1 || Math.PI);
  const SKIN = 0xC48F6A, BLK = 0x1E2023, DARK = 0x2C2F2A, OLIVE = 0x535839, TAN = 0x8A7A55, VEST = 0x6A6A6A, VEST2 = 0x555555, HAIR = 0x3B2A1E, GLOW = 0xFFFFFF, CAMO = 0xFFFFFF, PANTS = 0xE2E2D6, BRASS = 0xC9A247;
  const out = {};
  // 윗몸 (허리 위 — 조준 방향으로 살짝 기울어짐): 셔츠 · 조끼 · 탄띠 · 무전기 배낭 · 목 · 얼굴 · 고글 · 헬멧
  { const L = [];
    f3Put(L, B(0.34, 0.42, 0.19), CAMO, { y: 1.08, c: 1 });                                  // 가슴 (전투복)
    f3Put(L, B(0.3, 0.16, 0.18), CAMO, { y: 0.9, c: 1 });                                    // 배
    [-1, 1].forEach(s => f3Put(L, Sp(0.078, 6, 4), CAMO, { x: s * 0.195, y: 1.255, c: 1 })); // 어깨
    f3Put(L, B(0.35, 0.33, 0.05), VEST, { y: 1.1, z: -0.11, t: 2 });                         // 조끼 앞판 (진한 팀 색)
    f3Put(L, B(0.35, 0.33, 0.05), VEST, { y: 1.1, z: 0.11, t: 2 });                          // 조끼 뒤판
    f3Put(L, B(0.37, 0.15, 0.23), VEST2, { y: 0.99, t: 2 });                                 // 옆구리 띠
    [-1, 1].forEach(s => f3Put(L, B(0.08, 0.035, 0.27), VEST2, { x: s * 0.12, y: 1.285, t: 2 }));   // 어깨 끈
    [-0.095, 0, 0.095].forEach(x => { f3Put(L, B(0.08, 0.12, 0.05), OLIVE, { x, y: 0.99, z: -0.155 }); f3Put(L, Pl(0.08, 0.025), DARK, { x, y: 1.04, z: -0.181, ry: Math.PI }); });   // 탄창 주머니 (덮개 띠)
    f3Put(L, B(0.05, 0.5, 0.022), DARK, { y: 1.12, z: -0.142, rz: 0.72 });                   // 탄띠 (왼어깨 → 오른허리)
    for (let k = -2; k <= 2; k++) f3Put(L, Pl(0.022, 0.04), BRASS, { x: -k * 0.066, y: 1.12 + k * 0.075, z: -0.154, ry: Math.PI, rz: -0.72 });   // 탄띠 총알
    f3Put(L, Pl(0.12, 0.045), GLOW, { x: 0.085, y: 1.215, z: -0.137, ry: Math.PI, t: 1, g: 0.9 });  // 가슴 팀 표식
    [-1, 1].forEach(s => f3Put(L, Pl(0.085, 0.075), GLOW, { x: s * 0.274, y: 1.235, ry: s * Math.PI / 2, t: 1, g: 0.9 }));   // 어깨 패치 (팀 색)
    f3Put(L, B(0.26, 0.28, 0.06), OLIVE, { y: 1.07, z: 0.165 });                             // 무전기 배낭
    f3Put(L, B(0.22, 0.06, 0.03), DARK, { y: 0.97, z: 0.21 });
    f3Put(L, B(0.27, 0.035, 0.085), GLOW, { y: 1.205, z: 0.17, t: 1, g: 0.9 });              // 배낭 위 팀 띠 (뒤에서 보임)
    f3Put(L, C(0.006, 0.008, 0.42, 3, 1), BLK, { x: 0.09, y: 1.4, z: 0.19 });                   // 안테나
    f3Put(L, C(0.075, 0.08, 0.05, 8, 1), CAMO, { y: 1.315, c: 1 });                            // 깃
    f3Put(L, C(0.052, 0.058, 0.12, 6, 1), SKIN, { y: 1.37 });                                   // 목
    f3Put(L, Sp(0.105, 8, 6), SKIN, { y: 1.5, z: -0.01, s: [0.95, 1.12, 1.0] });            // 머리
    f3Put(L, B(0.13, 0.07, 0.11), SKIN, { y: 1.43, z: -0.045 });                             // 턱
    f3Put(L, new T.SphereGeometry(0.108, 5, 3, 0, Math.PI, 0.45, 1.2), HAIR, { y: 1.5, z: -0.006, s: [0.97, 1.12, 1.02] });   // 뒷머리 (짧게 깎은 · 뒤쪽 반)
    f3Put(L, B(0.026, 0.042, 0.035), 0xB07B58, { y: 1.495, z: -0.118 });                      // 코
    [-1, 1].forEach(s => f3Put(L, B(0.02, 0.045, 0.035), 0xB07B58, { x: s * 0.103, y: 1.5 }));// 귀
    f3Put(L, B(0.205, 0.05, 0.06), BLK, { y: 1.538, z: -0.088 });                            // 고글 띠
    [-1, 1].forEach(s => f3Put(L, Pl(0.072, 0.042), 0x9FD8F0, { x: s * 0.045, y: 1.538, z: -0.119, ry: Math.PI, g: 0.45 }));   // 고글 렌즈
    [-1, 1].forEach(s => f3Put(L, B(0.012, 0.11, 0.012), DARK, { x: s * 0.1, y: 1.47, z: -0.02 }));   // 턱끈
    f3Put(L, Sp(0.145, 11, 4, 0, Math.PI / 2), 0xCFCFB4, { y: 1.565, s: [1, 0.82, 1.05], c: 1 });   // 헬멧 (위장 덮개)
    f3Put(L, C(0.149, 0.152, 0.026, 11, 1), OLIVE, { y: 1.567 });                               // 헬멧 테
    f3Put(L, C(0.149, 0.149, 0.032, 11, 1), GLOW, { y: 1.595, s: [1, 1, 1.05], t: 1, g: 0.9 }); // 헬멧 팀 띠
    f3Put(L, B(0.05, 0.04, 0.025), BLK, { y: 1.62, z: -0.142 });                             // 야간투시경 받침
    out.upper = f3MergeGeos(L); }
  { const L = [];   // 멀리: 상자 몇 개로
    f3Put(L, B(0.34, 0.5, 0.19), CAMO, { y: 1.05, c: 1 });
    f3Put(L, B(0.36, 0.33, 0.26), VEST, { y: 1.1, t: 2 });
    [-1, 1].forEach(s => f3Put(L, B(0.1, 0.12, 0.12), CAMO, { x: s * 0.2, y: 1.25, c: 1 }));
    [-1, 1].forEach(s => f3Put(L, B(0.02, 0.075, 0.08), GLOW, { x: s * 0.26, y: 1.235, t: 1, g: 0.9 }));
    f3Put(L, B(0.25, 0.27, 0.08), OLIVE, { y: 1.07, z: 0.17 });
    f3Put(L, B(0.27, 0.035, 0.085), GLOW, { y: 1.205, z: 0.17, t: 1, g: 0.9 });
    f3Put(L, B(0.1, 0.12, 0.1), SKIN, { y: 1.37 });
    f3Put(L, B(0.19, 0.22, 0.2), SKIN, { y: 1.49, z: -0.01 });
    f3Put(L, B(0.18, 0.1, 0.03), HAIR, { y: 1.53, z: 0.095 });
    f3Put(L, B(0.2, 0.05, 0.03), 0x9FD8F0, { y: 1.538, z: -0.1, g: 0.45 });
    f3Put(L, Sp(0.145, 7, 3, 0, Math.PI / 2), 0xCFCFB4, { y: 1.565, s: [1, 0.82, 1.05], c: 1 });
    f3Put(L, C(0.15, 0.15, 0.04, 7), GLOW, { y: 1.59, s: [1, 1, 1.05], t: 1, g: 0.9 });
    out.upperLo = f3MergeGeos(L); }
  // 골반 (허리띠 · 주머니)
  { const L = [];
    f3Put(L, B(0.33, 0.21, 0.2), PANTS, { y: 0.815, c: 1 });
    f3Put(L, B(0.345, 0.05, 0.215), DARK, { y: 0.9 });
    f3Put(L, B(0.05, 0.036, 0.012), TAN, { y: 0.9, z: -0.11 });
    [-1, 1].forEach(s => f3Put(L, B(0.06, 0.1, 0.09), OLIVE, { x: s * 0.185, y: 0.84, z: 0.03 }));
    out.pelvis = f3MergeGeos(L); }
  // 허벅지 (엉덩이 관절에서 아래로 0.36)
  { const L = []; f3Put(L, C(0.085, 0.068, 0.39, 6, 1), PANTS, { y: -0.175, c: 1 }); f3Put(L, B(0.07, 0.09, 0.025), PANTS, { y: -0.19, z: -0.075, c: 1 }); out.thigh = f3MergeGeos(L); }
  // 정강이 + 무릎 보호대 + 전투화 (무릎 관절에서 발바닥까지 0.4)
  { const L = [];
    f3Put(L, C(0.066, 0.054, 0.3, 6, 1), PANTS, { y: -0.145, c: 1 });
    f3Put(L, B(0.11, 0.1, 0.045), DARK, { y: -0.02, z: -0.062 });                             // 무릎 보호대
    f3Put(L, B(0.105, 0.12, 0.19), BLK, { y: -0.35, z: -0.035 });                          // 전투화
    f3Put(L, B(0.112, 0.022, 0.2), 0x3A2E22, { y: -0.4, z: -0.035 });                        // 밑창
    out.shin = f3MergeGeos(L); }
  // 위팔 (어깨에서 0.28) · 아래팔 + 장갑 낀 손 (팔꿈치에서 손바닥까지 0.3)
  { const L = []; f3Put(L, C(0.055, 0.047, 0.29, 6, 1), CAMO, { y: -0.135, c: 1 }); out.uarm = f3MergeGeos(L); }
  { const L = []; f3Put(L, C(0.047, 0.04, 0.2, 6, 1), CAMO, { y: -0.1, c: 1 }); f3Put(L, C(0.043, 0.043, 0.05, 6, 1), DARK, { y: -0.215 });
    f3Put(L, B(0.075, 0.1, 0.045), DARK, { y: -0.29 }); out.farm = f3MergeGeos(L); }
  // 총 (개머리판 끝이 원점, 총구가 -z): 라이플 (카빈) · 스나이퍼 (긴 총열 · 조준경 · 양각대)
  { const L = [], GUN = 0x2A2D33, GUN2 = 0x3A3E46;
    f3Put(L, B(0.045, 0.075, 0.18), GUN, { y: -0.012, z: -0.09 });                           // 개머리판
    f3Put(L, B(0.052, 0.07, 0.26), GUN2, { z: -0.31 });                                      // 몸통
    f3Put(L, B(0.034, 0.14, 0.06), GUN, { y: -0.095, z: -0.36, rx: 0.18 });                  // 탄창
    f3Put(L, B(0.03, 0.085, 0.035), GUN, { y: -0.065, z: -0.21, rx: -0.3 });                 // 손잡이
    f3Put(L, B(0.058, 0.062, 0.24), 0x4A4A36, { z: -0.55 });                                 // 총열 덮개
    f3Put(L, C(0.012, 0.012, 0.16, 6), GUN, { z: -0.74, rx: Math.PI / 2 });                  // 총열
    f3Put(L, C(0.018, 0.018, 0.05, 6), GUN, { z: -0.835, rx: Math.PI / 2 });                 // 소염기
    f3Put(L, B(0.036, 0.045, 0.085), GUN, { y: 0.06, z: -0.3 });                             // 조준기
    f3Put(L, B(0.016, 0.016, 0.006), 0xFF4040, { y: 0.065, z: -0.344, g: 1 });               // 조준기 빨간 점
    out.rifle = f3MergeGeos(L); out.rifle.scale(1.3, 1.25, 1); }
  { const L = [], GUN = 0x24272C, WOOD = 0x6B6440;
    f3Put(L, B(0.048, 0.095, 0.26), WOOD, { y: -0.015, z: -0.13 });                          // 개머리판
    f3Put(L, B(0.03, 0.035, 0.12), WOOD, { y: 0.05, z: -0.1 });                              // 뺨 받침
    f3Put(L, B(0.05, 0.065, 0.22), GUN, { z: -0.37 });                                       // 몸통
    f3Put(L, B(0.034, 0.07, 0.07), GUN, { y: -0.06, z: -0.38 });                             // 탄창
    f3Put(L, B(0.03, 0.085, 0.035), GUN, { y: -0.065, z: -0.25, rx: -0.3 });                 // 손잡이
    f3Put(L, B(0.056, 0.058, 0.34), WOOD, { z: -0.65 });                                     // 덮개
    f3Put(L, C(0.014, 0.014, 0.44, 6), GUN, { z: -1.03, rx: Math.PI / 2 });                  // 긴 총열
    f3Put(L, B(0.036, 0.032, 0.07), GUN, { z: -1.26 });                                      // 제퇴기
    f3Put(L, C(0.025, 0.025, 0.3, 8), GUN, { y: 0.075, z: -0.37, rx: Math.PI / 2 });         // 조준경
    f3Put(L, C(0.034, 0.028, 0.06, 8), GUN, { y: 0.075, z: -0.55, rx: Math.PI / 2 });
    f3Put(L, C(0.03, 0.03, 0.006, 8), 0x8FE3FF, { y: 0.075, z: -0.582, rx: Math.PI / 2, g: 0.8 });   // 렌즈
    [-1, 1].forEach(s => f3Put(L, C(0.006, 0.006, 0.26, 4), GUN, { x: s * 0.018, y: -0.04, z: -0.86, rx: Math.PI / 2 }));   // 접은 양각대
    out.sniper = f3MergeGeos(L); out.sniper.scale(1.2, 1.2, 1); }
  // 총구 섬광 (세 장을 엇갈려 어느 쪽에서 봐도 보이게) · 발밑 고리 · 부활 빛기둥
  { const L = []; [0, Math.PI / 3, -Math.PI / 3].forEach(r => { const g = new T.PlaneGeometry(0.16, 0.34); g.rotateX(-Math.PI / 2); g.rotateZ(r); g.translate(0, 0, -0.14); L.push(g); }); out.flash = f3MergeGeos(L); }
  { const L = [], disc = new T.CircleGeometry(0.36, 18), ring = new T.RingGeometry(0.36, 0.46, 24);
    [[disc, 0x000000], [ring, 0xFFFFFF]].forEach(([g, hex]) => { g.rotateX(-Math.PI / 2); const n = g.attributes.position.count, col = new Float32Array(n * 3), c = new T.Color(hex); for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; } g.setAttribute('color', new T.BufferAttribute(col, 3)); L.push(g); });
    out.ring = f3MergeGeos(L); }
  out.beam = new T.CylinderGeometry(0.45, 0.45, 2.4, 14, 1, true); out.beam.translate(0, 1.2, 0);
  return out;
}
// 트랙 문자열 → 실제 맵. 'plaza' 기본 · 'plaza:24' 24명 크기 · 'v2' 매칭전 2:2 (match = 경기 번호, 경기마다 다른 맵)
const F3_MAP_CACHE = {};
const F3_MATCH_ORDER = ['plaza', 'desert', 'arctic', 'city', 'jungle', 'warehouse'];
const F3_MATCH_SIZE = [0, 24, 28, 32, 36, 40];      // N:N 경기 맵 한 변
const F3_MATCH_GOAL = [0, 5, 7, 9, 11, 13];         // 먼저 이 킬 수에 닿는 팀이 승리
const F3_MATCH_TIME = 180000;                       // 한 판 제한 시간 3분
const F3_MATCH_REST = 9000;                         // 판이 끝난 뒤 결과를 보여 주는 시간
function f3MatchVs(track) { const m = /^v([1-5])/.exec(String(track || '')); return m ? +m[1] : 0; }
function f3MapFor(track, match) {
  const t = String(track || 'plaza'), vs = f3MatchVs(t), key = t + '|' + (vs ? (match | 0) : '');
  if (F3_MAP_CACHE[key]) return F3_MAP_CACHE[key];
  let res;
  if (vs) {
    const k = Math.max(0, match | 0), mapId = F3_MATCH_ORDER[k % F3_MATCH_ORDER.length], base = F3_MAPS[mapId].build(), c = f3Crop(base.rows, base.spawns, F3_MATCH_SIZE[vs]);
    res = f3Finish(c.m, c.spawns, { theme: F3_MAPS[mapId].theme, seed: 101 + vs * 13 + k, fill: true, density: 0.85, step: 5, want: Math.max(8, vs * 4 + 4) });
    Object.assign(res, { mapId, vs, match: k, scale: 1 });
  } else {
    const parts = t.split(':'), mapId = F3_MAPS[parts[0]] ? parts[0] : 'plaza', base = F3_MAPS[mapId].build(), s = f3ScaleFor(parts[1]);
    if (s <= 1) res = { rows: base.rows, spawns: base.spawns };
    else { const sc = f3Scale(base.rows, base.spawns, s); res = f3Finish(sc.m, sc.spawns, { theme: F3_MAPS[mapId].theme, seed: Math.round(s * 100) + mapId.length, fill: true, step: 5, density: 0.92, want: Math.round(12 * s * s) }); }
    Object.assign(res, { mapId, vs: 0, scale: s });
  }
  F3_MAP_CACHE[key] = res; return res;
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
Object.keys(F3_MAPS).forEach(k => { F3_MAPS[k].desc += ' · 인원이 많으면 맵이 넓어져요 (16명 1.5배 · 30명 2배)'; });   // 교사 화면 맵 카드 안내
// 매칭전 인원 (교사 화면의 맵 고르기 자리에 카드로 나옴) — 맵은 경기마다 돌아가며 정해지고, 인원에 맞게 작게 잘림
const F3_MATCH_MODES = {};
[1, 2, 3, 4, 5].forEach(n => { F3_MATCH_MODES['v' + n] = { name: n + ' : ' + n + ' 매칭', tag: (n * 2) + '명씩 · ' + F3_MATCH_GOAL[n] + '킬 승리',
  desc: '반 학생을 ' + n + ':' + n + ' 경기들로 자동으로 나눕니다. 경기마다 다른 작은 맵 · 같은 경기 친구만 보여요', build: () => f3MapFor('v' + n, 0) }; });
const F3_MAP = F3_MAPS.plaza.build().rows;
const F3_SPAWNS = F3_MAPS.plaza.build().spawns;
const F3_TEAM = { red: 0xFF5C7A, blue: 0x2E9BFF };
const F3_TEAM_CSS = { red: '#FF5C7A', blue: '#2E9BFF' };
const F3_WEAPONS = {
  rifle:  { name: '라이플',  mag: 30, reload: 1400, rate: 110, dmgBody: 34, dmgHead: 60,  dmgFar: 26, spread: 1.0, zoomFov: 72 },
  sniper: { name: '스나이퍼', mag: 5,  reload: 2600, rate: 900, dmgBody: 90, dmgHead: 150, dmgFar: 90, spread: 0.15, zoomFov: 22 }   // 줌 상태에서만 정확
};
const F3_NOSCOPE = 0.16;   // 스나이퍼를 줌 없이 쏠 때 탄이 흩어지는 반지름(라디안 ≈ 9°): 3칸 약 85% · 6칸 약 40% · 10칸 약 15% 명중 (줌·라이플은 100%)
const F3_MAG = 30;
const F3_EYE = 1.6;
const F3_HIT_GAP = 200;          // 명중 신호를 묶는 간격(ms)
const F3_BASE_LAT = 80;          // 서버 시계를 모를 때 가정하는 기본 지연(ms)
const F3_LEAD = 0.6;             // 신호 나이의 몇 %만큼 앞당겨 그릴지
const F3_SPAWN_PROT = 1200;      // 부활 직후 무적(ms) — 내가 쏘면 바로 풀림 (명중은 쏜 사람 화면 기준이라 신호에 실어 보냄)
const F3_STAMP_WRAP = 60466176;  // 보낸 시각을 36진수 5자리로 (약 16.8시간마다 한 바퀴)
const F3_GRAV = 22.3;            // 중력 (칸/초²) — 점프 예측용
// 병사 판정 상자 — 그려진 모델(initSoldiers)과 같은 크기·자리 (몸 기준: x 옆, y 위, z 앞이 -) [가운데 x,y,z, 반폭 x,y,z, 부위]
// 부위: 0 몸 · 1 머리 · 2 왼다리 · 3 오른다리 · 4 오른팔(총 든 팔, 위아래로 돌아감). 총은 판정 없음
const F3_PARTS = [[0, 1.55, -0.012, 0.15, 0.16, 0.163, 1], [0, 1.0125, 0, 0.24, 0.3125, 0.15, 0], [-0.32, 1.0, 0, 0.065, 0.25, 0.07, 0],
                  [-0.11, 0.35, 0, 0.08, 0.35, 0.09, 2], [0.11, 0.35, 0, 0.08, 0.35, 0.09, 3], [0.3, 1.05, -0.15, 0.065, 0.2, 0.07, 4]];
const F3_PAD_PX = 0.0093;        // 가장자리 여유: 화면 약 2.5px (거리에 비례) — 조준점이 몸 바로 옆을 스쳐도 맞음
const F3_BOXH = { '#': 2.48, '=': 2.48, 'B': 2.48, 'H': 4.08, 'W': 1.28, 'X': 1.0, 'L': 0.6 };   // 상자 모양 구조물 높이 (위 테두리 0.08 포함)
const F3_HIT_OLD = 800;          // 받은 명중이 이보다 오래 전에 쏜 것이면 무시(ms) — 엄폐물 뒤로 숨은 지 한참 뒤에 맞는 일 막기

const F3_SURF = {}, F3_SKY = {};   // 절차적 무늬 · 하늘 캔버스 캐시 (맵 테마마다 한 번)
// 벽 재질 덧칠: 무늬를 세계 좌표로(이웃 칸과 이음매 없이 · world) + 땅에 닿은 아래쪽을 어둡게(접지 그림자). Lambert · Standard 둘 다
function f3WallPatch(m, world) {
  m.onBeforeCompile = sh => {
    sh.vertexShader = 'varying float vF3Y;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n\t{ vec4 f3w = modelMatrix * instanceMatrix * vec4( position, 1.0 ); vF3Y = f3w.y;\n' +
      (world ? '\t  vec3 f3n = abs( normal ); vec2 f3uv = f3n.y > 0.5 ? f3w.xz : ( f3n.x > 0.5 ? vec2( -f3w.z * sign( normal.x ), f3w.y ) : vec2( f3w.x * sign( normal.z ), f3w.y ) );\n\t  vUv = ( uvTransform * vec3( f3uv, 1.0 ) ).xy;\n' : '') + '\t}');
    sh.fragmentShader = 'varying float vF3Y;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n\tdiffuseColor.rgb *= mix( 0.58, 1.0, smoothstep( 0.0, 0.42, vF3Y ) );');
  };
  m.customProgramCacheKey = () => 'f3wall' + (world ? 'W' : 'B');
}

class Fps3DGame {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.opts = opts || {};
    this.myId = this.opts.myId || 'me';
    this.myName = this.opts.myName || '';
    this.teamMode = !!this.opts.teamMode;
    // 맵: 'plaza' · 'plaza:24'(인원에 맞춘 크기) · 'v2'(매칭전 2:2)
    this.track = String(this.opts.trackId || 'plaza'); this.vs = f3MatchVs(this.track);
    if (this.opts.matchMode && !this.vs) { this.vs = 2; this.track = 'v2'; }   // 매칭전인데 인원을 고르지 않았으면 2:2
    this.matchMode = this.vs > 0;
    // 매칭전: 경기 번호 · 팀은 교사 화면이 시작할 때 나눠 준 표(session.teams)에서. 표에 없으면(늦게 들어옴) 빈자리가 있는 경기로
    this.mRound = 1; this.mWins = { red: 0, blue: 0 }; this.mEnd = null; this.mStart = null;
    if (this.matchMode) { this.teamMode = true; this.assignMatch(); }
    else this.team = this.teamMode ? Fps3DGame.teamOf(this.myId) : null;
    this.useMap(this.match);
    this.peers = {}; this.models = {}; this._hitQ = {};
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
  // 신호: x,y,방향,체력,킬,데스,팀,발사,다운,이동,상하,높이,구르기,판,레드승,블루승, 보낸시각(36진수),속도x,속도y,높이속도,경기번호,무적(1),무기(s = 스나이퍼 · 없으면 라이플)
  //   무기 칸은 끝에 덧붙인 것: 예전 기기가 보낸 신호(칸 없음)는 라이플로, 예전 기기는 이 칸을 읽지 않음 (판정과 무관 — 긴 총으로 보이게만)
  static parse(raw) {
    const a = String(raw).split(',');
    const rt = (a[12] === undefined || a[12] === '') ? -1 : +a[12];
    return { x: +a[0], y: +a[1], angle: +a[2], hp: +a[3], kills: +a[4], deaths: +a[5], team: a[6] || null, fire: a[7] === '1', dead: a[8] === '1', moving: a[9] === '1', pitch: +a[10] || 0, z: +a[11] || 0, rollT: rt, roll: rt >= 0, round: +a[13] || 1, wr: +a[14] || 0, wb: +a[15] || 0,
             st: a[16] ? parseInt(a[16], 36) : null, vx: +a[17] || 0, vy: +a[18] || 0, vz: +a[19] || 0, match: (a[20] === undefined || a[20] === '') ? null : +a[20], prot: a[21] === '1', wpn: a[22] === 's' ? 's' : '' };
  }
  // 교사 화면·학생 화면이 같은 맵을 만들 때 씀
  static mapFor(track, match) { return f3MapFor(track, match); }
  static matchVs(track) { return f3MatchVs(track) || 2; }
  // 교사 화면이 [게임 시작] 때 부름: 지금 인원(n)을 맵 이름에 붙여 모두가 같은 크기 맵을 쓰게 함
  static sizedTrack(gid, track, n) {
    const t = String(track || '');
    if (gid === 'fpsclassic') return 'classic:' + (n | 0);
    if (f3MatchVs(t)) return t;
    if (gid === 'fpsmatch') return 'v2';
    const id = F3_MAPS[t.split(':')[0]] ? t.split(':')[0] : 'plaza';
    return id + ':' + (n | 0);
  }
  // 매칭: 학생 id 를 정렬해 N:N 경기들로 나눔 → { id: '경기번호' + 'r'|'b' }. 모든 기기에서 같은 결과
  // 남는 인원: N명 이상(최소 2명)이면 작은 경기 하나 더, 아니면 뒤 경기부터 한 명씩 끼움 (예: 2:3)
  static makeMatches(ids, vs) {
    const list = (ids || []).slice().sort(), size = Math.max(2, vs * 2), out = {}, groups = [];
    const M = Math.floor(list.length / size);
    for (let k = 0; k < M; k++) groups.push(list.slice(k * size, (k + 1) * size));
    const rest = list.slice(M * size);
    if (rest.length) { if (!groups.length || rest.length >= Math.max(2, vs)) groups.push(rest); else rest.forEach((id, i) => groups[groups.length - 1 - (i % groups.length)].push(id)); }
    groups.forEach((g, k) => g.forEach((id, i) => { out[id] = k + (i % 2 ? 'b' : 'r'); }));
    return out;
  }
  assignMatch() {
    const src = this.opts.teams || (Array.isArray(this.opts.roster) && this.opts.roster.length ? Fps3DGame.makeMatches(this.opts.roster, this.vs) : {});
    const T = {}; Object.keys(src).forEach(id => { if (/^\d+[rb]$/.test(String(src[id]))) T[id] = String(src[id]); });   // 다른 게임의 팀 표가 섞여 있으면 무시
    let code = T[this.myId];
    if (!code) {
      const cnt = {}; Object.keys(T).forEach(id => { const k = parseInt(T[id]), c = cnt[k] || (cnt[k] = { r: 0, b: 0 }); c[T[id].slice(-1)]++; });
      let best = 0, bestN = 1e9; Object.keys(cnt).map(Number).forEach(k => { const n = cnt[k].r + cnt[k].b; if (n < bestN || (n === bestN && k < best)) { bestN = n; best = k; } });
      const c = cnt[best] || { r: 0, b: 0 }; code = best + (c.b < c.r ? 'b' : 'r'); this.lateJoin = true;
    }
    this.match = parseInt(code) || 0; this.team = code.slice(-1) === 'b' ? 'blue' : 'red';
    const mates = Object.keys(T).filter(id => T[id] === code).sort(); this.teamSlot = mates.indexOf(this.myId) >= 0 ? mates.indexOf(this.myId) : mates.length;
  }
  // 맵 만들기 (매칭전은 경기 번호마다 다른 맵)
  useMap(match) {
    const built = f3MapFor(this.track, match);
    this.map = built.rows; this.spawns = built.spawns; this.mapScale = built.scale || 1; this._built = built;
    this.mapId = built.mapId; this.mapDef = F3_MAPS[this.mapId]; this.theme = F3_THEMES[this.mapDef.theme];
    this._mm = null;
  }
  // 교사 관전: 따라가는 학생의 경기가 다르면 그 경기 맵으로 다시 만듦
  setMatch(k, team) {
    if (k == null || k === this.match) return;
    this.match = k; if (team) this.team = team;
    this.useMap(k);
    Object.keys(this.peers).forEach(id => { if (this.peers[id].match !== k) this.removePeer(id); });
    if (this.scene) { this.disposeScene(); this.initScene(); if (this.q != null) this.setQuality(this.q); }
  }
  get isDead() { return this.now < this.deadUntil; }
  get spawnSafe() { return !this.isDead && this.now < (this.protUntil || 0); }   // 부활 직후 무적 중
  get reloading() { return this.now < this.reloadUntil || this.now < (this.readyUntil || 0); }   // 재장전 중이거나 무기 전환 준비 중
  get wpn() { return F3_WEAPONS[this.weapon] || F3_WEAPONS.rifle; }
  get magSize() { return this.wpn.mag; }
  clock() { return this.now || performance.now(); }

  // 프레임 간격에 맞춘 보간 비율 (프레임 수에 좌우되지 않게)
  smooth(k, f) { return 1 - Math.pow(1 - k, Math.max(0.2, f || 1)); }
  cell(x, y) { const r = this.map[Math.floor(y)]; return (r && r[Math.floor(x)]) || '#'; }
  wall(x, y) { return this.cell(x, y) !== '.'; }

  spawnAt(slot, side) {
    let best = null, bestD = -1;
    // 매칭전 판 시작: 레드는 한쪽 끝, 블루는 반대쪽 끝에서 (팀 안 순번대로)
    if (this.matchMode && (side || !Object.keys(this.peers).length)) {
      const s = this.spawns.slice().sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]) || a[0] - b[0]), k = (this.teamSlot || 0) % Math.max(1, Math.floor(s.length / 2));
      best = this.team === 'blue' ? s[s.length - 1 - k] : s[k];
    }
    if (!best) this.spawns.forEach((sp, i) => {
      let d = 1e9;
      Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (p.dead || (this.teamMode && p.team === this.team)) return; d = Math.min(d, Math.hypot(p.x - sp[0], p.y - sp[1])); });
      if (d === 1e9) d = 100 + ((i + slot) % this.spawns.length);
      if (d > bestD) { bestD = d; best = sp; }
    });
    this.x = best[0]; this.y = best[1];
    const C = this.map.length / 2; this.yaw = Math.atan2(C - this.y, C - this.x); this.pitch = 0;
    this.ammo = this.magSize; this.reloadUntil = 0; this.zoomed = false;
    this.protUntil = this.clock() + F3_SPAWN_PROT;            // 부활 직후 무적 (판 시작 출발 때도 — 같은 규칙)
    this._hist = [];                                          // 위치 기록은 새 목숨부터
  }

  // ── 장면 구성 ──
  // 재질: mid·high 는 물리 재질(MeshStandard · 노멀맵 · 환경광), low 는 예전 Lambert(꼭짓점 조명 — 가장 가벼움)
  mat(p) {
    const T = THREE; p = Object.assign({}, p);
    if (this.lit) { if (p.roughness == null) p.roughness = 0.88; if (p.metalness == null) p.metalness = 0; return new T.MeshStandardMaterial(p); }
    ['normalMap', 'normalScale', 'roughness', 'metalness', 'envMapIntensity', 'roughnessMap'].forEach(k => { delete p[k]; });
    return new T.MeshLambertMaterial(p);
  }
  initScene() {
    if (typeof THREE === 'undefined') { this.noGL = true; return; }
    const T = THREE;
    // 렌더러 먼저 (기기 화질 단계를 알려고). 교사 관전에서 맵을 바꿔 다시 만들 때는 그대로 씀
    if (!this.renderer && !this.noGL) try {
      this.renderer = new T.WebGLRenderer({ canvas: this.canvas, antialias: false, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(Math.min(1.25, (typeof window !== 'undefined' && window.devicePixelRatio) || 1));
      this.renderer.outputEncoding = T.sRGBEncoding;
    } catch (e) { this.noGL = true; }
    if (!this.hq) { const pk = this.renderer ? f3PickTier(this.renderer, this.opts) : { t: 'low' }; this.hq = pk.t; this.hqLocked = !!pk.locked; this.fx = { shadow: pk.t === 'high', post: pk.t === 'high' }; }
    const lit = this.lit = this.hq !== 'low', high = this.hq === 'high', r = this.renderer;
    this._vm = null; this._vmm = null;
    this.scene = new T.Scene();
    const th = this.theme || F3_THEMES.plaza, tk = this.mapDef ? this.mapDef.theme : 'plaza', N = this.map.length;
    this.scene.background = new T.Color(th.fog[0]);
    this.scene.fog = new T.Fog(th.fog[0], th.fog[1], th.fog[2]);   // 안개 끝 = 병사가 보이고 맞는 거리 (viewFar) — 바꾸지 않음
    this.camera = new T.PerspectiveCamera(72, 1, 0.05, 140);
    if (r) { r.toneMapping = lit ? T.ACESFilmicToneMapping : T.NoToneMapping; r.toneMappingExposure = th.night ? 1.5 : 1.0; r.shadowMap.enabled = high && this.fx.shadow; r.shadowMap.type = T.PCFSoftShadowMap; }

    // 조명: 하늘빛 + 해 (해 방향 = 하늘에 그린 해 = 굽힌 그림자 방향)
    this.hemi = new T.HemisphereLight(th.hemi[0], th.hemi[1], lit ? (th.night ? 0.75 : 0.28) : (th.night ? 0.6 : 0.85));
    this.sun = new T.DirectionalLight(th.sun, lit ? (th.night ? 0.9 : 1.4) : (th.night ? 0.55 : 1.0));
    if (lit) { this.hemi.color.convertSRGBToLinear(); this.hemi.groundColor.convertSRGBToLinear(); this.sun.color.convertSRGBToLinear(); }
    this.sun.position.set(N / 2 + F3_SUN[0] * 60, F3_SUN[1] * 60, N / 2 + F3_SUN[2] * 60); this.sun.target.position.set(N / 2, 0, N / 2);
    this.scene.add(this.hemi, this.sun, this.sun.target);
    if (high) { const s = this.sun; s.castShadow = this.fx.shadow; s.shadow.mapSize.set(2048, 2048); const c = s.shadow.camera; c.left = c.bottom = -20; c.right = c.top = 20; c.near = 5; c.far = 130; s.shadow.bias = -0.0004; s.shadow.normalBias = 0.03; }

    // 굽힌 바닥: 벽 주변 어둠 + 해 그림자 (맵마다 한 번) · 병사도 그림자 칸에 들어가면 어둡게(updateModels)
    const built = this._built || {}; this.bake = built._bake || (built._bake = f3BakeFloor(this.map, !!th.night));
    // 표면 무늬 (캔버스는 맵 테마마다 한 번 만들어 둠 · 텍스처는 장면마다)
    const aniso = r ? Math.min(high ? 8 : (lit ? 4 : 1), r.capabilities.getMaxAnisotropy()) : 1;
    const ctex = (cv, srgb, rep) => { const t = new T.CanvasTexture(cv); if (srgb) t.encoding = T.sRGBEncoding; t.wrapS = t.wrapT = T.RepeatWrapping; if (rep) t.repeat.set(rep[0], rep[1]); t.anisotropy = aniso; return t; };
    [F3_SURF, F3_SKY].forEach(C => Object.keys(C).forEach(k => { if (k.split('|')[1] !== tk) delete C[k]; }));   // 다른 테마 캔버스는 버림 (태블릿 메모리)
    const surf = (kind, S) => { const key = kind + '|' + tk + '|' + S; return F3_SURF[key] || (F3_SURF[key] = f3Surface(kind, th, tk, S)); };
    const surfMat = (kind, S, rep, o) => { const sf = surf(kind, S), p = Object.assign({ map: ctex(sf.c, true, rep) }, o || {});
      if (lit) { if (!sf.n && sf.h) sf.n = f3NormalCv(sf.h, kind === 'floor' ? 2.6 : 3.2); sf.h = null; if (sf.n) p.normalMap = ctex(sf.n, false, rep); } else sf.h = null;   // 높이 캔버스는 노멀맵을 만든 뒤 버림
      return this.mat(p); };
    // 바닥: 무늬(2m 반복) × 굽힌 바닥(맵 전체 한 장 — 두 번째 UV)
    this.bakeTex = new T.CanvasTexture(this.bake.bake); this.bakeTex.anisotropy = aniso;
    const fr = { desert: 0.95, arctic: 0.62, warehouse: 0.5, city: 0.82, jungle: 0.95 }[tk] || 0.9;
    const floorMat = surfMat('floor', lit ? 512 : 256, [N / 2, N / 2], { roughness: fr, aoMap: this.bakeTex, aoMapIntensity: 0, envMapIntensity: 0.45 });
    floorMat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n\tdiffuseColor.rgb *= texture2D( aoMap, vUv2 ).r * 1.085;'); };
    floorMat.customProgramCacheKey = () => 'f3floor';
    const fg = new T.PlaneGeometry(N, N); fg.setAttribute('uv2', new T.BufferAttribute(fg.attributes.uv.array.slice(), 2));
    const floor = new T.Mesh(fg, floorMat); floor.rotation.x = -Math.PI / 2; floor.position.set(N / 2, 0, N / 2); floor.receiveShadow = true; this.scene.add(floor);
    // 바깥 지면 (넓게)
    const ground = new T.Mesh(new T.PlaneGeometry(400, 400), this.mat({ color: new T.Color(th.ground).multiplyScalar(0.9), roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(N / 2, -0.01, N / 2); this.scene.add(ground);

    // 벽 — 종류별 InstancedMesh. 무늬는 세계 좌표로 이어 붙임(이웃 칸과 이음매 없이) · 아래쪽은 땅에 닿아 어둡게
    const cellsOf = k => { const cells = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (this.map[y][x] === k) cells.push([x, y]); return cells; };
    const place = (mesh, cells, h, yOff) => { const m = new T.Matrix4(); cells.forEach(([x, y], i) => { m.makeTranslation(x + 0.5, (yOff != null ? yOff : h / 2), y + 0.5); mesh.setMatrixAt(i, m); }); mesh.receiveShadow = true; this.scene.add(mesh); return mesh; };
    const wc = th.walls || {}, WM = {};
    const wallMat = (k) => { if (WM[k]) return WM[k];
      const rep = { '#': [0.5, 1 / 2.4], '=': [0.5, 1 / 2.4], B: [0.5, 1 / 2.4], H: [0.5, 0.25], L: [0.5, 1 / 0.6], X: null }[k];
      const m = surfMat(k, 256, rep, { roughness: k === '=' ? 0.48 : k === 'X' ? 0.78 : 0.93, metalness: k === '=' ? 0.5 : 0, envMapIntensity: k === '=' ? 0.9 : 0.55 });
      f3WallPatch(m, k !== 'X'); return (WM[k] = m); };
    ['#', '=', 'B', 'H', 'X', 'L'].forEach(k => {
      const cells = cellsOf(k); if (!cells.length) return;
      const h = F3_HEIGHT[k];
      place(new T.InstancedMesh(new T.BoxGeometry(1, h, 1), wallMat(k), cells.length), cells, h);
    });
    // 창문벽 W: 낮은 벽 + 위쪽 창틀 (위로는 쏠 수 있음)
    const trimMat = this.mat({ color: 0x3A4256, roughness: 0.55, metalness: 0.4 });
    { const cells = cellsOf('W'); if (cells.length) {
        place(new T.InstancedMesh(new T.BoxGeometry(1, 1.2, 1), wallMat('#'), cells.length), cells, 1.2);
        place(new T.InstancedMesh(new T.BoxGeometry(1, 0.08, 0.3), trimMat, cells.length), cells, 0, 1.24); } }
    // 기둥 P: 원통 + 받침
    { const cells = cellsOf('P'); if (cells.length) {
        const col = new T.Color(wc.P || '#C9CFD8');
        place(new T.InstancedMesh(new T.CylinderGeometry(0.28, 0.32, 2.4, lit ? 16 : 10), this.mat({ color: col, roughness: 0.7 }), cells.length), cells, 2.4);
        place(new T.InstancedMesh(new T.CylinderGeometry(0.45, 0.5, 0.2, lit ? 16 : 10), this.mat({ color: col.clone().multiplyScalar(0.75), roughness: 0.8 }), cells.length), cells, 0, 0.1); } }
    // 나무 T: 줄기 + 원뿔 잎 두 단
    { const cells = cellsOf('T'); if (cells.length) {
        const leaf = new T.Color(wc.T || '#2E7D46');
        place(new T.InstancedMesh(new T.CylinderGeometry(0.12, 0.18, 1.2, 6), this.mat({ color: 0x6B4A2B, roughness: 0.95 }), cells.length), cells, 0, 0.6);
        place(new T.InstancedMesh(new T.ConeGeometry(0.9, 1.6, 8), this.mat({ color: leaf, roughness: 1 }), cells.length), cells, 0, 1.6);
        place(new T.InstancedMesh(new T.ConeGeometry(0.65, 1.3, 8), this.mat({ color: leaf.clone().multiplyScalar(1.15), roughness: 1 }), cells.length), cells, 0, 2.5); } }
    // 바위 R: 낮게 눌린 구
    { const cells = cellsOf('R'); if (cells.length) {
        const mesh = new T.InstancedMesh(new T.DodecahedronGeometry(0.55, 0), this.mat({ color: new T.Color(wc.R || '#8A8F98'), roughness: 0.9 }), cells.length);
        const m = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(1.1, 0.7, 1.0);
        cells.forEach(([x, y], i) => { q.setFromEuler(new T.Euler(0, (x * 7 + y * 3) % 6, 0)); m.compose(new T.Vector3(x + 0.5, 0.35, y + 0.5), q, sc); mesh.setMatrixAt(i, m); });
        mesh.receiveShadow = true; this.scene.add(mesh); } }

    // 하늘: 그린 등장방형 하늘을 방향으로 찾아 그림 (카메라를 따라다님 · 맨 먼저 · 깊이 안 씀). mid·high 는 같은 그림으로 환경광(반사)도 만듦
    const skyW = high ? 2048 : 1024, skyKey = skyW + '|' + tk, skyCv = F3_SKY[skyKey] || (F3_SKY[skyKey] = f3SkyCanvas(th, skyW));
    const skyT = new T.CanvasTexture(skyCv); skyT.minFilter = T.LinearFilter; skyT.generateMipmaps = false; skyT.wrapS = T.RepeatWrapping;
    this.sky = new T.Mesh(new T.SphereGeometry(90, 24, 12), new T.ShaderMaterial({ uniforms: { map: { value: skyT }, stars: { value: th.night ? 1 : 0 } }, side: T.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w * 0.99999; }',
      fragmentShader: 'uniform sampler2D map; uniform float stars; varying vec3 vD; void main(){ vec3 d = normalize(vD); vec4 c = texture2D(map, vec2(atan(d.z, d.x) * 0.1591549 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.3183099 + 0.5));' +
        ' if (stars > 0.5 && d.y > 0.04) { vec3 q = floor(d * 420.0); float h = fract(sin(dot(q, vec3(12.9898, 78.233, 37.719))) * 43758.5453); float b = fract(h * 91.7); c.rgb += vec3(0.9, 0.93, 1.0) * step(0.9982, h) * (0.35 + 0.65 * b) * smoothstep(0.04, 0.3, d.y); }' +
        ' gl_FragColor = c; }' }));
    this.sky.renderOrder = -10; this.sky.frustumCulled = false; this.scene.add(this.sky);
    if (lit && r) { try { const et = new T.CanvasTexture(skyCv); et.encoding = T.sRGBEncoding; et.mapping = T.EquirectangularReflectionMapping; const pm = new T.PMREMGenerator(r); this.envRT = pm.fromEquirectangular(et); pm.dispose(); et.dispose(); this.scene.environment = this.envRT.texture; } catch (e) {} }
    if (high && r && F3_HDR[tk]) this.loadHdr(F3_HDR[tk]);

    // 벽 위 테두리 (입체감)
    const trimCells = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const k = this.map[y][x]; if (k === '#' || k === '=' || k === 'B' || k === 'H' || k === 'W') trimCells.push([x, y, F3_HEIGHT[k]]); }
    const trim = new T.InstancedMesh(new T.BoxGeometry(1.04, 0.08, 1.04), trimMat, trimCells.length);
    { const m = new T.Matrix4(); trimCells.forEach(([x, y, h], i) => { m.makeTranslation(x + 0.5, h + 0.04, y + 0.5); trim.setMatrixAt(i, m); }); }
    this.scene.add(trim);
    // 바닥 얼룩 (기름·먼지 자국) — 화질을 낮추면 숨김. 접지 그림자는 굽힌 바닥에 들어 있음 (예전: 벽 칸마다 반투명 판 → 덧그리기 많았음)
    this.decor = new T.Group(); this.scene.add(this.decor);
    { const cv = f3Cv(64), g = cv.getContext('2d'), R = f3Rng(5); for (let i = 0; i < 14; i++) { const x = 16 + R() * 32, y = 16 + R() * 32, rr = 6 + R() * 14, q = g.createRadialGradient(x, y, 0, x, y, rr); q.addColorStop(0, 'rgba(255,255,255,0.55)'); q.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = q; g.fillRect(0, 0, 64, 64); }
      const st = new T.CanvasTexture(cv), decMat = new T.MeshBasicMaterial({ color: th.night ? 0x10121A : 0x3A2E22, alphaMap: st, transparent: true, opacity: 0.22, depthWrite: false });
      const cnt = Math.round(28 * Math.min(4, Math.pow(N / 44, 2) || 1)), geo = new T.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
      const dec = new T.InstancedMesh(geo, decMat, cnt), m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), sc = new T.Vector3();
      for (let i = 0; i < cnt; i++) { let x, y, k = 0; do { x = 2 + Math.random() * (N - 4); y = 2 + Math.random() * (N - 4); } while (this.wall(x, y) && k++ < 30);
        q.setFromEuler(e.set(0, Math.random() * Math.PI, 0)); m.compose(v.set(x, 0.008, y), q, sc.set(1.2 + Math.random() * 2, 1, 0.8 + Math.random() * 1.5)); dec.setMatrixAt(i, m); }
      this.decor.add(dec); }

    // 원경 · 소품 — 테마별
    this.farScenery = new T.Group(); this.scene.add(this.farScenery);
    this.buildFarScenery(th, N);
    this.buildDecor(th, N);

    // 총 (카메라에 붙임)
    this.rifleModel = this.buildWeapon(); this.sniperModel = this.buildSniper();
    this.camera.add(this.rifleModel); this.camera.add(this.sniperModel); this.rifleModel.visible = this.weapon !== 'sniper'; this.sniperModel.visible = this.weapon === 'sniper';
    this.weaponModel = this.weapon === 'sniper' ? this.sniperModel : this.rifleModel; this.scene.add(this.camera);
    // 탄피 6개 (인스턴스 하나 · 놋쇠)
    this.shellMesh = new T.InstancedMesh(new T.CylinderGeometry(0.008, 0.008, 0.03, 8), this.mat({ color: 0xD9B24C, roughness: 0.32, metalness: 0.9 }), 6);
    this.shellMesh.count = 0; this.shellMesh.frustumCulled = false; this.camera.add(this.shellMesh);
    // 총구 섬광 (+ high: 섬광 빛 — 주변 벽·바닥이 순간 밝아짐)
    const flashTex = new T.CanvasTexture(Fps3DGame.texCanvas('flash')); flashTex.encoding = T.sRGBEncoding;
    this.flash = new T.Sprite(new T.SpriteMaterial({ map: flashTex, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    this.flash.scale.set(0.35, 0.35, 1); this.flash.position.set(0.22, -0.18, -1.05); this.flash.visible = false; this.camera.add(this.flash);
    if (high) { this.mzLight = new T.PointLight(0xA8E8FF, 0, 7, 2); this.mzLight.position.set(0.25, -0.12, -1.0); this.camera.add(this.mzLight); } else this.mzLight = null;
    // HUD 2D 오버레이 캔버스
    this.hud = document.createElement('canvas');
    this.hud.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
    if (this.canvas.parentElement) { this.canvas.parentElement.style.position = 'relative'; this.canvas.parentElement.appendChild(this.hud); }
    this.hctx = this.hud.getContext('2d');
    // 효과: 레이저 궤적(빛나는 띠) · 불꽃/연기 입자 · 탄흔
    this.initBeams(); this.initFx(); this.initDecals();
    // 상대 병사들 (부위별 InstancedMesh)
    this.initSoldiers();
    // mid·high: 재질·조명 색을 선형으로 (sRGB 출력 + ACES 에서 바래 보이지 않게) · 빛나는 단색 재질은 톤 매핑 빼고 그대로
    if (lit) this.scene.traverse(o => { [].concat(o.material || []).forEach(m => { if (!m || m.userData.lin || m.isShaderMaterial) return; m.userData.lin = true;
      if (m.color) m.color.convertSRGBToLinear(); if (m.emissive) m.emissive.convertSRGBToLinear(); if (m.isMeshBasicMaterial || m.isSpriteMaterial) m.toneMapped = false; }); });
    if (high && this.fx.post && r) this.initPost();
    // 셰이더를 미리 준비 — 처음 쏘거나 처음 상대가 보이는 순간 화면이 멈칫하지 않게
    if (r) { try { r.compile(this.scene, this.camera); } catch (e) {} }
  }
  // high: HDR 사진 환경광 (assets/hdr · 받는 동안은 그린 하늘 환경광)
  loadHdr(name) {
    const tok = this.scene, load = src => new Promise((res, rej) => { if (THREE.RGBELoader) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    load('lib/RGBELoader.js').then(() => new Promise(res => new THREE.RGBELoader().setDataType(THREE.UnsignedByteType).load('assets/hdr/' + name + '.hdr', res, undefined, () => res(null)))).then(tex => {
      if (!tex || this._dead || this.scene !== tok || !this.renderer) { if (tex) tex.dispose(); return; }
      const pm = new THREE.PMREMGenerator(this.renderer), rt = pm.fromEquirectangular(tex); pm.dispose(); tex.dispose();
      if (this.envRT) this.envRT.dispose(); this.envRT = rt; this.scene.environment = rt.texture; this.hdr = true;
      this.scene.traverse(o => { [].concat(o.material || []).forEach(m => { if (m && m.envMapIntensity != null && !m.userData.hdrK) { m.userData.hdrK = 1; m.envMapIntensity *= 0.38; } }); });
    }).catch(() => {});
  }
  // 교사 관전에서 경기 맵을 바꿀 때 · 화질을 낮춰 다시 만들 때: 장면을 비우고 GPU 자원을 돌려줌
  disposeScene() {
    if (this.hud && this.hud.parentElement) this.hud.parentElement.removeChild(this.hud);
    this.freeGL();
    this.scene = null; this.models = {}; this._w = 0;
  }
  // 화질 다시 만들기 (mid → low): 같은 맵 · 같은 상태로 장면만 새로
  rebuild() { if (!this.scene) return; this.disposeScene(); this.initScene(); this.applyRes(); if (this.decor) this.decor.visible = this.q == null || this.q >= 1; if (this.farScenery) this.farScenery.visible = this.q == null || this.q >= 1; }
  setShadows(on) {
    if (!this.fx) return; this.fx.shadow = on; const r = this.renderer; if (!r || !this.scene) return;
    r.shadowMap.enabled = on; if (this.sun) this.sun.castShadow = on;
    this.scene.traverse(o => { [].concat(o.material || []).forEach(m => { if (m) m.needsUpdate = true; }); });
  }
  applyRes() { if (this.renderer) this.renderer.setPixelRatio(Math.min([0.75, 1.0, 1.25][this.resQ != null ? this.resQ : 2], (typeof window !== 'undefined' && window.devicePixelRatio) || 1)); this._w = 0; }
  // 느릴 때 한 단계 내림: 실시간 그림자 → 후처리 → (mid 는 low 재질로) — 해상도는 학생 화면의 setQuality 가 맡음. 다시 올리지 않음
  dropStep() {
    if (this.hqLocked || !this.fx) return false;
    let what = null;
    if (this.fx.shadow) { this.setShadows(false); what = 'shadow'; }
    else if (this.fx.post) { this.fx.post = false; what = 'post'; }
    else if (this.hq === 'mid') { this.hq = 'low'; this.rebuild(); what = 'mid>low'; }
    if (!what) return false;
    (this.qLog || (this.qLog = [])).push(what); if (this._perf) this._perf.cool = this.clock() + 3000;
    return true;
  }
  perfTick(now, dt) {
    if (this.hqLocked || !this.renderer || this.noGL) return;
    const P = this._perf || (this._perf = { t0: now + 4000, n: 0, sum: 0, cool: 0 });
    if (now < P.t0) return;
    if (dt > 0 && dt < 250) { P.sum += dt; P.n++; }
    if (now - P.t0 < 2500) return;
    const avg = P.n ? P.sum / P.n : 0, n = P.n; P.t0 = now; P.sum = 0; P.n = 0;
    if (n < 15 || avg <= 23 || now < P.cool) return;              // 평균 약 43fps 밑이면
    if (!this.dropStep() && this.resQ > this.q) { this.resQ = this.q; this.applyRes(); P.cool = now + 3000; (this.qLog || (this.qLog = [])).push('res'); }   // 미뤄 둔 해상도 낮춤
  }

  // ── 후처리 (high): 장면 → MSAA 렌더 타깃 → 밝은 곳 ¼ 크기로 뽑아 흐림(블룸) → 합치며 비네트 · 맞으면 색수차 ──
  initPost() {
    const T = THREE, r = this.renderer, o = { minFilter: T.LinearFilter, magFilter: T.LinearFilter, format: T.RGBAFormat };
    const ms = r.capabilities.isWebGL2 && T.WebGLMultisampleRenderTarget, main = ms ? new T.WebGLMultisampleRenderTarget(4, 4, o) : new T.WebGLRenderTarget(4, 4, o);
    if (ms) main.samples = 4; main.texture.encoding = T.sRGBEncoding; main.texture.generateMipmaps = false;
    const sm = () => { const t = new T.WebGLRenderTarget(4, 4, Object.assign({ depthBuffer: false }, o)); t.texture.generateMipmaps = false; return t; };
    const V = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
    const sh = (u, f) => new T.ShaderMaterial({ uniforms: u, vertexShader: V, fragmentShader: f, depthTest: false, depthWrite: false });
    const bright = sh({ tDiffuse: { value: null }, texel: { value: new T.Vector2() } }, 'uniform sampler2D tDiffuse; uniform vec2 texel; varying vec2 vUv; void main(){ vec3 c = texture2D(tDiffuse, vUv - texel).rgb + texture2D(tDiffuse, vUv + texel).rgb + texture2D(tDiffuse, vUv + vec2(texel.x, -texel.y)).rgb + texture2D(tDiffuse, vUv + vec2(-texel.x, texel.y)).rgb; c *= 0.25; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(0.9, 1.0, l), 1.0); }');
    const blur = sh({ tDiffuse: { value: null }, dir: { value: new T.Vector2() } }, 'uniform sampler2D tDiffuse; uniform vec2 dir; varying vec2 vUv; void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb * 0.227; c += (texture2D(tDiffuse, vUv + dir).rgb + texture2D(tDiffuse, vUv - dir).rgb) * 0.1945; c += (texture2D(tDiffuse, vUv + dir * 2.0).rgb + texture2D(tDiffuse, vUv - dir * 2.0).rgb) * 0.1216; c += (texture2D(tDiffuse, vUv + dir * 3.0).rgb + texture2D(tDiffuse, vUv - dir * 3.0).rgb) * 0.054; c += (texture2D(tDiffuse, vUv + dir * 4.0).rgb + texture2D(tDiffuse, vUv - dir * 4.0).rgb) * 0.0162; gl_FragColor = vec4(c, 1.0); }');
    const comp = sh({ tDiffuse: { value: null }, tBloom: { value: null }, bloom: { value: 0.4 }, vig: { value: 0.3 }, hurt: { value: 0 } }, 'uniform sampler2D tDiffuse; uniform sampler2D tBloom; uniform float bloom; uniform float vig; uniform float hurt; varying vec2 vUv; void main(){ vec2 d = vUv - 0.5; vec3 c; if (hurt > 0.01) { float k = hurt * 0.012; c = vec3(texture2D(tDiffuse, vUv + d * k).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - d * k).b); } else c = texture2D(tDiffuse, vUv).rgb; c += texture2D(tBloom, vUv).rgb * bloom; float v = smoothstep(0.85, 0.3, length(d * vec2(1.0, 0.82))); c *= mix(1.0 - vig, 1.0, v); c = mix(c, c * c * (3.0 - 2.0 * c), 0.12); gl_FragColor = vec4(c, 1.0); }');
    const scene = new T.Scene(), cam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad = new T.Mesh(new T.PlaneGeometry(2, 2), comp); quad.frustumCulled = false; scene.add(quad);
    this.post = { main, a: sm(), b: sm(), bright, blur, comp, scene, cam, quad, w: 0, h: 0 };
  }
  renderPost() {
    const P = this.post, r = this.renderer, v = this._v2 || (this._v2 = new THREE.Vector2());
    r.getDrawingBufferSize(v); const w = Math.max(1, v.x | 0), h = Math.max(1, v.y | 0), qw = Math.max(1, w >> 2), qh = Math.max(1, h >> 2);
    if (P.w !== w || P.h !== h) { P.w = w; P.h = h; P.main.setSize(w, h); P.a.setSize(qw, qh); P.b.setSize(qw, qh); }
    r.setRenderTarget(P.main); r.render(this.scene, this.camera); this.noteInfo();
    P.quad.material = P.bright; P.bright.uniforms.tDiffuse.value = P.main.texture; P.bright.uniforms.texel.value.set(1.5 / w, 1.5 / h); r.setRenderTarget(P.a); r.render(P.scene, P.cam);
    P.quad.material = P.blur; P.blur.uniforms.tDiffuse.value = P.a.texture; P.blur.uniforms.dir.value.set(1.3 / qw, 0); r.setRenderTarget(P.b); r.render(P.scene, P.cam);
    P.blur.uniforms.tDiffuse.value = P.b.texture; P.blur.uniforms.dir.value.set(0, 1.3 / qh); r.setRenderTarget(P.a); r.render(P.scene, P.cam);
    P.quad.material = P.comp; P.comp.uniforms.tDiffuse.value = P.main.texture; P.comp.uniforms.tBloom.value = P.a.texture; P.comp.uniforms.hurt.value = Math.max(0, (this.hurt || 0) - 0.2);
    r.setRenderTarget(null); r.render(P.scene, P.cam);
  }
  noteInfo() { const i = this.renderer.info.render, o = this._sceneInfo || (this._sceneInfo = {}); o.calls = i.calls; o.tris = i.triangles; }

  // ── 효과: 레이저 궤적 — 카메라를 향한 빛나는 띠 (모두 한 번에 그림) ──
  initBeams() {
    const T = THREE, n = 20, geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 12), 3).setUsage(T.DynamicDrawUsage));
    geo.setAttribute('col', new T.BufferAttribute(new Float32Array(n * 16), 4).setUsage(T.DynamicDrawUsage));
    const bv = new Float32Array(n * 8), idx = []; for (let i = 0; i < n; i++) { bv.set([0, -1, 0, 1, 1, -1, 1, 1], i * 8); const b = i * 4; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    geo.setAttribute('bv', new T.BufferAttribute(bv, 2)); geo.setIndex(idx); geo.setDrawRange(0, 0);
    const m = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
      vertexShader: 'attribute vec2 bv; attribute vec4 col; varying vec2 vB; varying vec4 vC; void main(){ vB = bv; vC = col; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec2 vB; varying vec4 vC; void main(){ float x = abs(vB.y); float core = smoothstep(0.3, 0.0, x); float glow = 1.0 - x; glow *= glow; float a = vC.a * mix(0.45, 1.0, smoothstep(0.0, 0.2, vB.x)); gl_FragColor = vec4((vC.rgb * glow + vec3(core) * 0.9) * a, 1.0); }' });
    this.beamMesh = new T.Mesh(geo, m); this.beamMesh.frustumCulled = false; this.beamMesh.renderOrder = 5; this.scene.add(this.beamMesh); this.beams = []; this.beamN = n;
  }
  addBeam(ax, ay, az, bx, by, bz, hex, w, life) {
    if (!this.beams) return; if (this.beams.length >= this.beamN) this.beams.shift();
    const c = this._bc || (this._bc = new THREE.Color()); c.setHex(hex);
    this.beams.push({ ax, ay, az, bx, by, bz, r: c.r, g: c.g, b: c.b, w, at: this.clock(), life });
  }
  updateBeams(now) {
    const B = this.beams; if (!B) return; for (let i = B.length - 1; i >= 0; i--) if (now - B[i].at > B[i].life) B.splice(i, 1);
    const geo = this.beamMesh.geometry, P = geo.attributes.position.array, C = geo.attributes.col.array, cp = this.camera.position;
    B.forEach((q, i) => { const k = (now - q.at) / q.life, dx = q.bx - q.ax, dy = q.by - q.ay, dz = q.bz - q.az, ex = cp.x - q.ax, ey = cp.y - q.ay, ez = cp.z - q.az;
      let sx = dy * ez - dz * ey, sy = dz * ex - dx * ez, sz = dx * ey - dy * ex; const sl = Math.hypot(sx, sy, sz) || 1, w = q.w * (1 + k * 0.8); sx *= w / sl; sy *= w / sl; sz *= w / sl;
      P.set([q.ax - sx, q.ay - sy, q.az - sz, q.ax + sx, q.ay + sy, q.az + sz, q.bx - sx, q.by - sy, q.bz - sz, q.bx + sx, q.by + sy, q.bz + sz], i * 12);
      const a = (1 - k) * (1 - k); for (let v = 0; v < 4; v++) C.set([q.r, q.g, q.b, a], i * 16 + v * 4); });
    geo.setDrawRange(0, B.length * 6); if (B.length) { geo.attributes.position.needsUpdate = true; geo.attributes.col.needsUpdate = true; }
    this.beamMesh.visible = B.length > 0;
  }
  // ── 효과: 입자 (불꽃 = 더하기 섞기 · 연기·먼지 = 보통 섞기). 점 하나 = 둥근 점 스프라이트, 크기는 세계 단위 ──
  initFx() {
    const T = THREE, mk = (n, add) => { const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 3), 3).setUsage(T.DynamicDrawUsage)); geo.setAttribute('col', new T.BufferAttribute(new Float32Array(n * 4), 4).setUsage(T.DynamicDrawUsage)); geo.setAttribute('size', new T.BufferAttribute(new Float32Array(n), 1).setUsage(T.DynamicDrawUsage)); geo.setDrawRange(0, 0);
      const m = new T.ShaderMaterial({ uniforms: { scale: { value: 400 } }, transparent: true, depthWrite: false, blending: add ? T.AdditiveBlending : T.NormalBlending,
        vertexShader: 'attribute vec4 col; attribute float size; uniform float scale; varying vec4 vC; void main(){ vC = col; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(size * scale / max(0.1, -mv.z), 1.0, 128.0); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'varying vec4 vC; void main(){ float r = length(gl_PointCoord - 0.5); float a = ' + (add ? 'smoothstep(0.5, 0.0, r); a *= a;' : 'smoothstep(0.5, 0.12, r);') + ' gl_FragColor = vec4(vC.rgb, vC.a * a); }' });
      const pts = new T.Points(geo, m); pts.frustumCulled = false; pts.renderOrder = add ? 6 : 4; this.scene.add(pts); return { pts, n, list: [] }; };
    this.fxA = mk(this.lit ? 260 : 120, true); this.fxS = mk(this.lit ? 90 : 40, false);
  }
  spawnP(sys, x, y, z, vx, vy, vz, life, size, grow, r, g, b, a, grav, drag) { const L = sys.list; if (L.length >= sys.n) L.shift(); L.push({ x, y, z, vx, vy, vz, t: 0, life, size, grow, r, g, b, a, grav, drag }); }
  stepFx(dt) {
    const s = Math.min(0.05, dt / 1000);
    [this.fxA, this.fxS].forEach(sys => { if (!sys) return; const L = sys.list, geo = sys.pts.geometry, P = geo.attributes.position.array, C = geo.attributes.col.array, Z = geo.attributes.size.array;
      let n = 0;
      for (let i = 0; i < L.length; i++) { const q = L[i]; q.t += s; if (q.t >= q.life) continue;
        const dr = Math.pow(q.drag, s); q.vx *= dr; q.vy = q.vy * dr - q.grav * s; q.vz *= dr; q.x += q.vx * s; q.y += q.vy * s; q.z += q.vz * s;
        if (q.y < 0.01) { q.y = 0.01; q.vy = -q.vy * 0.3; q.vx *= 0.6; q.vz *= 0.6; }
        const k = q.t / q.life; L[n] = q; P[n * 3] = q.x; P[n * 3 + 1] = q.y; P[n * 3 + 2] = q.z; C[n * 4] = q.r; C[n * 4 + 1] = q.g; C[n * 4 + 2] = q.b; C[n * 4 + 3] = q.a * (1 - k); Z[n] = q.size * (1 + q.grow * k); n++; }
      L.length = n; geo.setDrawRange(0, n); sys.pts.visible = n > 0;
      if (n) { geo.attributes.position.needsUpdate = true; geo.attributes.col.needsUpdate = true; geo.attributes.size.needsUpdate = true; } });
  }
  // ── 효과: 탄흔 (그을린 자국 + 막 맞은 곳의 뜨거운 빛) — 벽·상자·바닥에만, 오래되면 작아져 사라짐 ──
  initDecals() {
    const T = THREE, n = this.lit ? 48 : 20, geo = new T.PlaneGeometry(1, 1);
    const tex = fn => { const c = f3Cv(64), g = c.getContext('2d'); fn(g); const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t; };
    const scorch = tex(g => { const q = g.createRadialGradient(32, 32, 0, 32, 32, 31); q.addColorStop(0, 'rgba(8,6,5,0.95)'); q.addColorStop(0.3, 'rgba(20,16,12,0.75)'); q.addColorStop(0.65, 'rgba(30,24,18,0.3)'); q.addColorStop(1, 'rgba(30,24,18,0)'); g.fillStyle = q; g.fillRect(0, 0, 64, 64);
      const R = f3Rng(9); g.strokeStyle = 'rgba(12,10,8,0.55)'; g.lineWidth = 1.5; for (let i = 0; i < 8; i++) { const a = R() * 6.3, l = 12 + R() * 16; g.beginPath(); g.moveTo(32, 32); g.lineTo(32 + Math.cos(a) * l, 32 + Math.sin(a) * l); g.stroke(); } });
    const glow = tex(g => { const q = g.createRadialGradient(32, 32, 0, 32, 32, 31); q.addColorStop(0, 'rgba(255,255,255,1)'); q.addColorStop(0.25, 'rgba(255,200,120,0.9)'); q.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = q; g.fillRect(0, 0, 64, 64); });
    const mk = (map, add) => { const im = new T.InstancedMesh(geo, new T.MeshBasicMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, blending: add ? T.AdditiveBlending : T.NormalBlending }), n);
      im.count = 0; im.visible = false; im.renderOrder = add ? 3 : 1; im.instanceMatrix.setUsage(T.DynamicDrawUsage); this.scene.add(im); return im; };
    this.decS = mk(scorch, false); this.decG = mk(glow, true); this.decals = []; this.decN = n;
  }
  addDecal(x, y, z, nx, ny, nz) {   // 세계 좌표 (x · 위 · z)
    if (!this.decals) return; const T = THREE; if (this.decals.length >= this.decN) this.decals.shift();
    const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), new T.Vector3(nx, ny, nz)); q.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), Math.random() * 6.28));
    this.decals.push({ p: new T.Vector3(x + nx * 0.006, y + ny * 0.006, z + nz * 0.006), q, s: 0.1 + Math.random() * 0.06, at: this.clock() }); this._decDirty = true;
  }
  updateDecals(now) {
    const D = this.decals; if (!D || !D.length) return;
    while (D.length && now - D[0].at > 10500) { D.shift(); this._decDirty = true; }
    const young = D.length && now - D[D.length - 1].at < 700, aging = D.length && now - D[0].at > 9000;
    if (!young && !aging && !this._decDirty) return;
    this._decDirty = false; const M = this._dm || (this._dm = new THREE.Matrix4()), v = this._dv || (this._dv = new THREE.Vector3()); let ng = 0;
    D.forEach((d, i) => { const age = now - d.at, k = age > 9000 ? Math.max(0.001, 1 - (age - 9000) / 1500) : 1; M.compose(d.p, d.q, v.setScalar(d.s * k)); this.decS.setMatrixAt(i, M);
      if (age < 600) { M.compose(d.p, d.q, v.setScalar(d.s * 1.8 * (1 - age / 600) + 0.001)); this.decG.setMatrixAt(ng++, M); } });
    this.decS.count = D.length; this.decS.visible = D.length > 0; this.decS.instanceMatrix.needsUpdate = true;
    this.decG.count = ng; this.decG.visible = ng > 0; if (ng) this.decG.instanceMatrix.needsUpdate = true;
  }
  // 맞은 면의 바깥 방향 (세계 좌표 x · 위 · z) — 그림용 (판정과 무관). 상자 모양이 아니면 null (탄흔 없이 불꽃만)
  hitNormal(r, ex, ey, ez) {
    if (ez < 0.03 && r.dz < 0) return [0, 1, 0];
    const ix = ex + r.dx * 0.03, iy = ey + r.dy * 0.03, bx = ex - r.dx * 0.03, by = ey - r.dy * 0.03, bz = ez - r.dz * 0.03, c = this.cell(ix, iy), bh = F3_BOXH[c];
    if (!bh) return null;
    if (bz >= bh - 0.02) return [0, 1, 0];
    if (Math.floor(bx) !== Math.floor(ix)) return [Math.sign(bx - ix), 0, 0];
    if (Math.floor(by) !== Math.floor(iy)) return [0, 0, Math.sign(by - iy)];
    return Math.abs(r.dx) > Math.abs(r.dy) ? [-Math.sign(r.dx), 0, 0] : [0, 0, -Math.sign(r.dy)];
  }
  // 맞은 곳 효과: 병사 = 팀색 불꽃 · 벽·바닥 = 불꽃 + 먼지 + 탄흔 (지도 좌표 x, y, 높이 z)
  impact(r, ex, ey, ez, soldierHex, big) {
    if (!this.fxA) return; const lit = this.lit, nS = big ? 1.6 : 1;
    if (soldierHex != null) { const c = this._bc2 || (this._bc2 = new THREE.Color()); c.setHex(soldierHex);
      for (let i = 0; i < (lit ? 12 : 6) * nS; i++) { const w = i % 3 === 0; this.spawnP(this.fxA, ex, ez, ey, (Math.random() - 0.5) * 3 - r.dx * 1.5, Math.random() * 2.5, (Math.random() - 0.5) * 3 - r.dy * 1.5, 0.18 + Math.random() * 0.2, w ? 0.05 : 0.035, -0.5, w ? 1 : c.r, w ? 1 : c.g, w ? 1 : c.b, 1, 6, 0.05); }
      this.spawnP(this.fxA, ex, ez, ey, 0, 0, 0, 0.12, 0.35 * nS, 0.6, c.r, c.g, c.b, 0.8, 0, 1); return; }
    const n = this.hitNormal(r, ex, ey, ez), nx = n ? n[0] : -r.dx, ny = n ? n[1] : 0.3, nz = n ? n[2] : -r.dy;
    for (let i = 0; i < (lit ? 10 : 5) * nS; i++) { const sp = 1.5 + Math.random() * 3; this.spawnP(this.fxA, ex, ez, ey, nx * sp + (Math.random() - 0.5) * 2.5, ny * sp + Math.random() * 1.5, nz * sp + (Math.random() - 0.5) * 2.5, 0.15 + Math.random() * 0.25, 0.03, -0.6, 1, 0.78 + Math.random() * 0.15, 0.45, 1, 9, 0.2); }
    this.spawnP(this.fxA, ex + nx * 0.02, ez + ny * 0.02, ey + nz * 0.02, 0, 0, 0, 0.09, 0.3 * nS, 0.5, 1, 0.85, 0.6, 0.9, 0, 1);
    const fc = this._dustC || (this._dustC = new THREE.Color(this.theme && this.theme.floor ? this.theme.floor[0] : '#C9BFA6'));
    for (let i = 0; i < (lit ? 3 : 1); i++) this.spawnP(this.fxS, ex + nx * 0.05, ez + ny * 0.05, ey + nz * 0.05, nx * 0.6 + (Math.random() - 0.5) * 0.4, ny * 0.6 + 0.25 + Math.random() * 0.2, nz * 0.6 + (Math.random() - 0.5) * 0.4, 0.5 + Math.random() * 0.4, 0.12, 2.5, fc.r * 0.9, fc.g * 0.9, fc.b * 0.9, 0.4, -0.15, 0.3);
    if (n) this.addDecal(ex, ez, ey, n[0], n[1], n[2]);
  }
  // 내가 쏜 궤적 · 맞은 곳 (그림만) — 총구(1인칭 총 끝)에서 맞은 점까지
  fxShot(r, hit, ex, ey, ez) {
    if (!this.camera || !this.beams) return;
    const v = this._mv || (this._mv = new THREE.Vector3()), sn = this.weapon === 'sniper', wm = this.weaponModel;
    if (wm && wm.visible && this.zoomK < 0.5) { v.set(0, sn ? 0.03 : 0.012, sn ? -1.36 : -0.68); wm.updateMatrixWorld(true); wm.localToWorld(v); } else { v.set(0.04, -0.07, -0.4); this.camera.updateMatrixWorld(true); this.camera.localToWorld(v); }
    const col = this.team ? F3_TEAM[this.team] : 0x8FE3FF;
    this.addBeam(v.x, v.y, v.z, ex, ez, ey, col, sn ? 0.05 : 0.03, sn ? 280 : 140);
    if (hit.id) { const p = this.peers[hit.id]; this.impact(r, ex, ey, ez, p && p.team ? F3_TEAM[p.team] : 0xFFE08A, sn); }
    else if (hit.t < this.viewFar() - 0.05) this.impact(r, ex, ey, ez, null, sn);
    if (this.hq === 'high') for (let i = 0; i < (sn ? 4 : 1); i++) this.spawnP(this.fxS, v.x, v.y, v.z, (Math.random() - 0.5) * 0.2, 0.25 + Math.random() * 0.2, (Math.random() - 0.5) * 0.2, 0.7 + Math.random() * 0.5, 0.06, 4, 0.82, 0.84, 0.88, sn ? 0.22 : 0.14, -0.1, 0.4);   // 총구 연기
  }
  // 상대가 쏜 레이저 (그림만): 총구에서 총 방향으로, 처음 닿는 지형까지
  peerBeam(M, sn, hex) {
    const v = this._bv || (this._bv = new THREE.Vector3()); v.set(0, 0, F3_SK.muzzle[sn ? 's' : 'r']).applyMatrix4(M);
    if (Math.hypot(v.x - this.x, v.z - this.y) > Math.min(45, this.viewFar())) return;
    const e = M.elements; let dx = -e[8], dy = -e[9], dz = -e[10]; const l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
    const t = this.rayWorld(v.x, v.z, v.y, dx, dz, dy, 40);
    this.addBeam(v.x, v.y, v.z, v.x + dx * t, v.y + dy * t, v.z + dz * t, hex, sn ? 0.045 : 0.026, sn ? 240 : 110);
    if (t < 40 && this.lit) { const rr = this._pr2 || (this._pr2 = {}); rr.dx = dx; rr.dy = dz; rr.dz = dy; this.impact(rr, v.x + dx * t, v.z + dz * t, v.y + dy * t, null, false); }
  }

  // ── 상대 병사 (군인): 부위별 InstancedMesh — 윗몸(가까이/멀리) · 골반 · 허벅지 · 정강이 · 위팔 · 아래팔 · 라이플 · 스나이퍼 · 총구 섬광 · 발밑 고리 · 부활 빛기둥 ──
  // 모든 병사가 같은 도형·재질을 씀: 인원과 상관없이 그리기 호출은 보이는 부위 수만큼(보통 9~11번). 예전(상자 병사)은 4번 · 그 전(병사마다 메시)은 30명에 약 380번
  initSoldiers() {
    const T = THREE, MAX = 48;
    const camo = new T.CanvasTexture(f3CamoCanvas()); camo.wrapS = camo.wrapT = T.RepeatWrapping; camo.encoding = T.sRGBEncoding; this.camoTex = camo;
    const mat = f3SoldierMat(camo, this.lit), G = f3SoldierGeos();
    if (this.lit) Object.keys(G).forEach(k => { const c = G[k].attributes.color; if (c) for (let i = 0; i < c.array.length; i++) c.array[i] = Math.pow(c.array[i], 2.2); });   // 꼭짓점 색도 선형으로 (mid·high)
    const mk = (geo, n, m) => { const im = new T.InstancedMesh(geo, m || mat, n); im.instanceMatrix.setUsage(T.DynamicDrawUsage); im.frustumCulled = false;
      if (!m) { im.castShadow = this.hq === 'high'; im.receiveShadow = this.hq === 'high'; }   // high: 실시간 그림자 (내 주변)
      for (let i = 0; i < n; i++) im.setColorAt(i, new T.Color(1, 1, 1));
      if (!m) { const mul = new Float32Array(n * 3).fill(1); geo.setAttribute('iMul', new T.InstancedBufferAttribute(mul, 3)); geo.attributes.iMul.setUsage(T.DynamicDrawUsage); }
      im.count = 0; im.visible = false; this.scene.add(im); return im; };
    const K = this.sKit = { upper: mk(G.upper, MAX), upperLo: mk(G.upperLo, MAX), pelvis: mk(G.pelvis, MAX), thigh: mk(G.thigh, MAX * 2), shin: mk(G.shin, MAX * 2),
      uarm: mk(G.uarm, MAX * 2), farm: mk(G.farm, MAX * 2), rifle: mk(G.rifle, MAX), sniper: mk(G.sniper, MAX),
      flash: mk(G.flash, MAX, new T.MeshBasicMaterial({ map: (() => { const t = new T.CanvasTexture(Fps3DGame.texCanvas('flash')); t.encoding = T.sRGBEncoding; return t; })(), color: 0xFFE2A0, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })),
      ring: mk(G.ring, MAX, new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false })),
      beam: mk(G.beam, MAX, new T.MeshBasicMaterial({ map: (() => { const cv = document.createElement('canvas'); cv.width = 4; cv.height = 64; const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 64);
        gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0.9)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 64); return new T.CanvasTexture(cv); })(),
        transparent: true, opacity: 0.4, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide })) };   // 부활 빛기둥: 아래가 밝고 위로 사라짐
    K.ring.renderOrder = 1; K.beam.renderOrder = 2; K.flash.renderOrder = 3;
    this.sMeshes = Object.keys(K).map(k => K[k]);
    this.sMax = MAX;
    this._sm = { R: new T.Matrix4(), L: new T.Matrix4(), M: new T.Matrix4(), U: new T.Matrix4(), W: new T.Matrix4(), Pm: new T.Matrix4(), q: new T.Quaternion(), q2: new T.Quaternion(), e: new T.Euler(0, 0, 0, 'YXZ'), v: new T.Vector3(), v2: new T.Vector3(),
      one: new T.Vector3(1, 1, 1), down: new T.Vector3(0, -1, 0), c: new T.Color(), a: [0, 0, 0], b: [0, 0, 0], h: [0, 0, 0], ik: [0, 0, 0, 0, 0, 0], pole: [0, 0, 0] };
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
  // 재질이 같은 것끼리 한 도형으로 합쳐 그립니다 (예전: 원경 18~34개 = 그리기 18~34번). 맵이 넓으면 원경도 그만큼 멀리
  buildFarScenery(th, N) {
    const T = THREE, G = this.farScenery, cx = N / 2, cz = N / 2, K = Math.max(1, N / 44), groups = new Map();
    const add = (geo, mat, x, y, z, sy) => { if (sy) geo.scale(1, sy, 1); geo.translate(x, y, z); if (!groups.has(mat)) groups.set(mat, []); groups.get(mat).push(geo); };
    if (th.far === 'hills') {
      const hillMat = new T.MeshLambertMaterial({ color: th.night ? 0x2A3B2A : 0x9CBF7A });
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, r = (80 + (i % 3) * 10) * K;
        add(new T.SphereGeometry(14 + (i % 4) * 5, 10, 6), hillMat, cx + Math.cos(a) * r, -8, cz + Math.sin(a) * r, 0.5); }
      const bMat = new T.MeshLambertMaterial({ color: 0xD8DEE8 });
      for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2, r = 62 * K, h = 6 + (i % 4) * 4;
        add(new T.BoxGeometry(6 + (i % 3) * 3, h, 6), bMat, cx + Math.cos(a) * r, h / 2, cz + Math.sin(a) * r); }
    } else if (th.far === 'mesas') {
      const mat = new T.MeshLambertMaterial({ color: 0xB5643B }), top = new T.MeshLambertMaterial({ color: 0xD08A5A });
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + 0.2, r = (75 + (i % 3) * 12) * K, w = 14 + (i % 4) * 6, h = 8 + (i % 3) * 5, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
        add(new T.CylinderGeometry(w * 0.6, w, h, 7), mat, x, h / 2 - 1, z);
        add(new T.CylinderGeometry(w * 0.6, w * 0.62, 0.6, 7), top, x, h - 0.7, z); }
      const dune = new T.MeshLambertMaterial({ color: 0xE0B57A });
      for (let i = 0; i < 12; i++) { const a = (i + 0.5) / 12 * Math.PI * 2, r = 58 * K; add(new T.SphereGeometry(10 + (i % 3) * 4, 8, 5), dune, cx + Math.cos(a) * r, -7, cz + Math.sin(a) * r, 0.35); }
    } else if (th.far === 'city') {
      // 밤 도시: 불 켜진 창문 텍스처 빌딩 (높이만큼 창문 줄이 반복되도록 도형의 uv 를 늘림 — 텍스처 한 장)
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const g = cv.getContext('2d');
      g.fillStyle = '#141A2E'; g.fillRect(0, 0, 64, 128); for (let y = 6; y < 128; y += 10) for (let x = 6; x < 64; x += 10) { g.fillStyle = Math.random() < 0.55 ? (Math.random() < 0.3 ? '#FFD166' : '#CFE6FF') : '#1C2340'; g.fillRect(x, y, 5, 6); }
      const tex = new T.CanvasTexture(cv); tex.encoding = T.sRGBEncoding; tex.wrapS = tex.wrapT = T.RepeatWrapping;
      const bMat = new T.MeshLambertMaterial({ map: tex }), antMat = new T.MeshBasicMaterial({ color: 0xFF5C7A });
      for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2, r = (62 + (i % 4) * 9) * K, w = 5 + (i % 3) * 3, h = 12 + ((i * 7) % 5) * 7, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
        const box = new T.BoxGeometry(w, h, w), uv = box.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setY(k, uv.getY(k) * h / 12);
        add(box, bMat, x, h / 2 - 0.5, z);
        if (i % 5 === 0) add(new T.CylinderGeometry(0.15, 0.15, 5, 4), antMat, x, h + 2.5, z); }
    } else if (th.far === 'peaks') {
      const rock = new T.MeshLambertMaterial({ color: 0x8FA3BF }), snow = new T.MeshLambertMaterial({ color: 0xFFFFFF });
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, r = (85 + (i % 3) * 14) * K, h = 26 + (i % 4) * 9, w = 16 + (i % 3) * 6, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
        add(new T.ConeGeometry(w, h, 6), rock, x, h / 2 - 3, z);
        add(new T.ConeGeometry(w * 0.42, h * 0.42, 6), snow, x, h - h * 0.21 - 3, z); }
      const bank = new T.MeshLambertMaterial({ color: 0xEAF0F6 });
      for (let i = 0; i < 10; i++) { const a = (i + 0.5) / 10 * Math.PI * 2, r = 60 * K; add(new T.SphereGeometry(9 + (i % 3) * 3, 8, 5), bank, cx + Math.cos(a) * r, -6, cz + Math.sin(a) * r, 0.35); }
    }
    // 'none' 은 원경 없음 (실내)
    groups.forEach((geos, mat) => G.add(new T.Mesh(f3MergeGeos(geos), mat)));
  }

  // 소품: 드럼통 / 선인장 / 램프 / 눈사람·얼음 / 네온 간판 / 덤불 — 벽이 아닌 칸에 무작위로, 충돌 없음
  // 종류별 InstancedMesh 로 한 번에 그림 (예전: 소품 하나 = 메시 1~2개 → 그리기 14~32번). 점광원 수는 그대로(태블릿에서 무거움)
  buildDecor(th, N) {
    const T = THREE; this.props = new T.Group(); this.scene.add(this.props);
    const solid = this._props = [];   // 총알을 막는 소품 (세운 원기둥으로 어림: x, y, 반지름, 아래, 위) — 기기마다 자리가 달라도 내 화면에 보이는 대로
    const spot = () => { let x, y, tries = 0; do { x = 2 + Math.random() * (N - 4); y = 2 + Math.random() * (N - 4); tries++; } while (this.wall(x, y) && tries < 40); return [x, y]; };
    const nearWall = () => { let x, y, tries = 0; do { [x, y] = spot(); tries++; } while (!(this.wall(x + 1, y) || this.wall(x - 1, y) || this.wall(x, y + 1) || this.wall(x, y - 1)) && tries < 60); return [x, y]; };
    const inst = (geo, mat, list) => { if (!list.length) return null; const im = new T.InstancedMesh(geo, mat, list.length), m = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), s = new T.Vector3(), c = new T.Color();
      list.forEach((o, i) => { q.setFromEuler(e.set(0, o.ry || 0, 0)); m.compose(v.set(o.x, o.y, o.z), q, s.set(o.s || 1, o.sy || o.s || 1, o.s || 1)); im.setMatrixAt(i, m); if (o.c != null) im.setColorAt(i, c.setHex(o.c)); });
      im.castShadow = im.receiveShadow = this.hq === 'high'; this.props.add(im); return im; };
    const A = Math.min(4, Math.max(1, Math.pow(N / 44, 2))), n = Math.round(14 * A);   // 넓은 맵엔 소품도 더
    if (th.decor === 'barrels' || th.decor === 'lamps') {
      const pts = []; for (let i = 0; i < n; i++) { const [x, y] = nearWall(); pts.push({ x, y: 0.3, z: y }); solid.push([x, y, 0.22, 0, 0.6]); }
      inst(new T.CylinderGeometry(0.22, 0.22, 0.6, 10), this.mat({ color: 0x4E6BC2 }), pts);
      inst(new T.CylinderGeometry(0.23, 0.23, 0.06, 10), this.mat({ color: 0xD9DEE8 }), pts.map(p => ({ x: p.x, y: 0.45, z: p.z })));
      if (th.decor === 'lamps') { // 천장 램프: 노란 원판 + 빛 (빛은 4개만 — 점광원은 태블릿에서 무겁습니다)
        const lamps = []; for (let i = 0; i < Math.round(10 * A); i++) { const [x, y] = spot(); lamps.push({ x, y: 3.6, z: y });
          if (i < (this.hq === 'mid' ? 6 : 10) && i % 3 === 0) { const pt = new T.PointLight(0xFFE0A0, 0.55, 12); pt.position.set(x, 3.4, y); this.props.add(pt); } }
        inst(new T.CylinderGeometry(0.35, 0.35, 0.08, 10), new T.MeshBasicMaterial({ color: 0xFFE9A8 }), lamps); }
    } else if (th.decor === 'cactus') {
      const mat = this.mat({ color: 0x4F8A3A }), pts = []; for (let i = 0; i < n; i++) { const [x, y] = spot(); pts.push({ x, y: 0.7, z: y }); solid.push([x, y, 0.19, 0, 1.4], [x + 0.28, y, 0.12, 0.6, 1.2]); }
      inst(new T.CylinderGeometry(0.16, 0.2, 1.4, 7), mat, pts);
      inst(new T.CylinderGeometry(0.1, 0.12, 0.6, 7), mat, pts.map(p => ({ x: p.x + 0.28, y: 0.9, z: p.z })));
    } else if (th.decor === 'snow') {
      const pts = []; for (let i = 0; i < n; i++) { const [x, y] = spot(), sy = 0.9 + Math.random() * 0.6; pts.push({ x, y: 0.45, z: y, s: 1, sy }); solid.push([x, y, 0.22, 0, 0.45 + sy * 0.3]); }
      inst(new T.ConeGeometry(0.35, 1, 5), this.mat({ color: 0xBFE3FF, transparent: true, opacity: 0.85 }), pts);
    } else if (th.decor === 'neon') {
      const cols = [0xFF5C7A, 0x4CC9F0, 0xB15DFF, 0xFFD166], pts = [];
      for (let i = 0; i < Math.round(16 * A); i++) { const [x, y] = nearWall(); pts.push({ x, y: 1.9, z: y, c: cols[i % 4] });
        if (i < (this.hq === 'mid' ? 8 : 16) && i % 4 === 0) { const pl = new T.PointLight(cols[i % 4], 0.8, 9); pl.position.set(x, 1.9, y); this.props.add(pl); } }   // 간판 · 빛은 4개만
      inst(new T.BoxGeometry(0.9, 0.3, 0.06), new T.MeshBasicMaterial({ color: 0xFFFFFF }), pts);
    } else if (th.decor === 'trees') {
      const pts = []; for (let i = 0; i < n; i++) { const [x, y] = spot(), r = 0.4 + Math.random() * 0.25; pts.push({ x, y: 0.3, z: y, s: r, sy: r * 0.7 }); solid.push([x, y, r * 0.85, 0, 0.3 + r * 0.55]); }
      inst(new T.SphereGeometry(1, 7, 5), this.mat({ color: 0x3F8F4F }), pts);
    }
  }

  // 1인칭 총 재질 (두 총이 같이 씀): 총몸 금속 · 어두운 금속 · 폴리머 · 나무 · 팀 색 발광 · 렌즈 · 빨간 점
  vmMats() {
    if (this._vmm) return this._vmm; const T = THREE, team = this.team ? F3_TEAM[this.team] : 0xFFD166;
    return (this._vmm = { gm: this.mat({ color: 0x5C626C, roughness: 0.42, metalness: 0.35 }), dk: this.mat({ color: 0x1C1E22, roughness: 0.5, metalness: 0.6 }),
      poly: this.mat({ color: 0x4C5044, roughness: 0.7 }), wood: this.mat({ color: 0x6E4C30, roughness: 0.55 }),
      glow: new T.MeshBasicMaterial({ color: team }), lens: this.mat({ color: 0x0E2638, roughness: 0.08, metalness: 0.2, emissive: 0x0A3050, envMapIntensity: 1.6 }), red: new T.MeshBasicMaterial({ color: 0xFF3040 }) });
  }
  // 부품 [재질, 도형, x, y, z, rx, ry, rz] 을 재질별로 합쳐 그물 몇 개로 (총 하나 = 그리기 약 6번)
  vmBuild(g, parts) {
    const T = THREE, by = new Map();
    parts.forEach(([m, geo, x, y, z, rx, ry, rz]) => { if (rx) geo.rotateX(rx); if (ry) geo.rotateY(ry); if (rz) geo.rotateZ(rz); geo.translate(x || 0, y || 0, z || 0); if (!by.has(m)) by.set(m, []); by.get(m).push(geo); });
    by.forEach((geos, m) => g.add(new T.Mesh(f3MergeGeos(geos), m)));
  }
  // 라이플 (레이저 카빈): 윗몸통(모서리 깎음) · 레일 · 도트 조준기 · 8각 덮개(환기구 · 팀 색 발광선) · 총열 · 발광 링이 있는 레이저 발사구 · 탄창 · 손잡이 · 개머리판
  buildWeapon() {
    const T = THREE, g = new T.Group(), M = this.vmMats(), B = (w, h, d) => new T.BoxGeometry(w, h, d), Cz = (r1, r2, l, n) => new T.CylinderGeometry(r1, r2, l, n || 12), H = Math.PI / 2;
    const P = [[M.gm, B(0.07, 0.055, 0.4), 0, 0.025, 0], [M.gm, B(0.016, 0.016, 0.4), 0.035, 0.052, 0, 0, 0, Math.PI / 4], [M.gm, B(0.016, 0.016, 0.4), -0.035, 0.052, 0, 0, 0, Math.PI / 4],
      [M.poly, B(0.066, 0.05, 0.26), 0, -0.025, 0.05], [M.dk, B(0.004, 0.026, 0.075), 0.0355, 0.025, -0.02], [M.dk, B(0.026, 0.01, 0.34), 0, 0.058, -0.03], [M.gm, B(0.04, 0.012, 0.02), 0, 0.045, 0.19],
      [M.gm, B(0.028, 0.018, 0.05), 0, 0.072, 0.04], [M.gm, Cz(0.024, 0.024, 0.075, 14), 0, 0.1, 0.04, H], [M.dk, Cz(0.027, 0.027, 0.012, 14), 0, 0.1, 0.006, H], [M.lens, new T.CircleGeometry(0.02, 14), 0, 0.1, 0.0785], [M.red, new T.CircleGeometry(0.0035, 8), 0, 0.1, 0.079],
      [M.poly, Cz(0.035, 0.035, 0.3, 8), 0, 0.012, -0.35, H, 0, Math.PI / 8], [M.glow, B(0.006, 0.008, 0.25), 0.036, 0.012, -0.35], [M.glow, B(0.006, 0.008, 0.25), -0.036, 0.012, -0.35],
      [M.gm, Cz(0.013, 0.013, 0.13, 10), 0, 0.012, -0.56, H], [M.gm, Cz(0.024, 0.027, 0.07, 14), 0, 0.012, -0.64, H], [M.glow, Cz(0.0275, 0.0275, 0.012, 14), 0, 0.012, -0.613, H], [M.dk, Cz(0.018, 0.018, 0.012, 12), 0, 0.012, -0.676, H],
      [M.poly, B(0.038, 0.15, 0.07), 0, -0.115, 0, 0.18], [M.dk, B(0.044, 0.012, 0.078), 0, -0.19, 0.014, 0.18], [M.poly, B(0.034, 0.1, 0.045), 0, -0.09, 0.17, -0.32], [M.gm, B(0.008, 0.006, 0.07), 0, -0.062, 0.115],
      [M.poly, B(0.05, 0.075, 0.2), 0, -0.005, 0.32], [M.dk, B(0.054, 0.085, 0.02), 0, -0.005, 0.425]];
    for (let i = 0; i < 9; i++) P.push([M.dk, B(0.03, 0.008, 0.012), 0, 0.066, -0.17 + i * 0.033]);                       // 레일 이
    for (let i = 0; i < 3; i++) P.push([M.dk, B(0.074, 0.012, 0.03), 0, 0.012, -0.27 - i * 0.07]);                        // 덮개 환기구
    this.vmBuild(g, P);
    this.addViewArms(g, [0.02, -0.1, 0.17], [0.0, -0.045, -0.36]);                     // 장갑 낀 두 손 · 위장복 소매
    g.position.set(0.28, -0.26, -0.55); g.rotation.y = -0.06;
    return g;
  }
  // 스나이퍼: 나무 개머리판(뺨 받침) · 둥근 몸통 · 굵은 총열 · 제퇴기 · 큰 조준경(고리 · 다이얼 · 대물 렌즈) · 접은 양각대 · 팀 색 발광선 · 볼트(움직임)
  buildSniper() {
    const T = THREE, g = new T.Group(), M = this.vmMats(), B = (w, h, d) => new T.BoxGeometry(w, h, d), Cz = (r1, r2, l, n) => new T.CylinderGeometry(r1, r2, l, n || 14), H = Math.PI / 2;
    const P = [[M.wood, B(0.075, 0.1, 0.5), 0, -0.015, 0.08], [M.wood, B(0.05, 0.035, 0.16), 0, 0.05, 0.2], [M.wood, B(0.036, 0.09, 0.05), 0, -0.08, 0.2, -0.35], [M.wood, B(0.062, 0.07, 0.52), 0, -0.005, -0.42],
      [M.dk, B(0.079, 0.012, 0.5), 0, -0.068, 0.08], [M.gm, Cz(0.028, 0.028, 0.26), 0, 0.035, -0.02, H], [M.gm, Cz(0.019, 0.016, 0.62, 12), 0, 0.03, -0.95, H],
      [M.gm, B(0.05, 0.036, 0.08), 0, 0.03, -1.3], [M.dk, B(0.054, 0.01, 0.012), 0, 0.03, -1.285], [M.dk, B(0.054, 0.01, 0.012), 0, 0.03, -1.315],
      [M.dk, Cz(0.03, 0.03, 0.3, 18), 0, 0.11, -0.15, H], [M.dk, Cz(0.046, 0.031, 0.09, 18), 0, 0.11, -0.345, H], [M.dk, Cz(0.036, 0.03, 0.07, 18), 0, 0.11, 0.03, H],
      [M.gm, Cz(0.016, 0.016, 0.035, 12), 0, 0.152, -0.15], [M.gm, Cz(0.016, 0.016, 0.035, 12), 0.04, 0.11, -0.15, 0, 0, H],
      [M.gm, Cz(0.034, 0.034, 0.022, 16), 0, 0.11, -0.22, H], [M.gm, Cz(0.034, 0.034, 0.022, 16), 0, 0.11, -0.07, H], [M.gm, B(0.026, 0.045, 0.024), 0, 0.07, -0.22], [M.gm, B(0.026, 0.045, 0.024), 0, 0.07, -0.07],
      [M.lens, new T.CircleGeometry(0.027, 18), 0, 0.11, 0.0655], [M.lens, new T.CircleGeometry(0.04, 18), 0, 0.11, -0.391, 0, Math.PI],
      [M.poly, B(0.045, 0.08, 0.075), 0, -0.08, -0.06], [M.glow, B(0.006, 0.01, 0.4), 0.032, -0.005, -0.42], [M.glow, B(0.006, 0.01, 0.4), -0.032, -0.005, -0.42],
      [M.dk, Cz(0.006, 0.006, 0.3, 6), 0.02, -0.05, -0.75, H], [M.dk, Cz(0.006, 0.006, 0.3, 6), -0.02, -0.05, -0.75, H]];
    this.vmBuild(g, P);
    const bolt = new T.Group(); bolt.position.set(0.028, 0.035, -0.02);   // 볼트 손잡이 (볼트액션 때 당겨짐)
    const bh = new T.Mesh(new T.CylinderGeometry(0.009, 0.009, 0.06, 8), M.gm); bh.rotation.z = H; bh.position.x = 0.03; bolt.add(bh);
    const kb = new T.Mesh(new T.SphereGeometry(0.016, 10, 8), M.dk); kb.position.x = 0.062; bolt.add(kb); g.add(bolt);
    this.addViewArms(g, [0.02, -0.1, 0.21], [-0.01, -0.035, -0.6]);                    // 장갑 낀 두 손 · 위장복 소매
    g.position.set(0.28, -0.26, -0.55); g.rotation.y = -0.06; g.userData = { bolt };
    return g;
  }

  // 1인칭 팔: 장갑 낀 손(오른손 = 손잡이, 왼손 = 총열 덮개) + 위장복 소매(화면 아래 밖으로) + 팀 색 완장. 재질은 두 총이 같이 씀 · 재질별로 합쳐 그림
  addViewArms(g, rh, lh) {
    const T = THREE, M = this._vm || (this._vm = (() => { const tex = new T.CanvasTexture(f3CamoCanvas()); tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(4, 3); tex.encoding = T.sRGBEncoding;
      return { sleeve: this.mat({ map: tex, roughness: 0.9 }), glove: this.mat({ color: 0x2C2E31, roughness: 0.75 }), cuff: this.mat({ color: 0x24262A, roughness: 0.85 }), band: new T.MeshBasicMaterial({ color: this.team ? F3_TEAM[this.team] : 0xFFD166 }) }; })());
    const parts = new Map(), push = (m, geo) => { if (!parts.has(m)) parts.set(m, []); parts.get(m).push(geo); };
    const seg = (a, b, r0, r1, mat) => { const d = new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), l = d.length(), geo = new T.CylinderGeometry(r1, r0, l, 10);
      geo.applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()))); geo.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); push(mat, geo); };
    const box = (w, h, d, p, mat) => { const geo = new T.BoxGeometry(w, h, d); geo.translate(p[0], p[1], p[2]); push(mat, geo); };
    // 오른손: 손잡이를 감싼 손 · 손목 → 팔꿈치(오른쪽 아래 뒤, 화면 밖)
    box(0.075, 0.1, 0.1, rh, M.glove); box(0.03, 0.035, 0.07, [rh[0] - 0.045, rh[1] + 0.02, rh[2] - 0.04], M.glove);   // 손 · 엄지
    for (let i = 0; i < 3; i++) box(0.02, 0.022, 0.03, [rh[0] - 0.042, rh[1] - 0.025 - i * 0.026, rh[2] - 0.035], M.glove);   // 손가락 마디
    const rw = [rh[0] + 0.01, rh[1] - 0.04, rh[2] + 0.06], re = [rh[0] + 0.2, rh[1] - 0.36, rh[2] + 0.5];
    seg(rw, [rw[0] + 0.012, rw[1] - 0.02, rw[2] + 0.04], 0.045, 0.045, M.cuff); seg([rw[0] + 0.01, rw[1] - 0.018, rw[2] + 0.035], re, 0.05, 0.062, M.sleeve);
    seg([rw[0] + 0.05, rw[1] - 0.1, rw[2] + 0.15], [rw[0] + 0.065, rw[1] - 0.125, rw[2] + 0.19], 0.058, 0.06, M.band);   // 완장 (팀 색)
    // 왼손: 덮개 아래를 받친 손 · 손목 → 팔꿈치(왼쪽 아래, 화면 밖)
    box(0.09, 0.06, 0.11, lh, M.glove); box(0.025, 0.05, 0.08, [lh[0] + 0.05, lh[1] + 0.025, lh[2]], M.glove);           // 손바닥 · 손가락
    box(0.022, 0.04, 0.025, [lh[0] - 0.05, lh[1] + 0.02, lh[2] - 0.02], M.glove);                                          // 엄지
    const lw = [lh[0] - 0.03, lh[1] - 0.05, lh[2] + 0.06], le = [lh[0] - 0.36, lh[1] - 0.4, lh[2] + 0.42];
    seg(lw, [lw[0] - 0.02, lw[1] - 0.025, lw[2] + 0.03], 0.043, 0.043, M.cuff); seg([lw[0] - 0.018, lw[1] - 0.022, lw[2] + 0.026], le, 0.048, 0.062, M.sleeve);
    parts.forEach((geos, m) => g.add(new T.Mesh(f3MergeGeos(geos), m)));
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
    const fill = new T.Sprite(new T.SpriteMaterial({ color: 0x06D6A0, depthTest: false })); fill.scale.set(1.0, 0.05, 1); fill.position.y = -0.12; g0.add(fill);
    g0.userData = { name, team, hp: hp == null ? 100 : hp, fill, material: nameSp.material };
    this.setTagHp(g0, hp == null ? 100 : hp);
    return g0;
  }
  setTagHp(tag, hp) {
    const u = tag.userData; if (!u || !u.fill) return; const k = Math.max(0, Math.min(1, hp / 100));
    u.fill.scale.x = Math.max(0.001, 1.0 * k); u.fill.center.set(0.5 / Math.max(0.001, k), 0.5);   // 막대 왼쪽 끝을 화면 기준으로 맞춤 (보는 방향과 상관없이)
    u.fill.material.color.setHex(hp > 40 ? 0x06D6A0 : 0xFF5C7A); u.hp = hp;
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
  reload() { if (this.reloading || this.ammo === this.magSize || this.isDead) return; this.reloadUntil = this.clock() + this.wpn.reload; if (window.Sound) Sound.reload(this.wpn.reload); }
  // 무기 전환: 라이플 ↔ 스나이퍼 (전환에 0.8초, 탄약은 새 탄창)
  switchWeapon() {
    if (this.isDead || this.spectator) return;
    this.weapon = this.weapon === 'rifle' ? 'sniper' : 'rifle';
    if (this.rifleModel && this.sniperModel) { this.rifleModel.visible = this.weapon === 'rifle'; this.sniperModel.visible = this.weapon === 'sniper'; this.weaponModel = this.weapon === 'sniper' ? this.sniperModel : this.rifleModel; this.swapT = 1; }
    this.zoomed = false; this.ammo = this.magSize; this.reloadUntil = 0; this.readyUntil = this.clock() + 800;
    this.showToast(this.wpn.name + (this.weapon === 'sniper' ? ' — 🔍 줌을 당겨야 정확해요' : ''), '#FFD166');
    this.noScopeHint = this.weapon === 'sniper' ? this.clock() + 3500 : 0;
    if (window.Sound) Sound.rotate();
  }
  // 줌 토글 (스나이퍼 전용): 시야 72° → 22°, 이동 느려짐, 조준 감도 낮아짐
  toggleZoom() { if (this.weapon !== 'sniper' || this.isDead) return; this.zoomed = !this.zoomed; if (window.Sound) Sound.move(); }

  // 점프 — 땅에 있을 때만. 공중에서는 조향은 되지만 속도가 조금 줄어듭니다
  jump() {
    if (this.isDead || this.spectator || !this.onGround || this.now < this.rollUntil) return;
    this.vz = 0.115; this.onGround = false; this.zoomed = false;
    if (window.Sound) Sound.jump(); if (window.Haptic) Haptic.tap();
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
    this.showToast('회피!', '#4CC9F0'); if (window.Sound) Sound.roll(); if (window.Haptic) Haptic.good();
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
    if (this.rolling || this.mEnd) return;                 // 구르는 중 · 매칭전 판이 끝난 뒤엔 쏠 수 없습니다
    if (this.ammo <= 0) { this.reload(); return; }
    if (now - this.lastFire < this.wpn.rate) return;
    // 조준선 = 지금 화면 가운데 (카메라와 같은 위치·방향: 걸음 흔들림 · 반동으로 튄 시선 포함). 산탄만큼 살짝 흩어짐
    const base = 0.01 * this.recoil + (this.moving ? 0.012 : 0);
    let ray;
    if (this.weapon === 'sniper') {
      // 스나이퍼: 줌(스코프)을 다 당겨야 정확. 줌 없이 쏘면 화면 가운데에서 크게(최대 약 9°, 걸으면 11°) 흩어짐 — 코앞이 아니면 잘 안 맞음
      const zk = this.zoomed ? Math.min(1, this.zoomK) : 0, sc = base * 0.15 * zk;
      const ns = (1 - zk) * (F3_NOSCOPE + (this.moving ? 0.035 : 0)), r = ns * Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2;
      ray = this.viewRay(Math.cos(a) * r + (Math.random() - 0.5) * sc * 2, Math.sin(a) * r + (Math.random() - 0.5) * sc);
      if (zk < 0.5) this.noScopeHint = now + 1500;           // 줌 없이 쐈음: 잠깐 '🔍 줌' 안내
    } else ray = this.viewRay((Math.random() - 0.5) * base * 2, (Math.random() - 0.5) * base);
    this.lastFire = now; this.muzzle = 1; this.ammo--; this.protUntil = 0;   // 쏘면 무적이 바로 풀림 (무적으로 공격만 하는 꼼수 막기)
    if (this.ammo <= 0) this.reload();
    if (window.Sound) { if (this.weapon === 'sniper') { Sound.sniper(); Sound.bolt(0.32); } else Sound.rifle(); }   // 총소리 · 스나이퍼는 이어서 볼트 철컥
    // 반동: 라이플은 짧게 톡, 스나이퍼는 크게 걷어차고 볼트를 당깁니다
    if (this.weapon === 'sniper') {
      this.recoil = 1; this.kickVis = 0.13; this.pitch = Math.min(1.1, this.pitch + 0.02); this.kickRoll = (Math.random() - 0.5) * 0.08;   // 화면이 7° 확 튀었다 돌아오고, 조준은 1° 남음
      this.boltT = 1; this.muzzle = 1.6; this.flashBig = true;
      this.zoomFlinch = this.zoomed ? 1 : 0;                                                     // 줌 중이면 스코프가 잠깐 흔들려 시야가 튐
      this.shells.push({ t: 0, vx: 0.9 + Math.random() * 0.4, vy: 0.9, vz: -0.2 });          // 탄피 (볼트 당길 때 튀어나옴)
      if (window.Haptic) Haptic.big();
    } else {
      // 라이플: 한 발마다 화면이 약 2° 튀었다 돌아오고(kickVis), 조준은 0.7° 위로 · 좌우 조금(연사할수록 누적).
      // 쏘기를 멈추면 누적된 만큼 0.4초 안에 대부분 되돌아옴(아래 tick) — 학생이 매번 조준을 끌어내리지 않아도 되게
      const climb = 0.012, side = (Math.random() - 0.35) * 0.009;           // 살짝 오른쪽으로 치우친 좌우 흔들림
      this.recoil = Math.min(1, this.recoil + 0.45); this.kickVis = Math.min(0.09, (this.kickVis || 0) + 0.035);
      const before = this.pitch; this.pitch = Math.min(1.1, this.pitch + climb); this.yaw += side;
      this.sprayPitch = (this.sprayPitch || 0) + (this.pitch - before); this.sprayYaw = (this.sprayYaw || 0) + side;
      this.kickRoll += (Math.random() - 0.5) * 0.02; this.flashBig = false;
      if (window.Haptic && Haptic.tap) Haptic.tap();
      this.shells.push({ t: 0, vx: 0.6 + Math.random() * 0.3, vy: 0.5, vz: -0.1 });
    }
    // 조준선이 처음 닿는 것: 그려진 병사(부위별 상자) 또는 벽·상자·나무·바닥 — 화면에 보이는 그대로
    const hit = this.rayHit(ray);
    const ex = ray.ox + ray.dx * hit.t, ey = ray.oy + ray.dy * hit.t, ez = ray.oz + ray.dz * hit.t;
    this.tracers.push({ from: [this.x, this.y, this.eyeZ - 0.1], to: [ex, ey, ez], until: now + 80 });
    if (this.tracers.length > 6) this.tracers.shift();
    this.fxShot(ray, hit, ex, ey, ez);                          // 레이저 궤적 · 맞은 곳 불꽃 · 탄흔 (그림만)
    this.pops = this.pops || [];
    if (hit.id && hit.prot) {                                   // 부활 직후 보호 중인 상대: 피해 없음을 바로 보여 줌
      this.protMark = 1; this.pops.push({ x: ex, y: ey, z: ez + 0.2, text: '🛡 보호 중', until: now + 900 });
    } else if (hit.id) {
      const p = this.peers[hit.id], head = hit.head;
      const dmg = head ? this.wpn.dmgHead : (hit.t < 8 ? this.wpn.dmgBody : this.wpn.dmgFar);
      const left = Math.max(1, (p.hp || 0) - this.pendDmg(p) - ((this._hitQ[hit.id] && this._hitQ[hit.id].dmg) || 0));   // 숫자는 남은 체력까지만 (실제로 깎이는 만큼)
      this.pops.push({ x: ex, y: ey, z: ez + 0.2, val: Math.min(dmg, left), head: head, until: now + 800 });
      const kill = this.queueHit(hit.id, dmg, head, ex, ey);
      this.hitMarker = head ? 1.4 : 1; this.score += head ? 5 : 3;
      if (kill) this.killMark = 1;                              // 쓰러뜨릴 만큼 맞힘: 큰 X (상대 확인을 기다리지 않고 바로)
      p.flash = now + 150;
      if (window.Sound) (head ? Sound.headshot() : Sound.hitmark());   // 명중 확인음
    }
    if (this.pops.length > 12) this.pops.splice(0, this.pops.length - 12);
  }
  // 화면 가운데 조준선 (카메라와 같게): 시작점 = 눈(걸음 흔들림 · 착지 반동 포함), 방향 = 시선 + 반동으로 튄 만큼 + 산탄
  viewBobY() { return (this.moving ? Math.sin(this.bob) * 0.03 : 0) - Math.sin(Math.min(1, this.landDip || 0) * Math.PI) * 0.12; }
  viewRay(sy, sp) {
    const fl = this.zoomFlinch || 0;
    const yaw = this.yaw - Math.sin(fl * 40) * fl * 0.02 + (sy || 0), pitch = this.pitch + (this.kickVis || 0) + Math.cos(fl * 33) * fl * 0.015 + (sp || 0);
    const r = this._ray || (this._ray = {});
    r.ox = this.x; r.oy = this.y; r.oz = this.eyeZ + this.viewBobY();
    r.dx = Math.cos(yaw) * Math.cos(pitch); r.dy = Math.sin(yaw) * Math.cos(pitch); r.dz = Math.sin(pitch);
    return r;
  }
  // 조준선이 처음 닿는 것 { t: 거리, id: 병사(없으면 null), head, prot }. 판정 거리 = 병사가 그려지는 거리(안개 끝)
  rayHit(r) {
    const far = this.viewFar(), wt = this.rayWorld(r.ox, r.oy, r.oz, r.dx, r.dy, r.dz, far);
    const out = this._rh || (this._rh = {}); out.t = wt; out.id = null; out.head = false; out.prot = false;
    // 1차: 그려진 크기 그대로 · 2차: 가장자리 여유(화면 약 2.5px)를 두고 — 몸에 겹친 쪽이 늘 먼저
    for (let pass = 0; pass < 2 && !out.id; pass++) {
      let bt = wt;
      for (const id in this.peers) {
        const p = this.peers[id];
        if (p.tx == null || p.dead || (this.teamMode && p.team === this.team)) continue;   // 쓰러진 상대 · 같은 팀은 지나감
        const ddx = p.x - r.ox, ddy = p.y - r.oy, along = ddx * r.dx + ddy * r.dy;
        if (along < -1.5 || along > bt + 1.5) continue;
        if (Math.abs(ddx * r.dy - ddy * r.dx) > 2.2 + along * 0.01) continue;   // 조준선에서 멀리 떨어진 병사는 건너뜀
        const h = this.raySoldier(p, r, pass ? 0.02 + F3_PAD_PX * Math.max(1, along) : 0);
        if (h && h.t < bt) { bt = h.t; out.t = h.t; out.id = id; out.head = h.head; out.prot = !!p.prot; }
      }
    }
    return out;
  }
  viewFar() { return Math.min(70, (this.theme && this.theme.fog) ? this.theme.fog[2] : 60); }
  // 병사 자세 (그리기와 판정이 같은 값을 씀): 발 위치 · 몸 회전(앞구르기 rx · 방향 ry · 걷기 rz) · 다리 흔들림 · 오른팔
  soldierPose(p, now, o) {
    o = o || {};
    let rx = 0, rz = 0, y = p.z || 0;
    if (p.rollPlaying || p.roll) {
      // 재생 중이면 시계 기준으로만 진행 — 늦게 도착한 신호 때문에 동작이 뒤로 가지 않습니다
      const k = Math.max(0, Math.min(1, p.rollPlaying ? (now - p.rollAt) / 640 : Math.max(0, p.rollT)));   // 640ms 에 한 바퀴를 마치고 마지막은 착지 자세
      rx = k * Math.PI * 2; y += Math.sin(k * Math.PI) * 0.55;
    } else {
      rx = p.fallRx || 0;
      if (p.moving && !p.dead) { y += Math.abs(Math.sin(p.walk)) * 0.05; rz = Math.sin(p.walk) * 0.03; }
    }
    o.x = p.x; o.y = y; o.z = p.y; o.rx = rx; o.ry = -p.angle - Math.PI / 2; o.rz = rz;
    o.sw = p.moving && !p.dead ? Math.sin(p.walk) * 0.5 : 0; o.arm = -(p.pitch || 0) - (p.fire ? 0.35 : 0);
    return o;
  }
  // 조준선 vs 병사 부위 상자 (몸 기준 좌표로 옮겨 상자마다 검사). pad = 가장자리 여유
  raySoldier(p, r, pad) {
    const P = this.soldierPose(p, this.clock(), this._pose || (this._pose = {}));
    // 세계(지도 x, 높이, 지도 y) → 몸 기준: 이동 → Y 회전 반대로 → X 회전 반대로 → Z 회전 반대로 (그리기: Euler YXZ)
    const inv = (x, y, z, out, pos) => {
      if (pos) { x -= P.x; y -= P.y; z -= P.z; }
      let c = Math.cos(-P.ry), s = Math.sin(-P.ry), x1 = x * c + z * s, z1 = -x * s + z * c;
      c = Math.cos(-P.rx); s = Math.sin(-P.rx); const y2 = y * c - z1 * s, z2 = y * s + z1 * c;
      c = Math.cos(-P.rz); s = Math.sin(-P.rz); out[0] = x1 * c - y2 * s; out[1] = x1 * s + y2 * c; out[2] = z2; return out;
    };
    const o = inv(r.ox, r.oz, r.oy, this._ro || (this._ro = [0, 0, 0]), true), d = inv(r.dx, r.dz, r.dy, this._rd || (this._rd = [0, 0, 0]), false);
    let best = null;
    for (const q of F3_PARTS) {
      let ox = o[0] - q[0], oy = o[1] - q[1], oz = o[2] - q[2], dx = d[0], dy = d[1], dz = d[2];
      const a = q[6] === 2 ? P.sw : q[6] === 3 ? -P.sw : q[6] === 4 ? P.arm : 0;   // 다리 흔들림 · 팔 각도: 상자 가운데를 축으로 X 회전
      if (a) { const c = Math.cos(-a), s = Math.sin(-a), y1 = oy * c - oz * s, z1 = oy * s + oz * c, y2 = dy * c - dz * s, z2 = dy * s + dz * c; oy = y1; oz = z1; dy = y2; dz = z2; }
      let t0 = -1e9, t1 = 1e9;
      const slab = (o1, d1, h) => { h += pad; if (Math.abs(d1) < 1e-9) return Math.abs(o1) <= h; let a1 = (-h - o1) / d1, b1 = (h - o1) / d1; if (a1 > b1) { const k = a1; a1 = b1; b1 = k; } if (a1 > t0) t0 = a1; if (b1 < t1) t1 = b1; return t0 <= t1; };
      if (!slab(ox, dx, q[3]) || !slab(oy, dy, q[4]) || !slab(oz, dz, q[5]) || t1 < 0) continue;
      const t = Math.max(0, t0);
      if (!best || t < best.t) best = { t, head: q[6] === 1 };
    }
    return best;
  }
  // 지형에 처음 닿는 거리 — 그려진 모양 그대로: 벽·상자·방벽·창문벽은 상자(높이까지), 기둥·나무줄기는 원기둥, 나뭇잎은 원뿔, 바위는 타원체, 소품, 바닥
  rayWorld(ox, oy, oz, dx, dy, dz, maxT) {
    let best = maxT;
    if (dz < -1e-6) best = Math.min(best, -oz / dz);
    let cx = Math.floor(ox), cy = Math.floor(oy);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, tdx = Math.abs(dx) > 1e-9 ? Math.abs(1 / dx) : 1e9, tdy = Math.abs(dy) > 1e-9 ? Math.abs(1 / dy) : 1e9;
    let tx = Math.abs(dx) > 1e-9 ? (sx > 0 ? cx + 1 - ox : ox - cx) * tdx : 1e9, ty = Math.abs(dy) > 1e-9 ? (sy > 0 ? cy + 1 - oy : oy - cy) * tdy : 1e9, t0 = 0;
    for (let n = 0; n < 400 && t0 < best; n++) {
      const t1 = Math.min(tx, ty, best), row = this.map[cy], c = (row && row[cx]) || '#';
      if (c !== '.') { const th = this.rayCell(c, cx, cy, ox, oy, oz, dx, dy, dz, t0, t1); if (th < best) best = th; }
      if (tx < ty) { cx += sx; t0 = tx; tx += tdx; } else { cy += sy; t0 = ty; ty += tdy; }
    }
    if (this._props) for (const q of this._props) { const t = this.rayCyl(q[0], q[1], q[2], q[3], q[4], ox, oy, oz, dx, dy, dz, 0, best); if (t < best) best = t; }
    return best;
  }
  // 한 칸 안 [ta, tb] 구간에서 그 칸 구조물에 처음 닿는 거리 (없으면 1e9)
  rayCell(c, cx, cy, ox, oy, oz, dx, dy, dz, ta, tb) {
    const h = F3_BOXH[c];
    if (h) { const za = oz + dz * ta; if (za <= h && za >= -0.01) return ta; if (za > h && dz < 0) { const th = (h - oz) / dz; if (th <= tb) return th; } return 1e9; }
    const mx = cx + 0.5, my = cy + 0.5;
    if (c === 'P') return Math.min(this.rayCyl(mx, my, 0.29, 0, 2.4, ox, oy, oz, dx, dy, dz, ta, tb), this.rayCyl(mx, my, 0.46, 0, 0.2, ox, oy, oz, dx, dy, dz, ta, tb));   // 10각 기둥 ≈ 원기둥
    if (c === 'T') {
      let best = this.rayCyl(mx, my, 0.14, 0, 1.2, ox, oy, oz, dx, dy, dz, ta, tb);
      const cone = (r, z0, z1, t) => { const z = oz + dz * t; if (z < z0 || z > z1) return false; return Math.hypot(ox + dx * t - mx, oy + dy * t - my) <= r * (z1 - z) / (z1 - z0); };
      for (let t = ta; t <= Math.min(tb, best); t += 0.03) if (cone(0.86, 0.8, 2.4, t) || cone(0.62, 1.85, 3.15, t)) { best = Math.min(best, t); break; }
      return best;
    }
    if (c === 'R') {   // 바위: 눌린 다면체 ≈ 타원체 (가로 0.55·0.5, 높이 0.35), 칸마다 돌려 놓음
      const a = -((cx * 7 + cy * 3) % 6), ca = Math.cos(a), sa = Math.sin(a);
      const px = ox - mx, py = oy - my, lx = px * ca - py * sa, ly = px * sa + py * ca, vx = dx * ca - dy * sa, vy = dx * sa + dy * ca;
      const qx = lx / 0.54, qy = ly / 0.49, qz = (oz - 0.35) / 0.34, ux = vx / 0.54, uy = vy / 0.49, uz = dz / 0.34;
      const A = ux * ux + uy * uy + uz * uz, B = 2 * (qx * ux + qy * uy + qz * uz), C = qx * qx + qy * qy + qz * qz - 1, D = B * B - 4 * A * C;
      if (D < 0) return 1e9; const t = (-B - Math.sqrt(D)) / (2 * A); return t >= ta - 0.6 && t <= tb + 0.6 && t >= 0 ? t : 1e9;
    }
    return 1e9;
  }
  // 세운 원기둥 (가운데 x,y · 반지름 r · 높이 z0~z1) 에 처음 닿는 거리
  rayCyl(mx, my, r, z0, z1, ox, oy, oz, dx, dy, dz, ta, tb) {
    const px = ox - mx, py = oy - my, A = dx * dx + dy * dy, B = 2 * (px * dx + py * dy), C = px * px + py * py - r * r;
    let lo, hi;
    if (A < 1e-12) { if (C > 0) return 1e9; lo = -1e9; hi = 1e9; } else { const D = B * B - 4 * A * C; if (D < 0) return 1e9; const q = Math.sqrt(D); lo = (-B - q) / (2 * A); hi = (-B + q) / (2 * A); }
    if (Math.abs(dz) > 1e-9) { let a = (z0 - oz) / dz, b = (z1 - oz) / dz; if (a > b) { const k = a; a = b; b = k; } lo = Math.max(lo, a); hi = Math.min(hi, b); } else if (oz < z0 || oz > z1) return 1e9;
    lo = Math.max(lo, 0); if (lo > hi || lo > tb) return 1e9; return lo;
  }
  // 상대에게 보냈지만 아직 상대 체력 신호에 반영되지 않은 피해
  pendDmg(p) { let s = 0; if (p && p.pend) for (const q of p.pend) s += q[1]; return s; }
  // 명중 신호 묶기: 같은 상대에게 0.2초 안에 여러 발 맞히면 피해를 합쳐 한 번에 보냄 (연사 30명이면 신호가 폭주하던 것)
  // 첫 발은 바로 보내고, 쓰러뜨릴 만큼 쌓이면 기다리지 않고 바로 보냄 + 그 자리에서 쓰러지는 모습을 먼저 보여 줌 (돌려줌: 쓰러뜨렸는지)
  queueHit(target, dmg, head, hx, hy) {
    const now = this.clock(), h = this._hitQ[target] || (this._hitQ[target] = { dmg: 0, head: 0, n: 0, last: -1e9 }), p = this.peers[target];
    h.dmg += dmg; h.head = h.head || (head ? 1 : 0); h.n++; h.at = now; if (hx != null) { h.hx = hx; h.hy = hy; }
    const lethal = p && !p.hitKill && h.dmg >= (p.hp || 0) - this.pendDmg(p);   // 쓰러뜨릴 만큼이면 바로 (한 번만 — 상대 신호가 늦어도 계속 쏟아내지 않게)
    if (lethal) p.hitKill = true;
    if (now - h.last >= F3_HIT_GAP || lethal) this.flushHit(target, now);
    if (lethal) { p.dead = true; p.downPred = true; p.downUntil = now + 1200 + (p.iv || 200); p.downDeaths = (p.deaths || 0) + 1; }   // 확인 신호(다운·킬)가 이 시간 안에 안 오면 되돌림 (팀전 라운드 판정엔 확인 전까지 안 셈)
    return !!lethal;
  }
  flushHit(target, now) {
    const h = this._hitQ[target]; if (!h || !h.n) return;
    const p = this.peers[target];
    const pay = { dmg: h.dmg, head: h.head }; if (h.n > 1) pay.n = h.n; if (this.matchMode) pay.m = this.match;
    // 맞은 쪽이 거를 수 있게: 몇 번째 목숨에 쏜 것인지(데스 수) · 맞은 자리 · 마지막 발 뒤 지난 시간
    if (p) pay.l = p.deaths || 0; if (h.hx != null) { pay.hx = Math.round(h.hx * 10) / 10; pay.hy = Math.round(h.hy * 10) / 10; } if (now - (h.at || now) > 20) pay.a = Math.round(now - h.at);
    if (this.opts.onAttack) this.opts.onAttack('hit', target, pay);
    if (p) { (p.pend || (p.pend = [])).push([now, h.dmg]); if (p.pend.length > 12) p.pend.shift(); }   // 상대 체력 신호에 반영될 때까지 기억
    h.dmg = 0; h.head = 0; h.n = 0; h.last = now;
  }
  flushHits(now) { for (const id in this._hitQ) { const h = this._hitQ[id]; if (h.n && now - h.last >= F3_HIT_GAP) this.flushHit(id, now); } }
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
    if (this.matchMode && e.m != null && +e.m !== this.match) return;            // 다른 경기의 사건은 무시
    if (e.type === 'hit' && e.target === this.myId) {
      if (this.isDead || this.mEnd || this.spawnSafe) return;   // 부활 직후 무적: 받은 명중 무시 (쏜 쪽이 무적 신호를 아직 못 받았을 때)
      if (!this.hitOk(e)) { this.hitRejected = (this.hitRejected || 0) + 1; return; }
      this.hp = Math.max(0, this.hp - (e.dmg || 26)); this.hurt = 1;
      if (window.Haptic) Haptic.hit();
      const p = this.peers[e.by];
      if (window.Sound) Sound.hurt();
      if (p) { let da = Math.atan2(p.y - this.y, p.x - this.x) - this.yaw; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; this.dmgDir = { a: da, until: this.clock() + 900 }; }
      const who = this.nameOf(e.by);
      if (this.hp <= 0) {
        this.deaths++; this.streak = 0; this.deadUntil = this.clock() + (this.roundMode ? 1e12 : 3000); this.score = Math.max(0, this.score - 20); this.killer = who; this.killHead = !!e.head;
        this.pushFeed(who, this.myName, '#FF5C7A', !!e.head);
        if (this.opts.onAttack) this.opts.onAttack('kill', e.by, Object.assign({ victim: this.myId, head: e.head ? 1 : 0 }, this.matchMode ? { m: this.match } : {}));
        if (window.Sound) Sound.death();
      }
    }
    // 킬 소식: 쓰러진 학생을 다음 위치 신호를 기다리지 않고 바로 쓰러뜨려 보여 줌 (위치 신호보다 먼저 올 때가 많음)
    if (e.type === 'kill' && e.victim && e.victim !== this.myId) { const v = this.peers[e.victim];
      if (v && (!v.dead || v.downUntil)) { v.downDeaths = v.downUntil ? v.downDeaths : (v.deaths || 0) + 1; v.dead = true; v.downPred = false; v.downUntil = Math.max(v.downUntil || 0, this.clock() + 1500); } }
    if (e.type === 'hit') return;
    if (e.type === 'kill' && e.target === this.myId) {
      if (this.mEnd) return;
      this.kills++; this.streak++; this.score += 100 + (e.head ? 50 : 0) + (this.streak >= 3 ? 50 : 0);
      if (window.Haptic) Haptic.good();
      this.pushFeed(this.myName, this.nameOf(e.victim), '#06D6A0', !!e.head);
      this.showToast(e.head ? '🎯 헤드샷!  +150' : (this.streak >= 3 ? this.streak + '연속 킬  +150' : this.nameOf(e.victim) + ' 처치  +100'), e.head || this.streak >= 3 ? '#FFD166' : '#06D6A0');
      if (window.Sound) Sound.levelUp();
    } else if (e.type === 'kill') this.pushFeed(this.nameOf(e.by), this.nameOf(e.victim), '#9AA3B2', !!e.head);
  }
  // 받은 명중 거르기 — 쏜 사람 화면이 기준이지만, 너무 오래된 것 · 이전 목숨에 쏜 것 · 내가 그 근처에 간 적이 없는 것(불가능)만 버림
  hitOk(e) {
    if (e.l != null && +e.l !== this.deaths) return false;                       // 내가 쓰러지기 전(이전 목숨)에 쏜 것
    let age = 0;
    if (e.t && this.opts.serverNow) { age = this.opts.serverNow() - e.t + (+e.a || 0); if (age > F3_HIT_OLD) return false; }
    if (e.hx != null && this._hist && this._hist.length) {                       // 쏜 순간 근처(최근 위치 기록)에 내가 있었나 — 예측·지연 오차를 넉넉히 3칸
      const since = this.clock() - Math.max(0, age) - 400; let ok = Math.hypot(this.x - e.hx, this.y - e.hy) < 3;
      for (let i = this._hist.length - 1; i >= 0 && !ok; i -= 3) { const h = this._hist[i]; if (h[0] < since) break; ok = Math.hypot(h[1] - e.hx, h[2] - e.hy) < 3; }
      if (!ok) return false;
    }
    return true;
  }
  nameOf(id) { if (this.peers[id] && this.peers[id].name) return this.peers[id].name; if (this.opts.nameOf) return this.opts.nameOf(id) || '?'; return '?'; }
  pushFeed(a, b, color, head) { this.feed.unshift({ a, b, color, head, until: this.clock() + 5000 }); this.feed = this.feed.slice(0, 5); }
  showToast(text, color) { this.toast = { text, color, until: this.clock() + 1600 }; }

  // ── 위치 신호 ──
  // 보낸 시각(서버 시계 · 36진수)과 내 실제 속도를 함께 보냅니다. 받는 쪽은 '이 신호가 얼마나 오래된 것인지' 알고, 그만큼 속도로 앞당겨 지금 위치를 그립니다.
  // 아무것도 바뀌지 않았으면 지난번과 똑같은 글자를 돌려줘 서버가 다시 보내지 않게 합니다 (가만히 있는 학생은 신호 0)
  serialize() {
    const r = (v, k) => { const m = Math.pow(10, k), x = Math.round(v * m) / m; return x === 0 ? '0' : String(x); };
    let yaw = this.yaw % (Math.PI * 2); if (yaw > Math.PI) yaw -= Math.PI * 2; if (yaw < -Math.PI) yaw += Math.PI * 2;
    const dead = this.isDead, rt = this.rollT, still = dead || this.mEnd;
    const tm = this.teamMode || this.matchMode;
    const round = this.matchMode ? this.mRound : this.round, wins = this.matchMode ? this.mWins : this.wins;
    const head = [r(this.x, 2), r(this.y, 2), r(yaw, 2), this.hp, this.kills, this.deaths, this.team || '',
            this.muzzle > 0.5 ? 1 : 0, dead ? 1 : 0, this.moving && !still ? 1 : 0, r(this.pitch, 2),
            r(this.z, 2), rt >= 0 ? r(rt, 2) : '', tm ? round : '', tm ? wins.red : '', tm ? wins.blue : ''].join(',');
    const tail = [still ? '0' : r(this.svx || 0, 1), still ? '0' : r(this.svy || 0, 1), (this.onGround || still) ? '' : r(this.svz || 0, 1), this.matchMode ? this.match : ''].join(',') + (this.spawnSafe ? ',1' : '') + (this.weapon === 'sniper' ? (this.spawnSafe ? '' : ',') + ',s' : '');   // 끝 칸: 부활 직후 무적 · 스나이퍼 표시
    if (head === this._serHead && tail === this._serTail && this._ser) return this._ser;
    this._serHead = head; this._serTail = tail;
    const t = this.opts.serverNow ? this.opts.serverNow() : this.clock();
    this._ser = head + ',' + (Math.round(t) % F3_STAMP_WRAP).toString(36) + ',' + tail;
    return this._ser;
  }
  applyPeerRaw(id, raw, name) {
    let p = this.peers[id];
    if (p && p.raw === raw) { if (name) p.name = name; return; }          // 같은 신호 (교사 관전은 매 프레임 같은 값을 다시 넣음)
    const d = Fps3DGame.parse(raw);
    if (!isFinite(d.x) || !isFinite(d.y)) return;
    if (this.matchMode) {
      if (this.spectator && id === this.followId && d.match != null && d.match !== this.match) this.setMatch(d.match, d.team);
      if (d.match !== this.match) { if (p) this.removePeer(id); return; }   // 다른 경기 학생은 보이지도 맞지도 않음
    }
    const now = this.clock();
    if (!p) p = this.peers[id] = { x: d.x, y: d.y, z: d.z, angle: d.angle, walk: 0, cx: 0, cy: 0 };
    // 순서: 같은 기기가 보낸 더 오래된 신호면 버림
    if (d.st != null && p.st != null) { const ds = (d.st - p.st + F3_STAMP_WRAP) % F3_STAMP_WRAP; if (ds === 0 || ds > F3_STAMP_WRAP - 5000) return; }   // 5초 넘게 거꾸로면 시계가 새로 시작된 것(새로고침) → 받음
    p.raw = raw;
    // 이 신호의 나이 = 기본 지연 + 흔들림. 흔들림은 '도착 시각 - 보낸 시각' 이 가장 작았던 신호보다 얼마나 늦게 왔나로 잽니다
    let age = F3_BASE_LAT * F3_LEAD;
    if (d.st != null) {
      const off = now - d.st, keep = p.off != null && Math.abs(off - p.off) < 5000;
      p.off = keep ? Math.min(off, p.off + Math.max(0, now - (p.at || now)) * 0.002) : off;   // 시계가 천천히 어긋나도 따라가게
      const jit = Math.max(0, off - p.off);
      if (this.opts.serverNow) {   // 서버 시계를 알면 기본 지연도 직접 잼 (평균을 천천히)
        const sa = ((Math.round(this.opts.serverNow()) % F3_STAMP_WRAP) - d.st + F3_STAMP_WRAP) % F3_STAMP_WRAP;
        if (sa < 3000) { const b = Math.max(15, Math.min(300, sa - jit)); p.base = p.base == null ? b : p.base + (b - p.base) * 0.1; }
      }
      age = Math.min(600, ((p.base != null ? p.base : F3_BASE_LAT) + jit) * F3_LEAD);   // 다 앞당기지 않고 60% 만 (방향을 바꾸면 덜 튐 — 30명 모의 실험에서 가장 정확)
      p.st = d.st;
    }
    // 도착 간격(이동 평균, 멈춰 서서 안 보낸 틈은 뺌) → 보정 시간: 간격 165ms 0.1초 · 235ms 약 0.14초 (간격이 길면 한 번에 고칠 양이 커서, 같은 0.1초면 출렁임이 1.2배 — 모의 실험)
    { const iv = p.iv || this.opts.sendMs || 165; p.iv = p.at == null ? iv : (now - p.at < iv * 2.5 ? iv + (Math.max(40, now - p.at) - iv) * 0.15 : iv); p.tau = Math.max(100, Math.min(150, 100 * p.iv / 165)); }
    p.at = now;
    const shownX = p.x, shownY = p.y, had = p.tx != null, prevHp = p.hp, prevDeaths = p.deaths;
    Object.assign(p, { tx: d.x, ty: d.y, tz: d.z, vx: d.vx, vy: d.vy, vz: d.vz, sAt: now - age, tangle: d.angle, hp: d.hp, kills: d.kills, deaths: d.deaths, team: d.team, fire: d.fire, dead: d.dead, sigDead: d.dead, moving: d.moving, pitch: d.pitch, roll: d.roll, rollT: d.rollT, round: d.round, wr: d.wr, wb: d.wb, match: d.match, prot: d.prot, wpn: d.wpn });
    // 내가 보낸 피해 중 이 체력 신호에 이미 반영된 것은 지움 (줄어든 체력만큼 앞에서부터 · 1초 지나면 버림) — 남은 것 = 아직 반영 안 된 피해
    if (p.pend) { if (d.deaths !== prevDeaths) p.pend.length = 0; else { let drop = Math.max(0, (prevHp || 0) - d.hp); while (p.pend.length && p.pend[0][1] <= drop + 0.5) { drop -= p.pend[0][1]; p.pend.shift(); } }
      while (p.pend.length && now - p.pend[0][0] > 1000) p.pend.shift(); }
    // 먼저 보여 준 다운(내가 쓰러뜨림 · 킬 소식): 다운 신호가 오거나 데스 수가 늘면 확정, 그 전 신호(맞기 전에 보낸 것)로는 일어나지 않음
    if (p.downUntil) { if (d.dead || d.deaths >= p.downDeaths || now >= p.downUntil) p.downUntil = 0; else p.dead = true; }
    if (!p.downUntil) { p.hitKill = false; p.downPred = false; }
    // 보정: 새 신호로 계산한 '지금 위치' 와 화면에 있던 위치의 차이를 0.1초에 걸쳐 줄임 (순간이동처럼 튀지 않게). 3칸 넘게 차이 나면(부활 등) 바로 옮김
    const g = this.predict(p, now);
    if (had && !d.dead && Math.hypot(shownX - g.x, shownY - g.y) < 3) { p.cx = shownX - g.x; p.cy = shownY - g.y; }
    else { p.cx = 0; p.cy = 0; p.x = g.x; p.y = g.y; p.z = g.z; }
    // 판이 더 앞선 기기가 있으면 따라갑니다 (같은 판·같은 점수를 보도록)
    if (this.matchMode) { if (d.round > this.mRound) { this.mRound = d.round; this.mWins.red = Math.max(this.mWins.red, d.wr); this.mWins.blue = Math.max(this.mWins.blue, d.wb); this.beginMatchRound(now); } }
    else if (this.teamMode && d.round > this.round) { this.round = d.round; this.wins.red = Math.max(this.wins.red, d.wr); this.wins.blue = Math.max(this.wins.blue, d.wb); this.beginRound(); }
    // 구르기는 신호가 드물어도 끊기지 않도록, 받은 시점을 기록해 두고 화면에서 이어서 재생합니다
    if (d.roll && !p.rollPlaying) { p.rollPlaying = true; p.rollAt = now - d.rollT * 700 - Math.min(age, 300); }
    if (p.rollPlaying && now - (p.rollAt || 0) >= 700) p.rollPlaying = false;
    if (name) p.name = name;
  }
  // 상대의 '지금' 위치 예측: 마지막 신호 위치 + 속도 × 신호 나이 (최대 0.45초 · 구르는 중 0.12초). 벽은 뚫지 않고 미끄러짐
  predict(p, now) {
    const out = this._pr || (this._pr = { x: 0, y: 0, z: 0 });
    const a = Math.max(0, Math.min((p.roll || p.rollPlaying) ? 120 : 450, now - p.sAt)) / 1000;
    let x = p.tx, y = p.ty;
    if (!p.dead && (p.vx || p.vy) && a > 0) {
      const ex = p.vx * a, ey = p.vy * a, n = Math.min(12, Math.ceil(Math.hypot(ex, ey) / 0.25)), z0 = p.tz || 0;
      const solid = (qx, qy) => { const c = this.cell(qx, qy); return c !== '.' && (F3_HEIGHT[c] || 2.4) > z0 + 0.5; };
      for (let i = 0; i < n; i++) { const nx = x + ex / n, ny = y + ey / n; if (!solid(nx + Math.sign(ex) * 0.25, y)) x = nx; if (!solid(x, ny + Math.sign(ey) * 0.25)) y = ny; }
    }
    let z = p.tz || 0;
    if (!p.dead && p.vz) z = Math.max(this.floorAt(x, y), z + p.vz * a - 0.5 * F3_GRAV * a * a);
    out.x = x; out.y = y; out.z = z; return out;
  }
  removePeer(id) { delete this.peers[id]; delete this._hitQ[id]; const m = this.models[id]; if (m) { if (m.tag && this.scene) { this.scene.remove(m.tag); if (m.tag.userData.material && m.tag.userData.material.map) m.tag.userData.material.map.dispose(); } delete this.models[id]; } }
  setPeers(map) { Object.keys(map).forEach(id => { const d = map[id]; if (d.raw) this.applyPeerRaw(id, d.raw, d.name); }); Object.keys(this.peers).forEach(id => { if (!map[id]) this.removePeer(id); }); }
  spectate(id) { this.spectator = true; this.followId = id; }

  // 학생 화면의 화질 단계 (2 최고 · 0 최저): 해상도 배율 · 바닥 장식 · 원경 · 먼 병사 단순화
  //   학생 화면이 '느리다'며 낮추면: 무거운 효과(그림자 · 후처리 · mid 재질)가 남아 있으면 그것부터 끄고 해상도는 그대로 (그다음에 해상도)
  setQuality(q) {
    q = Math.max(0, Math.min(2, q | 0)); const prev = this.q; this.q = q;
    if (this.resQ == null || this.hqLocked || prev == null || q > prev) this.resQ = q;
    else if (q < prev && !(this._perf && this.clock() < this._perf.cool) && !this.dropStep()) this.resQ = Math.min(this.resQ, q);   // 방금 낮췄으면 해상도는 미룸 (perfTick 이 이어서)
    this.applyRes();
    if (this.decor) this.decor.visible = this.q >= 1;
    if (this.farScenery) this.farScenery.visible = this.q >= 1;
    this._w = 0;                                         // 크기 다시 맞춤
  }

  // ── 프레임 ──
  tick(now) {
    this.now = now;
    const { dt, f } = FX.frame(this, now); this.lastF = f; this._dt = dt;
    this.perfTick(now, dt);
    // 상대 위치 = 예측 위치(마지막 신호 + 속도 × 신호 나이) + 남은 보정(0.1초에 걸쳐 0 으로)
    const kz = 1 - Math.exp(-dt / 60), sa = this.smooth(0.4, f);
    for (const id in this.peers) { const p = this.peers[id]; if (p.tx == null) continue;
      const kc = 1 - Math.exp(-dt / (p.tau || 100)); p.cx -= p.cx * kc; p.cy -= p.cy * kc;   // p.tau: 신호 간격에 맞춘 보정 시간 (applyPeerRaw)
      const g = this.predict(p, now); p.x = g.x + p.cx; p.y = g.y + p.cy; p.z = p.z == null ? g.z : p.z + (g.z - p.z) * kz;
      let da = p.tangle - p.angle; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; p.angle += da * sa;
      p.walk = (p.walk || 0) + (p.moving ? 0.22 * f : 0);
      if (p.downUntil && now >= p.downUntil) { p.downUntil = 0; p.dead = p.sigDead; p.hitKill = false; p.downPred = false; this.downUndo = (this.downUndo || 0) + 1; } }   // 먼저 보여 준 다운이 확인되지 않음 → 신호대로 되돌림
    this.flushHits(now);
    this.tracers = this.tracers.filter(t => t.until > now);
    this.muzzle = Math.max(0, this.muzzle - (this.flashBig ? 0.12 : 0.2) * f); this.recoil = Math.max(0, this.recoil - (this.weapon === 'sniper' ? 0.035 : 0.06) * f);
    // 킥: 총구가 튀어 오른 만큼 시선이 올라갔다가 되돌아옵니다 (스나이퍼는 크고 느리게)
    { const k = 1 - Math.pow(1 - (this.weapon === 'sniper' ? 0.07 : 0.2), f); this.kickVis = (this.kickVis || 0) * (1 - k); this.kickRoll = (this.kickRoll || 0) * (1 - k * 0.8); }
    // 라이플 연사 반동 회복: 마지막 발사 0.22초 뒤부터 누적 반동의 대부분을 되돌림 (조준을 직접 움직인 만큼은 그대로)
    if ((this.sprayPitch || this.sprayYaw) && now - this.lastFire > 220) {
      const k = 1 - Math.pow(1 - 0.12, f), dp = this.sprayPitch * k * 0.85, dy = this.sprayYaw * k * 0.85;
      this.pitch -= dp; this.yaw -= dy; this.sprayPitch -= this.sprayPitch * k; this.sprayYaw -= this.sprayYaw * k;
      if (Math.abs(this.sprayPitch) < 0.0005) { this.sprayPitch = 0; this.sprayYaw = 0; }
    }
    if (this.zoomFlinch > 0) this.zoomFlinch = Math.max(0, this.zoomFlinch - 0.05 * f);
    if (this.boltT > 0) this.boltT = Math.max(0, this.boltT - 0.022 * f);                   // 볼트액션: 0.75초
    for (let i = this.shells.length - 1; i >= 0; i--) { const sh = this.shells[i]; sh.t += 0.05 * f; if (sh.t > 1) this.shells.splice(i, 1); }
    this.hurt = Math.max(0, this.hurt - 0.04 * f); this.hitMarker = Math.max(0, this.hitMarker - 0.08 * f);
    this.killMark = Math.max(0, (this.killMark || 0) - 0.04 * f); this.protMark = Math.max(0, (this.protMark || 0) - 0.06 * f);

    if (this.spectator) {
      const p = this.peers[this.followId];
      if (p) { this.x = p.x; this.y = p.y; this.z = p.z || 0; if (p.roll) { this.rollStart = now - p.rollT * 700; this.rollUntil = this.rollStart + 700; } else this.rollUntil = 0; this.yaw = p.angle; this.pitch = p.pitch || 0; this.hp = p.hp; this.kills = p.kills; this.deaths = p.deaths; this.team = p.team; this.myName = p.name || ''; this.deadUntil = p.dead ? now + 100 : 0; this.moving = p.moving; if (p.fire) this.muzzle = 1; }
      this.protUntil = p && p.prot ? now + 100 : 0;   // 관전: 따라가는 학생의 부활 직후 무적 표시
      if (this.matchMode) this.stepMatch(now);
      this.draw(); return;
    }
    if (this.matchMode) this.stepMatch(now); else this.stepRounds(now);
    if (this.mEnd) { this.moving = 0; this.firing = false; this.draw(); return; }      // 매칭전 판 끝: 결과 화면 (움직이지 않음)
    if (this.isDead) {
      this.aimOn = 0;
      if (!this._respawned && this.deadUntil - now < 50) { this._respawned = true; this.hp = 100; this.spawnAt(Math.floor(Math.random() * 12)); this.dmgDir = null; }
      this.draw(); return;
    }
    // 프레임이 느려(태블릿 렉) 부활 직전 50ms 를 건너뛰면 체력 0 으로 되살아나던 것 — 다운이 끝났는데 체력이 0 이면 여기서 부활
    if (this.hp <= 0 && this.deadUntil && !this.matchWinner) { this.hp = 100; this.spawnAt(Math.floor(Math.random() * 12)); this.dmgDir = null; }
    this._respawned = false;
    if (this.reloadUntil && now >= this.reloadUntil && this.ammo < this.magSize) { this.ammo = this.magSize; this.reloadUntil = 0; }

    this.yaw += this.turn * 0.05 * f;
    const px = this.x, py = this.y;
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
    if (this.z <= floor) { if (!this.onGround && this.vz < -0.03) { this.landDip = Math.min(0.35, -this.vz * 2.2); if (window.Sound) Sound.land(-this.vz * 3); } this.z = floor; this.vz = 0; this.onGround = true; }
    else this.onGround = false;
    // 내 실제 속도(칸/초) — 위치 신호에 실어 보내 다른 기기가 지금 위치를 예측하게 함 (벽에 막히면 0)
    if (dt > 0) { const ds = dt / 1000; let vx = (this.x - px) / ds, vy = (this.y - py) / ds; if (Math.hypot(vx, vy) > 25) { vx = 0; vy = 0; }
      this.svx = (this.svx || 0) + (vx - (this.svx || 0)) * 0.6; this.svy = (this.svy || 0) + (vy - (this.svy || 0)) * 0.6;
      if (Math.abs(this.svx) < 0.05) this.svx = 0; if (Math.abs(this.svy) < 0.05) this.svy = 0; }
    this.svz = this.onGround ? 0 : this.vz * 59.9;
    this.updateFov();
    if (this.firing) this.shoot();
    // 내 위치 기록 (0.05초마다 1.6초) — 받은 명중이 '그때 내가 있던 곳' 근처인지 확인용
    const hs = this._hist || (this._hist = []); if (!hs.length || now - hs[hs.length - 1][0] >= 50) { hs.push([now, this.x, this.y]); if (hs.length > 32) hs.shift(); }
    // 조준점 색: 지금 쏘면 맞는 상대 위면 빨강 · 보호 중인 상대면 하늘색 (판정과 같은 계산)
    // 스나이퍼는 줌 없이는 조준점·표적 표시가 없습니다 (줌을 당겨야 스코프 가운데가 빨갛게)
    if (this.weapon === 'sniper' && !this.zoomed) this.aimOn = 0;
    else { const h = this.rayHit(this.viewRay(0, 0)); this.aimOn = h.id ? (h.prot ? 2 : 1) : 0; }
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
  get roundMode() { if (!this.teamMode || this.matchMode) return false; const c = this.teamCounts(); return c.red.total > 0 && c.blue.total > 0; }
  teamCounts() {
    const c = { red: { total: 0, alive: 0 }, blue: { total: 0, alive: 0 } };
    const add = (team, dead) => { if (!c[team]) return; c[team].total++; if (!dead) c[team].alive++; };
    if (!this.spectator) add(this.team, this.isDead);
    Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (p.team) add(p.team, !!p.dead && !p.downPred); });   // 내가 먼저 보여 준 다운(확인 전)은 살아 있는 것으로
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

  // ── 매칭전: 먼저 목표 킬에 닿거나 3분이 지나면 판 끝 → 9초 결과 → 같은 경기에서 다음 판 ──
  matchKills() {
    const k = { red: 0, blue: 0 }; if (!this.spectator && k[this.team] != null) k[this.team] += this.kills;
    for (const id in this.peers) { const p = this.peers[id]; if ((p.round || 1) === this.mRound && k[p.team] != null) k[p.team] += p.kills || 0; }
    return k;
  }
  matchRows() {
    const rows = []; if (!this.spectator) rows.push({ name: this.myName || '나', team: this.team, k: this.kills, d: this.deaths, me: true });
    for (const id in this.peers) { const p = this.peers[id]; rows.push({ name: p.name || '학생', team: p.team, k: (p.round || 1) === this.mRound ? (p.kills || 0) : 0, d: (p.round || 1) === this.mRound ? (p.deaths || 0) : 0, me: this.spectator && id === this.followId }); }
    return rows.sort((a, b) => (b.k - a.k) || (a.d - b.d));
  }
  stepMatch(now) {
    if (this.mStart == null) {   // 첫 판 시작: 공통 출발 시각(서버 시계) 기준 → 늦게 들어와도 남은 시간이 모두 같음
      const sn = this.opts.serverNow, st = +this.opts.seed || 0;
      this.mStart = (sn && st) ? now + Math.min(10000, st - sn()) : now + (this.opts.countdown || 0) * 1000;
    }
    if (this.mEnd) { if (now - this.mEnd.at > F3_MATCH_REST) { this.mRound++; this.beginMatchRound(now); } return; }
    if (now < this.mStart) return;
    const k = this.matchKills(), goal = F3_MATCH_GOAL[this.vs] || 7;
    if (k.red >= goal || k.blue >= goal || now - this.mStart >= F3_MATCH_TIME) {
      const w = k.red > k.blue ? 'red' : (k.blue > k.red ? 'blue' : null);
      if (w) this.mWins[w]++;
      this.mEnd = { winner: w, red: k.red, blue: k.blue, at: now, rows: this.matchRows() };
      if (!this.spectator && w && w === this.team) this.score += 200;
      if (window.Sound && !this.spectator) (w === this.team ? Sound.levelUp() : Sound.gameOver && Sound.gameOver());
    }
  }
  beginMatchRound(now) {
    this.mEnd = null; this.mStart = now; this.kills = 0; this.deaths = 0; this.streak = 0;
    this.hp = 100; this.deadUntil = 0; this.dmgDir = null; this.ammo = this.magSize; this.reloadUntil = 0; this.zoomed = false;
    if (!this.spectator) this.spawnAt(this.opts.slot || 0, true);
    this.showToast('경기 ' + (this.match + 1) + ' · ' + this.mRound + '판 시작!  레드 ' + this.mWins.red + ' : ' + this.mWins.blue + ' 블루', '#FFD166');
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
    if (!this.scene || this._dead) return;
    this.updateModels();
    if (this.noGL || !this.renderer) return;
    const T = THREE, now = this.clock();
    const W = this.canvas.clientWidth || 300, H = this.canvas.clientHeight || 300;
    if (this._w !== W || this._h !== H) { this._w = W; this._h = H; this.renderer.setSize(W, H, false); this.camera.aspect = W / H; this.camera.updateProjectionMatrix(); this._dbH = H * this.renderer.getPixelRatio();
      const dpr = Math.min(1.5, window.devicePixelRatio || 1); this.hud.width = Math.round(W * dpr); this.hud.height = Math.round(H * dpr); this.hctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // 글자판을 3D 화면과 같은 자리·크기로 (교사 관전처럼 화면이 틀보다 좁으면 예전엔 틀 전체로 늘어나 찌그러짐)
      const hs = this.hud.style; hs.left = this.canvas.offsetLeft + 'px'; hs.top = this.canvas.offsetTop + 'px'; hs.width = W + 'px'; hs.height = H + 'px'; hs.right = 'auto'; hs.bottom = 'auto'; }
    // 카메라
    this.landDip = Math.max(0, (this.landDip || 0) - 0.03 * (this.lastF || 1));
    const bobY = this.viewBobY();                         // 명중 판정의 조준선도 같은 높이에서 출발
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
    const kickZ = this.recoil * (sn ? 0.16 : 0.1), kickY = this.recoil * (sn ? 0.05 : 0.022);   // 라이플도 총이 뒤로·위로 밀림
    // 숨쉬기(서 있을 때) · 옆걸음 기울기 · 점프 중 총이 살짝 뜨고 착지 때 내려앉음
    const idle = !this.moving ? Math.sin(now * 0.0017) : 0, lf = this.lastF || 1;
    this.vmTilt = (this.vmTilt || 0) + ((-(this.mx || 0) * 0.07) - (this.vmTilt || 0)) * this.smooth(0.12, lf);
    this.vmAir = (this.vmAir || 0) + ((this.onGround ? 0 : Math.max(-0.035, Math.min(0.035, -(this.vz || 0) * 0.35))) - (this.vmAir || 0)) * this.smooth(0.2, lf);
    const land = Math.sin(Math.min(1, this.landDip || 0) * Math.PI) * 0.035;
    this.weaponModel.position.set(0.28 + bobX - this.swayX * 0.6 + bk * 0.05, -0.26 - rel + bobY2 + kickY + this.swayY * 0.4 - bk * 0.06 + idle * 0.0035 + this.vmAir - land, -0.55 + kickZ + bk * 0.05);
    this.weaponModel.rotation.x = -rel * 1.5 + this.recoil * (sn ? 0.22 : 0.16) + this.swayY * 0.5 - bk * 0.12 + idle * 0.006;
    this.weaponModel.rotation.z = this.recoil * (sn ? 0.06 : 0.02) + bk * 0.28 + this.vmTilt;
    this.weaponModel.rotation.y = -0.06 - this.swayX * 0.5 + bk * 0.15;
    this.weaponModel.visible = !this.spectator && !this.isDead && this.zoomK < 0.5;
    if (this.rifleModel && this.rifleModel !== this.weaponModel) this.rifleModel.visible = false; if (this.sniperModel && this.sniperModel !== this.weaponModel) this.sniperModel.visible = false;
    // 볼트 손잡이 애니메이션 (스나이퍼 모델에만 있음)
    if (this.weaponModel.userData && this.weaponModel.userData.bolt) { const b = this.weaponModel.userData.bolt; b.position.z = -0.02 + bk * 0.12; b.rotation.z = bk * 1.2; }
    this.flash.visible = this.muzzle > 0.15; this.flash.material.opacity = Math.min(1, this.muzzle) * (this.lit ? 0.6 : 1);   // mid·high: 톤 매핑 · 블룸이 더해지므로 조금 옅게 this.flash.scale.setScalar((0.25 + this.muzzle * 0.25) * (this.flashBig ? 1.9 : 1));
    if (this.mzLight) this.mzLight.intensity = (this.muzzle > 0.05 && !this.spectator && !this.isDead) ? this.muzzle * (this.flashBig ? 2.6 : 1.5) : 0;   // high: 총구 섬광 빛
    // 탄피: 오른쪽으로 튀어 나가 떨어짐 (인스턴스 하나)
    if (this.shellMesh) { const sm = this.shellMesh, M = this._shM || (this._shM = new T.Matrix4()), e = this._shE || (this._shE = new T.Euler()), q = this._shQ || (this._shQ = new T.Quaternion()), v = this._shV || (this._shV = new T.Vector3()), one = this._sh1 || (this._sh1 = new T.Vector3(1, 1, 1));
      let n = 0; for (let i = 0; i < Math.min(6, this.shells.length); i++) { const sh = this.shells[i], tt = sh.t; v.set(0.32 + sh.vx * tt * 0.5, -0.2 + sh.vy * tt - 2.2 * tt * tt, -0.5 + sh.vz * tt); q.setFromEuler(e.set(tt * 12, 0, tt * 9)); sm.setMatrixAt(n++, M.compose(v, q, one)); }
      sm.count = n; sm.visible = n > 0; if (n) sm.instanceMatrix.needsUpdate = true; }
    // 하늘은 카메라를 따라다님 · high: 그림자 범위가 나를 따라다님 (그림자 칸에 맞춰 옮겨 가장자리가 떨리지 않게)
    if (this.sky) this.sky.position.copy(this.camera.position);
    if (this.sun && this.sun.castShadow) { const ts = 40 / 2048, px = Math.round(this.x / ts) * ts, pz = Math.round(this.y / ts) * ts; this.sun.position.set(px + F3_SUN[0] * 60, F3_SUN[1] * 60, pz + F3_SUN[2] * 60); this.sun.target.position.set(px, 0, pz); this.sun.target.updateMatrixWorld(); }
    // 효과: 레이저 궤적 · 입자 · 탄흔
    if (this.beams) this.updateBeams(now);
    if (this.fxA) { const sc = (this._dbH || 600) / (2 * Math.tan(this.camera.fov * Math.PI / 360)); this.fxA.pts.material.uniforms.scale.value = sc; this.fxS.pts.material.uniforms.scale.value = sc; this.stepFx(this._dt || 0); this._dt = 0; }
    if (this.decals) this.updateDecals(now);
    if (this.post && this.fx && this.fx.post) this.renderPost();
    else { this.renderer.render(this.scene, this.camera); this.noteInfo(); }
    this.drawHud(this.hctx, W, H, now);
  }

  // 상대 병사 갱신: 위치·방향은 보간된 값(soldierPose — 명중 판정과 같은 값) 그대로, 그 위에 팔다리·총 자세를 계산해 부위별 칸을 채움 (새 메시를 만들지 않음)
  //   걷기/달리기: 발이 판정 다리처럼 앞뒤로 (두 마디 IK 로 발바닥을 땅에) · 속도에 비례해 보폭·발 들기·앞으로 기울기
  //   서 있으면 숨쉬기 · 조준 방향(위아래)으로 윗몸·총 · 쏠 때 반동·섬광 · 맞으면 움찔 · 쓰러지면 뒤로 넘어짐 · 부활하면 빛기둥(무적 동안)
  updateModels() {
    const K = this.sKit; if (!K) return;
    const now = this.clock(), S = this._sm, SK = F3_SK, far = Math.min(70, (this.theme && this.theme.fog) ? this.theme.fog[2] : 60);   // 안개 끝까지 보임
    // 멀리 있는 병사는 단순한 윗몸 (화질 낮음 = 모두 단순). 스코프로 당겨 보면 그만큼 가까이 보는 것으로
    const zf = this.camera ? Math.tan(this.camera.fov * Math.PI / 360) / Math.tan(36 * Math.PI / 180) : 1, lodD = [0, 14, 24][this.q == null ? 2 : this.q];
    let i = 0, nHi = 0, nLo = 0, nR = 0, nS = 0, nF = 0, nG = 0, nB = 0;
    const put = (m, k, M, mul) => { m.setMatrixAt(k, M); m.setColorAt(k, S.c); if (mul) m.geometry.attributes.iMul.setXYZ(k, mul[0], mul[1], mul[2]); };
    const xf = (M, x, y, z, out) => { S.v2.set(x, y, z).applyMatrix4(M); out[0] = S.v2.x; out[1] = S.v2.y; out[2] = S.v2.z; return out; };
    for (const id in this.peers) {
      const p = this.peers[id], u = this.models[id] || (this.models[id] = {});
      const hide = (this.spectator && id === this.followId) || p.tx == null || i >= this.sMax || Math.hypot(p.x - this.x, p.y - this.y) > far;
      // 이름표 (같은 팀만 · 다른 기기에서 체력이 바뀔 때만 막대 갱신)
      const wantTag = !hide && !p.dead && this.teamMode && p.team === this.team;
      if (wantTag && (!u.tag || u.tag.userData.name !== p.name)) { if (u.tag) { this.scene.remove(u.tag); if (u.tag.userData.material && u.tag.userData.material.map) u.tag.userData.material.map.dispose(); } u.tag = this.makeTag(p.name || '', p.team, p.hp); this.scene.add(u.tag); }
      if (u.tag) { u.tag.visible = wantTag; if (wantTag) { if (u.tag.userData.hp !== p.hp) this.setTagHp(u.tag, p.hp || 0); u.tag.position.set(p.x, (p.z || 0) + 2.0, p.y); } }
      if (hide) continue;
      if (p.rollPlaying && now - (p.rollAt || 0) >= 700) { p.rollPlaying = false; p.roll = false; p.rollT = -1; }   // 재생이 끝나면 정리
      // 다운: 판정용 몸 회전(fallRx)은 예전처럼 — 쓰러진 병사는 판정이 없으므로 그림은 따로 '뒤로 넘어짐'
      if (p.rollPlaying || p.roll) p.fallRx = 0; else p.fallRx = (p.fallRx || 0) + ((p.dead ? -Math.PI / 2 : 0) - (p.fallRx || 0)) * 0.2;
      if (u.team !== p.team || u.col == null) { u.team = p.team; u.col = p.team ? F3_TEAM[p.team] : f3PlayerCol(id); u.cl = new THREE.Color(u.col); if (this.lit) u.cl.convertSRGBToLinear(); }
      S.c.copy(u.cl);
      // 발밑 고리 (팀 색 · 개인전은 학생 색) · 부활 직후 빛기둥
      if (!p.dead) { S.M.makeTranslation(p.x, (p.z || 0) + 0.025, p.y); put(K.ring, nG++, S.M); }
      if (p.prot && !p.dead) { const k = 0.85 + 0.15 * Math.sin(now * 0.02); S.M.makeScale(k, 1, k).setPosition(p.x, p.z || 0, p.y); put(K.beam, nB++, S.M); }
      if (p.prot && !p.dead && Math.floor(now / 110) % 2) continue;   // 부활 직후 무적: 깜빡임 (아래에서 하늘색으로도 칠함)
      const P = this.soldierPose(p, now, S.pose || (S.pose = {}));
      if (p.dead) { if (!u.deadAt) u.deadAt = now; } else u.deadAt = 0;
      // 쓰러짐 (0.8초): 무릎이 꺾이며 주저앉고(앞 35%) → 허리를 축으로 뒤로 넘어가 등을 대고 누움 (무릎은 세운 채)
      const dk = u.deadAt ? Math.min(1, (now - u.deadAt) / 800) : 0, kneel = Math.min(1, dk / 0.35), fall = Math.max(0, Math.min(1, (dk - 0.15) / 0.7)), fe = fall * fall * (3 - 2 * fall);
      if (u.deadAt) { S.e.set(0, P.ry, 0, 'YXZ'); S.q.setFromEuler(S.e); S.R.compose(S.v.set(P.x, P.y, P.z), S.q, S.one);
        S.e.set(fe * 1.52, 0, fe * 0.12, 'YXZ'); S.q2.setFromEuler(S.e); S.v.set(0, -SK.waist, 0).applyQuaternion(S.q2); S.v.y += SK.waist - kneel * kneel * 0.3 - fe * 0.42; S.Pm.compose(S.v, S.q2, S.one); }
      else { S.e.set(P.rx, P.ry, P.rz, 'YXZ'); S.q.setFromEuler(S.e); S.R.compose(S.v.set(P.x, P.y, P.z), S.q, S.one); S.Pm.identity(); }   // 판정과 같은 몸 변환
      // 색: 피격 순간 하얗게 · 무적 하늘색
      const hitFl = p.flash && now < p.flash, mul = S.mul || (S.mul = [1, 1, 1]);
      if (hitFl) mul[0] = mul[1] = mul[2] = 2.3; else if (p.prot && !p.dead) { mul[0] = 0.75; mul[1] = 1.55; mul[2] = 1.9; } else mul[0] = mul[1] = mul[2] = 1;
      // 그림자 칸(굽힌 해 그림자)에 들어가면 어둡게 — 벽 그림자 속 병사가 혼자 밝게 뜨지 않게 (부드럽게 바뀜)
      { const b = this.bake, kd = this.theme && this.theme.night ? 0.8 : 0.6; let sh = 1; if (b) { const px = Math.max(0, Math.min(b.W - 1, Math.floor(p.x * b.s))), py = Math.max(0, Math.min(b.W - 1, Math.floor(p.y * b.s))); sh = kd + (1 - kd) * b.lit[py * b.W + px]; }
        u.sh = u.sh == null ? sh : u.sh + (sh - u.sh) * 0.15; if (!hitFl) { mul[0] *= u.sh; mul[1] *= u.sh; mul[2] *= u.sh; } }
      // 움찔: 체력이 줄었거나 내가 맞혔을 때 0.26초
      if ((u.hp != null && p.hp < u.hp) || (p.flash && p.flash !== u.flSeen)) { u.flAt = now; u.flSide = Math.random() < 0.5 ? -1 : 1; u.flSeen = p.flash; } u.hp = p.hp;
      const ft = u.flAt ? (now - u.flAt) / 260 : 1, fl = ft < 1 && !p.dead ? Math.sin(ft * Math.PI) : 0;
      // 속도 (신호의 실제 속도 · 칸/초 — 최고 약 5.7) → 걸음 크기
      const spd = Math.hypot(p.vx || 0, p.vy || 0), mv = p.moving && !p.dead && !(p.roll || p.rollPlaying);
      const kt = mv ? (spd > 0.3 ? Math.max(0.35, Math.min(1, spd / 5.5)) : 0.75) : 0; u.kk = (u.kk || 0) + (kt - (u.kk || 0)) * 0.15; const kk = u.kk;
      const ph = p.walk || 0, bounce = mv ? Math.abs(Math.sin(ph)) * 0.05 : 0, air = !p.dead && p.vz && !(p.roll || p.rollPlaying);
      // 윗몸: 허리를 축으로 (조준 위아래의 20% · 달릴 때 앞으로 · 움찔하면 뒤로) + 숨쉬기
      const aim = p.dead ? 0 : Math.max(-0.9, Math.min(0.9, p.pitch || 0));
      const tilt = aim * 0.2 - kk * 0.13 + fl * 0.17, tw = fl * 0.2 * (u.flSide || 1), br = (!mv && !p.dead) ? Math.sin(now * 0.0021 + (u.col & 255)) * 0.006 : 0;
      if (u.deadAt) S.U.copy(S.Pm);
      else { S.e.set(tilt, tw, 0, 'YXZ'); S.q2.setFromEuler(S.e); S.v.set(0, -SK.waist + br, 0).applyQuaternion(S.q2); S.v.y += SK.waist; S.U.compose(S.v, S.q2, S.one); }
      // 총: 개머리판을 오른쪽 어깨에 대고 조준 방향으로. 걷는 중(안 쏠 때)은 총구를 조금 내림 · 쏠 때 반동
      if (p.fire && !u.fw) u.kickAt = now; u.fw = p.fire;
      const sn = p.wpn === 's', kt0 = u.kickAt ? now - u.kickAt : 1e9;
      const kick = sn ? (kt0 < 600 ? Math.exp(-kt0 / 110) : 0) : (p.fire ? 1 - (kt0 % 105) / 105 : 0);
      if (!u.deadAt) {
        const ready = (mv && !p.fire) ? 0.3 * kk : 0, wp = aim * 0.8 - ready + kick * (sn ? 0.2 : 0.07) + fl * 0.15, sway = mv ? Math.sin(ph) * 0.03 * kk : 0;
        S.e.set(wp, 0.07 + sway, 0, 'YXZ'); S.q.setFromEuler(S.e); S.v.set(0, 0, kick * (sn ? 0.07 : 0.035)).applyQuaternion(S.q); S.v.x += SK.butt[0]; S.v.y += SK.butt[1]; S.v.z += SK.butt[2];
      } else { S.e.set(1.45 * fe, 0, 0.55 * fe, 'ZXY'); S.q.setFromEuler(S.e); S.v.set(SK.butt[0] + 0.24 * fe, SK.butt[1] - 0.22 * fe, SK.butt[2] + 0.13 * fe); }   // 쓰러지면 총이 몸 오른쪽 바닥으로
      S.L.compose(S.v, S.q, S.one); S.W.multiplyMatrices(S.U, S.L);
      const gp = SK.grip[sn ? 's' : 'r'];
      // 팔: 어깨 → 손 (두 마디 IK). 오른손은 손잡이, 왼손은 총열 덮개 (쓰러지면 왼팔은 늘어짐)
      for (let s = -1; s <= 1; s += 2) {
        const sh = xf(S.U, s * SK.shX, SK.shY, 0, S.a);
        const hd = (s < 0 && u.deadAt) ? xf(S.U, -0.42, 1.02, -0.1, S.h) : xf(S.W, gp[s > 0 ? 0 : 1][0], gp[s > 0 ? 0 : 1][1], gp[s > 0 ? 0 : 1][2], S.h);
        S.pole[0] = s * 0.8; S.pole[1] = -0.6; S.pole[2] = s > 0 ? 0.2 : 0.05;
        const e = f3IK(sh, hd, SK.uarm, SK.farm, S.pole, S.ik), k = i * 2 + (s > 0 ? 1 : 0);
        f3SegM(S.L, sh[0], sh[1], sh[2], e[0], e[1], e[2], S); put(K.uarm, k, S.M.multiplyMatrices(S.R, S.L), mul);
        f3SegM(S.L, e[0], e[1], e[2], e[3], e[4], e[5], S); put(K.farm, k, S.M.multiplyMatrices(S.R, S.L), mul);
      }
      // 다리: 엉덩이 → 발바닥 (두 마디 IK, 무릎은 앞으로). 발 앞뒤 위치는 판정 다리 흔들림(sin(walk))과 같은 박자
      for (let s = -1; s <= 1; s += 2) {
        const phs = ph + (s > 0 ? Math.PI : 0), stride = 0.07 + 0.17 * kk;
        let fx = s * 0.115, fy = -bounce + (mv ? Math.max(0, Math.cos(phs)) * (0.04 + 0.1 * kk) : 0), fz = mv ? -stride * Math.sin(phs) : (s > 0 ? 0.04 : -0.04);
        if (air) { fy += s > 0 ? 0.22 : 0.12; fz += s > 0 ? 0.08 : -0.06; }
        if (u.deadAt) { fx = s * (0.13 + 0.05 * fe); fy = 0.0; fz = (s > 0 ? -0.06 : 0.02) - 0.12 * kneel - 0.18 * fe; }   // 발은 땅에 · 엉덩이 쪽으로 끌려옴 (무릎이 섬)
        xf(S.Pm, s * SK.hipX, SK.hipY, 0, S.a); S.h[0] = fx; S.h[1] = fy; S.h[2] = fz;
        S.pole[0] = s * 0.12; S.pole[1] = u.deadAt ? 0.6 : 0; S.pole[2] = -1;
        const e = f3IK(S.a, S.h, SK.thigh, SK.shin, S.pole, S.ik), k = i * 2 + (s > 0 ? 1 : 0);
        f3SegM(S.L, S.a[0], S.a[1], S.a[2], e[0], e[1], e[2], S); put(K.thigh, k, S.M.multiplyMatrices(S.R, S.L), mul);
        f3SegM(S.L, e[0], e[1], e[2], e[3], e[4], e[5], S); put(K.shin, k, S.M.multiplyMatrices(S.R, S.L), mul);
      }
      put(K.pelvis, i, u.deadAt ? S.M.multiplyMatrices(S.R, S.Pm) : S.R, mul);
      S.M.multiplyMatrices(S.R, S.U);
      const lo = this.q === 0 || Math.hypot(p.x - this.x, p.y - this.y) * zf > lodD;
      if (lo) put(K.upperLo, nLo++, S.M, mul); else put(K.upper, nHi++, S.M, mul);
      S.M.multiplyMatrices(S.R, S.W);
      if (sn) put(K.sniper, nS++, S.M, mul); else put(K.rifle, nR++, S.M, mul);
      // 레이저 궤적 (그림만): 라이플은 연사 박자마다 · 스나이퍼는 쏜 순간 한 번
      if (!u.deadAt && this.beams) { const cyc = sn ? (kt0 < 70 ? u.kickAt : 0) : (p.fire ? u.kickAt + Math.floor(kt0 / 105) * 0.001 : 0); if (cyc && cyc !== u.beamCyc) { u.beamCyc = cyc; this.peerBeam(S.M, sn, u.col); } }
      // 총구 섬광: 라이플은 연사 박자마다, 스나이퍼는 쏜 순간
      if (!u.deadAt && (sn ? kt0 < 70 : (p.fire && kt0 % 105 < 45))) {
        S.L.makeRotationZ(Math.random() * 3).scale(S.v.setScalar(0.8 + Math.random() * 0.5)).setPosition(0, 0, SK.muzzle[sn ? 's' : 'r']);
        S.c.setRGB(1, 1, 1); put(K.flash, nF++, S.M.multiply(S.L));
      }
      i++;
    }
    const fin = (m, n) => { m.count = n; m.visible = n > 0; if (!n) return; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; const a = m.geometry.attributes.iMul; if (a) a.needsUpdate = true; };
    fin(K.pelvis, i); fin(K.thigh, i * 2); fin(K.shin, i * 2); fin(K.uarm, i * 2); fin(K.farm, i * 2);
    fin(K.upper, nHi); fin(K.upperLo, nLo); fin(K.rifle, nR); fin(K.sniper, nS); fin(K.flash, nF); fin(K.ring, nG); fin(K.beam, nB);
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
        ctx.fillStyle = p.text ? '#7FE7FF' : p.head ? '#FFD166' : '#FFFFFF'; ctx.fillText(p.text || ((p.head ? '🎯 ' : '') + '-' + p.val), sx, sy);
        ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.textAlign = 'left';
      });
    }

    // 나침반 띠 (위쪽)
    {
      const cw = Math.min(260, W * 0.6), cx0 = W / 2 - cw / 2, cy0 = this.matchMode ? 70 : (this.teamMode ? 56 : 52);
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
    // 스코프 (스나이퍼 줌): 바깥은 검게 · 렌즈 가장자리 그림자와 푸른 테 · 유리 반사 · 굵은 바깥 기둥 + 가는 가운데 십자 + 밀 도트 (밤에도 보이게 밝은 테두리)
    if (this.zoomK > 0.05) {
      const R = Math.min(W, H) * 0.42, k = this.zoomK, cx = W / 2, TAU = Math.PI * 2;
      ctx.save(); ctx.globalAlpha = k;
      ctx.fillStyle = 'rgba(0,0,0,0.94)'; ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(cx, hy, R, 0, TAU, true); ctx.fill();
      const lg = ctx.createRadialGradient(cx, hy, R * 0.7, cx, hy, R); lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(0.7, 'rgba(0,0,0,0.22)'); lg.addColorStop(1, 'rgba(0,0,0,0.88)'); ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(cx, hy, R, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(80,160,255,0.22)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, hy, R - 4, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#121418'; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(cx, hy, R + 2, 0, TAU); ctx.stroke();
      const gl = ctx.createLinearGradient(cx - R, hy - R, cx, hy); gl.addColorStop(0, 'rgba(210,235,255,0.13)'); gl.addColorStop(1, 'rgba(210,235,255,0)'); ctx.fillStyle = gl;
      ctx.beginPath(); ctx.arc(cx, hy, R * 0.96, Math.PI * 1.04, Math.PI * 1.62); ctx.arc(cx - R * 0.1, hy - R * 0.1, R * 0.88, Math.PI * 1.62, Math.PI * 1.04, true); ctx.closePath(); ctx.fill();
      const pw = Math.max(3, R * 0.014), post = (x, y, w, h) => { ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2); ctx.fillStyle = '#0B0C0E'; ctx.fillRect(x, y, w, h); };
      post(cx - R, hy - pw / 2, R * 0.6, pw); post(cx + R * 0.4, hy - pw / 2, R * 0.6, pw); post(cx - pw / 2, hy + R * 0.4, pw, R * 0.6); post(cx - pw / 2, hy - R, pw, R * 0.6);
      ctx.lineCap = 'butt'; [['rgba(255,255,255,0.3)', 3], ['#0B0C0E', 1.2]].forEach(([c, lw]) => { ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(cx - R * 0.4, hy); ctx.lineTo(cx + R * 0.4, hy); ctx.moveTo(cx, hy - R * 0.4); ctx.lineTo(cx, hy + R * 0.4); ctx.stroke(); });
      for (let i = 1; i <= 4; i++) { const d = R * 0.4 * i / 5; [[d, 0], [-d, 0], [0, d], [0, -d]].forEach(([dx, dy]) => { ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(cx + dx, hy + dy, 2.6, 0, TAU); ctx.fill(); ctx.fillStyle = '#0B0C0E'; ctx.beginPath(); ctx.arc(cx + dx, hy + dy, 1.7, 0, TAU); ctx.fill(); }); }
      // 가운데 표적: 지금 쏘면 맞는 상대 위 = 빨강(가운데 점까지) · 보호 중 = 하늘색 · 그 밖 = 흰색
      const ac = this.aimOn === 1 ? 'rgba(255,60,80,0.98)' : this.aimOn === 2 ? 'rgba(127,231,255,0.95)' : 'rgba(255,255,255,0.85)';
      ctx.strokeStyle = ac; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, hy, this.aimOn ? 8 : 6, 0, TAU); ctx.stroke();
      if (this.aimOn) { ctx.fillStyle = ac; ctx.beginPath(); ctx.arc(cx, hy, 2.5, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    // 조준점 + 히트마커
    const gap = 6 + this.recoil * 10 + (this.moving ? 5 : 0);
    if (this.zoomK > 0.5) { /* 스코프 중엔 십자선이 대신함 */ }
    const noScope = this.weapon === 'sniper' && !this.spectator && !this.isDead && !this.mEnd;
    if (noScope && this.zoomK < 0.5) {
      // 스나이퍼 줌 없음: 조준점 없음. 무기를 막 바꿨거나 줌 없이 쐈으면 줌 버튼 안내
      if (now < (this.noScopeHint || 0)) FX.text(ctx, '🔍 줌을 눌러야 조준점이 생겨요', W / 2, hy + 46, { size: 14, weight: 800, color: '#FFD166', align: 'center', stroke: 'rgba(8,10,16,0.8)' });
      ctx.textAlign = 'left';
    } else if (this.zoomK < 0.5) {
      // 지금 쏘면 맞는 상대 위: 빨강 · 보호 중인 상대 위: 하늘색 (명중 판정과 같은 계산)
      ctx.strokeStyle = this.aimOn === 1 ? 'rgba(255,92,122,0.98)' : this.aimOn === 2 ? 'rgba(127,231,255,0.98)' : 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 3;
      const g2 = gap;
      [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([ax, ay]) => { ctx.beginPath(); ctx.moveTo(W / 2 + ax * g2, hy + ay * g2); ctx.lineTo(W / 2 + ax * (g2 + 8), hy + ay * (g2 + 8)); ctx.stroke(); });
      ctx.shadowBlur = 0;
    }
    if (this.hitMarker > 0) { const hm = Math.min(1, this.hitMarker); ctx.strokeStyle = this.hitMarker > 1 ? 'rgba(255,214,102,' + hm + ')' : 'rgba(255,80,80,' + hm + ')'; ctx.lineWidth = 3;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([ax, ay]) => { ctx.beginPath(); ctx.moveTo(W / 2 + ax * 6, hy + ay * 6); ctx.lineTo(W / 2 + ax * 16, hy + ay * 16); ctx.stroke(); }); }
    // 쓰러뜨릴 만큼 맞힘: 크고 굵은 빨간 X · 보호 중인 상대를 맞힘: 하늘색 방패 고리 (피해 없음)
    if (this.killMark > 0) { ctx.strokeStyle = 'rgba(255,60,80,' + Math.min(1, this.killMark * 1.5).toFixed(2) + ')'; ctx.lineWidth = 5; const r0 = 9, r1 = 24;
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([ax, ay]) => { ctx.beginPath(); ctx.moveTo(W / 2 + ax * r0, hy + ay * r0); ctx.lineTo(W / 2 + ax * r1, hy + ay * r1); ctx.stroke(); }); }
    if (this.protMark > 0) { ctx.strokeStyle = 'rgba(127,231,255,' + Math.min(1, this.protMark * 1.5).toFixed(2) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(W / 2, hy, 15, 0, Math.PI * 2); ctx.stroke(); }
    // 맞은 방향: 화면 가장자리가 그쪽으로 붉게 번지고 + 조준점 둘레 호 (앞 = 위 · 오른쪽 = 오른쪽 — 예전엔 90° 돌아가 앞에서 맞으면 오른쪽에 떴음)
    if (this.dmgDir && now < this.dmgDir.until) { const k = (this.dmgDir.until - now) / 900, a = this.dmgDir.a, ex = W / 2 + Math.sin(a) * W * 0.62, ey = hy - Math.cos(a) * H * 0.62, rg = ctx.createRadialGradient(ex, ey, 0, ex, ey, Math.max(W, H) * 0.6);
      rg.addColorStop(0, 'rgba(255,40,60,' + (k * 0.38).toFixed(2) + ')'); rg.addColorStop(1, 'rgba(255,40,60,0)'); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.translate(W / 2, hy); ctx.rotate(this.dmgDir.a - Math.PI / 2); ctx.strokeStyle = 'rgba(255,60,80,' + (k * 0.9).toFixed(2) + ')'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, Math.min(W, H) * 0.22, -0.35, 0.35); ctx.stroke(); ctx.restore(); }
    // 맞은 순간: 고글이 지직거리는 줄 (레이저 태그 느낌) — 0.3초
    if (this.hurt > 0.6 && !this.isDead) { const k = (this.hurt - 0.6) / 0.4; ctx.save(); ctx.globalAlpha = Math.min(1, k) * 0.55;
      for (let i = 0; i < 7; i++) { const y = (Math.sin(now * 0.031 + i * 7.31) * 0.5 + 0.5) * H; ctx.fillStyle = i % 2 ? 'rgba(255,70,100,0.6)' : 'rgba(130,230,255,0.45)'; ctx.fillRect(0, y, W, 1 + (i % 3)); } ctx.restore(); }
    if (this.hurt > 0 || (this.hp <= 30 && !this.isDead)) { const a = Math.max(this.hurt * 0.6, this.hp <= 30 && !this.isDead ? 0.25 + Math.sin(now / 180) * 0.12 : 0); const g = ctx.createRadialGradient(W / 2, hy, H * 0.25, W / 2, hy, H * 0.85); g.addColorStop(0, 'rgba(255,40,70,0)'); g.addColorStop(1, 'rgba(255,40,70,' + a.toFixed(2) + ')'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    // 부활 직후 무적: 하늘색 테두리 + 남은 시간 막대
    if (this.spawnSafe) { const k = Math.max(0, Math.min(1, (this.protUntil - now) / F3_SPAWN_PROT));
      ctx.strokeStyle = 'rgba(127,231,255,' + (0.45 + 0.3 * Math.sin(now / 90)).toFixed(2) + ')'; ctx.lineWidth = 8; ctx.strokeRect(4, 4, W - 8, H - 8);
      FX.text(ctx, '🛡 보호 중 · 쏘면 풀려요', W / 2, hy + 74, { size: 15, weight: 800, color: '#7FE7FF', align: 'center', stroke: 'rgba(8,10,16,0.8)' });
      if (!this.spectator) { ctx.fillStyle = 'rgba(127,231,255,0.85)'; ctx.fillRect(W / 2 - 60, hy + 84, 120 * k, 4); } ctx.textAlign = 'left'; }
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
    if (this.matchMode) this.drawMatchBoard(ctx, W, H, now);
    else if (this.teamMode) {
      let red = 0, blue = 0; const add = (t, k) => { if (t === 'red') red += k; else if (t === 'blue') blue += k; };
      add(this.team, this.kills); Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (this.spectator && id === this.followId) return; add(p.team, p.kills || 0); });
      rr(W / 2 - 84, 10, 168, 40, 14, 'rgba(8,10,16,0.72)'); ctx.textAlign = 'center'; ctx.font = '800 22px Pretendard, sans-serif';
      ctx.fillStyle = F3_TEAM_CSS.red; ctx.fillText(String(red), W / 2 - 40, 39); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '700 14px Pretendard, sans-serif'; ctx.fillText('RED   BLUE', W / 2, 38);
      ctx.fillStyle = F3_TEAM_CSS.blue; ctx.font = '800 22px Pretendard, sans-serif'; ctx.fillText(String(blue), W / 2 + 40, 39); ctx.textAlign = 'left';
      ctx.fillStyle = teamC; ctx.font = '800 12px Pretendard, sans-serif'; ctx.fillText(this.team === 'red' ? '🔴 RED' : '🔵 BLUE', 62, 28);
    } else { rr(W / 2 - 64, 10, 128, 36, 14, 'rgba(8,10,16,0.72)'); ctx.textAlign = 'center'; ctx.font = '800 16px Pretendard, sans-serif'; ctx.fillStyle = '#FFD166'; ctx.fillText('K ' + this.kills + '   D ' + this.deaths, W / 2, 34); ctx.textAlign = 'left'; }
    // 킬 피드
    this.feed = this.feed.filter(x => x.until > now); ctx.font = '700 12px Pretendard, sans-serif'; ctx.textAlign = 'right';
    this.feed.forEach((x, i) => { const y = (this.matchMode ? 100 : 66) + i * 20, t = x.a + (x.head ? '  🎯  ' : '  ⚡  ') + x.b; const tw = ctx.measureText(t).width + 16; rr(W - 14 - tw, y - 14, tw, 19, 8, 'rgba(8,10,16,0.6)'); ctx.fillStyle = x.color; ctx.fillText(t, W - 22, y); });
    ctx.textAlign = 'left';

    // 팀전 라운드 점수판: 위 가운데 '레드 2 : 1 블루 · ROUND 4'
    if (this.teamMode && !this.matchMode) {
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
    if (this.mEnd) this.drawMatchResult(ctx, W, H, now);
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
    if (this.spectator) { ctx.textAlign = 'center'; ctx.font = '700 13px Pretendard, sans-serif'; ctx.fillStyle = '#FFD166'; ctx.fillText('👁 ' + this.myName + ' 의 화면', W / 2, this.matchMode ? 104 : (this.teamMode ? 66 : 64)); ctx.textAlign = 'left'; }
    if (this.showBoard) this.drawScoreboard(ctx, W, H);
  }

  // 매칭전 점수판: 위 가운데 '레드 4 : 2 블루' · '경기 3 · 2:2 · 1판 · 목표 7킬 · 2:31' · '🔴 레드 · 상대 이름'
  drawMatchBoard(ctx, W, H, now) {
    const k = this.matchKills(), goal = F3_MATCH_GOAL[this.vs] || 7, w = Math.min(280, W - 120), x0 = W / 2 - w / 2, y0 = 6;
    const n = { red: 0, blue: 0 }, foes = [];
    if (!this.spectator && n[this.team] != null) n[this.team]++;
    for (const id in this.peers) { const p = this.peers[id]; if (n[p.team] != null) n[p.team]++; if (p.team !== this.team) foes.push(p.name || '학생'); }
    FX.glass(ctx, x0, y0, w, 60, 14, this.team ? F3_TEAM_CSS[this.team] : undefined);
    FX.text(ctx, '레드', W / 2 - 74, y0 + 22, { size: 11, weight: 800, color: F3_TEAM_CSS.red, align: 'center' });
    FX.text(ctx, String(k.red), W / 2 - 34, y0 + 24, { size: 22, weight: 800, color: F3_TEAM_CSS.red, align: 'center' });
    FX.text(ctx, ':', W / 2, y0 + 23, { size: 18, weight: 800, color: 'rgba(255,255,255,0.6)', align: 'center' });
    FX.text(ctx, String(k.blue), W / 2 + 34, y0 + 24, { size: 22, weight: 800, color: F3_TEAM_CSS.blue, align: 'center' });
    FX.text(ctx, '블루', W / 2 + 74, y0 + 22, { size: 11, weight: 800, color: F3_TEAM_CSS.blue, align: 'center' });
    const left = this.mStart == null ? F3_MATCH_TIME : Math.max(0, F3_MATCH_TIME - Math.max(0, now - this.mStart)), ss = Math.ceil(left / 1000);
    const wins = (this.mWins.red || this.mWins.blue) ? ' (' + this.mWins.red + ':' + this.mWins.blue + ')' : '';
    FX.text(ctx, '경기 ' + (this.match + 1) + ' · ' + n.red + ':' + n.blue + ' · ' + this.mRound + '판' + wins + ' · ' + goal + '킬 승 · ' + Math.floor(ss / 60) + ':' + String(ss % 60).padStart(2, '0'), W / 2, y0 + 39, { size: 10, weight: 700, color: 'rgba(255,255,255,0.7)', align: 'center' });
    let foeTxt = (this.team === 'red' ? '🔴 레드' : '🔵 블루') + ' · 상대 ' + (foes.length ? foes.join(', ') : '기다리는 중…');
    ctx.font = '700 10px Pretendard, sans-serif'; while (foeTxt.length > 8 && ctx.measureText(foeTxt).width > w - 20) foeTxt = foeTxt.slice(0, -2) + '…';
    FX.text(ctx, foeTxt, W / 2, y0 + 53, { size: 10, weight: 700, color: this.team ? F3_TEAM_CSS[this.team] : '#fff', align: 'center' });
  }
  // 매칭전 판 결과 화면
  drawMatchResult(ctx, W, H, now) {
    const e = this.mEnd, win = !!e.winner && e.winner === this.team, wn = e.winner === 'red' ? '레드' : '블루';
    ctx.fillStyle = 'rgba(8,10,16,0.8)'; ctx.fillRect(0, 0, W, H);
    // 오른쪽 조작 버튼에 가리지 않게, 버튼 왼쪽 빈 곳의 가운데에
    const right = W > H && this.hudSafe && this.hudSafe.rightLeft > W * 0.45 ? this.hudSafe.rightLeft - 10 : W - 16, cx = (16 + right) / 2, bw = Math.min(right - 16, 300), x0 = cx - bw / 2;
    const title = !e.winner ? '무승부' : (this.spectator ? wn + ' 팀 승리' : (win ? '승리!' : '패배'));
    const top = Math.max(40, H * 0.16);
    FX.text(ctx, title, cx, top, { size: 44, weight: 800, color: !e.winner ? '#fff' : (this.spectator ? F3_TEAM_CSS[e.winner] : (win ? '#FFD166' : '#9AA3B2')), align: 'center', baseline: 'middle', shadow: 14 });
    FX.text(ctx, '경기 ' + (this.match + 1) + ' · ' + this.mRound + '판   레드 ' + e.red + ' : ' + e.blue + ' 블루', cx, top + 38, { size: 16, weight: 800, color: '#fff', align: 'center', baseline: 'middle' });
    FX.text(ctx, '경기 전적  레드 ' + this.mWins.red + ' : ' + this.mWins.blue + ' 블루', cx, top + 60, { size: 12, weight: 700, color: 'rgba(255,255,255,0.65)', align: 'center', baseline: 'middle' });
    let y = top + 76; const rows = (e.rows || []).slice(0, Math.max(2, Math.floor((H - y - 40) / 22)));
    rows.forEach((r, i) => {
      if (r.me) { ctx.fillStyle = 'rgba(255,255,255,0.1)'; FX.rr(ctx, x0, y, bw, 20, 7); ctx.fill(); }
      FX.text(ctx, (i + 1) + '.  ' + r.name, x0 + 12, y + 14, { size: 13, weight: r.me ? 800 : 600, color: F3_TEAM_CSS[r.team] || '#fff' });
      FX.text(ctx, r.k + '킬  ' + r.d + '데스', x0 + bw - 12, y + 14, { size: 12, weight: 700, color: '#fff', align: 'right' });
      y += 22;
    });
    const left = Math.max(0, Math.ceil((F3_MATCH_REST - (now - e.at)) / 1000));
    FX.text(ctx, '다음 판이 ' + left + '초 뒤 시작해요 (같은 경기 · 같은 팀)', cx, Math.min(H - 20, y + 18), { size: 13, weight: 700, color: '#FFD166', align: 'center', baseline: 'middle' });
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
    const n = this.map.length, R = Math.min(58, W * 0.16), cx = 14 + R, cy = (this.matchMode ? 76 : 62) + R, cs = 4.6;   // 1칸 = 4.6px (반지름 58 → 약 12칸 시야)
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
    this._dead = true;                                     // 뒤에 draw() 가 불려도 지운 장면을 다시 올리지 않게
    if (this.hud && this.hud.parentElement) this.hud.parentElement.removeChild(this.hud);
    try { this.freeGL(); } catch (e) {}                    // renderer.dispose() 보다 먼저 (그 뒤엔 찾지 못해 안 지워짐)
    if (this.renderer) { try { this.renderer.dispose(); } catch (e) {} }
  }
  // 장면의 GPU 자원(그물 · 재질 · 모든 무늬 · 인스턴스 · 그림자)을 돌려줌
  //   예전: renderer.dispose() 만 해서 대기실로 돌렸다 다시 시작할 때마다 같은 WebGL 에 버퍼 약 130 · 텍스처 약 19 · 셰이더 13개씩 쌓였음
  freeGL() {
    if (this.envRT) { this.envRT.dispose(); this.envRT = null; }
    if (this.post) { const P = this.post; [P.main, P.a, P.b].forEach(t => t.dispose()); [P.bright, P.blur, P.comp].forEach(m => m.dispose()); P.quad.geometry.dispose(); this.post = null; }
    if (!this.scene) return; const seen = new Set(), tex = t => { if (t && t.isTexture && !seen.has(t)) { seen.add(t); t.dispose(); } };
    this.scene.traverse(o => { if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
      [].concat(o.material || []).forEach(m => { if (!m || seen.has(m)) return; seen.add(m); Object.keys(m).forEach(k => tex(m[k])); m.dispose(); });
      if (o.isInstancedMesh && o.dispose) o.dispose(); if (o.isLight && o.shadow && o.shadow.map) { o.shadow.map.dispose(); o.shadow.map = null; } });
  }
}
