// 좀비 술래잡기 3D — 규칙 · 맵 · 통신 (그리기 없음 · node 에서도 돎). 3D 그림 · HUD · 소리는 tag3d-engine.js
//   · 맵: 해 질 녘 학교(본관 · 체육관 · 운동장 · 담장) + 둘레 마을(집 · 골목 · 길 · 차 · 가로등). 인원별 크기('school:24') · 판 시작 시각으로 집 배치가 바뀜
//     모든 기기가 같은 비트로 만들도록 삼각함수 없이 사칙연산 · 정수 해시만 씀
//   · 라운드: 준비(흩어지기) → 좀비 등장(판 시작 시각 + 라운드 + id 해시로 1~3명) → 사람이 모두 잡히면(또는 90초) 끝 → 4.5초 뒤 다음 라운드
//     라운드 번호 · 시작 시각은 위치 신호에 실어 서로 맞춤(더 높은 라운드를 따라감 · 같은 라운드는 더 이른 시작)
//   · 잡기 판정은 '잡힌 쪽 화면 기준': 좀비 기기가 'tag' 사건(그때 좀비 자리) → 잡힌 쪽이 그 시각 내 자리와 거리 · 벽을 보고 받아들이면 좀비로 바뀌고 'got' 사건
//     (잡힌 쪽 화면에서 좀비가 닿아도 스스로 좀비). 좀비 점수는 'got'(또는 위치 신호의 '잡은 좀비' 칸)으로 한 번만
//   · 내 역할 · 점수는 내 기기만 정함 → 다른 화면은 위치 신호로 봄 (결론이 엇갈릴 수 없음)

const TG_PREP1 = 8000, TG_PREP = 6000;          // 준비 시간 (첫 라운드 · 다음 라운드)
const TG_INTER = 4500;                           // 라운드 사이 쉬는 시간 (결과 보기)
const TG_HUNT = 90000;                           // 한 라운드 최대 사냥 시간 — 끝까지 살아남으면 보너스
const TG_MATCH = 360000;                         // 시간 제한이 없을 때 한 판 6분
const TG_RISE0 = 2600, TG_RISE = 1400;           // 처음 뽑힌 좀비 · 잡혀서 된 좀비가 일어나는 동안 (못 잡음)
const TG_R = 0.42;                               // 몸 반지름
const TG_CATCH = 1.15;                           // 좀비 화면: 이만큼 가까우면 '잡았다' 사건
const TG_TOUCH = 0.95;                           // 사람 화면: 좀비가 이만큼 닿으면 스스로 좀비
const TG_ACCEPT = 2.3;                           // 사건 받기: 그 시각 내 자리 ↔ 좀비 자리
const TG_SHOWN = 2.8;                            // 사건 받기: 지금 내 화면의 좀비 ↔ 나
const TG_LATE = 1500;                            // 이보다 늦게 온 'tag' 는 버림
const TG_WALK = 5.0, TG_SPRINT = 7.4, TG_ZOMB = 6.1, TG_DASH = 13, TG_DASH_MS = 480, TG_DASH_CD = 4000;
const TG_STAM_DRAIN = 33, TG_STAM_REGEN = 17;    // 달리기 기력 (100 → 3초)
const TG_FREEZE = 2200, TG_STUN = 1100;
const TG_PTS_CATCH = 10, TG_PTS_SURVIVE = 20, TG_PTS_LAST = 10;
const TG_ITEM_PERIOD = 22000;                    // 아이템 자리마다 새 아이템 주기
const TG_ITEMS = {
  spd: { name: '스피드 신발', short: '신발', ms: 6000, color: '#FF6B4A', desc: '6초 동안 빨라져요' },
  inv: { name: '투명 망토',   short: '투명', ms: 6000, color: '#B57CFF', desc: '6초 동안 좀비에게 안 보여요' },
  shd: { name: '방패',       short: '방패', color: '#4CC9F0', desc: '좀비에게 한 번 잡혀도 막아 줘요' },
  snw: { name: '눈덩이',     short: '눈덩이', color: '#F2F7FF', desc: '가까운 좀비를 자동으로 맞혀 얼려요' }
};
const TG_ITEM_KEYS = ['spd', 'inv', 'shd', 'snw'];
const TG_WRAP = 60466176;                        // 보낸 시각을 36진수 5자리로
const TG_BASE_LAT = 80, TG_LEAD = 0.6;
const TG_FONT = "'Lilita One', Pretendard, sans-serif";
const TG_MAPS = { school: { name: '해 질 녘 학교 마을', tag: '★2 · 기본', desc: '학교 본관 · 체육관 · 넓은 운동장과 둘레 마을 골목', spec: '인원에 따라 56~84m · 집 · 골목 · 담장 · 가로등' } };

// 인원별 한 변 길이(m): 8명 60 · 16명 72 · 30명 80
function tgSizeFor(n) { n = +n || 0; return Math.max(56, Math.min(84, Math.round((40 + 7.6 * Math.sqrt(Math.max(1, n))) / 4) * 4)); }
function tgParseTrack(track) { const a = String(track || '').split(':'), n = parseInt(a[1], 10); return { mapId: 'school', n: (a[0] === 'auto' || a[0] === 'school') && n > 0 ? n : 16 }; }   // 선생님 화면이 시작할 때 'auto:N'(autoSize) · ':N' 이 없으면 16명 크기 (기기마다 맵이 달라지지 않게)

