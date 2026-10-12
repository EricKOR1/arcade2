// 3D 탱크 대전 — 규칙 · 지형 · 전차 · 통신 (그리기 없음 · node 에서도 돎). 3D 그림 · HUD · 조작은 tank3d-engine.js
//   · 지형: 높이 지도(언덕 · 능선 · 골짜기 · 고원+경사로 · 얕은 물/진흙). 모든 기기가 같은 비트로 만들도록 삼각함수 없이 사칙연산 · sqrt · 정수 해시만 씀
//   · 맵 크기: 교사가 시작할 때 인원을 맵 이름에 붙임('hills:24') → 늦게 온 학생도 같은 크기 · 같은 지형
//   · 명중 판정은 쏜 사람 화면 기준 → 'hit' 사건, 맞은 쪽이 체력을 깎고 쓰러지면 'kill' 사건
//   · 다른 학생의 포탄은 위치 신호의 '발사 번호'가 바뀌면 그 방향으로 그림 (사건을 더 만들지 않음)

const TK_WL = -0.4;                 // 물 높이 (이보다 낮은 땅 = 얕은 물)
const TK_GRID = 1.25;               // 지형 칸 크기 목표(m)
const TK_MATCH_MS = 420000;         // 한 판 7분
const TK_RESPAWN_MS = 4000, TK_PICK_MS = 6000, TK_PROT_MS = 1500;
const TK_STAMP_WRAP = 60466176;     // 보낸 시각을 36진수 5자리로 (약 16.8시간마다 한 바퀴)
const TK_BASE_LAT = 80, TK_LEAD = 0.6;
const TK_FONT = "'Lilita One', Pretendard, sans-serif";

// ── 맵 ──
const TK_MAPS = {
  hills:  { name: '초원 언덕',   tag: '★2 · 기본',   desc: '둥근 언덕과 능선, 연못이 있는 들판. 가운데 언덕 꼭대기에서 멀리 쏠 수 있어요', spec: '인원에 따라 70~140m · 상자 · 벙커 · 나무' },
  canyon: { name: '사막 협곡',   tag: '★3 · 고저차', desc: '절벽으로 둘러싼 바위 고원과 굽은 협곡. 고원은 경사로로만 오를 수 있어요',       spec: '인원에 따라 70~140m · 절벽 · 경사로 · 바위' },
  snow:   { name: '눈 덮인 고원', tag: '★3 · 요새',   desc: '가운데 큰 고원에 경사로 4개, 얼어붙은 연못과 능선. 고원을 차지하면 유리해요',  spec: '인원에 따라 70~140m · 고원 · 감시탑 · 침엽수' }
};
// 인원별 한 변 길이(m): 전차 한 대당 땅 넓이가 비슷하게 (8명 이하 70 · 16명 105 · 24명 125 · 30명 140)
function tkSizeFor(n) { n = +n || 0; return Math.max(70, Math.min(140, Math.round(26 * Math.sqrt(Math.max(1, n)) / 5) * 5)); }
function tkParseTrack(track) {
  const s = String(track || ''), a = s.split(':'), id = TK_MAPS[a[0]] ? a[0] : 'hills', n = parseInt(a[1], 10);
  return { mapId: id, n: n > 0 ? n : 16 };              // ':N' 이 없으면 16명 크기로 고정 (기기마다 인원 수가 달라 맵이 달라지는 것을 막음)
}

// ── 전차 6종 — 상성은 '피해 배수(유형 대 유형)' · 장갑 각도 · 속도 · 사거리 차이로 ──
//   reload = 탄 한 칸이 다시 차는 시간(초) · gap = 연속 발사 최소 간격 · 탄 3칸
const TK_TYPES = {
  light:  { c: 'l', name: '경전차',   role: '기습 · 정찰', hp: 175, spd: 9.2, turn: 4.4, tur: 5.0, arc: 0,    reload: 0.9,  gap: 0.3, dmg: 14, range: 21, vel: 48, r: 1.25, front: 1.0,
            sk: { kind: 'dash', label: '질주', cd: 9 },     pro: '아주 빠름 · 빠른 연사', con: '체력 낮음 · 약한 탄', good: '자주포 · 구축전차', bad: '중형 · 중전차' },
  medium: { c: 'm', name: '중형전차', role: '균형',        hp: 240, spd: 6.6, turn: 3.0, tur: 2.8, arc: 0,    reload: 1.3,  gap: 0.5, dmg: 28, range: 25, vel: 52, r: 1.5, front: 0.85,
            sk: { kind: 'smoke', label: '연막', cd: 14 },   pro: '빠른 포탑 · 고른 능력', con: '특별히 센 곳 없음', good: '경전차', bad: '구축전차' },
  heavy:  { c: 'h', name: '중전차',   role: '돌격 · 방패', hp: 315, spd: 5.0, turn: 1.5, tur: 1.5, arc: 0,    reload: 2.0,  gap: 0.8, dmg: 32, range: 22, vel: 50, r: 1.8, front: 0.7,
            sk: { kind: 'shield', label: '방어막', cd: 16 }, pro: '체력 · 앞 장갑 두꺼움', con: '느림 · 옆뒤 약함', good: '경전차 · 중형', bad: '구축전차 · 자주포' },
  td:     { c: 't', name: '구축전차', role: '저격',        hp: 210, spd: 5.4, turn: 1.6, tur: 1.0, arc: 0.5,  reload: 3.0,  gap: 1.2, dmg: 60, range: 33, vel: 80, r: 1.6, front: 0.9, pierce: true,
            sk: { kind: 'ap', label: '철갑탄', cd: 13 },    pro: '긴 사거리 · 한 방 · 장갑 관통', con: '포탑이 좁게만 돎', good: '중전차', bad: '경전차' },
  arty:   { c: 'a', name: '자주포',   role: '곡사 지원',   hp: 230, spd: 5.4, turn: 2.6, tur: 1.8, arc: 0,    reload: 3.2,  gap: 1.5, dmg: 50, range: 36, vel: 30, r: 1.6, front: 1.0, lob: true, splash: 3.6, minR: 7,
            sk: { kind: 'barrage', label: '포격', cd: 18 }, pro: '언덕 너머 범위 공격', con: '재장전 김 · 체력 낮음', good: '중전차 · 구축전차', bad: '경전차' },
  eng:    { c: 'e', name: '정비전차', role: '수리 · 버티기', hp: 300, spd: 6.0, turn: 2.8, tur: 2.6, arc: 0,  reload: 1.1,  gap: 0.45, dmg: 19, range: 22, vel: 48, r: 1.55, front: 0.85,
            sk: { kind: 'repair', label: '수리', cd: 16 },  pro: '스스로 수리 · 팀 수리', con: '화력 약함', good: '자주포', bad: '중전차 · 구축전차' }
};
const TK_ORDER = ['light', 'medium', 'heavy', 'td', 'arty', 'eng'];
const TK_BY_C = {}; TK_ORDER.forEach(k => { TK_BY_C[TK_TYPES[k].c] = k; });
// 피해 배수 [쏜 전차][맞은 전차]
const TK_VS = {
  light:  { light: 1, medium: 1, heavy: 0.85, td: 1.25, arty: 1.35, eng: 1.6 },
  medium: { light: 1.2, medium: 1, heavy: 1.15, td: 1, arty: 0.9, eng: 0.9 },
  heavy:  { light: 1.1, medium: 1.0, heavy: 1, td: 1, arty: 1, eng: 1 },
  td:     { light: 0.85, medium: 0.95, heavy: 1.45, td: 1, arty: 1, eng: 0.95 },
  arty:   { light: 0.7, medium: 1.25, heavy: 1.4, td: 1.5, arty: 1, eng: 1.15 },
  eng:    { light: 0.8, medium: 1.1, heavy: 1.1, td: 1, arty: 1.2, eng: 1 }
};
// 스킬 단계 (레벨 5 · 10 에서 자동 강화)
const TK_SKILL = {
  dash:    [{ ms: 2200, mul: 1.9 }, { ms: 2800, mul: 2.0 }, { ms: 3400, mul: 2.1 }],
  smoke:   [{ ms: 4000 }, { ms: 5500 }, { ms: 7000 }],
  shield:  [{ ms: 3000, k: 0.35 }, { ms: 4000, k: 0.3 }, { ms: 5000, k: 0.25 }],
  ap:      [{ dmg: 105 }, { dmg: 130 }, { dmg: 155 }],
  barrage: [{ n: 6 }, { n: 8 }, { n: 10 }],
  repair:  [{ ms: 8000, hps: 10, mines: 2, mdmg: 60 }, { ms: 8000, hps: 14, mines: 3, mdmg: 70 }, { ms: 9000, hps: 18, mines: 4, mdmg: 80 }]
};
// 업그레이드 (레벨마다 1점 · 각 최대 5단계)
const TK_UPS = {
  arm: { name: '장갑', desc: '최대 체력 +10%', icon: '■' },
  spd: { name: '엔진', desc: '이동 속도 +6%', icon: '»' },
  rel: { name: '장전', desc: '재장전 −8%', icon: '↻' },
  dmg: { name: '포탄', desc: '포탄 위력 +8%', icon: '●' },
  rng: { name: '포신', desc: '사거리 +6% · 탄속 +8%', icon: '⊕' },
  cd:  { name: '스킬', desc: '스킬 대기 −10%', icon: '★' }
};
const TK_UP_KEYS = ['arm', 'spd', 'rel', 'dmg', 'rng', 'cd'];
// 구조물: 체력 · 높이 · XP · 팀 점수 · 다시 생기는 시간
const TK_STRUCT = {
  crate:   { hp: 40,  h: 1.3, xp: 10, tp: 1, re: 30000, name: '상자' },
  sandbag: { hp: 110, h: 1.15, xp: 12, tp: 1, re: 45000, name: '모래주머니' },
  tower:   { hp: 260, h: 6.0, xp: 35, tp: 3, re: 60000, name: '감시탑' },
  bunker:  { hp: 380, h: 2.3, xp: 50, tp: 4, re: 60000, name: '벙커' },
  tree:    { h: 5.5 }, rock: { h: 1.8 }
};
const TK_LV_MAX = 20;
const tkNeed = lv => 40 + 15 * lv + 2 * lv * lv;  // 다음 레벨까지 XP (높은 레벨일수록 더 많이)

