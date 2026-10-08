// 땅따먹기 대전 — 내 땅 밖으로 나가 선을 긋고 다시 내 땅으로 돌아오면, 선으로 둘러싼 곳이 모두 내 땅이 돼요.
//   밖에 있는 동안 내 꼬리(선)를 누가 밟으면 탈락 · 내가 남의 꼬리를 밟으면 그 친구가 탈락 · 내 꼬리를 내가 밟아도 탈락
//   반 전체가 한 경기장에서 실시간으로 (뱀 아레나와 같은 위치 신호 · 땅을 차지하면 'cap' 소식으로 모두에게)
//   (모바일 인기 'io 땅따먹기' 장르를 학교용으로 새로 만든 것 — 이름·그림은 모두 새로 그림)

const TR_N = 56, TR_VIEW = 10, TR_SPEED = 6.2;          // 경기장 56×56칸 · 화면 짧은 변에 10칸(칸이 크게 보이게) · 초당 6.2칸
const TR_GRID_C = 12, TR_GRID_R = 18;                     // games.js 의 grid — 페이지가 손가락 좌표를 이 칸 단위로 넘겨 줌
const TR_COLORS = ['#4CC9F0', '#FF5C7A', '#FFD166', '#06D6A0', '#B15DFF', '#FF9F43', '#4361EE', '#F78FB3', '#7DF58F', '#E0B860'];
const TR_CELLC = [1, 7, 4, 5, 6, 3, 2, 19, 13, 23];      // 교사 미니보드 색 번호
const TR_DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];      // 0 오른쪽 · 1 아래 · 2 왼쪽 · 3 위

