// 땅따먹기 대전 — 내 땅 밖으로 나가 선을 긋고 다시 내 땅으로 돌아오면, 선으로 둘러싼 곳이 모두 내 땅이 돼요.
//   밖에 있는 동안 내 꼬리(선)를 누가 밟으면 탈락 · 내가 남의 꼬리를 밟으면 그 친구가 탈락 · 내 꼬리를 내가 밟아도 탈락
//   반 전체가 한 경기장에서 실시간으로 (뱀 아레나와 같은 위치 신호 · 땅을 차지하면 'cap' 소식으로 모두에게)
//   (모바일 인기 'io 땅따먹기' 장르를 학교용으로 새로 만든 것 — 이름·그림은 모두 새로 그림)

const TR_VIEW = 10, TR_SPEED = 6.2;                      // 화면 짧은 변에 10칸(칸이 크게 보이게) · 초당 6.2칸
// 경기장 크기: 1인당 300칸 이상이 되게 인원에 맞춰 (8명까지 56×56 · 12명 60 · 15명 68 · 20명 80 · 30명 96 · 40명 이상 112)
//   (예전: 몇 명이든 56×56 — 30명이면 1인당 104칸이라 태어나자마자 남의 땅·꼬리와 부딪힘)
//   모든 기기가 같은 크기여야 하므로 위치 신호에 크기를 싣고: 판 시작 6초 안에는 가장 큰 값으로, 늦게 들어온 학생은 친구들 크기로 맞춤
const TR_N_MIN = 56, TR_N_MAX = 112, TR_PER = 300;
const trSize = n => Math.min(TR_N_MAX, Math.max(TR_N_MIN, 4 * Math.ceil(Math.sqrt(TR_PER * Math.max(1, n | 0)) / 4)));
const TR_GRID_C = 12, TR_GRID_R = 18;                     // games.js 의 grid — 페이지가 손가락 좌표를 이 칸 단위로 넘겨 줌
// 겉모습 48가지 = 색 12 × 무늬 4 (민무늬 · 빗금 · 물방울 · 바둑판) — 땅·꼬리·머리·이름표·순위표에 같은 색+무늬, 머리 모양도 무늬마다 다름(네모 · 동그라미 · 귀 · 마름모)
//   참가 순서(slot) k → 색 (k×5)%12 (이웃 번호끼리 색이 멀리 떨어짐), 무늬 ⌊k/12⌋ — 30명이면 색 12 × 무늬 3 안에서 모두 다름 · 늦게 들어와 겹치면 빈 것으로 바꿈
//   (예전: id 해시 % 색 10가지 — 10명만 돼도 같은 색이 자주 겹쳐 헷갈림)
const TR_HUES = ['#FF4D5E', '#FF9A2E', '#FFD43B', '#9BD93A', '#2EC96A', '#17C9B0', '#3FC4F5', '#4F7BFF', '#9B6CFF', '#E95CD9', '#FF8FB8', '#9A6A45'];
const TR_SKINS = [];
for (let k = 0; k < 48; k++) { const c = TR_HUES[(k * 5) % 12]; TR_SKINS.push({ c, pat: Math.floor(k / 12), dk: FX.tint(c, -0.28), lt: FX.tint(c, 0.22), pc: FX.tint(c, -0.5) }); }
const trSkin = k => TR_SKINS[((k | 0) % 48 + 48) % 48];
// 교사 미니보드 색 번호: 겉모습 색과 가장 비슷한 공용 색 (shared.js CELL_COLORS · 0 빈 칸 · 12 벽 · 21 모름 · 22 꼬리는 빼고)
const _trCode = {};
function trCellCode(k) {
  k = ((k | 0) % 48 + 48) % 48; if (_trCode[k] != null) return _trCode[k];
  const cand = [1, 2, 3, 4, 5, 6, 7, 31, 44, 45, 52, 54, 61, 64, 65, 69], rgb = h => [1, 3, 5].map(i => parseInt(String(h).slice(i, i + 2), 16));
  let best = 1, bd = 1e9; if (typeof CELL_COLORS !== 'undefined') { const a = rgb(trSkin(k).c); cand.forEach(c => { if (!CELL_COLORS[c]) return; const b = rgb(CELL_COLORS[c]); if (b.some(isNaN)) return; const d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2; if (d < bd) { bd = d; best = c; } }); }
  return (_trCode[k] = best);
}
// 무늬 한 칸 (x,y 왼쪽 위 · s 크기) — 같은 주인 칸을 모아 한 번에 그림
function trPatPath(ctx, pat, x, y, s) {
  if (pat === 1) { ctx.moveTo(x, y + s * 0.5); ctx.lineTo(x + s * 0.5, y); ctx.moveTo(x + s * 0.5, y + s); ctx.lineTo(x + s, y + s * 0.5); }
  else if (pat === 2) { ctx.moveTo(x + s * 0.68, y + s * 0.5); ctx.arc(x + s * 0.5, y + s * 0.5, s * 0.18, 0, 6.3); }
  else if (pat === 3) { ctx.rect(x, y, s * 0.5, s * 0.5); ctx.rect(x + s * 0.5, y + s * 0.5, s * 0.5, s * 0.5); }
}
function trPatFill(ctx, sk, cells, s) {   // cells: [x, y] 화면 좌표 목록
  if (!sk.pat || !cells.length) return; ctx.beginPath(); cells.forEach(q => trPatPath(ctx, sk.pat, q[0], q[1], s));
  if (sk.pat === 1) { ctx.strokeStyle = sk.pc; ctx.lineWidth = Math.max(1.5, s * 0.16); ctx.globalAlpha = 0.55; ctx.stroke(); }
  else { ctx.fillStyle = sk.pc; ctx.globalAlpha = sk.pat === 3 ? 0.22 : 0.5; ctx.fill(); }
  ctx.globalAlpha = 1;
}
// 이름표·순위표용 작은 견본 (색+무늬)
function trSwatch(ctx, sk, x, y, s) {
  ctx.fillStyle = sk.c; ctx.fillRect(x, y, s, s); trPatFill(ctx, sk, [[x, y]], s);
  ctx.strokeStyle = '#1B2135'; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, s, s);
}
// 땅 무늬는 32px 타일 그림을 반복 채우기로 (칸마다 따로 그리면 저사양에서 프레임당 3ms 넘게 듦)
const _trTile = {};
function trTile(ctx, sk) {
  if (!sk.pat || typeof document === 'undefined') return null; const k = TR_SKINS.indexOf(sk); if (_trTile[k] !== undefined) return _trTile[k];
  const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); trPatFill(g, sk, [[0, 0]], 32);
  const p = ctx.createPattern(c, 'repeat'); return (_trTile[k] = p && p.setTransform ? p : null);
}
const TR_DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];      // 0 오른쪽 · 1 아래 · 2 왼쪽 · 3 위
// 아이템 상자: 경기장 곳곳에 무작위로 생기고, 먼저 밟은 사람이 가져가요
//   나오는 때·머무는 시간·종류 = (판 시작 시각, 자리 s, 차례 g) 해시 → 모든 기기가 같고 판마다 다름 (예전: 1.8초마다 한 개씩 똑같은 박자)
//   놓을 칸 = 그 상자를 맡은 한 기기(차례마다 바뀜)가 빈 땅·머리/꼬리에서 먼 곳·다른 상자와 먼 곳을 골라 'ipos' 로 알림 → 모두 같은 칸
//   (예전: 해시 칸 그대로 — 30%가 이미 차지된 땅 위, 10%는 다른 상자 바로 옆)
const TR_ITEM_SLOTS = 10, TR_ITEM_LIFE = [11000, 19000], TR_ITEM_GAP = [1500, 6000];   // 동시에 최대 10개 · 상자마다 11~19초 머묾 · 사라지고(먹히고) 1.5~6초 뒤 다른 곳에
const TR_ITEM_LEAD = 700, TR_ITEM_WAIT = 1500, TR_ITEM_CAND = 24;                      // 0.7초 먼저 칸을 정해 알림 · 알림이 1.5초 안 오면 해시 칸 · 후보 24칸 중 가장 좋은 곳
const TR_INV_MS = 3000;   // 부활 뒤 무적: 이 동안 꼬리를 밟혀도 안 잘림 (같은 곳에 태어나 둘 다 바로 탈락하던 것)
const TR_ITEMS = {
  speed:   { name: '번개',          color: '#FFD166', good: true,  desc: '5초 동안 빨라져요',             ms: 5000 },
  shield:  { name: '방패',          color: '#4CC9F0', good: true,  desc: '6초 동안 꼬리를 밟혀도 안 잘려요', ms: 6000 },
  grow:    { name: '땅 넓히기',     color: '#06D6A0', good: true,  desc: '내 둘레 7×7칸이 바로 내 땅!' },
  mystery: { name: '수수께끼 상자', color: '#B15DFF', good: null,  desc: '좋을 수도, 나쁠 수도!' },
  slow:    { name: '거북이',        color: '#A0A8BA', good: false, desc: '5초 동안 느려져요',             ms: 5000 },
  reverse: { name: '뒤죽박죽',      color: '#FF9F43', good: false, desc: '5초 동안 방향이 반대로!',       ms: 5000 },
  fog:     { name: '안개',          color: '#7C86A2', good: false, desc: '5초 동안 앞이 잘 안 보여요',    ms: 5000 },
  inv:     { name: '부활 무적',     color: '#FFF3A0', good: true,  desc: '3초 동안 꼬리를 밟혀도 안 잘려요', ms: TR_INV_MS }   // 상자로는 안 나옴
};
const TR_DROP = ['speed', 'speed', 'speed', 'shield', 'shield', 'grow', 'grow', 'mystery', 'mystery', 'mystery'];   // 나오는 비율
// 점수 = 지금 차지한 땅의 비율(%) 소수 한 자리 — HUD·게임 안 순위표·위쪽 점수 칸·선생님 화면(sync score)·결과가 모두 이 숫자 하나
//   (예전: 위쪽 점수 칸·선생님 화면·결과 = '최고' 칸 수(예: 87), 게임 화면 = 지금 % (예: 2.8%) — 서로 다른 숫자에 순위도 '최고' 기준이라 어긋남)
//   다른 친구의 % 는 그 친구가 신호에 실어 보낸 자기 점수를 그대로 씀 (각자 계산하면 땅 맞춤이 늦을 때 달라짐)
const TR_GOAL = 50;                                       // 전체 칸의 50% 이상(표시 점수 50 이상)을 차지하면 경기 끝 · 그 학생 1등
const trPct = (cells, N) => Math.floor(cells * 1000 / (N * N)) / 10;   // 버림: 화면에 50 이 보이면 정말 전체 칸의 절반 이상 (반올림이면 1567/3136 = 49.97% 가 '50' 으로 보여 헷갈림)
const trFmt = s => String(+s || 0);                       // 12 → '12', 12.3 → '12.3' (위쪽 점수 칸·선생님 화면이 숫자를 그대로 보여 주는 모양과 같게)
const trClock = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
// 순위 규칙 (모든 화면·선생님 화면 같게): 목표 달성자 먼저 → 점수 내림차순 → 닉네임 → id
const trCmp = w => (a, b) => (a.id === w ? -1 : b.id === w ? 1 : 0) || (b.s - a.s) || String(a.name || '').localeCompare(String(b.name || ''), 'ko') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const trHash = (a, b, c) => { let h = (a | 0) ^ Math.imul(b + 0x9E37, 0x85EBCA6B) ^ Math.imul(c + 0x27D4, 0xC2B2AE35); h = Math.imul(h ^ (h >>> 15), 0x2C1B3C6D); h = Math.imul(h ^ (h >>> 12), 0x297A2D39); return ((h ^ (h >>> 15)) >>> 0) / 4294967296; };

