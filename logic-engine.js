// 두뇌 퍼즐 (스도쿠·네모로직) — 유일해가 보장되는 퍼즐을 그때그때 만들어 8분 동안 점수를 모읍니다.
// 스도쿠: 완성판 → 칸을 하나씩 비우며 해가 하나인지 검사. 네모로직: 대칭·덩어리 그림 → 줄 단위 풀이기로 풀리는 것만.

const LP_COLS = 10, LP_ROWS = 14, LP_TIME = 8 * 60 * 1000;
const LP_INK = '#2B2D42', LP_ACC = '#4361EE', LP_RED = '#EF476F', LP_PAPER = '#FFFDF8';
const LP_FONT = 'Pretendard, sans-serif';
// 종류별 난이도 설정 (기본점 × 난이도 + 시간 보너스 − 실수 감점)
const LP_SDK = [{ N: 6, bw: 3, bh: 2, givens: 15, par: 150, label: '쉬움', size: '6×6' },
                { N: 9, bw: 3, bh: 3, givens: 34, par: 360, label: '보통', size: '9×9' },
                { N: 9, bw: 3, bh: 3, givens: 25, par: 480, label: '어려움', size: '9×9' }];
const LP_NONO = [{ n: 5, par: 45, label: '쉬움', size: '5×5' },
                 { n: 8, par: 120, label: '보통', size: '8×8' },
                 { n: 10, par: 200, label: '어려움', size: '10×10' }];
const LP_BASE = { sudoku: 120, nono: 70 }, LP_PEN = 15;

const LPgen = {
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; } return a; },
  popc(m) { let c = 0; while (m) { m &= m - 1; c++; } return c; },

  // ── 스도쿠 ──
  // 해 개수를 limit 까지 셉니다 (g 를 직접 바꿈). rnd 면 후보를 섞어 첫 해를 g 에 남김
  sdkSolve(g, N, bw, bh, limit, rnd) {
    const NN = N * N, R = new Int32Array(N), C = new Int32Array(N), B = new Int32Array(N), full = (1 << (N + 1)) - 2;
    const ro = new Int8Array(NN), co = new Int8Array(NN), bo = new Int8Array(NN), per = N / bw;
    for (let i = 0; i < NN; i++) { ro[i] = i / N | 0; co[i] = i % N; bo[i] = (ro[i] / bh | 0) * per + (co[i] / bw | 0); }
    for (let i = 0; i < NN; i++) { const v = g[i]; if (!v) continue; const b = 1 << v;
      if ((R[ro[i]] | C[co[i]] | B[bo[i]]) & b) return 0; R[ro[i]] |= b; C[co[i]] |= b; B[bo[i]] |= b; }
    let count = 0;
    const rec = () => {
      let best = -1, bm = 0, bc = 99;
      for (let i = 0; i < NN; i++) { if (g[i]) continue; const m = full & ~(R[ro[i]] | C[co[i]] | B[bo[i]]); const k = LPgen.popc(m);
        if (k < bc) { bc = k; best = i; bm = m; if (k <= 1) break; } }
      if (best < 0) { count++; return count >= limit; }
      if (bc === 0) return false;
      const ds = []; for (let v = 1; v <= N; v++) if (bm & (1 << v)) ds.push(v);
      if (rnd) LPgen.shuffle(ds);
      const r = ro[best], c = co[best], b = bo[best];
      for (const v of ds) { const bit = 1 << v; R[r] |= bit; C[c] |= bit; B[b] |= bit; g[best] = v;
        if (rec()) return true;
        R[r] &= ~bit; C[c] &= ~bit; B[b] &= ~bit; g[best] = 0; }
      return false;
    };
    rec();
    return count;
  },
  sdkMake(cfg) {
    const { N, bw, bh, givens } = cfg, NN = N * N, t0 = Date.now();
    const sol = new Array(NN).fill(0); LPgen.sdkSolve(sol, N, bw, bh, 1, true);
    const p = sol.slice(); let left = NN;
    for (const i of LPgen.shuffle([...Array(NN).keys()])) {
      if (left <= givens || Date.now() - t0 > 240) break;       // 시간 예산 안에서 최대한 비우기
      const v = p[i]; p[i] = 0;
      if (LPgen.sdkSolve(p.slice(), N, bw, bh, 2, false) !== 1) p[i] = v; else left--;
    }
    return { sol, puz: p, givens: left };
  },

  // ── 네모로직 ──
  clues(line) { const out = []; let run = 0; for (const v of line) { if (v) run++; else if (run) { out.push(run); run = 0; } } if (run) out.push(run); return out; },
  // 줄 하나 풀기: cells -1 모름 / 0 빈칸 / 1 칠함. 모순이면 null
  lineSolve(cells, clues) {
    const n = cells.length, k = clues.length, canF = new Uint8Array(n), canE = new Uint8Array(n), starts = new Int32Array(k);
    const rest = new Int32Array(k + 1); for (let j = k - 1; j >= 0; j--) rest[j] = clues[j] + (j < k - 1 ? 1 : 0) + rest[j + 1];
    let found = false;
    const rec = (j, pos) => {
      if (j === k) {
        for (let i = pos; i < n; i++) if (cells[i] === 1) return;
        found = true; let p = 0;
        for (let t = 0; t < k; t++) { for (; p < starts[t]; p++) canE[p] = 1; for (let e = 0; e < clues[t]; e++, p++) canF[p] = 1; }
        for (; p < n; p++) canE[p] = 1;
        return;
      }
      const len = clues[j];
      for (let s = pos; s + rest[j] <= n; s++) {
        if (s > pos && cells[s - 1] === 1) break;
        let ok = true; for (let e = s; e < s + len; e++) if (cells[e] === 0) { ok = false; break; }
        if (!ok || (s + len < n && cells[s + len] === 1)) continue;
        starts[j] = s; rec(j + 1, Math.min(n, s + len + 1));
      }
    };
    rec(0, 0);
    if (!found) return null;
    const out = cells.slice();
    for (let i = 0; i < n; i++) if (out[i] < 0) { if (canF[i] && !canE[i]) out[i] = 1; else if (canE[i] && !canF[i]) out[i] = 0; }
    return out;
  },
  // 줄 단위로만 풀어서 다 풀리면 true (= 해가 하나뿐)
  nonoSolve(n, rc, cc) {
    const g = new Int8Array(n * n).fill(-1); let changed = true;
    while (changed) {
      changed = false;
      for (let r = 0; r < n; r++) { const line = []; for (let c = 0; c < n; c++) line.push(g[r * n + c]);
        if (line.indexOf(-1) < 0) continue; const o = LPgen.lineSolve(line, rc[r]); if (!o) return false;
        for (let c = 0; c < n; c++) if (o[c] !== line[c]) { g[r * n + c] = o[c]; changed = true; } }
      for (let c = 0; c < n; c++) { const line = []; for (let r = 0; r < n; r++) line.push(g[r * n + c]);
        if (line.indexOf(-1) < 0) continue; const o = LPgen.lineSolve(line, cc[c]); if (!o) return false;
        for (let r = 0; r < n; r++) if (o[r] !== line[r]) { g[r * n + c] = o[r]; changed = true; } }
    }
    return g.indexOf(-1) < 0;
  },
  // 대칭 + 덩어리 그림
  nonoPic(n) {
    const g = new Uint8Array(n * n), p = 0.48 + Math.random() * 0.14, s = Math.random();
    const sym = s < 0.45 ? 'lr' : s < 0.62 ? 'both' : s < 0.78 ? 'rot' : s < 0.92 ? 'ud' : 'none';
    const mirror = () => { for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { const i = r * n + c;
      if (sym === 'lr' && c >= n / 2) g[i] = g[r * n + (n - 1 - c)];
      else if (sym === 'ud' && r >= n / 2) g[i] = g[(n - 1 - r) * n + c];
      else if (sym === 'both' && (r >= n / 2 || c >= n / 2)) g[i] = g[Math.min(r, n - 1 - r) * n + Math.min(c, n - 1 - c)];
      else if (sym === 'rot' && (r * n + c) >= n * n / 2) g[i] = g[(n - 1 - r) * n + (n - 1 - c)]; } };
    for (let i = 0; i < n * n; i++) g[i] = Math.random() < p ? 1 : 0;
    mirror();
    const t = new Uint8Array(n * n);
    for (let it = 0; it < (n >= 8 ? 2 : 1); it++) {
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) { let k = 0;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const y = r + dr, x = c + dc; if (y >= 0 && y < n && x >= 0 && x < n) k += g[y * n + x]; }
        t[r * n + c] = k >= 5 ? 1 : k <= 3 ? 0 : g[r * n + c]; }
      g.set(t); mirror();
    }
    return g;
  },
  nonoMake(cfg) {
    const n = cfg.n; let tries = 0;
    while (true) {
      tries++;
      const g = LPgen.nonoPic(n); let fill = 0; for (const v of g) fill += v;
      const d = fill / (n * n); if (d < 0.36 || d > 0.72) continue;
      const rc = [], cc = []; let empty = 0;
      for (let r = 0; r < n; r++) { const l = []; for (let c = 0; c < n; c++) l.push(g[r * n + c]); rc.push(LPgen.clues(l)); if (!rc[r].length) empty++; }
      for (let c = 0; c < n; c++) { const l = []; for (let r = 0; r < n; r++) l.push(g[r * n + c]); cc.push(LPgen.clues(l)); if (!cc[c].length) empty++; }
      if (empty > (n <= 5 ? 0 : 1) && tries < 300) continue;
      if (LPgen.nonoSolve(n, rc, cc)) return { sol: Array.from(g), rc, cc, tries };
      if (tries > 2000) return null;
    }
  }
};