// ── 결정적 난수 · 노이즈 (기기마다 같은 결과) ──
function tkHash(a, b, c) { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function tkRng(seed) { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const tkSm = k => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const tkBump = (d, r) => { if (d >= r) return 0; const s = d / r, t = 1 - s * s; return t * t; };
function tkNoise(x, z, S, seed) {
  const gx = x / S, gz = z / S, ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz;
  const a = tkHash(ix, iz, seed), b = tkHash(ix + 1, iz, seed), c = tkHash(ix, iz + 1, seed), d = tkHash(ix + 1, iz + 1, seed);
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  return (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz;
}
function tkSegDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz; let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + dx * t - px, qz = az + dz * t - pz; return Math.sqrt(qx * qx + qz * qz);
}
const tkStrHash = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; return h; };
const tkAng = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

// ── 지형 모양 (u, v = 0~1 위치 · 넓이는 m) ── 점대칭(u,v ↔ 1-u,1-v)이라 두 팀 진영이 같은 모양
// 고원: 안쪽 평평 · 가장자리는 절벽(cw), ramp 방향(단위 벡터)으로는 길이 rl 의 경사로
function tkPlateau(x, z, cx, cz, r, H, cw, rl, rdx, rdz) {
  const dx = x - cx, dz = z - cz, d = Math.sqrt(dx * dx + dz * dz); let t = 0;
  if (rl > 0 && d > 1e-6) t = tkSm(((dx * rdx + dz * rdz) / d - 0.86) / 0.1);
  const e = cw + rl * t; return H * tkSm((r + e - d) / e);
}
const TK_TERRAIN = {
  hills(x, z, L, ns) {
    const u = x / L, v = z / L, m = d => d * L;
    let h = (ns(x, z, 11, 1) - 0.5) * 0.8 + (ns(x, z, 4.3, 2) - 0.5) * 0.25;
    // 가운데 언덕 (꼭대기 평평)
    { const d = Math.sqrt((u - 0.5) * (u - 0.5) + (v - 0.5) * (v - 0.5)) * L, e = Math.max(9, m(0.11)); h += 4.3 * tkSm((m(0.15) + e * 0.35 - d) / e); }
    // 둥근 언덕 4개 · 능선 2개 · 연못 2개 (점대칭)
    const sym = (fn) => fn(u, v) + fn(1 - u, 1 - v);
    h += sym((a, b) => 3.4 * tkBump(Math.sqrt((a - 0.24) * (a - 0.24) + (b - 0.31) * (b - 0.31)) * L, Math.max(9, m(0.115))));
    h += sym((a, b) => 2.8 * tkBump(Math.sqrt((a - 0.77) * (a - 0.77) + (b - 0.27) * (b - 0.27)) * L, Math.max(8, m(0.095))));
    h += sym((a, b) => 2.0 * tkBump(tkSegDist(a, b, 0.37, 0.21, 0.6, 0.17) * L, Math.max(5, m(0.045))));
    h -= sym((a, b) => 1.9 * tkBump(Math.sqrt((a - 0.16) * (a - 0.16) + (b - 0.53) * (b - 0.53)) * L, Math.max(6.5, m(0.075))));
    return h;
  },
  canyon(x, z, L, ns) {
    const u = x / L, v = z / L, m = d => d * L;
    let h = (ns(x, z, 13, 1) - 0.5) * 1.0 + (ns(x, z, 5, 2) - 0.5) * 0.3;
    // 굽은 협곡 (가운데를 가로지름 · 바닥은 마른 진흙)
    const P = [[0, 0.47], [0.22, 0.4], [0.4, 0.5], [0.6, 0.5], [0.78, 0.6], [1, 0.53]]; let dd = 9;
    for (let i = 0; i < P.length - 1; i++) dd = Math.min(dd, tkSegDist(u, v, P[i][0], P[i][1], P[i + 1][0], P[i + 1][1]));
    const ww = Math.max(5.5, m(0.05)); h -= 2.6 * tkSm((m(0.028) + ww - dd * L) / ww);
    // 바위 고원(메사): 절벽 + 경사로 하나씩 (점대칭 짝)
    const rl = Math.max(11, m(0.15));
    h += tkPlateau(x, z, m(0.27), m(0.22), Math.max(5.5, m(0.085)), 5.0, 1.1, rl, 1, 0) + tkPlateau(x, z, m(0.73), m(0.78), Math.max(5.5, m(0.085)), 5.0, 1.1, rl, -1, 0);
    h += tkPlateau(x, z, m(0.72), m(0.27), Math.max(4.5, m(0.065)), 4.2, 1.1, rl, 0, 1) + tkPlateau(x, z, m(0.28), m(0.73), Math.max(4.5, m(0.065)), 4.2, 1.1, rl, 0, -1);
    // 작은 모래 언덕
    const sym = (fn) => fn(u, v) + fn(1 - u, 1 - v);
    h += sym((a, b) => 1.8 * tkBump(Math.sqrt((a - 0.5) * (a - 0.5) + (b - 0.29) * (b - 0.29)) * L, Math.max(7, m(0.08))));
    h += sym((a, b) => 1.5 * tkBump(Math.sqrt((a - 0.1) * (a - 0.1) + (b - 0.33) * (b - 0.33)) * L, Math.max(6, m(0.07))));
    return h;
  },
  snow(x, z, L, ns) {
    const u = x / L, v = z / L, m = d => d * L;
    let h = (ns(x, z, 12, 1) - 0.5) * 0.9 + (ns(x, z, 4.7, 2) - 0.5) * 0.3;
    // 가운데 큰 고원(둥근 네모): 절벽 + 네 변 가운데 경사로
    { const dx = Math.abs(x - L / 2), dz = Math.abs(z - L / 2), half = m(0.16), rc = m(0.05);
      const qx = Math.max(dx - (half - rc), 0), qz = Math.max(dz - (half - rc), 0), out = Math.sqrt(qx * qx + qz * qz) - rc;
      const side = dx >= dz ? dz : dx, t = tkSm((m(0.05) - side) / m(0.025)), e = 1.1 + Math.max(11, m(0.13)) * t;
      h += 3.6 * tkSm((e - out) / e); }
    const sym = (fn) => fn(u, v) + fn(1 - u, 1 - v);
    // 대각선 능선 · 얼어붙은 연못
    h += sym((a, b) => 2.3 * tkBump(tkSegDist(a, b, 0.1, 0.1, 0.27, 0.27) * L, Math.max(5.5, m(0.045))));
    h += sym((a, b) => 2.3 * tkBump(tkSegDist(a, b, 0.9, 0.1, 0.73, 0.27) * L, Math.max(5.5, m(0.045))));
    h -= sym((a, b) => 1.9 * tkBump(Math.sqrt((a - 0.11) * (a - 0.11) + (b - 0.52) * (b - 0.52)) * L, Math.max(7, m(0.08))));
    h += sym((a, b) => 1.5 * tkBump(Math.sqrt((a - 0.5) * (a - 0.5) + (b - 0.22) * (b - 0.22)) * L, Math.max(6, m(0.055))));
    return h;
  }
};
// 맵별 구조물 · 장식 수 (1000㎡ 당)
const TK_DENS = {
  hills:  { crate: 4.4, sandbag: 1.5, bunker: 0.4, tower: 0.25, tree: 6.5, rock: 1.6 },
  canyon: { crate: 4.4, sandbag: 1.7, bunker: 0.45, tower: 0.2, tree: 0.8, rock: 5.5 },
  snow:   { crate: 4.0, sandbag: 1.5, bunker: 0.35, tower: 0.35, tree: 6, rock: 2.2 }
};

// ── 지형 · 구조물 (같은 맵 · 크기 · 판이면 같은 결과 — 기기 안에서는 한 번만 만들어 함께 씀) ──
const TK_WORLD_CACHE = [];
class TkWorld {
  static get(mapId, L, seed) {
    const key = mapId + '|' + L + '|' + seed; for (const w of TK_WORLD_CACHE) if (w.key === key) return w;
    const w = new TkWorld(mapId, L, seed); w.key = key; TK_WORLD_CACHE.unshift(w); if (TK_WORLD_CACHE.length > 2) TK_WORLD_CACHE.length = 2; return w;
  }
  constructor(mapId, L, seed) {
    this.mapId = TK_TERRAIN[mapId] ? mapId : 'hills'; this.L = L; this.seed = seed | 0;
    const N = this.N = Math.max(48, Math.round(L / TK_GRID)), cs = this.cs = L / N, W = N + 1;
    this.hgt = new Float32Array(W * W); this.mat = new Uint8Array(W * W);      // 재질: 0 땅 · 1 진흙(눈) · 2 물
    const ms = tkStrHash(this.mapId), ns = (x, z, S, k) => (tkNoise(x, z, S, ms + k) + tkNoise(L - x, L - z, S, ms + k)) * 0.5;
    const fn = TK_TERRAIN[this.mapId];
    for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
      const x = i * cs, z = j * cs; let h = fn(x, z, L, ns) + 0.25;   // 바닥 잔물결이 물 높이 밑으로 내려가지 않게
      // 맵 가장자리는 살짝 솟은 둑 (밖으로 못 나감을 보여 줌)
      const eg = Math.min(x, z, L - x, L - z); if (eg < 3) h += (3 - eg) * 0.35;
      this.hgt[j * W + i] = h;
    }
    // 재질: 물 · 진흙(물가 · 협곡 바닥 · 노이즈 웅덩이)
    for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) { const k = j * W + i, h = this.hgt[k], x = i * cs, z = j * cs;
      if (this.mapId === 'canyon') { if (h < -1.0) this.mat[k] = 1; }                         // 협곡 바닥 = 마른 진흙 (물 없음)
      else if (h < TK_WL) this.mat[k] = 2;
      else if (h < TK_WL + 0.3 || (ns(x, z, 7, 9) > 0.7 && this.slopeAtGrid(i, j) < 0.25)) this.mat[k] = 1; }
    this.build();
  }
  // ── 높이 · 재질 조회 ──
  height(x, z) {
    const N = this.N, cs = this.cs, W = N + 1; let gx = x / cs, gz = z / cs;
    gx = gx < 0 ? 0 : gx > N - 1e-6 ? N - 1e-6 : gx; gz = gz < 0 ? 0 : gz > N - 1e-6 ? N - 1e-6 : gz;
    const i = gx | 0, j = gz | 0, fx = gx - i, fz = gz - j, k = j * W + i, H = this.hgt;
    // 칸을 두 삼각형으로 (그리는 지형과 같은 면)
    if (fx + fz <= 1) return H[k] + (H[k + 1] - H[k]) * fx + (H[k + W] - H[k]) * fz;
    return H[k + W + 1] + (H[k + W] - H[k + W + 1]) * (1 - fx) + (H[k + 1] - H[k + W + 1]) * (1 - fz);
  }
  matAt(x, z) { const N = this.N, cs = this.cs; const i = Math.max(0, Math.min(N, Math.round(x / cs))), j = Math.max(0, Math.min(N, Math.round(z / cs))); return this.mat[j * (N + 1) + i]; }
  slopeAtGrid(i, j) { const N = this.N, W = N + 1, H = this.hgt, a = H[j * W + Math.max(0, i - 1)], b = H[j * W + Math.min(N, i + 1)], c = H[Math.max(0, j - 1) * W + i], d = H[Math.min(N, j + 1) * W + i];
    const gx = (b - a) / (2 * this.cs), gz = (d - c) / (2 * this.cs); return Math.sqrt(gx * gx + gz * gz); }
  slope(x, z) { const e = 0.6, gx = (this.height(x + e, z) - this.height(x - e, z)) / (2 * e), gz = (this.height(x, z + e) - this.height(x, z - e)) / (2 * e); return Math.sqrt(gx * gx + gz * gz); }
  // 지형 시야: 두 점을 잇는 직선이 땅에 막히는지 (0.8m 간격으로)
  los(x0, y0, z0, x1, y1, z1) {
    const dx = x1 - x0, dz = z1 - z0, dist = Math.sqrt(dx * dx + dz * dz), n = Math.max(1, Math.ceil(dist / 0.8));
    for (let i = 1; i < n; i++) { const t = i / n; if (y0 + (y1 - y0) * t < this.height(x0 + dx * t, z0 + dz * t) - 0.05) return false; }
    return true;
  }
  // 둘레 rad 안이 평평하고 마른 땅인지 (출발점 · 구조물 자리)
  flatDry(x, z, rad, maxDh) {
    const L = this.L; if (x < rad + 3 || z < rad + 3 || x > L - rad - 3 || z > L - rad - 3) return false;
    let lo = 1e9, hi = -1e9;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const px = x + a * rad, pz = z + b * rad, h = this.height(px, pz); if (this.matAt(px, pz) === 2) return false; if (h < lo) lo = h; if (h > hi) hi = h; }
    return hi - lo <= maxDh;
  }
  // ── 출발점 · 구조물 · 나무 · 바위 ──
  build() {
    const L = this.L, R = tkRng((tkStrHash(this.mapId) ^ Math.imul(L, 7919) ^ Math.imul(this.seed, 2654435761)) >>> 0);
    const sp = this.spawns = { r: [], b: [], f: [] };
    const far = (list, x, z, d) => { for (const p of list) if ((p[0] - x) * (p[0] - x) + (p[1] - z) * (p[1] - z) < d * d) return false; return true; };
    // 팀 출발점: 레드 = 북쪽 띠 · 블루 = 남쪽 띠 (점대칭 짝)
    for (let i = 0; i < 900 && sp.r.length < 14; i++) { const x = L * (0.1 + 0.8 * R()), z = L * (0.05 + 0.11 * R());
      if (!this.flatDry(x, z, 2.5, 1.2) || !this.flatDry(L - x, L - z, 2.5, 1.2) || !far(sp.r, x, z, 5)) continue; sp.r.push([x, z]); sp.b.push([L - x, L - z]); }
    // 개인전 출발점: 맵 전체에 흩어서
    for (let i = 0; i < 1500 && sp.f.length < 26; i++) { const x = L * (0.06 + 0.88 * R()), z = L * (0.06 + 0.88 * R());
      if (!this.flatDry(x, z, 2.5, 1.2) || !far(sp.f, x, z, L * 0.13)) continue; sp.f.push([x, z]); }
    [['r', [L * 0.5, L * 0.1]], ['b', [L * 0.5, L * 0.9]], ['f', [L * 0.3, L * 0.3]], ['f', [L * 0.7, L * 0.7]]].forEach(([k, p]) => { if (sp[k].length < 2) sp[k].push(p); });
    // 구조물 (부술 수 있음) → 장식(나무 · 바위, 엄폐물)
    const obs = this.obs = [], dens = TK_DENS[this.mapId], A = L * L / 1000, allSp = sp.r.concat(sp.b, sp.f);
    const clear = (x, z, rad) => { for (const p of allSp) if ((p[0] - x) * (p[0] - x) + (p[1] - z) * (p[1] - z) < (rad + 5) * (rad + 5)) return false;
      for (const o of obs) { const rr = (o.rad || 0) + rad + (o.k === 'tree' || o.k === 'rock' ? 0.6 : 1.6); if ((o.x - x) * (o.x - x) + (o.z - z) * (o.z - z) < rr * rr) return false; } return true; };
    const put = (k, x, z, rot) => { const S = TK_STRUCT[k], o = { id: obs.length, k, x, z, y: this.height(x, z), h: S.h, rot: rot | 0 };
      if (k === 'crate') { o.shape = 'b'; o.hx = 0.8; o.hz = 0.8; o.rad = 1.15; }
      else if (k === 'sandbag') { o.shape = 'b'; o.hx = rot ? 0.5 : 1.7; o.hz = rot ? 1.7 : 0.5; o.rad = 1.8; }
      else if (k === 'bunker') { o.shape = 'b'; o.hx = 2.1; o.hz = 2.1; o.rad = 3.0; }
      else if (k === 'tower') { o.shape = 'c'; o.r = 1.35; o.rad = 1.35; }
      else if (k === 'tree') { o.shape = 'c'; o.r = 0.55; o.rad = 0.55; o.s = 0.8 + R() * 0.5; o.h = TK_STRUCT.tree.h * o.s; }
      else { o.shape = 'c'; o.r = 0.9 + R() * 0.6; o.rad = o.r; o.h = TK_STRUCT.rock.h * o.r; }
      if (S.hp) { o.max = S.hp; o.hp = S.hp; o.dead = false; o.until = 0; }
      obs.push(o); return o; };
    const want = k => Math.max(k === 'bunker' || k === 'tower' ? 1 : 2, Math.round(dens[k] * A / 2));   // 짝 수
    ['bunker', 'tower', 'sandbag', 'crate', 'rock', 'tree'].forEach(k => {
      const rad = k === 'bunker' ? 3 : k === 'sandbag' ? 1.8 : k === 'tower' ? 1.6 : 1.1, n = want(k), deco = k === 'tree' || k === 'rock';
      let made = 0;
      for (let t = 0; t < Math.max(200, n * 60) && made < n; t++) {
        const x = L * (0.05 + 0.9 * R()), z = L * (0.05 + 0.9 * R()), rot = R() < 0.5 ? 1 : 0;
        const ok = p => (deco ? (this.matAt(p[0], p[1]) !== 2 && this.slope(p[0], p[1]) < (k === 'rock' ? 1.6 : 0.8) && p[0] > 3 && p[1] > 3 && p[0] < L - 3 && p[1] < L - 3) : this.flatDry(p[0], p[1], rad, k === 'bunker' ? 1.3 : 1.0)) && clear(p[0], p[1], rad);
        const a = [x, z], b = [L - x, L - z]; if (!ok(a)) continue;
        put(k, a[0], a[1], rot); if ((a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1]) > rad * rad * 4 && ok(b)) put(k, b[0], b[1], rot); made++;
      }
    });
    // 공간 격자 (6m 칸) — 충돌 · 포탄 검사를 가까운 것만
    const G = this.gN = Math.ceil(L / 6); this.grid = []; for (let i = 0; i < G * G; i++) this.grid.push([]);
    obs.forEach(o => { const r = o.rad + 0.1, i0 = Math.max(0, Math.floor((o.x - r) / 6)), i1 = Math.min(G - 1, Math.floor((o.x + r) / 6)), j0 = Math.max(0, Math.floor((o.z - r) / 6)), j1 = Math.min(G - 1, Math.floor((o.z + r) / 6));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.grid[j * G + i].push(o); });
    this.structCount = obs.filter(o => o.max).length;
  }
  // (x,z) 둘레 rad 안의 구조물 · 장식에 fn (살아 있는 것만) — fn 이 true 를 돌려주면 멈춤
  near(x, z, rad, fn) {
    const G = this.gN, i0 = Math.max(0, Math.floor((x - rad) / 6)), i1 = Math.min(G - 1, Math.floor((x + rad) / 6)), j0 = Math.max(0, Math.floor((z - rad) / 6)), j1 = Math.min(G - 1, Math.floor((z + rad) / 6));
    const stamp = this._stamp = (this._stamp || 0) + 1;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const cell = this.grid[j * G + i];
      for (let k = 0; k < cell.length; k++) { const o = cell[k]; if (o._s === stamp) continue; o._s = stamp; if (o.dead) continue; if (fn(o)) return o; } }
    return null;
  }
  // 원(x,z,r)이 구조물과 겹치는지
  static hitsObs(o, x, z, r) {
    if (o.shape === 'c') { const dx = x - o.x, dz = z - o.z, rr = r + o.r; return dx * dx + dz * dz < rr * rr; }
    const qx = Math.max(Math.abs(x - o.x) - o.hx, 0), qz = Math.max(Math.abs(z - o.z) - o.hz, 0); return qx * qx + qz * qz < r * r;
  }
}