// ── 결정적 난수 (기기마다 같은 결과) ──
function tgHash(a, b, c) { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function tgRng(seed) { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const tgStrHash = s => { s = String(s); let h = 7; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; return h; };
const tgAng = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const tgCmp = (a, b) => (b.score - a.score) || String(a.name || '').localeCompare(String(b.name || ''), 'ko') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);   // index.html roundRank 와 같은 규칙

// ══ 맵 (같은 크기 · 판이면 같은 결과 — 기기 안에서는 한 번만 만들어 함께 씀) ══
//   상자 { x0,z0,x1,z1, h, y0(밑 높이: 2m 넘으면 밑으로 지나감), k(종류), ... }  · 나무 { x,z,r,h } · 가로등 { x,z }
//   바닥 구역 zones { k: road|yard|sand|grass|alley, x0,z0,x1,z1 } (그림용)
const TG_WORLD_CACHE = [];
class TgWorld {
  static get(L, seed) {
    const key = L + '|' + seed; for (const w of TG_WORLD_CACHE) if (w.key === key) return w;
    const w = new TgWorld(L, seed); w.key = key; TG_WORLD_CACHE.unshift(w); if (TG_WORLD_CACHE.length > 2) TG_WORLD_CACHE.length = 2; return w;
  }
  constructor(L, seed) {
    this.L = L; this.seed = seed | 0;
    this.R = tgRng((Math.imul(L, 7919) ^ Math.imul(this.seed, 2654435761) ^ 0x51ED) >>> 0);
    this.boxes = []; this.trees = []; this.lamps = []; this.zones = []; this.goals = [];
    this.build(); this.index(); this.makeSpawns();
  }
  box(x0, z0, x1, z1, h, k, ex) { const b = Object.assign({ id: this.boxes.length, x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), h, y0: 0, k }, ex || {}); this.boxes.push(b); return b; }
  // 축에 나란한 담장 한 줄 (gaps: [시작, 끝] 문 자리 — 축 위 좌표)
  wallLine(ax, az, bx, bz, t, h, k, gaps) {
    const horiz = az === bz, a0 = horiz ? Math.min(ax, bx) : Math.min(az, bz), a1 = horiz ? Math.max(ax, bx) : Math.max(az, bz);
    const cuts = (gaps || []).slice().sort((p, q) => p[0] - q[0]); let s = a0;
    const seg = (p, q) => { if (q - p < 0.3) return; if (horiz) this.box(p, az - t / 2, q, az + t / 2, h, k, { dir: 'x' }); else this.box(ax - t / 2, p, ax + t / 2, q, h, k, { dir: 'z' }); };
    for (const g of cuts) { seg(s, g[0]); s = Math.max(s, g[1]); } seg(s, a1);
  }
  build() {
    const L = this.L, R = this.R, Z = (k, x0, z0, x1, z1) => this.zones.push({ k, x0, z0, x1, z1 });
    Z('alley', 0, 0, L, L);   // 바닥 그리는 순서: 뒷골목 바탕 → 길 → 마당 → 풀밭 · 모래
    // 맵 가장자리 담 (밖으로 못 나감)
    const e = 0.5; this.wallLine(0, e / 2, L, e / 2, e, 2.6, 'edge'); this.wallLine(0, L - e / 2, L, L - e / 2, e, 2.6, 'edge');
    this.wallLine(e / 2, e, e / 2, L - e, e, 2.6, 'edge'); this.wallLine(L - e / 2, e, L - e / 2, L - e, e, 2.6, 'edge');
    // ── 학교 (가운데 네모 · 담장 · 문 4곳 + 쪽문) ──
    const sw = Math.round(L * 0.56 / 2) * 2, sh = Math.round(L * 0.5 / 2) * 2, cx0 = (L - sw) / 2, cz0 = (L - sh) / 2, cx1 = cx0 + sw, cz1 = cz0 + sh, cx = L / 2, cz = L / 2;
    this.school = { x0: cx0, z0: cz0, x1: cx1, z1: cz1 };
    const st = L >= 70 ? 4.6 : 4.0;                                       // 학교 둘레 길 폭
    Z('road', cx0 - st, cz0 - st, cx1 + st, cz1 + st); Z('yard', cx0, cz0, cx1, cz1);
    const side = (a0, a1) => { const g = 4.6, w = 3.0, mid = (a0 + a1) / 2, out = [[mid - g / 2, mid + g / 2]];
      const span = (a1 - a0) / 2 - g / 2 - w - 3, off = 3 + R() * Math.max(1, span - 3), sgn = R() < 0.5 ? -1 : 1, p = mid + sgn * (g / 2 + off);
      if (span > 4) out.push([p, p + sgn * w].sort((u, v) => u - v)); return out; };
    this.wallLine(cx0, cz0, cx1, cz0, 0.4, 1.8, 'wall', side(cx0, cx1)); this.wallLine(cx0, cz1, cx1, cz1, 0.4, 1.8, 'wall', side(cx0, cx1));
    this.wallLine(cx0, cz0, cx0, cz1, 0.4, 1.8, 'wall', side(cz0, cz1)); this.wallLine(cx1, cz0, cx1, cz1, 0.4, 1.8, 'wall', side(cz0, cz1));
    this.gates = [[cx, cz0], [cx, cz1], [cx0, cz], [cx1, cz]];
    // 본관 (북쪽 · 3층 · 가운데 필로티 통로) — 담장과 사이 2.8m 뒷길
    const bz0 = cz0 + 3.0, bz1 = bz0 + 8, bx0 = cx0 + 4.2, bx1 = cx1 - 4.2, pw = 3.2;
    const pass = cx + (R() - 0.5) * sw * 0.2;
    this.box(bx0, bz0, pass - pw / 2, bz1, 9.6, 'school', { floors: 3, face: 's' }); this.box(pass + pw / 2, bz0, bx1, bz1, 9.6, 'school', { floors: 3, face: 's' });
    this.box(pass - pw / 2, bz0, pass + pw / 2, bz1, 9.6, 'school', { y0: 3.2, floors: 3, face: 's', bridge: true });
    this.schoolMain = { x0: bx0, z0: bz0, x1: bx1, z1: bz1, pass };
    // 체육관 (서쪽 · 남쪽 담장과 3m 띄움)
    const gx0 = cx0 + 3.2, gx1 = gx0 + Math.min(10, sw * 0.24), gz1 = cz1 - 3.2, gz0 = Math.max(bz1 + 5, gz1 - 13);
    this.box(gx0, gz0, gx1, gz1, 7.2, 'gym', { face: 'e' });
    // 운동장 (모래) + 축구 골대 · 정글짐 · 구령대
    const px0 = gx1 + 4.2, px1 = cx1 - 3.5, pz0 = bz1 + 4.2, pz1 = cz1 - 3.2;
    Z('sand', px0, pz0, px1, pz1); this.field = { x0: px0, z0: pz0, x1: px1, z1: pz1 };
    const pmx = (px0 + px1) / 2, pmz = (pz0 + pz1) / 2;
    this.goals.push({ x: px0 + 1.4, z: pmz, dir: 1 }, { x: px1 - 1.4, z: pmz, dir: -1 });
    this.box(pmx - 1.6, pz0 - 0.2 - 1.6, pmx + 1.6, pz0 - 0.2, 1.0, 'stage');                 // 구령대 (낮음 · 시야는 안 막음)
    { const jx = px1 - 3.5 - R() * 3, jz = pz1 - 2.6; this.box(jx - 1.5, jz - 1.0, jx + 1.5, jz + 1.0, 2.2, 'jungle'); }
    // 학교 안 나무 (남 · 동 담장 안쪽) · 화단
    const nearGate = (x, z, d) => this.gates.some(g => Math.abs(g[0] - x) < d && Math.abs(g[1] - z) < d);
    for (let x = px0 + 1.5; x < px1 - 1; x += 5.5 + R() * 2) if (!nearGate(x, cz1, 4)) this.trees.push({ x, z: cz1 - 1.3, r: 0.45, h: 4.2 + R() * 1.5 });
    for (let z = pz0 + 2; z < cz1 - 4; z += 5 + R() * 2) if (!nearGate(cx1, z, 4)) this.trees.push({ x: cx1 - 1.3, z, r: 0.45, h: 4 + R() * 1.6 });
    this.box(bx0 + 2, bz1 + 1.4, pass - pw / 2 - 2, bz1 + 2.1, 0.45, 'bed'); this.box(pass + pw / 2 + 2, bz1 + 1.4, bx1 - 2, bz1 + 2.1, 0.45, 'bed');
    // 학교 안 가로등
    [[bx0 - 2, bz1 + 2.5], [bx1 + 2, bz1 + 2.5], [px0 - 1.6, pz1 - 1.5], [cx1 - 1.6, pz0 + 1]].forEach(p => this.lamps.push({ x: p[0], z: p[1] }));
    // ── 마을: 학교 둘레 길 바깥 띠에 집 · 골목 (뒤에는 2.2m 뒷골목) ──
    const al = 2.3, inner = { x0: cx0 - st, z0: cz0 - st, x1: cx1 + st, z1: cz1 + st };
    const bands = [
      { o: 'x', a0: e + al, a1: L - e - al, b0: e + al, b1: inner.z0, face: 's' },          // 북쪽 띠 (모서리 포함)
      { o: 'x', a0: e + al, a1: L - e - al, b0: inner.z1, b1: L - e - al, face: 'n' },      // 남쪽 띠
      { o: 'z', a0: inner.z0, a1: inner.z1, b0: e + al, b1: inner.x0, face: 'e' },          // 서쪽 띠
      { o: 'z', a0: inner.z0, a1: inner.z1, b0: inner.x1, b1: L - e - al, face: 'w' }       // 동쪽 띠
    ];
    const pal = 6;
    bands.forEach(bd => {
      const depth = bd.b1 - bd.b0; if (depth < 3.5) return;
      const streetSide = bd.face === 's' || bd.face === 'e' ? 1 : 0;              // 집 앞(길) 쪽이 b1 이면 1
      const hd = Math.min(depth - (depth > 10 ? 2.6 : 0.4), 8.2);                  // 집 깊이 (띠가 넓으면 뒤에 마당)
      let t = bd.a0 + 1.2 + R() * 1.5;
      while (t < bd.a1 - 4) {
        const w = 4.8 + R() * 3.6, t1 = Math.min(bd.a1 - 1.2, t + w); if (t1 - t < 3.6) break;
        const park = R() < 0.14;
        const s0 = streetSide ? bd.b1 - hd : bd.b0, s1 = streetSide ? bd.b1 : bd.b0 + hd;   // 집은 길 쪽에 붙임
        const rect = bd.o === 'x' ? [t, s0, t1, s1] : [s0, t, s1, t1];
        if (park) {
          Z('grass', rect[0], rect[1], rect[2], rect[3]);
          const mx = (rect[0] + rect[2]) / 2, mz = (rect[1] + rect[3]) / 2;
          this.trees.push({ x: mx + (R() - 0.5) * 1.5, z: mz + (R() - 0.5) * 1.5, r: 0.45, h: 4.5 + R() * 1.5 });
          if (R() < 0.6) { const cx2 = bd.o === 'x' ? rect[0] + 0.9 : mx, cz2 = bd.o === 'x' ? mz : rect[1] + 0.9; this.box(cx2 - 0.55, cz2 - 0.55, cx2 + 0.55, cz2 + 0.55, 1.1, 'crate'); }
        } else {
          const fl = R() < 0.45 ? 2 : 1;
          this.box(rect[0], rect[1], rect[2], rect[3], fl === 2 ? 6.4 : 3.8, 'house', { floors: fl, face: bd.face, col: Math.floor(R() * pal), roof: Math.floor(R() * 4), ridge: bd.o });
          // 띠가 넓으면 뒷마당 (풀밭 · 가끔 나무 · 상자)
          if (depth > 10) { const y0 = streetSide ? bd.b0 : bd.b0 + hd, y1 = streetSide ? bd.b1 - hd : bd.b1;
            const yr = bd.o === 'x' ? [t, y0 + 0.4, t1, y1 - 0.4] : [y0 + 0.4, t, y1 - 0.4, t1]; Z('grass', yr[0], yr[1], yr[2], yr[3]);
            if (R() < 0.45) { const mx = (yr[0] + yr[2]) / 2, mz = (yr[1] + yr[3]) / 2; this.trees.push({ x: mx, z: mz, r: 0.45, h: 3.8 + R() * 1.4 }); } }
        }
        t = t1 + 2.3 + R() * 1.6;                                                  // 집 사이 골목 (2.3~3.9m)
      }
    });
    // 길: 주차된 차 · 가로등 (학교 담장 쪽 길가)
    const roadSide = [
      { o: 'x', a0: inner.x0 + 2, a1: inner.x1 - 2, b: inner.z0 + 1.0 }, { o: 'x', a0: inner.x0 + 2, a1: inner.x1 - 2, b: inner.z1 - 1.0 },
      { o: 'z', a0: inner.z0 + 2, a1: inner.z1 - 2, b: inner.x0 + 1.0 }, { o: 'z', a0: inner.z0 + 2, a1: inner.z1 - 2, b: inner.x1 - 1.0 }];
    roadSide.forEach((rs, i) => {
      for (let a = rs.a0 + 3 + R() * 4; a < rs.a1 - 3; a += 11 + R() * 4) {
        const gp = this.gates.some(g => (rs.o === 'x' ? Math.abs(g[0] - a) : Math.abs(g[1] - a)) < 3.5 && (rs.o === 'x' ? Math.abs(g[1] - rs.b) : Math.abs(g[0] - rs.b)) < st + 1);
        if (gp) continue;
        if (R() < 0.42) { const hl = 2.1, hw = 0.95; const r = rs.o === 'x' ? [a - hl, rs.b - hw, a + hl, rs.b + hw] : [rs.b - hw, a - hl, rs.b + hw, a + hl];
          this.box(r[0], r[1], r[2], r[3], 1.5, 'car', { col: Math.floor(R() * 5), dir: rs.o }); }
        else if (R() < 0.55) { const p = rs.o === 'x' ? [a, rs.b + (i === 0 ? 0.5 : -0.5)] : [rs.b + (i === 2 ? 0.5 : -0.5), a]; this.lamps.push({ x: p[0], z: p[1] }); }
      }
    });
    // 마을 모퉁이 가로등
    [[inner.x0 + 0.6, inner.z0 + 0.6], [inner.x1 - 0.6, inner.z0 + 0.6], [inner.x0 + 0.6, inner.z1 - 0.6], [inner.x1 - 0.6, inner.z1 - 0.6]].forEach(p => this.lamps.push({ x: p[0], z: p[1] }));
  }
  // 공간 격자 (4m 칸)
  index() {
    const L = this.L, G = this.gN = Math.ceil(L / 4), grid = this.grid = []; for (let i = 0; i < G * G; i++) grid.push([]);
    const add = (o, x0, z0, x1, z1) => { const i0 = Math.max(0, Math.floor(x0 / 4)), i1 = Math.min(G - 1, Math.floor(x1 / 4)), j0 = Math.max(0, Math.floor(z0 / 4)), j1 = Math.min(G - 1, Math.floor(z1 / 4));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) grid[j * G + i].push(o); };
    this.solid = [];
    this.boxes.forEach(b => { if (b.y0 > 2) return; const o = { t: 'b', b, see: b.h >= 1.0 }; this.solid.push(o); add(o, b.x0, b.z0, b.x1, b.z1); });
    this.trees.forEach(t => { const o = { t: 'c', x: t.x, z: t.z, r: t.r, see: true }; this.solid.push(o); add(o, t.x - t.r, t.z - t.r, t.x + t.r, t.z + t.r); });
    this.lamps.forEach(l => { const o = { t: 'c', x: l.x, z: l.z, r: 0.16, see: false }; this.solid.push(o); add(o, l.x - 0.16, l.z - 0.16, l.x + 0.16, l.z + 0.16); });
  }
  near(x0, z0, x1, z1, fn) {
    const G = this.gN, i0 = Math.max(0, Math.floor(x0 / 4)), i1 = Math.min(G - 1, Math.floor(x1 / 4)), j0 = Math.max(0, Math.floor(z0 / 4)), j1 = Math.min(G - 1, Math.floor(z1 / 4));
    const stamp = this._st = (this._st || 0) + 1;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const c = this.grid[j * G + i]; for (let k = 0; k < c.length; k++) { const o = c[k]; if (o._s === stamp) continue; o._s = stamp; if (fn(o)) return true; } }
    return false;
  }
  // 원(x,z,r)이 막힌 곳과 겹치는지
  blocked(x, z, r) {
    const L = this.L; if (x < r || z < r || x > L - r || z > L - r) return true;
    return this.near(x - r, z - r, x + r, z + r, o => {
      if (o.t === 'c') { const dx = x - o.x, dz = z - o.z, rr = r + o.r; return dx * dx + dz * dz < rr * rr; }
      const b = o.b, qx = Math.max(b.x0 - x, 0, x - b.x1), qz = Math.max(b.z0 - z, 0, z - b.z1); return qx * qx + qz * qz < r * r; });
  }
  // 겹치면 밖으로 밀어냄 (두 번)
  resolve(x, z, r) {
    for (let it = 0; it < 3; it++) { let moved = false;
      this.near(x - r, z - r, x + r, z + r, o => {
        if (o.t === 'c') { const dx = x - o.x, dz = z - o.z, rr = r + o.r, d2 = dx * dx + dz * dz; if (d2 >= rr * rr) return false; const d = Math.sqrt(d2) || 1e-4; x = o.x + dx / d * rr; z = o.z + dz / d * rr; moved = true; return false; }
        const b = o.b, inX = x > b.x0 && x < b.x1, inZ = z > b.z0 && z < b.z1;
        if (inX && inZ) { const l = x - b.x0, rgt = b.x1 - x, t = z - b.z0, bt = b.z1 - z, m = Math.min(l, rgt, t, bt);
          if (m === l) x = b.x0 - r; else if (m === rgt) x = b.x1 + r; else if (m === t) z = b.z0 - r; else z = b.z1 + r; moved = true; return false; }
        const qx = x < b.x0 ? b.x0 : x > b.x1 ? b.x1 : x, qz = z < b.z0 ? b.z0 : z > b.z1 ? b.z1 : z, dx = x - qx, dz = z - qz, d2 = dx * dx + dz * dz;
        if (d2 >= r * r) return false; const d = Math.sqrt(d2) || 1e-4; x = qx + dx / d * r; z = qz + dz / d * r; moved = true; return false; });
      const L = this.L; x = Math.max(r, Math.min(L - r, x)); z = Math.max(r, Math.min(L - r, z));
      if (!moved) break; }
    return [x, z];
  }
  // 움직이기: 잘게 나눠 미끄러지며 (벽을 뚫지 않게)
  move(x, z, dx, dz, r) {
    const len = Math.sqrt(dx * dx + dz * dz), n = Math.max(1, Math.ceil(len / 0.22)), sx = dx / n, sz = dz / n;
    for (let i = 0; i < n; i++) {
      if (!this.blocked(x + sx, z + sz, r)) { x += sx; z += sz; }
      else if (sx && !this.blocked(x + sx, z, r)) x += sx;
      else if (sz && !this.blocked(x, z + sz, r)) z += sz;
      else { const p = this.resolve(x + sx * 0.3, z + sz * 0.3, r); x = p[0]; z = p[1]; }
    }
    return this.resolve(x, z, r);
  }
  // 두 점 사이 시야가 트였는지 (1m 넘는 상자 · 나무 줄기가 막음)
  los(x0, z0, x1, z1) {
    const dx = x1 - x0, dz = z1 - z0;
    return !this.near(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1), o => {
      if (!o.see) return false;
      if (o.t === 'c') { const l2 = dx * dx + dz * dz; let t = l2 > 0 ? ((o.x - x0) * dx + (o.z - z0) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; const qx = x0 + dx * t - o.x, qz = z0 + dz * t - o.z; return qx * qx + qz * qz < o.r * o.r * 0.8; }
      const b = o.b; let t0 = 0, t1 = 1;
      const slab = (p, d, lo, hi) => { if (Math.abs(d) < 1e-9) return p > lo && p < hi; let a = (lo - p) / d, c = (hi - p) / d; if (a > c) { const s = a; a = c; c = s; } if (a > t0) t0 = a; if (c < t1) t1 = c; return t0 < t1; };
      return slab(x0, dx, b.x0 + 0.02, b.x1 - 0.02) && slab(z0, dz, b.z0 + 0.02, b.z1 - 0.02);
    });
  }
  // 출발 자리 · 아이템 자리 (트인 곳)
  makeSpawns() {
    const L = this.L, sp = this.spawns = [];
    for (let z = 2; z < L - 1.5; z += 2.5) for (let x = 2; x < L - 1.5; x += 2.5) if (!this.blocked(x, z, 1.0)) sp.push([x, z]);
    if (!sp.length) sp.push([L / 2, L / 2]);
    // 아이템 자리: 멀리 떨어지게 (가장 먼 점 고르기)
    const n = Math.max(6, Math.min(18, Math.round(L * L / 420))), slots = this.itemSlots = [sp[Math.floor(this.R() * sp.length)]], dmin = sp.map(p => 1e9);
    while (slots.length < n) { const last = slots[slots.length - 1]; let bi = 0, bd = -1;
      for (let i = 0; i < sp.length; i++) { const p = sp[i], d = (p[0] - last[0]) * (p[0] - last[0]) + (p[1] - last[1]) * (p[1] - last[1]); if (d < dmin[i]) dmin[i] = d; if (dmin[i] > bd) { bd = dmin[i]; bi = i; } }
      if (bd < 9) break; slots.push(sp[bi]); }
  }
}