class LogicPuzzleGame {
  constructor(canvas, cellSize) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.cellSize = cellSize;
    this.score = 0; this.gameOver = false; this.solved = 0; this.mistakes = 0;
    this.screen = 'menu'; this.kind = 'sudoku'; this.diff = 0; this.pz = null; this.saved = {};
    this.timeLeft = LP_TIME; this.timerOn = false; this.lastTime = 0; this.now = 0; this.age = 0;
    this.focus = 'm:sudoku:1'; this.kbd = false; this.sel = -1; this.memo = false; this.nonoMode = 'fill';
    this.cel = null; this.parts = []; this.pops = []; this.hintT = 0; this.hinted = {}; this.shakeCell = null;
    this.flashLines = []; this._sd = false; this._sdT = 0; this.lastTap = { key: '', t: -1e9 };
  }

  // ── 조작 ──
  move(dir) { this.kbd = true; this.nav(dir, 0); }
  up() { this.kbd = true; this.nav(0, -1); }
  down() { this.kbd = true; this.nav(0, 1); }
  rotate() { if (this.screen !== 'play') return; if (this.kind === 'sudoku') this.memo = !this.memo; else this.nonoMode = this.nonoMode === 'fill' ? 'x' : 'fill'; }
  softDrop() {}                                           // ↓ 는 tick 에서 softDropping 으로 감지
  hardDrop() { this.kbd = true; if (this.gameOver || this.cel) return; const it = this.items().find(i => i.key === this.focus); if (it) it.act(); }
  tapAt(x, y) {
    if (this.gameOver || this.cel) return;
    const it = this.items().find(i => x >= i.x && x < i.x + i.w && y >= i.y && y < i.y + i.h);
    if (!it) return;
    if (it.key === this.lastTap.key && this.now - this.lastTap.t < 70) return;   // 한 번 톡이 두 번 들어오는 것 막기
    this.lastTap = { key: it.key, t: this.now };
    this.kbd = false; this.focus = it.key; it.act();
  }
  // 화살표: 지금 초점에서 그 방향으로 가장 가까운 버튼/칸으로
  nav(dx, dy) {
    if (this.gameOver || this.cel) return;
    const items = this.items(); if (!items.length) return;
    const cur = items.find(i => i.key === this.focus);
    if (!cur) { this.setFocus(items[0]); return; }
    const cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2; let best = null, bd = 1e9;
    for (const it of items) { if (it === cur) continue;
      const ix = it.x + it.w / 2, iy = it.y + it.h / 2, pr = (ix - cx) * dx + (iy - cy) * dy;
      if (pr <= 0.05) continue;
      const d = pr + (dx ? Math.abs(iy - cy) : Math.abs(ix - cx)) * 3;
      if (d < bd) { bd = d; best = it; } }
    if (best) { this.setFocus(best); if (window.Sound) Sound.move(); }
  }
  setFocus(it) { this.focus = it.key; if (this.screen === 'play' && this.kind === 'sudoku' && it.cell != null) this.sel = it.cell; }

  // 누를 수 있는 모든 것 (칸 단위 사각형)
  items() {
    const out = [];
    if (this.screen === 'menu') {
      ['sudoku', 'nono'].forEach((k, ki) => { for (let d = 0; d < 3; d++)
        out.push({ key: 'm:' + k + ':' + d, x: 0.75 + d * 2.9, y: (ki ? 8.3 : 3.3) + 2.25, w: 2.7, h: 1.85, act: () => this.start(k, d) }); });
      return out;
    }
    const g = this.geo, P = this.pz;
    if (this.kind === 'sudoku') {
      for (let i = 0; i < P.N * P.N; i++) out.push({ key: 'c:' + i, cell: i, x: g.x + (i % P.N) * g.cell, y: g.y + (i / P.N | 0) * g.cell, w: g.cell, h: g.cell, act: () => { this.sel = i; if (window.Sound) Sound.move(); } });
      const bw = 9.2 / P.N;
      for (let v = 1; v <= P.N; v++) out.push({ key: 'p:' + v, x: 0.4 + (v - 1) * bw, y: 11.3, w: bw, h: 1.1, act: () => this.input(v) });
      out.push({ key: 't:memo', x: 0.4, y: 12.6, w: 3.6, h: 1.15, act: () => { this.memo = !this.memo; if (window.Sound) Sound.move(); } });
      out.push({ key: 't:erase', x: 4.1, y: 12.6, w: 3.0, h: 1.15, act: () => this.erase() });
      out.push({ key: 't:menu', x: 7.2, y: 12.6, w: 2.4, h: 1.15, act: () => this.toMenu() });
    } else {
      for (let i = 0; i < P.n * P.n; i++) out.push({ key: 'c:' + i, cell: i, x: g.gx + (i % P.n) * g.u, y: g.gy + (i / P.n | 0) * g.u, w: g.u, h: g.u, act: () => this.nonoTap(i) });
      out.push({ key: 't:fill', x: 0.4, y: 11.4, w: 3.7, h: 1.3, act: () => { this.nonoMode = 'fill'; if (window.Sound) Sound.move(); } });
      out.push({ key: 't:x', x: 4.2, y: 11.4, w: 3.0, h: 1.3, act: () => { this.nonoMode = 'x'; if (window.Sound) Sound.move(); } });
      out.push({ key: 't:menu', x: 7.3, y: 11.4, w: 2.3, h: 1.3, act: () => this.toMenu() });
    }
    return out;
  }

  // ── 진행 ──
  start(kind, diff) {
    this.kind = kind; this.diff = diff; this.screen = 'play'; this.timerOn = true;
    const k = kind + diff;
    if (this.saved[k]) { this.pz = this.saved[k]; delete this.saved[k]; this.layout(); }
    else this.newPuzzle();
    if (!this.hinted[kind]) { this.hinted[kind] = 1; this.hintT = 3200; }
    if (window.Sound) Sound.start();
  }
  toMenu() { if (this.pz) this.saved[this.kind + this.diff] = this.pz; this.pz = null; this.screen = 'menu'; this.focus = 'm:' + this.kind + ':' + this.diff; if (window.Sound) Sound.move(); }
  newPuzzle() {
    const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
    if (this.kind === 'sudoku') {
      const cfg = LP_SDK[this.diff], m = LPgen.sdkMake(cfg);
      this.pz = { N: cfg.N, bw: cfg.bw, bh: cfg.bh, sol: m.sol, given: m.puz.map(v => v > 0), val: m.puz.slice(), notes: new Array(cfg.N * cfg.N).fill(0), elapsed: 0, miss: 0 };
      this.sel = this.pz.val.indexOf(0); this.focus = 'c:' + this.sel;
    } else {
      const cfg = LP_NONO[this.diff], m = LPgen.nonoMake(cfg);
      this.pz = { n: cfg.n, sol: m.sol, rc: m.rc, cc: m.cc, st: new Array(cfg.n * cfg.n).fill(0), wrong: new Array(cfg.n * cfg.n).fill(false), done: { r: [], c: [] }, elapsed: 0, miss: 0 };
      this.focus = 'c:0';
    }
    this.genMs = (typeof performance !== 'undefined' ? performance : Date).now() - t0;
    this.layout();
  }
  layout() {
    const P = this.pz;
    if (this.kind === 'sudoku') { this.geo = { x: 0.4, y: 1.85, cell: 9.2 / P.N }; return; }
    let cw = 1, ch = 1; P.rc.forEach(c => cw = Math.max(cw, c.length)); P.cc.forEach(c => ch = Math.max(ch, c.length));
    const k = 0.56, n = P.n, u = Math.min(9.2 / (n + cw * k + 0.2), 9.2 / (n + ch * k + 0.2));
    const tw = cw * k * u + n * u, th = ch * k * u + n * u;
    this.geo = { u, cw, ch, k, gx: 0.4 + (9.2 - tw) / 2 + cw * k * u, gy: 1.85 + (9.2 - th) / 2 + ch * k * u };
  }

  // 스도쿠 숫자 넣기
  input(v) {
    const P = this.pz, i = this.sel; if (i < 0 || P.given[i]) { if (window.Sound) Sound.bump(); return; }
    if (this.memo) { if (P.val[i]) return; P.notes[i] ^= 1 << v; if (window.Sound) Sound.note(520 + v * 40, 0.05, 'sine', 0.12); return; }
    if (P.val[i] === v) return;
    P.val[i] = v; P.notes[i] = 0;
    const c = this.cellCenter(i);
    if (v !== P.sol[i]) {
      P.miss++; this.mistakes++; this.shakeCell = { i, t: 400 };
      this.pops.push({ text: '실수 −' + LP_PEN, x: c.x, y: c.y, color: LP_RED, t: 0 });
      if (window.Sound) Sound.bump(); return;
    }
    // 같은 행·열·상자 메모에서 그 숫자 지우기
    const N = P.N, r = i / N | 0, cc = i % N, br = (r / P.bh | 0) * P.bh, bc = (cc / P.bw | 0) * P.bw;
    for (let j = 0; j < N * N; j++) { const rr = j / N | 0, c2 = j % N;
      if (rr === r || c2 === cc || (rr >= br && rr < br + P.bh && c2 >= bc && c2 < bc + P.bw)) P.notes[j] &= ~(1 << v); }
    if (window.Sound) Sound.note(440 + v * 55, 0.09, 'triangle', 0.18);
    // 줄·상자 완성 반짝
    const ok = idx => idx.every(j => P.val[j] === P.sol[j]);
    const row = [], col = [], box = [];
    for (let t = 0; t < N; t++) { row.push(r * N + t); col.push(t * N + cc); box.push((br + (t / P.bw | 0)) * N + bc + t % P.bw); }
    [row, col, box].forEach(l => { if (ok(l)) this.flashLines.push({ cells: l, t: 0 }); });
    if (P.val.every((x, j) => x === P.sol[j])) this.win();
  }
  erase() { const P = this.pz, i = this.sel; if (i < 0 || P.given[i]) return; P.val[i] = 0; P.notes[i] = 0; if (window.Sound) Sound.move(); }

  // 네모로직 칸 톡
  nonoTap(i) {
    const P = this.pz, n = P.n;
    if (P.wrong[i] || P.st[i] === 1) return;
    if (this.nonoMode === 'x') { P.st[i] = P.st[i] === 2 ? 0 : 2; if (window.Sound) Sound.move(); return; }
    if (P.st[i] === 2) { P.st[i] = 0; if (window.Sound) Sound.move(); return; }
    if (!P.sol[i]) {
      P.st[i] = 2; P.wrong[i] = true; P.miss++; this.mistakes++; this.shakeCell = { i, t: 400 };
      const c = this.cellCenter(i); this.pops.push({ text: '실수 −' + LP_PEN, x: c.x, y: c.y, color: LP_RED, t: 0 });
      if (window.Sound) Sound.bump();
    } else {
      P.st[i] = 1; if (window.Sound) Sound.note(392 + ((i % n) + (i / n | 0)) * 22, 0.06, 'triangle', 0.16);
    }
    this.nonoCheckLines(i);
    if (P.sol.every((v, j) => !v || P.st[j] === 1)) this.win();
  }
  nonoCheckLines(i) {
    const P = this.pz, n = P.n, r = i / n | 0, c = i % n;
    const fin = idx => { if (!idx.every(j => !P.sol[j] || P.st[j] === 1)) return false; idx.forEach(j => { if (!P.st[j]) P.st[j] = 2; }); return true; };
    const row = [], col = []; for (let t = 0; t < n; t++) { row.push(r * n + t); col.push(t * n + c); }
    if (!P.done.r[r] && fin(row)) { P.done.r[r] = 1; this.flashLines.push({ cells: row, t: 0 }); }
    if (!P.done.c[c] && fin(col)) { P.done.c[c] = 1; this.flashLines.push({ cells: col, t: 0 }); }
    // 빈 줄(힌트 0)은 처음부터 완성 취급
  }
  cellCenter(i) {
    const g = this.geo;
    if (this.kind === 'sudoku') { const N = this.pz.N; return { x: g.x + (i % N + 0.5) * g.cell, y: g.y + ((i / N | 0) + 0.5) * g.cell }; }
    const n = this.pz.n; return { x: g.gx + (i % n + 0.5) * g.u, y: g.gy + ((i / n | 0) + 0.5) * g.u };
  }
  win() {
    const P = this.pz, cfg = this.kind === 'sudoku' ? LP_SDK[this.diff] : LP_NONO[this.diff];
    const secs = P.elapsed / 1000, base = (this.diff + 1) * LP_BASE[this.kind];
    const bonus = Math.max(0, Math.round((cfg.par - secs) * 1.5)), pen = P.miss * LP_PEN;
    const pts = Math.max(10, base + bonus - pen);
    this.score += pts; this.solved++;
    this.cel = { t: 0, dur: 2300, pts, base, bonus, pen, secs };
    const cols = ['#4CC9F0', '#4361EE', '#F79824', '#FFD166', '#06D6A0', '#B15DFF', '#EF476F'];
    for (let k = 0; k < 70; k++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, v = 0.12 + Math.random() * 0.2;
      this.parts.push({ x: 5, y: 7, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.006, l: 1.6, c: cols[k % 7], s: 4 + (k % 3) * 2, rot: Math.random() * 6 }); }
    if (window.Sound) Sound.finish();
  }

  tick(now) {
    const { dt, f } = FX.frame(this, now); this.age += dt;
    if (!this.gameOver) {
      if (this.timerOn) { this.timeLeft -= dt; if (this.timeLeft <= 0) { this.timeLeft = 0; this.gameOver = true; if (window.Sound) Sound.gameOver(); } }
      if (this.screen === 'play' && this.pz && !this.cel) this.pz.elapsed += dt;
      // ↓ 키: 누르는 순간 한 칸, 오래 누르면 반복
      if (this.softDropping) { if (!this._sd) { this._sdT = 0; this.down(); } else { this._sdT += dt; if (this._sdT > 380) { this._sdT -= 110; this.down(); } } }
      this._sd = !!this.softDropping;
      if (this.cel) { this.cel.t += dt; if (this.cel.t >= this.cel.dur) { this.cel = null; this.newPuzzle(); } }
    }
    if (this.hintT > 0) this.hintT -= dt;
    if (this.shakeCell) { this.shakeCell.t -= dt; if (this.shakeCell.t <= 0) this.shakeCell = null; }
    for (let k = this.flashLines.length - 1; k >= 0; k--) { this.flashLines[k].t += dt; if (this.flashLines[k].t > 600) this.flashLines.splice(k, 1); }
    for (let k = this.pops.length - 1; k >= 0; k--) { this.pops[k].t += dt / 900; if (this.pops[k].t >= 1) this.pops.splice(k, 1); }
    if (this.parts.length) { for (const p of this.parts) { p.x += p.vx * f; p.y += p.vy * f; p.vy += p.g * f; p.vx *= Math.pow(0.985, f); p.rot += 0.15 * f; p.l -= 0.012 * f; } this.parts = this.parts.filter(p => p.l > 0); }
    this.draw();
  }

  getSnapshot() {
    const g = Array.from({ length: LP_ROWS }, () => Array(LP_COLS).fill(0));
    const k = Math.ceil(this.timeLeft / LP_TIME * LP_COLS);
    for (let c = 0; c < k; c++) g[0][c] = this.timeLeft < 60000 ? 11 : 23;
    for (let c = 0; c < Math.min(LP_COLS, this.solved); c++) g[LP_ROWS - 1][c] = 24;
    const P = this.pz; if (this.screen !== 'play' || !P) return g;
    if (this.kind === 'sudoku') {
      const o = Math.floor((LP_COLS - P.N) / 2);
      for (let i = 0; i < P.N * P.N; i++) { const r = 1 + (i / P.N | 0), c = o + i % P.N, v = P.val[i];
        g[r][c] = P.given[i] ? 12 : !v ? 21 : v === P.sol[i] ? 25 : 11; }
    } else {
      const o = Math.floor((LP_COLS - P.n) / 2);
      for (let i = 0; i < P.n * P.n; i++) { const r = 1 + (i / P.n | 0), c = o + i % P.n;
        g[r][c] = P.st[i] === 1 ? 2 : P.wrong[i] ? 11 : 22; }
    }
    return g;
  }

  // ── 그리기 ──
  draw() {
    const ctx = this.ctx, cs = this.cellSize, W = LP_COLS * cs, H = LP_ROWS * cs;
    this.drawBg(ctx, W, H, cs);
    if (this.screen === 'menu') this.drawMenu(ctx, cs);
    else {
      this.drawHeader(ctx, cs);
      if (this.kind === 'sudoku') { this.drawSudoku(ctx, cs); this.drawSdkPad(ctx, cs); } else { this.drawNono(ctx, cs); this.drawNonoTools(ctx, cs); }
    }
    // 키보드 초점 테두리
    if (this.kbd && !this.cel && !this.gameOver) { const it = this.items().find(i => i.key === this.focus);
      if (it) { ctx.strokeStyle = '#F79824'; ctx.lineWidth = 3; FX.rr(ctx, it.x * cs + 1.5, it.y * cs + 1.5, it.w * cs - 3, it.h * cs - 3, cs * 0.12); ctx.stroke(); } }
    // 점수·실수 팝업
    for (const p of this.pops) { ctx.globalAlpha = 1 - p.t; FX.text(ctx, p.text, p.x * cs, (p.y - FX.ease.outCubic(p.t) * 1.2) * cs, { size: cs * 0.42, weight: 800, color: p.color, align: 'center', stroke: '#fff', strokeW: 4 }); }
    ctx.globalAlpha = 1;
    if (this.cel) this.drawCelebrate(ctx, cs, W, H);
    for (const p of this.parts) { ctx.globalAlpha = Math.min(1, p.l); ctx.fillStyle = p.c; const w = p.s, h = p.s * (0.4 + 0.6 * Math.abs(Math.cos(p.rot))); ctx.fillRect(p.x * cs - w / 2, p.y * cs - h / 2, w, h); }
    ctx.globalAlpha = 1;
    if (this.hintT > 0 && this.screen === 'play' && !this.gameOver) {
      ctx.globalAlpha = Math.min(1, this.hintT / 500);
      const msg = this.kind === 'sudoku' ? '빈칸 톡 → 아래 숫자 톡' : '숫자만큼 칸을 톡! 이어진 칸 덩어리';
      ctx.fillStyle = 'rgba(43,45,66,0.86)'; FX.rr(ctx, W / 2 - 4.3 * cs, 6.0 * cs, 8.6 * cs, 1.2 * cs, cs * 0.6); ctx.fill();
      FX.text(ctx, msg, W / 2, 6.6 * cs, { size: cs * 0.42, weight: 800, color: '#fff', align: 'center', baseline: 'middle' });
      ctx.globalAlpha = 1;
    }
    if (this.gameOver) this.drawOver(ctx, cs, W, H);
  }

  drawBg(ctx, W, H, cs) {
    if (!this._bg || this._bg.width !== Math.ceil(W) || this._bgCs !== cs) {
      const c = document.createElement('canvas'); c.width = Math.ceil(W); c.height = Math.ceil(H); const g = c.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#F6F1E7'); gr.addColorStop(1, '#E7DECC'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(120,95,60,0.07)';                // 종이 결 점무늬
      for (let y = cs * 0.25; y < H; y += cs * 0.5) for (let x = ((y / (cs * 0.5)) % 2) * cs * 0.25; x < W; x += cs * 0.5) g.fillRect(x, y, 1.5, 1.5);
      this._bg = c; this._bgCs = cs;
    }
    ctx.drawImage(this._bg, 0, 0, W, H);
  }
  card(ctx, x, y, w, h, r, fill) {
    ctx.fillStyle = 'rgba(90,65,30,0.14)'; FX.rr(ctx, x, y + 3, w, h, r); ctx.fill();
    ctx.fillStyle = fill || LP_PAPER; FX.rr(ctx, x, y, w, h, r); ctx.fill();
    ctx.strokeStyle = 'rgba(120,100,70,0.22)'; ctx.lineWidth = 1; ctx.stroke();
  }
  fmt(ms) { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

  drawMenu(ctx, cs) {
    const W = LP_COLS * cs;
    FX.text(ctx, '두뇌 퍼즐', W / 2, 1.55 * cs, { size: cs * 0.95, weight: 900, color: LP_INK, align: 'center' });
    FX.text(ctx, this.timerOn ? '남은 시간 ' + this.fmt(this.timeLeft) + ' · 점수 ' + this.score : '제한 시간 8분 · 많이 풀수록 높은 점수', W / 2, 2.4 * cs, { size: cs * 0.36, weight: 700, color: '#7A6E5D', align: 'center' });
    const sets = [['sudoku', '스도쿠', '가로·세로·상자에 숫자가 한 번씩', LP_SDK, '#4361EE'], ['nono', '네모로직', '숫자 힌트대로 칠해 그림 완성', LP_NONO, '#06A77D']];
    sets.forEach(([k, name, sub, cfgs, col], ki) => {
      const y0 = (ki ? 8.3 : 3.3) * cs;
      this.card(ctx, 0.5 * cs, y0, 9 * cs, 4.35 * cs, cs * 0.35);
      ctx.fillStyle = col; FX.rr(ctx, 0.5 * cs, y0 + cs * 0.3, cs * 0.14, cs * 1.4, cs * 0.07); ctx.fill();
      FX.text(ctx, name, 0.95 * cs, y0 + 1.05 * cs, { size: cs * 0.66, weight: 900, color: LP_INK });
      FX.text(ctx, sub, 0.95 * cs, y0 + 1.7 * cs, { size: cs * 0.32, weight: 600, color: '#8A7F6E' });
      this.drawIcon(ctx, k, 7.35 * cs, y0 + 0.35 * cs, 1.55 * cs, col);
      cfgs.forEach((cf, d) => {
        const x = (0.75 + d * 2.9) * cs, y = y0 + 2.25 * cs, w = 2.7 * cs, h = 1.85 * cs;
        const gr = ctx.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, FX.tint(col, 0.86 - d * 0.1)); gr.addColorStop(1, FX.tint(col, 0.74 - d * 0.1));
        ctx.fillStyle = FX.tint(col, -0.25); FX.rr(ctx, x, y + 3, w, h, cs * 0.25); ctx.fill();
        ctx.fillStyle = gr; FX.rr(ctx, x, y, w, h, cs * 0.25); ctx.fill();
        FX.text(ctx, cf.label, x + w / 2, y + 0.8 * cs, { size: cs * 0.46, weight: 900, color: FX.tint(col, -0.45), align: 'center' });
        FX.text(ctx, cf.size, x + w / 2, y + 1.35 * cs, { size: cs * 0.34, weight: 700, color: FX.tint(col, -0.3), align: 'center' });
        for (let s = 0; s <= d; s++) { ctx.fillStyle = FX.tint(col, -0.1); ctx.beginPath(); ctx.arc(x + w / 2 + (s - d / 2) * cs * 0.28, y + 1.62 * cs, cs * 0.07, 0, 6.29); ctx.fill(); }
        if (this.saved[k + d]) { ctx.fillStyle = '#F79824'; FX.rr(ctx, x + w - 1.15 * cs, y - 0.2 * cs, 1.25 * cs, 0.5 * cs, cs * 0.25); ctx.fill();
          FX.text(ctx, '이어서', x + w - 0.52 * cs, y + 0.05 * cs, { size: cs * 0.26, weight: 800, color: '#fff', align: 'center', baseline: 'middle' }); }
      });
    });
    const pulse = 0.6 + 0.4 * Math.sin(this.age / 300);
    if (!this.timerOn) { ctx.globalAlpha = pulse; FX.text(ctx, '원하는 퍼즐을 톡! 고르면 시간이 흘러요', W / 2, 13.35 * cs, { size: cs * 0.36, weight: 800, color: LP_INK, align: 'center' }); ctx.globalAlpha = 1; }
    else FX.text(ctx, '종류를 바꿔도 시간은 계속 흘러요', W / 2, 13.35 * cs, { size: cs * 0.34, weight: 700, color: '#8A7F6E', align: 'center' });
  }
  drawIcon(ctx, k, x, y, s, col) {
    ctx.fillStyle = '#fff'; FX.rr(ctx, x, y, s, s, s * 0.12); ctx.fill(); ctx.strokeStyle = LP_INK; ctx.lineWidth = 2; ctx.stroke();
    const q = s / 3;
    if (k === 'sudoku') {
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(43,45,66,0.35)';
      for (let t = 1; t < 3; t++) { ctx.beginPath(); ctx.moveTo(x + t * q, y); ctx.lineTo(x + t * q, y + s); ctx.moveTo(x, y + t * q); ctx.lineTo(x + s, y + t * q); ctx.stroke(); }
      ctx.font = '800 ' + Math.round(q * 0.7) + 'px ' + LP_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      [[0, 0, '5', LP_INK], [1, 1, '3', col], [2, 0, '9', LP_INK], [2, 2, '1', col], [0, 2, '7', LP_INK]].forEach(([c, r, t, cl]) => { ctx.fillStyle = cl; ctx.fillText(t, x + (c + 0.5) * q, y + (r + 0.55) * q); });
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    } else {
      const m = [1, 0, 1, 1, 1, 1, 0, 1, 0]; const p = s / 3;
      m.forEach((v, i) => { if (v) { ctx.fillStyle = col; FX.rr(ctx, x + (i % 3) * p + 2, y + (i / 3 | 0) * p + 2, p - 4, p - 4, 3); ctx.fill(); } });
    }
  }

  drawHeader(ctx, cs) {
    const x = 0.3 * cs, y = 0.25 * cs, w = 9.4 * cs, h = 1.35 * cs;
    this.card(ctx, x, y, w, h, cs * 0.3);
    const cfg = this.kind === 'sudoku' ? LP_SDK[this.diff] : LP_NONO[this.diff];
    FX.text(ctx, this.kind === 'sudoku' ? '스도쿠' : '네모로직', x + 0.35 * cs, y + 0.6 * cs, { size: cs * 0.4, weight: 900, color: LP_INK });
    FX.text(ctx, cfg.label + ' ' + cfg.size + ' · ' + (this.solved) + '개 풂', x + 0.35 * cs, y + 1.05 * cs, { size: cs * 0.28, weight: 700, color: '#8A7F6E' });
    const low = this.timeLeft < 60000, cx = 5 * cs;
    FX.text(ctx, this.fmt(this.timeLeft), cx, y + 0.78 * cs, { size: cs * 0.62, weight: 900, color: low ? LP_RED : LP_INK, align: 'center' });
    const bw = 2.2 * cs; ctx.fillStyle = '#EDE5D6'; FX.rr(ctx, cx - bw / 2, y + 1.0 * cs, bw, cs * 0.14, cs * 0.07); ctx.fill();
    ctx.fillStyle = low ? LP_RED : '#F79824'; FX.rr(ctx, cx - bw / 2, y + 1.0 * cs, Math.max(2, bw * this.timeLeft / LP_TIME), cs * 0.14, cs * 0.07); ctx.fill();
    FX.text(ctx, String(this.score), x + w - 0.35 * cs, y + 0.68 * cs, { size: cs * 0.5, weight: 900, color: LP_ACC, align: 'right' });
    const miss = this.pz ? this.pz.miss : 0;
    FX.text(ctx, '점수 · 실수 ' + miss, x + w - 0.35 * cs, y + 1.08 * cs, { size: cs * 0.26, weight: 700, color: miss ? LP_RED : '#8A7F6E', align: 'right' });
  }

  drawSudoku(ctx, cs) {
    const P = this.pz, N = P.N, g = this.geo, s = g.cell * cs, x0 = g.x * cs, y0 = g.y * cs, S = s * N;
    this.card(ctx, x0 - 5, y0 - 5, S + 10, S + 10, cs * 0.25);
    const sel = this.sel, sv = sel >= 0 ? P.val[sel] : 0, sr = sel / N | 0, sc = sel % N;
    const boxOf = i => ((i / N | 0) / P.bh | 0) * 10 + ((i % N) / P.bw | 0), sb = sel >= 0 ? boxOf(sel) : -1;
    const celK = this.cel ? this.cel.t / 900 : -1;
    for (let i = 0; i < N * N; i++) {
      const r = i / N | 0, c = i % N, v = P.val[i], bad = v && v !== P.sol[i];
      let bg = null;
      if (sel >= 0 && (r === sr || c === sc || boxOf(i) === sb)) bg = '#EEF1F8';
      if (sv && v === sv && sv === P.sol[sel]) bg = '#D6E1FF';
      if (bad) bg = '#FFE1E7';
      if (i === sel) bg = '#FFE08A';
      if (celK >= 0) { const w = celK * (N * 2) - (r + c); if (w > 0 && w < 3) bg = w < 1.5 ? '#C9F2E2' : '#E6FAF2'; else if (w >= 3) bg = '#F1FBF6'; }
      if (bg) { ctx.fillStyle = bg; ctx.fillRect(x0 + c * s, y0 + r * s, s, s); }
    }
    // 완성 줄 반짝
    for (const fl of this.flashLines) { ctx.fillStyle = 'rgba(6,214,160,' + (0.35 * (1 - fl.t / 600)).toFixed(3) + ')';
      for (const i of fl.cells) ctx.fillRect(x0 + (i % N) * s, y0 + (i / N | 0) * s, s, s); }
    // 선
    ctx.strokeStyle = '#D8CFBF'; ctx.lineWidth = 1; ctx.beginPath();
    for (let t = 1; t < N; t++) { if (t % P.bw) { ctx.moveTo(x0 + t * s, y0); ctx.lineTo(x0 + t * s, y0 + S); } if (t % P.bh) { ctx.moveTo(x0, y0 + t * s); ctx.lineTo(x0 + S, y0 + t * s); } }
    ctx.stroke();
    ctx.strokeStyle = LP_INK; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let t = P.bw; t < N; t += P.bw) { ctx.moveTo(x0 + t * s, y0); ctx.lineTo(x0 + t * s, y0 + S); }
    for (let t = P.bh; t < N; t += P.bh) { ctx.moveTo(x0, y0 + t * s); ctx.lineTo(x0 + S, y0 + t * s); }
    ctx.stroke();
    ctx.lineWidth = 3; FX.rr(ctx, x0, y0, S, S, 3); ctx.stroke();
    // 숫자
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const big = '800 ' + Math.round(s * 0.6) + 'px ' + LP_FONT, mid = '700 ' + Math.round(s * 0.6) + 'px ' + LP_FONT, small = '700 ' + Math.round(s * 0.24) + 'px ' + LP_FONT;
    const nc = N === 9 ? 3 : 3, nr = N === 9 ? 3 : 2;
    for (let i = 0; i < N * N; i++) {
      const r = i / N | 0, c = i % N, v = P.val[i]; let ox = 0;
      if (this.shakeCell && this.shakeCell.i === i) ox = Math.sin(this.shakeCell.t / 25) * s * 0.08 * (this.shakeCell.t / 400);
      const cx = x0 + (c + 0.5) * s + ox, cy = y0 + (r + 0.54) * s;
      if (v) { ctx.font = P.given[i] ? big : mid; ctx.fillStyle = P.given[i] ? LP_INK : v === P.sol[i] ? LP_ACC : LP_RED; ctx.fillText(String(v), cx, cy); }
      else if (P.notes[i]) { ctx.font = small;
        for (let d = 1; d <= N; d++) if (P.notes[i] & (1 << d)) { const k = d - 1;
          ctx.fillStyle = sv === d ? LP_ACC : '#8D93A5';
          ctx.fillText(String(d), x0 + (c + (k % nc + 0.5) / nc) * s, y0 + (r + ((k / nc | 0) + 0.55) / nr) * s); } }
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }
  drawSdkPad(ctx, cs) {
    const P = this.pz, N = P.N, bw = 9.2 / N, cnt = new Array(N + 1).fill(0);
    for (let i = 0; i < N * N; i++) if (P.val[i] && P.val[i] === P.sol[i]) cnt[P.val[i]]++;
    const sv = this.sel >= 0 ? P.val[this.sel] : 0;
    for (let v = 1; v <= N; v++) {
      const x = (0.4 + (v - 1) * bw + 0.06) * cs, y = 11.3 * cs, w = (bw - 0.12) * cs, h = 1.1 * cs, done = cnt[v] >= N;
      this.card(ctx, x, y, w, h, cs * 0.2, v === sv ? '#E3EAFF' : done ? '#F1ECE3' : '#FFFFFF');
      if (this.memo) {
        FX.text(ctx, String(v), x + w / 2, y + h * 0.55, { size: cs * 0.48, weight: 700, color: done ? '#C9C0B0' : '#8D93A5', align: 'center', baseline: 'middle' });
        ctx.fillStyle = '#F79824'; ctx.beginPath(); ctx.arc(x + w - cs * 0.16, y + cs * 0.16, cs * 0.06, 0, 6.29); ctx.fill();
      } else FX.text(ctx, String(v), x + w / 2, y + h * 0.56, { size: cs * 0.7, weight: 800, color: done ? '#C9C0B0' : LP_ACC, align: 'center', baseline: 'middle' });
    }
    // 도구
    const tools = [['t:memo', 0.4, 3.6, this.memo ? '메모 켬' : '메모', this.memo], ['t:erase', 4.1, 3.0, '지우개', false], ['t:menu', 7.2, 2.4, '퍼즐', false]];
    tools.forEach(([k, tx, tw, label, on]) => this.toolBtn(ctx, cs, k, tx, 12.6, tw, 1.15, label, on));
  }
  toolBtn(ctx, cs, key, tx, ty, tw, th, label, on) {
    const x = (tx + 0.06) * cs, y = ty * cs, w = (tw - 0.12) * cs, h = th * cs;
    if (on) { ctx.fillStyle = FX.tint(LP_ACC, -0.3); FX.rr(ctx, x, y + 3, w, h, cs * 0.25); ctx.fill(); ctx.fillStyle = LP_ACC; FX.rr(ctx, x, y, w, h, cs * 0.25); ctx.fill(); }
    else this.card(ctx, x, y, w, h, cs * 0.25);
    const ic = on ? '#fff' : LP_INK, ix = x + cs * 0.55, iy = y + h / 2, q = cs * 0.24;
    ctx.save(); ctx.translate(ix, iy); ctx.fillStyle = ic; ctx.strokeStyle = ic; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    if (key === 't:memo') { ctx.rotate(-0.7); ctx.fillRect(-q * 1.2, -q * 0.3, q * 1.9, q * 0.6); ctx.beginPath(); ctx.moveTo(q * 0.7, -q * 0.3); ctx.lineTo(q * 1.3, 0); ctx.lineTo(q * 0.7, q * 0.3); ctx.fill(); }
    else if (key === 't:erase') { ctx.rotate(-0.6); ctx.fillStyle = '#EF8FA6'; FX.rr(ctx, -q * 1.2, -q * 0.5, q * 1.3, q, 3); ctx.fill(); ctx.fillStyle = on ? '#fff' : '#8D99AE'; FX.rr(ctx, q * 0.1, -q * 0.5, q * 1.0, q, 3); ctx.fill(); }
    else if (key === 't:menu') { for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) { FX.rr(ctx, -q + a * q * 1.1, -q + b * q * 1.1, q * 0.9, q * 0.9, 2); ctx.fill(); } }
    else if (key === 't:fill') { ctx.fillStyle = on ? '#fff' : '#34405E'; FX.rr(ctx, -q, -q, q * 2, q * 2, 3); ctx.fill(); }
    else if (key === 't:x') { ctx.beginPath(); ctx.moveTo(-q, -q); ctx.lineTo(q, q); ctx.moveTo(q, -q); ctx.lineTo(-q, q); ctx.stroke(); }
    ctx.restore();
    FX.text(ctx, label, x + cs * 1.0, iy, { size: cs * 0.38, weight: 800, color: on ? '#fff' : LP_INK, baseline: 'middle' });
  }

  drawNono(ctx, cs) {
    const P = this.pz, n = P.n, g = this.geo, u = g.u * cs, gx = g.gx * cs, gy = g.gy * cs, cu = g.k * u;
    const left = gx - g.cw * cu, top = gy - g.ch * cu, S = n * u;
    this.card(ctx, left - 6, top - 6, S + g.cw * cu + 12, S + g.ch * cu + 12, cs * 0.25);
    // 초점 줄 (키보드 또는 마지막 톡)
    const fi = this.focus.startsWith('c:') ? +this.focus.slice(2) : -1, fr = fi >= 0 ? fi / n | 0 : -1, fc = fi >= 0 ? fi % n : -1;
    // 힌트 띠
    for (let r = 0; r < n; r++) { ctx.fillStyle = r === fr ? '#FFF0BF' : r % 2 ? '#F4EEE3' : '#F9F5EC'; ctx.fillRect(left, gy + r * u, g.cw * cu, u); }
    for (let c = 0; c < n; c++) { ctx.fillStyle = c === fc ? '#FFF0BF' : c % 2 ? '#F4EEE3' : '#F9F5EC'; ctx.fillRect(gx + c * u, top, u, g.ch * cu); }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 ' + Math.round(Math.min(cu * 0.82, cs * 0.5)) + 'px ' + LP_FONT;
    const lineDone = (isRow, k) => (isRow ? P.done.r[k] : P.done.c[k]) || !(isRow ? P.rc[k] : P.cc[k]).length;
    for (let r = 0; r < n; r++) { const cl = P.rc[r].length ? P.rc[r] : [0]; ctx.fillStyle = lineDone(true, r) ? '#C4BBAA' : LP_INK;
      cl.forEach((v, j) => ctx.fillText(String(v), gx - (cl.length - j - 0.5) * cu, gy + (r + 0.54) * u)); }
    for (let c = 0; c < n; c++) { const cl = P.cc[c].length ? P.cc[c] : [0]; ctx.fillStyle = lineDone(false, c) ? '#C4BBAA' : LP_INK;
      cl.forEach((v, j) => ctx.fillText(String(v), gx + (c + 0.5) * u, gy - (cl.length - j - 0.45) * cu)); }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    // 칸
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(gx, gy, S, S);
    if (fr >= 0 && !this.cel) { ctx.fillStyle = 'rgba(255,224,138,0.28)'; ctx.fillRect(gx, gy + fr * u, S, u); ctx.fillRect(gx + fc * u, gy, u, S); }
    const celK = this.cel ? this.cel.t / 800 : -1, pad = Math.max(1, u * 0.06);
    for (let i = 0; i < n * n; i++) {
      const r = i / n | 0, c = i % n, st = P.st[i]; let ox = 0;
      if (this.shakeCell && this.shakeCell.i === i) ox = Math.sin(this.shakeCell.t / 25) * u * 0.1 * (this.shakeCell.t / 400);
      const x = gx + c * u + ox, y = gy + r * u;
      if (st === 1) {
        let col = '#34405E';
        if (celK >= 0 && celK * n * 2 > r + c) col = 'hsl(' + ((r * 23 + c * 31 + 190) % 360) + ',72%,' + (52 + ((r + c) % 3) * 6) + '%)';
        ctx.fillStyle = col; FX.rr(ctx, x + pad, y + pad, u - pad * 2, u - pad * 2, u * 0.14); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fillRect(x + pad * 2, y + pad * 1.5, u - pad * 4, u * 0.18);
      } else if (st === 2 && !this.cel) {
        if (P.wrong[i]) { ctx.fillStyle = '#FFE1E7'; ctx.fillRect(x + 1, y + 1, u - 2, u - 2); }
        ctx.strokeStyle = P.wrong[i] ? LP_RED : '#B3ACA0'; ctx.lineWidth = Math.max(1.5, u * 0.07); ctx.lineCap = 'round';
        const m = u * 0.3; ctx.beginPath(); ctx.moveTo(x + m, y + m); ctx.lineTo(x + u - m, y + u - m); ctx.moveTo(x + u - m, y + m); ctx.lineTo(x + m, y + u - m); ctx.stroke();
      }
    }
    for (const fl of this.flashLines) { ctx.fillStyle = 'rgba(6,214,160,' + (0.3 * (1 - fl.t / 600)).toFixed(3) + ')';
      for (const i of fl.cells) ctx.fillRect(gx + (i % n) * u, gy + (i / n | 0) * u, u, u); }
    // 선: 5칸마다 굵게
    ctx.strokeStyle = '#D8CFBF'; ctx.lineWidth = 1; ctx.beginPath();
    for (let t = 1; t < n; t++) if (t % 5) { ctx.moveTo(gx + t * u, top); ctx.lineTo(gx + t * u, gy + S); ctx.moveTo(left, gy + t * u); ctx.lineTo(gx + S, gy + t * u); }
    ctx.stroke();
    ctx.strokeStyle = LP_INK; ctx.lineWidth = 2.2; ctx.beginPath();
    for (let t = 5; t < n; t += 5) { ctx.moveTo(gx + t * u, top); ctx.lineTo(gx + t * u, gy + S); ctx.moveTo(left, gy + t * u); ctx.lineTo(gx + S, gy + t * u); }
    ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeRect(gx, gy, S, S);
  }
  drawNonoTools(ctx, cs) {
    const P = this.pz;
    this.toolBtn(ctx, cs, 't:fill', 0.4, 11.4, 3.7, 1.3, '칠하기', this.nonoMode === 'fill');
    this.toolBtn(ctx, cs, 't:x', 4.2, 11.4, 3.0, 1.3, 'X 표시', this.nonoMode === 'x');
    this.toolBtn(ctx, cs, 't:menu', 7.3, 11.4, 2.3, 1.3, '퍼즐', false);
    let need = 0, have = 0; for (let i = 0; i < P.sol.length; i++) if (P.sol[i]) { need++; if (P.st[i] === 1) have++; }
    const x = 0.5 * cs, y = 13.1 * cs, w = 9 * cs;
    ctx.fillStyle = '#E3D9C6'; FX.rr(ctx, x, y, w, cs * 0.22, cs * 0.11); ctx.fill();
    ctx.fillStyle = '#06A77D'; FX.rr(ctx, x, y, Math.max(cs * 0.22, w * have / need), cs * 0.22, cs * 0.11); ctx.fill();
    FX.text(ctx, '칠한 칸 ' + have + ' / ' + need, LP_COLS * cs / 2, 13.75 * cs, { size: cs * 0.32, weight: 700, color: '#7A6E5D', align: 'center' });
  }

  drawCelebrate(ctx, cs, W, H) {
    const c = this.cel, k = Math.min(1, c.t / 400), out = Math.max(0, (c.t - c.dur + 300) / 300);
    const sc = 0.6 + 0.4 * FX.ease.outBack(k);
    ctx.save(); ctx.globalAlpha = 1 - out; ctx.translate(W / 2, 6.4 * cs); ctx.scale(sc, sc); ctx.rotate(-0.04);
    const w = 7.2 * cs, h = 3.3 * cs;
    ctx.fillStyle = 'rgba(43,45,66,0.25)'; FX.rr(ctx, -w / 2, -h / 2 + 5, w, h, cs * 0.4); ctx.fill();
    ctx.fillStyle = '#FFFDF8'; FX.rr(ctx, -w / 2, -h / 2, w, h, cs * 0.4); ctx.fill();
    ctx.strokeStyle = '#06A77D'; ctx.lineWidth = 4; FX.rr(ctx, -w / 2 + 6, -h / 2 + 6, w - 12, h - 12, cs * 0.32); ctx.stroke();
    FX.text(ctx, '완성!', 0, -0.35 * cs, { size: cs * 1.0, weight: 900, color: '#06A77D', align: 'center' });
    FX.text(ctx, '+' + c.pts, 0, 0.65 * cs, { size: cs * 0.75, weight: 900, color: LP_ACC, align: 'center' });
    FX.text(ctx, '기본 ' + c.base + ' · 시간 +' + c.bonus + (c.pen ? ' · 실수 −' + c.pen : ''), 0, 1.2 * cs, { size: cs * 0.3, weight: 700, color: '#7A6E5D', align: 'center' });
    ctx.restore(); ctx.globalAlpha = 1;
  }
  drawOver(ctx, cs, W, H) {
    ctx.fillStyle = 'rgba(43,45,66,0.6)'; ctx.fillRect(0, 0, W, H);
    const w = 8 * cs, h = 4.6 * cs, x = (W - w) / 2, y = 4.4 * cs;
    this.card(ctx, x, y, w, h, cs * 0.4);
    FX.text(ctx, '시간 끝!', W / 2, y + 1.2 * cs, { size: cs * 0.9, weight: 900, color: LP_INK, align: 'center' });
    FX.text(ctx, this.score + '점', W / 2, y + 2.55 * cs, { size: cs * 1.1, weight: 900, color: LP_ACC, align: 'center' });
    FX.text(ctx, '푼 퍼즐 ' + this.solved + '개 · 실수 ' + this.mistakes + '번', W / 2, y + 3.6 * cs, { size: cs * 0.38, weight: 700, color: '#7A6E5D', align: 'center' });
  }
}
if (typeof window !== 'undefined') { window.LogicPuzzleGame = LogicPuzzleGame; window.LPgen = LPgen; }