class TerritoryGame {
  constructor(canvas, opts) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.opts = opts || {}; this.cellSize = this.opts.cellSize || 20;
    this.myId = this.opts.myId || 'me'; this.myName = this.opts.myName || '';
    // 겉모습 번호(0~47): 참가 순서대로 — 늦게 들어와 겹치면 housekeep 이 빈 번호로 바꿈
    this.ci = typeof this.opts.slot === 'number' ? this.opts.slot % TR_SKINS.length : Math.abs(String(this.myId).split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % TR_SKINS.length;
    this.setSize(trSize(Array.isArray(this.opts.roster) ? this.opts.roster.length : (this.opts.players || 1)));
    this.own = new Array(this.N * this.N).fill(null);           // 칸마다 주인 id (null = 빈 땅)
    this.peers = {}; this.parts = []; this.toasts = []; this.now = 0; this.lastTime = 0;
    this.score = 0; this.kills = 0; this.best = 0; this.cells = 0; this.gameOver = false;
    this.trail = []; this.trailSet = new Set(); this.capAt = new Map(); this.mini = null; this.miniDirty = true; this._full = 0; this.run = 0;
    this.clock = () => (this.opts.serverNow ? this.opts.serverNow() : Date.now());   // 서버 시계 (기기 시계가 달라도 상자가 같은 때 나옴)
    this.itemT0 = this.opts.seed || this.clock(); this.itemSeed = Math.floor(this.itemT0 / 7) | 0; this.joinAt = this.clock();
    this.taken = new Set(); this.items = []; this.fx = {}; this.sched = []; this.ipos = new Map(); this.isent = new Set(); this.picked = [];
    // 경기 끝: 시간(endAt, 서버 ms · 페이지가 game.endAt 을 바꿀 수 있음) 또는 50% 달성 — 끝나면 score·rank·total·endReason·winner 고정
    this.endAt = +this.opts.endAt || 0; this.endReason = null; this.winner = ''; this.winId = null; this.winName = ''; this.goalT = 0; this.rank = 0; this.total = 0; this.place = '-'; this.board = [];
    // 판 표시(시작 시각): 지난 판 신호(50% 넘은 채 남은 것 등)를 이번 판으로 잘못 읽지 않게
    this.tag = this.opts.seed ? (Math.floor(this.opts.seed / 1000) % 2176782336).toString(36) : '';
    this.spawn(this.opts.slot);
  }
  setSize(n) { this.N = n; this.slots = Math.min(28, Math.round(TR_ITEM_SLOTS * n * n / (TR_N_MIN * TR_N_MIN))); }   // 상자 수도 넓이에 비례 (56칸 10개 · 96칸 29→28개)
  // 친구와 경기장 크기가 다르면 맞춤: 칸 번호로 저장한 것들을 새 크기로 옮기고, 내가 밖에 있게 되면 다시 태어남
  resize(n) {
    const o = this.N; if (n === o || !(n >= TR_N_MIN && n <= TR_N_MAX)) return; this.setSize(n);
    const mv = i => { const x = i % o, y = i / o | 0; return x < n && y < n ? y * n + x : -1; }, own = new Array(n * n).fill(null);
    this.own.forEach((v, i) => { if (v) { const j = mv(i); if (j >= 0) own[j] = v; } }); this.own = own;
    this.trail = this.trail.map(mv).filter(j => j >= 0); this.trailSet = new Set(this.trail);
    const remap = m => { const r = new Map(); m.forEach((v, i) => { const j = mv(i); if (j >= 0) r.set(j, v); }); return r; };
    this.capAt = remap(this.capAt); if (this.trailAt) this.trailAt = remap(this.trailAt);
    Object.values(this.peers).forEach(p => { p.trailKey = null; });   // 다음 신호 때 꼬리 다시 읽음
    this.sched = []; this.mini = null; this.miniDirty = true; this.recount();
    if (this.cx >= n - 1 || this.cy >= n - 1 || !this.cells) { this.clearOwner(this.myId); this.spawn(); }
  }
  get pct() { return trPct(this.cells, this.N); }
  get isDead() { return this.now < this.deadUntil; }
  idx(x, y) { return y * this.N + x; }
  toast(t, c) { this.toasts.push({ t, c: c || '#fff', until: (this.now || 0) + 1800 }); }
  // ── 시작 · 부활: 다른 사람과 먼 빈 땅에 3×3 ──
  spawn(slot) {
    // 후보 칸마다: 둘레 5×5 가 빈 땅·꼬리 없음이어야 하고, 살아 있는 친구 머리에서 멀수록 · 둘레 9×9 가 비었을수록 좋음
    //   가장 좋은 한 곳만 고르면 같이 부활한 두 친구가 같은 곳(친구들에게서 가장 먼 곳)을 골라 겹쳐 태어나 함께 탈락 → 좋은 곳 4개 중 무작위
    const N = this.N, peers = Object.values(this.peers).filter(p => !p.dead), heads = peers.map(p => [p.tx != null ? p.tx : p.x, p.ty != null ? p.ty : p.y]);
    const busy = i => this.own[i] || peers.some(p => p.trail.has(i));
    const clear = (x, y, r) => { for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) { const X = x + a, Y = y + b; if (X < 1 || Y < 1 || X >= N - 1 || Y >= N - 1 || busy(this.idx(X, Y))) return false; } return true; };
    const score = (x, y) => { let open = 0; for (let b = -4; b <= 4; b++) for (let a = -4; a <= 4; a++) { const X = x + a, Y = y + b; if (X >= 0 && Y >= 0 && X < N && Y < N && !this.own[this.idx(X, Y)]) open++; }
      const near = heads.reduce((m, h) => Math.min(m, Math.hypot(h[0] - x, h[1] - y)), 99); return Math.min(near, 25) + open / 81 * 10; };
    let best = null;
    if (typeof slot === 'number') { const R = Math.max(30, Array.isArray(this.opts.roster) ? this.opts.roster.length : 0), a = slot * 2.39996, r = Math.sqrt((slot % R + 0.5) / R) * (N / 2 - 6), x = Math.round(N / 2 + Math.cos(a) * r), y = Math.round(N / 2 + Math.sin(a) * r);
      if (clear(x, y, 2)) best = [x, y]; }   // 처음: 참가 순서대로 경기장에 고르게
    if (!best) { const c = [];
      for (let k = 0; k < 140; k++) { const x = 4 + Math.floor(Math.random() * (N - 8)), y = 4 + Math.floor(Math.random() * (N - 8)); if (clear(x, y, 2)) c.push([x, y, score(x, y)]); }
      c.sort((p, q) => q[2] - p[2]); if (c.length) best = c[Math.floor(Math.random() * Math.min(4, c.length))]; }
    if (!best) best = [4 + Math.floor(Math.random() * (N - 8)), 4 + Math.floor(Math.random() * (N - 8))];
    this.cx = best[0]; this.cy = best[1]; this.p = 0; this.deadUntil = 0; this.trail = []; this.trailSet = new Set();
    this.fx.inv = (this.now || 0) + TR_INV_MS;   // 부활 무적 3초
    // 벽까지 가장 먼 쪽(경기장 가운데 쪽)을 보고 출발 — 예전엔 아무 쪽이나 봐서, 손을 안 대면 부활 뒤 2초 안에 벽에 부딪혀 탈락하는 일이 15%
    { const room = [N - 1 - this.cx, N - 1 - this.cy, this.cx, this.cy]; this.dir = room.indexOf(Math.max(...room)); this.want = this.dir; }
    const got = []; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const i = this.idx(this.cx + a, this.cy + b); if (this.own[i] !== this.myId) { this.own[i] = this.myId; got.push(i); } }
    this.recount(); this.emitCap(got); this.miniDirty = true;
  }
  // ── 조작: 네 방향 (바로 뒤로는 못 돌아감) ──
  turn(d) { if (this.isDead || this.gameOver) return; if (this.has('reverse')) d = (d + 2) % 4; if ((d + 2) % 4 === this.dir && this.trail.length) return; this.want = d; }
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
    const fl = (this.has('shield') ? 1 : 0) | (this.has('speed') ? 2 : 0) | (this.has('slow') ? 4 : 0) | (this.has('inv') ? 8 : 0);   // 효과 (친구 화면에 방패 고리 · 번개 꼬리 · 8 부활 무적 = 친구도 내 꼬리를 못 자름)
    let s = [hx.toFixed(2), hy.toFixed(2), this.dir, this.isDead ? 1 : 0, this.ci, this.kills, this.cells, fl, this.itemNote(), this.picked.filter(q => now - q.at < 4000).map(q => q.k).join(';'), this.N,
      this.score, this.tag, this.gameOver ? (this.endReason === 'goal' ? 'g' + this.winId : 't') : ''].join(',') + '|' + this.corners();   // 8: 내가 정한 상자 칸 · 9: 방금 먹은 상자 — 소식(events)이 빠져도 다음 위치 신호로 맞춰짐 · 10: 경기장 크기
    //   11: 내 점수(%) — 친구 화면 순위표가 이 값을 그대로 씀 · 12: 판 표시 · 13: 경기 끝(t 시간 · g+달성자 id) — '달성' 소식이 빠져도 이 신호로 끝남
    if (now - this._full > ((this.opts.sendMs || 165) > 200 ? 4000 : 2000)) { this._full = now; s += '|' + this.terrRle(); }   // 2초마다 내 땅 전체 (늦게 들어온 친구도 땅을 보게) — 21명 이상(전송 간격이 길 때)은 4초마다: 땅이 넓어지면 이 부분이 신호의 대부분이라
    return s;
  }
  corners() { const T = this.trail; if (!T.length) return ''; const out = []; for (let i = 0; i < T.length; i++) { const a = T[i - 1], b = T[i], c = T[i + 1]; if (!a || !c || (b % this.N - a % this.N) !== (c % this.N - b % this.N) || ((b / this.N | 0) - (a / this.N | 0)) !== ((c / this.N | 0) - (b / this.N | 0))) out.push((b % this.N) + '.' + (b / this.N | 0)); } return out.join(';'); }
  terrRle() { const rows = []; for (let y = 0; y < this.N; y++) { let run = null, r = []; for (let x = 0; x <= this.N; x++) { const m = x < this.N && this.own[this.idx(x, y)] === this.myId; if (m && run == null) run = x; if (!m && run != null) { r.push(run + '-' + (x - 1)); run = null; } } if (r.length) rows.push(y + ':' + r.join('.')); } return rows.join('/'); }
  static rleCells(s, N) { const out = []; String(s || '').split('/').forEach(row => { const [y, rs] = row.split(':'); if (rs == null) return; const Y = +y; rs.split('.').forEach(r => { const [a, b] = r.split('-').map(Number); if (!(Y >= 0 && Y < N && a >= 0 && b < N && a <= b)) return; for (let x = a; x <= b; x++) out.push(Y * N + x); }); }); return out; }
  rleOf(cells) { const by = {}; cells.forEach(i => { const y = i / this.N | 0; (by[y] = by[y] || []).push(i % this.N); }); return Object.keys(by).map(y => { const xs = by[y].sort((a, b) => a - b), r = []; let s = xs[0], p = xs[0]; for (let k = 1; k <= xs.length; k++) { if (xs[k] === p + 1) { p = xs[k]; continue; } r.push(s + '-' + p); s = p = xs[k]; } return y + ':' + r.join('.'); }).join('/'); }
  emitCap(cells) { if (cells.length && this.opts.onAttack) this.opts.onAttack('cap', null, { rle: this.rleOf(cells) }); }
  applyPeerRaw(id, raw, name) {
    if (typeof raw !== 'string' || id === this.myId) return; const [h, tr, terr] = raw.split('|'), a = h.split(',');
    const x = +a[0], y = +a[1]; if (!isFinite(x) || !isFinite(y)) return;
    if (this.tag && a[12] != null && a[12] !== this.tag) return;   // 다른 판 신호 (지난 판에 남은 것)
    if (this.gameOver) {   // 경기가 끝난 뒤: 친구의 마지막(고정) 점수만 받아 순위를 다시 셈 — 땅·꼬리는 더 바꾸지 않음
      if (+a[10] && (+a[10] | 0) !== this.N) return; const p = this.peers[id] || (this.peers[id] = { x, y, trailKey: null, trail: new Set(), trailPts: [] });
      p.pct = a[11] != null && a[11] !== '' ? +a[11] || 0 : trPct(+a[6] || 0, this.N); p.dead = a[3] === '1'; p.name = name || p.name || ''; p.rcvS = this.clock(); p.ci = (+a[4] || 0) % TR_SKINS.length;
      if (a[13] && a[13][0] === 'g' && this.endReason === 'time') this.onGoal(a[13].slice(1) || id, this.endAt);   // 시간 끝 직전에 누가 달성했었음
      this.rerank(); return; }
    { const n = +a[10] | 0, t = this.clock(), first = this.firstPeerAt == null; if (first) this.firstPeerAt = t;
      if (n && n !== this.N) {   // 경기장 크기 맞추기: 판 시작 6초 안 = 큰 쪽으로 · 늦게 들어왔으면 첫 신호의 크기 → 1.5초 동안 그중 작은 쪽(먼저 온 친구들 크기)
        const early = t < this.itemT0 + 6000, late = this.joinAt > this.itemT0 + 6000 && t < this.firstPeerAt + 1500;
        if ((early && n > this.N) || (late && (first || n < this.N))) this.resize(n);
        if (n !== this.N) return; } }   // 크기가 다른 신호는 쓰지 않음 (칸 번호가 어긋남)
    const p = this.peers[id] || (this.peers[id] = { x, y, trailKey: null, trail: new Set(), trailPts: [] }), dead = a[3] === '1';
    if (!p.dead && dead) { this.clearOwner(id); p.trail = new Set(); p.trailPts = [];   // 친구가 탈락: 그 땅이 비어요
      if (p.pcut > 0 && (this.now || 0) - p.pcut < 1500) { p.pcut = 0; this.kills++; this.toast('✂️ ' + (name || p.name || '친구') + '의 꼬리를 잘랐어요!', '#FFE38A'); if (window.Sound) (Sound.kill || Sound.levelUp).call(Sound); } }   // 머리 너머를 자른 뒤 1.5초 안에 탈락
    if (a[8]) a[8].split(';').forEach(q => { const m = q.split('.'); if (m.length === 3) this.setIpos(m[0], +m[1], +m[2], id); });
    if (a[9]) a[9].split(';').forEach(k => { if (k && !this.taken.has(k)) { this.taken.add(k); this.items = this.items.filter(q => q.key !== k); } });
    if (Math.hypot(p.x - x, p.y - y) > 3) { p.x = x; p.y = y; }
    Object.assign(p, { tx: x, ty: y, dir: +a[2] || 0, dead, ci: (+a[4] || 0) % TR_SKINS.length, kills: +a[5] || 0, cells: +a[6] || 0, fl: +a[7] || 0, name: name || p.name || '' });
    p.pct = a[11] != null && a[11] !== '' ? +a[11] || 0 : trPct(p.cells, this.N); p.rcvS = this.clock();   // 그 친구가 보낸 자기 점수 그대로
    if (!this.tag || a[12] === this.tag) {   // 같은 판 신호일 때만: 친구가 이미 끝났거나(소식이 빠짐) 50% 를 넘었으면 나도 끝
      const ef = a[13] || '';
      if (ef[0] === 'g') { this.onGoal(ef.slice(1) || id, 0, ef.slice(1) === id ? name : ''); return; }
      if (ef === 't' && this.endAt > 0) { this.finish('time'); return; }
      if (!dead && p.pct >= TR_GOAL) { this.onGoal(id, 0, name); return; } }
    // 도착 간격(이동 평균)으로 '다음 신호가 올 때쯤 받은 위치 조금 앞에 닿는' 속도를 정함 → 그 사이를 고른 속도로 감 (tick). 보내는 간격은 인원에 따라 165~235ms
    { const now = this.now || 0, iv = p.iv || this.opts.sendMs || 165; p.iv = p.rcv == null ? iv : (now - p.rcv < iv * 2.5 ? iv + (Math.max(40, now - p.rcv) - iv) * 0.15 : iv); p.rcv = now; p.rcvS = this.clock();
      const N = Math.max(3, p.iv / 16.7), v = TR_SPEED / 60 * (p.fl & 2 ? 1.5 : 1) * (p.fl & 4 ? 0.6 : 1), M = N * 0.1, dist = Math.abs(x - p.x) + Math.abs(y - p.y);
      p.spd = Math.max(v * 0.5, Math.min(v * 2.5, (dist - v * M) / N)); p.mg = v * M; }
    if (tr !== p.trailKey) { p.trailKey = tr; p.trail = new Set(); p.trailPts = []; const pts = (tr || '').split(';').filter(Boolean).map(q => q.split('.').map(Number)).filter(q => q.length === 2 && q.every(isFinite));
      for (let k = 0; k < pts.length; k++) { const [x0, y0] = pts[k], nx = pts[k + 1] || pts[k]; const dx = Math.sign(nx[0] - x0), dy = Math.sign(nx[1] - y0); let X = x0, Y = y0, g = 0; p.trail.add(this.idx(X, Y)); while ((X !== nx[0] || Y !== nx[1]) && g++ < 200) { X += dx; Y += dy; p.trail.add(this.idx(X, Y)); } }
      p.trailPts = pts; }
    if (terr != null && !dead) { const want = new Set(TerritoryGame.rleCells(terr, this.N)), now = this.now || 0;   // 그 친구 땅 전체로 맞춤 (내가 방금 빼앗은 칸은 그대로)
      for (let i = 0; i < this.own.length; i++) { if (this.own[i] === id && !want.has(i)) this.own[i] = null; }
      want.forEach(i => { if (this.own[i] === this.myId && (now - (this.capAt.get(i) || -1e9) < 3000)) return; if (this.own[i] !== id) { if (this.own[i] === this.myId) this.lostCell(i); this.own[i] = id; } });
      this.recount(); this.miniDirty = true; }
  }
  setPeers(map) { Object.keys(map).forEach(id => { const d = map[id]; if (d && d.raw) this.applyPeerRaw(id, d.raw, d.name); }); Object.keys(this.peers).forEach(id => { if (!map[id]) this.removePeer(id); }); }
  removePeer(id) { if (!this.peers[id]) return; this.clearOwner(id); delete this.peers[id]; }
  clearOwner(id) { for (let i = 0; i < this.own.length; i++) if (this.own[i] === id) this.own[i] = null; this.miniDirty = true; }
  lostCell() {}
  // 친구의 받은 머리 칸 너머로 '지금쯤 곧게 더 간' 칸들 (최대 3칸) 안에 i 가 있나 — 그 친구 땅에 들어가면 꼬리가 없으니 멈춤
  freshTrail(p, id, i) {
    if (p.tx == null || p.rcv == null) return false;
    const D = TR_DIRS[p.dir | 0] || TR_DIRS[0], X = D[0] > 0 ? Math.floor(p.tx + 1e-6) : D[0] < 0 ? Math.ceil(p.tx - 1e-6) : Math.round(p.tx), Y = D[1] > 0 ? Math.floor(p.ty + 1e-6) : D[1] < 0 ? Math.ceil(p.ty - 1e-6) : Math.round(p.ty);
    const v = TR_SPEED * (p.fl & 2 ? 1.5 : 1) * (p.fl & 4 ? 0.6 : 1), K = Math.min(3, Math.ceil(v * ((this.now || 0) - p.rcv + 150) / 1000));
    for (let k = 1; k <= K; k++) { const x = X + D[0] * k, y = Y + D[1] * k; if (x < 0 || y < 0 || x >= this.N || y >= this.N) return false; const c = this.idx(x, y); if (this.own[c] === id) return false; if (c === i) return true; }
    return false;
  }
  onEvent(e) {
    if (!e || e.by === this.myId) return;
    if (e.type === 'goal') { this.onGoal(String(e.by), +e.t || 0, e.name || ''); return; }   // 누가 50% 달성 → 모든 화면 경기 끝
    if (this.gameOver) return;   // 끝난 뒤엔 땅·탈락이 바뀌지 않음 (점수 고정)
    if (e.type === 'cap') { const cells = TerritoryGame.rleCells(e.rle, this.N); let lost = 0; cells.forEach(i => { if (this.own[i] === this.myId) lost++; this.own[i] = e.by; }); this.recount(); this.miniDirty = true;
      if (lost >= 8 && !this.isDead) this.toast('😮 ' + ((this.peers[e.by] || {}).name || '친구') + '가 내 땅 ' + lost + '칸을 가져갔어요', '#FFB3BF'); }
    if (e.type === 'item' && e.k) { this.taken.add(e.k); this.items = this.items.filter(q => q.key !== e.k); }
    if (e.type === 'ipos' && e.k) this.setIpos(String(e.k), +e.x, +e.y, String(e.by || ''));
    if (e.type === 'cut' && e.target === this.myId && !this.isDead && this.trail.length) { if (e.c != null && (!this.trailSet.has(+e.c) || (e.ct && this.trailAt && this.trailAt.get(+e.c) > e.ct))) return;   // 그 칸이 지금 내 꼬리가 아니거나(벌써 땅으로 돌아옴 · 예측이 빗나감) 친구가 지나간 뒤에 내가 들어갔으면 무시
      if (this.has('shield')) { this.toast('🛡 방패가 꼬리를 지켰어요!', '#9BE7FF'); return; } if (this.has('inv')) return; this.die(((this.peers[e.by] || {}).name || '친구') + '가 내 꼬리를 밟았어요', e.by); }
  }
  recount() { let n = 0; for (let i = 0; i < this.own.length; i++) if (this.own[i] === this.myId) n++; this.cells = n; if (this.gameOver) return; this.score = trPct(n, this.N); this.best = Math.max(this.best, this.score); }   // best: 가장 넓었을 때 % (참고용)
  // ── 경기 끝 ── reason 'time' | 'goal' · 그 순간의 내 % 로 고정 · 순위 = 나 + 신호가 오는 친구들(각자 보낸 %) — 달성자 1등
  finish(reason, winId, t) {
    if (this.gameOver) return;
    this.gameOver = true; this.endReason = reason; this.winId = reason === 'goal' ? String(winId) : null; this.goalT = reason === 'goal' ? (t || this.clock()) : 0;
    this.sw = null; this.rerank();   // (끝 소리·색종이는 페이지가)
  }
  // 달성 소식(또는 신호) — 아직 안 끝났으면 끝 · 이미 끝났어도 더 먼저 달성한 사람이면 그 사람으로 (두 화면이 다른 달성자를 고르지 않게: 이른 시각 → id 작은 쪽)
  onGoal(by, t, name) {
    if (!by) return; by = String(by);
    const nm = by === this.myId ? (this.myName || '나') : (name || (this.peers[by] || {}).name || (this.opts.nameOf && this.opts.nameOf(by)) || '');
    if (!this.gameOver) { this.winName = nm; this.finish('goal', by, t); return; }
    if (by === this.winId) { if (nm && this.winName !== nm) { this.winName = nm; this.rerank(); } return; }
    const tt = t || this.clock(), earlier = this.endReason === 'time' ? (t > 0 && t <= this.endAt) : (tt < this.goalT - 300 || (Math.abs(tt - this.goalT) <= 300 && by < this.winId));
    if (!earlier) return;
    this.endReason = 'goal'; this.winId = by; this.goalT = tt; this.winName = nm; this.rerank();
  }
  rerank() {
    const now = this.clock(), w = this.winId, list = [{ id: this.myId, name: this.myName || '나', s: this.score }];
    for (const id in this.peers) { const p = this.peers[id]; if ((p.rcvS != null && now - p.rcvS > 6000) && id !== w) continue; list.push({ id, name: p.name || (this.opts.nameOf && this.opts.nameOf(id)) || '', s: +p.pct || 0, ci: p.ci }); }
    if (w && !list.some(e => e.id === w)) list.push({ id: w, name: this.winName || (this.opts.nameOf && this.opts.nameOf(w)) || '친구', s: TR_GOAL });   // 달성자 신호가 아직 안 왔어도 순위에 넣음
    list.sort(trCmp(w)); this.board = list;
    this.rank = list.findIndex(e => e.id === this.myId) + 1; this.total = list.length; this.place = this.rank + '/' + this.total;
    const top = list[0]; this.winner = top.id === this.myId ? (this.myName || '나') : (top.id === w && this.winName) || top.name || '친구';
  }
  die(why, by) {
    if (this.isDead) return; this.deadUntil = (this.now || 0) + 3000; this.burst(this.cx + 0.5, this.cy + 0.5, 28, trSkin(this.ci).c);
    this.clearOwner(this.myId); this.trail = []; this.trailSet = new Set(); this.fx = {}; this.recount(); this.toast((why || '탈락') + ' · 3초 뒤 다시 시작', '#FF8A8A');
    if (window.Sound) (Sound.death || Sound.crash).call(Sound); if (window.Haptic && Haptic.big) Haptic.big();
  }
  burst(x, y, n, c) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = 0.04 + Math.random() * 0.12; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 1, c }); } }
  // 꼬리를 끌고 내 땅에 돌아옴: 꼬리 + 꼬리로 둘러싼 곳 → 내 땅 (바깥에서 물을 부어 닿지 않는 곳 = 둘러싸인 곳)
  capture() {
    const N = this.N, mine = new Uint8Array(N * N), got = [], now = this.now || 0;
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
    const N = this.N, x = this.cx, y = this.cy;
    if (x < 0 || y < 0 || x >= N || y >= N) { this.cx = Math.max(0, Math.min(N - 1, x)); this.cy = Math.max(0, Math.min(N - 1, y)); this.die('경기장 벽에 부딪혔어요'); return; }
    const i = this.idx(x, y);
    if (this.trailSet.has(i)) { this.die('내 꼬리를 밟았어요'); return; }
    const it = this.items.find(q => q.x === x && q.y === y); if (it) this.pickup(it);
    Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (p.dead || (p.fl & 9)) return;   // 방패·부활 무적인 친구 꼬리는 안 잘림
      if (p.trail.has(i)) { p.trail = new Set(); this.kills++; this.toast('✂️ ' + (p.name || '친구') + '의 꼬리를 잘랐어요!', '#FFE38A'); if (this.opts.onAttack) this.opts.onAttack('cut', id, { c: i, ct: Math.round(this.clock()) }); if (window.Sound) (Sound.kill || Sound.levelUp).call(Sound); }
      // 받은 꼬리 끝(머리) 너머: 신호가 오는 사이 친구가 곧게 더 가며 만든 꼬리 — 그 친구 기기가 칸을 확인해 탈락 (점수는 탈락 신호를 받으면)
      //   (신호 간격이 길면(인원이 많은 판) 머리 바로 뒤를 가로지른 자르기가 20% 넘게 빠지던 것 — 모의 실험)
      else if (!(p.pcut > 0 && (this.now || 0) - p.pcut < 1500) && this.freshTrail(p, id, i)) { p.pcut = this.now || 1; if (this.opts.onAttack) this.opts.onAttack('cut', id, { c: i, ct: Math.round(this.clock()) }); } });
    if (this.own[i] === this.myId) { if (this.trail.length) this.capture(); }
    else { this.trail.push(i); this.trailSet.add(i); (this.trailAt || (this.trailAt = new Map())).set(i, this.clock()); }   // trailAt: 그 칸에 들어간 시각(서버 시계) — 자르기 확인 · 친구 머리 신호가 그보다 오래된 것이면 '밟음' 아님
  }
  tick(now) {
    const { dt, f } = FX.frame(this, now), k = dt / 1000; this.run += k;
    if (!this.gameOver && this.endAt > 0 && this.clock() >= this.endAt) this.finish('time');   // 시간 끝 (서버 시계 — 모든 화면이 같은 순간)
    if (this.gameOver) { this.parts = FX.stepParts(this.parts, f, 0.03); this.draw(); return; }
    if (this.deadUntil && now >= this.deadUntil) { this.spawn(); this.toast('다시 시작!', '#7DF58F'); }
    if (this.softDropping) this.turn(1);   // 키보드 ↓ (누르는 동안 표시만 옴)
    if (now - (this._hk || 0) > 1000) { this._hk = now; this.fixSkin(now); }
    this.placeItems(); this.items = this.currentItems();
    if (this.has('speed') && Math.random() < 0.5) this.parts.push({ x: this.cx + TR_DIRS[this.dir][0] * this.p + 0.5 + (Math.random() - 0.5) * 0.4, y: this.cy + TR_DIRS[this.dir][1] * this.p + 0.5 + (Math.random() - 0.5) * 0.4, vx: 0, vy: 0, l: 0.7, c: '#FFE38A' });
    if (!this.isDead && !this.gameOver) {
      this.p += TR_SPEED * (this.has('speed') ? 1.5 : 1) * (this.has('slow') ? 0.6 : 1) * k;
      while (this.p >= 1 && !this.isDead) { this.p -= 1; this.cx += TR_DIRS[this.dir][0]; this.cy += TR_DIRS[this.dir][1];
        if (this.want !== this.dir && !((this.want + 2) % 4 === this.dir && this.trail.length)) this.dir = this.want; this.enter(); }
      // 친구 머리가 내 꼬리 위에 있으면 (신호가 늦어도 꼬리 잘림이 빠지지 않게) — 단 그 칸에 신호가 오기 0.25초 전보다 늦게 들어갔으면 친구가 먼저 지나간 것 (예전: 바로 뒤를 자르면 자른 쪽도 함께 탈락)
      if (this.trail.length && !this.isDead && !this.has('shield') && !this.has('inv')) Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (p.dead || this.isDead) return; const i = this.idx(Math.round(p.tx), Math.round(p.ty)), at = this.trailAt && this.trailAt.get(i); if (this.trailSet.has(i) && i !== this.trail[this.trail.length - 1] && !(at != null && p.rcvS != null && at > p.rcvS - 250)) this.die((p.name || '친구') + '가 내 꼬리를 밟았어요', id); });
      // 50% 달성: 모두에게 알리고 경기 끝 (소식이 빠진 기기는 내 위치 신호의 점수·끝 표시로 알아챔)
      if (!this.isDead && this.score >= TR_GOAL) { const t = Math.round(this.clock()); if (this.opts.onAttack) this.opts.onAttack('goal', null, { name: this.myName || '', pct: this.score }); this.winName = this.myName || '나'; this.finish('goal', this.myId, t); }
    }
    // 친구 머리: 받은 위치까지 정해 둔 속도로 고르게 (칸 따라 ㄱ자로 — 먼저 지금 방향의 줄에 맞춘 뒤 그 줄을 따라). 다음 신호가 늦으면 서서히 늦추고, 닿은 뒤엔 지금 방향으로 0.35칸까지만 더
    //   (예전: 남은 거리의 일정 비율씩 — 신호를 받을 때마다 확 갔다가 멈칫, 간격이 길수록 심해짐. 모의 실험 235ms: 멈칫 프레임 15% → 1%)
    Object.values(this.peers).forEach(p => { if (p.tx == null) return;
      const D = TR_DIRS[p.dir | 0] || TR_DIRS[0], ex = p.tx - p.x, ey = p.ty - p.y, ah = ex * D[0] + ey * D[1], side = D[0] ? ey : ex, dist = Math.max(0, ah) + Math.abs(side);   // ah: 앞쪽 남은 거리 · side: 옆 어긋남
      let m = (p.spd || TR_SPEED / 60) * f * Math.min(1, 0.4 + 0.6 * dist / Math.max(1e-6, p.mg || 0.3));
      const s1 = Math.min(Math.abs(side), m); m -= s1; if (D[0]) p.y += Math.sign(side) * s1; else p.x += Math.sign(side) * s1;   // 먼저 줄 맞추기
      let fw = 0;
      if (Math.abs(side) - s1 < 1e-9) { if (ah > 0) { fw = Math.min(ah, m); m -= fw; }      // 그 줄을 따라 받은 위치까지
        if (m > 0 && !p.dead) fw += Math.min(m, Math.max(0, 0.35 - Math.max(0, fw - ah))); }  // 다음 신호가 늦으면 지금 방향으로 조금만 더 (멈칫 대신 · 꺾였으면 다음 신호 때 되돌아감)
      p.x += D[0] * fw; p.y += D[1] * fw; });
    this.parts = FX.stepParts(this.parts, f, 0.03); this.pops = (this.pops || []).filter(q => (q.t -= 0.02 * f) > 0); this.toasts = this.toasts.filter(t => t.until > now);
    this.draw();
  }
  // 늦게 들어와 다른 친구와 겉모습 번호가 같으면(id 가 큰 쪽이) 아무도 안 쓰는 번호로 — 참가 순서 번호와 가까운 것부터
  fixSkin(now) {
    const used = new Set(); let clash = false;
    for (const id in this.peers) { const p = this.peers[id]; if (p.rcv == null || now - p.rcv > 6000) continue; used.add(p.ci); if (p.ci === this.ci && id < this.myId) clash = true; }
    if (clash) for (let k = 0; k < TR_SKINS.length; k++) if (!used.has(k)) { this.ci = k; this.miniDirty = true; break; }
  }
  // ── 아이템 ──
  has(k) { return !this.isDead && (this.fx[k] || 0) > (this.now || 0); }
  // 자리 s 의 상자 차례표: g 번째 상자가 st 에 나와 life 동안 머물고, gap 뒤 다음 상자 (모두 해시 — 모든 기기가 같음)
  slotAt(s, t) {
    const H = (b, g) => trHash(this.itemSeed, b, g), life = g => TR_ITEM_LIFE[0] + H(s + 300, g) * (TR_ITEM_LIFE[1] - TR_ITEM_LIFE[0]), gap = g => TR_ITEM_GAP[0] + H(s + 400, g) * (TR_ITEM_GAP[1] - TR_ITEM_GAP[0]);
    let c = this.sched[s];
    if (!c || t < c.st) c = { g: 0, st: 2500 + H(s + 500, 0) * 8000 };   // 첫 상자: 시작 2.5~10.5초 사이 제각각
    if (c.life == null) c.life = life(c.g);
    while (t >= c.st + c.life + gap(c.g)) { c.st += c.life + gap(c.g); c.g++; c.life = life(c.g); }
    return (this.sched[s] = c);
  }
  // 후보 칸 j (벽에서 3칸 안쪽)
  itemCand(s, g, j) { return [3 + Math.floor(trHash(this.itemSeed, 1000 + s * 40 + j, g) * (this.N - 6)), 3 + Math.floor(trHash(this.itemSeed, 3000 + s * 40 + j, g) * (this.N - 6))]; }
  setIpos(k, x, y, by) {
    if (!(x >= 0 && y >= 0 && x < this.N && y < this.N)) return; const c = this.ipos.get(k);
    if (!c || by < c.by) this.ipos.set(k, { x: x | 0, y: y | 0, by });   // 두 기기가 같이 정했으면 id 가 작은 쪽 (모든 기기가 같은 답)
  }
  // 이 상자를 맡을 기기: 지금 신호가 오는 친구 + 나를 id 순으로 세우고 해시로 고른 사람(0순위), 그 다음 사람(1순위 · 1초 뒤에도 소식이 없으면)
  itemDealer(s, g) {
    const now = this.now || 0, ids = Object.keys(this.peers).filter(id => this.peers[id].rcv != null && now - this.peers[id].rcv < 4000).concat([this.myId]).sort();
    const i0 = Math.floor(trHash(this.itemSeed, s + 200, g) * ids.length) % ids.length, me = ids.indexOf(this.myId);
    return (me - i0 + ids.length) % ids.length;   // 내 순위
  }
  // 위치 신호에 붙이는 '내가 정한 상자 칸' (아직 있는 것만 · 'ipos' 소식을 놓친 기기도 맞춤)
  itemNote() {
    const out = []; this.ipos.forEach((v, k) => { if (v.by !== this.myId || this.taken.has(k)) return; const [ks, kg] = k.split(':').map(Number), c = this.sched[ks]; if (c && (kg === c.g || kg === c.g + 1)) out.push(k + '.' + v.x + '.' + v.y); });
    return out.join(';');
  }
  // 곧 나올 상자의 칸을 정해 알리기 (맡은 기기만)
  placeItems() {
    const t = this.clock() - this.itemT0;
    if (this.joinAt > this.itemT0 + 6000 && this.clock() - this.joinAt < 2500) return;   // 늦게 들어옴: 친구들 신호를 2.5초 받은 뒤부터 맡음 (그 전엔 내가 맡는 줄 잘못 알 수 있음)
    if (this.ipos.size > 60) this.ipos.forEach((v, k) => { const [ks, kg] = k.split(':').map(Number), c = this.sched[ks]; if (c && kg < c.g - 1) { this.ipos.delete(k); this.isent.delete(k); } });   // 지난 상자 정리
    for (let s = 0; s < this.slots; s++) {
      const c = this.slotAt(s, t); let g = c.g, st = c.st;
      if (t >= c.st + c.life) { g = c.g + 1; st = c.st + c.life + TR_ITEM_GAP[0] + trHash(this.itemSeed, s + 400, c.g) * (TR_ITEM_GAP[1] - TR_ITEM_GAP[0]); }   // 쉬는 중: 다음 상자
      const key = s + ':' + g; if (this.ipos.has(key) || this.isent.has(key) || this.taken.has(key)) continue;
      const rank = t >= st - TR_ITEM_LEAD ? this.itemDealer(s, g) : 9; if (rank > 1 || t < st - TR_ITEM_LEAD + rank * 1000) continue;
      this.isent.add(key); const [x, y] = this.pickSpot(s, g, key); this.setIpos(key, x, y, this.myId);
      if (this.opts.onAttack) this.opts.onAttack('ipos', null, { k: key, x, y });
    }
  }
  // 후보 중 가장 좋은 칸: 빈 땅 · 꼬리 아님 · 머리(나·친구)에서 3칸 넘게 · 다른 상자와 멀리 (땅이 다 찼으면 그중 덜 나쁜 곳)
  pickSpot(s, g, key) {
    const heads = [], others = [], ahead = (x, y, d) => { const D = TR_DIRS[d | 0] || TR_DIRS[0]; heads.push([x, y], [x + D[0] * 2, y + D[1] * 2], [x + D[0] * 4, y + D[1] * 4]); };   // 머리 + 가는 방향 2·4칸 앞 (0.7초 뒤 나올 때쯤 있을 곳)
    if (!this.isDead) ahead(this.cx, this.cy, this.dir);
    Object.values(this.peers).forEach(p => { if (!p.dead && p.tx != null) ahead(p.tx, p.ty, p.dir); });
    this.ipos.forEach((v, k) => { if (k !== key && !this.taken.has(k)) { const [ks, kg] = k.split(':').map(Number), c = this.sched[ks]; if (c && (kg === c.g || kg === c.g + 1)) others.push([v.x, v.y]); } });
    let best = null, bs = -1e9;
    for (let j = 0; j < TR_ITEM_CAND; j++) {
      const [x, y] = this.itemCand(s, g, j), i = this.idx(x, y); let sc = 0;
      if (this.own[i]) sc -= 100; if (this.trailSet.has(i) || Object.values(this.peers).some(p => !p.dead && p.trail.has(i))) sc -= 150;
      for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) if (this.own[this.idx(x + a, y + b)]) sc -= 4;   // 둘레도 빈 땅이면 더 좋음
      const hd = heads.reduce((m, h) => Math.min(m, Math.max(Math.abs(h[0] - x), Math.abs(h[1] - y))), 99); sc += hd <= 3 ? -120 : Math.min(hd, 10) * 2;
      const od = others.reduce((m, o) => Math.min(m, Math.hypot(o[0] - x, o[1] - y)), 99); sc += od < 5 ? -80 : Math.min(od, 16) * 3;
      if (sc > bs) { bs = sc; best = [x, y]; }
    }
    return best;
  }
  // 지금 경기장에 있는 상자 (정해진 칸이 있으면 그 칸 · 알림이 늦으면 해시 칸)
  currentItems() {
    const t = this.clock() - this.itemT0, out = [];
    for (let s = 0; s < this.slots; s++) {
      const c = this.slotAt(s, t), ph = t - c.st; if (ph < 0 || ph >= c.life) continue;
      const g = c.g, key = s + ':' + g; if (this.taken.has(key)) continue;
      const at = this.itemT0 + c.st; if (at < this.joinAt - 4000) continue;   // 내가 들어오기 전에 생긴 상자 — 누가 이미 가져갔을 수 있어 안 보임
      let p = this.ipos.get(key);
      if (!p) { if (ph < TR_ITEM_WAIT || at < this.joinAt + 300) continue; const [x, y] = this.itemCand(s, g, 0); p = { x, y }; }   // 알림이 안 옴(맡은 기기가 꺼짐 등)
      out.push({ s, g, key, x: p.x, y: p.y, type: TR_DROP[Math.floor(trHash(this.itemSeed, s + 100, g) * TR_DROP.length)], age: ph, life: c.life });
    }
    return out;
  }
  pickup(it) {
    this.taken.add(it.key); this.items = this.items.filter(q => q !== it); this.picked = this.picked.filter(q => (this.now || 0) - q.at < 4000).concat([{ k: it.key, at: this.now || 0 }]);
    if (this.opts.onAttack) this.opts.onAttack('item', null, { k: it.key });
    let type = it.type, pre = '';
    if (type === 'mystery') { const r = Math.random(), pick = a => a[Math.floor(Math.random() * a.length)]; type = r < 0.5 ? pick(['speed', 'shield', 'grow']) : pick(['slow', 'reverse', 'fog']); pre = '수수께끼 상자 → '; }
    const d = TR_ITEMS[type], now = this.now || 0;
    if (d.ms) this.fx[type] = now + d.ms;
    if (type === 'speed') this.fx.slow = 0; if (type === 'slow') this.fx.speed = 0;
    if (type === 'grow') {   // 내 둘레 7×7 → 내 땅
      const got = []; for (let b = -3; b <= 3; b++) for (let a = -3; a <= 3; a++) { const X = this.cx + a, Y = this.cy + b; if (X < 0 || Y < 0 || X >= this.N || Y >= this.N) continue; const i = this.idx(X, Y); if (this.own[i] !== this.myId) { this.own[i] = this.myId; got.push(i); this.capAt.set(i, now); } }
      const before = this.cells; this.recount(); this.emitCap(got); this.miniDirty = true; this.burst(this.cx + 0.5, this.cy + 0.5, 24, d.color);
      if (this.cells > before) { this.pops = this.pops || []; this.pops.push({ t: 1, txt: '+' + (this.cells - before) + '칸', x: this.cx + 0.5, y: this.cy - 0.5 }); }
    }
    this.pops = this.pops || []; this.pops.push({ t: 1, txt: d.name + (d.good ? '!' : ' ㅠ'), x: this.cx + 0.5, y: this.cy + 0.5, c: d.good ? '#7DF58F' : '#FF9AA8' });
    this.toast(pre + d.name + ' — ' + d.desc, d.good ? '#9BF6B5' : '#FFB3BF');
    if (window.Sound) (d.good ? (Sound.item || Sound.gem) : (Sound.bump || Sound.crash)).call(Sound);
    this.burst(it.x + 0.5, it.y + 0.5, 14, TR_ITEMS[it.type].color);
  }
  // 상자 그림 (도형만 — 이모지는 기기마다 안 보일 수 있음)
  drawItem(ctx, it, X, Y, u, t) {
    const d = TR_ITEMS[it.type], r = u * 0.42, cx = X + u / 2, cy = Y + u / 2 + Math.sin(t / 260 + it.s) * u * 0.06;
    if (it.age > it.life - 2500 && Math.floor(t / 150) % 2) return;   // 곧 사라짐: 깜빡
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(cx, Y + u * 0.9, r * 0.8, r * 0.25, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = 0.35 + 0.2 * Math.sin(t / 200 + it.s); ctx.fillStyle = d.color; ctx.beginPath(); ctx.arc(cx, cy, r * 1.35, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = d.color; FX.rr(ctx, cx - r, cy - r, r * 2, r * 2, r * 0.45); ctx.fill(); ctx.strokeStyle = '#1B2135'; ctx.lineWidth = Math.max(1.5, u * 0.07); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; FX.rr(ctx, cx - r * 0.75, cy - r * 0.85, r * 1.5, r * 0.6, r * 0.3); ctx.fill();
    ctx.fillStyle = '#1B2135'; ctx.beginPath();
    if (it.type === 'speed') { ctx.moveTo(cx + r * 0.15, cy - r * 0.75); ctx.lineTo(cx - r * 0.45, cy + r * 0.1); ctx.lineTo(cx - r * 0.02, cy + r * 0.1); ctx.lineTo(cx - r * 0.2, cy + r * 0.75); ctx.lineTo(cx + r * 0.45, cy - r * 0.15); ctx.lineTo(cx + r * 0.02, cy - r * 0.15); ctx.closePath(); ctx.fill(); }
    else if (it.type === 'shield') { ctx.moveTo(cx, cy - r * 0.7); ctx.lineTo(cx + r * 0.55, cy - r * 0.45); ctx.quadraticCurveTo(cx + r * 0.5, cy + r * 0.4, cx, cy + r * 0.75); ctx.quadraticCurveTo(cx - r * 0.5, cy + r * 0.4, cx - r * 0.55, cy - r * 0.45); ctx.closePath(); ctx.fill(); }
    else if (it.type === 'grow') { const a = r * 0.6, w = r * 0.2; ctx.rect(cx - a, cy - w, a * 2, w * 2); ctx.rect(cx - w, cy - a, w * 2, a * 2); ctx.fill(); }
    else FX.text(ctx, '?', cx, cy + r * 0.05, { size: r * 1.5, weight: 900, color: '#fff', align: 'center', baseline: 'middle', stroke: '#1B2135' });
  }
  getSnapshot() {   // 교사 미니보드: 내 둘레 12×18칸
    const W = 12, H = 18, x0 = Math.round(this.cx - W / 2), y0 = Math.round(this.cy - H / 2), cidx = id => { const p = id === this.myId ? { ci: this.ci } : this.peers[id]; return p ? trCellCode(p.ci) : 21; };
    const g = []; for (let y = 0; y < H; y++) { const r = []; for (let x = 0; x < W; x++) { const X = x0 + x, Y = y0 + y; if (X < 0 || Y < 0 || X >= this.N || Y >= this.N) { r.push(12); continue; } const i = this.idx(X, Y), o = this.own[i]; r.push(this.trailSet.has(i) ? 22 : o ? cidx(o) : 0); } g.push(r); }
    return g;
  }
  skinOf(id) { if (id === this.myId) return trSkin(this.ci); const p = this.peers[id]; return p ? trSkin(p.ci) : null; }
  colorOf(id) { const k = this.skinOf(id); return k ? k.c : '#8B93A7'; }
  liveBoard() {
    const now = this.clock(), list = [{ id: this.myId, name: this.myName || '나', s: this.score }];
    for (const id in this.peers) { const p = this.peers[id]; if (p.rcvS != null && now - p.rcvS > 6000) continue; list.push({ id, name: p.name || '', s: +p.pct || 0, ci: p.ci }); }
    list.sort(trCmp(null)); const r = list.findIndex(e => e.id === this.myId) + 1; this.place = r + '/' + list.length; return list;
  }
  // 끝 화면: 끝난 까닭 · 내 순위와 점수 · 1~5등
  drawEnd(ctx, W, H) {
    ctx.fillStyle = 'rgba(10,14,28,.62)'; ctx.fillRect(0, 0, W, H);
    const pw = Math.min(W - 32, 380), ph = 132 + Math.min(5, this.board.length) * 24, px = (W - pw) / 2, py = H >= 560 ? Math.min(H - ph - 12, H / 2 + 80) : Math.max(70, (H - ph) / 2);   // 키 큰 화면: 가운데 아래 (페이지의 '끝' 카드가 가운데에 잠깐 뜸)
    ctx.fillStyle = 'rgba(22,28,48,.94)'; FX.rr(ctx, px, py, pw, ph, 18); ctx.fill(); ctx.strokeStyle = '#FFD447'; ctx.lineWidth = 2; ctx.stroke();
    const title = this.endReason === 'goal' ? this.winner + ' ' + TR_GOAL + '% 달성!' : '시간 끝!';
    ctx.font = '900 28px Pretendard, sans-serif'; const tsz = Math.min(28, 28 * (pw - 24) / Math.max(1, ctx.measureText(title).width));
    FX.text(ctx, title, W / 2, py + 40, { size: tsz, weight: 900, color: '#FFD447', align: 'center', stroke: 'rgba(20,24,40,.9)' });
    FX.text(ctx, '나는 ' + this.total + '명 중 ' + this.rank + '등 · 내 땅 ' + trFmt(this.score) + '%', W / 2, py + 70, { size: 16, weight: 900, color: '#fff', align: 'center' });
    this.board.slice(0, 5).forEach((e, i) => { const me = e.id === this.myId, y = py + 104 + i * 24, t = (i + 1) + '. ' + (me ? (this.myName || '나') : (e.name || '친구')) + '  ' + trFmt(e.s) + '%';
      FX.text(ctx, t, px + 46, y, { size: 15, weight: me ? 900 : 700, color: me ? '#FFE38A' : '#DCE3F2' }); trSwatch(ctx, trSkin(me ? this.ci : e.ci), px + 24, y - 12, 14); });
  }
  draw() {
    const ctx = this.ctx, W = this.canvas.clientWidth || this.canvas.width, H = this.canvas.clientHeight || this.canvas.height, u = Math.min(W, H) / (Math.min(W, H) > 600 ? TR_VIEW + 2 : TR_VIEW), VW = W / u, VH = H / u;
    const hx = this.cx + TR_DIRS[this.dir][0] * (this.isDead ? 0 : this.p), hy = this.cy + TR_DIRS[this.dir][1] * (this.isDead ? 0 : this.p);
    const camX = hx + 0.5 - VW / 2, camY = hy + 0.5 - VH / 2, sx = x => (x - camX) * u, sy = y => (y - camY) * u;
    ctx.fillStyle = '#121828'; ctx.fillRect(0, 0, W, H);
    // 경기장 바닥 (체크 무늬)
    const x0 = Math.max(0, Math.floor(camX)), x1 = Math.min(this.N - 1, Math.ceil(camX + VW)), y0 = Math.max(0, Math.floor(camY)), y1 = Math.min(this.N - 1, Math.ceil(camY + VH));
    ctx.fillStyle = '#EEF1F6'; ctx.fillRect(sx(0), sy(0), this.N * u, this.N * u);
    ctx.fillStyle = '#E2E7EF'; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if ((x + y) % 2) ctx.fillRect(sx(x), sy(y), u + 0.5, u + 0.5);
    // 땅 (주인 색 + 무늬 · 아래쪽 그림자로 입체감) — 주인별로 모아 한 번에
    const lands = new Map(); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const o = this.own[this.idx(x, y)]; if (!o) continue; let L = lands.get(o); if (!L) lands.set(o, L = []); L.push([sx(x), sy(y)]); }
    lands.forEach((L, o) => { const k = this.skinOf(o) || { c: '#8B93A7', dk: '#646B7D', lt: '#A9AFBE', pat: 0 };
      ctx.fillStyle = k.dk; L.forEach(q => ctx.fillRect(q[0], q[1] + u * 0.12, u + 0.5, u + 0.5)); ctx.fillStyle = k.lt; L.forEach(q => ctx.fillRect(q[0], q[1], u + 0.5, u * 0.92));
      const tp = k.pat && trTile(ctx, k); if (tp) { tp.setTransform(new DOMMatrix([u / 32, 0, 0, u / 32, sx(0), sy(0)])); ctx.fillStyle = tp; ctx.beginPath(); L.forEach(q => ctx.rect(q[0], q[1], u, u * 0.92)); ctx.fill(); } else trPatFill(ctx, k, L, u); });
    // 경기장 테두리
    ctx.strokeStyle = '#FF5C7A'; ctx.lineWidth = Math.max(2, u * 0.12); ctx.strokeRect(sx(0), sy(0), this.N * u, this.N * u);
    // 꼬리 (친구 · 나)
    const drawTrail = (cells, k, al) => { const L = []; ctx.fillStyle = k.c; ctx.globalAlpha = al; ctx.beginPath(); cells.forEach(i => { const x = i % this.N, y = i / this.N | 0; if (x < x0 - 1 || x > x1 + 1 || y < y0 - 1 || y > y1 + 1) return; const X = sx(x) + u * 0.18, Y = sy(y) + u * 0.18; L.push([X, Y]);
      if (ctx.roundRect) ctx.roundRect(X, Y, u * 0.64, u * 0.64, u * 0.2); else ctx.rect(X, Y, u * 0.64, u * 0.64); }); ctx.fill(); ctx.globalAlpha = 1; trPatFill(ctx, k, L, u * 0.64); };
    Object.values(this.peers).forEach(p => { if (!p.dead) drawTrail(p.trail, trSkin(p.ci), 0.75); });
    drawTrail(this.trail, trSkin(this.ci), 0.85);
    const tn = this.now || 0; this.items.forEach(it => { if (it.x >= x0 - 1 && it.x <= x1 + 1 && it.y >= y0 - 1 && it.y <= y1 + 1) this.drawItem(ctx, it, sx(it.x), sy(it.y), u, tn); });
    // 머리 (친구 · 나) + 이름
    const shape = (pat, X, Y, s) => { ctx.beginPath(); const c = X + u / 2, m = Y + u / 2;   // 머리 모양: 무늬마다 다름
      if (pat === 1) ctx.arc(c, m, s * 0.54, 0, 6.3);
      else if (pat === 3) { ctx.moveTo(c, m - s * 0.62); ctx.lineTo(c + s * 0.62, m); ctx.lineTo(c, m + s * 0.62); ctx.lineTo(c - s * 0.62, m); ctx.closePath(); }
      else { if (ctx.roundRect) ctx.roundRect(c - s / 2, m - s / 2, s, s, s * 0.25); else ctx.rect(c - s / 2, m - s / 2, s, s); if (pat === 2) { ctx.moveTo(c - s * 0.12, m - s * 0.48); ctx.arc(c - s * 0.3, m - s * 0.48, s * 0.18, 0, 6.3); ctx.moveTo(c + s * 0.48, m - s * 0.48); ctx.arc(c + s * 0.3, m - s * 0.48, s * 0.18, 0, 6.3); } } };
    const head = (x, y, k, name, me, fl) => { const X = sx(x), Y = sy(y), s = u * (me ? 1.08 : 1);
      if (fl & 8) { const bl = 0.5 + 0.5 * Math.sin(tn / 70); ctx.strokeStyle = 'rgba(255,240,140,' + (0.55 + 0.4 * bl) + ')'; ctx.lineWidth = Math.max(2, u * 0.12); ctx.setLineDash([u * 0.22, u * 0.14]); ctx.beginPath(); ctx.arc(X + u / 2, Y + u / 2, u * 0.95, tn / 300, tn / 300 + 6.3); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 0.55 + 0.45 * bl; }   // 부활 무적: 노란 점선 고리 + 깜빡임
      if (fl & 1) { ctx.strokeStyle = 'rgba(120,220,255,' + (0.6 + 0.3 * Math.sin(tn / 120)) + ')'; ctx.lineWidth = Math.max(2, u * 0.1); ctx.beginPath(); ctx.arc(X + u / 2, Y + u / 2, u * 0.85, 0, 7); ctx.stroke(); }
      if (fl & 4) { ctx.fillStyle = 'rgba(160,168,186,.45)'; ctx.beginPath(); ctx.arc(X + u / 2, Y + u / 2, u * 0.8, 0, 7); ctx.fill(); }
      ctx.save(); ctx.translate(-s * 0.04, s * 0.1); ctx.fillStyle = 'rgba(0,0,0,.25)'; shape(k.pat, X, Y, s); ctx.fill(); ctx.restore();
      ctx.fillStyle = k.c; shape(k.pat, X, Y, s); ctx.fill(); if (k.pat) { ctx.save(); ctx.clip(); trPatFill(ctx, k, [[X - (s - u) / 2, Y - (s - u) / 2]], s); ctx.restore(); }
      ctx.strokeStyle = '#1B2135'; ctx.lineWidth = Math.max(1.5, u * 0.08); shape(k.pat, X, Y, s); ctx.stroke();
      ctx.fillStyle = '#fff'; [-0.18, 0.18].forEach(e => { ctx.beginPath(); ctx.arc(X + u / 2 + e * u, Y + u * 0.42, u * 0.12, 0, 7); ctx.fill(); }); ctx.fillStyle = '#1B2135'; [-0.18, 0.18].forEach(e => { ctx.beginPath(); ctx.arc(X + u / 2 + e * u, Y + u * 0.44, u * 0.06, 0, 7); ctx.fill(); });
      ctx.globalAlpha = 1;
      if (name) { const fs = Math.max(10, u * 0.42), ny = Y - u * 0.25 - (k.pat === 2 ? u * 0.15 : 0); FX.text(ctx, name, X + u / 2 + fs * 0.45, ny, { size: fs, weight: 800, color: '#fff', align: 'center', stroke: 'rgba(20,24,40,.85)' });
        const tw = ctx.measureText(name).width; trSwatch(ctx, k, X + u / 2 + fs * 0.45 - tw / 2 - fs * 1.05, ny - fs * 0.82, fs * 0.85); } };   // 이름표 앞 작은 견본 (색+무늬)
    Object.values(this.peers).forEach(p => { if (!p.dead) head(p.x, p.y, trSkin(p.ci), p.name, false, p.fl || 0); });
    if (!this.isDead) head(hx, hy, trSkin(this.ci), this.myName || '나', true, (this.has('shield') ? 1 : 0) | (this.has('slow') ? 4 : 0) | (this.has('inv') ? 8 : 0));
    FX.drawParts(ctx, this.parts.map(q => ({ x: (q.x - camX), y: (q.y - camY), l: q.l, c: q.c })), u, Math.max(3, u * 0.22));
    (this.pops || []).forEach(q => { ctx.globalAlpha = Math.min(1, q.t * 1.5); FX.text(ctx, q.txt, sx(q.x), sy(q.y) - (1 - q.t) * u * 1.5, { size: u * 0.7, weight: 900, color: q.c || '#FFE38A', align: 'center', stroke: 'rgba(20,24,40,.9)' }); ctx.globalAlpha = 1; });
    if (this.has('fog')) {   // 안개: 내 둘레만 보임
      const g = ctx.createRadialGradient(sx(hx + 0.5), sy(hy + 0.5), u * 1.6, sx(hx + 0.5), sy(hy + 0.5), u * 3.6); g.addColorStop(0, 'rgba(70,80,105,0)'); g.addColorStop(1, 'rgba(70,80,105,.96)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    // 미니맵 (오른쪽 위) · 내 땅 % · 순위
    const M = Math.min(W * (this.N > 70 ? 0.36 : 0.3), this.N > 70 ? 140 : 110), mx = W - M - 8, my = 8, mk = M / this.N;
    if (!this.mini) { this.mini = document.createElement('canvas'); this.mini.width = this.mini.height = this.N; }
    if (this.miniDirty && tn - (this._miniAt || -1e9) > 250) { this.miniDirty = false; this._miniAt = tn;   // 미니맵 다시 그리기: 0.25초에 한 번까지 · 주인별 색은 한 번만 계산 (큰 경기장 96×96 = 9216칸)
      const N = this.N, g = this.mini.getContext('2d'), img = g.createImageData(N, N), d = img.data, cc = new Map(), rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)], empty = [40, 48, 70];
      for (let i = 0; i < N * N; i++) { const o = this.own[i]; let c = empty; if (o) { c = cc.get(o); if (!c) cc.set(o, c = rgb(this.colorOf(o))); } d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255; } g.putImageData(img, 0, 0); }
    ctx.fillStyle = 'rgba(10,14,28,.6)'; FX.rr(ctx, mx - 4, my - 4, M + 8, M + 8, 8); ctx.fill(); ctx.imageSmoothingEnabled = false; ctx.drawImage(this.mini, mx, my, M, M); ctx.imageSmoothingEnabled = true;
    if (!this.has('fog')) this.items.forEach(it => { ctx.fillStyle = TR_ITEMS[it.type].color; ctx.fillRect(mx + (it.x + 0.5) * mk - 1.5, my + (it.y + 0.5) * mk - 1.5, 3, 3); });
    ctx.fillStyle = '#fff'; ctx.fillRect(mx + hx * mk - 2, my + hy * mk - 2, 4, 4);
    FX.text(ctx, trFmt(this.score) + '%', 10, 30, { size: 24, weight: 900, color: trSkin(this.ci).c, stroke: 'rgba(20,24,40,.85)' });   // 점수 = 지금 내 땅 % (위쪽 점수 칸·선생님 화면과 같은 숫자)
    FX.text(ctx, '✂ ' + this.kills + ' · ' + this.place + '위', 10, 50, { size: 13, weight: 800, color: '#fff', stroke: 'rgba(20,24,40,.85)' });
    let fy = 62; ['inv', 'speed', 'shield', 'slow', 'reverse', 'fog'].forEach(k => { if (!this.has(k)) return; const d = TR_ITEMS[k], left = (this.fx[k] - tn) / 1000, w = 112;
      ctx.fillStyle = 'rgba(10,14,28,.65)'; FX.rr(ctx, 8, fy, w, 22, 8); ctx.fill(); ctx.fillStyle = d.color; FX.rr(ctx, 8, fy + 18, w * Math.min(1, left * 1000 / d.ms), 4, 2); ctx.fill();
      FX.text(ctx, (d.good ? '▲ ' : '▼ ') + d.name + ' ' + left.toFixed(1) + '초', 16, fy + 15, { size: 12, weight: 900, color: d.good ? '#9BF6B5' : '#FFB3BF' }); fy += 27; });
    // 게임 안 순위표: 친구마다 그 친구가 보낸 자기 % (계산 차이 없음) · 순위 규칙도 결과와 같음 — 내가 3등 밖이면 넷째 줄에 나
    const board = this.gameOver ? this.board : this.liveBoard(), mine = board.findIndex(e => e.id === this.myId), rows = board.slice(0, 3).map((e, i) => [i, e]);
    if (mine >= 3) rows.push([mine, board[mine]]);
    rows.forEach(([i, e], j) => { const me = e.id === this.myId, t = (i + 1) + '. ' + (me ? (this.myName || '나') : (e.name || '친구')) + ' ' + trFmt(e.s) + '%', ry = my + M + 22 + j * 17;
      FX.text(ctx, t, W - 10, ry, { size: 12.5, weight: me ? 900 : 700, color: me ? '#FFE38A' : '#fff', align: 'right', stroke: 'rgba(20,24,40,.85)' });
      trSwatch(ctx, trSkin(me ? this.ci : e.ci), W - 10 - ctx.measureText(t).width - 16, ry - 11, 12); });   // 순위표에도 색+무늬 견본
    // 남은 시간 (위 가운데 · 마지막 10초는 빨갛게 크게)
    if (this.endAt > 0) { const left = this.gameOver ? (this.endReason === 'time' ? 0 : Math.max(0, this.endAt - this.goalT)) : this.endAt - this.clock(), hot = left <= 10000, tt = '남은 시간 ' + trClock(left), fs = hot ? 20 + (this.gameOver ? 0 : 4 * Math.max(0, left % 1000) / 1000) : 16;   // 마지막 10초: 매초 커졌다 작아짐
      ctx.font = '900 ' + fs + 'px Pretendard, sans-serif'; const tw = ctx.measureText(tt).width + 22, tx = Math.min(W / 2, mx - 10 - tw / 2);
      ctx.fillStyle = hot ? 'rgba(120,10,30,.78)' : 'rgba(10,14,28,.62)'; FX.rr(ctx, tx - tw / 2, 8, tw, fs + 12, (fs + 12) / 2); ctx.fill();
      FX.text(ctx, tt, tx, 8 + (fs + 12) / 2 + fs * 0.36, { size: fs, weight: 900, color: hot ? '#FFD1D8' : '#fff', align: 'center', stroke: 'rgba(20,24,40,.6)' }); }
    this.toasts.forEach((t, i) => FX.text(ctx, t.t, W / 2, H * 0.2 + i * 24, { size: 15, weight: 900, color: t.c, align: 'center', stroke: 'rgba(20,24,40,.9)' }));
    if (this.run < 4) FX.text(ctx, '화면 아무 데나 밀어서 방향 바꾸기 (방향키도 됨)', W / 2, H * 0.62, { size: 15, weight: 900, color: '#FFE38A', align: 'center', stroke: 'rgba(20,24,40,.9)' });
    if (this.run < 4) FX.text(ctx, '내 땅 밖에 선을 긋고 돌아오면 그 안이 내 땅!', W / 2, H * 0.62 + 22, { size: 13, weight: 800, color: '#fff', align: 'center', stroke: 'rgba(20,24,40,.9)' });
    if (this.run < 4) FX.text(ctx, '전체 땅의 ' + TR_GOAL + '%를 먼저 차지하면 승리!' + (this.endAt > 0 ? ' (시간이 끝나면 넓은 순)' : ''), W / 2, H * 0.62 + 62, { size: 13, weight: 800, color: '#9BF6B5', align: 'center', stroke: 'rgba(20,24,40,.9)' });
    if (this.run < 4) FX.text(ctx, '상자를 밟으면 아이템! (좋은 것도, 나쁜 것도)', W / 2, H * 0.62 + 42, { size: 13, weight: 800, color: '#D9C2FF', align: 'center', stroke: 'rgba(20,24,40,.9)' });
    if (this.gameOver) { this.drawEnd(ctx, W, H); return; }
    if (this.isDead) { ctx.fillStyle = 'rgba(10,14,28,.45)'; ctx.fillRect(0, 0, W, H); FX.text(ctx, Math.max(1, Math.ceil((this.deadUntil - (this.now || 0)) / 1000)) + '', W / 2, H * 0.48, { size: 56, weight: 900, color: '#fff', align: 'center', stroke: 'rgba(20,24,40,.9)' }); }
  }
}
if (typeof window !== 'undefined') window.TerritoryGame = TerritoryGame;