// ══ 내 캐릭터 한 명 (내 기기) + 다른 학생 보기 ══
class TagCore {
  constructor(opts) {
    const o = this.opts = opts || {};
    this.myId = o.myId || 'me'; this.myName = o.myName || '';
    const tk = tgParseTrack(o.trackId); this.nSize = tk.n; this.L = tgSizeFor(tk.n);
    this.seed = +o.seed || 0; this.seedInt = Math.floor(this.seed / 1000) % 1000003;
    this.world = TgWorld.get(this.L, this.seedInt);
    this.now = 0; this.lastTime = 0; this.lastSrv = 0;
    this.startAt = this.seed || this.srv(); this.endAt = +o.endAt || 0;
    this.peers = {}; this.toasts = []; this.feed = []; this.fx = []; this.shots = []; this.hist = [];
    this.score = 0; this.catches = 0; this.survMs = 0; this.bonus = 0; this.survSec = 0; this.lastRounds = 0;
    this.r = 1; this.rs = this.startAt; this.role = 'h'; this.origin = false; this.picked = false; this.spawned = false; this.roundEnded = false;
    this.infBy = ''; this.infR = 0; this.infAt = -1e9; this.credited = {}; this.claimAt = {}; this.claimN = {}; this.taken = {};
    this.mx = 0; this.my = 0; this.boost = false; this.stam = 100; this.sprinting = false; this.stamLock = false; this.lastSprint = -1e9;
    this.dashUntil = 0; this.dashCdUntil = 0; this.dashDx = 0; this.dashDz = 0; this.frozenUntil = 0; this.frzImmune = 0; this.stunUntil = 0; this.riseUntil = 0; this.immuneUntil = 0;
    this.spdUntil = 0; this.invUntil = 0; this.shield = false; this.snow = 0; this.throwAt = -1e9;
    this.x = this.L / 2; this.z = this.L / 2; this.h = -Math.PI / 2; this.vx = 0; this.vz = 0;
    this.gameOver = false; this.endReason = ''; this.rank = 0; this.total = 0; this.winner = ''; this.result = null;
    this.lastRound = null; this.bannerAt = 0; this.banner = null;
    // 늦게 들어옴: 친구들 신호를 받아 라운드를 맞출 때까지 잠깐 기다림 (그동안 'w' — 친구들은 셈에 넣지 않음)
    const late = this.srv() - this.startAt > 3000;
    this.joinUntil = late ? 1 : 0; this.joinWait = late; this.joinStart = 0; this.lateJoin = late;
    let saved = null; try { saved = typeof sessionStorage !== 'undefined' && JSON.parse(sessionStorage.getItem(this.saveKey()) || 'null'); } catch (e) {}
    if (saved && saved.seed === this.seed) this.restore(saved); else this.spawnAt(1);
  }
  saveKey() { return 'tag3d:' + this.seed + ':' + this.myId; }
  restore(s) {
    ['catches', 'survMs', 'bonus', 'x', 'z', 'r', 'rs', 'infR', 'snow'].forEach(k => { if (isFinite(+s[k])) this[k] = +s[k]; });
    this.role = s.role === 'z' ? 'z' : 'h'; this.picked = !!s.picked; this.spawned = !!s.spawned; this.origin = !!s.origin; this.infBy = s.infBy || ''; this.shield = !!s.shield;
    if (s.cr && typeof s.cr === 'object') this.credited = s.cr;
    this.restored = true; this.prepSeen = true; this.joinWait = false; this.joinUntil = 0; this.lateJoin = false; this.calcScore();
  }
  save() {
    try { if (typeof sessionStorage === 'undefined') return;
      sessionStorage.setItem(this.saveKey(), JSON.stringify({ seed: this.seed, catches: this.catches, survMs: Math.round(this.survMs), bonus: this.bonus, x: +this.x.toFixed(1), z: +this.z.toFixed(1), r: this.r, rs: this.rs, role: this.role,
        picked: this.picked, spawned: this.spawned, origin: this.origin, infBy: this.infBy, infR: this.infR, cr: this.credited, shield: this.shield, snow: this.snow })); } catch (e) {}
  }
  srv() { return this.opts.serverNow ? this.opts.serverNow() : (this.now || 0); }
  matchEnd() { return this.endAt > 0 ? this.endAt : this.startAt + TG_MATCH; }
  prepOf(r) { return r <= 1 ? TG_PREP1 : TG_PREP; }
  pickAt() { return this.rs + this.prepOf(this.r); }
  huntEnd() { return this.pickAt() + TG_HUNT; }
  // 지금 단계: join(참가 중) · wait(라운드 시작 전/라운드 사이) · prep(흩어지기) · hunt(사냥)
  phase(srv) { srv = srv == null ? this.srv() : srv; if (this.joinWait) return 'join'; if (srv < this.rs) return 'wait'; if (srv < this.pickAt()) return 'prep'; return 'hunt'; }
  get isZombie() { return this.role === 'z'; }
  active(now) { return this.role === 'z' && now >= this.riseUntil && now >= this.frozenUntil && now >= this.stunUntil; }   // 좀비가 잡을 수 있는 상태
  calcScore() { this.survSec = Math.floor(this.survMs / 1000); this.score = this.survSec + TG_PTS_CATCH * this.catches + this.bonus; return this.score; }
  toast(text, color, ms) { this.toasts.push({ text, color: color || '#fff', until: this.now + (ms || 1800) }); if (this.toasts.length > 4) this.toasts.shift(); }
  say(title, sub, color, ms) { this.banner = { title, sub: sub || '', color: color || '#FFD166', at: this.now, until: this.now + (ms || 2400) }; }
  feedPush(a, b, kind) { this.feed.unshift({ a: a || '?', b: b || '?', kind, t: this.now + 4500 }); if (this.feed.length > 4) this.feed.length = 4; }
  nameOf(id) { if (id === this.myId) return this.myName || '나'; const p = this.peers[id]; return (p && p.name) || (this.opts.nameOf && this.opts.nameOf(id)) || '친구'; }
  send(type, target, payload) { if (this.opts.onAttack) this.opts.onAttack(type, target, payload); }
  addFx(kind, x, z, s) { if (this.fx.length >= 50) this.fx.shift(); this.fx.push({ kind, x, z, s: s || 1, t: 0 }); }
  sfx(k) {
    if (typeof window === 'undefined' || !window.Sound) return; const S = window.Sound;
    try {
      if (k === 'caught') { if (S.death) S.death(); if (window.Haptic) window.Haptic.big(); }
      else if (k === 'catch') { if (S.kill) S.kill(); }
      else if (k === 'item') { if (S.item) S.item(); else if (S.gem) S.gem(); }
      else if (k === 'shield') { if (S.hitmark) S.hitmark(); if (S.bump) S.bump(); }
      else if (k === 'dash') { if (S.dash) S.dash(); }
      else if (k === 'throw') { if (S.throwBomb) S.throwBomb(); }
      else if (k === 'freeze') { if (S.hurt) S.hurt(); }
      else if (k === 'round') { if (S.levelUp) S.levelUp(); }
      else if (k === 'zombie') { if (S.explosion) S.explosion(); }
      else if (k === 'count') { if (S.countdown) S.countdown(1); }
    } catch (e) {}
  }