// ══ 전차 한 대 (내 기기) + 다른 학생 전차 보기 ══
class TankCore {
  constructor(opts) {
    const o = this.opts = opts || {};
    this.myId = o.myId || 'me'; this.myName = o.myName || '';
    this.ffa = !!o.ffa;
    const tk = tkParseTrack(o.trackId); this.mapId = tk.mapId; this.nSize = tk.n; this.L = tkSizeFor(tk.n);
    this.seed = +o.seed || 0;
    this.world = TkWorld.get(this.mapId, this.L, Math.floor(this.seed / 1000) % 1000003);
    this.now = 0; this.lastTime = 0;
    this.startAt = this.seed || this.srv(); this.endAt = this.startAt + (o.matchMs || TK_MATCH_MS);
    this.peers = {}; this.shells = []; this.fx = []; this.dmgNums = []; this.feed = []; this.toasts = []; this.smokes = []; this.zones = []; this.mines = []; this.barr = [];
    this.gone = {};                                         // 나간 친구의 팀 점수 (팀 점수가 갑자기 줄지 않게)
    this.hazards = {}; this.sdQ = {}; this.sdAt = 0; this.dmgBy = {};
    this.score = 0; this.kills = 0; this.deaths = 0; this.ts = 0; this.lv = 1; this.lx = 0; this.pts = 0;
    this.up = { arm: 0, spd: 0, rel: 0, dmg: 0, rng: 0, cd: 0 }; this.upOrder = []; this.cards = null;
    this.gameOver = false; this.result = null;
    this.mx = 0; this.my = 0; this.aimDir = null; this.aimUntil = 0; this.aimPt = null;
    this.x = this.L / 2; this.z = this.L / 2; this.y = 0; this.h = -Math.PI / 2; this.tu = -Math.PI / 2; this.vx = 0; this.vz = 0;
    this.alive = false; this.hp = 1; this.ammo = 3; this.super = 0; this.skAt = 0; this.shotSeq = 0; this.lob = 0;
    this.wantFire = 0; this.lastShot = -1e9; this.protUntil = 0; this.dashUntil = 0; this.shieldUntil = 0; this.smokeUntil = 0; this.zoneUntil = 0; this.apArmed = false;
    this.lastHurt = -1e9; this.target = null; this.tgtAt = 0; this.deadAt = 0; this.respawnAt = 0;
    let saved = null; try { const ls = typeof localStorage !== 'undefined' && localStorage.getItem('tankType'); if (ls && TK_TYPES[ls]) this.lastType = ls; } catch (e) {}
    try { saved = typeof sessionStorage !== 'undefined' && JSON.parse(sessionStorage.getItem(this.saveKey()) || 'null'); } catch (e) {}
    this.type = this.lastType || 'medium'; this.T = TK_TYPES[this.type];
    // 팀: 시작 명단 순서로 번갈아(균형) · 늦게 왔으면 출격할 때 받은 친구들 팀 수를 보고 적은 쪽
    const roster = (o.roster || []).slice().sort(), idx = roster.indexOf(this.myId);
    this.lateJoin = this.srv() - this.startAt > 8000 || idx < 0;
    this.team = this.ffa ? '' : (!this.lateJoin ? (idx % 2 ? 'b' : 'r') : null);
    if (saved && saved.seed === this.seed) this.restore(saved);   // 같은 판에서 새로고침: 점수 · 레벨 · 업그레이드 · 팀 이어서
    this.ch = { sup: { label: this.T.sk.label } };
    this.sel = { open: true, until: 0 }; this.firstPick = true;
  }
  saveKey() { return 'tank:' + (this.opts.ffa ? 'f' : 't') + ':' + this.seed + ':' + this.myId; }
  restore(s) { ['score', 'kills', 'deaths', 'ts', 'lv', 'lx', 'pts'].forEach(k => { if (isFinite(+s[k])) this[k] = +s[k]; });
    if (s.up) TK_UP_KEYS.forEach(k => { this.up[k] = Math.max(0, Math.min(5, s.up[k] | 0)); }); if (Array.isArray(s.uo)) this.upOrder = s.uo.filter(k => this.up[k] != null).slice(0, 40);
    if (!this.ffa && (s.team === 'r' || s.team === 'b')) { this.team = s.team; this.lateJoin = false; } if (TK_TYPES[s.type]) this.lastType = s.type; this.restored = true; }
  save() { try { if (typeof sessionStorage === 'undefined') return; sessionStorage.setItem(this.saveKey(), JSON.stringify({ seed: this.seed, score: this.score, kills: this.kills, deaths: this.deaths, ts: this.ts, lv: this.lv, lx: this.lx, pts: this.pts, up: this.up, uo: this.upOrder, team: this.team, type: this.type })); } catch (e) {} }
  srv() { return this.opts.serverNow ? this.opts.serverNow() : (this.now || 0); }
  clock() { return this.now || 0; }
  get isDead() { return !this.alive; }
  get spawnSafe() { return this.alive && this.now < this.protUntil; }
  get skTier() { return this.lv >= 10 ? 2 : this.lv >= 5 ? 1 : 0; }
  // ── 능력치 (업그레이드 반영) ──
  maxHpOf() { return Math.round(this.T.hp * (1 + 0.1 * this.up.arm)); }
  speedOf() { return this.T.spd * (1 + 0.06 * this.up.spd) * (this.now < this.dashUntil ? TK_SKILL.dash[this.skTier].mul : 1); }
  reloadOf() { return this.T.reload * (1 - 0.08 * this.up.rel); }
  dmgOf() { return this.T.dmg * (1 + 0.08 * this.up.dmg); }
  rangeOf() { return this.T.range * (1 + 0.06 * this.up.rng); }
  velOf() { return this.T.vel * (1 + 0.08 * this.up.rng); }
  cdOf() { return this.T.sk.cd * 1000 * (1 - 0.1 * this.up.cd); }
  isEnemy(p) { return !!p && !p.dead && (this.ffa || !p.team || !this.team || p.team !== this.team); }
  toast(text, color, ms) { this.toasts.push({ text, color: color || '#fff', until: this.now + (ms || 1700) }); if (this.toasts.length > 4) this.toasts.shift(); }