class TerritoryGame {
  constructor(canvas, opts) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.opts = opts || {}; this.cellSize = this.opts.cellSize || 20;
    this.myId = this.opts.myId || 'me'; this.myName = this.opts.myName || '';
    this.ci = Math.abs(String(this.myId).split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % TR_COLORS.length;
    this.own = new Array(TR_N * TR_N).fill(null);           // 칸마다 주인 id (null = 빈 땅)
    this.peers = {}; this.parts = []; this.toasts = []; this.now = 0; this.lastTime = 0;
    this.score = 0; this.kills = 0; this.best = 0; this.cells = 0; this.gameOver = false;
    this.trail = []; this.trailSet = new Set(); this.capAt = new Map(); this.mini = null; this.miniDirty = true; this._full = 0; this.run = 0;
    this.spawn(this.opts.slot);
  }
  get pct() { return Math.round(this.cells / (TR_N * TR_N) * 1000) / 10; }
  get isDead() { return this.now < this.deadUntil; }
  idx(x, y) { return y * TR_N + x; }
  toast(t, c) { this.toasts.push({ t, c: c || '#fff', until: (this.now || 0) + 1800 }); }
  // ── 시작 · 부활: 다른 사람과 먼 빈 땅에 3×3 ──
  spawn(slot) {
    let best = null, bd = -1;
    const free = (x, y) => { for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) { const X = x + a, Y = y + b; if (X < 1 || Y < 1 || X >= TR_N - 1 || Y >= TR_N - 1 || this.own[this.idx(X, Y)]) return false; } return true; };
    for (let k = 0; k < 60; k++) { let x, y;
      if (typeof slot === 'number' && k === 0) { const a = slot * 2.39996, r = Math.sqrt((slot % 30 + 0.5) / 30) * (TR_N / 2 - 6); x = Math.round(TR_N / 2 + Math.cos(a) * r); y = Math.round(TR_N / 2 + Math.sin(a) * r); }
      else { x = 4 + Math.floor(Math.random() * (TR_N - 8)); y = 4 + Math.floor(Math.random() * (TR_N - 8)); }
      if (!free(x, y)) continue; let near = 1e9; Object.values(this.peers).forEach(p => { if (!p.dead) near = Math.min(near, Math.hypot(p.x - x, p.y - y)); });
      if (near > bd) { bd = near; best = [x, y]; } if (typeof slot === 'number' && k === 0) break; }
    if (!best) best = [4 + Math.floor(Math.random() * (TR_N - 8)), 4 + Math.floor(Math.random() * (TR_N - 8))];
    this.cx = best[0]; this.cy = best[1]; this.p = 0; this.dir = Math.floor(Math.random() * 4); this.want = this.dir; this.deadUntil = 0; this.trail = []; this.trailSet = new Set();
    const got = []; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const i = this.idx(this.cx + a, this.cy + b); this.own[i] = this.myId; got.push(i); }
    this.recount(); this.emitCap(got); this.miniDirty = true;
  }
  // ── 조작: 네 방향 (바로 뒤로는 못 돌아감) ──
  turn(d) { if (this.isDead || this.gameOver) return; if ((d + 2) % 4 === this.dir && this.trail.length) return; this.want = d; }
  move(d) { this.turn(d > 0 ? 0 : 2); } up() { this.turn(3); } down() { this.turn(1); } softDrop() { this.turn(1); }
  rotate() {} hardDrop() {} setHazards() {}
  // 화면 아무 데나 밀기: 손가락이 18px 넘게 움직이면 그 방향으로 꺾고, 다시 그 자리부터 잼 (계속 밀며 여러 번 꺾기)
  pointer(type, x, y) {
    const W = this.canvas.clientWidth || 1, H = this.canvas.clientHeight || 1, px = x / TR_GRID_C * W, py = y / TR_GRID_R * H;
    if (type === 'down') { this.sw = [px, py]; return; }
    if (type === 'up') { this.sw = null; return; }
    if (!this.sw) return;
    const dx = px - this.sw[0], dy = py - this.sw[1];
    if (Math.hypot(dx, dy) < 18) return;
    this.turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3)); this.sw = [px, py];
  }
  setMove(x, y) { if (Math.hypot(x, y) < 0.35) return; this.turn(Math.abs(x) > Math.abs(y) ? (x > 0 ? 0 : 2) : (y > 0 ? 3 : 1)); }   // 조이스틱 (위 = +y)
  // ── 신호: 위치 · 꼬리(꺾인 점) · 가끔 내 땅 전체 ──
  serialize() {
    const hx = this.cx + TR_DIRS[this.dir][0] * this.p, hy = this.cy + TR_DIRS[this.dir][1] * this.p, now = this.now || 0;
    let s = [hx.toFixed(2), hy.toFixed(2), this.dir, this.isDead ? 1 : 0, this.ci, this.kills, this.cells].join(',') + '|' + this.corners();
    if (now - this._full > 2000) { this._full = now; s += '|' + this.terrRle(); }   // 2초마다 내 땅 전체 (늦게 들어온 친구도 땅을 보게)
    return s;
  }
  corners() { const T = this.trail; if (!T.length) return ''; const out = []; for (let i = 0; i < T.length; i++) { const a = T[i - 1], b = T[i], c = T[i + 1]; if (!a || !c || (b % TR_N - a % TR_N) !== (c % TR_N - b % TR_N) || ((b / TR_N | 0) - (a / TR_N | 0)) !== ((c / TR_N | 0) - (b / TR_N | 0))) out.push((b % TR_N) + '.' + (b / TR_N | 0)); } return out.join(';'); }
  terrRle() { const rows = []; for (let y = 0; y < TR_N; y++) { let run = null, r = []; for (let x = 0; x <= TR_N; x++) { const m = x < TR_N && this.own[this.idx(x, y)] === this.myId; if (m && run == null) run = x; if (!m && run != null) { r.push(run + '-' + (x - 1)); run = null; } } if (r.length) rows.push(y + ':' + r.join('.')); } return rows.join('/'); }
  static rleCells(s) { const out = []; String(s || '').split('/').forEach(row => { const [y, rs] = row.split(':'); if (rs == null) return; const Y = +y; rs.split('.').forEach(r => { const [a, b] = r.split('-').map(Number); if (!(Y >= 0 && Y < TR_N && a >= 0 && b < TR_N && a <= b)) return; for (let x = a; x <= b; x++) out.push(Y * TR_N + x); }); }); return out; }
  rleOf(cells) { const by = {}; cells.forEach(i => { const y = i / TR_N | 0; (by[y] = by[y] || []).push(i % TR_N); }); return Object.keys(by).map(y => { const xs = by[y].sort((a, b) => a - b), r = []; let s = xs[0], p = xs[0]; for (let k = 1; k <= xs.length; k++) { if (xs[k] === p + 1) { p = xs[k]; continue; } r.push(s + '-' + p); s = p = xs[k]; } return y + ':' + r.join('.'); }).join('/'); }
  emitCap(cells) { if (cells.length && this.opts.onAttack) this.opts.onAttack('cap', null, { rle: this.rleOf(cells) }); }
  applyPeerRaw(id, raw, name) {
    if (typeof raw !== 'string' || id === this.myId) return; const [h, tr, terr] = raw.split('|'), a = h.split(',');
    const x = +a[0], y = +a[1]; if (!isFinite(x) || !isFinite(y)) return;
    const p = this.peers[id] || (this.peers[id] = { x, y, trailKey: null, trail: new Set(), trailPts: [] }), dead = a[3] === '1';
    if (!p.dead && dead) { this.clearOwner(id); p.trail = new Set(); p.trailPts = []; }   // 친구가 탈락: 그 땅이 비어요
    if (Math.hypot(p.x - x, p.y - y) > 3) { p.x = x; p.y = y; }
    Object.assign(p, { tx: x, ty: y, dir: +a[2] || 0, dead, ci: (+a[4] || 0) % TR_COLORS.length, kills: +a[5] || 0, cells: +a[6] || 0, name: name || p.name || '' });
    if (tr !== p.trailKey) { p.trailKey = tr; p.trail = new Set(); p.trailPts = []; const pts = (tr || '').split(';').filter(Boolean).map(q => q.split('.').map(Number)).filter(q => q.length === 2 && q.every(isFinite));
      for (let k = 0; k < pts.length; k++) { const [x0, y0] = pts[k], nx = pts[k + 1] || pts[k]; const dx = Math.sign(nx[0] - x0), dy = Math.sign(nx[1] - y0); let X = x0, Y = y0, g = 0; p.trail.add(this.idx(X, Y)); while ((X !== nx[0] || Y !== nx[1]) && g++ < 200) { X += dx; Y += dy; p.trail.add(this.idx(X, Y)); } }
      p.trailPts = pts; }
    if (terr != null && !dead) { const want = new Set(TerritoryGame.rleCells(terr)), now = this.now || 0;   // 그 친구 땅 전체로 맞춤 (내가 방금 빼앗은 칸은 그대로)
      for (let i = 0; i < this.own.length; i++) { if (this.own[i] === id && !want.has(i)) this.own[i] = null; }
      want.forEach(i => { if (this.own[i] === this.myId && (now - (this.capAt.get(i) || -1e9) < 3000)) return; if (this.own[i] !== id) { if (this.own[i] === this.myId) this.lostCell(i); this.own[i] = id; } });
      this.recount(); this.miniDirty = true; }
  }
  setPeers(map) { Object.keys(map).forEach(id => { const d = map[id]; if (d && d.raw) this.applyPeerRaw(id, d.raw, d.name); }); Object.keys(this.peers).forEach(id => { if (!map[id]) this.removePeer(id); }); }
  removePeer(id) { if (!this.peers[id]) return; this.clearOwner(id); delete this.peers[id]; }
  clearOwner(id) { for (let i = 0; i < this.own.length; i++) if (this.own[i] === id) this.own[i] = null; this.miniDirty = true; }
  lostCell() {}
  onEvent(e) {
    if (!e || e.by === this.myId) return;
    if (e.type === 'cap') { const cells = TerritoryGame.rleCells(e.rle); let lost = 0; cells.forEach(i => { if (this.own[i] === this.myId) lost++; this.own[i] = e.by; }); this.recount(); this.miniDirty = true;
      if (lost >= 8 && !this.isDead) this.toast('😮 ' + ((this.peers[e.by] || {}).name || '친구') + '가 내 땅 ' + lost + '칸을 가져갔어요', '#FFB3BF'); }
    if (e.type === 'cut' && e.target === this.myId && !this.isDead && this.trail.length) this.die(((this.peers[e.by] || {}).name || '친구') + '가 내 꼬리를 밟았어요', e.by);
  }
  recount() { let n = 0; for (let i = 0; i < this.own.length; i++) if (this.own[i] === this.myId) n++; this.cells = n; this.best = Math.max(this.best, n); this.score = this.best; }
  die(why, by) {
    if (this.isDead) return; this.deadUntil = (this.now || 0) + 3000; this.burst(this.cx + 0.5, this.cy + 0.5, 28, TR_COLORS[this.ci]);
    this.clearOwner(this.myId); this.trail = []; this.trailSet = new Set(); this.recount(); this.toast((why || '탈락') + ' · 3초 뒤 다시 시작', '#FF8A8A');
    if (window.Sound) (Sound.death || Sound.crash).call(Sound); if (window.Haptic && Haptic.big) Haptic.big();
  }
  burst(x, y, n, c) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = 0.04 + Math.random() * 0.12; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 1, c }); } }
  // 꼬리를 끌고 내 땅에 돌아옴: 꼬리 + 꼬리로 둘러싼 곳 → 내 땅 (바깥에서 물을 부어 닿지 않는 곳 = 둘러싸인 곳)
  capture() {
    const N = TR_N, mine = new Uint8Array(N * N), got = [], now = this.now || 0;
    for (let i = 0; i < N * N; i++) if (this.own[i] === this.myId) mine[i] = 1; this.trail.forEach(i => { mine[i] = 1; });
    const seen = new Uint8Array(N * N), q = [];
    for (let x = 0; x < N; x++) for (const y of [0, N - 1]) { const i = this.idx(x, y); if (!mine[i] && !seen[i]) { seen[i] = 1; q.push(i); } }
    for (let y = 0; y < N; y++) for (const x of [0, N - 1]) { const i = this.idx(x, y); if (!mine[i] && !seen[i]) { seen[i] = 1; q.push(i); } }
    while (q.length) { const i = q.pop(), x = i % N, y = i / N | 0; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => { const X = x + a, Y = y + b; if (X < 0 || Y < 0 || X >= N || Y >= N) return; const j = this.idx(X, Y); if (!mine[j] && !seen[j]) { seen[j] = 1; q.push(j); } }); }
    for (let i = 0; i < N * N; i++) if ((mine[i] || !seen[i]) && this.own[i] !== this.myId) { this.own[i] = this.myId; got.push(i); this.capAt.set(i, now); }
    const before = this.cells; this.trail = []; this.trailSet = new Set(); this.recount(); this.emitCap(got); this.miniDirty = true;
    const gain = this.cells - before; if (gain > 0) { this.pops = this.pops || []; this.pops.push({ t: 1, txt: '+' + gain + '칸', x: this.cx + 0.5, y: this.cy + 0.5 }); if (window.Sound) Sound.clear(gain >= 60 ? 3 : gain >= 20 ? 2 : 1); }
  }
  // 한 칸에 들어설 때
  enter() {
    const N = TR_N, x = this.cx, y = this.cy;
    if (x < 0 || y < 0 || x >= N || y >= N) { this.cx = Math.max(0, Math.min(N - 1, x)); this.cy = Math.max(0, Math.min(N - 1, y)); this.die('경기장 벽에 부딪혔어요'); return; }
    const i = this.idx(x, y);
    if (this.trailSet.has(i)) { this.die('내 꼬리를 밟았어요'); return; }
    Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (!p.dead && p.trail.has(i)) { p.trail = new Set(); this.kills++; this.toast('✂️ ' + (p.name || '친구') + '의 꼬리를 잘랐어요!', '#FFE38A'); if (this.opts.onAttack) this.opts.onAttack('cut', id, {}); if (window.Sound) (Sound.kill || Sound.levelUp).call(Sound); } });
    if (this.own[i] === this.myId) { if (this.trail.length) this.capture(); }
    else { this.trail.push(i); this.trailSet.add(i); }
  }
  tick(now) {
    const { dt, f } = FX.frame(this, now), k = dt / 1000; this.run += k;
    if (this.deadUntil && now >= this.deadUntil) { this.spawn(); this.toast('다시 시작!', '#7DF58F'); }
    if (this.softDropping) this.turn(1);   // 키보드 ↓ (누르는 동안 표시만 옴)
    if (!this.isDead && !this.gameOver) {
      this.p += TR_SPEED * k;
      while (this.p >= 1 && !this.isDead) { this.p -= 1; this.cx += TR_DIRS[this.dir][0]; this.cy += TR_DIRS[this.dir][1];
        if (this.want !== this.dir && !((this.want + 2) % 4 === this.dir && this.trail.length)) this.dir = this.want; this.enter(); }
      // 친구 머리가 내 꼬리 위에 있으면 (신호가 늦어도 꼬리 잘림이 빠지지 않게)
      if (this.trail.length && !this.isDead) Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (p.dead || this.isDead) return; const i = this.idx(Math.round(p.tx), Math.round(p.ty)); if (this.trailSet.has(i) && i !== this.trail[this.trail.length - 1]) this.die((p.name || '친구') + '가 내 꼬리를 밟았어요', id); });
    }
    Object.values(this.peers).forEach(p => { p.x += ((p.tx == null ? p.x : p.tx) - p.x) * Math.min(1, k * 10); p.y += ((p.ty == null ? p.y : p.ty) - p.y) * Math.min(1, k * 10); });
    this.parts = FX.stepParts(this.parts, f, 0.03); this.pops = (this.pops || []).filter(q => (q.t -= 0.02 * f) > 0); this.toasts = this.toasts.filter(t => t.until > now);
    this.draw();
  }
  getSnapshot() {   // 교사 미니보드: 내 둘레 12×18칸
    const W = 12, H = 18, x0 = Math.round(this.cx - W / 2), y0 = Math.round(this.cy - H / 2), cidx = id => { const p = id === this.myId ? { ci: this.ci } : this.peers[id]; return p ? TR_CELLC[p.ci % TR_CELLC.length] : 21; };
    const g = []; for (let y = 0; y < H; y++) { const r = []; for (let x = 0; x < W; x++) { const X = x0 + x, Y = y0 + y; if (X < 0 || Y < 0 || X >= TR_N || Y >= TR_N) { r.push(12); continue; } const i = this.idx(X, Y), o = this.own[i]; r.push(this.trailSet.has(i) ? 22 : o ? cidx(o) : 0); } g.push(r); }
    return g;
  }
  colorOf(id) { if (id === this.myId) return TR_COLORS[this.ci]; const p = this.peers[id]; return p ? TR_COLORS[p.ci] : '#8B93A7'; }
  draw() {
    const ctx = this.ctx, W = this.canvas.clientWidth || this.canvas.width, H = this.canvas.clientHeight || this.canvas.height, u = Math.min(W, H) / (Math.min(W, H) > 600 ? TR_VIEW + 2 : TR_VIEW), VW = W / u, VH = H / u;
    const hx = this.cx + TR_DIRS[this.dir][0] * (this.isDead ? 0 : this.p), hy = this.cy + TR_DIRS[this.dir][1] * (this.isDead ? 0 : this.p);
    const camX = hx + 0.5 - VW / 2, camY = hy + 0.5 - VH / 2, sx = x => (x - camX) * u, sy = y => (y - camY) * u;
    ctx.fillStyle = '#121828'; ctx.fillRect(0, 0, W, H);
    // 경기장 바닥 (체크 무늬)
    const x0 = Math.max(0, Math.floor(camX)), x1 = Math.min(TR_N - 1, Math.ceil(camX + VW)), y0 = Math.max(0, Math.floor(camY)), y1 = Math.min(TR_N - 1, Math.ceil(camY + VH));
    ctx.fillStyle = '#EEF1F6'; ctx.fillRect(sx(0), sy(0), TR_N * u, TR_N * u);
    ctx.fillStyle = '#E2E7EF'; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if ((x + y) % 2) ctx.fillRect(sx(x), sy(y), u + 0.5, u + 0.5);
    // 땅 (주인 색 · 아래쪽 그림자로 입체감)
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const o = this.own[this.idx(x, y)]; if (!o) continue; const c = this.colorOf(o);
      ctx.fillStyle = FX.tint(c, -0.25); ctx.fillRect(sx(x), sy(y) + u * 0.12, u + 0.5, u + 0.5); ctx.fillStyle = FX.tint(c, 0.25); ctx.fillRect(sx(x), sy(y), u + 0.5, u * 0.92); }
    // 경기장 테두리
    ctx.strokeStyle = '#FF5C7A'; ctx.lineWidth = Math.max(2, u * 0.12); ctx.strokeRect(sx(0), sy(0), TR_N * u, TR_N * u);
    // 꼬리 (친구 · 나)
    const drawTrail = (cells, col) => { ctx.fillStyle = col; cells.forEach(i => { const x = i % TR_N, y = i / TR_N | 0; if (x < x0 - 1 || x > x1 + 1 || y < y0 - 1 || y > y1 + 1) return; FX.rr(ctx, sx(x) + u * 0.18, sy(y) + u * 0.18, u * 0.64, u * 0.64, u * 0.2); ctx.fill(); }); };
    Object.values(this.peers).forEach(p => { if (!p.dead) { ctx.globalAlpha = 0.75; drawTrail(p.trail, TR_COLORS[p.ci]); ctx.globalAlpha = 1; } });
    ctx.globalAlpha = 0.85; drawTrail(this.trail, TR_COLORS[this.ci]); ctx.globalAlpha = 1;
    // 머리 (친구 · 나) + 이름
    const head = (x, y, col, name, me) => { const X = sx(x), Y = sy(y), s = u * (me ? 1.08 : 1);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; FX.rr(ctx, X - s * 0.04, Y + s * 0.1, s, s, s * 0.25); ctx.fill();
      ctx.fillStyle = col; FX.rr(ctx, X - (s - u) / 2, Y - (s - u) / 2, s, s, s * 0.25); ctx.fill(); ctx.strokeStyle = '#1B2135'; ctx.lineWidth = Math.max(1.5, u * 0.08); ctx.stroke();
      ctx.fillStyle = '#fff'; [-0.18, 0.18].forEach(e => { ctx.beginPath(); ctx.arc(X + u / 2 + e * u, Y + u * 0.42, u * 0.12, 0, 7); ctx.fill(); }); ctx.fillStyle = '#1B2135'; [-0.18, 0.18].forEach(e => { ctx.beginPath(); ctx.arc(X + u / 2 + e * u, Y + u * 0.44, u * 0.06, 0, 7); ctx.fill(); });
      if (name) FX.text(ctx, name, X + u / 2, Y - u * 0.25, { size: Math.max(10, u * 0.42), weight: 800, color: '#fff', align: 'center', stroke: 'rgba(20,24,40,.85)' }); };
    Object.values(this.peers).forEach(p => { if (!p.dead) head(p.x, p.y, TR_COLORS[p.ci], p.name, false); });
    if (!this.isDead) head(hx, hy, TR_COLORS[this.ci], this.myName || '나', true);
    FX.drawParts(ctx, this.parts.map(q => ({ x: (q.x - camX), y: (q.y - camY), l: q.l, c: q.c })), u, Math.max(3, u * 0.22));
    (this.pops || []).forEach(q => { ctx.globalAlpha = Math.min(1, q.t * 1.5); FX.text(ctx, q.txt, sx(q.x), sy(q.y) - (1 - q.t) * u * 1.5, { size: u * 0.7, weight: 900, color: '#FFE38A', align: 'center', stroke: 'rgba(20,24,40,.9)' }); ctx.globalAlpha = 1; });
    // 미니맵 (오른쪽 위) · 내 땅 % · 순위
    const M = Math.min(W * 0.3, 110), mx = W - M - 8, my = 8, mk = M / TR_N;
    if (!this.mini) { this.mini = document.createElement('canvas'); this.mini.width = this.mini.height = TR_N; }
    if (this.miniDirty) { this.miniDirty = false; const g = this.mini.getContext('2d'), img = g.createImageData(TR_N, TR_N), rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
      for (let i = 0; i < TR_N * TR_N; i++) { const o = this.own[i], c = o ? rgb(this.colorOf(o)) : [40, 48, 70]; img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = 255; } g.putImageData(img, 0, 0); }
    ctx.fillStyle = 'rgba(10,14,28,.6)'; FX.rr(ctx, mx - 4, my - 4, M + 8, M + 8, 8); ctx.fill(); ctx.imageSmoothingEnabled = false; ctx.drawImage(this.mini, mx, my, M, M); ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = '#fff'; ctx.fillRect(mx + hx * mk - 2, my + hy * mk - 2, 4, 4);
    FX.text(ctx, this.pct.toFixed(1) + '%', 10, 30, { size: 24, weight: 900, color: TR_COLORS[this.ci], stroke: 'rgba(20,24,40,.85)' });
    FX.text(ctx, '✂ ' + this.kills + ' · 최고 ' + (Math.round(this.best / (TR_N * TR_N) * 1000) / 10) + '%', 10, 50, { size: 13, weight: 800, color: '#fff', stroke: 'rgba(20,24,40,.85)' });
    const rank = Object.values(this.peers).filter(p => !p.dead).map(p => [p.name || '친구', p.cells, p.ci]).concat([[this.myName || '나', this.cells, this.ci, 1]]).sort((a, b) => b[1] - a[1]).slice(0, 3);
    rank.forEach((r, i) => FX.text(ctx, (i + 1) + '. ' + r[0] + ' ' + (Math.round(r[1] / (TR_N * TR_N) * 1000) / 10) + '%', W - 10, my + M + 22 + i * 17, { size: 12.5, weight: r[3] ? 900 : 700, color: r[3] ? '#FFE38A' : '#fff', align: 'right', stroke: 'rgba(20,24,40,.85)' }));
    this.toasts.forEach((t, i) => FX.text(ctx, t.t, W / 2, H * 0.2 + i * 24, { size: 15, weight: 900, color: t.c, align: 'center', stroke: 'rgba(20,24,40,.9)' }));
    if (this.run < 4) FX.text(ctx, '화면 아무 데나 밀어서 방향 바꾸기 (방향키도 됨)', W / 2, H * 0.62, { size: 15, weight: 900, color: '#FFE38A', align: 'center', stroke: 'rgba(20,24,40,.9)' });
    if (this.run < 4) FX.text(ctx, '내 땅 밖에 선을 긋고 돌아오면 그 안이 내 땅!', W / 2, H * 0.62 + 22, { size: 13, weight: 800, color: '#fff', align: 'center', stroke: 'rgba(20,24,40,.9)' });
    if (this.isDead) { ctx.fillStyle = 'rgba(10,14,28,.45)'; ctx.fillRect(0, 0, W, H); FX.text(ctx, Math.max(1, Math.ceil((this.deadUntil - (this.now || 0)) / 1000)) + '', W / 2, H * 0.48, { size: 56, weight: 900, color: '#fff', align: 'center', stroke: 'rgba(20,24,40,.9)' }); }
  }
}
if (typeof window !== 'undefined') window.TerritoryGame = TerritoryGame;