  // ── 조작 (index.html 의 조이스틱 · ⚡ 버튼 · 키) ──
  setMove(x, y) { this.mx = +x || 0; this.my = +y || 0; }
  setBoost(on) {
    on = !!on; const was = this.boost; this.boost = on;
    if (on && !was && this.role === 'z' && !this.gameOver) this.dash();
  }
  dash() {
    const now = this.now; if (now < this.dashCdUntil || !this.active(now) || this.phase() !== 'hunt') return false;
    let dx = this.mx, dz = this.my, l = Math.hypot(dx, dz); if (l < 0.15) { dx = Math.cos(this.h); dz = Math.sin(this.h); l = 1; }
    this.dashDx = dx / l; this.dashDz = dz / l; this.dashUntil = now + TG_DASH_MS; this.dashCdUntil = now + TG_DASH_CD; this.sfx('dash'); this.shake = Math.max(this.shake || 0, 0.35);
    return true;
  }

  // ── 라운드 ──
  participants(withMe) {
    const now = this.now, list = []; if (withMe !== false && !this.joinWait) list.push({ id: this.myId, role: this.role, me: true });
    for (const id in this.peers) { const p = this.peers[id]; if (p.role === 'w' || p.r !== this.r || now - p.seen > 6000 || p.final) continue; list.push({ id, role: p.role, p }); }
    return list;
  }
  counts() { let h = 0, z = 0; for (const q of this.participants()) { if (q.role === 'z') z++; else h++; } return { h, z }; }
  pickOrder(ids) { const s = this.seedInt, r = this.r; return ids.slice().sort((a, b) => (tgHash(s, r * 7919, tgStrHash(a)) - tgHash(s, r * 7919, tgStrHash(b))) || (a < b ? -1 : 1)); }
  zombieCount(n) { return n < 2 ? 0 : n <= 14 ? 1 : n <= 24 ? 2 : 3; }
  setRound(r, rs) {
    this.r = r; this.rs = rs; this.role = 'h'; this.origin = false; this.picked = false; this.spawned = false; this.roundEnded = false; this.prepSeen = false;
    this.claimAt = {}; this.claimN = {}; this.dashUntil = 0; this.frozenUntil = 0; this.stunUntil = 0; this.riseUntil = 0; this.immuneUntil = 0;
    this.spdUntil = 0; this.invUntil = 0; this.shield = false; this.snow = 0;
    this.save();
  }
  // 라운드 끝 (내 화면에서): 사람이 없음(all) · 시간 다 됨(cap) → 다음 라운드 시작 시각 제안 (0.1초 단위로 맞춤)
  endRound(E, why) {
    if (this.roundEnded) return; this.roundEnded = true;
    const c = this.counts(), surv = this.participants().filter(q => q.role === 'h').map(q => q.id);
    if (why === 'cap' && this.role === 'h' && !this.joinWait) { this.bonus += TG_PTS_SURVIVE; this.calcScore(); this.toast('끝까지 살아남음! +' + TG_PTS_SURVIVE, '#9EF0B0', 2600); }
    this.lastRound = { r: this.r, why, surv: surv.map(id => this.nameOf(id)), nh: c.h, nz: c.z, at: this.now };
    const rs = this.startAt + Math.ceil((E + TG_INTER - this.startAt) / 100) * 100;
    this.say(this.r + '라운드 끝!', why === 'cap' ? '살아남은 사람 ' + surv.length + '명 · 보너스 +' + TG_PTS_SURVIVE : '사람이 모두 잡혔어요', '#FFD166', 3600);
    this.sfx('round'); this.setRound(this.r + 1, rs);
  }
  // 내 라운드를 친구 신호로 맞춤 — 더 높은 라운드 · 같은 라운드면 더 이른 시작(아직 좀비를 안 뽑았을 때)
  adoptRound(d, srv) {
    if (this.gameOver || !(d.r > 0)) return;
    if (d.r > this.r) {
      this.lastRound = d.r === this.r + 1 && this.picked ? { r: this.r, why: 'all', surv: [], nh: 0, nz: 0, at: this.now } : null;   // 내 화면에선 아직 끝나지 않았던 라운드
      this.setRound(d.r, d.rs);
      if (!this.joinWait && srv < this.rs) this.say((d.r - 1) + '라운드 끝!', '곧 다음 라운드', '#FFD166', 2600);
    } else if (d.r === this.r && d.rs < this.rs - 50 && !this.picked && d.r > 1) this.rs = d.rs;
  }
  stepRound(srv) {
    const now = this.now;
    if (this.joinWait) {
      if (this.joinUntil === 1) this.joinUntil = now + 2500;
      if (now >= this.joinUntil) { this.joinWait = false; const ph = this.phase(srv);
        if (ph === 'hunt' && this.counts().h + this.counts().z > 1) { this.spawned = true; this.spawnAt(this.r * 31 + 7); this.becomeZombie('', 'late'); this.picked = true; }
        else if (ph === 'hunt') { this.picked = true; this.spawned = true; this.spawnAt(this.r * 31 + 7); } }
      return;
    }
    if (!this.spawned && srv >= this.rs) { this.spawned = true; this.spawnAt(this.r); if (this.r > 1) this.say(this.r + '라운드 준비!', '흩어지세요 · ' + Math.round(this.prepOf(this.r) / 1000) + '초 뒤 좀비 등장', '#9EF0B0', 2600); else this.say('흩어지세요!', Math.round(TG_PREP1 / 1000) + '초 뒤 좀비가 나타나요', '#9EF0B0', 2600); }
    const pa = this.pickAt();
    if (!this.picked && srv >= pa) {
      this.picked = true;
      const parts = this.participants(), ids = parts.map(q => q.id), k = this.zombieCount(ids.length);
      if (!this.prepSeen && k > 0) this.becomeZombie('', 'late');                        // 준비 시간을 못 봄(늦게 맞춘 라운드) → 좀비로 참가
      else if (k > 0 && this.pickOrder(ids).slice(0, k).indexOf(this.myId) >= 0) this.becomeZombie('', 'origin');
      else if (k > 0) this.say('좀비가 나타났어요!', '도망쳐요 · 좀비에게 닿으면 좀비가 돼요', '#FF8A8A', 2400);
      else this.say('혼자 연습 중', '친구가 들어오면 좀비가 생겨요', '#BFD3FF', 2600);
      this.restored = false; this.save();
    }
    if (srv >= this.rs && srv < pa) this.prepSeen = true;
    if (this.phase(srv) !== 'hunt' || this.roundEnded) return;
    const parts = this.participants(), c = this.counts();
    // 좀비가 아무도 없음(뽑힌 친구가 안 보임) → 2.5초 뒤 해시가 가장 작은 사람이 좀비
    if (c.z === 0 && parts.length >= 2 && srv >= pa + 2500 && this.role === 'h') { const ord = this.pickOrder(parts.map(q => q.id)); if (ord[0] === this.myId) this.becomeZombie('', 'origin'); }
    if (srv >= this.huntEnd()) { this.endRound(this.huntEnd(), 'cap'); return; }
    // 사람이 모두 잡힘 (신호는 1초마다 오므로 6초 넘게 안 온 친구는 셈에서 뺌 · 4초 넘게 안 온 친구가 있으면 잠깐 기다림 · 둘 이상일 때만)
    if (c.h === 0 && parts.length >= 2 && srv >= pa + 1500) { let fresh = true; for (const q of parts) if (q.p && this.now - q.p.seen > 4000) fresh = false; if (fresh) this.endRound(srv, 'all'); }
  }
  spawnAt(salt) {
    const sp = this.world.spawns, i = Math.floor(tgHash(this.seedInt + salt * 131, tgStrHash(this.myId), 77) * sp.length) % sp.length, p = sp[i];
    const q = this.world.resolve(p[0] + (tgHash(i, salt, 3) - 0.5) * 1.2, p[1] + (tgHash(i, salt, 4) - 0.5) * 1.2, TG_R);
    this.x = q[0]; this.z = q[1]; this.vx = this.vz = 0; this.h = Math.atan2(this.L / 2 - this.z, this.L / 2 - this.x); this.teleAt = this.now; this.hist.length = 0;
  }
  becomeZombie(byId, how) {
    if (this.role === 'z') return;
    const now = this.now; this.role = 'z'; this.origin = how === 'origin'; this.riseUntil = now + (how === 'origin' ? TG_RISE0 : TG_RISE);
    this.spdUntil = 0; this.invUntil = 0; this.shield = false; this.snow = 0; this.stam = 100; this.boost = false;
    this.addFx('infect', this.x, this.z, 1.4); this.shake = Math.max(this.shake || 0, 0.8);
    if (how === 'origin') { this.say('당신은 좀비!', '사람에게 닿으면 잡아요 · ⚡ 돌진', '#FF5A6E', 3200); this.sfx('zombie'); }
    else if (how === 'late') { this.say('좀비로 참가!', '사람을 잡으면 +' + TG_PTS_CATCH, '#FF5A6E', 3000); }
    else {
      this.infBy = byId; this.infR = this.r; this.infAt = now;
      const others = this.participants().filter(q => q.role === 'h' && !q.me).length;
      this.say('잡혔어요! 이제 좀비', '다른 사람을 잡으면 +' + TG_PTS_CATCH, '#FF5A6E', 3000); this.sfx('caught');
      if (others === 0 && this.phase() === 'hunt') { this.bonus += TG_PTS_LAST; this.toast('마지막 생존자 보너스 +' + TG_PTS_LAST, '#FFD166', 2600); }
      this.send('got', byId, { r: this.r, x: +this.x.toFixed(1), z: +this.z.toFixed(1) });
      this.feedPush(this.nameOf(byId), this.myName || '나', 'mv');
    }
    this.calcScore(); this.save();
  }
  // 좀비에게 잡힘 (내 화면 판정) — 방패가 있으면 한 번 막고 그 좀비를 잠깐 기절
  caughtBy(zid) {
    const now = this.now;
    if (this.role !== 'h' || now < this.immuneUntil) return false;
    if (this.shield) { this.shield = false; this.immuneUntil = now + 1600; this.send('stun', zid, { r: this.r }); this.toast('방패가 막았어요!', '#4CC9F0', 1800); this.sfx('shield'); this.addFx('shield', this.x, this.z, 1.2); this.save(); return false; }
    this.becomeZombie(zid, 'tag'); return true;
  }
  credit(vid, r) {
    const k = vid + ':' + r; if (this.credited[k] || this.gameOver) return;
    this.credited[k] = 1; this.catches++; this.calcScore();
    this.toast(this.nameOf(vid) + ' 잡았다! +' + TG_PTS_CATCH, '#FFD166', 2000); this.sfx('catch'); this.feedPush(this.myName || '나', this.nameOf(vid), 'me'); this.save();
  }
  // 그 시각(서버 ms) 내 자리 (기록에서)
  posAt(t) {
    const h = this.hist; if (!h.length) return [this.x, this.z];
    if (t >= h[h.length - 1][0]) return [h[h.length - 1][1], h[h.length - 1][2]];
    for (let i = h.length - 1; i > 0; i--) { const a = h[i - 1], b = h[i]; if (a[0] <= t) { const k = b[0] > a[0] ? (t - a[0]) / (b[0] - a[0]) : 0; return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; } }
    return [h[0][1], h[0][2]];
  }