  // ── 조작 (index.html 의 조이스틱 · 버튼 · 키) ──
  setMove(x, y) { this.mx = +x || 0; this.my = +y || 0; }
  setAim(dx, dy) { if (dx == null || (!dx && !dy)) { this.aimDir = null; return; } this.aimDir = Math.atan2(dy, dx); this.aimUntil = this.now + 1500; this.aimPt = null; }
  // 마우스로 가리킨 땅 위 지점 (3D 쪽이 화면 → 땅 좌표로 바꿔 넘김) — 곡사는 그 지점에 떨어짐
  setAimPoint(x, z) { if (!isFinite(x) || !isFinite(z)) return; this.aimPt = [x, z]; this.aimDir = Math.atan2(z - this.z, x - this.x); this.aimUntil = this.now + 1500; }
  releaseAim(dx, dy) { if (Math.hypot(dx || 0, dy || 0) > 0.15) { this.setAim(dx, dy); this.aimUntil = this.now + 700; } this.fire(); }
  fire() { if (!this.alive || this.gameOver) return; this.wantFire = this.now + 1500; }   // 톡 한 번이면 포탑이 돌아간 뒤(최대 1.5초 안) 쏨 — 포탑이 느린 중전차·구축전차도
  useSuper() {
    if (!this.alive || this.gameOver || this.super < 100) return false;
    const k = this.T.sk.kind, tier = this.skTier, now = this.now; this.skAt = now; this.super = 0;
    if (k === 'dash') this.dashUntil = now + TK_SKILL.dash[tier].ms;
    else if (k === 'smoke') { this.smokeUntil = now + TK_SKILL.smoke[tier].ms; this.smokes.push({ x: this.x, z: this.z, y: this.y, until: now + TK_SKILL.smoke[tier].ms + 600, t0: now }); }
    else if (k === 'shield') this.shieldUntil = now + TK_SKILL.shield[tier].ms;
    else if (k === 'ap') { this.apArmed = true; this.apUntil = now + 8000; this.wantFire = now + 600; }
    else if (k === 'barrage') { const p = this.skillPoint(); this.startBarrage(this.x, this.z, p[0], p[1], TK_SKILL.barrage[tier].n, true); if (this.opts.onAttack) this.opts.onAttack('bar', null, { x: +p[0].toFixed(1), z: +p[1].toFixed(1), n: TK_SKILL.barrage[tier].n }); }
    else if (k === 'repair') {
      if (this.ffa) { const S = TK_SKILL.repair[tier]; this.mines.push({ x: this.x, z: this.z, armAt: now + 1000, until: now + 60000, dmg: S.mdmg }); while (this.mines.length > S.mines) this.mines.shift(); this.toast('지뢰 설치 (' + this.mines.length + '/' + S.mines + ')', '#FFD166'); }
      else { const S = TK_SKILL.repair[tier]; this.zoneUntil = now + S.ms; this.zones.push({ x: this.x, z: this.z, until: now + S.ms, hps: S.hps, mine: true, team: this.team }); if (this.opts.onAttack) this.opts.onAttack('zone', null, { x: +this.x.toFixed(1), z: +this.z.toFixed(1), ms: S.ms, hps: S.hps }); }
    }
    if (k !== 'repair' || !this.ffa) this.toast(this.T.sk.label + '!', '#FFD166');
    this.sfx('skill', k); return true;
  }
  // 포격 지점: 조준한 곳 > 가까운 적 > 앞쪽 25m
  skillPoint() {
    if (this.aimPt && this.now < this.aimUntil) return this.aimPt;
    const t = this.target && this.peers[this.target.id] ? this.peers[this.target.id] : null; if (t && !t.dead) return [t.x + (t.vx || 0) * 1.2, t.z + (t.vz || 0) * 1.2];
    const a = this.aimDir != null && this.now < this.aimUntil ? this.aimDir : this.tu; return [this.x + Math.cos(a) * 25, this.z + Math.sin(a) * 25];
  }
  startBarrage(fx, fz, x, z, n, mine) { for (let i = 0; i < n; i++) this.barr.push({ at: this.now + i * 220, fx, fz, x, z, mine, k: i }); }
  // 전차 고르기 (카드 · 숫자키 · 자동)
  chooseType(type) {
    if (!TK_TYPES[type] || !this.sel.open) return;
    this.type = type; this.T = TK_TYPES[type]; this.ch.sup.label = this.T.sk.label; this.sel.open = false; this.lastType = type;
    try { if (typeof localStorage !== 'undefined') localStorage.setItem('tankType', type); } catch (e) {}
    this.save();
  }
  // 업그레이드 카드 고르기 (0~2)
  pickCard(i) {
    if (!this.cards || !this.cards[i] || this.pts <= 0) return false;
    const k = this.cards[i]; if (this.up[k] >= 5) return false;
    const before = this.maxHpOf(); this.up[k]++; this.upOrder.push(k); this.pts--;
    if (k === 'arm' && this.alive) this.hp = Math.min(this.maxHpOf(), this.hp + this.maxHpOf() - before);
    this.toast(TK_UPS[k].name + ' ' + this.up[k] + '단계', '#8FE3FF'); this.sfx('up');
    this.cards = this.pts > 0 ? this.newCards() : null; this.save(); return true;
  }
  newCards() {
    const left = TK_UP_KEYS.filter(k => this.up[k] < 5); if (!left.length) { this.pts = 0; return null; }
    for (let i = left.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = left[i]; left[i] = left[j]; left[j] = t; }
    return left.slice(0, 3);
  }
  // 반 평균 레벨 (나 포함 · 보이는 친구들)
  avgLevel() { let s = this.lv, n = 1; for (const id in this.peers) { s += this.peers[id].lv || 1; n++; } return s / n; }
  addXp(n, team) {
    if (this.gameOver || !(n > 0)) return;
    const gap = this.avgLevel() - this.lv; if (gap > 1) n *= Math.min(1.6, 1 + 0.1 * gap);   // 따라잡기: 평균보다 낮으면 XP 조금 더
    n = Math.round(n);
    this.score += n; this.lx += n; if (team && !this.ffa) this.ts += team;
    while (this.lv < TK_LV_MAX && this.lx >= tkNeed(this.lv)) { this.lx -= tkNeed(this.lv); this.lv++; this.pts++;
      this.toast('레벨 ' + this.lv + '!' + (this.lv === 5 || this.lv === 10 ? ' 스킬 강화' : ''), '#FFD166', 2000); this.sfx('level');
      if (this.alive && this.hp > 0) this.hp = Math.min(this.maxHpOf(), this.hp + this.maxHpOf() * 0.15); }
    if (this.lv >= TK_LV_MAX) this.lx = Math.min(this.lx, tkNeed(this.lv));
    if (this.pts > 0 && !this.cards) this.cards = this.newCards();
  }

  // ── 출격 · 쓰러짐 ──
  spawnPoint() {
    const sp = this.world.spawns, list = this.ffa ? sp.f : (this.team === 'b' ? sp.b : sp.r);
    let best = list[0], bs = -1e9;
    list.forEach(p => { let dmin = 1e9; for (const id in this.peers) { const q = this.peers[id]; if (q.dead || q.sel) continue; const d = Math.hypot(q.x - p[0], q.z - p[1]) * (this.isEnemy(q) ? 1 : 3); if (d < dmin) dmin = d; }
      const s = Math.min(dmin, this.L * 0.6) + Math.random() * 6; if (s > bs) { bs = s; best = p; } });
    return best;
  }
  spawn() {
    if (!this.ffa && !this.team) {                         // 늦게 온 학생: 지금 보이는 친구들의 팀 수가 적은 쪽
      let r = 0, b = 0; for (const id in this.peers) { const t = this.peers[id].team; if (t === 'r') r++; else if (t === 'b') b++; }
      const roster = (this.opts.roster || []).slice().sort(), idx = Math.max(0, roster.indexOf(this.myId));
      this.team = r < b ? 'r' : b < r ? 'b' : (idx % 2 ? 'b' : 'r');
    }
    const p = this.spawnPoint(); this.x = p[0] + (Math.random() - 0.5) * 1.5; this.z = p[1] + (Math.random() - 0.5) * 1.5;
    this.y = this.world.height(this.x, this.z);
    this.h = this.tu = Math.atan2(this.L / 2 - this.z, this.L / 2 - this.x);    // 맵 가운데를 보고 출발
    this.alive = true; this.hp = this.maxHpOf(); this.ammo = 3; this.protUntil = this.now + TK_PROT_MS; this.dashUntil = this.shieldUntil = this.smokeUntil = this.zoneUntil = 0; this.apArmed = false;
    if (this.firstPick) { this.firstPick = false; this.skAt = this.now - this.cdOf() * 0.5; }   // 처음 출격: 스킬 반쯤 찬 채로
    this.lastHurt = -1e9; this.dmgBy = {}; this.vx = this.vz = 0; this.target = null; this.wantFire = 0;
    this.save();
  }
  die(byId) {
    if (!this.alive) return;
    const now = this.now; this.alive = false; this.hp = 0; this.deaths++; this.deadAt = now; this.respawnAt = now + TK_RESPAWN_MS;
    this.sel = { open: true, until: now + TK_PICK_MS };
    this.addFx('boom', this.x, this.y + 1, this.z, 2.2);
    // 도움: 최근 8초 안에 나를 맞힌 다른 친구들
    const as = Object.keys(this.dmgBy).filter(id => id !== byId && now - this.dmgBy[id] < 8000).slice(0, 4);
    const vl = this.lv;
    if (this.opts.onAttack && byId) this.opts.onAttack('kill', byId, { vl, as: as.join('|'), vt: this.T.c });
    const killer = this.peers[byId]; this.feedPush(killer ? killer.name : '상대', this.myName || '나', false, true);
    this.toast((killer && killer.name ? killer.name + '에게 ' : '') + '격파됨', '#FF7A8A', 2200);
    // 쓰러지면 이번 레벨 XP 의 40% 를 잃음 · 반 평균보다 3레벨 넘게 앞선 전차는 한 단계 내려감(아직 안 쓴 점수부터) — 1등이 끝없이 앞서가지 않게
    if (this.lv >= 4 && this.lv >= this.avgLevel() + 3) { this.lv--; this.lx = 0; if (this.pts > 0) this.pts--; else { const k = this.upOrder.pop(); if (k && this.up[k] > 0) this.up[k]--; } this.toast('레벨 ' + this.lv + ' 로 내려감', '#FFB3B3', 2200); }
    else this.lx = Math.floor(this.lx * 0.6);
    if (this.pts <= 0) this.cards = null; else if (this.cards && this.cards.some(k => this.up[k] >= 5)) this.cards = this.newCards();
    this.sfx('die'); this.save();
  }

