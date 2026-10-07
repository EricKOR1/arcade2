// 색깔 물 정리 — 시험관을 톡, 다른 시험관을 톡 하면 맨 위 같은 색 물이 옮겨져요. 시험관마다 한 색으로 모으면 단계 완료.
//   제한 시간 5분 동안 몇 단계를 푸는지 겨룹니다 · 퍼즐은 모두 풀이기로 '풀 수 있음'을 확인한 것만 나옵니다
//   (모바일 인기 '물 정렬 퍼즐' 장르를 학교용으로 새로 만든 것 — 이름·그림은 모두 새로 그림)
//   색약 학생도 구분하도록 색마다 무늬(점·줄·물결 …)를 물 위에 살짝 겹칩니다

const WS_COLS = 9, WS_ROWS = 14, WS_CAP = 4;
const WS_TIME = 5 * 60 * 1000;                 // 제한 시간
const WS_U = 0.92, WS_NECK = 0.45;             // 물 한 칸 높이 · 시험관 목 (칸 단위)
const WS_LEN = WS_CAP * WS_U + WS_NECK;        // 시험관 길이
const WS_ROW_TOP = [2.35, 7.5];                // 두 줄 시험관의 입구 높이
const WS_POUR = 450;                           // 옮기기 애니메이션 (ms)
// 색 · 무늬 · 교사 미니보드 번호 (CELL_COLORS)
const WS_COLORS = [
  { c: '#EF476F', p: 'dots',   s: 7 },   // 빨강 · 점
  { c: '#4361EE', p: 'diag',   s: 2 },   // 파랑 · 빗금
  { c: '#FFD166', p: 'wave',   s: 4 },   // 노랑 · 물결
  { c: '#06D6A0', p: 'plus',   s: 5 },   // 초록 · 더하기
  { c: '#B15DFF', p: 'rings',  s: 6 },   // 보라 · 고리
  { c: '#F79824', p: 'vert',   s: 3 },   // 주황 · 세로줄
  { c: '#4CC9F0', p: 'zig',    s: 1 },   // 하늘 · 지그재그
  { c: '#FF8AD8', p: 'cross',  s: 61 },  // 분홍 · 엑스
  { c: '#A0673A', p: 'check',  s: 57 },  // 갈색 · 바둑판
  { c: '#A7E23B', p: 'tri',    s: 14 },  // 연두 · 세모
  { c: '#E6E9F0', p: 'adiag',  s: 21 },  // 흰색 · 반대 빗금
  { c: '#1F8A70', p: 'dash',   s: 65 }   // 청록 · 가로 점선
];

// ── 풀이기 (깊이 우선 + 이미 본 상태 건너뛰기) ── 시험관 = 아래→위 색 번호 배열. 풀이 [[from,to],…] 또는 null
function wsSolve(tubes, limit) {
  const enc = t => t.map(a => String.fromCharCode(97 + a.length) + a.map(c => String.fromCharCode(65 + c)).join(''));
  const key = arr => arr.slice().sort().join('|');
  const start = enc(tubes);
  const done = s => s.every(t => t.length === 1 || (t.length === WS_CAP + 1 && /^(.)\1*$/.test(t.slice(1))));
  const seen = new Set([key(start)]);
  const stack = [{ s: start, path: [] }];
  let nodes = 0;
  while (stack.length) {
    const { s, path } = stack.pop();
    if (done(s)) return path;
    if (++nodes > (limit || 20000)) return null;
    const moves = [];
    for (let i = 0; i < s.length; i++) {
      const a = s[i].slice(1); if (!a.length) continue;
      const top = a[a.length - 1]; let run = 1; while (run < a.length && a[a.length - 1 - run] === top) run++;
      if (run === a.length && a.length === WS_CAP) continue;            // 이미 완성된 시험관
      for (let j = 0; j < s.length; j++) { if (i === j) continue;
        const b = s[j].slice(1); if (b.length >= WS_CAP) continue;
        if (b.length && b[b.length - 1] !== top) continue;
        if (!b.length && run === a.length) continue;                    // 한 색뿐인데 빈 곳으로 — 의미 없음
        const n = Math.min(run, WS_CAP - b.length);
        // 점수가 높을수록 먼저 시도 (스택이므로 나중에 넣음): 같은 색 위로 · 통째로 옮김
        const pr = (b.length ? 4 : 0) + (n === run ? 2 : 0) + (b.length + n === WS_CAP ? 1 : 0);
        moves.push({ i, j, n, pr });
      }
    }
    moves.sort((m1, m2) => m1.pr - m2.pr);
    for (const m of moves) {
      const t = s.slice(), a = t[m.i].slice(1), b = t[m.j].slice(1);
      const run = a.slice(a.length - m.n);
      const na = a.slice(0, a.length - m.n), nb = b + run;
      t[m.i] = String.fromCharCode(97 + na.length) + na; t[m.j] = String.fromCharCode(97 + nb.length) + nb;
      const k = key(t); if (seen.has(k)) continue; seen.add(k);
      stack.push({ s: t, path: path.concat([[m.i, m.j]]) });
    }
  }
  return null;
}

