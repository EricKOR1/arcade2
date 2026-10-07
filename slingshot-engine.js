// 새총 물리 놀이 — 새총을 뒤로 당겼다 놓아 공(돌멩이·물방울)을 날려 쓰레기 상자 탑을 무너뜨리고 쓰레기 봉투를 치워요.
//   끄는 동안 포물선 예상 궤적 · 각도(°) · 세기(%) 표시 (과학 '포물선 운동' 연결) · 단계마다 공 개수 제한
//   물리: 상자는 꼭짓점 4개 + 막대 6개(베를레 적분)로 다뤄 밀리고·넘어지고·떨어져 부서짐 · 멈춘 물체는 '잠자기'로 떨림 없음

const SL_COLS = 10, SL_ROWS = 14, SL_GROUND = 13;
const SL_G = 0.0016;          // 한 걸음(1/120초)당 중력 (칸)
const SL_DAMP = 0.9995;       // 공기 저항
const SL_VMAX = 0.155;        // 세기 100% 발사 속도 (칸/걸음)
const SL_ITER = 6;            // 걸음마다 제약 반복 횟수
const SL_HIT_T = 0.025;       // 이보다 빠르게 부딪쳐야 피해
const SL_SLEEP_V = 0.0012, SL_SLEEP_N = 45;
const SL_SLING = { x: 1.55, y: 10.75 };   // 새총 고무줄 가운데(공 놓이는 곳)
const SL_PULL = 1.7;          // 최대 당김 (칸)
// 재질: 밀도 · 체력 · 마찰 · 점수 · 색
const SL_MAT = {
  wood:  { d: 1.0, hp: 10, mu: 0.55, pts: 60,  c1: '#E2A35C', c2: '#A8642C', snap: 43 },
  stone: { d: 2.4, hp: 40, mu: 0.6,  pts: 100, c1: '#B7BFCC', c2: '#6E7889', snap: 45 },
  glass: { d: 0.7, hp: 4,  mu: 0.35, pts: 30,  c1: '#BDF3FF', c2: '#5EC8E8', snap: 1 }
};
const SL_BALLS = { stone: { m: 2.6, r: 0.27, e: 0.25, c1: '#C9CED6', c2: '#5B6270', name: '돌멩이' },
                   water: { m: 1.5, r: 0.27, e: 0.45, c1: '#9EE6FF', c2: '#1E88D8', name: '물방울' } };

// 고정 단계 8개 — b.box(가운데x, 바닥y, 너비, 높이, 재질) / b.t(가운데x, 바닥y) 목표물. 같은 너비 상자를 꼭 맞춰 쌓지 않기(모서리 겹침 방지)
const SL_STAGES = [
  { balls: 3, build(b) { b.box(6.2, 13, 0.3, 1.4, 'wood'); b.box(7.8, 13, 0.3, 1.4, 'wood'); b.box(7.0, 11.6, 2.2, 0.26, 'glass');
      b.t(7.0, 13); b.t(7.0, 11.34); } },
  { balls: 3, build(b) { b.box(6.0, 13, 0.9, 0.9, 'glass'); b.box(6.0, 12.1, 0.78, 0.8, 'glass'); b.t(6.0, 11.3);
      b.box(8.0, 13, 0.3, 1.2, 'wood'); b.box(9.3, 13, 0.3, 1.2, 'wood'); b.box(8.65, 11.8, 1.7, 0.26, 'wood'); b.t(8.65, 13); b.t(8.65, 11.54); } },
  { balls: 4, build(b) { b.box(6.0, 13, 0.3, 1.3, 'wood'); b.box(7.4, 13, 0.3, 1.3, 'wood'); b.box(8.8, 13, 0.3, 1.3, 'wood');
      b.box(7.4, 11.7, 3.2, 0.26, 'wood'); b.box(6.6, 11.44, 0.26, 1.1, 'glass'); b.box(8.2, 11.44, 0.26, 1.1, 'glass'); b.box(7.4, 10.34, 2.2, 0.26, 'glass');
      b.t(6.7, 13); b.t(8.1, 13); b.t(7.4, 11.44); b.t(7.4, 10.08); } },
  { balls: 3, build(b) { b.box(7.5, 13, 2.6, 0.6, 'stone'); b.box(6.5, 12.4, 0.3, 1.3, 'wood'); b.box(8.5, 12.4, 0.3, 1.3, 'wood');
      b.box(7.5, 11.1, 2.6, 0.26, 'wood'); b.box(7.5, 10.84, 0.7, 0.7, 'glass'); b.t(7.5, 10.14); b.t(7.5, 12.4); b.t(9.5, 13); } },
  { balls: 4, build(b) { b.box(6.6, 13, 0.3, 1.2, 'wood'); b.box(7.8, 13, 0.3, 1.2, 'wood'); b.box(7.2, 11.8, 1.7, 0.26, 'wood');
      b.box(6.62, 11.54, 0.26, 1.0, 'glass'); b.box(7.78, 11.54, 0.26, 1.0, 'glass'); b.box(7.2, 10.54, 1.5, 0.26, 'glass');
      b.box(8.85, 13, 0.36, 1.0, 'stone'); b.t(7.2, 13); b.t(7.2, 11.54); b.t(7.2, 10.28); b.t(9.45, 13); } },
  { balls: 3, build(b) { b.box(6.2, 13, 0.8, 0.8, 'wood'); b.box(7.1, 13, 0.8, 0.8, 'wood'); b.box(8.0, 13, 0.8, 0.8, 'wood');
      b.box(6.65, 12.2, 0.7, 0.7, 'wood'); b.box(7.55, 12.2, 0.7, 0.7, 'wood'); b.box(7.1, 11.5, 0.6, 0.6, 'glass');
      b.t(7.1, 10.9); b.t(9.2, 13); b.t(5.3, 13); } },
  { balls: 4, build(b) { b.box(5.5, 13, 0.3, 1.6, 'stone'); b.box(6.5, 13, 0.3, 1.6, 'stone'); b.box(8.3, 13, 0.3, 1.6, 'stone'); b.box(9.3, 13, 0.3, 1.6, 'stone');
      b.box(7.4, 11.4, 4.2, 0.26, 'wood'); b.t(6.0, 13); b.t(8.8, 13); b.t(7.4, 13); b.t(7.4, 11.14); } },
  { balls: 4, build(b) { b.box(5.8, 13, 0.4, 1.0, 'stone'); b.box(6.6, 13, 0.3, 1.4, 'wood'); b.box(8.0, 13, 0.3, 1.4, 'wood'); b.box(9.4, 13, 0.3, 1.4, 'wood');
      b.box(8.0, 11.6, 3.2, 0.26, 'wood'); b.box(7.0, 11.34, 0.26, 1.0, 'glass'); b.box(8.9, 11.34, 0.26, 1.0, 'glass'); b.box(7.95, 10.34, 2.3, 0.26, 'glass');
      b.t(7.3, 13); b.t(8.7, 13); b.t(8.0, 11.34); b.t(7.95, 10.08); } }
];