  // ── 위치 신호 ──
  // x,z,차체각,포탑각,체력%,종류+팀,레벨,깃발,발사번호(+곡사거리),격파,점수,팀점수,보낸시각(36진수),속도x,속도z
  //   깃발: 1 고르는 중/쓰러짐 · 2 보호 · 4 방어막 · 8 연막 · 16 질주 · 32 수리 구역 · 64 철갑탄
  serialize() {
    const deg = a => { let d = Math.round(a * 180 / Math.PI) % 360; if (d < 0) d += 360; return d; };
    const dead = !this.alive, now = this.now;
    const fl = (dead ? 1 : 0) | (this.spawnSafe ? 2 : 0) | (now < this.shieldUntil ? 4 : 0) | (now < this.smokeUntil ? 8 : 0) | (now < this.dashUntil ? 16 : 0) | (now < this.zoneUntil ? 32 : 0) | (this.apArmed ? 64 : 0);
    const r1 = v => { const x = Math.round(v * 10) / 10; return x === 0 ? '0' : String(x); };
    const head = [r1(this.x), r1(this.z), deg(this.h), deg(this.tu), dead ? 0 : Math.max(1, Math.round(this.hp / this.maxHpOf() * 100)), this.T.c + (this.team || ''), this.lv, fl,
      (this.shotSeq % 36).toString(36) + (this.T.lob && this.lob ? Math.round(this.lob) : ''), this.kills, this.score, this.ffa ? '' : this.ts].join(',');
    const tail = dead ? '0,0' : r1(this.vx) + ',' + r1(this.vz);
    if (head === this._sh && tail === this._st && this._ser) return this._ser;
    this._sh = head; this._st = tail;
    this._ser = head + ',' + (Math.round(this.srv()) % TK_STAMP_WRAP).toString(36) + ',' + tail;
    return this._ser;
  }
  static parse(raw) {
    const a = String(raw).split(','); if (a.length < 15) return null;
    const tt = a[5] || 'm', fl = +a[7] || 0, sh = a[8] || '0';
    return { x: +a[0], z: +a[1], h: (+a[2] || 0) * Math.PI / 180, tu: (+a[3] || 0) * Math.PI / 180, hp: +a[4] || 0, type: TK_BY_C[tt[0]] || 'medium', team: tt[1] || '', lv: +a[6] || 1, fl,
      seq: parseInt(sh[0], 36) || 0, lob: +sh.slice(1) || 0, kills: +a[9] || 0, score: +a[10] || 0, ts: +a[11] || 0, st: a[12] ? parseInt(a[12], 36) : null, vx: +a[13] || 0, vz: +a[14] || 0 };
  }
  applyPeerRaw(id, raw, name) {
    if (typeof raw !== 'string' || id === this.myId) return;
    let p = this.peers[id];
    if (p && p.raw === raw) { if (name) p.name = name; return; }
    const d = TankCore.parse(raw); if (!d || !isFinite(d.x) || !isFinite(d.z)) return;
    const now = this.now;
    if (!p) { p = this.peers[id] = { id, x: d.x, z: d.z, y: this.world.height(d.x, d.z), h: d.h, tu: d.tu, cx: 0, cz: 0, seq: d.seq, fl: 0, name: name || '' }; delete this.gone[id]; }
    if (d.st != null && p.st != null) { const ds = (d.st - p.st + TK_STAMP_WRAP) % TK_STAMP_WRAP; if (ds === 0 || ds > TK_STAMP_WRAP - 5000) { p.raw = raw; return; } }   // 더 오래된 신호면 버림
    p.raw = raw;
    // 신호 나이(기본 지연 + 흔들림) → 그만큼 속도로 앞당겨 그림 (fps3d 와 같은 방식)
    let age = TK_BASE_LAT * TK_LEAD;
    if (d.st != null) {
      const off = now - d.st, keep = p.off != null && Math.abs(off - p.off) < 5000;
      p.off = keep ? Math.min(off, p.off + Math.max(0, now - (p.at || now)) * 0.002) : off;
      const jit = Math.max(0, off - p.off);
      if (this.opts.serverNow) { const sa = ((Math.round(this.srv()) % TK_STAMP_WRAP) - d.st + TK_STAMP_WRAP) % TK_STAMP_WRAP; if (sa < 3000) { const b = Math.max(15, Math.min(300, sa - jit)); p.base = p.base == null ? b : p.base + (b - p.base) * 0.1; } }
      age = Math.min(600, ((p.base != null ? p.base : TK_BASE_LAT) + jit) * TK_LEAD); p.st = d.st;
    }
    { const iv = p.iv || this.opts.sendMs || 165; p.iv = p.at == null ? iv : (now - p.at < iv * 2.5 ? iv + (Math.max(40, now - p.at) - iv) * 0.15 : iv); p.tau = Math.max(100, Math.min(150, 100 * p.iv / 165)); }
    p.at = now;
    const wasDead = p.dead, had = p.tx != null, shownX = p.x, shownZ = p.z, oldFl = p.fl || 0, oldSeq = p.seq;
    Object.assign(p, { tx: d.x, tz: d.z, vx: d.vx, vz: d.vz, sAt: now - age, th: d.h, ttu: d.tu, hpPct: d.hp, type: d.type, team: d.team, lv: d.lv, fl: d.fl, dead: !!(d.fl & 1), prot: !!(d.fl & 2), shield: !!(d.fl & 4), smoke: !!(d.fl & 8), dash: !!(d.fl & 16), zone: !!(d.fl & 32), ap: !!(d.fl & 64), kills: d.kills, score: d.score, ts: d.ts, seq: d.seq, lob: d.lob });
    if (name) p.name = name;
    const g = this.predict(p, now);
    if (had && !p.dead && !wasDead && Math.hypot(shownX - g.x, shownZ - g.z) < 4) { p.cx = shownX - g.x; p.cz = shownZ - g.z; }
    else { p.cx = 0; p.cz = 0; p.x = g.x; p.z = g.z; p.h = p.th; p.tu = p.ttu; }
    // 연막 · 수리 구역이 막 켜졌으면 그 자리에 그림
    if ((d.fl & 8) && !(oldFl & 8)) this.smokes.push({ x: p.x, z: p.z, y: this.world.height(p.x, p.z), until: now + TK_SKILL.smoke[0].ms + 600, t0: now, peer: id });
    // 발사 번호가 바뀌었으면 그 방향으로 포탄을 그림 (맞히는 판정은 쏜 친구 기기에서)
    if (had && !p.dead && d.seq !== oldSeq) { const n = Math.min(3, (d.seq - oldSeq + 36) % 36); for (let i = 0; i < n; i++) this.ghostShot(p, i); }
  }
  predict(p, now) {
    const out = this._pr || (this._pr = { x: 0, z: 0 });
    const a = Math.max(0, Math.min(450, now - p.sAt)) / 1000; let x = p.tx, z = p.tz;
    if (!p.dead && (p.vx || p.vz) && a > 0) { x += p.vx * a; z += p.vz * a; }
    out.x = Math.max(0.5, Math.min(this.L - 0.5, x)); out.z = Math.max(0.5, Math.min(this.L - 0.5, z)); return out;
  }
  removePeer(id) { const p = this.peers[id]; if (p && !this.ffa && p.team && p.ts) this.gone[id] = { team: p.team, ts: p.ts }; delete this.peers[id]; }
  setPeers(map) { Object.keys(map).forEach(id => { const d = map[id]; if (d && d.raw) this.applyPeerRaw(id, d.raw, d.name); }); Object.keys(this.peers).forEach(id => { if (!map[id]) this.removePeer(id); }); }
  // 구조물 파괴 기록 (index.html 이 Firebase hazards 를 넘겨 줌 · 늦게 온 학생도 받음) — 기록 시각 + 다시 생기는 시간까지 부서진 채로
  setHazards(map) {
    this.hazards = map || {}; const srv = this.srv();
    for (const k in this.hazards) { const hz = this.hazards[k]; if (!hz || typeof hz.kind !== 'string' || hz.kind.indexOf('tk:') !== 0) continue;
      const o = this.world.obs[+hz.kind.slice(3)]; if (!o || !o.max) continue; const t = +hz.t || 0; if (t < this.startAt - 1000) continue;   // 지난 판 기록은 무시
      const until = t + TK_STRUCT[o.k].re; if (srv < until && until > o.until) { o.dead = true; o.until = until; o.hp = 0; } }
  }

  // ── 사건 받기 ──
  onEvent(e) {
    if (!e || typeof e !== 'object') return;
    const now = this.now, by = e.by, p = by ? this.peers[by] : null;
    if (e.type === 'hit') {
      const tp = this.peers[e.target];
      if (e.x != null) this.addFx(e.k === 'a' || e.big ? 'boom' : 'spark', +e.x, (tp ? this.world.height(+e.x, +e.z) : this.world.height(+e.x, +e.z)) + 1.2, +e.z, e.k === 'a' ? 1.2 : 0.6);
      if (e.target !== this.myId || this.gameOver || !this.alive || this.spawnSafe) return;
      let dmg = Math.max(0, +e.d || 0); if (now < this.shieldUntil) dmg *= TK_SKILL.shield[this.skTier].k; else if (now < this.dashUntil) dmg *= 0.6;   // 질주 중엔 빗맞음이 많아 피해 −40%
      dmg = Math.round(dmg); if (dmg <= 0) return;
      this.hp -= dmg; this.lastHurt = now; this.hurt = 1; if (by) this.dmgBy[by] = now;
      this.dmgNums.push({ x: this.x, y: this.y + 2.6, z: this.z, v: dmg, c: '#FF6B7E', t: 0 }); if (this.dmgNums.length > 24) this.dmgNums.shift();
      this.sfx('hurt');
      if (this.hp <= 0) this.die(by);
      return;
    }
    if (e.type === 'kill') {
      const victim = this.peers[by], vn = victim ? victim.name : '상대';
      if (e.target === this.myId) { if (this.gameOver) return; this.kills++; this.addXp(30 + 8 * (+e.vl || 1), 5); this.feedPush(this.myName || '나', vn, true, false); this.toast('격파! +' + (30 + 8 * (+e.vl || 1)) + ' XP', '#FFD166'); this.sfx('kill'); this.save(); return; }
      if (!this.ffa && typeof e.as === 'string' && e.as.split('|').indexOf(this.myId) >= 0 && !this.gameOver) { this.addXp(10 + 3 * (+e.vl || 1), 1); this.toast('도움 +' + (10 + 3 * (+e.vl || 1)) + ' XP', '#BFE3FF'); }
      const kp = this.peers[e.target]; this.feedPush(kp ? kp.name : '상대', vn, false, false);
      if (victim) this.addFx('boom', victim.x, this.world.height(victim.x, victim.z) + 1, victim.z, 2.2);
      return;
    }
    if (e.type === 'sd') { const o = this.world.obs[+e.s]; if (!o || !o.max || o.dead) return; o.hp -= Math.max(0, +e.d || 0);
      this.addFx('spark', o.x, o.y + o.h * 0.6, o.z, 0.5); if (o.hp <= 0) this.breakObs(o, +e.t || this.srv(), false); return; }
    if (e.type === 'bar' && p) { this.startBarrage(p.x, p.z, +e.x, +e.z, Math.min(12, +e.n || 6), false); return; }
    if (e.type === 'zone' && p) { this.zones.push({ x: +e.x, z: +e.z, until: now + Math.min(12000, +e.ms || 8000), hps: Math.min(30, +e.hps || 10), team: p.team }); return; }
  }
  feedPush(a, b, me, meVictim) { this.feed.unshift({ a: a || '?', b: b || '?', me, mv: meVictim, t: this.now + 4500 }); if (this.feed.length > 4) this.feed.length = 4; }