  // ── 위치 신호 ──
  // x,z,방향(도),깃발,역할+라운드(36진수),라운드 시작(판 시작부터 0.1초 · 36진수),점수,잡은 수,보낸 시각(36진수),속도x,속도z,잡은 좀비 id,그 라운드
  //   깃발: 1 달리기 · 2 돌진 · 4 얼음 · 8 투명 · 16 방패 · 32 신발 · 64 끝(최종 점수) · 128 일어나는 중 · 256 처음 좀비 · 512 기절 · 1024 보호(방패 직후)
  serialize() {
    const now = this.now, deg = a => { let d = Math.round(a * 180 / Math.PI) % 360; if (d < 0) d += 360; return d; }, r1 = v => { const x = Math.round(v * 10) / 10; return x === 0 ? '0' : String(x); };
    const fl = (this.sprinting ? 1 : 0) | (now < this.dashUntil ? 2 : 0) | (now < this.frozenUntil ? 4 : 0) | (now < this.invUntil ? 8 : 0) | (this.shield ? 16 : 0) | (now < this.spdUntil ? 32 : 0) | (this.gameOver ? 64 : 0) |
      (this.role === 'z' && now < this.riseUntil ? 128 : 0) | (this.origin ? 256 : 0) | (now < this.stunUntil ? 512 : 0) | (now < this.immuneUntil ? 1024 : 0);
    const ib = this.infBy && now - this.infAt < 8000 ? this.infBy + ',' + this.infR.toString(36) : ',';
    const head = [r1(this.x), r1(this.z), deg(this.h), fl, (this.joinWait ? 'w' : this.role) + this.r.toString(36), Math.max(0, Math.round((this.rs - this.startAt) / 100)).toString(36), this.score, this.catches].join(',');
    const tail = r1(this.vx) + ',' + r1(this.vz) + ',' + ib;
    if (head === this._sh && tail === this._st && this._ser && now - this._serAt < 1000) return this._ser;   // 가만히 있어도 1초마다 보낸 시각이 바뀜 (살아 있음 알림)
    this._sh = head; this._st = tail; this._serAt = now; this._ser = head + ',' + (Math.round(this.srv()) % TG_WRAP).toString(36) + ',' + tail;
    return this._ser;
  }
  static parse(raw) {
    const a = String(raw).split(','); if (a.length < 13) return null;
    const rr = a[4] || 'h1';
    return { x: +a[0], z: +a[1], h: (+a[2] || 0) * Math.PI / 180, fl: +a[3] || 0, role: rr[0] === 'z' ? 'z' : rr[0] === 'w' ? 'w' : 'h', r: parseInt(rr.slice(1), 36) || 1, rso: parseInt(a[5], 36) || 0,
      score: +a[6] || 0, catches: +a[7] || 0, st: a[8] ? parseInt(a[8], 36) : null, vx: +a[9] || 0, vz: +a[10] || 0, ib: a[11] || '', ir: a[12] ? parseInt(a[12], 36) : 0 };
  }
  applyPeerRaw(id, raw, name) {
    if (typeof raw !== 'string' || id === this.myId) return;
    let p = this.peers[id];
    if (p && p.raw === raw) { if (name) p.name = name; p.seen = this.now; return; }
    const d = TagCore.parse(raw); if (!d || !isFinite(d.x) || !isFinite(d.z)) return;
    const now = this.now, srv = this.srv();
    if (!p) { p = this.peers[id] = { id, x: d.x, z: d.z, h: d.h, cx: 0, cz: 0, name: name || '', fl: 0, role: d.role, r: d.r, born: now }; }
    if (d.st != null && p.st != null) { const ds = (d.st - p.st + TG_WRAP) % TG_WRAP; if (ds === 0 || ds > TG_WRAP - 5000) { p.raw = raw; p.seen = now; return; } }   // 더 오래된 신호면 버림
    p.raw = raw; p.seen = now; if (name) p.name = name;
    let age = TG_BASE_LAT * TG_LEAD;
    if (d.st != null) {
      const off = now - d.st, keep = p.off != null && Math.abs(off - p.off) < 5000;
      p.off = keep ? Math.min(off, p.off + Math.max(0, now - (p.at || now)) * 0.002) : off;
      const jit = Math.max(0, off - p.off);
      if (this.opts.serverNow) { const sa = ((Math.round(srv) % TG_WRAP) - d.st + TG_WRAP) % TG_WRAP; if (sa < 3000) { const b = Math.max(15, Math.min(300, sa - jit)); p.base = p.base == null ? b : p.base + (b - p.base) * 0.1; } }
      age = Math.min(600, ((p.base != null ? p.base : TG_BASE_LAT) + jit) * TG_LEAD); p.st = d.st;
    }
    { const iv = p.iv || this.opts.sendMs || 165; p.iv = p.at == null ? iv : (now - p.at < iv * 2.5 ? iv + (Math.max(40, now - p.at) - iv) * 0.15 : iv); p.tau = Math.max(90, Math.min(150, 100 * p.iv / 165)); }
    p.at = now;
    const had = p.tx != null, shownX = p.x, shownZ = p.z, oldRole = p.role, oldR = p.r;
    const rs = this.startAt + d.rso * 100;
    Object.assign(p, { tx: d.x, tz: d.z, vx: d.vx, vz: d.vz, sAt: now - age, th: d.h, fl: d.fl, role: d.role, r: d.r, rs, score: d.score, catches: d.catches,
      sprint: !!(d.fl & 1), dash: !!(d.fl & 2), frozen: !!(d.fl & 4), inv: !!(d.fl & 8), shield: !!(d.fl & 16), spd: !!(d.fl & 32), final: !!(d.fl & 64), rise: !!(d.fl & 128), origin: !!(d.fl & 256), stun: !!(d.fl & 512), immune: !!(d.fl & 1024) });
    const g = this.predict(p, now);
    if (had && Math.hypot(shownX - g.x, shownZ - g.z) < 4 && oldR === d.r) { p.cx = shownX - g.x; p.cz = shownZ - g.z; } else { p.cx = 0; p.cz = 0; p.x = g.x; p.z = g.z; p.h = p.th; }
    if (had && oldRole === 'h' && d.role === 'z' && oldR === d.r) { this.addFx('infect', p.x, p.z, 1.2); p.turnedAt = now; }
    // 위치 신호의 '잡은 좀비' 칸 = 'got' 사건을 놓쳤을 때를 위한 두 번째 길
    if (d.ib === this.myId && d.ir > 0 && d.role === 'z') this.credit(id, d.ir);
    if (d.role !== 'w' && !this.joinWait) this.adoptRound({ r: d.r, rs }, srv);
    else if (d.role !== 'w' && this.joinWait) { if (d.r > this.r || (d.r === this.r && rs < this.rs)) { this.r = d.r; this.rs = rs; this.picked = false; this.spawned = false; this.roundEnded = false; } if (!this.joinStart) { this.joinStart = now; this.joinUntil = Math.min(this.joinUntil === 1 ? now + 2500 : this.joinUntil, now + 700); } }
    if (p.final && this.gameOver) this.rerank();
  }
  predict(p, now) {
    const out = this._pr || (this._pr = { x: 0, z: 0 });
    const a = Math.max(0, Math.min(p.dash ? 120 : 300, now - p.sAt)) / 1000; let x = p.tx, z = p.tz;   // 돌진은 갑자기 멈추므로 조금만 앞당김
    if (!p.frozen && (p.vx || p.vz) && a > 0) { x += p.vx * a; z += p.vz * a; }
    out.x = Math.max(0.5, Math.min(this.L - 0.5, x)); out.z = Math.max(0.5, Math.min(this.L - 0.5, z)); return out;
  }
  removePeer(id) { delete this.peers[id]; }
  setPeers(map) { Object.keys(map).forEach(id => { const d = map[id]; if (d && d.raw) this.applyPeerRaw(id, d.raw, d.name); }); Object.keys(this.peers).forEach(id => { if (!map[id]) this.removePeer(id); }); }
  syncRoster(r) { if (!r) return; for (const id in this.peers) { if (r[id] == null) this.removePeer(id); else if (r[id]) this.peers[id].name = r[id]; } }
  setHazards() {}

