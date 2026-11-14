// 장애물 대탈출 3D — 규칙 · 코스 · 통신 (그림 · HUD 는 obst3d-engine.js 의 ObstGame)
//   · 하늘에 뜬 장애물 코스를 모두 함께 달려 결승선까지. 코스(구간 모듈을 이어 붙임) 3종이 seed 순서로 돌아가며 이어짐
//   · 장애물은 모두 seed(판 시작 시각) + 서버 시계의 함수 → 모든 화면에서 같은 순간 같은 위치 (통신 없음)
//   · 각 기기는 자기 캐릭터만 움직임(떨어짐 · 밀림 · 체크포인트 · 결승 = 내 화면이 정함). 위치는 짧은 문자열로 165~235ms 마다
//   · 결승 도착 = 사건 'ofin'(도착 순간 서버 시각) + 위치 신호에도 같은 값(유실 대비) → 모든 화면이 같은 시각으로 정렬 → 같은 순위 · 같은 점수
//     (시계가 어긋나도 공정: 출발도 도착도 각자 서버 시계로 재므로 '걸린 시간' 순서)
//   · 코스 끝 = 제한 90초 · 1등 도착 + 30초 · '모두 도착' 제안(사건 'oend', 1.5초 뒤 시각) 중 가장 이른 것 — 모두 같은 자료로 셈 → 같은 순간
//     제안은 남아 있는 누구든(가장 작은 id) 보내므로 한 기기가 나가도 진행됨. 끝 → 순위 6초 → 다음 코스 출발 준비 3.5초 → 출발
//   · 늦게 들어온 학생: 친구 신호에서 지금 코스 · 시각을 받아 다음 코스부터(막 출발했으면 바로). 새로고침: sessionStorage 로 점수 · 코스 이어서
//   · 시간 제한(opts.endAt): 끝나면 1.5초 동안 막 들어온 도착 소식을 모은 뒤 finish('time') — 그 순간까지 도착한 기록으로 점수
//     시간 제한이 없으면 4코스 뒤 finish('goal')

