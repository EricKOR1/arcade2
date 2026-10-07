// 블록 퍼즐 — 8×8 판에 아래 블록 3개를 끌어다 놓아요. 가로·세로 한 줄이 꽉 차면 사라져요.
//   연달아 줄을 지우면 콤보 · 한 번에 여러 줄이면 큰 점수 · 3개를 다 놓으면 새 블록 3개 · 놓을 곳이 없으면 끝
//   (모바일 인기 1위 '블록 퍼즐' 장르를 학교용으로 새로 만든 것 — 이름·그림은 모두 새로 그림)

const BP_N = 8, BP_ROWS = 12;          // 판 8줄 + 아래 블록 칸 (칸 단위 좌표: 판 0~8, 블록 칸 8.6~12)
const BP_SHAPES = [
  [[1]], [[1, 1]], [[1], [1]], [[1, 1, 1]], [[1], [1], [1]], [[1, 1, 1, 1]], [[1], [1], [1], [1]], [[1, 1, 1, 1, 1]], [[1], [1], [1], [1], [1]],
  [[1, 1], [1, 1]], [[1, 1, 1], [1, 1, 1], [1, 1, 1]], [[1, 1, 1], [1, 1, 1]], [[1, 1], [1, 1], [1, 1]],
  [[1, 0], [1, 1]], [[0, 1], [1, 1]], [[1, 1], [1, 0]], [[1, 1], [0, 1]],
  [[1, 0, 0], [1, 0, 0], [1, 1, 1]], [[0, 0, 1], [0, 0, 1], [1, 1, 1]], [[1, 1, 1], [1, 0, 0], [1, 0, 0]], [[1, 1, 1], [0, 0, 1], [0, 0, 1]],
  [[1, 1, 1], [0, 1, 0]], [[0, 1, 0], [1, 1, 1]], [[1, 0], [1, 1], [1, 0]], [[0, 1], [1, 1], [0, 1]],
  [[1, 1, 0], [0, 1, 1]], [[0, 1, 1], [1, 1, 0]], [[1, 0], [1, 1], [0, 1]], [[0, 1], [1, 1], [1, 0]],
  [[1, 0, 0], [1, 1, 1]], [[0, 0, 1], [1, 1, 1]], [[1, 1, 1], [1, 0, 0]], [[1, 1, 1], [0, 0, 1]]
];
const BP_COLORS = [null, '#4CC9F0', '#4361EE', '#F79824', '#FFD166', '#06D6A0', '#B15DFF', '#EF476F'];