  // ── 사건 받기 ──
  onEvent(e) {
    if (!e || typeof e !== 'object' || !e.type) return;
    const now = this.now, srv = this.srv(), by = e.by;
    if (e.type === 'tag') {
      if (e.target !== this.myId || this.gameOver || this.joinWait) return;
      const why = this.judgeTag(e, srv); if (this.onJudge) this.onJudge(e, why);
      if (why === 'ok') this.caughtBy(by);
      return;
    }
    if (e.type === 'got') {
      if (e.target === this.myId) this.credit(by, +e.r || this.r);
      else if (by !== this.myId) { this.feedPush(this.nameOf(e.target), this.nameOf(by), ''); if (isFinite(+e.x)) this.addFx('infect', +e.x, +e.z, 1); }
      return;
    }
    if (e.type === 'stun') { if (e.target === this.myId && this.role === 'z' && (+e.r || 0) === this.r) { this.stunUntil = Math.max(this.stunUntil, now + TG_STUN); this.dashUntil = 0; this.toast('방패에 막혀 기절!', '#4CC9F0', 1400); this.sfx('shield'); } return; }
    if (e.type === 'frz') {
      const p = this.peers[by], tp = e.target === this.myId ? { x: this.x, z: this.z } : this.peers[e.target];
      if (p && tp) this.shots.push({ x0: p.x, z0: p.z, x1: tp.x, z1: tp.z, t0: now, T: 380 });
      if (e.target === this.myId && this.role === 'z' && now >= this.frzImmune && (+e.r || 0) === this.r) {
        const d = p ? Math.hypot(p.x - this.x, p.z - this.z) : 0;
        if (!p || d < 14) { this.frozenUntil = now + TG_FREEZE; this.frzImmune = now + TG_FREEZE + 2500; this.dashUntil = 0; this.toast('눈덩이에 맞아 얼었어요!', '#BFE8FF', 1800); this.sfx('freeze'); this.addFx('snow', this.x, this.z, 1.2); }
      }
      return;
    }
    if (e.type === 'item' && typeof e.k === 'string') { this.taken[e.k] = 1; return; }
  }
  // 'tag' 받기 판정: ok · late(늦음) · round · role · far(그 시각 내 자리와 멂) · wall(벽 너머) · shown(지금 내 화면에서 멂) · immune
  judgeTag(e, srv) {
    const now = this.now;
    if ((+e.r || 0) !== this.r || this.phase(srv) !== 'hunt') return 'round';
    if (this.role !== 'h') return 'role';
    if (now < this.immuneUntil) return 'immune';
    const age = srv - (+e.t || srv); if (age > TG_LATE) return 'late';
    const q = this.posAt(+e.t || srv), zx = +e.x, zz = +e.z; if (!isFinite(zx) || !isFinite(zz)) return 'far';
    if (Math.hypot(q[0] - zx, q[1] - zz) > TG_ACCEPT) return 'far';
    if (!this.world.los(q[0], q[1], zx, zz)) return 'wall';
    const p = this.peers[e.by]; if (!p || p.tx == null) return 'shown';
    if (Math.hypot(p.x - this.x, p.z - this.z) > TG_SHOWN) return 'shown';
    if (!this.world.los(this.x, this.z, p.x, p.z)) return 'wall';
    return 'ok';
  }