class WaterSortGame {
  constructor(canvas, cellSize) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.cellSize = cellSize;
    this.W = WS_COLS; this.H = WS_ROWS;
    this.score = 0; this.gameOver = false; this.level = 1; this.solved = 0; this.totalMoves = 0;
    this.timeLeft = WS_TIME; this.lastTime = 0; this.now = 0; this.playMs = 0;
    this.parts = []; this.pops = []; this.anim = null; this.sel = -1; this.cursor = -1; this.clearAt = 0;
    this.lastTapAt = -1e9; this.lastTapXY = null; this.genMs = 0;
    this.startLevel();
  }
  get colorsN() { return Math.min(WS_COLORS.length, this.level + 2); }

  // ── 단계 만들기: 색 물을 무작위로 섞고, 풀이기로 풀리는 것만 ──
  startLevel() {
    const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
    const k = this.colorsN; let tubes = null, sol = null;
    for (let tries = 0; tries < 300 && !sol; tries++) {
      const pool = []; for (let c = 0; c < k; c++) for (let i = 0; i < WS_CAP; i++) pool.push(c);
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      tubes = []; for (let c = 0; c < k; c++) tubes.push(pool.slice(c * WS_CAP, c * WS_CAP + WS_CAP));
      // 너무 쉬운 판(이미 3칸 이상 같은 색이 붙은 시험관) 은 다시
      if (tubes.some(t => { let r = 1; for (let i = 1; i < t.length; i++) { r = t[i] === t[i - 1] ? r + 1 : 1; if (r >= 3) return true; } return false; })) continue;
      tubes.push([], []);
      sol = wsSolve(tubes, (6000 + k * 1500) * (tries < 40 ? 1 : 4));
    }
    this.genMs = (typeof performance !== 'undefined' ? performance : Date).now() - t0;
    this.tubes = tubes; this.init = tubes.map(t => t.slice()); this.par = sol ? sol.length : k * 3;
    this.history = []; this.moves = 0; this.undoLeft = 5; this.extraLeft = 1; this.undoUsed = 0; this.extraUsed = 0;
    this.sel = -1; this.anim = null; this.cursor = Math.min(this.cursor, tubes.length - 1);
    this.doneT = tubes.map(() => 0); this.stuck = false; this.levelStartMs = this.playMs;
    this.layout();
  }

  // 시험관 자리 (칸 단위): 위·아래 두 줄 · 가운데 맞춤
  layout() {
    const n = this.tubes.length, top = Math.ceil(n / 2), per = Math.max(top, 3);
    const sp = Math.min(1.5, (WS_COLS - 0.3) / per);
    this.tubeW = Math.min(0.78, sp * 0.62); this.sp = sp;
    this.pos = [];
    for (let i = 0; i < n; i++) {
      const row = i < top ? 0 : 1, idx = row ? i - top : i, cnt = row ? n - top : top;
      this.pos.push({ x: WS_COLS / 2 + (idx - (cnt - 1) / 2) * sp, y: WS_ROW_TOP[row], lift: 0 });
    }
  }
  tubePos(i) { const p = this.pos[i]; return { x: p.x, y: p.y + WS_LEN / 2 }; }   // 테스트용: 시험관 가운데
  buttons() {
    const y = 12.15, h = 1.45, w = 2.55, gap = 0.3, x0 = (WS_COLS - (w * 3 + gap * 2)) / 2;
    return [{ id: 'undo', x: x0, y, w, h }, { id: 'extra', x: x0 + w + gap, y, w, h }, { id: 'reset', x: x0 + 2 * (w + gap), y, w, h }];
  }

  // ── 규칙 ──
  topRun(t) { if (!t.length) return 0; const c = t[t.length - 1]; let r = 1; while (r < t.length && t[t.length - 1 - r] === c) r++; return r; }
  isDone(t) { return t.length === WS_CAP && this.topRun(t) === WS_CAP; }
  canPour(i, j) {
    const a = this.tubes[i], b = this.tubes[j];
    if (i === j || !a || !b || !a.length || b.length >= WS_CAP) return false;
    return !b.length || b[b.length - 1] === a[a.length - 1];
  }
  pour(i, j) {
    const a = this.tubes[i], b = this.tubes[j];
    const n = Math.min(this.topRun(a), WS_CAP - b.length), c = a[a.length - 1];
    this.history.push(this.tubes.map(t => t.slice()));
    if (this.history.length > 60) this.history.shift();
    const before = b.slice();
    for (let k = 0; k < n; k++) b.push(a.pop());
    this.moves++; this.totalMoves++;
    this.anim = { from: i, to: j, c, n, t: 0, dstBefore: before };
    if (window.Sound) Sound.note ? Sound.note(520 + n * 60, 0.12, 'sine', 0.25) : Sound.move();
    if (this.isDone(b)) this.doneT[j] = -1;              // 물이 다 떨어진 뒤 반짝 (애니메이션 끝에 표시)
    this.afterMove();
  }
  afterMove() {
    if (this.tubes.every(t => !t.length || this.isDone(t))) {
      // 단계 완료: 기본 + 적게 옮길수록 보너스 − 되돌리기·추가 시험관 감점
      const k = this.colorsN, base = 100 + 20 * k;
      const bonus = Math.max(0, Math.min(150, (this.par + 3 - this.moves) * 5));
      const pen = this.undoUsed * 5 + this.extraUsed * 25;
      const gain = Math.max(20, Math.round(base + bonus - pen));
      this.score += gain; this.solved++; this.lastGain = gain;
      this.clearAt = this.now + 1500; this.sel = -1;
      if (window.Sound) Sound.levelUp();
      return;
    }
    // 더 옮길 곳이 없으면 안내
    let any = false;
    for (let i = 0; i < this.tubes.length && !any; i++) for (let j = 0; j < this.tubes.length; j++) if (this.canPour(i, j) && !(this.tubes[j].length === 0 && this.topRun(this.tubes[i]) === this.tubes[i].length)) { any = true; break; }
    this.stuck = !any;
  }
  finishAnim() {
    if (!this.anim) return;
    const j = this.anim.to; if (this.doneT[j] === -1) this.sparkle(j);
    this.anim = null;
  }
  sparkle(j) {
    this.doneT[j] = this.now || 1;
    const p = this.pos[j], col = WS_COLORS[this.tubes[j][0]].c;
    for (let k = 0; k < 18; k++) { const a = Math.random() * Math.PI * 2, v = 0.03 + Math.random() * 0.06;
      this.parts.push({ x: p.x, y: p.y + 0.2, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.04, g: 0.003, l: 1, c: k % 3 ? col : '#FFFFFF' }); }
    if (window.Sound) Sound.gem ? Sound.gem() : Sound.clear(1);
  }

  // ── 조작 ──
  tapAt(x, y) {
    if (this.gameOver || this.clearAt) return;
    // 한 번의 톡이 두 번 들어오는 것 막기 (같은 자리 · 60ms 안)
    if (this.now - this.lastTapAt < 60 && this.lastTapXY && Math.abs(this.lastTapXY[0] - x) < 0.3 && Math.abs(this.lastTapXY[1] - y) < 0.3) return;
    this.lastTapAt = this.now; this.lastTapXY = [x, y];
    for (const b of this.buttons()) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { this.press(b.id); return; }
    const i = this.hitTube(x, y); if (i < 0) { this.sel = -1; return; }
    this.pick(i);
  }
  hitTube(x, y) {
    for (let i = 0; i < this.pos.length; i++) { const p = this.pos[i];
      if (Math.abs(x - p.x) <= this.sp / 2 && y >= p.y - 0.9 && y <= p.y + WS_LEN + 0.35) return i; }
    return -1;
  }
  pick(i) {
    this.finishAnim();
    const t = this.tubes[i];
    if (this.sel < 0) {
      if (!t.length || this.isDone(t)) { if (window.Sound) Sound.bump && Sound.bump(); return; }
      this.sel = i; if (window.Sound) Sound.note ? Sound.note(660, 0.06, 'triangle', 0.2) : Sound.move(); return;
    }
    if (this.sel === i) { this.sel = -1; return; }
    if (this.canPour(this.sel, i)) { const s = this.sel; this.sel = -1; this.pour(s, i); return; }
    // 못 옮기면: 그 시험관을 새로 고름 (비었거나 완성이면 선택 풀기)
    if (window.Sound && Sound.bump) Sound.bump();
    this.sel = (t.length && !this.isDone(t)) ? i : -1;
  }
  press(id) {
    this.finishAnim(); this.sel = -1;
    if (id === 'undo') this.undo();
    else if (id === 'extra') {
      if (this.extraLeft <= 0) { if (window.Sound && Sound.bump) Sound.bump(); return; }
      this.extraLeft--; this.extraUsed++; this.tubes.push([]); this.init.push([]); this.doneT.push(0);
      this.history.forEach(h => h.push([])); this.layout(); this.stuck = false;
      if (window.Sound) Sound.item ? Sound.item() : Sound.move();
    } else if (id === 'reset') {
      // 처음 배치로 (더한 시험관은 그대로 · 되돌리기 횟수는 돌려주지 않음)
      this.tubes = this.init.map(t => t.slice()); this.history = []; this.moves = 0; this.doneT = this.tubes.map(() => 0); this.stuck = false;
      if (window.Sound) Sound.rotate ? Sound.rotate() : Sound.move();
    }
  }
  undo() {
    if (this.gameOver || this.clearAt) return;
    this.finishAnim();
    if (this.undoLeft <= 0 || !this.history.length) { if (window.Sound && Sound.bump) Sound.bump(); return; }
    this.tubes = this.history.pop(); this.undoLeft--; this.undoUsed++; this.moves = Math.max(0, this.moves - 1); this.sel = -1;
    this.doneT = this.tubes.map((t, k) => this.isDone(t) ? (this.doneT[k] || 1) : 0); this.stuck = false;
    if (window.Sound) Sound.rotate ? Sound.rotate() : Sound.move();
  }
  // 키보드: ← → 시험관 고르기 · 스페이스 톡 · ↑ 되돌리기
  move(dir) { if (this.gameOver) return; const n = this.tubes.length; this.cursor = this.cursor < 0 ? 0 : (this.cursor + dir + n) % n; }
  hardDrop() { if (this.gameOver || this.clearAt) return; if (this.cursor < 0) { this.cursor = 0; return; } this.pick(this.cursor); }
  up() { this.undo(); }
  rotate() { this.undo(); }
  softDrop() {} down() {}
  // 풀이기 도우미 (자동 테스트용): 지금 상태에서 풀이
  solveNow(limit) { return wsSolve(this.tubes.map(t => t.slice()), limit || 50000); }

  tick(now) {
    const { dt, f } = FX.frame(this, now);
    if (this.gameOver) { this.draw(); return; }
    this.playMs += dt;
    if (!this.clearAt) { this.timeLeft -= dt;
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.gameOver = true; this.sel = -1; this.finishAnim(); if (window.Sound) Sound.gameOver(); } }
    if (this.anim) { this.anim.t += dt; if (this.anim.t >= WS_POUR) this.finishAnim(); }
    if (this.clearAt && now >= this.clearAt && !this.anim) { this.clearAt = 0; this.level++; this.startLevel(); }
    // 고른 시험관은 위로 들림
    const k = Math.min(1, 0.25 * f);
    this.pos.forEach((p, i) => { p.lift += ((i === this.sel ? 0.55 : 0) - p.lift) * k; });
    this.parts = FX.stepParts(this.parts, f, 0.025);
    this.draw();
  }

  getSnapshot() {
    const g = Array.from({ length: WS_ROWS }, () => Array(WS_COLS).fill(0));
    this.tubes.forEach((t, i) => { const p = this.pos[i], cx = Math.max(0, Math.min(WS_COLS - 1, Math.floor(p.x)));
      const bottom = Math.min(WS_ROWS - 1, Math.floor(p.y + WS_LEN - 0.2));
      for (let u = 0; u < WS_CAP; u++) { const r = bottom - u; if (r >= 0) g[r][cx] = u < t.length ? WS_COLORS[t[u]].s : 12; } });
    return g;
  }

  // ── 그리기 도구 ──
  // 색마다 무늬 타일 (한 번만 만들어 둠)
  patterns() {
    const cs = this.cellSize;
    if (this._pat && this._patCs === cs) return this._pat;
    this._patCs = cs;
    const S = Math.max(6, Math.round(cs * 0.36));
    this._pat = WS_COLORS.map(col => {
      const c = document.createElement('canvas'); c.width = S; c.height = S; const g = c.getContext('2d');
      const light = ['#FFD166', '#E6E9F0', '#A7E23B'].includes(col.c);
      g.strokeStyle = g.fillStyle = light ? 'rgba(40,30,20,0.55)' : 'rgba(255,255,255,0.75)';
      g.lineWidth = Math.max(1, S * 0.11); g.lineCap = 'round';
      const L = (a, b, c2, d) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c2, d); g.stroke(); };
      const h = S / 2;
      switch (col.p) {
        case 'dots': g.beginPath(); g.arc(h, h, S * 0.14, 0, 7); g.fill(); break;
        case 'diag': L(-1, S + 1, S + 1, -1); L(-1, 1, 1, -1); L(S - 1, S + 1, S + 1, S - 1); break;
        case 'adiag': L(-1, -1, S + 1, S + 1); L(S - 1, -1, S + 1, 1); L(-1, S - 1, 1, S + 1); break;
        case 'wave': g.beginPath(); for (let x = 0; x <= S; x++) { const y = h + Math.sin(x / S * Math.PI * 2) * S * 0.18; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); break;
        case 'plus': L(h, h - S * 0.22, h, h + S * 0.22); L(h - S * 0.22, h, h + S * 0.22, h); break;
        case 'cross': L(h - S * 0.18, h - S * 0.18, h + S * 0.18, h + S * 0.18); L(h + S * 0.18, h - S * 0.18, h - S * 0.18, h + S * 0.18); break;
        case 'rings': g.beginPath(); g.arc(h, h, S * 0.2, 0, 7); g.stroke(); break;
        case 'vert': L(h, 0, h, S); break;
        case 'dash': L(S * 0.2, h, S * 0.8, h); break;
        case 'zig': g.beginPath(); g.moveTo(0, h + S * 0.15); g.lineTo(h, h - S * 0.15); g.lineTo(S, h + S * 0.15); g.stroke(); break;
        case 'check': g.globalAlpha = 0.5; g.fillRect(0, 0, h, h); g.fillRect(h, h, h, h); break;
        case 'tri': g.beginPath(); g.moveTo(h, h - S * 0.2); g.lineTo(h + S * 0.2, h + S * 0.16); g.lineTo(h - S * 0.2, h + S * 0.16); g.closePath(); g.fill(); break;
      }
      return this.ctx.createPattern(c, 'repeat');
    });
    return this._pat;
  }
  // 시험관 모양 path (입구 가운데가 원점 · 아래로 len)
  tubePath(ctx, w, len, inset) {
    const r = w / 2 - inset, x = -r, y0 = inset * 0.5;
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, len - w / 2); ctx.arc(0, len - w / 2, r, Math.PI, 0, true); ctx.lineTo(r, y0); ctx.closePath();
  }
  // 물 그리기 — base(아래→위 색) 위에 part{c, amt(칸 수, 소수)} 를 더 얹어 그림
  drawLiquid(ctx, w, len, base, part, wave) {
    const cs = this.cellSize, u = WS_U * cs, pats = this.patterns();
    const runs = []; base.forEach(c => { const r = runs[runs.length - 1]; if (r && r.c === c) r.n++; else runs.push({ c, n: 1 }); });
    if (part && part.amt > 0.001) { const r = runs[runs.length - 1]; if (r && r.c === part.c) r.n += part.amt; else runs.push({ c: part.c, n: part.amt }); }
    if (!runs.length) return;
    ctx.save(); this.tubePath(ctx, w, len, 2); ctx.clip();
    let lv = 0; const total = runs.reduce((s, r) => s + r.n, 0), topY = len - total * u;
    runs.forEach((r, k) => {
      const yb = len - lv * u + (lv === 0 ? w : 0), yt = len - (lv + r.n) * u, col = WS_COLORS[r.c];
      lv += r.n;
      const last = k === runs.length - 1;
      ctx.beginPath();
      if (last && wave) {        // 맨 위 물결
        ctx.moveTo(-w, yb); ctx.lineTo(-w, yt);
        for (let x = -w / 2; x <= w / 2 + 0.1; x += w / 6) ctx.lineTo(x, yt + Math.sin(this.now / 260 + x / w * 6 + r.c) * cs * 0.04);
        ctx.lineTo(w, yt); ctx.lineTo(w, yb); ctx.closePath();
      } else ctx.rect(-w, yt, w * 2, yb - yt + 0.5);
      ctx.fillStyle = col.c; ctx.fill();
      ctx.globalAlpha = 0.28; ctx.fillStyle = pats[r.c]; ctx.fill(); ctx.globalAlpha = 1;
      // 층 위쪽은 조금 밝게
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-w, yt, w * 2, Math.min(u * 0.18, (yb - yt) * 0.3));
    });
    // 좌우 입체 그늘 (공용 그라데이션)
    if (!this._shade || this._shadeW !== w) { this._shadeW = w; const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
      g.addColorStop(0, 'rgba(255,255,255,0.28)'); g.addColorStop(0.3, 'rgba(255,255,255,0.04)'); g.addColorStop(0.75, 'rgba(0,0,0,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0.32)'); this._shade = g; }
    ctx.fillStyle = this._shade; ctx.fillRect(-w / 2, topY - cs * 0.1, w, len - topY + cs * 0.1);
    ctx.restore();
  }
  drawTube(ctx, i, X, Y, ang, base, part, wave) {
    const cs = this.cellSize, w = this.tubeW * cs, len = WS_LEN * cs;
    ctx.save(); ctx.translate(X, Y); if (ang) ctx.rotate(ang);
    // 유리 몸통
    ctx.fillStyle = 'rgba(180,210,255,0.07)'; this.tubePath(ctx, w, len, 0); ctx.fill();
    this.drawLiquid(ctx, w, len, base, part, wave);
    this.tubePath(ctx, w, len, 0);
    ctx.lineWidth = Math.max(1.5, cs * 0.05); ctx.strokeStyle = i === this.sel ? 'rgba(255,224,130,0.95)' : 'rgba(220,235,255,0.6)'; ctx.stroke();
    // 반사광
    ctx.fillStyle = 'rgba(255,255,255,0.32)'; FX.rr(ctx, -w * 0.32, len * 0.1, w * 0.12, len * 0.72, w * 0.06); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; FX.rr(ctx, w * 0.2, len * 0.15, w * 0.07, len * 0.5, w * 0.04); ctx.fill();
    // 입구 테두리
    ctx.fillStyle = 'rgba(230,240,255,0.75)'; FX.rr(ctx, -w * 0.62, -cs * 0.07, w * 1.24, cs * 0.14, cs * 0.07); ctx.fill();
    // 완성 뚜껑 + 반짝
    const dt = this.doneT[i];
    if (dt > 0 && this.tubes[i].length) {
      const col = WS_COLORS[this.tubes[i][0]].c, k = Math.min(1, (this.now - dt) / 300), drop = (1 - FX.ease.outBack(k)) * -cs * 0.8;
      const cg = ctx.createLinearGradient(0, -cs * 0.3 + drop, 0, cs * 0.12 + drop); cg.addColorStop(0, FX.tint(col, 0.35)); cg.addColorStop(1, FX.tint(col, -0.35));
      ctx.fillStyle = cg; FX.rr(ctx, -w * 0.66, -cs * 0.32 + drop, w * 1.32, cs * 0.42, cs * 0.1); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; FX.rr(ctx, -w * 0.5, -cs * 0.27 + drop, w * 0.6, cs * 0.08, cs * 0.04); ctx.fill();
      const sp = (this.now - dt) / 900;          // 반짝 별 (처음 0.9초 + 가끔)
      const tw = sp < 1 ? 1 - sp : Math.max(0, Math.sin(this.now / 500 + i * 1.7) - 0.85) * 6;
      if (tw > 0.02) this.star(ctx, w * 0.3, len * 0.3, cs * 0.28 * tw, 'rgba(255,255,255,' + Math.min(1, tw).toFixed(2) + ')');
    }
    ctx.restore();
  }
  star(ctx, x, y, r, c) {
    ctx.fillStyle = c; ctx.beginPath();
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? r * 0.28 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  }
  drawButton(ctx, b, label, count, enabled) {
    const cs = this.cellSize, x = b.x * cs, y = b.y * cs, w = b.w * cs, h = b.h * cs;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, enabled ? '#3A4D7A' : '#2A3042'); g.addColorStop(1, enabled ? '#243055' : '#1C2130');
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; FX.rr(ctx, x, y + cs * 0.08, w, h, cs * 0.35); ctx.fill();
    ctx.fillStyle = g; FX.rr(ctx, x, y, w, h, cs * 0.35); ctx.fill();
    ctx.strokeStyle = enabled ? 'rgba(160,190,255,0.45)' : 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1.2; ctx.stroke();
    const ix = x + w * 0.21, iy = y + h / 2, r = cs * 0.27, col = enabled ? '#EAF0FF' : '#6B7385';
    ctx.strokeStyle = ctx.fillStyle = col; ctx.lineWidth = Math.max(2, cs * 0.09); ctx.lineCap = 'round';
    if (b.id === 'undo') {        // 휘어진 왼쪽 화살표
      ctx.beginPath(); ctx.arc(ix, iy + r * 0.15, r * 0.8, Math.PI * 1.15, Math.PI * 0.35, false); ctx.stroke();
      const ax = ix + Math.cos(Math.PI * 1.15) * r * 0.8, ay = iy + r * 0.15 + Math.sin(Math.PI * 1.15) * r * 0.8;
      ctx.beginPath(); ctx.moveTo(ax - r * 0.45, ay - r * 0.1); ctx.lineTo(ax + r * 0.05, ay - r * 0.55); ctx.lineTo(ax + r * 0.25, ay + r * 0.1); ctx.closePath(); ctx.fill();
    } else if (b.id === 'extra') { // 작은 시험관 + 더하기
      ctx.lineWidth = Math.max(1.5, cs * 0.06); ctx.beginPath(); ctx.moveTo(ix - r * 0.35, iy - r); ctx.lineTo(ix - r * 0.35, iy + r * 0.6); ctx.arc(ix, iy + r * 0.6, r * 0.35, Math.PI, 0, true); ctx.lineTo(ix + r * 0.35, iy - r); ctx.stroke();
      ctx.lineWidth = Math.max(2, cs * 0.09); ctx.beginPath(); ctx.moveTo(ix + r * 0.75, iy - r * 0.55); ctx.lineTo(ix + r * 0.75, iy + r * 0.05); ctx.moveTo(ix + r * 0.45, iy - r * 0.25); ctx.lineTo(ix + r * 1.05, iy - r * 0.25); ctx.stroke();
    } else {                       // 돌아가는 화살표
      ctx.beginPath(); ctx.arc(ix, iy, r * 0.75, -Math.PI * 0.35, Math.PI * 1.45); ctx.stroke();
      const a = -Math.PI * 0.35, ax = ix + Math.cos(a) * r * 0.75, ay = iy + Math.sin(a) * r * 0.75;
      ctx.beginPath(); ctx.moveTo(ax + r * 0.4, ay - r * 0.05); ctx.lineTo(ax - r * 0.2, ay - r * 0.45); ctx.lineTo(ax - r * 0.1, ay + r * 0.3); ctx.closePath(); ctx.fill();
    }
    ctx.lineCap = 'butt';
    FX.text(ctx, label, x + w * 0.63, iy - (count != null ? cs * 0.1 : -cs * 0.11), { size: cs * 0.31, weight: 800, color: col, align: 'center', baseline: 'middle' });
    if (count != null) FX.text(ctx, count, x + w * 0.63, iy + cs * 0.3, { size: cs * 0.3, weight: 700, color: enabled ? '#FFD166' : '#6B7385', align: 'center', baseline: 'middle' });
  }

  draw() {
    const ctx = this.ctx, cs = this.cellSize, W = WS_COLS * cs, H = WS_ROWS * cs, now = this.now;
    // 배경: 실험실 밤 (그라데이션 캐시)
    if (!this._bg || this._bgCs !== cs) { this._bgCs = cs; const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#141A33'); g.addColorStop(0.6, '#1B2246'); g.addColorStop(1, '#0E1226'); this._bg = g;
      const v = ctx.createRadialGradient(W / 2, H * 0.45, cs, W / 2, H * 0.45, H * 0.6); v.addColorStop(0, 'rgba(120,140,255,0.12)'); v.addColorStop(1, 'rgba(120,140,255,0)'); this._glow = v; }
    ctx.fillStyle = this._bg; ctx.fillRect(0, 0, W, H); ctx.fillStyle = this._glow; ctx.fillRect(0, 0, W, H);
    // 선반 두 줄
    WS_ROW_TOP.forEach(ty => { const y = (ty + WS_LEN + 0.12) * cs;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; FX.rr(ctx, cs * 0.25, y + cs * 0.1, W - cs * 0.5, cs * 0.22, cs * 0.1); ctx.fill();
      const sg = ctx.createLinearGradient(0, y, 0, y + cs * 0.2); sg.addColorStop(0, '#5B6AA6'); sg.addColorStop(1, '#323C6B');
      ctx.fillStyle = sg; FX.rr(ctx, cs * 0.2, y, W - cs * 0.4, cs * 0.2, cs * 0.1); ctx.fill(); });

    // HUD: 단계 · 남은 시간 · 점수
    FX.glass(ctx, cs * 0.2, cs * 0.2, W - cs * 0.4, cs * 1.3, cs * 0.35);
    FX.text(ctx, '단계', cs * 0.55, cs * 0.72, { size: cs * 0.3, weight: 700, color: '#9FB0E0' });
    FX.text(ctx, String(this.level), cs * 0.55, cs * 1.25, { size: cs * 0.55, weight: 800, color: '#fff' });
    FX.text(ctx, '점수', W - cs * 0.55, cs * 0.72, { size: cs * 0.3, weight: 700, color: '#9FB0E0', align: 'right' });
    FX.text(ctx, String(this.score), W - cs * 0.55, cs * 1.25, { size: cs * 0.55, weight: 800, color: '#FFD166', align: 'right' });
    { const s = Math.ceil(this.timeLeft / 1000), m = Math.floor(s / 60), low = s <= 30;
      const str = m + ':' + String(s % 60).padStart(2, '0');
      const blink = low && !this.gameOver && (now % 1000) < 500;
      FX.text(ctx, str, W / 2, cs * 0.95, { size: cs * 0.62, weight: 800, color: low ? (blink ? '#FF5C7A' : '#FFB3C1') : '#EAF0FF', align: 'center' });
      const bw = cs * 3.2, bx = W / 2 - bw / 2, by = cs * 1.15, k = this.timeLeft / WS_TIME;
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; FX.rr(ctx, bx, by, bw, cs * 0.14, cs * 0.07); ctx.fill();
      ctx.fillStyle = low ? '#FF5C7A' : '#4CC9F0'; FX.rr(ctx, bx, by, Math.max(cs * 0.14, bw * k), cs * 0.14, cs * 0.07); ctx.fill(); }
    FX.text(ctx, '옮김 ' + this.moves, W / 2, cs * 1.95, { size: cs * 0.3, weight: 700, color: 'rgba(200,215,255,0.7)', align: 'center' });

    // 시험관들 (옮기는 중인 시험관은 맨 나중에 — 다른 시험관 위로)
    const a = this.anim;
    this.tubes.forEach((t, i) => {
      if (a && i === a.from) return;
      const p = this.pos[i];
      let base = t, part = null;
      if (a && i === a.to) { const k = Math.max(0, Math.min(1, (a.t / WS_POUR - 0.3) / 0.45)); base = a.dstBefore; part = { c: a.c, amt: a.n * k }; }
      // 고른 시험관 그림자 · 빛
      if (p.lift > 0.05) { ctx.fillStyle = 'rgba(255,224,130,' + (0.18 * p.lift / 0.55).toFixed(3) + ')'; ctx.beginPath(); ctx.ellipse(p.x * cs, (p.y + WS_LEN + 0.1) * cs, this.tubeW * cs * 0.8, cs * 0.12, 0, 0, Math.PI * 2); ctx.fill(); }
      this.drawTube(ctx, i, p.x * cs, (p.y - p.lift) * cs, 0, base, part, true);
      if (i === this.cursor) { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5; FX.rr(ctx, (p.x - this.sp / 2 + 0.06) * cs, (p.y - 0.7) * cs, (this.sp - 0.12) * cs, (WS_LEN + 0.95) * cs, cs * 0.2); ctx.stroke(); ctx.setLineDash([]); }
    });
    if (a) {
      const p = this.pos[a.from], q = this.pos[a.to], pt = a.t / WS_POUR;
      // 0~0.3 이동·기울이기 · 0.3~0.75 붓기 · 0.75~1 돌아가기
      const mk = pt < 0.3 ? FX.ease.inOut(pt / 0.3) : pt < 0.75 ? 1 : 1 - FX.ease.inOut((pt - 0.75) / 0.25);
      const side = q.x < WS_COLS / 2 ? 1 : -1;      // 몸통이 화면 가운데 쪽으로 눕게
      const tx = q.x + side * this.tubeW * 0.15, ty = q.y - 0.35;
      const sx = p.x, sy = p.y - p.lift;
      const X = (sx + (tx - sx) * mk) * cs, Y = (sy + (ty - sy) * mk) * cs, ang = -side * 1.95 * mk;
      const pk = Math.max(0, Math.min(1, (pt - 0.3) / 0.45));
      // 물줄기
      if (pt > 0.27 && pt < 0.8) {
        const lvl = a.dstBefore.length + a.n * pk, y1 = (q.y + WS_LEN - lvl * WS_U) * cs, x0 = tx * cs;
        const wdt = cs * 0.13 * Math.min(1, (pt - 0.27) / 0.06, (0.8 - pt) / 0.08);
        const col = WS_COLORS[a.c].c;
        ctx.fillStyle = col; ctx.fillRect(x0 - wdt / 2 + Math.sin(now / 40) * 0.6, Y, wdt, Math.max(0, y1 - Y));
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x0 - wdt / 2, Y, wdt * 0.3, Math.max(0, y1 - Y));
        ctx.globalAlpha = 0.6; ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(x0, y1, wdt * 1.4, wdt * 0.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      }
      this.drawTube(ctx, a.from, X, Y, ang, this.tubes[a.from], { c: a.c, amt: a.n * (1 - pk) }, false);
    }
    FX.drawParts(ctx, this.parts, cs, Math.max(2, cs * 0.12));

    // 버튼
    const bs = this.buttons();
    this.drawButton(ctx, bs[0], '되돌리기', this.undoLeft + '번', this.undoLeft > 0 && this.history.length > 0 && !this.clearAt);
    this.drawButton(ctx, bs[1], '시험관', this.extraLeft ? '+1' : '다 씀', this.extraLeft > 0 && !this.clearAt);
    this.drawButton(ctx, bs[2], '처음부터', null, this.moves > 0 && !this.clearAt);

    // 안내 글자
    if (this.playMs < 3500 && this.level === 1 && !this.moves) {
      const al = Math.min(1, (3500 - this.playMs) / 500);
      ctx.globalAlpha = al; FX.glass(ctx, cs * 0.6, cs * 6.45, W - cs * 1.2, cs * 1.0, cs * 0.3);
      FX.text(ctx, '시험관을 톡 → 다른 시험관을 톡!', W / 2, cs * 6.88, { size: cs * 0.38, weight: 800, color: '#fff', align: 'center' });
      FX.text(ctx, '같은 색끼리 한 시험관에 모아요', W / 2, cs * 7.28, { size: cs * 0.3, weight: 600, color: '#BFD0FF', align: 'center' });
      ctx.globalAlpha = 1;
    } else if (this.stuck && !this.clearAt) {
      FX.glass(ctx, cs * 0.5, cs * 6.5, W - cs * 1, cs * 0.85, cs * 0.3, 'rgba(255,120,140,0.6)');
      FX.text(ctx, '막혔어요! 되돌리기·시험관+1·처음부터', W / 2, cs * 7.05, { size: cs * 0.32, weight: 800, color: '#FFD1DA', align: 'center' });
    }
    if (this.clearAt) {
      const k = Math.min(1, (1500 - (this.clearAt - now)) / 250);
      ctx.save(); ctx.globalAlpha = k; ctx.translate(W / 2, cs * 6.95); ctx.scale(0.8 + 0.2 * FX.ease.outBack(k), 0.8 + 0.2 * FX.ease.outBack(k));
      FX.glass(ctx, -cs * 3.3, -cs * 0.65, cs * 6.6, cs * 1.3, cs * 0.4, 'rgba(255,209,102,0.8)');
      FX.text(ctx, '단계 완료!  +' + (this.lastGain || 0), 0, cs * 0.18, { size: cs * 0.55, weight: 800, color: '#FFD166', align: 'center' });
      ctx.restore();
    }
    if (this.gameOver) {
      ctx.fillStyle = 'rgba(8,10,20,0.7)'; ctx.fillRect(0, 0, W, H);
      FX.text(ctx, '시간 끝!', W / 2, H * 0.4, { size: cs * 1.0, weight: 900, color: '#fff', align: 'center', stroke: 'rgba(0,0,0,0.5)' });
      FX.text(ctx, this.solved + '단계 풀었어요', W / 2, H * 0.4 + cs * 1.0, { size: cs * 0.5, weight: 700, color: '#BFD0FF', align: 'center' });
      FX.text(ctx, this.score + '점', W / 2, H * 0.4 + cs * 1.8, { size: cs * 0.7, weight: 800, color: '#FFD166', align: 'center' });
    }
  }
}
if (typeof window !== 'undefined') window.WaterSortGame = WaterSortGame;