const OB_FONT = "'Lilita One', Pretendard, sans-serif";
const OB_PRE0 = 3000, OB_PRE = 3500, OB_RES = 6000, OB_LIMIT = 90000, OB_AFTER = 30000, OB_GRACE = 1500, OB_MAXC = 4;
const OB_PTS = [100, 85, 75, 68, 62, 57, 53, 50, 47, 44, 41, 38, 35, 32, 30];
const OB_HALF_PTS = 10;
const OB_WRAP = 60466176;      // 36^5 ms ≈ 16.8시간 — 보낸 시각(서버 ms) 을 base36 5글자로
const OB_W = [10, 12.5, 15];   // 인원(≤12 · ≤20 · 그 이상)별 코스 폭
const OB_G = 30, OB_JUMP = 11.2, OB_SPEED = 7, OB_R = 0.42, OB_H = 1.3, OB_STEP = 0.4, OB_KILL = -14;
const obPts = p => p <= OB_PTS.length ? OB_PTS[p - 1] : Math.max(20, 30 - (p - OB_PTS.length));
const obB36 = v => Math.max(0, Math.round(v)).toString(36);
const obClock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function obHash(a, b, c) { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function obRng(seed) { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

// ── 코스 3종 (가운데 구간은 4번째 코스부터 seed 로 섞음) ──
const OB_COURSES = [
  { id: 'cloud', name: '구름 언덕', mods: ['sweep', 'tiles', 'hammer', 'movers', 'pads'], sky: [0x4C9DF0, 0xCDE9FF], fog: 0xCFE6FF, plat: [0xFF4F8B, 0xFFB81C, 0x2FB8FF, 0x7A5CFF, 0x22C97A] },
  { id: 'candy', name: '사탕 공장', mods: ['conveyor', 'walls', 'balls', 'beams', 'sweep'], sky: [0x6A8DF5, 0xFFD8EE], fog: 0xFFE0F0, plat: [0xFF3E9A, 0x1FD1B9, 0xFFC93C, 0x9B6BFF, 0xFF7A3D] },
  { id: 'ice', name: '얼음 계곡', mods: ['ice', 'hammer', 'tiles', 'balls', 'movers'], sky: [0x3F8FE0, 0xE3F4FF], fog: 0xDDEFFF, plat: [0x3FA9F5, 0xE8F4FF, 0x6C7CFF, 0x19C6E6, 0xFF6B8B] }
];
const OB_MOD_NAME = { sweep: '빙글 막대', tiles: '사라지는 발판', hammer: '흔들 망치', movers: '움직이는 발판', pads: '점프대', conveyor: '컨베이어', walls: '미는 벽', balls: '굴러오는 공', beams: '좁은 다리', ice: '미끄러운 얼음' };
const OB_THEME = id => OB_COURSES.find(c => c.id === id) || OB_COURSES[0];

// ── 한 코스: 발판(plats) · 장애물(obs) · 체크포인트(cps) ──
//   발판 kind: 0 보통 · 1 얼음 · 2 컨베이어 · 3 점프대 · 4 사라지는 발판 · 5 움직이는 발판 · 6 경사(z 방향)
class ObCourse {
  constructor(seed, k, wl) {
    const order = ObCourse.order(seed), ci = order[k % 3], th = OB_COURSES[ci];
    this.k = k; this.theme = th; this.name = th.name; this.W = OB_W[Math.max(0, Math.min(2, wl | 0))];
    const rng = this.rng = obRng(Math.floor(seed / 977) * 31 + k * 7919 + 13);
    let mods = th.mods.slice();
    if (k >= 3) { for (let i = mods.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = mods[i]; mods[i] = mods[j]; mods[j] = t; } }
    this.mods = mods; this.plats = []; this.obs = []; this.cps = []; this.deco = [];
    this.zc = 0; this.yc = 0; this.seedI = (Math.floor(seed / 1000) % 1000003) + k * 131;
    this.addStart();
    mods.forEach(m => this['m_' + m]());
    this.addFinish();
    this.halfCp = Math.max(1, Math.ceil((this.cps.length - 1) / 2));
    this.buildIndex();
  }
  static order(seed) { const r = obRng((Math.floor(seed / 1000) % 1000003) + 77), a = [0, 1, 2]; for (let i = 2; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  plat(o) { const p = Object.assign({ kind: 0, bot: (o.top != null ? o.top : this.yc) - 1.2, col: 0 }, o); if (p.top == null) p.top = this.yc; if (o.bot == null) p.bot = p.top - (p.kind === 4 || p.kind === 5 ? 0.5 : 1.2); p.i = this.plats.length; this.plats.push(p); return p; }
  apron(len, extra) {   // 구간 앞 체크포인트 발판
    const W = this.W, z0 = this.zc, p = this.plat(Object.assign({ x0: -W / 2, x1: W / 2, z0, z1: z0 + len, cp: this.cps.length, col: 4 }, extra || {}));
    this.cps.push({ i: this.cps.length, z: z0 + len * 0.5, top: p.top, x0: p.x0, x1: p.x1, zz0: z0, zz1: z0 + len });
    this.zc += len; return p;
  }
  addStart() {
    const W = this.W; this.plat({ x0: -W / 2 - 1, x1: W / 2 + 1, z0: -11, z1: 3, cp: 0, col: 1 });
    this.cps.push({ i: 0, z: -4, top: 0, x0: -W / 2 - 1, x1: W / 2 + 1, zz0: -11, zz1: 3, start: true });
    this.startLine = 1.5; this.zc = 3;
  }
  addFinish() {
    const W = this.W; this.gap(1.2);
    const p = this.plat({ x0: -W / 2 - 1.5, x1: W / 2 + 1.5, z0: this.zc, z1: this.zc + 16, col: 1, fin: true });
    this.finishZ = this.zc + 2.5; this.finTop = p.top; this.len = this.zc + 16; this.finZ0 = this.zc;
    this.deco.push({ t: 'arch', z: this.finishZ, y: p.top, w: W + 2 });
  }
  gap(d) { this.zc += d; }
  // ── 구간 모듈 ──
  m_sweep() {
    const W = this.W, r = this.rng; this.apron(3); this.gap(1.2);
    const L = 15, z0 = this.zc, top = this.yc; this.plat({ x0: -W / 2, x1: W / 2, z0, z1: z0 + L, col: 2 });
    const two = W >= 12.5, w = (1.55 + r() * 0.5) * (r() < 0.5 ? 1 : -1);
    if (two) { const R = W * 0.28; [-1, 1].forEach((s, i) => this.obs.push({ type: 'sweep', cx: s * W * 0.25, cz: z0 + L / 2, y: top, R, w: i ? -w : w, ph: r() * 6.28 })); }
    else this.obs.push({ type: 'sweep', cx: 0, cz: z0 + L / 2, y: top, R: Math.min(W * 0.55, L * 0.48), w, ph: r() * 6.28 });
    this.obs.push({ type: 'sweep', cx: 0, cz: z0 + L / 2, y: top, R: 0, w: 0, ph: 0, hub: true });
    this.zc += L;
  }
  m_tiles() {
    const W = this.W, r = this.rng; this.apron(3); this.gap(0.3);
    const cols = Math.max(4, Math.round(W / 2.4)), rows = 5, cw = W / cols, P = 3.6 + r() * 0.8, z0 = this.zc;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const ph = ((i % 3) / 3 + j * 0.27 + r() * 0.08) * P;
      this.plat({ kind: 4, x0: -W / 2 + i * cw + 0.12, x1: -W / 2 + (i + 1) * cw - 0.12, z0: z0 + j * 2.4 + 0.12, z1: z0 + (j + 1) * 2.4 - 0.12, per: P, ph, col: (i + j) % 2 ? 0 : 3 });
    }
    this.zc += rows * 2.4 + 0.3;
  }
  m_hammer() {
    const W = this.W, r = this.rng; this.apron(3); this.gap(0.6);
    const ww = Math.max(5, W * 0.62), L = 20, z0 = this.zc, top = this.yc; this.plat({ x0: -ww / 2, x1: ww / 2, z0, z1: z0 + L, col: 3 });
    const n = 3, A = 1.0, arm = 6.2, w = 1.7 + r() * 0.4;
    for (let i = 0; i < n; i++) this.obs.push({ type: 'hammer', px: 0, py: top + arm + 1.0, pz: z0 + 3.5 + i * 6.2, L: arm, A, w, ph: i * 2.1 + r(), hr: 1.05 });
    this.zc += L;
  }
  m_movers() {
    const W = this.W, r = this.rng; this.apron(3); this.gap(0.4);
    const z0 = this.zc, rows = 3, amp = W * 0.3, w = 0.9 + r() * 0.3;
    for (let j = 0; j < rows; j++) {
      const pw = 3.4, zz = z0 + j * 5.2 + 1.2, per = W >= 12.5 ? 2 : 1;
      for (let q = 0; q < per; q++) { const cx = per === 2 ? (q ? W * 0.22 : -W * 0.22) : 0;
        this.plat({ kind: 5, x0: cx - pw / 2, x1: cx + pw / 2, z0: zz, z1: zz + 3.3, amp: per === 2 ? amp * 0.55 : amp, w: w * (j % 2 ? -1 : 1), ph: j * 1.7 + q * 3.14 + r(), col: (j + q) % 2 ? 2 : 0 }); }
    }
    this.zc += rows * 5.2 + 1.2;
  }
  m_pads() {
    const W = this.W; this.apron(3); const z0 = this.zc;
    this.plat({ x0: -W / 2, x1: W / 2, z0, z1: z0 + 3, col: 1 });
    const n = Math.max(3, Math.round(W / 3));
    for (let i = 0; i < n; i++) { const cx = -W / 2 + (i + 0.5) * W / n; this.plat({ kind: 3, x0: cx - 1.05, x1: cx + 1.05, z0: z0 + 3, z1: z0 + 5, top: this.yc + 0.15, bot: this.yc - 0.6, col: 3 }); }
    this.plat({ x0: -W / 2, x1: W / 2, z0: z0 + 3, z1: z0 + 5, top: this.yc - 0.05, col: 1 });   // 점프대 사이 바닥
    this.zc = z0 + 5 + 5.5; this.yc += 1.5;
    this.plat({ x0: -W / 2, x1: W / 2, z0: this.zc, z1: this.zc + 5, col: 2 });
    this.zc += 5;
  }
  m_conveyor() {
    const W = this.W, r = this.rng; this.apron(3); this.gap(0.3);
    const lanes = Math.max(3, Math.round(W / 3.2)), lw = W / lanes, L = 18, z0 = this.zc, sp = 3.2 + r() * 0.8;
    for (let i = 0; i < lanes; i++) {
      const back = (i + (r() < 0.5 ? 0 : 1)) % 2 === 0;
      this.plat({ kind: 2, x0: -W / 2 + i * lw + 0.05, x1: -W / 2 + (i + 1) * lw - 0.05, z0, z1: z0 + L, cvx: 0, cvz: back ? -sp : sp * 0.6, col: back ? 0 : 2 });
    }
    // 벨트 위 낮은 장애물 상자 (점프로 넘기)
    for (let j = 0; j < 3; j++) { const x = (r() - 0.5) * (W - 3), zz = z0 + 4 + j * 5; this.plat({ x0: x - 1.2, x1: x + 1.2, z0: zz, z1: zz + 0.8, top: this.yc + 0.9, bot: this.yc, col: 3 }); }
    this.zc += L;
  }
  m_walls() {
    const W = this.W, r = this.rng; this.apron(3); this.gap(0.3);
    const L = 18, z0 = this.zc, top = this.yc; this.plat({ x0: -W / 2, x1: W / 2, z0, z1: z0 + L, col: 1 });
    for (let j = 0; j < 3; j++) { const hw = W * 0.22, w = 1.1 + r() * 0.5;
      [-1, 1].forEach(s => this.obs.push({ type: 'wall', cx: s * W * 0.25, cz: z0 + 3.5 + j * 5.5, y: top, hx: hw, hz: 0.55, h: 2.4, amp: W * 0.22, w: w * s, ph: j * 1.3 + r() })); }
    this.zc += L;
  }
  m_balls() {
    const W = this.W, r = this.rng; this.apron(3);
    const L = 22, rise = 4, z0 = this.zc, y0 = this.yc;
    const ramp = this.plat({ kind: 6, x0: -W / 2, x1: W / 2, z0, z1: z0 + L, y0, y1: y0 + rise, top: y0 + rise, bot: y0 - 1.2, col: 0 });
    this.yc += rise; this.zc += L;
    this.plat({ x0: -W / 2, x1: W / 2, z0: this.zc, z1: this.zc + 3, col: 2 });
    this.obs.push({ type: 'balls', ramp: ramp.i, x0: -W / 2 + 1.1, x1: W / 2 - 1.1, zTop: this.zc + 1.5, zBot: z0 - 0.5, r: 1.05, v: 6.5 + r() * 1.0, per: Math.max(0.55, 1.5 - W * 0.05), lanes: Math.max(3, Math.round(W / 2.6)) });
    this.zc += 3;
  }
  m_beams() {
    const W = this.W, r = this.rng; this.apron(3); this.gap(0.2);
    const L = 16, z0 = this.zc, n = W >= 12.5 ? 4 : 3, bw = 1.25;
    for (let i = 0; i < n; i++) { const cx = -W / 2 + (i + 0.5) * W / n; this.plat({ x0: cx - bw / 2, x1: cx + bw / 2, z0, z1: z0 + L, col: i % 2 ? 0 : 3, beam: true }); }
    this.plat({ x0: -W / 2, x1: W / 2, z0: z0 + L * 0.45, z1: z0 + L * 0.45 + 2, col: 1 });   // 가운데 쉼터
    this.obs.push({ type: 'sweep', cx: 0, cz: z0 + L * 0.78, y: this.yc, R: W * 0.6, w: 1.2 + r() * 0.4, ph: r() * 6.28, low: true, lin: true });
    this.zc += L;
  }
  m_ice() {
    const W = this.W, r = this.rng; this.apron(3); this.gap(0.2);
    const L = 20, z0 = this.zc, y0 = this.yc;
    this.plat({ kind: 6, ice: true, x0: -W / 2, x1: W / 2, z0, z1: z0 + L, y0, y1: y0 - 2, top: y0, bot: y0 - 3.2, col: 1 });
    this.yc -= 2;
    const nb = Math.round(W / 3.5) + 2;
    for (let i = 0; i < nb; i++) { const x = (r() - 0.5) * (W - 2.4), z = z0 + 3 + (i / nb) * (L - 6) + r() * 1.5; this.obs.push({ type: 'bump', x, z, r: 0.85, ramp: this.plats.length - 1 }); }
    this.zc += L;
  }
  buildIndex() {   // z 4m 칸마다 발판 목록 (발밑 찾기를 빠르게)
    const B = this.bk = [], zmin = -12; this.bz0 = zmin;
    this.plats.forEach(p => { const ext = p.kind === 5 ? 0 : 0; const a = Math.floor((p.z0 - zmin - 1) / 4), b = Math.floor((p.z1 - zmin + 1) / 4);
      for (let i = Math.max(0, a); i <= b; i++) (B[i] || (B[i] = [])).push(p); void ext; });
  }
  near(z) { const i = Math.floor((z - this.bz0) / 4); return this.bk[i] || []; }
  // 시간 T(초) 에 발판의 x 이동 · 있는지
  offX(p, T) { return p.kind === 5 ? p.amp * Math.sin(p.w * T + p.ph) : 0; }
  velX(p, T) { return p.kind === 5 ? p.amp * p.w * Math.cos(p.w * T + p.ph) : 0; }
  tilePhase(p, T) { const u = ((T + p.ph) % p.per + p.per) % p.per / p.per; return u; }   // 0.62~1 사라짐 · 0.42~0.62 깜빡 경고
  solid(p, T) { return p.kind !== 4 || this.tilePhase(p, T) < 0.62; }
  topAt(p, z) { if (p.kind !== 6) return p.top; const k = Math.max(0, Math.min(1, (z - p.z0) / (p.z1 - p.z0))); return p.y0 + (p.y1 - p.y0) * k; }
  // (x,z) 발밑에서 yMax 이하 가장 높은 면
  support(x, z, T, yMax, pad) {
    pad = pad == null ? 0.18 : pad; let best = null, bt = -1e9;
    const list = this.near(z);
    for (let i = 0; i < list.length; i++) { const p = list[i]; if (!this.solid(p, T)) continue; const ox = this.offX(p, T);
      if (x < p.x0 + ox - pad || x > p.x1 + ox + pad || z < p.z0 - pad || z > p.z1 + pad) continue;
      const t = this.topAt(p, z); if (t <= yMax && t > bt) { bt = t; best = p; } }
    return best ? { p: best, top: bt } : null;
  }
  // 장애물 위치 (T 초)
  sweepAng(o, T) { return o.ph + o.w * T; }
  hammerPos(o, T, out) { const th = o.A * Math.sin(o.w * T + o.ph); out.x = o.px + o.L * Math.sin(th); out.y = o.py - o.L * Math.cos(th); out.z = o.pz; out.th = th; out.vx = o.L * Math.cos(th) * o.A * o.w * Math.cos(o.w * T + o.ph); return out; }
  wallX(o, T) { return o.cx + o.amp * Math.sin(o.w * T + o.ph); }
  wallV(o, T) { return o.amp * o.w * Math.cos(o.w * T + o.ph); }
  // 굴러오는 공: 배출 번호 i 마다 정해진 줄에서 (모든 화면 같음)
  balls(o, T, out) {
    out.length = 0; const life = (o.zTop - o.zBot) / o.v, i1 = Math.floor(T / o.per), i0 = Math.floor((T - life) / o.per);
    const ramp = this.plats[o.ramp];
    for (let i = i0; i <= i1; i++) { const tb = i * o.per, a = T - tb; if (a < 0 || a > life) continue;
      const lane = Math.floor(obHash(this.seedI, i, 7) * o.lanes), x = o.x0 + (o.x1 - o.x0) * (o.lanes > 1 ? lane / (o.lanes - 1) : 0.5) + (obHash(this.seedI, i, 9) - 0.5) * 0.8;
      const z = o.zTop - o.v * a, y = (z > ramp.z1 ? ramp.y1 : this.topAt(ramp, z)) + o.r;
      out.push({ x, y, z, id: i, roll: a * o.v / o.r, a, life }); }
    return out;
  }
}

// ══ 규칙 · 통신 ══
class ObstCore {
  constructor(opts) {
    const o = this.opts = opts || {};
    this.myId = o.myId || 'me'; this.myName = o.myName || '';
    this.nameOf = typeof o.nameOf === 'function' ? o.nameOf : () => '';
    this.now = 0; this.lastTime = 0;
    this.seed = +o.seed || this.srv();
    this.endAt = +o.endAt || 0;
    const roster = (o.roster || []).slice().sort();
    this.slot = isFinite(+o.slot) ? +o.slot | 0 : Math.max(0, roster.indexOf(this.myId));
    this.look = this.slot % 36;
    this.wl = roster.length > 20 ? 2 : roster.length > 12 ? 1 : 0;
    this.peers = {}; this.recs = {}; this.totals = {}; this.cleared = 0; this.firstK = 0;
    this.score = 0; this.place = 1; this.gameOver = false; this.endReason = ''; this.winner = ''; this.rank = 0; this.total = 0;
    this.mx = 0; this.my = 0; this.jumpBuf = 0; this.camYaw = 0;
    this.x = 0; this.y = 0; this.z = 0; this.vx = 0; this.vy = 0; this.vz = 0; this.h = 0; this.grounded = true; this.plat = null; this.coyote = 0;
    this.stunUntil = 0; this.fallAt = 0; this.respawnAt = 0; this.cp = 0; this.fin = 0; this.half = 0; this.hitCd = {};
    this.banner = null; this.toasts = []; this.fx = []; this.shake = 0; this.landK = 0; this.jumpK = 0;
    this.phase = 'pre'; this.finalAt = 0; this.proposed = -1; this.lateWait = false; this.waitSince = 0; this.lastFinal = null; this.lastRes = null;
    // 일정: 코스 k 출발 Sk (서버 ms)
    this.k = 0; this.Sk = this.seed + OB_PRE0;
    const srv = this.srv();
    let saved = null; try { saved = typeof sessionStorage !== 'undefined' && JSON.parse(sessionStorage.getItem(this.saveKey()) || 'null'); } catch (e) {}
    if (saved && saved.seed === this.seed && isFinite(saved.Sk)) this.restore(saved);
    else if (srv > this.Sk + 4000) { this.lateWait = true; this.waitSince = srv; this.firstK = -1; }   // 이미 시작한 판 → 친구 신호로 지금 코스를 알아냄
    this.course = new ObCourse(this.seed, this.k, this.wl);
    this.courseBuilt = -1;
    if (!this.lateWait) this.placeAtStart(); else this.placeSpectator();
  }
  saveKey() { return 'obst:' + this.seed + ':' + this.myId; }
  save() { try { if (typeof sessionStorage === 'undefined') return; const r = this.recs[this.k];
    sessionStorage.setItem(this.saveKey(), JSON.stringify({ seed: this.seed, k: this.k, Sk: this.Sk, wl: this.wl, totals: this.totals, cleared: this.cleared, firstK: this.firstK, cp: this.cp, fin: this.fin, half: this.half, look: this.look, lf: this.lastFinal, rec: r ? { fin: r.fin, half: r.half, E: r.E } : null })); } catch (e) {} }
  restore(s) {
    this.k = s.k | 0; this.Sk = +s.Sk; this.wl = s.wl | 0; this.totals = s.totals || {}; this.cleared = s.cleared | 0; this.firstK = s.firstK | 0; this.cp = s.cp | 0; this.fin = +s.fin || 0; this.half = +s.half || 0;
    if (isFinite(+s.look)) this.look = +s.look; this.lastFinal = isFinite(+s.lf) ? +s.lf : -1;
    if (s.rec) { const r = this.rec(this.k); Object.assign(r.fin, s.rec.fin || {}); Object.assign(r.half, s.rec.half || {}); if (isFinite(+s.rec.E)) r.E = +s.rec.E; }
    this.score = this.totals[this.myId] || 0; this.restored = true;
  }
  srv() { return this.opts.serverNow ? this.opts.serverNow() : Date.now(); }
  T(srv) { return ((srv == null ? this.srv() : srv) - this.seed) / 1000; }
  rec(k) { return this.recs[k] || (this.recs[k] = { fin: {}, half: {}, E: Infinity }); }
  // 코스 k 의 끝 시각 — 제한 시간 · 1등 + 30초 · '모두 도착' 제안 중 가장 이른 것 (모든 화면 같은 자료 → 같은 값)
  endOf(k, Sk) { const r = this.rec(k); let e = Math.min(Sk + OB_LIMIT, r.E), first = Infinity;
    for (const id in r.fin) if (r.fin[id] < first) first = r.fin[id];
    if (first < Infinity) e = Math.min(e, first + OB_AFTER); return e; }
  // 코스 순위: 끝 전에 도착한 기록을 도착 시각 → id 순으로
  results(k) {
    const r = this.rec(k), E = this.endOf(k, k === this.k ? this.Sk : -1e15), list = [];
    for (const id in r.fin) if (r.fin[id] < E) list.push({ id, t: r.fin[id] });
    list.sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
    list.forEach((e, i) => { e.place = i + 1; e.pts = obPts(i + 1); });
    const halfs = [];
    for (const id in r.half) if (r.half[id] < E && !list.some(e => e.id === id)) halfs.push({ id, t: r.half[id], place: 0, pts: OB_HALF_PTS });
    return { fin: list, half: halfs, E };
  }
  recordFin(k, id, ft) { if (!(k >= this.k) || !isFinite(ft)) return; const r = this.rec(k); ft = Math.round(ft); if (r.fin[id] == null || ft < r.fin[id]) r.fin[id] = ft; }
  recordHalf(k, id, th) { if (!(k >= this.k) || !isFinite(th)) return; const r = this.rec(k); th = Math.round(th); if (r.half[id] == null || th < r.half[id]) r.half[id] = th; }
  recordEnd(k, at) { if (!(k >= this.k) || !isFinite(at)) return; const r = this.rec(k); if (at < r.E) r.E = Math.round(at); }
  // 코스 점수 확정 → 총점
  finalize(k, cutAt) {
    const res = this.results(k), cut = cutAt == null ? Infinity : cutAt, h = (this.ptsHist || (this.ptsHist = {}))[k] = {};   // 코스별 점수 기록 (늦게 온 학생의 친구 총점 계산용)
    res.fin.forEach(e => { if (e.t < cut) { this.totals[e.id] = (this.totals[e.id] || 0) + e.pts; h[e.id] = e.pts; } });
    res.half.forEach(e => { if (e.t < cut) { this.totals[e.id] = (this.totals[e.id] || 0) + e.pts; h[e.id] = e.pts; } });
    if (res.fin.some(e => e.id === this.myId && e.t < cut)) this.cleared++;
    this.lastFinal = k; this.score = this.totals[this.myId] || 0;
    this.lastRes = Object.assign({ k, name: this.course.name }, res);
  }
  // ── 입력 ──
  setMove(x, y) { this.mx = Math.max(-1, Math.min(1, +x || 0)); this.my = Math.max(-1, Math.min(1, +y || 0)); }
  jump() { this.jumpBuf = 0.16; }
  setBoost(on) { if (on) this.jump(); }    // 'slither' 버튼(⤴ 점프) — 누르는 순간 뜀
  fire() { this.jump(); } releaseFire() {} useSuper() {}
  // ── 배치 ──
  startSpot(slot) { const C = this.course, W = C.W + 1.6, per = Math.max(4, Math.floor(W / 1.5)), row = Math.floor(slot / per) % 6, col = slot % per;
    return { x: -W / 2 + (col + 0.5) * W / per + (row % 2 ? 0.35 : -0.35), z: -1 - row * 1.5 }; }
  placeAtStart() { const s = this.startSpot(this.slot); this.x = s.x; this.z = s.z; this.y = 0; this.vx = this.vy = this.vz = 0; this.h = 0; this.cp = 0; this.fin = 0; this.half = 0; this.stunUntil = 0; this.fallAt = 0; this.grounded = true; this.hidden = false; }
  placeSpectator() { this.x = 0; this.z = -4; this.y = 0; this.hidden = true; }
  respawn() {
    const c = this.course.cps[this.cp] || this.course.cps[0], w = Math.max(1, (c.x1 - c.x0) - 2), n = 5;
    const sx = (((this.slot * 3) % n) / (n - 1) - 0.5) * Math.min(w, 6);
    this.x = sx; this.z = c.start ? -2 : c.zz0 + Math.min(1.6, (c.zz1 - c.zz0) * 0.5); this.y = c.top + 0.05; this.vx = this.vz = 0; this.vy = 0;
    this.grounded = false; this.fallAt = 0; this.stunUntil = 0; this.protUntil = this.now + 1200; this.landK = 1; this.addFx('pop', this.x, this.y + 0.6, this.z);
    this.sfx('respawn');
  }
  // ── 위치 신호: x,y,z,방향,상태,모습+폭,코스,S,E,F,H,총점,확정코스,보낸시각 ──
  serialize() {
    const r1 = v => { const x = Math.round(v * 10) / 10; return x === 0 ? '0' : String(x); };
    const fl = (this.grounded ? 0 : 1) | (this.now < this.stunUntil ? 2 : 0) | (this.fallAt || this.hidden ? 4 : 0) | (this.fin ? 8 : 0) | (this.lateWait ? 16 : 0);
    let hd = Math.round(this.h * 180 / Math.PI / 4) % 90; if (hd < 0) hd += 90;
    const r = this.recs[this.k], E = r && r.E < Infinity ? obB36(r.E - this.seed) : '', b = this.lateWait && this.firstK < 0 && !this.adopted;
    const head = [r1(this.x), r1(this.y), r1(this.z), hd, fl, this.look.toString(36) + this.wl, b ? '' : this.k, b ? '' : obB36(this.Sk - this.seed), E,
      this.fin ? obB36(this.fin - this.seed) : '', this.half ? obB36(this.half - this.seed) : '', this.score, this.lastFinal == null ? '' : this.lastFinal].join(',');
    if (head === this._sh && this._ser && this.now - this._serAt < 2500) return this._ser;
    this._sh = head; this._serAt = this.now;
    this._ser = head + ',' + (Math.round(this.srv()) % OB_WRAP).toString(36);
    return this._ser;
  }
  static parse(raw) {
    const a = String(raw).split(','); if (a.length < 14) return null;
    const n36 = s => s === '' || s == null ? null : parseInt(s, 36);
    const lw = a[5] || '0';
    return { x: +a[0], y: +a[1], z: +a[2], h: (+a[3] || 0) * 4 * Math.PI / 180, fl: +a[4] || 0, look: parseInt(lw.slice(0, -1) || '0', 36) || 0, wl: +lw.slice(-1) || 0,
      k: a[6] === '' ? null : +a[6], S: n36(a[7]), E: n36(a[8]), F: n36(a[9]), H: n36(a[10]), tot: +a[11] || 0, fk: a[12] === '' ? null : +a[12], st: n36(a[13]) };
  }
  applyPeerRaw(id, raw, name) {
    if (typeof raw !== 'string' || id === this.myId) return;
    let p = this.peers[id];
    if (p && p.raw === raw) { if (name) p.name = name; p.seen = this.now; return; }
    const d = ObstCore.parse(raw); if (!d || !isFinite(d.x) || !isFinite(d.z) || !isFinite(d.y)) return;
    const now = this.now, srv = this.srv();
    if (!p) p = this.peers[id] = { id, buf: [], name: name || '', x: d.x, y: d.y, z: d.z, h: d.h, off: null, iv: this.opts.sendMs || 200, at: 0, anim: 0, land: 0, seen: now, fl: d.fl, vx: 0, vz: 0, vy: 0 };
    if (name) p.name = name;
    // 보낸 시각(서버) → 내 서버 시각 기준으로 펼침
    let sFull = srv;
    if (d.st != null) { let age = ((Math.round(srv) % OB_WRAP) - d.st + OB_WRAP) % OB_WRAP; if (age > OB_WRAP / 2) age -= OB_WRAP; sFull = srv - age;
      const last = p.buf[p.buf.length - 1]; if (last && sFull <= last.s) { p.raw = raw; p.seen = now; return; } }   // 더 오래된 신호 → 버림
    p.raw = raw; p.seen = now; p.gone = false;
    const off = srv - sFull; p.off = p.off == null ? off : Math.min(off, p.off + Math.max(0, now - (p.at || now)) * 0.02);
    p.iv = p.at ? p.iv + (Math.max(60, Math.min(800, now - p.at)) - p.iv) * 0.15 : p.iv; p.at = now;
    p.buf.push({ s: sFull, x: d.x, y: d.y, z: d.z, h: d.h, fl: d.fl }); if (p.buf.length > 14) p.buf.shift();
    Object.assign(p, { fl: d.fl, look: d.look, wl: d.wl, k: d.k, S: d.S != null ? this.seed + d.S : null, tot: d.tot, fk: d.fk, fin: !!(d.fl & 8), wait: !!(d.fl & 16) });
    // 기록 합치기 (사건을 놓쳐도 신호로)
    if (d.k != null) {
      if (d.F != null) this.recordFin(d.k, id, this.seed + d.F);
      if (d.H != null) this.recordHalf(d.k, id, this.seed + d.H);
      if (d.E != null) this.recordEnd(d.k, this.seed + d.E);
      if (this.lateWait && !this.adopted && p.S != null) this.adoptFrom(p);
    }
    if (this.firstK < 0 && !this.lateWait) this.firstK = this.k;
  }
  // 늦게 들어옴: 친구의 코스 번호 · 출발 시각 · 폭을 받아 같은 일정으로
  adoptFrom(p) {
    this.adopted = true; this.k = p.k; this.Sk = p.S; this.wl = p.wl; this.course = new ObCourse(this.seed, this.k, this.wl);
    const srv = this.srv();
    if (srv < this.Sk + 4000) { this.lateWait = false; this.firstK = this.k; this.placeAtStart(); }   // 막 출발 → 바로 함께
    else this.placeSpectator();
  }
  predictPeer(p, srv) {
    const b = p.buf; if (!b.length) return p;
    const delay = Math.max(140, Math.min(480, p.iv * 1.35 + 50)), rs = srv - (p.off || 0) - delay;
    let i = b.length - 1; while (i > 0 && b[i - 1].s > rs) i--;
    const B = b[i], A = i > 0 ? b[i - 1] : null;
    if (rs >= B.s) { // 마지막 신호보다 뒤 → 짧게 앞당김
      const prev = b.length > 1 ? b[b.length - 2] : null, ext = Math.min(0.2, (rs - B.s) / 1000);
      if (prev && B.s > prev.s && Math.hypot(B.x - prev.x, B.z - prev.z) < 6) { const k = ext * 1000 / (B.s - prev.s); p.x = B.x + (B.x - prev.x) * k; p.z = B.z + (B.z - prev.z) * k; p.y = B.y + Math.max(-1, (B.y - prev.y) * k); }
      else { p.x = B.x; p.y = B.y; p.z = B.z; }
      p.h = B.h; p.vfl = B.fl; return p; }
    if (!A) { p.x = B.x; p.y = B.y; p.z = B.z; p.h = B.h; p.vfl = B.fl; return p; }
    const k = Math.max(0, Math.min(1, (rs - A.s) / Math.max(1, B.s - A.s)));
    if (Math.hypot(B.x - A.x, B.z - A.z) + Math.abs(B.y - A.y) > 7) { const S = k < 0.5 ? A : B; p.x = S.x; p.y = S.y; p.z = S.z; p.h = S.h; p.vfl = S.fl; return p; }   // 다시 태어남(순간 이동)
    p.x = A.x + (B.x - A.x) * k; p.y = A.y + (B.y - A.y) * k; p.z = A.z + (B.z - A.z) * k;
    let dh = B.h - A.h; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI; p.h = A.h + dh * k; p.vfl = k < 0.5 ? A.fl : B.fl; return p;
  }
  removePeer(id) { const p = this.peers[id]; if (p) { p.gone = true; p.goneAt = this.now; } }
  setPeers(map) { Object.keys(map).forEach(id => { const d = map[id]; if (d && d.raw) this.applyPeerRaw(id, d.raw, d.name); }); }
  syncRoster(r) { for (const id in this.peers) if (!r || r[id] == null) this.removePeer(id); }
  setHazards() {}
  onEvent(e) {
    if (!e || typeof e !== 'object' || !e.by || e.by === this.myId) return;
    if (e.type === 'ofin') { this.recordFin(+e.k, e.by, +e.ft); const p = this.peers[e.by]; if (p && +e.k === this.k) { this.addFx('confetti', Math.max(-6, Math.min(6, p.x)), this.course.finTop + 1.2, this.course.finishZ + 0.5); } return; }   // 꽃가루는 결승선에서
    if (e.type === 'ohalf') { this.recordHalf(+e.k, e.by, +e.th); return; }
    if (e.type === 'oend') { this.recordEnd(+e.k, +e.at); return; }
  }
  send(type, payload) { if (this.opts.onAttack) { try { this.opts.onAttack(type, null, payload); } catch (e) {} } }
  sfx(k) {
    const S = typeof window !== 'undefined' && window.Sound; if (!S) return;
    try { if (k === 'jump' && S.kartJump) S.kartJump(); else if (k === 'land' && S.bump) S.bump(); else if (k === 'hit' && S.crash) S.crash(); else if (k === 'cp' && S.pass) S.pass();
      else if (k === 'fin' && S.finish) S.finish(); else if (k === 'pad' && S.boost) S.boost(); else if (k === 'count' && S.countdown) S.countdown(1); else if (k === 'go' && S.countdown) S.countdown(0);
      else if (k === 'respawn' && S.item) S.item(); else if (k === 'fall' && S.rotate) S.rotate(); else if (k === 'end' && S.levelUp) S.levelUp(); } catch (e) {}
  }
  say(text, sub, color, ms) { this.banner = { text, sub: sub || '', color: color || '#FFD447', at: this.now, until: this.now + (ms || 1600) }; }
  addFx(kind, x, y, z) { if (this.fx.length > 40) this.fx.shift(); this.fx.push({ kind, x, y, z, at: this.now }); }
  // 나 + 친구들 총점 (늦게 온 학생은 친구가 알린 총점 + 그 뒤 내가 본 코스 점수)
  totalOf(id) {
    if (id === this.myId) return this.score;
    const p = this.peers[id];
    if (this.firstK === 0 || !p) return this.totals[id] || 0;
    let t = p.tot || 0; const fk = p.fk == null ? -1 : p.fk;
    if (this.lastFinal != null) for (let k = Math.max(fk + 1, this.firstK); k <= this.lastFinal; k++) t += (this.ptsHist && this.ptsHist[k] && this.ptsHist[k][id]) || 0;
    return t;
  }
  standings() {
    const list = [{ id: this.myId, name: this.myName || '나', s: this.score, me: true }];
    for (const id in this.peers) { const p = this.peers[id]; if ((p.gone || this.now - p.seen > 8000) && !this.totals[id]) continue; list.push({ id, name: p.name || this.nameOf(id) || '?', s: this.totalOf(id) }); }
    for (const id in this.totals) if (id !== this.myId && !this.peers[id]) list.push({ id, name: this.nameOf(id) || '?', s: this.totals[id] });
    list.sort((a, b) => (b.s - a.s) || String(a.name).localeCompare(String(b.name), 'ko') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return list;
  }

  // ══ 한 프레임 ══
  step(now) {
    const dtm = this.lastTime ? Math.max(0, Math.min(50, now - this.lastTime)) : 16.7; if (now >= this.lastTime) { this.lastTime = now; this.now = now; }
    const dt = dtm / 1000, srv = this.srv();
    if (this.gameOver) return dt;
    // 친구 보간
    for (const id in this.peers) { const p = this.peers[id]; this.predictPeer(p, srv); if (p.gone && now - p.goneAt > 4000) delete this.peers[id]; else if (now - p.seen > 20000) delete this.peers[id]; }
    // 늦게 들어옴: 3초 동안 친구 신호가 없으면 혼자 일정을 셈 (제한 시간 기준)
    if (this.lateWait && !this.adopted && srv - this.waitSince > 3000) {
      this.adopted = true; while (srv > this.Sk + OB_LIMIT + OB_RES) { this.Sk += OB_LIMIT + OB_RES + OB_PRE; this.k++; }
      this.course = new ObCourse(this.seed, this.k, this.wl);
      if (srv < this.Sk + 4000) { this.lateWait = false; this.firstK = this.k; this.placeAtStart(); }
    }
    // 시간 제한 끝
    if (this.endAt > 0 && srv >= this.endAt) {
      if (!this.finalAt) { this.finalAt = now; this.phase = 'final'; this.say('시간 끝!', '마지막 기록을 모으는 중…', '#FFD447', 9e9); this.sfx('end'); }
      if (now - this.finalAt >= OB_GRACE) this.finishAll('time');
      this.stepPlayer(dt, srv, false);
      return dt;
    }
    // 일정: 출발 전 → 경주 → 순위 → 다음 코스
    const E = this.endOf(this.k, this.Sk);
    if (srv >= E + OB_RES) {
      if (!this.lateWait || this.adopted) this.advance(E);
      return dt;
    }
    const prev = this.phase;
    this.phase = srv < this.Sk ? 'pre' : srv < E ? 'race' : 'results';
    if (this.phase === 'pre') { const n = Math.ceil((this.Sk - srv) / 1000); if (n !== this._cnt && n <= 3 && n >= 1) { this._cnt = n; this.sfx('count'); } }
    if (prev === 'pre' && this.phase === 'race') { this._cnt = 0; if (!this.lateWait) { this.say('출발!', '', '#7CFFB2', 1000); this.sfx('go'); } }
    if (prev === 'race' && this.phase === 'results') { this.onCourseEnd(); }
    // 모두 도착 제안: 남아 있는 사람 중 id 가 가장 작은 기기가 (1.5초 뒤 끝)
    if (this.phase === 'race' && this.proposed !== this.k && srv < E - 2500) {
      let all = !!this.fin && !this.lateWait, minId = this.myId, n = 1;
      for (const id in this.peers) { const p = this.peers[id]; if (p.gone || now - p.seen > 3000 || p.wait || p.k !== this.k) continue; n++; if (!p.fin) { all = false; break; } if (id < minId) minId = id; }
      if (all && minId === this.myId) { const at = Math.round(srv + 1500); this.proposed = this.k; this.recordEnd(this.k, at); this.send('oend', { k: this.k, at }); }
    }
    this.stepPlayer(dt, srv, this.phase === 'race' || this.phase === 'pre');
    // 효과 정리
    if (this.fx.length) this.fx = this.fx.filter(f => now - f.at < 1500);
    if (this.banner && now > this.banner.until) this.banner = null;
    this.shake = Math.max(0, this.shake - dt * 2.2); this.landK = Math.max(0, this.landK - dt * 4); this.jumpK = Math.max(0, this.jumpK - dt * 3);
    if (!this._svT || now - this._svT > 2000) { this._svT = now; this.save(); }
    return dt;
  }
  onCourseEnd() {
    const res = this.results(this.k), mine = res.fin.find(e => e.id === this.myId);
    this.say('코스 끝!', mine ? mine.place + '등 · +' + mine.pts + '점' : (res.half.some(e => e.id === this.myId) ? '반환점 통과 +' + OB_HALF_PTS + '점' : '다음 코스에서 힘내요!'), '#FFD447', 2200);
    this.sfx('end');
  }
  advance(E) {
    // 코스 k 확정 (모두 같은 자료 → 같은 점수) · 다음 코스 준비
    this.finalize(this.k);
    delete this.recs[this.k - 1];
    const wasWaiting = this.lateWait;
    this.k++; this.Sk = E + OB_RES + OB_PRE; this.proposed = -1;
    if (this.endAt <= 0 && this.k >= OB_MAXC) { this.k--; this.finishAll('goal'); return; }
    this.course = new ObCourse(this.seed, this.k, this.wl);
    if (wasWaiting) { this.lateWait = false; this.firstK = this.firstK < 0 ? this.k : this.firstK; }
    this.placeAtStart(); this.phase = 'pre'; this._cnt = 0;
    this.say('코스 ' + (this.k + 1) + ' · ' + this.course.name, this.course.mods.map(m => OB_MOD_NAME[m]).join(' → '), '#FFFFFF', 3200);
    this.save();
  }
  finishAll(reason) {
    if (this.gameOver) return;
    const srv = this.srv();
    if (reason === 'time') { // 진행 중이던 코스: 시간 끝 전에 도착한 기록까지 점수
      if (this.lastFinal !== this.k && !this.lateWait) this.finalize(this.k, this.endAt);
    }
    this.endReason = reason; this.endTs = srv;
    const st = this.standings(); this.rankList = st; this.rank = st.findIndex(e => e.me) + 1; this.total = st.length;
    this.winner = st[0] ? (st[0].me ? (this.myName || '나') : st[0].name) : '';
    this.gameOver = true; this.place = this.rank; this.save();
    this.say(reason === 'time' ? '시간 끝!' : '경기 끝!', '나는 ' + this.total + '명 중 ' + this.rank + '등 · ' + this.score + '점', '#FFD447', 9e9);
    this.sfx('end');
  }

  // ── 내 캐릭터 물리 (내 화면이 정함) ──
  stepPlayer(dt, srv, live) {
    const C = this.course, now = this.now;
    if (this.lateWait || this.hidden) { this.hidden = true; return; }
    // 떨어짐 → 잠깐 뒤 체크포인트에서
    if (this.fallAt) { if (now - this.fallAt > 1000) this.respawn(); else { this.vy -= OB_G * dt; this.y += this.vy * dt; } return; }
    const n = Math.max(1, Math.ceil(dt / (1 / 90))), h = dt / n;
    for (let i = 0; i < n; i++) { this.sub(h, srv - (n - 1 - i) * h * 1000, live); if (this.fallAt) break; }
    // 체크포인트 · 반환점 · 결승
    if (this.grounded && this.plat && this.plat.cp != null && this.plat.cp > this.cp && this.phase === 'race') {
      this.cp = this.plat.cp; this.say('체크포인트!', '떨어지면 여기서 다시 시작', '#7CFFB2', 1100); this.sfx('cp'); this.addFx('ring', this.x, this.y + 0.1, this.z);
      if (this.cp >= C.halfCp && !this.half && !this.fin) { this.half = Math.round(srv); this.recordHalf(this.k, this.myId, this.half); this.send('ohalf', { k: this.k, th: this.half }); }
      this.save();
    }
    if (!this.fin && this.phase === 'race' && this.z >= C.finishZ && this.y > C.finTop - 2) {
      this.fin = Math.round(srv); this.recordFin(this.k, this.myId, this.fin); this.send('ofin', { k: this.k, ft: this.fin });
      const res = this.results(this.k), me = res.fin.find(e => e.id === this.myId);
      this.say(me ? '🏁 ' + me.place + '등 도착!' : '🏁 도착!', me ? '+' + me.pts + '점' : '', '#FFD447', 2600); this.sfx('fin'); this.addFx('confetti', this.x, this.y + 1.5, this.z); this.shake = Math.max(this.shake, 0.25);
      this.save();
    }
  }
  sub(dt, srv, live) {
    const C = this.course, T = (srv - this.seed) / 1000, now = this.now;
    const stunned = now < this.stunUntil, frozen = !live || this.phase === 'results' || this.phase === 'final';
    // 원하는 속도 (카메라 기준: 조이스틱 위 = 앞(+z))
    let ix = frozen || stunned ? 0 : this.mx, iy = frozen || stunned ? 0 : this.my; const il = Math.hypot(ix, iy); if (il > 1) { ix /= il; iy /= il; }
    const cy = Math.cos(this.camYaw), sy = Math.sin(this.camYaw);
    const wx = (-ix * cy + -iy * sy) * OB_SPEED, wz = (ix * sy + -iy * cy) * OB_SPEED;
    const pk = this.grounded && this.plat ? this.plat : null, ice = pk && (pk.kind === 1 || pk.ice);
    const acc = stunned ? 0.6 : !this.grounded ? 4.5 : ice ? 1.4 : 16;
    const ka = Math.min(1, acc * dt); this.vx += (wx - this.vx) * ka; this.vz += (wz - this.vz) * ka;
    if (il > 0.15 && !stunned) { const tgt = Math.atan2(wx, wz); let d = tgt - this.h; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; this.h += d * Math.min(1, dt * 14); }
    // 점프 (땅에 닿은 직후 0.1초까지 · 누른 뒤 0.16초 안에 닿아도)
    this.jumpBuf = Math.max(0, this.jumpBuf - dt); this.coyote = Math.max(0, this.coyote - dt);
    if (this.jumpBuf > 0 && !frozen && !stunned && (this.grounded || this.coyote > 0)) { this.vy = OB_JUMP; this.grounded = false; this.coyote = 0; this.jumpBuf = 0; this.jumpK = 1; this.sfx('jump'); this.addFx('dust', this.x, this.y + 0.1, this.z); }
    // 발판이 움직이면 같이 · 컨베이어
    if (this.grounded && pk) { if (pk.kind === 5) this.x += C.velX(pk, T) * dt; if (pk.kind === 2) { this.x += pk.cvx * dt; this.z += pk.cvz * dt; } }
    this.vy -= OB_G * dt; if (this.vy < -40) this.vy = -40;
    const y0 = this.y;
    let nx = this.x + this.vx * dt, nz = this.z + this.vz * dt, ny = this.y + this.vy * dt;
    // 출발선 · 코스 바깥 앞뒤
    if (this.phase === 'pre' && nz > C.startLine - 0.4) { nz = C.startLine - 0.4; if (this.vz > 0) this.vz = 0; }
    if (nz < -10.6) { nz = -10.6; if (this.vz < 0) this.vz = 0; }
    if (nz > C.len - 0.6) { nz = C.len - 0.6; if (this.vz > 0) this.vz = 0; }
    // 옆면 충돌: 발보다 높은 발판 (계단 0.4m 는 올라감)
    const list = C.near(nz);
    for (let i = 0; i < list.length; i++) { const p = list[i]; if (!C.solid(p, T)) continue; const top = C.topAt(p, nz); if (top <= ny + OB_STEP || p.bot >= ny + OB_H) continue;
      const ox = C.offX(p, T), r = this.pushRect(nx, nz, p.x0 + ox, p.x1 + ox, p.z0, p.z1, OB_R); if (r) { nx = r[0]; nz = r[1]; if (r[2]) this.vx *= 0.2; else this.vz *= 0.2; } }
    // 장애물
    this.obstacles(T, now, nx, nz, ny); nx = this._nx; nz = this._nz;
    // 친구와 살짝 밀림 (내 화면 기준 · 나만 움직임)
    if (!(now < this.protUntil)) for (const id in this.peers) { const p = this.peers[id]; if (p.gone || p.wait || (p.vfl & 4) || p.k !== this.k || now - p.seen > 2500) continue;
      const dx = nx - p.x, dz = nz - p.z, dy = ny - p.y; if (Math.abs(dy) > 1.1) continue; const d = Math.hypot(dx, dz);
      if (d < 0.8 && d > 0.001) { const k = (0.8 - d) * 0.35, px = nx + dx / d * k, pz = nz + dz / d * k;
        if (C.support(px, pz, T, ny + OB_STEP, 0)) { nx = px; nz = pz; } } }   // 밀려서 발판 밖으로 떨어지지는 않게 (억울한 낙하 없음)
    // 바닥: 내려가는 중이면 발밑 면에 착지
    if (this.vy <= 0) {
      const s = C.support(nx, nz, T, Math.max(y0, ny) + (this.grounded ? OB_STEP : 0.05));
      if (s && ny <= s.top + (this.grounded ? 0.12 : 0)) {
        if (!this.grounded && this.vy < -6) { this.landK = Math.min(1, -this.vy / 16); this.addFx('dust', nx, s.top + 0.05, nz); if (this.vy < -9) this.sfx('land'); }
        ny = s.top; this.vy = 0; this.grounded = true; this.plat = s.p;
        if (s.p.kind === 3 && !(now < this.stunUntil)) { this.vy = 16; this.vz = Math.max(this.vz, 8.6); this.grounded = false; this.plat = null; this.jumpK = 1; this.sfx('pad'); this.addFx('stars', nx, ny + 0.3, nz); this.shake = Math.max(this.shake, 0.12); }
      } else { if (this.grounded) this.coyote = 0.1; this.grounded = false; this.plat = null; }
    } else { this.grounded = false; this.plat = null;
      // 머리 위 발판
      const list2 = C.near(nz); for (let i = 0; i < list2.length; i++) { const p = list2[i]; if (!C.solid(p, T)) continue; const ox = C.offX(p, T);
        if (nx > p.x0 + ox && nx < p.x1 + ox && nz > p.z0 && nz < p.z1 && y0 + OB_H <= p.bot + 0.05 && ny + OB_H > p.bot) { ny = p.bot - OB_H; this.vy = 0; } } }
    this.x = nx; this.z = nz; this.y = ny;
    if (this.y < OB_KILL + Math.min(0, this.zBase())) { this.fallAt = now; this.sfx('fall'); this.shake = Math.max(this.shake, 0.2); }
  }
  zBase() { return this.course.cps[this.cp] ? this.course.cps[this.cp].top : 0; }
  // 원 vs 사각형 밀어내기 → [x, z, x축으로 밀었나] 또는 null
  pushRect(x, z, x0, x1, z0, z1, r) {
    const cx = Math.max(x0, Math.min(x1, x)), cz = Math.max(z0, Math.min(z1, z)), dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) return null;
    if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; return [x + dx * k, z + dz * k, Math.abs(dx) > Math.abs(dz)]; }
    // 안쪽: 가장 가까운 면으로
    const l = x - x0, rr = x1 - x, f = z - z0, b = z1 - z, m = Math.min(l, rr, f, b);
    if (m === l) return [x0 - r, z, true]; if (m === rr) return [x1 + r, z, true]; if (m === f) return [x, z0 - r, false]; return [x, z1 + r, false];
  }
  knock(id, vx, vz, vy, ms, strong) {
    const now = this.now; if (this.hitCd[id] && now < this.hitCd[id]) return false; this.hitCd[id] = now + 450;
    this.vx = vx; this.vz = vz; this.vy = Math.max(this.vy, vy); this.grounded = false; this.plat = null; this.stunUntil = now + (ms || 500);
    this.shake = Math.max(this.shake, strong ? 0.45 : 0.28); this.sfx('hit'); this.addFx('stars', this.x, this.y + 1.2, this.z); return true;
  }
  obstacles(T, now, nx, nz, ny) {
    const C = this.course, tmp = this._hp || (this._hp = {}), balls = this._balls || (this._balls = []);
    for (let i = 0; i < C.obs.length; i++) { const o = C.obs[i];
      if (o.type === 'sweep') { if (o.hub) { const r = this.pushCircle(nx, nz, o.cx, o.cz, 0.75); if (r && ny < o.y + 1.6) { nx = r[0]; nz = r[1]; } continue; }
        const bandLo = o.y + 0.25, bandHi = o.y + 0.95; if (ny > bandHi || ny + OB_H < bandLo) continue;
        const a = C.sweepAng(o, T), ux = Math.cos(a), uz = Math.sin(a), dx = nx - o.cx, dz = nz - o.cz, along = dx * ux + dz * uz;
        if (Math.abs(along) > o.R + OB_R) continue; const perp = -dx * uz + dz * ux;
        if (Math.abs(perp) < 0.34 + OB_R) { // 막대가 움직이는 쪽으로 쓸어 넘김 (막대 위 점의 속도 = w · along · (−uz, ux))
          const s = Math.sign(o.w * along) || 1, tx = -uz * s, tz = ux * s, sp = Math.min(13, Math.abs(o.w * along) + 5);
          nx = o.cx + along * ux + tx * (0.36 + OB_R); nz = o.cz + along * uz + tz * (0.36 + OB_R);
          this.knock('s' + i, tx * sp, tz * sp, 6.5, 520, false); }
        continue; }
      if (o.type === 'hammer') { const hp = C.hammerPos(o, T, tmp); const dx = nx - hp.x, dz = nz - hp.z, dy = (ny + OB_H * 0.5) - hp.y, d = Math.hypot(dx, dy * 0.8, dz);
        if (d < o.hr + OB_R + 0.1) { const s = Math.sign(hp.vx || dx || 1); this.knock('h' + i, s * (9 + Math.min(6, Math.abs(hp.vx) * 0.6)), 1.5, 7.5, 600, true); nx += s * 0.3; }
        continue; }
      if (o.type === 'wall') { if (ny > o.y + o.h || ny + OB_H < o.y) continue; const wx = C.wallX(o, T), r = this.pushRect(nx, nz, wx - o.hx, wx + o.hx, o.cz - o.hz, o.cz + o.hz, OB_R);
        if (r) { nx = r[0]; nz = r[1]; if (r[2]) { const v = C.wallV(o, T); if (Math.sign(v) === Math.sign(nx - wx)) { this.vx = v * 1.25; if (Math.abs(v) > 2.5) this.knock('w' + i, v * 1.6, this.vz * 0.5, 3.5, 300, false); } } }
        continue; }
      if (o.type === 'balls') { C.balls(o, T, balls); for (let j = 0; j < balls.length; j++) { const b = balls[j]; const dx = nx - b.x, dz = nz - b.z, dy = (ny + OB_H * 0.5) - b.y;
          if (dx * dx + dz * dz + dy * dy * 0.7 < (b.r + OB_R) * (b.r + OB_R)) { if (this.knock('b' + b.id, dx * 2.5, -o.v * 1.45, 8, 650, true)) { nz -= 0.4; } } }
        continue; }
      if (o.type === 'bump') { const top = C.topAt(C.plats[o.ramp], o.z); if (ny > top + 1.5) continue; const r = this.pushCircle(nx, nz, o.x, o.z, o.r + OB_R);
        if (r) { nx = r[0]; nz = r[1]; const dx = nx - o.x, dz = nz - o.z, d = Math.hypot(dx, dz) || 1; const vn = this.vx * dx / d + this.vz * dz / d; if (vn < 3) { this.vx += (6.5 - vn) * dx / d; this.vz += (6.5 - vn) * dz / d; } if (!this.hitCd['u' + i] || now > this.hitCd['u' + i]) { this.hitCd['u' + i] = now + 300; this.sfx('land'); this.addFx('stars', nx, ny + 1, nz); } }
        continue; }
    }
    this._nx = nx; this._nz = nz;
  }
  pushCircle(x, z, cx, cz, R) { const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz); if (d >= R) return null; if (d < 1e-4) return [cx + R, cz]; return [cx + dx / d * R, cz + dz / d * R]; }

  // ── 교사 미니보드: 16 × 40 (위 = 결승) ──
  getSnapshot() {
    const G = 16, R = 40, C = this.course, srv = this.srv(), T = this.T(srv);
    if (this._snapAt && this.now - this._snapAt < 450 && this._snapK === this.k && this._snap) return this._snap;
    const zmin = -11, zmax = C.len, Wm = 17, cell = (x, z) => [Math.floor((x + Wm / 2) / Wm * G), R - 1 - Math.floor((z - zmin) / (zmax - zmin) * R)];
    const g = []; for (let y = 0; y < R; y++) { const row = []; for (let x = 0; x < G; x++) row.push(0); g.push(row); }
    for (let y = 0; y < R; y++) for (let x = 0; x < G; x++) { const wx = (x + 0.5) / G * Wm - Wm / 2, wz = zmin + (R - 1 - y + 0.5) / R * (zmax - zmin);
      let v = 0; const list = C.near(wz);
      for (const p of list) { if (wz < p.z0 - 0.6 || wz > p.z1 + 0.6) continue; const ox = C.offX(p, T); if (wx < p.x0 + ox - 0.3 || wx > p.x1 + ox + 0.3) continue;
        if (!C.solid(p, T)) continue; const c = p.fin ? 4 : p.cp != null ? 24 : p.kind === 1 || p.ice ? 48 : p.kind === 2 ? 57 : p.kind === 3 ? 27 : p.kind === 4 ? 31 : p.kind === 5 ? 54 : 63; v = c; if (p.kind !== 0) break; }
      g[y][x] = v; }
    const put = (x, z, v) => { const c = cell(x, z); if (g[c[1]] && g[c[1]][c[0]] != null) g[c[1]][c[0]] = v; };
    const tmp = {}, balls = []; for (const o of C.obs) { if (o.type === 'hammer') { C.hammerPos(o, T, tmp); put(tmp.x, tmp.z, 7); } else if (o.type === 'wall') put(C.wallX(o, T), o.cz, 7); else if (o.type === 'balls') { C.balls(o, T, balls); balls.forEach(b => put(b.x, b.z, 7)); } else if (o.type === 'sweep' && !o.hub) { const a = C.sweepAng(o, T); for (let s = -1; s <= 1; s += 0.5) put(o.cx + Math.cos(a) * o.R * s, o.cz + Math.sin(a) * o.R * s, 7); } }
    for (const id in this.peers) { const p = this.peers[id]; if (p.gone || p.wait || p.k !== this.k || (p.vfl & 4)) continue; put(p.x, p.z, 22); }
    if (!this.hidden && !this.fallAt) put(this.x, this.z, 10);
    this._snap = g; this._snapAt = this.now; this._snapK = this.k; return g;
  }
  // 진행도 0~1
  progOf(z) { const C = this.course; return Math.max(0, Math.min(1, (z - C.startLine) / (C.finishZ - C.startLine))); }
  courseRank() {   // 지금 코스 순위 (도착한 사람 먼저 · 나머지는 진행도)
    const r = this.rec(this.k), list = [];
    if (!this.hidden) list.push({ id: this.myId, f: this.fin || r.fin[this.myId] || 0, p: this.progOf(this.z) });
    for (const id in this.peers) { const p = this.peers[id]; if (p.gone || p.wait || p.k !== this.k || this.now - p.seen > 4000) continue; list.push({ id, f: r.fin[id] || 0, p: this.progOf(p.z) }); }
    list.sort((a, b) => (a.f && b.f ? a.f - b.f || (a.id < b.id ? -1 : 1) : a.f ? -1 : b.f ? 1 : b.p - a.p));
    return { rank: list.findIndex(e => e.id === this.myId) + 1, n: list.length };
  }
}
if (typeof window !== 'undefined') { window.ObstCore = ObstCore; window.ObCourse = ObCourse; window.OB_COURSES = OB_COURSES; }