class BlockPuzzleGame {
  constructor(canvas, cellSize) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.cellSize = cellSize;
    this.grid = Array.from({ length: BP_N }, () => Array(BP_N).fill(0));
    this.score = 0; this.lines = 0; this.combo = 0; this.bestCombo = 0; this.placed = 0; this.gameOver = false;
    this.tray = []; this.drag = null; this.fx = []; this.pops = []; this.flash = 0; this.lastTime = 0; this.now = 0;
    this.refill();
  }
  // 새 블록 3개 — 판에 들어갈 수 있는 것을 조금 더 자주 (너무 빨리 끝나지 않게)
  refill() {
    this.tray = [0, 1, 2].map(() => {
      let s = null; for (let k = 0; k < 6; k++) { s = BP_SHAPES[Math.floor(Math.random() * BP_SHAPES.length)]; if (this.fitsAnywhere(s)) break; }
      return { s, c: 1 + Math.floor(Math.random() * 7), pop: 1 };
    });
  }
  fits(s, gx, gy) {
    for (let y = 0; y < s.length; y++) for (let x = 0; x < s[0].length; x++) { if (!s[y][x]) continue;
      const X = gx + x, Y = gy + y; if (X < 0 || Y < 0 || X >= BP_N || Y >= BP_N || this.grid[Y][X]) return false; }
    return true;
  }
  fitsAnywhere(s) { for (let y = 0; y < BP_N; y++) for (let x = 0; x < BP_N; x++) if (this.fits(s, x, y)) return true; return false; }
  // 블록 칸의 자리 (칸 단위): 세 칸을 나란히
  slotBox(i) { const w = BP_N / 3; return { x: i * w, y: BP_N + 0.6, w, h: BP_ROWS - BP_N - 0.8 }; }
  // 끌고 있는 블록의 왼쪽 위 칸 — 손가락보다 위에 보이게 (손가락에 가리지 않게)
  dragCell() { const d = this.drag, s = d.p.s; return [Math.round(d.x - s[0].length / 2), Math.round(d.y - s.length - 1.2)]; }
  pointer(type, x, y) {
    if (this.gameOver) return;
    if (type === 'down') {
      for (let i = 0; i < 3; i++) { const p = this.tray[i], b = this.slotBox(i); if (p && x >= b.x && x < b.x + b.w && y >= b.y - 0.4) { this.drag = { i, p, x, y }; if (window.Sound) Sound.move(); return; } }
      return;
    }
    if (!this.drag) return;
    this.drag.x = x; this.drag.y = y;
    if (type === 'up') { const [gx, gy] = this.dragCell(), d = this.drag; this.drag = null; if (this.fits(d.p.s, gx, gy)) this.place(d.i, gx, gy); }
  }
  // 키보드·버튼으로도: ← → 블록 고르기 · ↑ 놓을 자리 위로 … (마우스·손가락이 기본)
  move() {} rotate() {} softDrop() {} hardDrop() {}
  place(i, gx, gy) {
    const p = this.tray[i], s = p.s; let n = 0;
    for (let y = 0; y < s.length; y++) for (let x = 0; x < s[0].length; x++) if (s[y][x]) { this.grid[gy + y][gx + x] = p.c; n++; this.fx.push({ x: gx + x, y: gy + y, t: 1, k: 'set' }); }
    this.tray[i] = null; this.placed++; this.score += n;
    // 꽉 찬 줄 찾기 (가로·세로 동시에)
    const rows = [], cols = [];
    for (let y = 0; y < BP_N; y++) if (this.grid[y].every(v => v)) rows.push(y);
    for (let x = 0; x < BP_N; x++) if (this.grid.every(r => r[x])) cols.push(x);
    const L = rows.length + cols.length;
    if (L) {
      this.combo++; this.bestCombo = Math.max(this.bestCombo, this.combo); this.lines += L;
      const gain = 10 * L * L * this.combo; this.score += gain;   // 여러 줄 · 연속 콤보일수록 크게
      const clear = (x, y) => { if (this.grid[y][x]) { this.fx.push({ x, y, t: 1, k: 'pop', c: this.grid[y][x] }); this.grid[y][x] = 0; } };
      rows.forEach(y => { for (let x = 0; x < BP_N; x++) clear(x, y); }); cols.forEach(x => { for (let y = 0; y < BP_N; y++) clear(x, y); });
      this.pops.push({ x: gx + s[0].length / 2, y: gy + s.length / 2, t: 1, txt: (this.combo > 1 ? '콤보 ' + this.combo + '! ' : '') + '+' + gain });
      if (this.grid.every(r => r.every(v => !v))) { this.score += 300; this.pops.push({ x: BP_N / 2, y: BP_N / 2, t: 1.4, txt: '✨ 판 비우기 +300' }); }
      this.flash = Math.min(1, 0.3 + L * 0.2);
      if (window.Sound) { if (L >= 3 || this.combo >= 3) Sound.levelUp(); else Sound.clear(L); }
    } else { this.combo = 0; if (window.Sound) Sound.move(); }
    if (this.tray.every(t => !t)) this.refill();
    if (!this.tray.some(t => t && this.fitsAnywhere(t.s))) { this.gameOver = true; if (window.Sound) Sound.gameOver(); }
  }
  tick(now) {
    const { f } = FX.frame(this, now);
    this.fx = this.fx.filter(e => (e.t -= 0.06 * f) > 0); this.pops = this.pops.filter(e => (e.t -= 0.018 * f) > 0);
    this.flash = Math.max(0, this.flash - 0.04 * f); this.tray.forEach(p => { if (p && p.pop > 0) p.pop = Math.max(0, p.pop - 0.08 * f); });
    this.draw();
  }
  getSnapshot() {
    const out = this.grid.map(r => r.slice());
    for (let y = BP_N; y < BP_ROWS; y++) out.push(Array(BP_N).fill(0));
    this.tray.forEach((p, i) => { if (!p) return; const x0 = Math.round(i * BP_N / 3), s = p.s; for (let y = 0; y < Math.min(3, s.length); y++) for (let x = 0; x < Math.min(2, s[0].length); x++) if (s[y][x]) out[BP_N + 1 + y][x0 + x] = p.c; });
    return out;
  }
  cell(ctx, x, y, s, c, a) {   // 블록 한 칸: 그림자 · 세로 그라데이션 · 윗면 광택
    const col = BP_COLORS[c] || '#888', r = s * 0.16, i = s * 0.05;
    ctx.globalAlpha = a == null ? 1 : a;
    const g = ctx.createLinearGradient(0, y, 0, y + s); g.addColorStop(0, FX.tint(col, 0.22)); g.addColorStop(1, FX.tint(col, -0.18));
    ctx.fillStyle = g; FX.rr(ctx, x + i, y + i, s - i * 2, s - i * 2, r); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.28)'; FX.rr(ctx, x + s * 0.14, y + s * 0.12, s * 0.72, s * 0.22, r * 0.6); ctx.fill();
    ctx.globalAlpha = 1;
  }
  draw() {
    const ctx = this.ctx, cs = this.cellSize, W = cs * BP_N, H = cs * BP_ROWS;
    const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1B2350'); bg.addColorStop(1, '#0E1330'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    // 판
    ctx.fillStyle = 'rgba(0,0,0,.25)'; FX.rr(ctx, 2, 2, W - 4, cs * BP_N - 4, cs * 0.2); ctx.fill();
    for (let y = 0; y < BP_N; y++) for (let x = 0; x < BP_N; x++) {
      const v = this.grid[y][x];
      if (v) this.cell(ctx, x * cs, y * cs, cs, v); else { ctx.fillStyle = 'rgba(255,255,255,.06)'; FX.rr(ctx, x * cs + cs * 0.06, y * cs + cs * 0.06, cs * 0.88, cs * 0.88, cs * 0.14); ctx.fill(); }
    }
    // 끌고 있는 블록: 놓일 자리 미리 보기 + 지워질 줄 반짝임
    if (this.drag) { const [gx, gy] = this.dragCell(), s = this.drag.p.s, ok = this.fits(s, gx, gy);
      if (ok) { const g2 = this.grid.map(r => r.slice()); for (let y = 0; y < s.length; y++) for (let x = 0; x < s[0].length; x++) if (s[y][x]) g2[gy + y][gx + x] = 1;
        for (let y = 0; y < BP_N; y++) if (g2[y].every(v => v)) { ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(0, y * cs, W, cs); }
        for (let x = 0; x < BP_N; x++) if (g2.every(r => r[x])) { ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(x * cs, 0, cs, cs * BP_N); }
        for (let y = 0; y < s.length; y++) for (let x = 0; x < s[0].length; x++) if (s[y][x]) this.cell(ctx, (gx + x) * cs, (gy + y) * cs, cs, this.drag.p.c, 0.35); } }
    // 사라지는 칸 · 놓은 칸 효과
    this.fx.forEach(e => { if (e.k === 'pop') { const k = 1 - e.t, sz = cs * (1 + k * 0.6); this.cell(ctx, e.x * cs + cs / 2 - sz / 2, e.y * cs + cs / 2 - sz / 2, sz, e.c, e.t); }
      else { ctx.fillStyle = 'rgba(255,255,255,' + (e.t * 0.35).toFixed(2) + ')'; FX.rr(ctx, e.x * cs, e.y * cs, cs, cs, cs * 0.16); ctx.fill(); } });
    if (this.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (this.flash * 0.18).toFixed(2) + ')'; ctx.fillRect(0, 0, W, cs * BP_N); }
    // 블록 칸
    ctx.fillStyle = 'rgba(255,255,255,.05)'; FX.rr(ctx, 2, (BP_N + 0.35) * cs, W - 4, (BP_ROWS - BP_N - 0.45) * cs, cs * 0.3); ctx.fill();
    this.tray.forEach((p, i) => { if (!p || (this.drag && this.drag.i === i)) return; const b = this.slotBox(i), s = p.s, ms = cs * Math.min(0.62, (b.w - 0.4) / s[0].length * 0.9, (b.h - 0.3) / s.length * 0.9) * (1 - p.pop * 0.4);
      const can = this.fitsAnywhere(s), ox = (b.x + b.w / 2) * cs - s[0].length * ms / 2, oy = (b.y + b.h / 2) * cs - s.length * ms / 2;
      for (let y = 0; y < s.length; y++) for (let x = 0; x < s[0].length; x++) if (s[y][x]) this.cell(ctx, ox + x * ms, oy + y * ms, ms, p.c, can ? 1 : 0.3); });
    if (this.drag) { const s = this.drag.p.s, [gx, gy] = [this.drag.x - s[0].length / 2, this.drag.y - s.length - 1.2];
      for (let y = 0; y < s.length; y++) for (let x = 0; x < s[0].length; x++) if (s[y][x]) this.cell(ctx, (gx + x) * cs, (gy + y) * cs, cs * 0.96, this.drag.p.c, 0.95); }
    // 점수 팝업
    this.pops.forEach(e => { ctx.globalAlpha = Math.min(1, e.t * 1.5); FX.text(ctx, e.txt, e.x * cs, (e.y - (1 - e.t) * 1.2) * cs, { size: cs * 0.55, weight: 900, color: '#FFE38A', align: 'center', stroke: 'rgba(30,15,0,.85)' }); ctx.globalAlpha = 1; });
    if (this.combo > 1 && !this.gameOver) FX.text(ctx, '🔥 콤보 ' + this.combo, W - cs * 0.3, (BP_N + 0.25) * cs, { size: cs * 0.32, weight: 800, color: '#FF9F5A', align: 'right' });
    if (this.gameOver) { ctx.fillStyle = 'rgba(8,10,24,.7)'; ctx.fillRect(0, 0, W, H);
      FX.text(ctx, '놓을 자리가 없어요', W / 2, H * 0.42, { size: cs * 0.6, weight: 900, color: '#fff', align: 'center' });
      FX.text(ctx, this.score + '점 · ' + this.lines + '줄', W / 2, H * 0.42 + cs * 0.8, { size: cs * 0.42, weight: 700, color: '#FFD166', align: 'center' }); }
  }
}
if (typeof window !== 'undefined') window.BlockPuzzleGame = BlockPuzzleGame;