  // ── 구조물 ──
  breakObs(o, t, mine) {
    if (o.dead) return; o.dead = true; o.hp = 0; o.until = t + TK_STRUCT[o.k].re;
    this.addFx('boom', o.x, o.y + Math.min(2, o.h * 0.5), o.z, o.k === 'bunker' || o.k === 'tower' ? 2.4 : 1.2);
    if (mine) { const S = TK_STRUCT[o.k]; this.addXp(S.xp, S.tp); this.toast(S.name + ' 파괴 +' + S.xp + ' XP', '#C8F7A0', 1300); if (this.opts.onDropHazard) this.opts.onDropHazard(o.x, o.z, 'tk:' + o.id); }
  }
  damageObs(o, d) {
    if (!o.max || o.dead) return; o.hp -= d; this.sdQ[o.id] = (this.sdQ[o.id] || 0) + d;
    if (o.hp <= 0) { this.flushSd(true); this.breakObs(o, this.srv(), true); }
  }
  // 구조물 피해는 모아서 0.5초마다 한 번씩 알림 (사건 수 줄이기) — 부서지는 순간은 바로
  flushSd(force) {
    if (!force && this.now - this.sdAt < 500) return; this.sdAt = this.now;
    for (const k in this.sdQ) { const d = Math.round(this.sdQ[k]); if (d > 0 && this.opts.onAttack) this.opts.onAttack('sd', null, { s: +k, d }); }
    this.sdQ = {};
  }

  // ── 효과 (그리기 쪽이 씀 · 개수 제한) ──
  addFx(kind, x, y, z, s) { if (this.fx.length >= 60) this.fx.shift(); this.fx.push({ kind, x, y, z, s: s || 1, t: 0 }); }
  sfx(k, a) {
    if (typeof window === 'undefined' || !window.Sound) return; const S = window.Sound;
    try {
      if (k === 'fire') { const m = { light: 'smg', medium: 'rifle', heavy: 'shotgun', td: 'sniper', arty: 'throwBomb', eng: 'pistol' }[this.type] || 'pistol'; if (S[m]) S[m](); }
      else if (k === 'boom') { if (S.explosion) S.explosion(); }
      else if (k === 'hit') { if (S.hitmark) S.hitmark(); }
      else if (k === 'hurt') { if (S.hurt) S.hurt(); if (window.Haptic) window.Haptic.hit(); }
      else if (k === 'kill') { if (S.kill) S.kill(); }
      else if (k === 'die') { if (S.death) S.death(); }
      else if (k === 'level') { if (S.levelUp) S.levelUp(); }
      else if (k === 'up') { if (S.gem) S.gem(); }
      else if (k === 'skill') { const m = { dash: 'dash', smoke: 'boost', shield: 'boost', ap: 'reload', barrage: 'throwBomb', repair: 'heal' }[a] || 'boost'; if (S[m]) S[m](); if (window.Haptic) window.Haptic.big(); }
      else if (k === 'ready') { if (S.superReady) S.superReady(); }
    } catch (e) {}
  }

  // ── 조준 · 발사 ──
  // 자동 조준: 사거리(높은 곳 보너스) 안 · 지형에 안 막힌(곡사는 무관) 가장 가까운 적 — 연막 속 적은 가까울 때만
  pickTarget() {
    let best = null, bd = 1e9; const R = this.rangeOf(), lob = this.T.lob, my = this.y + 1.6;
    for (const id in this.peers) { const p = this.peers[id]; if (!this.isEnemy(p) || p.sel || p.prot) continue;
      const dx = p.x - this.x, dz = p.z - this.z, d = Math.sqrt(dx * dx + dz * dz); if (d > R * 1.3 + 3 || d >= bd) continue;
      const py = this.world.height(p.x, p.z); if (d > R * this.rangeBonus(py)) continue;
      if (p.smoke && d > 5) continue; if (lob && d < this.T.minR) continue;
      if (!lob && !this.world.los(this.x, my, this.z, p.x, py + 1.1, p.z)) continue;
      best = p; bd = d; }
    return best;
  }
  // 적이 사거리 밖이면: 앞쪽(차체 ±100°) 가까운 부술 수 있는 구조물을 겨눔 — 발사 버튼만 눌러도 상자를 부수며 XP 를 모음
  pickObs() {
    const R = Math.min(this.rangeOf() * 0.8, 24), W = this.world, my = this.y + 1.6; let best = null, bd = 1e9;
    W.near(this.x, this.z, R, o => { if (!o.max) return false; const dx = o.x - this.x, dz = o.z - this.z, d = Math.sqrt(dx * dx + dz * dz); if (d > R || d >= bd) return false;
      if (Math.abs(tkAng(Math.atan2(dz, dx) - this.h)) > 1.75) return false; if (!this.T.lob && !W.los(this.x, my, this.z, o.x, o.y + Math.min(1, o.h * 0.6), o.z)) return false; best = o; bd = d; return false; });
    return best;
  }
  rangeBonus(ty) { return 1 + Math.max(0, Math.min(0.25, (this.y - ty) * 0.04)); }   // 높은 곳: 사거리 +4%/m (최대 +25%)
  // 포탑이 바라볼 방향: 마우스 조준 > 자동 조준 > 차체 방향
  turretGoal() {
    if (this.aimDir != null && this.now < this.aimUntil) return this.aimDir;
    const t = this.target; if (t && !t.dead) return Math.atan2(this.aimZ - this.z, this.aimX - this.x);
    const o = this.tgtObs; if (o && !o.dead) return Math.atan2(o.z - this.z, o.x - this.x);
    return this.h;
  }
  // 앞당겨 쏘기: 상대 속도 × 날아가는 시간의 60%
  leadPoint(p) {
    const dx = p.x - this.x, dz = p.z - this.z, d = Math.sqrt(dx * dx + dz * dz), tf = this.T.lob ? this.lobTime(d) : d / this.velOf();
    const k = this.T.lob ? 0.85 : 0.6; this.aimX = p.x + (p.vx || 0) * tf * k; this.aimZ = p.z + (p.vz || 0) * tf * k;
  }
  lobTime(d) { return 0.55 + d / 38; }
  shoot() {
    const now = this.now, T = this.T; this.ammo -= 1; this.lastShot = now; this.wantFire = 0; this.protUntil = 0; this.shotSeq = (this.shotSeq + 1) % 36; this.recoil = 1;
    const a = this.tu, cos = Math.cos(a), sin = Math.sin(a), mx = this.x + cos * 1.9, mz = this.z + sin * 1.9, my = this.y + 1.55;
    let dmg = this.dmgOf(), ap = false;
    if (this.apArmed) { ap = true; this.apArmed = false; dmg = TK_SKILL.ap[this.skTier].dmg * (1 + 0.08 * this.up.dmg); }
    if (T.lob) {
      // 곡사: 조준점(또는 사거리 끝)까지 포물선 — 땅에 막히지 않음
      let tx, tz; const mo = this.aimDir != null && this.now < this.aimUntil;
      if (mo && this.aimPt) { tx = this.aimPt[0]; tz = this.aimPt[1]; } else if (!mo && this.target) { tx = this.aimX; tz = this.aimZ; } else if (!mo && this.tgtObs) { tx = this.tgtObs.x; tz = this.tgtObs.z; } else { tx = this.x + cos * this.rangeOf() * 0.8; tz = this.z + sin * this.rangeOf() * 0.8; }
      let dx = tx - this.x, dz = tz - this.z, d = Math.sqrt(dx * dx + dz * dz); const R = this.rangeOf() * this.rangeBonus(this.world.height(tx, tz));
      if (d < T.minR) { const k = T.minR / Math.max(0.01, d); dx *= k; dz *= k; d = T.minR; } if (d > R) { const k = R / d; dx *= k; dz *= k; d = R; }
      this.lob = d; const ex = this.x + dx, ez = this.z + dz;
      this.shells.push({ mine: true, lob: true, x: mx, z: mz, y: my, fx: mx, fz: mz, fy: my, ex, ez, ey: this.world.height(ex, ez), t: 0, T: this.lobTime(d), dmg, splash: T.splash, type: this.type });
    } else {
      // 직사: 총구 → 조준점(상대 몸통 높이) 직선. 언덕 · 구조물에 막힘
      let tx, ty, tz; const R = this.rangeOf();
      const mo = this.aimDir != null && this.now < this.aimUntil;
      if (this.target && !mo) { tx = this.aimX; tz = this.aimZ; ty = this.world.height(tx, tz) + 1.0; }
      else if (this.tgtObs && !mo) { const o = this.tgtObs; tx = o.x; tz = o.z; ty = o.y + Math.min(1, o.h * 0.6); }
      else { tx = this.x + cos * R; tz = this.z + sin * R; ty = this.world.height(tx, tz) + 1.0; }
      const dx = tx - mx, dy = ty - my, dz = tz - mz, l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1, v = this.velOf() * (ap ? 1.3 : 1);
      // 높이 차이는 수평 거리에 맞춘 기울기로 (멀리 빗나간 조준은 수평)
      const hz = Math.sqrt(dx * dx + dz * dz) || 1, slope = Math.max(-0.5, Math.min(0.5, dy / hz));
      this.shells.push({ mine: true, x: mx, y: my, z: mz, vx: dx / hz * v, vz: dz / hz * v, vy: slope * v, left: R * (ap ? 1.25 : 1.08) * this.rangeBonus(ty - 1), dmg, ap, pierce: ap, hitIds: ap ? {} : null, type: this.type });
    }
    this.sfx('fire');
  }
  // 다른 친구의 포탄 그림 (판정 없음)
  ghostShot(p, i) {
    const T = TK_TYPES[p.type] || TK_TYPES.medium, a = p.ttu, cos = Math.cos(a), sin = Math.sin(a), py = this.world.height(p.x, p.z);
    const mx = p.x + cos * 1.9, mz = p.z + sin * 1.9, my = py + 1.55;
    if (T.lob) { const d = Math.max(T.minR, Math.min(T.range * 1.6, p.lob || T.range * 0.8)), ex = p.x + cos * d, ez = p.z + sin * d;
      this.shells.push({ ghost: true, lob: true, x: mx, z: mz, y: my, fx: mx, fz: mz, fy: my, ex, ez, ey: this.world.height(ex, ez), t: -i * 0.05, T: this.lobTime(d), splash: T.splash, type: p.type }); }
    else { const v = T.vel * (p.ap ? 1.3 : 1); this.shells.push({ ghost: true, x: mx, y: my, z: mz, vx: cos * v, vz: sin * v, vy: 0, left: T.range * 1.15, ap: p.ap, pierce: p.ap, hitIds: {}, type: p.type, delay: i * 0.12, owner: p.id }); }
    if (this.shells.length > 160) this.shells.splice(0, this.shells.length - 160);
  }