  // ── 아이템: 자리마다 22초에 하나 (모든 화면 같은 자리 · 같은 종류) — 먼저 줍는 사람 (동시에 주우면 둘 다) ──
  itemsNow(srv) {
    const out = this._items || (this._items = []); out.length = 0;
    const S = this.world.itemSlots, n = S.length, t = srv - this.startAt - 3000; if (t < 0) return out;
    const joinT = this.joinT || (this.joinT = srv);
    for (let s = 0; s < n; s++) { const ts = t - s * TG_ITEM_PERIOD / n; if (ts < 0) continue; const g = Math.floor(ts / TG_ITEM_PERIOD), key = s + '.' + g;
      if (this.taken[key]) continue; const at = this.startAt + 3000 + s * TG_ITEM_PERIOD / n + g * TG_ITEM_PERIOD; if (at < joinT - 3000 && this.lateJoin) continue;
      out.push({ key, s, g, x: S[s][0], z: S[s][1], k: TG_ITEM_KEYS[Math.floor(tgHash(this.seedInt, s * 97 + 13, g) * TG_ITEM_KEYS.length) % TG_ITEM_KEYS.length], age: srv - at }); }
    return out;
  }
  pickup(it) {
    const now = this.now; this.taken[it.key] = 1; this.send('item', null, { k: it.key });
    if (it.k === 'spd') this.spdUntil = now + TG_ITEMS.spd.ms; else if (it.k === 'inv') this.invUntil = now + TG_ITEMS.inv.ms; else if (it.k === 'shd') this.shield = true; else if (it.k === 'snw') this.snow = Math.min(2, this.snow + 1);
    this.toast(TG_ITEMS[it.k].name + '! ' + TG_ITEMS[it.k].desc, TG_ITEMS[it.k].color, 2200); this.sfx('item'); this.addFx('item', it.x, it.z, 1); this.save();
  }