class SlingshotGame {
  constructor(canvas, cellSize) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.cellSize = cellSize;
    this.score = 0; this.gameOver = false; this.level = 1; this.cleared = 0; this.shots = 0; this.targetsHit = 0;
    this.lastTime = 0; this.now = 0; this.acc = 0; this.time = 0;
    this.bodies = []; this.parts = []; this.pops = []; this.trail = []; this.lastTrail = [];
    this.aimAng = 45; this.aimPow = 70; this.drag = null; this.kbAim = 0; this.softDropping = false;
    this.intro = 200; this.banner = null; this.bg = null; this.bgKey = '';
    this.loadStage(1);
  }

  // ── 단계 만들기 ──
  loadStage(n) {
    this.level = n; this.bodies = []; this.ball = null; this.trail = []; this.lastTrail = [];
    const self = this, b = {
      box(cx, base, w, h, mat) { self.addBox(cx, base - h / 2, w, h, mat); return base - h; },
      t(cx, base) { self.addTarget(cx, base - 0.32); }
    };
    let def = SL_STAGES[n - 1];
    if (!def) def = this.randomStage(n);
    def.build(b);
    this.ballsLeft = def.balls; this.ballsTotal = def.balls;
    this.queue = []; for (let i = 0; i < def.balls; i++) this.queue.push(i % 2 === 0 ? 'stone' : 'water');
    this.state = 'aim'; this.stateT = 0;
  }
  // 9단계부터: 틀(기둥+판자, 1~2층) · 상자 더미 · 탑을 2~3개 무작위로 나란히
  randomStage(n) {
    const R = Math.random, pick = a => a[Math.floor(R() * a.length)];
    const mats = n < 12 ? ['wood', 'wood', 'glass', 'stone'] : ['wood', 'glass', 'stone', 'stone'];
    const mods = [];
    let x = 4.9 + R() * 0.4; const xEnd = 9.8;
    while (mods.length < 3) {
      const kind = pick(['frame', 'frame', 'crates', 'tower']);
      const w = kind === 'frame' ? 1.7 + R() * 0.8 : kind === 'crates' ? 1.8 : 0.9;
      if (x + w > xEnd) break;
      mods.push({ kind, x0: x, w, m1: pick(mats), m2: pick(mats), two: R() < 0.5 + n * 0.02 });
      x += w + 0.25 + R() * 0.4;
    }
    let tg = 0; mods.forEach(m => { tg += m.kind === 'frame' ? 2 : m.kind === 'crates' ? 1 : 1; });
    return { balls: Math.max(3, Math.min(4, Math.ceil(tg * 0.5) + 1)), build(b) {
      mods.forEach(m => {
        const cx = m.x0 + m.w / 2;
        if (m.kind === 'frame') {
          const h = 1.0 + R() * 0.5, L = m.x0 + 0.15, Rr = m.x0 + m.w - 0.15;
          b.box(L, 13, 0.3, h, m.m1); b.box(Rr, 13, 0.3, h, m.m1); const top = b.box(cx, 13 - h, m.w, 0.26, m.m2 === 'stone' ? 'wood' : m.m2);
          b.t(cx, 13);
          if (m.two && m.w > 1.95) {
            const h2 = 0.8 + R() * 0.3, w2 = m.w - 0.6;
            b.box(cx - w2 / 2 + 0.15, top, 0.26, h2, m.m2); b.box(cx + w2 / 2 - 0.15, top, 0.26, h2, m.m2);
            b.box(cx, top - h2, w2 + 0.2, 0.26, 'glass'); b.t(cx, top);
          } else if (m.two) b.t(cx, b.box(cx, top, 0.6, 0.6, 'glass'));
          else b.t(cx, top);
        } else if (m.kind === 'crates') {
          b.box(m.x0 + 0.45, 13, 0.8, 0.8, m.m1); b.box(m.x0 + 1.35, 13, 0.8, 0.8, m.m1);
          const top = b.box(cx, 12.2, 0.7, 0.7, m.m2); b.t(cx, top);
        } else {
          let base = 13, wd = 0.8; const k = 2 + Math.floor(R() * 2);
          for (let i = 0; i < k; i++) { base = b.box(cx, base, wd, 0.6, i === k - 1 ? 'glass' : m.m1); wd -= 0.08; }
          b.t(cx, base);
        }
      });
    } };
  }

  // ── 물체 만들기 ──
  pt(x, y) { return { x, y, ox: x, oy: y }; }
  addBox(cx, cy, w, h, mat) {
    const M = SL_MAT[mat], m = Math.max(0.2, M.d * w * h * 1.6), hw = w / 2, hh = h / 2;
    const pts = [this.pt(cx - hw, cy - hh), this.pt(cx + hw, cy - hh), this.pt(cx + hw, cy + hh), this.pt(cx - hw, cy + hh)];
    const cons = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3]].map(([i, j]) => [i, j, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)]);
    const body = { kind: 'box', mat, pts, cons, w, h, m, im: 4 / m, hp: M.hp, dmg: 0, sleep: true, still: 0, alive: true, mu: M.mu, x0: 0, y0: 0, x1: 0, y1: 0, seed: Math.random() };
    this.bb(body); this.bodies.push(body); return body;
  }
  addTarget(cx, cy) {
    const body = { kind: 'target', pts: [this.pt(cx, cy)], r: 0.32, m: 0.5, im: 2, hp: 2.2, dmg: 0, sleep: true, still: 0, alive: true, mu: 0.5, e: 0.1, wob: Math.random() * 6 };
    this.bb(body); this.bodies.push(body); return body;
  }
  addBall(type, x, y, vx, vy) {
    const B = SL_BALLS[type], p = this.pt(x, y); p.ox = x - vx; p.oy = y - vy;
    const body = { kind: 'ball', type, pts: [p], r: B.r, m: B.m, im: 1 / B.m, hp: 1e9, dmg: 0, sleep: false, still: 0, alive: true, mu: 0.3, e: B.e, rot: 0 };
    this.bb(body); this.bodies.push(body); return body;
  }
  bb(b) {
    if (b.kind === 'box') { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of b.pts) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; } b.x0 = x0; b.y0 = y0; b.x1 = x1; b.y1 = y1; }
    else { const p = b.pts[0]; b.x0 = p.x - b.r; b.x1 = p.x + b.r; b.y0 = p.y - b.r; b.y1 = p.y + b.r; }
  }
  wake(b) { if (b.sleep && b.alive) { b.sleep = false; b.still = 0; } }
  // 둘레 근처의 잠든 물체 깨우기 (받침이 사라졌을 때)
  wakeNear(b, pad) { for (const o of this.bodies) if (o !== b && o.sleep && o.alive && o.x0 < b.x1 + pad && o.x1 > b.x0 - pad && o.y0 < b.y1 + pad && o.y1 > b.y0 - pad) this.wake(o); }

  // ── 물리 한 걸음 ──
  step() {
    const bodies = this.bodies;
    for (const b of bodies) {
      if (!b.alive || b.sleep) continue;
      for (const p of b.pts) {
        let vx = (p.x - p.ox) * SL_DAMP, vy = (p.y - p.oy) * SL_DAMP;
        const s = Math.abs(vx) + Math.abs(vy); if (s > 0.45) { vx *= 0.45 / s; vy *= 0.45 / s; }
        p.ox = p.x; p.oy = p.y; p.x += vx; p.y += vy + SL_G;
      }
      this.bb(b);
    }
    for (let it = 0; it < SL_ITER; it++) {
      const first = it === 0;
      for (const b of bodies) if (b.alive && !b.sleep && b.kind === 'box') this.solveBox(b);
      for (const b of bodies) if (b.alive && !b.sleep) this.walls(b, first);
      for (let i = 0; i < bodies.length; i++) {
        const A = bodies[i]; if (!A.alive) continue;
        for (let j = i + 1; j < bodies.length; j++) {
          const B = bodies[j]; if (!B.alive || (A.sleep && B.sleep)) continue;
          if (A.x0 > B.x1 + 0.05 || A.x1 < B.x0 - 0.05 || A.y0 > B.y1 + 0.05 || A.y1 < B.y0 - 0.05) continue;
          this.collide(A, B, first);
        }
      }
      if (it === SL_ITER - 1 || it === 2) for (const b of bodies) if (b.alive && !b.sleep) this.bb(b);
    }
    // 부서짐 · 잠자기 · 깨우기
    for (const b of bodies) {
      if (!b.alive) continue;
      if (b.dmg >= b.hp) { this.destroy(b); continue; }
      if (b.sleep) continue;
      let mv = 0; for (const p of b.pts) mv = Math.max(mv, Math.abs(p.x - p.ox) + Math.abs(p.y - p.oy));
      if (mv > 0.004) this.wakeNear(b, 0.04);
      if (mv < SL_SLEEP_V) { if (++b.still > SL_SLEEP_N) { b.sleep = true; for (const p of b.pts) { p.ox = p.x; p.oy = p.y; } } }
      else b.still = 0;
      if (b.kind === 'ball') b.rot += (b.pts[0].x - b.pts[0].ox) / b.r;
      if (b.y0 > SL_ROWS + 2) b.alive = false;
    }
    if (bodies.some(b => !b.alive)) this.bodies = bodies.filter(b => b.alive);
  }
  solveBox(b) {
    const P = b.pts;
    for (const c of b.cons) {
      const a = P[c[0]], q = P[c[1]], dx = q.x - a.x, dy = q.y - a.y, d = Math.hypot(dx, dy) || 1e-6, k = (d - c[2]) / d * 0.5;
      a.x += dx * k; a.y += dy * k; q.x -= dx * k; q.y -= dy * k;
    }
  }
  // 땅 · 왼쪽/오른쪽 벽
  walls(b, first) {
    const r = b.r || 0, mu = b.kind === 'box' ? 0.6 : b.kind === 'ball' ? 0.08 : 0.25;
    for (const p of b.pts) {
      if (p.y + r > SL_GROUND) {
        const vy = p.y - p.oy, vx = p.x - p.ox;
        if (first) this.hurt(b, vy, 99);
        p.y = SL_GROUND - r; p.ox = p.x - vx * (1 - mu);
        if (b.e && first && vy > 0.03) p.oy = p.y + vy * b.e;
      }
      if (p.x - r < 0) { const vx = p.x - p.ox; p.x = r; if (b.e && first) p.ox = p.x + vx * b.e; }
      if (p.x + r > SL_COLS) { const vx = p.x - p.ox; p.x = SL_COLS - r; if (first) { this.hurt(b, vx, 99); if (b.e) p.ox = p.x + vx * b.e; } }
    }
  }
  // 부딪힘 세기 vn 만큼 피해 (상대가 무거울수록 크게)
  hurt(b, vn, mOther) {
    if (vn <= SL_HIT_T || b.kind === 'ball') return;
    b.dmg += (vn - SL_HIT_T) * 100 * 2 * mOther / (mOther + b.m);
    if (vn > 0.05 && window.Sound && this.time - (this.lastBump || 0) > 6) { this.lastBump = this.time; Sound.bump(); }
  }
  collide(A, B, first) {
    if (A.kind !== 'box' && B.kind !== 'box') return this.circleCircle(A, B, first);
    if (A.kind !== 'box') return this.circleBox(A, B, first);
    if (B.kind !== 'box') return this.circleBox(B, A, first);
    this.boxBox(A, B, first); this.boxBox(B, A, first);
  }
  // 점 p(몸 P) 를 모서리 a-b(몸 E, 비율 t) 밖으로 n 방향으로 depth 만큼 밀기 + 마찰 · 튕김 · 피해 · 깨우기
  resolve(P, p, E, a, b, t, nx, ny, depth, first) {
    if (first) {
      const vpx = p.x - p.ox, vpy = p.y - p.oy, vex = (a.x - a.ox) * (1 - t) + (b.x - b.ox) * t, vey = (a.y - a.oy) * (1 - t) + (b.y - b.oy) * t;
      const vn = -((vpx - vex) * nx + (vpy - vey) * ny);
      if (P.sleep && !E.sleep && (vn > 0.004 || depth > 0.012)) this.wake(P);
      if (E.sleep && !P.sleep && (vn > 0.004 || depth > 0.012)) this.wake(E);
      if (vn > SL_HIT_T) { this.hurt(P, vn, E.m); this.hurt(E, vn, P.m); if (P.kind === 'ball' || E.kind === 'ball') this.hitFx(p.x, p.y, vn); }
      P._vn = vn;
    }
    const wp = P.sleep ? 0 : P.im, we = E.sleep ? 0 : E.im, ca = 1 - t, cb = t;
    const den = wp + (a === b ? we : (ca * ca + cb * cb) * we); if (den <= 0) return;
    const lam = depth / den;
    const vpx = p.x - p.ox, vpy = p.y - p.oy;
    p.x += nx * lam * wp; p.y += ny * lam * wp;
    if (a === b) { a.x -= nx * lam * we; a.y -= ny * lam * we; }
    else { a.x -= nx * lam * ca * we; a.y -= ny * lam * ca * we; b.x -= nx * lam * cb * we; b.y -= ny * lam * cb * we; }
    // 마찰: 접선 방향 상대 속도 줄이기
    const tx = -ny, ty = nx, mu = Math.min(P.mu, E.mu);
    const vex = a === b ? a.x - a.ox : (a.x - a.ox) * ca + (b.x - b.ox) * cb, vey = a === b ? a.y - a.oy : (a.y - a.oy) * ca + (b.y - b.oy) * cb;
    const vt = (vpx - vex) * tx + (vpy - vey) * ty, lt = vt * mu / den;
    p.ox += tx * lt * wp; p.oy += ty * lt * wp;
    if (a === b) { a.ox -= tx * lt * we; a.oy -= ty * lt * we; }
    else { a.ox -= tx * lt * ca * we; a.oy -= ty * lt * ca * we; b.ox -= tx * lt * cb * we; b.oy -= ty * lt * cb * we; }
    // 튕김 (공·봉투만)
    if (first && P.e && P._vn > 0.03 && wp > 0) { const vnn = (p.x - p.ox) * nx + (p.y - p.oy) * ny, want = P._vn * P.e; p.ox -= nx * (want - vnn); p.oy -= ny * (want - vnn); }
  }
  circleCircle(A, B, first) {
    const a = A.pts[0], b = B.pts[0], dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy), ov = A.r + B.r - d;
    if (ov <= 0 || d < 1e-6) return;
    this.resolve(A, a, B, b, b, 0, dx / d, dy / d, ov, first);
  }
  circleBox(C, X, first) {
    const c = C.pts[0], P = X.pts, r = C.r;
    let inside = true, bestS = -1e9, bi = 0, bestD = 1e9, qx = 0, qy = 0, qt = 0, qi = 0;
    for (let i = 0; i < 4; i++) {
      const a = P[i], b = P[(i + 1) & 3], ex = b.x - a.x, ey = b.y - a.y, L = Math.hypot(ex, ey) || 1e-6, nx = ey / L, ny = -ex / L;
      const s = (c.x - a.x) * nx + (c.y - a.y) * ny;
      if (s >= 0) inside = false;
      if (s > bestS) { bestS = s; bi = i; }
      let t = ((c.x - a.x) * ex + (c.y - a.y) * ey) / (L * L); t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = a.x + ex * t, py = a.y + ey * t, d = Math.hypot(c.x - px, c.y - py);
      if (d < bestD) { bestD = d; qx = px; qy = py; qt = t; qi = i; }
    }
    if (inside) {
      const a = P[bi], b = P[(bi + 1) & 3], ex = b.x - a.x, ey = b.y - a.y, L = Math.hypot(ex, ey) || 1e-6;
      let t = ((c.x - a.x) * ex + (c.y - a.y) * ey) / (L * L); t = t < 0 ? 0 : t > 1 ? 1 : t;
      this.resolve(C, c, X, a, b, t, ey / L, -ex / L, r - bestS, first);
    } else if (bestD < r && bestD > 1e-6) {
      this.resolve(C, c, X, P[qi], P[(qi + 1) & 3], qt, (c.x - qx) / bestD, (c.y - qy) / bestD, r - bestD, first);
    }
  }
  // 상자 A 의 꼭짓점이 상자 B 안에 들어가 있으면 가장 얕은 모서리 밖으로
  boxBox(A, B, first) {
    const Q = B.pts;
    for (const p of A.pts) {
      if (p.x < B.x0 || p.x > B.x1 || p.y < B.y0 || p.y > B.y1) continue;
      let best = -1e9, bi = -1, out = false;
      for (let i = 0; i < 4; i++) {
        const a = Q[i], b = Q[(i + 1) & 3], ex = b.x - a.x, ey = b.y - a.y, L = Math.hypot(ex, ey) || 1e-6;
        const s = ((p.x - a.x) * ey - (p.y - a.y) * ex) / L;
        if (s >= 0) { out = true; break; }
        if (s > best) { best = s; bi = i; }
      }
      if (out) continue;
      const a = Q[bi], b = Q[(bi + 1) & 3], ex = b.x - a.x, ey = b.y - a.y, L = Math.hypot(ex, ey) || 1e-6;
      let t = ((p.x - a.x) * ex + (p.y - a.y) * ey) / (L * L); t = t < 0 ? 0 : t > 1 ? 1 : t;
      this.resolve(A, p, B, a, b, t, ey / L, -ex / L, -best, first);
    }
  }

  // ── 부서짐 · 효과 ──
  center(b) { let x = 0, y = 0; for (const p of b.pts) { x += p.x; y += p.y; } return { x: x / b.pts.length, y: y / b.pts.length }; }
  destroy(b) {
    b.alive = false; const c = this.center(b);
    this.wakeNear(b, 0.1);
    if (b.kind === 'target') {
      this.score += 500; this.targetsHit++;
      this.pops.push({ x: c.x, y: c.y - 0.3, t: 1, txt: '수거! +500', col: '#7CFFB2' });
      this.burst(c.x, c.y, 18, ['#2FBF71', '#1E7A4A', '#E9F5EC', '#FFD166'], 0.1);
      if (window.Sound) Sound.gem();
    } else {
      const M = SL_MAT[b.mat]; this.score += M.pts;
      this.pops.push({ x: c.x, y: c.y, t: 0.8, txt: '+' + M.pts, col: '#FFE38A' });
      this.burst(c.x, c.y, b.mat === 'glass' ? 16 : 12, [M.c1, M.c2, FX.tint(M.c1, 0.3)], 0.08);
      if (window.Sound) { if (b.mat === 'glass') Sound.note(1700 + Math.random() * 500, 0.12, 'triangle', 0.18); else Sound.hitmark(); }
    }
  }
  burst(x, y, n, cols, sp) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = sp * (0.3 + Math.random());
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.05, g: 0.012, l: 1, c: cols[i % cols.length], s: 0.08 + Math.random() * 0.1, r: Math.random() * 6 }); }
  }
  hitFx(x, y, vn) { if (this.parts.length < 200) this.burst(x, y, 3 + Math.min(6, vn * 60 | 0), ['#FFFFFF', '#FFE9A8'], 0.05); }

  // ── 조준 ──
  aimVec() { const a = this.aimAng * Math.PI / 180, v = this.aimPow / 100 * SL_VMAX; return { vx: Math.cos(a) * v, vy: -Math.sin(a) * v }; }
  pouch() { const a = this.aimAng * Math.PI / 180, k = this.aimPow / 100 * SL_PULL; return { x: SL_SLING.x - Math.cos(a) * k, y: SL_SLING.y + Math.sin(a) * k }; }
  canAim() { return !this.gameOver && this.state === 'aim'; }
  pointer(type, x, y) {
    if (!this.canAim()) { if (type === 'up') this.drag = null; return; }
    if (type === 'down') {
      if (Math.hypot(x - SL_SLING.x, y - SL_SLING.y) < 2.6 || (x < 4 && y > 7)) { this.drag = { x, y }; this.intro = Math.min(this.intro, 30); if (window.Sound) Sound.move(); }
      return;
    }
    if (!this.drag) return;
    this.drag.x = x; this.drag.y = y;
    const dx = SL_SLING.x - x, dy = SL_SLING.y - y, len = Math.hypot(dx, dy);
    let ang = Math.atan2(-dy, dx) * 180 / Math.PI; ang = Math.max(-30, Math.min(90, ang));
    const pow = Math.min(100, len / SL_PULL * 100);
    if (type === 'move') { const old = Math.round(this.aimPow / 10); this.aimAng = ang; this.aimPow = pow; if (Math.round(pow / 10) !== old && window.Sound) Sound.note(300 + pow * 6, 0.03, 'sine', 0.08); }
    if (type === 'up') { this.drag = null; if (pow >= 12) { this.aimAng = ang; this.aimPow = pow; this.fire(); } }
  }
  // 키보드: ←/→ 각도 · ↑/↓ 세기 · 스페이스 발사 (↓ 는 누르는 동안 softDropping)
  move(dir) { if (!this.canAim()) return; this.aimAng = Math.max(-30, Math.min(90, Math.round(this.aimAng) + dir)); this.kbAim = 180; }
  up() { if (!this.canAim()) return; this.aimPow = Math.min(100, Math.round(this.aimPow) + 2); this.kbAim = 180; }
  down() { if (!this.canAim()) return; this.aimPow = Math.max(10, Math.round(this.aimPow) - 2); this.kbAim = 180; }
  softDrop() { this.down(); }
  hardDrop() { if (this.canAim()) this.fire(); }
  rotate() {}
  fire() {
    if (this.ballsLeft <= 0) return;
    const type = this.queue[this.ballsTotal - this.ballsLeft] || 'stone', p = this.pouch(), v = this.aimVec();
    this.ballsLeft--; this.shots++;
    this.ball = this.addBall(type, p.x, p.y, v.vx, v.vy);
    this.lastTrail = this.trail; this.trail = [];
    this.state = 'fly'; this.stateT = 0; this.kbAim = 0; this.intro = 0; this.snapBack = 1;
    if (window.Sound) Sound.jump();
  }
  // 예상 궤적: 실제 물리와 같은 식으로 계산 (부딪힘 없이)
  predict(out) {
    const p = this.pouch(), v = this.aimVec(); let x = p.x, y = p.y, ox = x - v.vx, oy = y - v.vy, n = 0;
    for (let i = 1; i < 600 && n < 60; i++) {
      const vx = (x - ox) * SL_DAMP, vy = (y - oy) * SL_DAMP; ox = x; oy = y; x += vx; y += vy + SL_G;
      if (i % 7 === 0) out[n++] = [x, y];
      if (y > SL_GROUND || x > SL_COLS || x < 0) break;
    }
    out.length = n; return out;
  }
  targetsLeft() { let n = 0; for (const b of this.bodies) if (b.alive && b.kind === 'target') n++; return n; }
  allAsleep() { for (const b of this.bodies) if (b.alive && !b.sleep && b.kind !== 'ball') return false; return true; }

  // ── 진행 ──
  tick(now) {
    const { f } = FX.frame(this, now);
    this.time += f;
    if (this.intro > 0) this.intro -= f;
    if (this.kbAim > 0) this.kbAim -= f;
    if (this.softDropping && this.canAim()) { this.aimPow = Math.max(10, this.aimPow - 0.8 * f); this.kbAim = 180; }
    if (this.snapBack > 0) this.snapBack = Math.max(0, this.snapBack - 0.12 * f);
    // 고정 간격(1/120초) 물리
    this.acc += f * 2; let n = Math.min(6, Math.floor(this.acc)); this.acc -= n; if (this.acc > 2) this.acc = 0;
    while (n-- > 0) {
      this.step(); this.stateT += 0.5;
      if (this.ball && this.ball.alive && this.state === 'fly' && ((this.stateT * 2) | 0) % 4 === 0) { const p = this.ball.pts[0]; this.trail.push([p.x, p.y]); if (this.trail.length > 160) this.trail.shift(); }
    }
    this.flow();
    this.parts = FX.stepParts(this.parts, f, 0.025);
    this.pops = this.pops.filter(e => (e.t -= 0.016 * f) > 0);
    if (this.banner) { this.banner.t -= 0.012 * f; if (this.banner.t <= 0) this.banner = null; }
    this.draw();
  }
  flow() {
    if (this.gameOver) return;
    const left = this.targetsLeft();
    if (this.state === 'fly') {
      const b = this.ball, p = b && b.pts[0];
      const done = !b || !b.alive || b.sleep || p.x < -1 || p.y > SL_ROWS + 1 || this.stateT > 420 || (this.stateT > 120 && left === 0);
      if (done) { if (b && b.alive) { b.alive = false; const c = b.pts[0]; this.burst(c.x, c.y, 8, ['#ffffff', SL_BALLS[b.type].c1], 0.05); this.bodies = this.bodies.filter(o => o.alive); } this.ball = null; this.state = 'settle'; this.stateT = 0; }
    } else if (this.state === 'settle') {
      if ((this.stateT > 30 && this.allAsleep()) || this.stateT > 200 || (left === 0 && this.stateT > 50)) {
        if (left === 0) {
          const bonus = this.ballsLeft * 1000; this.score += bonus; this.cleared++;
          this.banner = { t: 1, txt: '단계 ' + this.level + ' 깨끗!', sub: bonus ? '남은 공 ' + this.ballsLeft + '개 × 1000 = +' + bonus : '다음 단계로!' };
          this.state = 'clear'; this.stateT = 0; if (window.Sound) Sound.levelUp();
        } else if (this.ballsLeft > 0) { this.state = 'aim'; this.stateT = 0; }
        else { this.gameOver = true; this.state = 'over'; if (window.Sound) Sound.gameOver(); }
      }
    } else if (this.state === 'clear') {
      if (this.stateT > 110) this.loadStage(this.level + 1);
    }
  }

  // ── 교사 미니보드 ──
  getSnapshot() {
    const out = []; for (let y = 0; y < SL_ROWS; y++) out.push(new Array(SL_COLS).fill(0));
    const put = (x, y, v) => { const cx = Math.floor(x), cy = Math.floor(y); if (cx >= 0 && cy >= 0 && cx < SL_COLS && cy < SL_ROWS) out[cy][cx] = v; };
    for (let x = 0; x < SL_COLS; x++) out[SL_ROWS - 1][x] = 42;
    put(SL_SLING.x, 11.5, 57); put(SL_SLING.x, 12.5, 57);
    for (const b of this.bodies) {
      if (!b.alive) continue;
      if (b.kind === 'box') { const P = b.pts, v = SL_MAT[b.mat].snap;
        for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) { const u = 0.1 + i * 0.2, w = 0.1 + j * 0.2;
          put(P[0].x + (P[1].x - P[0].x) * u + (P[3].x - P[0].x) * w, P[0].y + (P[1].y - P[0].y) * u + (P[3].y - P[0].y) * w, v); } }
    }
    for (const b of this.bodies) if (b.alive && b.kind !== 'box') put(b.pts[0].x, b.pts[0].y, b.kind === 'target' ? 13 : 22);
    return out;
  }

  // ── 그리기 ──
  drawBg(ctx, W, H, cs) {
    const tr = ctx.getTransform ? ctx.getTransform().a || 1 : 1, key = W + 'x' + H + '@' + tr;
    if (this.bgKey !== key) {
      this.bgKey = key; const c = document.createElement('canvas'); c.width = Math.ceil(W * tr); c.height = Math.ceil(H * tr);
      const g = c.getContext('2d'); g.scale(tr, tr);
      const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#5AB6F0'); sky.addColorStop(0.65, '#BFE8FF'); sky.addColorStop(1, '#E8F7FF');
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      // 해
      const sun = g.createRadialGradient(W * 0.82, cs * 2.6, 0, W * 0.82, cs * 2.6, cs * 1.6); sun.addColorStop(0, 'rgba(255,248,200,1)'); sun.addColorStop(0.35, 'rgba(255,236,150,0.9)'); sun.addColorStop(1, 'rgba(255,236,150,0)');
      g.fillStyle = sun; g.fillRect(0, 0, W, cs * 5);
      // 구름
      g.fillStyle = 'rgba(255,255,255,0.85)';
      [[1.6, 3.2, 1], [5.2, 2.2, 0.8], [7.6, 4.6, 0.65]].forEach(([x, y, k]) => { [[0, 0, 0.5], [0.55, -0.25, 0.6], [1.2, 0, 0.45]].forEach(([dx, dy, r]) => { g.beginPath(); g.arc((x + dx * k) * cs, (y + dy * k) * cs, cs * r * k, 0, 7); g.fill(); });
        g.beginPath(); g.ellipse((x + 0.6 * k) * cs, (y + 0.22 * k) * cs, cs * 1.0 * k, cs * 0.28 * k, 0, 0, 7); g.fill(); });
      // 먼 언덕 · 나무
      g.fillStyle = '#9BD7A8'; g.beginPath(); g.moveTo(0, cs * 11.2);
      for (let x = 0; x <= SL_COLS; x += 0.5) g.lineTo(x * cs, (11.1 - Math.sin(x * 0.7) * 0.6 - Math.sin(x * 1.9) * 0.15) * cs);
      g.lineTo(W, cs * SL_GROUND); g.lineTo(0, cs * SL_GROUND); g.fill();
      g.fillStyle = '#74C08A'; g.beginPath(); g.moveTo(0, cs * 12.2);
      for (let x = 0; x <= SL_COLS; x += 0.5) g.lineTo(x * cs, (12.1 - Math.sin(x * 0.9 + 2) * 0.35) * cs);
      g.lineTo(W, cs * SL_GROUND); g.lineTo(0, cs * SL_GROUND); g.fill();
      [[3.3, 11.6], [4.4, 11.9], [9.3, 11.0]].forEach(([x, y]) => { g.fillStyle = '#7B5A3A'; g.fillRect((x - 0.05) * cs, y * cs, 0.1 * cs, 0.6 * cs); g.fillStyle = '#4FA56A'; g.beginPath(); g.arc(x * cs, y * cs, 0.32 * cs, 0, 7); g.fill(); });
      // 땅: 풀 + 흙
      const gr = g.createLinearGradient(0, SL_GROUND * cs, 0, H); gr.addColorStop(0, '#5DBB4F'); gr.addColorStop(0.18, '#3E9B3A'); gr.addColorStop(0.2, '#8A5E3B'); gr.addColorStop(1, '#5E3D24');
      g.fillStyle = gr; g.fillRect(0, SL_GROUND * cs, W, H - SL_GROUND * cs);
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, SL_GROUND * cs, W, Math.max(1, cs * 0.04));
      g.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 18; i++) { g.beginPath(); g.arc(((i * 0.57) % 1 * 10 + i * 0.13) % 10 * cs, (SL_GROUND + 0.4 + (i * 0.37 % 0.5)) * cs, cs * 0.05, 0, 7); g.fill(); }
      this.bg = c;
    }
    ctx.drawImage(this.bg, 0, 0, W, H);
  }
  drawSlingBack(ctx, cs) {
    const x = SL_SLING.x * cs, gy = SL_GROUND * cs, fy = (SL_SLING.y - 0.1) * cs;
    ctx.lineCap = 'round'; ctx.strokeStyle = '#5A3518'; ctx.lineWidth = cs * 0.26;
    ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, fy + cs * 0.9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, fy + cs * 0.95); ctx.lineTo(x + cs * 0.32, fy); ctx.stroke();   // 뒤 가지
    ctx.strokeStyle = '#9A6334'; ctx.lineWidth = cs * 0.14;
    ctx.beginPath(); ctx.moveTo(x - cs * 0.03, gy); ctx.lineTo(x - cs * 0.03, fy + cs * 0.9); ctx.stroke();
  }
  drawSlingFront(ctx, cs) {
    const x = SL_SLING.x * cs, fy = (SL_SLING.y - 0.1) * cs;
    ctx.lineCap = 'round'; ctx.strokeStyle = '#6B4020'; ctx.lineWidth = cs * 0.26;
    ctx.beginPath(); ctx.moveTo(x, fy + cs * 0.95); ctx.lineTo(x - cs * 0.32, fy); ctx.stroke();
    ctx.strokeStyle = '#B07840'; ctx.lineWidth = cs * 0.1; ctx.beginPath(); ctx.moveTo(x - cs * 0.04, fy + cs * 0.85); ctx.lineTo(x - cs * 0.33, fy + cs * 0.05); ctx.stroke();
  }
  drawBand(ctx, cs, px, py, back) {
    const x = SL_SLING.x * cs, fy = (SL_SLING.y - 0.1) * cs;
    ctx.strokeStyle = back ? '#7A2E1E' : '#B5412A'; ctx.lineWidth = cs * 0.09; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + (back ? 0.32 : -0.32) * cs, fy); ctx.lineTo(px * cs, py * cs); ctx.stroke();
  }
  drawBall(ctx, cs, type, x, y, r, rot) {
    const B = SL_BALLS[type], X = x * cs, Y = y * cs, R = r * cs;
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(X + R * 0.15, Y + R * 0.2, R, R, 0, 0, 7); ctx.fill();
    const g = ctx.createRadialGradient(X - R * 0.35, Y - R * 0.4, R * 0.1, X, Y, R); g.addColorStop(0, FX.tint(B.c1, 0.4)); g.addColorStop(0.6, B.c1); g.addColorStop(1, B.c2);
    ctx.fillStyle = g; ctx.beginPath();
    if (type === 'water') { ctx.arc(X, Y, R, 0, 7); }
    else { for (let i = 0; i < 9; i++) { const a = rot + i / 9 * Math.PI * 2, k = R * (0.9 + 0.1 * Math.sin(i * 2.7)); i ? ctx.lineTo(X + Math.cos(a) * k, Y + Math.sin(a) * k) : ctx.moveTo(X + Math.cos(a) * k, Y + Math.sin(a) * k); } ctx.closePath(); }
    ctx.fill(); ctx.strokeStyle = FX.tint(B.c2, -0.35); ctx.lineWidth = Math.max(1, cs * 0.035); ctx.stroke();
    if (type === 'stone') { ctx.fillStyle = 'rgba(60,66,80,0.45)'; for (let i = 0; i < 3; i++) { const a = rot + i * 2.1; ctx.beginPath(); ctx.arc(X + Math.cos(a) * R * 0.45, Y + Math.sin(a) * R * 0.45, R * 0.12, 0, 7); ctx.fill(); } }
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.ellipse(X - R * 0.35, Y - R * 0.38, R * 0.22, R * 0.14, -0.6, 0, 7); ctx.fill();
  }
  drawBox(ctx, cs, b) {
    const P = b.pts, M = SL_MAT[b.mat];
    const cx = (P[0].x + P[2].x) / 2 * cs, cy = (P[0].y + P[2].y) / 2 * cs, ang = Math.atan2(P[1].y - P[0].y, P[1].x - P[0].x);
    const w = b.w * cs, h = b.h * cs, r = Math.min(w, h) * 0.18;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, M.c1); g.addColorStop(1, M.c2);
    ctx.globalAlpha = b.mat === 'glass' ? 0.78 : 1;
    ctx.fillStyle = g; FX.rr(ctx, -w / 2, -h / 2, w, h, r); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = FX.tint(M.c2, -0.45); ctx.lineWidth = Math.max(1, cs * 0.04); ctx.stroke();
    if (b.mat === 'wood') {   // 나뭇결 · 못
      ctx.strokeStyle = 'rgba(110,60,20,0.35)'; ctx.lineWidth = Math.max(1, cs * 0.025); ctx.beginPath();
      if (w >= h) { for (let i = 1; i < 3; i++) { const yy = -h / 2 + h * i / 3; ctx.moveTo(-w / 2 + r, yy); ctx.lineTo(w / 2 - r, yy); } }
      else { for (let i = 1; i < 3; i++) { const xx = -w / 2 + w * i / 3; ctx.moveTo(xx, -h / 2 + r); ctx.lineTo(xx, h / 2 - r); } }
      ctx.stroke();
      if (w > cs * 0.5 && h > cs * 0.5) { ctx.strokeStyle = 'rgba(110,60,20,0.45)'; ctx.lineWidth = Math.max(1, cs * 0.05); ctx.beginPath(); ctx.moveTo(-w / 2 + r, -h / 2 + r); ctx.lineTo(w / 2 - r, h / 2 - r); ctx.stroke(); }
    } else if (b.mat === 'stone') {
      ctx.fillStyle = 'rgba(70,78,92,0.35)';
      for (let i = 0; i < 4; i++) { const u = ((b.seed * 7 + i * 0.37) % 1) - 0.5, v = ((b.seed * 13 + i * 0.61) % 1) - 0.5; ctx.beginPath(); ctx.arc(u * w * 0.8, v * h * 0.8, Math.min(w, h) * 0.1, 0, 7); ctx.fill(); }
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = Math.max(1, cs * 0.04); ctx.beginPath();
      ctx.moveTo(-w / 2 + w * 0.2, h / 2 - h * 0.15); ctx.lineTo(-w / 2 + w * 0.15 + Math.min(w, h) * 0.5, -h / 2 + h * 0.15); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; FX.rr(ctx, -w / 2 + cs * 0.04, -h / 2 + cs * 0.03, w - cs * 0.08, Math.min(h * 0.3, cs * 0.12), r * 0.5); ctx.fill();
    // 금 (피해가 쌓이면)
    const k = b.dmg / b.hp;
    if (k > 0.3) { ctx.strokeStyle = 'rgba(30,20,10,' + Math.min(0.8, k).toFixed(2) + ')'; ctx.lineWidth = Math.max(1, cs * 0.03); ctx.beginPath();
      ctx.moveTo(-w * 0.1, -h / 2); ctx.lineTo(w * 0.05, -h * 0.1); ctx.lineTo(-w * 0.12, h * 0.15); if (k > 0.6) { ctx.moveTo(w * 0.05, -h * 0.1); ctx.lineTo(w * 0.3, h * 0.05); ctx.lineTo(w * 0.25, h / 2); } ctx.stroke(); }
    ctx.restore();
  }
  drawTarget(ctx, cs, b) {
    const p = b.pts[0], X = p.x * cs, Y = p.y * cs, R = b.r * cs, wob = Math.sin(this.time * 0.05 + b.wob) * 0.04;
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(X, Y + R * 0.95, R * 0.8, R * 0.18, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(X, Y); ctx.rotate(wob);
    // 봉투 몸통
    const g = ctx.createRadialGradient(-R * 0.3, -R * 0.2, R * 0.1, 0, 0, R * 1.1); g.addColorStop(0, '#5FD08A'); g.addColorStop(0.7, '#2E9E5B'); g.addColorStop(1, '#1D6B3D');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-R * 0.25, -R * 0.75);
    ctx.bezierCurveTo(-R * 1.15, -R * 0.4, -R * 1.1, R * 0.95, 0, R * 0.95); ctx.bezierCurveTo(R * 1.1, R * 0.95, R * 1.15, -R * 0.4, R * 0.25, -R * 0.75); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#155530'; ctx.lineWidth = Math.max(1, cs * 0.035); ctx.stroke();
    // 묶은 매듭
    ctx.fillStyle = '#2E9E5B'; ctx.beginPath(); ctx.moveTo(-R * 0.22, -R * 0.75); ctx.lineTo(-R * 0.5, -R * 1.15); ctx.lineTo(-R * 0.05, -R * 0.95); ctx.lineTo(R * 0.45, -R * 1.2); ctx.lineTo(R * 0.22, -R * 0.75); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#FFD166'; ctx.fillRect(-R * 0.28, -R * 0.82, R * 0.56, R * 0.12);
    // 주름 · 재활용 표시(삼각 화살)
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = Math.max(1, cs * 0.03); ctx.beginPath(); ctx.moveTo(-R * 0.5, -R * 0.2); ctx.quadraticCurveTo(-R * 0.6, R * 0.3, -R * 0.3, R * 0.7); ctx.stroke();
    ctx.strokeStyle = 'rgba(235,255,240,0.85)'; ctx.lineWidth = Math.max(1, cs * 0.04); ctx.beginPath();
    const s = R * 0.32, oy = R * 0.25; ctx.moveTo(0, oy - s); ctx.lineTo(s * 0.9, oy + s * 0.6); ctx.lineTo(-s * 0.9, oy + s * 0.6); ctx.closePath(); ctx.stroke();
    const k = b.dmg / b.hp; if (k > 0.25) { ctx.fillStyle = 'rgba(255,255,255,' + (k * 0.4).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(0, 0, R * 0.9, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  draw() {
    const ctx = this.ctx, cs = this.cellSize, W = cs * SL_COLS, H = cs * SL_ROWS;
    this.drawBg(ctx, W, H, cs);
    // 지난 궤적 (흐린 점) · 이번 궤적
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; for (const q of this.lastTrail) { ctx.beginPath(); ctx.arc(q[0] * cs, q[1] * cs, cs * 0.04, 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; for (const q of this.trail) { ctx.beginPath(); ctx.arc(q[0] * cs, q[1] * cs, cs * 0.055, 0, 7); ctx.fill(); }
    this.drawSlingBack(ctx, cs);
    const aiming = this.state === 'aim' && !this.gameOver;
    const pp = aiming ? (this.drag || this.kbAim > 0 ? this.pouch() : SL_SLING) : null;
    if (aiming) this.drawBand(ctx, cs, pp.x, pp.y, true);
    // 물체
    for (const b of this.bodies) if (b.alive && b.kind === 'box') this.drawBox(ctx, cs, b);
    for (const b of this.bodies) if (b.alive && b.kind === 'target') this.drawTarget(ctx, cs, b);
    for (const b of this.bodies) if (b.alive && b.kind === 'ball') this.drawBall(ctx, cs, b.type, b.pts[0].x, b.pts[0].y, b.r, b.rot);
    // 새총 위 공 + 앞 고무줄
    if (aiming && this.ballsLeft > 0) { const type = this.queue[this.ballsTotal - this.ballsLeft] || 'stone'; this.drawBall(ctx, cs, type, pp.x, pp.y, SL_BALLS[type].r, 0); }
    if (aiming) this.drawBand(ctx, cs, pp.x, pp.y, false);
    else { const k = this.snapBack || 0; ctx.strokeStyle = '#B5412A'; ctx.lineWidth = cs * 0.08; const x = SL_SLING.x * cs, fy = (SL_SLING.y - 0.1) * cs;
      ctx.beginPath(); ctx.moveTo((SL_SLING.x - 0.32) * cs, fy); ctx.quadraticCurveTo(x + k * cs * 0.5, fy + cs * 0.15, (SL_SLING.x + 0.32) * cs, fy); ctx.stroke(); }
    this.drawSlingFront(ctx, cs);
    // 남은 공 (새총 옆 땅 위)
    for (let i = 1; i < this.ballsLeft + (aiming ? 0 : 1) && i < 4; i++) { const idx = this.ballsTotal - this.ballsLeft + i - (aiming ? 0 : 1); const type = this.queue[idx] || 'stone';
      this.drawBall(ctx, cs, type, SL_SLING.x - 0.5 - (i - 1) * 0.42, SL_GROUND - 0.19, 0.18, 0); }
    // 예상 궤적 점선 + 각도 호
    if (aiming && (this.drag || this.kbAim > 0)) {
      const pts = this.predict(this._pred || (this._pred = []));
      for (let i = 0; i < pts.length; i++) { const a = 1 - i / (pts.length + 4); ctx.fillStyle = 'rgba(255,255,255,' + (0.95 * a).toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(pts[i][0] * cs, pts[i][1] * cs, cs * (0.07 - i * 0.0006), 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(30,60,110,' + (0.5 * a).toFixed(2) + ')'; ctx.lineWidth = 1; ctx.stroke(); }
      // 각도: 수평선 + 호 (과학 시간 각도기 느낌)
      const sx = pp.x * cs, sy = pp.y * cs, a = this.aimAng * Math.PI / 180, R = cs * 0.9;
      ctx.setLineDash([cs * 0.08, cs * 0.08]); ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = Math.max(1, cs * 0.03);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + cs * 1.3, sy); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = '#FFD166'; ctx.lineWidth = Math.max(2, cs * 0.05); ctx.beginPath(); ctx.arc(sx, sy, R, -Math.max(a, 0), -Math.min(a, 0)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(a) * R * 1.3, sy - Math.sin(a) * R * 1.3); ctx.stroke();
      FX.text(ctx, Math.round(this.aimAng) + '°', sx + Math.cos(a / 2) * R * 1.25, sy - Math.sin(a / 2) * R * 1.25, { size: cs * 0.32, weight: 800, color: '#FFE38A', align: 'center', baseline: 'middle', stroke: 'rgba(20,30,60,0.8)' });
    }
    // 파티클 (조각)
    for (const p of this.parts) { ctx.globalAlpha = Math.max(0, Math.min(1, p.l * 1.5)); ctx.fillStyle = p.c; const s = p.s * cs; ctx.save(); ctx.translate(p.x * cs, p.y * cs); ctx.rotate(p.r + p.l * 4); ctx.fillRect(-s / 2, -s / 2, s, s * 0.7); ctx.restore(); }
    ctx.globalAlpha = 1;
    for (const e of this.pops) { ctx.globalAlpha = Math.min(1, e.t * 2); FX.text(ctx, e.txt, e.x * cs, (e.y - (1 - e.t) * 1.0) * cs, { size: cs * 0.42, weight: 900, color: e.col, align: 'center', stroke: 'rgba(20,30,20,0.85)' }); }
    ctx.globalAlpha = 1;
    this.drawHud(ctx, cs, W, H, aiming);
  }
  drawHud(ctx, cs, W, H, aiming) {
    // 위 띠: 단계 · 점수 · 목표물
    FX.glass(ctx, cs * 0.2, cs * 0.18, W - cs * 0.4, cs * 0.72, cs * 0.25, 'rgba(255,255,255,0.45)');
    FX.text(ctx, '단계 ' + this.level, cs * 0.45, cs * 0.66, { size: cs * 0.34, weight: 800, color: '#FFD166' });
    FX.text(ctx, this.score + '점', W / 2, cs * 0.66, { size: cs * 0.36, weight: 900, color: '#fff', align: 'center' });
    const left = this.targetsLeft();
    FX.text(ctx, '봉투 ' + left, W - cs * 0.45, cs * 0.66, { size: cs * 0.3, weight: 800, color: '#7CFFB2', align: 'right' });
    // 각도 · 세기 (크게)
    const active = aiming && (this.drag || this.kbAim > 0);
    if (aiming) {
      ctx.globalAlpha = active ? 1 : 0.55;
      const y = cs * 1.75, txt = Math.round(this.aimAng) + '° · ' + Math.round(this.aimPow) + '%';
      FX.text(ctx, '각도 · 세기', W / 2, y - cs * 0.55, { size: cs * 0.26, weight: 700, color: '#20406A', align: 'center' });
      FX.text(ctx, txt, W / 2, y + cs * 0.12, { size: cs * 0.7, weight: 900, color: '#fff', align: 'center', stroke: '#20406A', strokeW: cs * 0.12 });
      // 세기 막대
      const bw = cs * 3.2, bx = W / 2 - bw / 2, by = y + cs * 0.32;
      ctx.fillStyle = 'rgba(20,40,80,0.35)'; FX.rr(ctx, bx, by, bw, cs * 0.14, cs * 0.07); ctx.fill();
      const gr = ctx.createLinearGradient(bx, 0, bx + bw, 0); gr.addColorStop(0, '#06D6A0'); gr.addColorStop(0.6, '#FFD166'); gr.addColorStop(1, '#EF476F');
      ctx.fillStyle = gr; FX.rr(ctx, bx, by, Math.max(cs * 0.14, bw * this.aimPow / 100), cs * 0.14, cs * 0.07); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // 처음 안내
    if (this.intro > 0 && !this.gameOver) {
      ctx.globalAlpha = Math.min(1, this.intro / 30);
      FX.glass(ctx, W / 2 - cs * 4.2, H * 0.36, cs * 8.4, cs * 1.9, cs * 0.3, 'rgba(255,209,102,0.8)');
      FX.text(ctx, '새총을 뒤로 끌었다 놓아요!', W / 2, H * 0.36 + cs * 0.75, { size: cs * 0.42, weight: 900, color: '#fff', align: 'center' });
      FX.text(ctx, '쓰레기 봉투를 모두 치우면 다음 단계', W / 2, H * 0.36 + cs * 1.3, { size: cs * 0.3, weight: 700, color: '#FFD166', align: 'center' });
      FX.text(ctx, '키보드: ←→ 각도 · ↑↓ 세기 · 스페이스 발사', W / 2, H * 0.36 + cs * 1.68, { size: cs * 0.24, weight: 600, color: '#cfe3ff', align: 'center' });
      ctx.globalAlpha = 1;
    }
    // 단계 끝 배너
    if (this.banner) {
      const b = this.banner, k = Math.min(1, (1 - b.t) * 6), al = Math.min(1, b.t * 4);
      ctx.save(); ctx.globalAlpha = al; ctx.translate(W / 2, H * 0.4); ctx.scale(0.8 + 0.2 * FX.ease.outBack(k), 0.8 + 0.2 * FX.ease.outBack(k));
      FX.glass(ctx, -cs * 4, -cs * 0.9, cs * 8, cs * 1.8, cs * 0.35, 'rgba(124,255,178,0.9)');
      FX.text(ctx, b.txt, 0, -cs * 0.05, { size: cs * 0.55, weight: 900, color: '#7CFFB2', align: 'center' });
      FX.text(ctx, b.sub, 0, cs * 0.55, { size: cs * 0.3, weight: 700, color: '#FFD166', align: 'center' });
      ctx.restore();
    }
    if (this.gameOver) {
      ctx.fillStyle = 'rgba(8,14,30,0.68)'; ctx.fillRect(0, 0, W, H);
      FX.text(ctx, '공을 다 썼어요', W / 2, H * 0.42, { size: cs * 0.7, weight: 900, color: '#fff', align: 'center' });
      FX.text(ctx, this.score + '점 · 단계 ' + this.level + '에서 끝', W / 2, H * 0.42 + cs * 0.9, { size: cs * 0.42, weight: 800, color: '#FFD166', align: 'center' });
      FX.text(ctx, '치운 봉투 ' + this.targetsHit + '개 · 쏜 공 ' + this.shots + '개', W / 2, H * 0.42 + cs * 1.5, { size: cs * 0.32, weight: 700, color: '#cfe3ff', align: 'center' });
    }
  }
}
if (typeof window !== 'undefined') window.SlingshotGame = SlingshotGame;