  // ── 한 프레임 ──
  step(now) {
    const dtm = this.lastTime ? Math.max(0, Math.min(50, now - this.lastTime)) : 16.7; if (now >= this.lastTime) { this.lastTime = now; this.now = now; }
    const dt = dtm / 1000, srv = this.srv();
    this.matchLeft = Math.max(0, this.endAt - srv); this.started = srv >= this.startAt;
    if (this.gameOver) return dt;
    if (srv >= this.endAt) { this.finish(); return dt; }
    // 다른 전차: 예측 위치 + 남은 보정
    for (const id in this.peers) { const p = this.peers[id]; if (p.tx == null) continue;
      const kc = 1 - Math.exp(-dtm / (p.tau || 100)); p.cx -= p.cx * kc; p.cz -= p.cz * kc;
      const g = this.predict(p, now); p.x = g.x + p.cx; p.z = g.z + p.cz;
      const k = 1 - Math.exp(-dtm / 70); p.h += tkAng(p.th - p.h) * k; p.tu += tkAng(p.ttu - p.tu) * k; p.sel = p.dead; }
    // 고르기 · 출격
    if (!this.alive) {
      if (this.sel.open && !this.sel.until) this.sel.until = now + Math.max(TK_PICK_MS, (this.startAt - srv) + 600);
      if (this.sel.open && now >= this.sel.until) this.chooseType(this.type);
      if (!this.sel.open && now >= this.respawnAt && this.started) this.spawn();
    }
    if (this.alive) this.stepTank(dt, now);
    else { this.vx = this.vz = 0; }
    this.stepShells(dt, now);
    // 포격(스킬) 순서대로 떨어뜨림
    for (let i = this.barr.length - 1; i >= 0; i--) { const b = this.barr[i]; if (now < b.at) continue; this.barr.splice(i, 1);
      const r = 3.2 * Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2, ex = Math.max(1, Math.min(this.L - 1, b.x + Math.cos(a) * r)), ez = Math.max(1, Math.min(this.L - 1, b.z + Math.sin(a) * r)), fy = this.world.height(b.fx, b.fz) + 2;
      const d = Math.hypot(ex - b.fx, ez - b.fz);
      this.shells.push({ mine: b.mine, ghost: !b.mine, lob: true, x: b.fx, z: b.fz, y: fy, fx: b.fx, fz: b.fz, fy, ex, ez, ey: this.world.height(ex, ez), t: 0, T: 0.6 + d / 34, dmg: 26 * (1 + 0.08 * this.up.dmg), splash: 3.0, type: 'arty', bar: true }); }
    // 구조물 다시 생김 (서버 시각 기준)
    if (!this._reT || now - this._reT > 500) { this._reT = now; for (const o of this.world.obs) if (o.dead && srv >= o.until) { o.dead = false; o.hp = o.max; } }
    // 효과 · 글자 정리
    for (let i = this.fx.length - 1; i >= 0; i--) { const f = this.fx[i]; f.t += dt / (f.kind === 'boom' ? 0.9 : 0.35); if (f.t >= 1) this.fx.splice(i, 1); }
    for (let i = this.dmgNums.length - 1; i >= 0; i--) { const d = this.dmgNums[i]; d.t += dt * 1.1; if (d.t >= 1) this.dmgNums.splice(i, 1); }
    if (this.smokes.length) this.smokes = this.smokes.filter(s => s.until > now);
    if (this.zones.length) this.zones = this.zones.filter(z => z.until > now);
    if (this.mines.length) this.mines = this.mines.filter(m => m.until > now);
    if (this.toasts.length) this.toasts = this.toasts.filter(t => t.until > now);
    if (this.feed.length) this.feed = this.feed.filter(f => f.t > now);
    this.hurt = Math.max(0, (this.hurt || 0) - dt * 2.5); this.recoil = Math.max(0, (this.recoil || 0) - dt * 4);
    this.flushSd(false);
    if (!this._svT || now - this._svT > 3000) { this._svT = now; this.save(); }
    return dt;
  }
  stepTank(dt, now) {
    const T = this.T, W = this.world;
    // 재장전 · 스킬 충전
    if (this.ammo < 3) this.ammo = Math.min(3, this.ammo + dt / this.reloadOf());
    const wasReady = this.super >= 100; this.super = Math.min(100, (now - this.skAt) / this.cdOf() * 100); if (!wasReady && this.super >= 100) this.sfx('ready');
    if (this.apArmed && now > this.apUntil) this.apArmed = false;
    // 이동: 조이스틱 방향으로 차체를 돌리며 감 (많이 돌아야 하면 먼저 제자리 회전)
    const len = Math.min(1, Math.hypot(this.mx, this.my)); let sp = 0;
    let rev = false;
    if (len > 0.12) {
      let goal = Math.atan2(this.my, this.mx); const turn = T.turn * dt * (now < this.dashUntil ? 1.3 : 1);
      // 전투 중(표적이 있을 때) 차체 뒤쪽으로 당기면 앞(두꺼운 장갑 · 포)을 적에게 둔 채 후진
      if ((this.target || (this.rev && now - this.revAt < 400)) && Math.abs(tkAng(goal - this.h)) > (this.rev ? 1.75 : 2.1)) { rev = true; goal = tkAng(goal + Math.PI); this.revAt = now; }
      const da = tkAng(goal - this.h); this.h = tkAng(this.h + Math.max(-turn, Math.min(turn, da)));
      const c = Math.cos(tkAng(goal - this.h)); sp = this.speedOf() * len * (c > 0 ? Math.sqrt(c) : 0) * (rev ? 0.65 : 1);
    } else if (T.arc && this.alive && (this.target || (this.aimDir != null && now < this.aimUntil))) {
      // 구축전차: 가만히 있을 때 표적(또는 마우스로 겨눈 쪽)이 포탑 범위 밖이면 차체를 그쪽으로
      const da = tkAng((this.aimDir != null && now < this.aimUntil ? this.aimDir : Math.atan2(this.aimZ - this.z, this.aimX - this.x)) - this.h); if (Math.abs(da) > T.arc * 0.8) { const turn = T.turn * dt; this.h = tkAng(this.h + Math.max(-turn, Math.min(turn, da))); }
    }
    this.rev = rev;
    let vx = 0, vz = 0;
    if (sp > 0) {
      const cx = Math.cos(this.h) * (rev ? -1 : 1), cz = Math.sin(this.h) * (rev ? -1 : 1);
      // 경사: 오르막은 느리게, 너무 가파르면(절벽) 못 감 · 내리막은 조금 빠르게 · 진흙/물은 느리게
      const ah = W.height(this.x + cx * 0.9, this.z + cz * 0.9), s = (ah - this.y) / 0.9;
      const m = W.matAt(this.x, this.z), mk = m === 2 ? 0.5 : m === 1 ? 0.68 : 1;
      const sk = s > 0 ? 1 - 0.6 * Math.min(1, s / 0.95) : 1 + 0.15 * Math.min(1, -s / 0.95);
      sp *= mk * sk; vx = cx * sp; vz = cz * sp;
    }
    const ox = this.x, oz = this.z;
    if (vx || vz) { const nx = this.x + vx * dt, nz = this.z + vz * dt;
      if (this.canGo(nx, nz)) { this.x = nx; this.z = nz; } else if (this.canGo(nx, this.z)) this.x = nx; else if (this.canGo(this.x, nz)) this.z = nz; }
    this.pushOut();
    this.y = W.height(this.x, this.z);
    // 실제 속도 (신호에 실음 · 받는 쪽 예측)
    const iv = 1 / Math.max(1e-3, dt), k = Math.min(1, dt * 12); this.vx += ((this.x - ox) * iv - this.vx) * k; this.vz += ((this.z - oz) * iv - this.vz) * k;
    if (Math.abs(this.vx) < 0.05 && !(vx || vz)) this.vx = 0; if (Math.abs(this.vz) < 0.05 && !(vx || vz)) this.vz = 0;
    // 조준: 0.15초마다 표적을 다시 고름
    if (now - this.tgtAt > 150) { this.tgtAt = now; this.target = this.pickTarget(); this.tgtObs = this.target ? null : this.pickObs(); }
    if (this.target) { if (!this.peers[this.target.id] || this.target.dead) this.target = null; else this.leadPoint(this.target); }
    const goal = this.turretGoal(), tr = T.tur * dt; let dtu = tkAng(goal - this.tu);
    this.tu = tkAng(this.tu + Math.max(-tr, Math.min(tr, dtu)));
    if (T.arc) { const rel = tkAng(this.tu - this.h); if (Math.abs(rel) > T.arc) this.tu = tkAng(this.h + Math.sign(rel) * T.arc); }
    dtu = tkAng(goal - this.tu);
    // 발사: 포탑이 표적을 향하면(±6°) 쏨 — 버튼을 누른 뒤 1.5초 안
    if (this.wantFire && now <= this.wantFire && this.ammo >= 1 && now - this.lastShot >= T.gap * 1000 * (1 - 0.08 * this.up.rel) && (Math.abs(dtu) < 0.1 || (!this.target && !this.tgtObs && this.aimDir == null))) this.shoot();
    if (this.wantFire && now > this.wantFire) this.wantFire = 0;
    // 수리: 6초간 안 맞으면 천천히 · 정비전차 곁(팀) · 수리 구역
    const mh = this.maxHpOf(); let heal = 0;
    if (now - this.lastHurt > 6000) heal += mh * 0.02;
    if (this.type === 'eng') heal += (this.ffa ? 3.5 : 1.5) + (now - this.lastHurt > 3000 ? 3 : 0);   // 정비전차: 늘 조금씩 스스로 수리 (안 맞으면 더)
    if (!this.ffa) { for (const id in this.peers) { const p = this.peers[id]; if (p.type === 'eng' && !p.dead && p.team === this.team && (p.x - this.x) * (p.x - this.x) + (p.z - this.z) * (p.z - this.z) < 81) { heal += 4; break; } }
      for (const z of this.zones) if (z.team === this.team && (z.x - this.x) * (z.x - this.x) + (z.z - this.z) * (z.z - this.z) < 49) { heal += z.hps; break; } }
    if (heal > 0 && this.hp < mh) this.hp = Math.min(mh, this.hp + heal * dt);
    // 지뢰 (개인전 정비전차): 적이 밟으면 터짐 — 판정은 설치한 내 기기
    for (let i = this.mines.length - 1; i >= 0; i--) { const mn = this.mines[i]; if (now < mn.armAt) continue;
      for (const id in this.peers) { const p = this.peers[id]; if (!this.isEnemy(p) || p.prot) continue;
        if ((p.x - mn.x) * (p.x - mn.x) + (p.z - mn.z) * (p.z - mn.z) < 3.2) { this.mines.splice(i, 1); this.sendHit(p, mn.dmg, mn.x, mn.z, true); this.addFx('boom', mn.x, this.world.height(mn.x, mn.z) + 0.5, mn.z, 1.6); this.sfx('boom'); break; } } }
  }
  // 갈 수 있는 곳인지 (맵 안 · 구조물 · 장식 · 다른 전차)
  canGo(x, z) {
    const r = this.T.r, L = this.L; if (x < r + 0.5 || z < r + 0.5 || x > L - r - 0.5 || z > L - r - 0.5) return false;
    // 절벽: 가는 쪽 차체 앞 끝의 높이 차이가 너무 크면 못 감 (오르막 0.95 · 내리막 1.25 넘게 가파르면)
    const d = Math.hypot(x - this.x, z - this.z);
    if (d > 1e-4) { const h1 = this.world.height(x, z), cx = (x - this.x) / d, cz = (z - this.z) / d, fh = this.world.height(x + cx * r * 0.9, z + cz * r * 0.9); if ((fh - h1) / (r * 0.9) > 0.95 || (h1 - fh) / (r * 0.9) > 1.25) return false; }
    if (this.world.near(x, z, r + 0.2, o => TkWorld.hitsObs(o, x, z, r))) return false;
    return true;
  }
  // 다른 전차와 겹치면 내 전차만 살짝 밀어냄
  pushOut() {
    const r = this.T.r;
    for (const id in this.peers) { const p = this.peers[id]; if (p.dead || p.tx == null) continue; const pr = (TK_TYPES[p.type] || TK_TYPES.medium).r, dx = this.x - p.x, dz = this.z - p.z, d = Math.sqrt(dx * dx + dz * dz), m = r + pr - 0.2;
      if (d < m && d > 1e-4) { const k = (m - d) * 0.5, nx = this.x + dx / d * k, nz = this.z + dz / d * k; if (this.canGo(nx, nz)) { this.x = nx; this.z = nz; } } }
  }
  // 명중 알림 (쏜 사람 기기 기준): 피해 = 기본 × 유형 상성 × 장갑 각도
  dmgTo(p, base, dirx, dirz, top) {
    const PT = TK_TYPES[p.type] || TK_TYPES.medium; let d = base * TK_VS[this.type][p.type];
    if (!top) { const inc = Math.atan2(-dirz, -dirx), rel = Math.abs(tkAng(inc - p.h));
      if (rel < 0.87) d *= this.T.pierce ? Math.max(0.95, PT.front) : PT.front; else if (rel > 2.27) d *= 1.25; }
    return Math.max(1, Math.round(d));
  }
  sendHit(p, dmg, x, z, big) {
    if (!p || p.dead) return;
    if (this.opts.onAttack) this.opts.onAttack('hit', p.id, { d: dmg, k: this.T.c, x: +x.toFixed(1), z: +z.toFixed(1) });
    this.addXp(dmg * 0.25, 0); this.hitMark = this.now + 220;
    this.dmgNums.push({ x: p.x, y: this.world.height(p.x, p.z) + 2.6, z: p.z, v: dmg, c: '#FFD166', t: 0 }); if (this.dmgNums.length > 24) this.dmgNums.shift();
    this.sfx('hit');
  }
  stepShells(dt, now) {
    const W = this.world;
    for (let i = this.shells.length - 1; i >= 0; i--) { const s = this.shells[i];
      if (s.lob) {
        s.t += dt; const k = Math.max(0, s.t / s.T); if (k < 0) continue;
        const kk = Math.min(1, k), apex = 3 + Math.hypot(s.ex - s.fx, s.ez - s.fz) * 0.22;
        s.x = s.fx + (s.ex - s.fx) * kk; s.z = s.fz + (s.ez - s.fz) * kk; s.y = s.fy + (s.ey - s.fy) * kk + apex * 4 * kk * (1 - kk);
        if (k >= 1) { this.shells.splice(i, 1); this.lobLand(s); }
        continue;
      }
      if (s.delay > 0) { s.delay -= dt; continue; }
      let mv = Math.hypot(s.vx, s.vz) * dt, done = false; const n = Math.max(1, Math.ceil(mv / 0.6)), sx = s.vx * dt / n, sy = s.vy * dt / n, sz = s.vz * dt / n;
      for (let j = 0; j < n && !done; j++) {
        s.x += sx; s.y += sy; s.z += sz; s.left -= mv / n;
        const gh = W.height(s.x, s.z);
        if (s.y < gh + 0.05) { done = true; this.addFx('dirt', s.x, gh + 0.2, s.z, 0.7); break; }
        if (s.left <= 0 || s.x < 0 || s.z < 0 || s.x > this.L || s.z > this.L) { done = true; this.addFx('puff', s.x, s.y, s.z, 0.5); break; }
        // 전차 (내 탄은 다른 친구 · 친구 탄은 나도 포함해 그림만)
        if (s.mine) { for (const id in this.peers) { const p = this.peers[id]; if (p.dead || p.tx == null || (s.hitIds && s.hitIds[id])) continue; if (!this.isEnemy(p)) continue;
            const pr = (TK_TYPES[p.type] || TK_TYPES.medium).r + 0.3, dx = s.x - p.x, dz = s.z - p.z; if (dx * dx + dz * dz > pr * pr) continue;
            const py = W.height(p.x, p.z); if (s.y > py + 2.8) continue;
            if (!p.prot) this.sendHit(p, this.dmgTo(p, s.dmg, s.vx, s.vz, false), s.x, s.z, s.ap); this.addFx('spark', s.x, s.y, s.z, s.ap ? 1.2 : 0.8);
            if (s.pierce) s.hitIds[id] = 1; else { done = true; break; } } }
        else if (s.ghost) { const tryHit = (x, z, y, r, id) => { if (id === s.owner || (s.hitIds && s.hitIds[id])) return false; const dx = s.x - x, dz = s.z - z; if (dx * dx + dz * dz > r * r || s.y > y + 2.8) return false; if (s.pierce) { s.hitIds[id] = 1; return false; } return true; };
          if (this.alive && tryHit(this.x, this.z, this.y, this.T.r + 0.3, this.myId)) { done = true; this.addFx('spark', s.x, s.y, s.z, 0.8); break; }
          for (const id in this.peers) { const p = this.peers[id]; if (p.dead || p.tx == null) continue; if (tryHit(p.x, p.z, W.height(p.x, p.z), (TK_TYPES[p.type] || TK_TYPES.medium).r + 0.3, id)) { done = true; this.addFx('spark', s.x, s.y, s.z, 0.8); break; } }
          if (done) break; }
        // 구조물 · 나무 · 바위
        const ob = W.near(s.x, s.z, 0.4, o => s.y < o.y + o.h && TkWorld.hitsObs(o, s.x, s.z, 0.25));
        if (ob) { if (s.mine && ob.max) this.damageObs(ob, s.ap ? s.dmg * 1.5 : s.dmg); this.addFx(ob.max ? 'spark' : 'dirt', s.x, s.y, s.z, 0.7); if (!(s.ap && ob.max && ob.dead)) { done = true; break; } }
      }
      if (done) this.shells.splice(i, 1);
    }
  }
  // 곡사탄 착지: 범위 피해 (가운데 100% → 가장자리 40%) · 구조물도
  lobLand(s) {
    const W = this.world; this.addFx('boom', s.ex, s.ey + 0.6, s.ez, s.bar ? 1.2 : 1.6);
    if (!s.mine) return;
    if (Math.hypot(s.ex - this.x, s.ez - this.z) < 30) this.sfx('boom');
    const R = s.splash;
    for (const id in this.peers) { const p = this.peers[id]; if (!this.isEnemy(p) || p.tx == null) continue; const d = Math.hypot(p.x - s.ex, p.z - s.ez); if (d > R + 0.6) continue;
      if (Math.abs(W.height(p.x, p.z) - s.ey) > 3) continue; if (p.prot) continue;
      this.sendHit(p, this.dmgTo(p, s.dmg * (1 - 0.65 * Math.min(1, d / (R + 0.6))), 0, 0, true), p.x, p.z, true); }
    W.near(s.ex, s.ez, R, o => { if (o.max && Math.hypot(o.x - s.ex, o.z - s.ez) < R + o.rad * 0.5) this.damageObs(o, s.dmg * 0.7); return false; });
  }
  // ── 교사 미니보드: 36×36 칸 (높이 4단계 · 물 · 구조물 · 나무 · 전차) ──
  getSnapshot() {
    const G = 36, W = this.world, L = this.L;
    if (!this._snapBase) { const b = this._snapBase = [];
      for (let y = 0; y < G; y++) { const row = []; for (let x = 0; x < G; x++) { const wx = (x + 0.5) / G * L, wz = (y + 0.5) / G * L, h = W.height(wx, wz);
          row.push(W.matAt(wx, wz) === 2 ? 58 : h < 0.6 ? 66 : h < 2 ? 12 : h < 3.6 ? 63 : 45); } b.push(row); }
      W.obs.forEach(o => { if (o.k === 'tree') { const gx = Math.floor(o.x / L * G), gy = Math.floor(o.z / L * G); if (b[gy] && b[gy][gx] != null && b[gy][gx] !== 58) b[gy][gx] = 65; } }); }
    const g = this._snapBase.map(r => r.slice()), put = (x, z, v) => { const gx = Math.floor(x / L * G), gy = Math.floor(z / L * G); if (g[gy] && g[gy][gx] != null) g[gy][gx] = v; };
    for (const o of W.obs) if (o.max && !o.dead && (o.k === 'bunker' || o.k === 'tower' || o.k === 'sandbag')) put(o.x, o.z, 57);
    for (const id in this.peers) { const p = this.peers[id]; if (p.dead || p.tx == null) continue; put(p.x, p.z, this.ffa ? 68 : p.team === 'b' ? 69 : 68); }
    if (this.alive) put(this.x, this.z, 23);
    return g;
  }
  // ── 판 끝 ──
  teamScores() {
    const t = { r: 0, b: 0 }; if (this.ffa) return t;
    if (this.team) t[this.team] += this.ts;
    for (const id in this.peers) { const p = this.peers[id]; if (p.team === 'r' || p.team === 'b') t[p.team] += p.ts || 0; }
    for (const id in this.gone) { const g = this.gone[id]; t[g.team] += g.ts || 0; }
    return t;
  }
  standings() {
    const list = [{ id: this.myId, name: this.myName || '나', score: this.score, kills: this.kills, lv: this.lv, team: this.team, me: true }];
    for (const id in this.peers) { const p = this.peers[id]; list.push({ id, name: p.name || '?', score: p.score || 0, kills: p.kills || 0, lv: p.lv || 1, team: p.team }); }
    return list.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
  }
  finish() {
    if (this.gameOver) return;
    const st = this.standings(), rank = st.findIndex(s => s.me) + 1, ts = this.teamScores();
    const win = this.ffa ? rank === 1 : (this.team ? ts[this.team] > ts[this.team === 'r' ? 'b' : 'r'] : false);
    const tie = !this.ffa && ts.r === ts.b;
    this.result = { rank, total: st.length, ts, win, tie, top: st.slice(0, 5) };
    this.gameOver = true; this.alive = false; this.cards = null; this.sel.open = false; this.save();
    if (this.opts.onFinish) this.opts.onFinish(win);
    this.sfx(win ? 'level' : 'die');
  }
}
if (typeof window !== 'undefined') { window.TankCore = TankCore; window.TK_MAPS = TK_MAPS; window.TK_TYPES = TK_TYPES; window.tkSizeFor = tkSizeFor; window.TkWorld = TkWorld; }