  // ── 한 프레임 ──
  step(now) {
    const dtm = this.lastTime ? Math.max(0, Math.min(50, now - this.lastTime)) : 16.7; if (now >= this.lastTime) { this.lastTime = now; this.now = now; }
    const dt = dtm / 1000, srv = this.srv();
    this.started = srv >= this.startAt;
    if (this.gameOver) return dt;
    // 다른 학생: 예측 위치 + 남은 보정 (벽 안으로 그리지 않게 밀어냄)
    for (const id in this.peers) { const p = this.peers[id]; if (p.tx == null) continue;
      const kc = 1 - Math.exp(-dtm / (p.tau || 100)); p.cx -= p.cx * kc; p.cz -= p.cz * kc;
      const g = this.predict(p, now); let x = g.x + p.cx, z = g.z + p.cz;
      if (this.world.blocked(x, z, TG_R * 0.8)) { const q = this.world.resolve(x, z, TG_R * 0.8); x = q[0]; z = q[1]; }
      const mv = Math.hypot(x - p.x, z - p.z); p.spdShown = dt > 0 ? mv / dt : 0; p.x = x; p.z = z; p.walk = (p.walk || 0) + mv;
      const k = 1 - Math.exp(-dtm / 80); p.h += tgAng(p.th - p.h) * k; p.stale = now - p.seen > 2600; }
    // 시간 끝
    const mEnd = this.matchEnd();
    this.accrue(srv, mEnd);
    if (srv >= mEnd) { this.finish('time'); return dt; }
    this.stepRound(srv);
    this.stepMe(dt, now, srv);
    this.calcScore();
    // 효과 · 글자 정리
    for (let i = this.fx.length - 1; i >= 0; i--) { const f = this.fx[i]; f.t += dt / (f.kind === 'infect' ? 1.1 : 0.7); if (f.t >= 1) this.fx.splice(i, 1); }
    if (this.shots.length) this.shots = this.shots.filter(s => now - s.t0 < s.T + 200);
    if (this.toasts.length) this.toasts = this.toasts.filter(t => t.until > now);
    if (this.feed.length) this.feed = this.feed.filter(f => f.t > now);
    this.shake = Math.max(0, (this.shake || 0) - dt * 2.2);
    if (!this._svT || now - this._svT > 1000) { this._svT = now; this.save(); }   // 새로고침해도 이어서 (1초마다)
    return dt;
  }
  // 살아남은 시간 (사냥 중 · 사람일 때만 · 시간 제한까지)
  accrue(srv, mEnd) {
    const a0 = Math.max(this.lastSrv || srv, this.pickAt()), b0 = Math.min(srv, this.huntEnd(), mEnd);
    if (this.role === 'h' && !this.joinWait && this.started && b0 > a0 && srv - (this.lastSrv || srv) < 1000) this.survMs += b0 - a0;
    this.lastSrv = srv;
  }
  stepMe(dt, now, srv) {
    const W = this.world, ph = this.phase(srv), z = this.role === 'z';
    if (ph === 'join' || (ph === 'wait' && this.r === 1)) { this.vx = this.vz = 0; this.sprinting = false; return; }   // 첫 출발 전엔 제자리
    // 기력 (사람 달리기)
    const len = Math.min(1, Math.hypot(this.mx, this.my)), moving = len > 0.12;
    if (!z) {
      if (this.stam <= 0) this.stamLock = true; if (this.stamLock && this.stam >= 22) this.stamLock = false;
      this.sprinting = this.boost && moving && !this.stamLock && this.stam > 0;
      if (this.sprinting) { this.stam = Math.max(0, this.stam - TG_STAM_DRAIN * dt); this.lastSprint = now; } else if (now - this.lastSprint > 400) this.stam = Math.min(100, this.stam + TG_STAM_REGEN * dt);
    } else this.sprinting = false;
    // 이동
    let vx = 0, vz = 0;
    const still = (z && (now < this.riseUntil && this.origin)) || now < this.frozenUntil || now < this.stunUntil;
    if (z && now < this.dashUntil && !still) { vx = this.dashDx * TG_DASH; vz = this.dashDz * TG_DASH; this.h = Math.atan2(vz, vx); }
    else if (moving && !still) {
      let sp = z ? TG_ZOMB * (now < this.riseUntil ? 0.5 : 1) : (this.sprinting ? TG_SPRINT : TG_WALK) * (now < this.spdUntil ? 1.3 : 1);
      sp *= len; const a = Math.atan2(this.my, this.mx); vx = Math.cos(a) * sp; vz = Math.sin(a) * sp;
      const da = tgAng(a - this.h); this.h = tgAng(this.h + da * Math.min(1, dt * 14));
    }
    const ox = this.x, oz = this.z;
    if (vx || vz) { const q = W.move(this.x, this.z, vx * dt, vz * dt, TG_R); this.x = q[0]; this.z = q[1]; }
    const iv = 1 / Math.max(1e-3, dt), k = Math.min(1, dt * 12); this.vx += ((this.x - ox) * iv - this.vx) * k; this.vz += ((this.z - oz) * iv - this.vz) * k;
    if (!(vx || vz)) { if (Math.abs(this.vx) < 0.08) this.vx = 0; if (Math.abs(this.vz) < 0.08) this.vz = 0; }
    this.walk = (this.walk || 0) + Math.hypot(this.x - ox, this.z - oz);
    // 내 자리 기록 (서버 시각) — 'tag' 사건을 받을 때 그 시각 자리
    const hs = this.hist; hs.push([srv, this.x, this.z]); if (hs.length > 150) hs.splice(0, hs.length - 150);
    if (ph !== 'hunt' && ph !== 'prep') return;
    // 아이템 줍기 (사람)
    if (!z) for (const it of this.itemsNow(srv)) if (it.age >= 0 && Math.abs(it.x - this.x) < 1.1 && Math.abs(it.z - this.z) < 1.1 && Math.hypot(it.x - this.x, it.z - this.z) < 1.05) { this.pickup(it); break; }
    if (ph !== 'hunt') return;
    if (z) this.zombieCheck(now); else this.humanCheck(now);
  }
  // 좀비: 가까운 사람에게 '잡았다' 사건 (같은 사람에게 0.7초에 한 번 · 라운드당 4번까지)
  zombieCheck(now) {
    if (!this.active(now)) return;
    for (const id in this.peers) { const p = this.peers[id]; if (p.role !== 'h' || p.r !== this.r || p.tx == null || p.stale || p.immune || p.final) continue;
      const d = Math.hypot(p.x - this.x, p.z - this.z); if (d > TG_CATCH) continue;
      if (now - (this.claimAt[id] || -1e9) < 700 || (this.claimN[id] || 0) >= 4) continue;
      if (!this.world.los(this.x, this.z, p.x, p.z)) continue;
      this.claimAt[id] = now; this.claimN[id] = (this.claimN[id] || 0) + 1;
      this.send('tag', id, { r: this.r, x: +this.x.toFixed(2), z: +this.z.toFixed(2) }); if (this.onClaim) this.onClaim(id, d);
    }
  }
  // 사람: 내 화면에서 좀비와 닿으면 스스로 좀비 · 눈덩이 자동 던지기
  humanCheck(now) {
    let nz = null, nd = 1e9;
    for (const id in this.peers) { const p = this.peers[id]; if (p.role !== 'z' || p.r !== this.r || p.tx == null || p.final) continue;
      // 앞당겨 그린 자리만으로는 안 됨 — 마지막으로 받은 자리도 가까워야 (돌진이 멈춘 뒤 앞당긴 자리로 잡히지 않게)
      const d = Math.hypot(p.x - this.x, p.z - this.z), act = !p.rise && !p.frozen && !p.stun && !p.stale;
      if (act && d < nd) { nd = d; nz = p; }
      if (act && d < TG_TOUCH && now >= this.immuneUntil && Math.hypot(p.tx - this.x, p.tz - this.z) < TG_TOUCH + 1.4 && this.world.los(this.x, this.z, p.x, p.z)) { if (this.onTouch) this.onTouch(id, d); if (this.caughtBy(id)) return; } }
    this.nearZ = nz ? nd : 1e9;
    if (this.snow > 0 && nz && nd < 7 && now - this.throwAt > 900 && this.world.los(this.x, this.z, nz.x, nz.z)) {
      this.snow--; this.throwAt = now; this.send('frz', nz.id, { r: this.r }); this.shots.push({ x0: this.x, z0: this.z, x1: nz.x, z1: nz.z, t0: now, T: 380 }); this.sfx('throw'); this.toast('눈덩이 던짐!', '#BFE8FF', 1200); this.save();
    }
  }

  // ── 교사 미니보드: 36×36 (길 · 마당 · 운동장 · 건물 · 담 · 나무 · 아이템 · 사람 초록 · 좀비 빨강 · 나 노랑) ──
  getSnapshot() {
    const G = 36, W = this.world, L = this.L;
    if (!this._snapBase) { const b = this._snapBase = [], inR = (x, z, r) => x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1;
      for (let y = 0; y < G; y++) { const row = []; for (let x = 0; x < G; x++) { const wx = (x + 0.5) / G * L, wz = (y + 0.5) / G * L; let v = 62;
          for (const zn of W.zones) if (inR(wx, wz, zn)) v = zn.k === 'road' ? 12 : zn.k === 'yard' ? 66 : zn.k === 'sand' ? 57 : zn.k === 'grass' ? 42 : 62;
          row.push(v); } b.push(row); }
      const fill = (x0, z0, x1, z1, v) => { for (let y = Math.max(0, Math.floor(z0 / L * G)); y <= Math.min(G - 1, Math.floor((z1 - 0.01) / L * G)); y++) for (let x = Math.max(0, Math.floor(x0 / L * G)); x <= Math.min(G - 1, Math.floor((x1 - 0.01) / L * G)); x++) b[y][x] = v; };
      W.boxes.forEach(o => { if (o.k === 'school' || o.k === 'gym' || o.k === 'house') fill(o.x0, o.z0, o.x1, o.z1, 45); else if (o.k === 'wall' || o.k === 'edge') fill(o.x0, o.z0, o.x1, o.z1, 63); });
      W.trees.forEach(t => fill(t.x, t.z, t.x + 0.01, t.z + 0.01, 65)); }
    const g = this._snapBase.map(r => r.slice()), put = (x, z, v) => { const gx = Math.floor(x / L * G), gy = Math.floor(z / L * G); if (g[gy] && g[gy][gx] != null) g[gy][gx] = v; };
    for (const it of this.itemsNow(this.srv())) put(it.x, it.z, 48);
    for (const id in this.peers) { const p = this.peers[id]; if (p.tx == null || p.role === 'w' || p.r !== this.r) continue; put(p.x, p.z, p.role === 'z' ? 7 : 5); }
    if (!this.joinWait) put(this.x, this.z, this.role === 'z' ? 7 : 4);
    return g;
  }
  // ── 판 끝 ──
  standings() {
    const list = [{ id: this.myId, name: this.myName || '나', score: this.score, catches: this.catches, role: this.role, me: true }];
    for (const id in this.peers) { const p = this.peers[id]; if (this.now - p.seen > 12000 && !p.final) continue; list.push({ id, name: p.name || '친구', score: p.score || 0, catches: p.catches || 0, role: p.role }); }
    return list.sort(tgCmp);
  }
  rerank() { const st = this.standings(); this.rank = st.findIndex(s => s.me) + 1; this.total = st.length; this.winner = st[0] ? st[0].name : ''; if (this.result) { this.result.rank = this.rank; this.result.total = this.total; this.result.top = st.slice(0, 5); } }
  finish(reason) {
    if (this.gameOver) return;
    const mEnd = this.matchEnd(); this.accrue(Math.max(this.srv(), mEnd), mEnd); this.calcScore();
    this.gameOver = true; this.endReason = reason === 'goal' ? 'goal' : 'time'; this.boost = false;
    this.result = { rank: 0, total: 0, top: [] }; this.rerank(); this.save();
    this.say('시간 끝!', this.total + '명 중 ' + this.rank + '등 · ' + this.score + '점', '#FFD166', 9e9);
    this.sfx('round');
  }
}
if (typeof window !== 'undefined') { window.TagCore = TagCore; window.TgWorld = TgWorld; window.TG_MAPS = TG_MAPS; window.tgSizeFor = tgSizeFor; }
if (typeof module !== 'undefined' && module.exports) module.exports = { TagCore, TgWorld, tgSizeFor, tgParseTrack, TG_ITEMS };
