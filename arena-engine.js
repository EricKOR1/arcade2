// 젬 아레나 — 탑다운 실시간 대전 (인기 모바일 브롤 게임의 '방식' 오마주 · 캐릭터·그림·이름은 전부 자체 제작)
//   · 왼쪽 조이스틱 이동, 오른쪽 조이스틱 조준(끌어서 놓으면 발사 · 톡 = 자동 조준)
//   · 두 팀. 가운데 광산에서 젬이 솟고, 한 팀이 젬 10개를 모아 15초 버티면 승리. 쓰러지면 들고 있던 젬을 떨어뜨림
//   · 수풀에 들어가면 가까이 오지 않는 한 상대에게 안 보임 · 맞히면 궁극기 게이지 충전 → 큰 폭발탄
//   네트워크는 레이저 태그와 같은 방식: 위치는 문자열, 피격은 이벤트

// ── 맵 생성 도구 ──
function arGrid(W, H) {
  const g = []; for (let y = 0; y < H; y++) g.push(new Array(W).fill('.'));
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) g[y][x] = c; };
  const rect = (x, y, w, h, c, fill) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const e = xx === x || yy === y || xx === x + w - 1 || yy === y + h - 1; if (fill || e) set(xx, yy, c); } };
  const sym = fn => fn((x, y, c) => { set(x, y, c); set(W - 1 - x, H - 1 - y, c); });   // 점대칭 — 두 팀에 공평
  return { g, W, H, set, rect, sym, rows: () => g.map(r => r.join('')) };
}
// 맵 완성: 출발점(팀별 15곳)·광산 위치·젬이 솟을 수 있는 '걸을 수 있는' 칸 목록을 계산
function arFinish(m, name) {
  const rows = m.rows(), W = m.W, H = m.H, open = (x, y) => rows[y] && rows[y][x] === '.';
  const spawns = { r: [], b: [] };
  for (let y = 1; y < 4 && spawns.r.length < 15; y++) for (let x = 1; x < W - 1 && spawns.r.length < 15; x += 2) if (open(x, y) && open(x, y + 1)) spawns.r.push([x + 0.5, y + 0.5]);
  spawns.b = spawns.r.map(([x, y]) => [W - x, H - y]);
  const mine = [W / 2, H / 2];
  const gemSpots = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.hypot(x + 0.5 - mine[0], y + 0.5 - mine[1]); if (open(x, y) && d >= 1.6 && d <= 5.5) gemSpots.push([x + 0.5, y + 0.5]); }
  return { rows, spawns, mine, gemSpots, W, H };
}
// 젬 광산 — 기본. 넓은 마당 + 가운데 광산, 양옆 수풀 회랑
function arMapMine() {
  const m = arGrid(36, 48), { set, rect, sym } = m;
  rect(0, 0, 36, 48, '#');
  sym(put => {
    for (let x = 4; x < 9; x++) for (let y = 5; y < 8; y++) put(x, y, 'b');       // 진영 앞 수풀
    for (let x = 27; x < 32; x++) for (let y = 5; y < 8; y++) put(x, y, 'b');
    for (let x = 14; x < 22; x++) put(x, 8, '#'); put(17, 8, '.'); put(18, 8, '.');   // 진영 방벽
    for (let y = 10; y < 22; y += 3) { put(3, y, '#'); put(4, y, '#'); put(31, y, '#'); put(32, y, '#'); }   // 옆 기둥 회랑
    for (let x = 6; x < 12; x++) for (let y = 12; y < 15; y++) put(x, y, 'b');
    for (let x = 24; x < 30; x++) for (let y = 12; y < 15; y++) put(x, y, 'b');
    rect(10, 16, 4, 4, '#', true); rect(22, 16, 4, 4, '#', true);                  // 중앙 접근로 바위
    for (let x = 13; x < 23; x++) put(x, 19, 'b'); put(17, 19, '.'); put(18, 19, '.');
  });
  rect(15, 22, 6, 4, '#', true); rect(16, 23, 4, 2, 'G', true);                    // 광산
  return arFinish(m);
}
// 정글 협곡 — 좁은 통로와 수풀이 많아 매복형. 광산이 네 방향 좁은 입구
function arMapJungle() {
  const m = arGrid(40, 52), { set, rect, sym } = m;
  rect(0, 0, 40, 52, '#');
  sym(put => {
    for (let x = 2; x < 38; x++) if (x % 7 < 3) put(x, 6, '#');                    // 진영 앞 방벽 조각
    for (let x = 3; x < 10; x++) for (let y = 8; y < 12; y++) put(x, y, 'b');
    for (let x = 30; x < 37; x++) for (let y = 8; y < 12; y++) put(x, y, 'b');
    for (let x = 15; x < 25; x++) for (let y = 9; y < 11; y++) put(x, y, 'b');
    rect(4, 14, 6, 6, '#'); put(7, 19, '.'); put(6, 19, '.'); put(9, 16, '.');   // 오두막 (문 두 개)
    rect(30, 14, 6, 6, '#'); put(32, 19, '.'); put(33, 19, '.'); put(30, 16, '.');
    for (let y = 13; y < 22; y++) { put(14, y, '#'); put(25, y, '#'); } put(14, 17, '.'); put(25, 17, '.');   // 협곡 벽
    for (let x = 15; x < 25; x++) for (let y = 14; y < 17; y++) put(x, y, 'b');
    for (let x = 2; x < 12; x++) put(x, 23, 'b'); for (let x = 28; x < 38; x++) put(x, 23, 'b');
  });
  rect(17, 24, 6, 4, '#', true); rect(18, 25, 4, 2, 'G', true);
  [[16, 25], [16, 26], [23, 25], [23, 26], [19, 23], [20, 23], [19, 28], [20, 28]].forEach(([x, y]) => set(x, y, 'b'));   // 광산 입구 수풀
  return arFinish(m);
}
// 얼음 요새 — 탁 트인 빙판 + 요새 벽. 원거리형이 유리, 수풀은 적음
function arMapIce() {
  const m = arGrid(36, 48), { set, rect, sym } = m;
  rect(0, 0, 36, 48, '#');
  sym(put => {
    rect(6, 6, 24, 3, '#'); put(12, 8, '.'); put(13, 8, '.'); put(22, 8, '.'); put(23, 8, '.'); put(17, 6, '.'); put(18, 6, '.');   // 요새 외벽
    rect(2, 12, 5, 5, '#', true); rect(29, 12, 5, 5, '#', true);                   // 망루
    for (let x = 12; x < 24; x += 3) put(x, 13, '#');                               // 얼음 기둥 줄
    for (let x = 4; x < 8; x++) for (let y = 19; y < 22; y++) put(x, y, 'b');
    for (let x = 28; x < 32; x++) for (let y = 19; y < 22; y++) put(x, y, 'b');
    rect(9, 18, 3, 3, '#', true); rect(24, 18, 3, 3, '#', true);
  });
  rect(15, 22, 6, 4, '#', true); rect(16, 23, 4, 2, 'G', true);
  return arFinish(m);
}
const AR_MAPS = {
  mine:   { name: '젬 광산',   tag: '★2 · 균형', desc: '넓은 마당과 가운데 광산. 양옆 수풀 회랑으로 우회하세요',       build: arMapMine },
  jungle: { name: '정글 협곡', tag: '★3 · 매복', desc: '좁은 협곡과 수풀. 광산 입구가 네 방향 좁은 길뿐이라 매복이 잘 통합니다', build: arMapJungle },
  ice:    { name: '얼음 요새', tag: '★3 · 원거리', desc: '탁 트인 빙판과 요새 벽. 수풀이 적어 원거리형이 유리, 망루를 잡으세요', build: arMapIce }
};

// ── 캐릭터 6종 — 초당 피해(DPS)를 비슷하게 맞추고 체력·속도·사거리로 성격을 나눴습니다 ──
//   dps = 탄 수 × 피해 ÷ 재장전(초).  볼트 3×20/0.48 = 125 · 바위 5×16/0.9 = 89(체력 160) · 매 1×70/0.85 = 82(사거리 2배)
//   새싹 3×16/0.48 = 100(궁극기 회복) · 부엉 1×48/0.7 = 69(벽 너머 범위 피해) · 번개 2×20/0.36 = 111(체력 80 · 속도 1.2)
//   종합 전투력(√(dps×체력)×속도): 86~113, 최대/최소 1.3배
const AR_CHARS = {
  bolt:   { name: '볼트',   role: '올라운더', hp: 100, speed: 1.0,  icon: '⚡', shape: 'round',  shot: { n: 3, spread: 0.09, speed: 0.32, life: 22, dmg: 20, cd: 480 }, sup: { kind: 'blast',  label: '대형탄', desc: '큰 폭발탄 (60)' } },
  rock:   { name: '바위',   role: '탱커',     hp: 160, speed: 0.85, icon: '🪨', shape: 'square', shot: { n: 5, spread: 0.22, speed: 0.30, life: 13, dmg: 16, cd: 900 }, sup: { kind: 'dash',   label: '돌진',   desc: '앞으로 돌진 · 0.7초 무적 · 부딪힌 적 30' } },
  hawk:   { name: '매',     role: '저격수',   hp: 90,  speed: 1.0,  icon: '🎯', shape: 'diamond', shot: { n: 1, spread: 0,    speed: 0.48, life: 40, dmg: 70, cd: 850 }, sup: { kind: 'pierce', label: '관통탄', desc: '벽과 적을 뚫는 관통탄 (70)' } },
  sprout: { name: '새싹',   role: '힐러',     hp: 100, speed: 1.05, icon: '🌱', shape: 'round',  shot: { n: 3, spread: 0.12, speed: 0.30, life: 20, dmg: 16, cd: 480 }, sup: { kind: 'heal',   label: '치유',   desc: '주변 4칸 팀원 체력 +40 (나 +25)' } },
  owl:    { name: '부엉',   role: '폭탄병',   hp: 120, speed: 0.95, icon: '💣', shape: 'round',  shot: { n: 1, spread: 0,    speed: 0.26, life: 26, dmg: 48, cd: 700, lob: true, radius: 1.1 }, sup: { kind: 'volley', label: '폭탄 세례', desc: '사방으로 폭탄 8발 (각 30)' } },
  spark:  { name: '번개',   role: '돌격수',   hp: 80,  speed: 1.2,  icon: '🔥', shape: 'tri',    shot: { n: 2, spread: 0.06, speed: 0.36, life: 12, dmg: 20, cd: 360 }, sup: { kind: 'dash',   label: '섬광 돌진', desc: '앞으로 길게 돌진 · 0.5초 무적 · 부딪힌 적 25' } }
};

const AR_TEAM = { r: { name: '레드', color: '#FF5C7A', dark: '#B3213F' }, b: { name: '블루', color: '#4CC9F0', dark: '#1D7FA6' } };

class ArenaGame {
  constructor(canvas, opts) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.opts = opts || {};
    this.cellSize = this.opts.cellSize || 20;
    this.myId = this.opts.myId; this.myName = this.opts.myName || '';
    this.team = this.opts.team || 'r';
    this.mapId = (this.opts.trackId && AR_MAPS[this.opts.trackId]) ? this.opts.trackId : 'mine';
    this.mapDef = AR_MAPS[this.mapId]; const built = this.mapDef.build(); this.map = built.rows; this.spawns = built.spawns; this.mine = built.mine; this.gemSpots = built.gemSpots;
    this.W = built.W; this.H = built.H;
    this.charId = (this.opts.charId && AR_CHARS[this.opts.charId]) ? this.opts.charId : 'bolt'; this.ch = AR_CHARS[this.charId];
    this.peers = {}; this.bullets = []; this.parts = []; this.gems = {}; this.held = 0;
    this.hp = this.ch.hp; this.maxHp = this.ch.hp; this.super = 0; this.dashUntil = 0; this.invulUntil = 0; this.kills = 0; this.score = 0; this.gameOver = false;
    this.mx = 0; this.my = 0; this.aim = null; this.angle = -Math.PI / 2; this.lastFire = 0; this.lastHurt = 0;
    this.deadUntil = 0; this.hidden = false; this.toasts = []; this.winner = null; this.countUntil = 0; this.countTeam = null;
    this.now = 0; this.lastTime = 0; this.face = 1;
    this.spawnAt(this.opts.slot || 0);
  }
  static parse(raw) {
    const a = String(raw).split(',');
    return { x: +a[0], y: +a[1], angle: +a[2], hp: +a[3], gems: +a[4] || 0, team: a[5] || 'r', dead: a[6] === '1', hidden: a[7] === '1', sup: +a[8] || 0, kills: +a[9] || 0, ch: a[10] || 'bolt', dash: a[11] === '1' };
  }
  serialize() { return [this.x.toFixed(2), this.y.toFixed(2), this.angle.toFixed(2), this.hp, this.held, this.team, this.isDead ? 1 : 0, this.hidden ? 1 : 0, Math.round(this.super), this.kills, this.charId, this.now < this.dashUntil ? 1 : 0].join(','); }
  applyPeerRaw(id, raw, name) {
    if (typeof raw !== 'string') return;                       // 이전 게임의 옛 신호 등 형식이 다르면 무시
    const d = ArenaGame.parse(raw);
    if (!isFinite(d.x) || !isFinite(d.y) || !isFinite(d.angle)) return;   // 숫자가 아니면 무시 (그리기가 매 프레임 멈추는 것을 막음)
    if (!this.peers[id]) this.peers[id] = { x: d.x, y: d.y, angle: d.angle, buf: [] };
    const p = this.peers[id]; const now = this.clock();
    const last = p.buf[p.buf.length - 1];
    if (!last || Math.abs(last.x - d.x) > 1e-4 || Math.abs(last.y - d.y) > 1e-4) { if (last && Math.hypot(last.x - d.x, last.y - d.y) > 6) p.buf.length = 0; p.buf.push({ t: now, x: d.x, y: d.y }); if (p.buf.length > 5) p.buf.shift(); }
    Object.assign(p, { tx: d.x, ty: d.y, tangle: d.angle, hp: d.hp, gems: d.gems, team: d.team, dead: d.dead, hidden: d.hidden, sup: d.sup, kills: d.kills, ch: d.ch, dash: d.dash, name: name || p.name || '' });
  }
  setPeers(map) { Object.keys(map).forEach(id => { const d = map[id]; if (d.raw) this.applyPeerRaw(id, d.raw, d.name); }); Object.keys(this.peers).forEach(id => { if (!map[id]) delete this.peers[id]; }); }
  removePeer(id) { delete this.peers[id]; }
  setGems(map) { this.gems = map || {}; }
  get isDead() { return this.now < this.deadUntil; }
  clock() { return this.now || performance.now(); }
  cell(x, y) { const r = this.map[Math.floor(y)]; return r ? (r[Math.floor(x)] || '#') : '#'; }
  wall(x, y) { const c = this.cell(x, y); return c === '#' || c === 'G'; }
  bush(x, y) { return this.cell(x, y) === 'b'; }
  spawnAt(slot) {
    const pts = this.spawns[this.team === 'r' ? 'r' : 'b'];
    const p = pts[(slot >> 1) % pts.length] || [this.W / 2, 2]; this.x = p[0]; this.y = p[1];
    this.angle = this.team === 'r' ? Math.PI / 2 : -Math.PI / 2;   // 경기장 가운데(상대 진영)를 보고 출발 — 벽을 보고 있으면 첫 발이 벽에 박힙니다
  }
  toast(text, color) { this.toasts.push({ text, color: color || '#fff', until: this.clock() + 1600 }); }

  // ── 조작 ──
  setMove(x, y) { this.mx = x; this.my = y; }
  setAim(dx, dy) { this.aim = (dx == null) ? null : [dx, dy]; if (this.aim && Math.hypot(dx, dy) > 0.15) this.angle = Math.atan2(dy, dx); }
  // 오른쪽 조이스틱을 놓으면 그 방향으로 발사. 거의 안 끌었으면 자동 조준
  releaseAim(dx, dy) { const d = Math.hypot(dx || 0, dy || 0); if (d > 0.15) this.angle = Math.atan2(dy, dx); else this.autoAim(); this.aim = null; this.fire(); }
  autoAim() {
    let best = null, bd = 9;
    Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (p.dead || p.team === this.team || p.hidden) return;
      const d = Math.hypot(p.x - this.x, p.y - this.y); if (d < bd) { bd = d; best = p; } });
    this.aimDist = best ? bd : null;
    if (best) this.angle = Math.atan2(best.y - this.y, best.x - this.x);
  }
  fire() {
    const now = this.clock(), sh = this.ch.shot;
    if (this.isDead || this.gameOver || now < this.dashUntil || now - this.lastFire < sh.cd) return;
    if (!this.aim) this.autoAim();                                    // 조준 조이스틱 없이 발사 버튼만 누르면: 가까운 적을 자동 조준, 없으면 바라보는 방향
    this.lastFire = now; this.recoil = 1;
    for (let i = 0; i < sh.n; i++) { const a = this.angle + (i - (sh.n - 1) / 2) * sh.spread;
      // 폭탄(로브)은 자동 조준한 적의 거리만큼만 날아가 그 자리에 떨어집니다 (최대 사거리 안에서)
      const life = sh.lob && this.aimDist ? Math.max(6, Math.min(sh.life, Math.round(this.aimDist / sh.speed))) : sh.life;
      this.bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * sh.speed, vy: Math.sin(a) * sh.speed, life: life, dmg: sh.dmg, big: false, lob: !!sh.lob, radius: sh.radius || 0, t0: life }); }
    if (window.Sound) Sound.hardDrop(); if (window.Haptic) Haptic.tap();
  }
  useSuper() {
    const now = this.clock(), k = this.ch.sup.kind;
    if (this.isDead || this.gameOver || this.super < 100) return;
    this.super = 0; this.autoAim();
    if (k === 'blast') this.bullets.push({ x: this.x, y: this.y, vx: Math.cos(this.angle) * 0.22, vy: Math.sin(this.angle) * 0.22, life: 34, dmg: 60, big: true, radius: 1.1 });
    else if (k === 'pierce') this.bullets.push({ x: this.x, y: this.y, vx: Math.cos(this.angle) * 0.5, vy: Math.sin(this.angle) * 0.5, life: 60, dmg: 70, big: true, pierce: true, hit: {} });
    else if (k === 'volley') for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; this.bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * 0.24, vy: Math.sin(a) * 0.24, life: 28, dmg: 30, big: false, lob: true, radius: 1.0, t0: 28 }); }
    else if (k === 'dash') { const long = this.charId === 'spark'; this.dashUntil = now + (long ? 500 : 700); this.invulUntil = this.dashUntil; this.dashDir = [Math.cos(this.angle), Math.sin(this.angle)]; this.dashHit = {}; this.dashDmg = long ? 25 : 30; }
    else if (k === 'heal') { this.hp = Math.min(this.maxHp, this.hp + 25); this.burst(this.x, this.y, 20, '#7DF58F'); this.healRing = now + 900;
      Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (p.team !== this.team || p.dead) return; if (Math.hypot(p.x - this.x, p.y - this.y) <= 4 && this.opts.onAttack) this.opts.onAttack('heal', id, { amt: 40 }); }); }
    this.toast(this.ch.sup.label + '!', '#FFD166'); if (window.Sound) Sound.boost && Sound.boost(); if (window.Haptic) Haptic.big();
  }
  onEvent(e) {
    if (!e) return;
    if (e.type === 'heal' && e.target === this.myId && !this.isDead) { this.hp = Math.min(this.maxHp, this.hp + (e.amt || 40)); this.burst(this.x, this.y, 12, '#7DF58F'); this.toast('치유 +' + (e.amt || 40), '#7DF58F'); return; }
    if (e.type === 'hit' && e.target === this.myId) {
      if (this.isDead || this.clock() < this.invulUntil) return;
      this.hp = Math.max(0, this.hp - (e.dmg || 22)); this.lastHurt = this.clock(); this.hurt = 1;
      if (window.Haptic) Haptic.hit(); if (window.Sound) Sound.crash();
      if (this.hp <= 0) this.die(e.by);
    }
  }
  die(byId) {
    const now = this.clock();
    this.deadUntil = now + 3200;
    // 들고 있던 젬을 그 자리에 떨어뜨림
    if (this.held > 0 && this.opts.onDropGems) { const drops = []; for (let i = 0; i < this.held; i++) { const a = Math.random() * Math.PI * 2, r = 0.4 + Math.random() * 0.9; drops.push([this.x + Math.cos(a) * r, this.y + Math.sin(a) * r]); } this.opts.onDropGems(drops); }
    this.held = 0; this.super = 0;
    this.burst(this.x, this.y, 18, AR_TEAM[this.team].color);
    const who = this.peers[byId] && this.peers[byId].name; this.toast((who ? who + '에게 ' : '') + '쓰러졌다 · 3초 뒤 부활', '#FF5C7A');
    if (this.opts.onAttack) this.opts.onAttack('kill', byId, { victim: this.myId });
  }
  burst(x, y, n, c) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 0.04 + Math.random() * 0.1; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 1, c }); } }

  // ── 진행 ──
  tick(now) {
    const { dt, f } = FX.frame(this, now);
    if (this.gameOver) { this.draw(); return; }
    // 부활
    if (this.deadUntil && now >= this.deadUntil && this.hp <= 0) { this.hp = this.maxHp; this.invulUntil = now + 1500; this.deadUntil = 0; this.spawnAt(Math.floor(Math.random() * 2)); this.toast('부활!', '#06D6A0'); }
    if (!this.isDead) {
      // 이동 (벽 충돌: 축별로 나눠 미끄러지게)
      const len = Math.hypot(this.mx, this.my), sp = 0.085 * this.ch.speed * f * Math.min(1, len);
      if (now < this.dashUntil) {                                      // 돌진: 조작 무시하고 빠르게 직진, 부딪힌 적에게 피해
        const dsp = 0.3 * f; const nx = this.x + this.dashDir[0] * dsp, ny = this.y + this.dashDir[1] * dsp;
        if (!this.blocked(nx, ny)) { this.x = nx; this.y = ny; } else this.dashUntil = 0;
        Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (p.dead || p.team === this.team || this.dashHit[id]) return;
          if (Math.hypot(p.x - this.x, p.y - this.y) < 0.9) { this.dashHit[id] = 1; if (this.opts.onAttack) this.opts.onAttack('hit', id, { dmg: this.dashDmg }); this.burst(p.x, p.y, 8, '#FFD166'); this.score += 2; } });
      } else if (len > 0.1) { const ux = this.mx / len, uy = this.my / len;
        const nx = this.x + ux * sp; if (!this.blocked(nx, this.y)) this.x = nx;
        const ny = this.y + uy * sp; if (!this.blocked(this.x, ny)) this.y = ny;
        if (!this.aim) this.angle = Math.atan2(uy, ux); this.face = ux < 0 ? -1 : 1; }
      this.hidden = this.bush(this.x, this.y);
      // 체력 회복: 3초간 안 맞으면
      if (now - this.lastHurt > 3000 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + 0.25 * f);
      // 젬 줍기
      Object.keys(this.gems).forEach(id => { const g = this.gems[id]; if (!g || g.by) return;
        if (Math.hypot(g.x - this.x, g.y - this.y) < 0.62) { g.by = this.myId; this.held++; this.score += 10; this.burst(g.x, g.y, 6, '#B15DFF');
          if (this.opts.onGem) this.opts.onGem(id); if (window.Sound) Sound.clear(1); } });
    }
    // 탄
    for (let i = this.bullets.length - 1; i >= 0; i--) { const b = this.bullets[i];
      b.x += b.vx * f; b.y += b.vy * f; b.life -= f;
      // 로브탄(폭탄): 벽을 넘어 날아가 착지점에서 터짐. 관통탄: 벽·적을 뚫음
      let done = b.life <= 0 || (!b.lob && !b.pierce && this.wall(b.x, b.y));
      const gain = () => { this.super = Math.min(100, this.super + (b.big ? 0 : (this.ch.shot.n >= 3 ? 25 : this.ch.shot.n === 2 ? 35 : 60))); this.hitMark = now + 250; this.score += 2; if (window.Sound) Sound.lock(); };
      if (b.lob) { if (b.life <= 0) { // 착지 → 범위 피해
          Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (p.dead || p.team === this.team) return; if (Math.hypot(p.x - b.x, p.y - b.y) < b.radius) { if (this.opts.onAttack) this.opts.onAttack('hit', id, { dmg: b.dmg }); gain(); } });
          this.burst(b.x, b.y, 18, '#FF9F43'); done = true; } }
      else if (!done) Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if ((done && !b.pierce) || p.dead || p.team === this.team || (b.pierce && b.hit[id])) return;
        if (Math.hypot(p.x - b.x, p.y - b.y) < (b.big ? (b.radius || 0.9) : 0.55)) { if (!b.pierce) done = true; else b.hit[id] = 1;
          if (this.opts.onAttack) this.opts.onAttack('hit', id, { dmg: b.dmg }); gain(); this.burst(b.x, b.y, 5, '#FFD166'); } });
      if (done) { if (b.big) this.burst(b.x, b.y, 24, '#FFD166'); this.bullets.splice(i, 1); }
    }
    this.parts = FX.stepParts(this.parts, f, 0.05);
    this.recoil = Math.max(0, (this.recoil || 0) - 0.08 * f); this.hurt = Math.max(0, (this.hurt || 0) - 0.05 * f);
    // 승리 판정: 팀 젬 10개 → 15초 카운트다운
    const cnt = { r: 0, b: 0 }; cnt[this.team] += this.held;
    Object.keys(this.peers).forEach(id => { const p = this.peers[id]; cnt[p.team === 'b' ? 'b' : 'r'] += p.gems || 0; });
    this.teamGems = cnt;
    const lead = cnt.r >= 10 ? 'r' : (cnt.b >= 10 ? 'b' : null);
    if (lead && this.countTeam !== lead) { this.countTeam = lead; this.countUntil = now + 15000; this.toast(AR_TEAM[lead].name + ' 팀이 젬 10개! 15초 버티면 승리', AR_TEAM[lead].color); }
    if (!lead) { this.countTeam = null; this.countUntil = 0; }
    if (lead && now >= this.countUntil) { this.gameOver = true; this.winner = lead; if (this.opts.onFinish) this.opts.onFinish(lead === this.team); if (window.Sound) Sound.levelUp(); }
    this.toasts = this.toasts.filter(t => t.until > now);
    this.draw();
  }
  blocked(x, y) { const r = 0.32; return this.wall(x - r, y - r) || this.wall(x + r, y - r) || this.wall(x - r, y + r) || this.wall(x + r, y + r); }

  getSnapshot() {
    const g = []; for (let y = 0; y < this.H; y++) { g.push([]); for (let x = 0; x < this.W; x++) { const c = this.map[y][x]; g[y].push(c === '#' ? 63 : c === 'G' ? 64 : c === 'b' ? 65 : 66); } }
    Object.keys(this.gems).forEach(id => { const gm = this.gems[id]; if (gm && !gm.by) { const x = Math.floor(gm.x), y = Math.floor(gm.y); if (g[y] && g[y][x] != null) g[y][x] = 67; } });
    Object.keys(this.peers).forEach(id => { const p = this.peers[id]; const x = Math.floor(p.x), y = Math.floor(p.y); if (g[y] && g[y][x] != null) g[y][x] = p.team === 'b' ? 69 : 68; });
    const x = Math.floor(this.x), y = Math.floor(this.y); if (g[y] && g[y][x] != null) g[y][x] = 23;
    return g;
  }

  // ── 그리기 ──
  draw() {
    const ctx = this.ctx, cs = this.cellSize, now = this.now;
    // 화면(CSS 픽셀) 과 지도(월드) 를 구분합니다. 예전엔 지도 전체를 화면에 욱여넣어 캐릭터가 손톱만 했습니다.
    const SW = this.canvas.clientWidth || this.W * cs, SH = this.canvas.clientHeight || this.H * cs;
    const W = this.W * cs, H = this.H * cs;                        // 지도 크기 (월드 픽셀)
    const z = Math.max(1, (Math.min(SW, SH * 0.75) / 10.5) / cs);   // 한 화면에 가로 약 10칸이 보이게 확대
    const vw = SW / z, vh = SH / z;                                  // 화면이 담는 월드 크기
    const camX = W <= vw ? W / 2 : Math.max(vw / 2, Math.min(W - vw / 2, this.x * cs));
    const camY = H <= vh ? H / 2 : Math.max(vh / 2, Math.min(H - vh / 2, this.y * cs));
    this._view = { z, camX, camY, SW, SH };
    if (!this._bg || this._bgCs !== cs) this.buildBg(cs);
    ctx.fillStyle = '#0F1626'; ctx.fillRect(0, 0, SW, SH);          // 지도 밖 여백
    ctx.save(); ctx.translate(SW / 2 - camX * z, SH / 2 - camY * z); ctx.scale(z, z);
    ctx.drawImage(this._bg, 0, 0);
    // 젬 (빛나는 보석)
    Object.keys(this.gems).forEach(id => { const gm = this.gems[id]; if (!gm || gm.by) return; const gx = gm.x * cs, gy = gm.y * cs + Math.sin(now / 260 + gm.x) * cs * 0.06;
      const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, cs * 0.7); gr.addColorStop(0, 'rgba(177,93,255,0.45)'); gr.addColorStop(1, 'rgba(177,93,255,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(gx, gy, cs * 0.7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#B15DFF'; ctx.beginPath(); ctx.moveTo(gx, gy - cs * 0.3); ctx.lineTo(gx + cs * 0.22, gy); ctx.lineTo(gx, gy + cs * 0.3); ctx.lineTo(gx - cs * 0.22, gy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.moveTo(gx, gy - cs * 0.3); ctx.lineTo(gx + cs * 0.22, gy); ctx.lineTo(gx, gy - cs * 0.02); ctx.closePath(); ctx.fill(); });
    // 상대 (수풀 은신은 가까울 때만)
    Object.keys(this.peers).forEach(id => { const p = this.peers[id];
      const k = FX.ease.outCubic(1); const b = p.buf; let px = p.tx != null ? p.tx : p.x, py = p.ty != null ? p.ty : p.y;
      p.x += (px - p.x) * 0.5; p.y += (py - p.y) * 0.5; p.angle = p.tangle != null ? p.tangle : p.angle;
      if (p.dead) return;
      if (p.hidden && p.team !== this.team && Math.hypot(p.x - this.x, p.y - this.y) > 2.2) return;
      this.drawBrawler(ctx, cs, p.x, p.y, p.angle, p.team, p.hp / ((AR_CHARS[p.ch] || AR_CHARS.bolt).hp), p.name, p.hidden ? 0.55 : 1, false, p.gems, p.sup, p.ch, p.dash); });
    // 탄
    this.bullets.forEach(b => { const arc = b.lob ? Math.sin((1 - b.life / b.t0) * Math.PI) * cs * 1.2 : 0; const bx = b.x * cs, by = b.y * cs - arc, r = cs * (b.big ? 0.42 : b.lob ? 0.24 : 0.16);
      if (b.lob) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(b.x * cs, b.y * cs, r, r * 0.5, 0, 0, Math.PI * 2); ctx.fill(); }
      const gr = ctx.createRadialGradient(bx, by, 0, bx, by, r * 2.2); gr.addColorStop(0, b.big ? 'rgba(255,209,102,0.9)' : 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,209,102,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(bx, by, r * 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = b.big ? '#FFD166' : '#FFF3C4'; ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill(); });
    // 나
    if (!this.isDead) {
      // 조준선
      if (this.aim && Math.hypot(this.aim[0], this.aim[1]) > 0.15) { ctx.save(); ctx.translate(this.x * cs, this.y * cs); ctx.rotate(this.angle);
        ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.moveTo(cs * 0.5, -cs * 0.12); ctx.lineTo(cs * 7, -cs * 0.7); ctx.lineTo(cs * 7, cs * 0.7); ctx.lineTo(cs * 0.5, cs * 0.12); ctx.closePath(); ctx.fill(); ctx.restore(); }
      if (now < (this.healRing || 0)) { const k = 1 - (this.healRing - now) / 900; ctx.strokeStyle = 'rgba(125,245,143,' + (0.8 * (1 - k)).toFixed(2) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(this.x * cs, this.y * cs, cs * 4 * k, 0, Math.PI * 2); ctx.stroke(); }
      this.drawBrawler(ctx, cs, this.x, this.y, this.angle, this.team, this.hp / this.maxHp, this.myName, this.hidden ? 0.7 : 1, true, this.held, this.super, this.charId, now < this.dashUntil);
    }
    FX.drawParts(ctx, this.parts, cs, 3);
    ctx.restore();
    // ── 여기부터 화면 좌표 (HUD) ──
    const HW = SW, HH = SH;
    // 피격 붉은 테두리
    if (this.hurt > 0.01) { ctx.fillStyle = 'rgba(255,60,80,' + (this.hurt * 0.35).toFixed(2) + ')'; ctx.fillRect(0, 0, HW, HH); }
    this.drawMinimap(ctx, HW, HH);
    // ── HUD: 팀 젬 · 카운트다운 ──
    const tg = this.teamGems || { r: 0, b: 0 };
    FX.glass(ctx, HW / 2 - 160, 10, 320, 44, 14);
    FX.text(ctx, '◆ ' + tg.r, HW / 2 - 70, 31, { size: 22, weight: 800, color: AR_TEAM.r.color, align: 'center' });
    FX.text(ctx, this.countTeam ? Math.ceil((this.countUntil - now) / 1000) + '' : '10개', HW / 2, 31, { size: (this.countTeam ? 24 : 13), weight: 800, color: this.countTeam ? AR_TEAM[this.countTeam].color : 'rgba(255,255,255,0.6)', align: 'center' });
    FX.text(ctx, tg.b + ' ◆', HW / 2 + 70, 31, { size: 22, weight: 800, color: AR_TEAM.b.color, align: 'center' });
    // 궁극기 게이지 (아래 가운데)
    FX.glass(ctx, HW / 2 - cs * 3, HH - 44, cs * 6, cs * 1.0, 14, this.super >= 100 ? '#FFD166' : undefined);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; FX.rr(ctx, HW / 2 - cs * 2.7, HH - cs * 1.15, cs * 5.4, 10, cs * 0.15); ctx.fill();
    ctx.fillStyle = this.super >= 100 ? '#FFD166' : '#B15DFF'; FX.rr(ctx, HW / 2 - cs * 2.7, HH - cs * 1.15, cs * 5.4 * (this.super / 100), 10, cs * 0.15); ctx.fill();
    FX.text(ctx, this.super >= 100 ? '★ ' + this.ch.sup.label + ' 준비!' : this.ch.sup.label + ' ' + Math.round(this.super) + '%', HW / 2, HH - 19, { size: 12, weight: 800, color: '#fff', align: 'center' });
    this.toasts.slice(-2).forEach((t, i) => { FX.text(ctx, t.text, HW / 2, HH * 0.3 + i * 28, { size: 18, weight: 800, color: t.color, align: 'center', shadow: 8 }); });
    if (this.isDead) { ctx.fillStyle = 'rgba(8,10,16,0.55)'; ctx.fillRect(0, 0, HW, HH); FX.text(ctx, '부활까지 ' + Math.ceil((this.deadUntil - now) / 1000), HW / 2, HH / 2, { size: 34, weight: 800, color: '#fff', align: 'center', baseline: 'middle', shadow: 10 }); }
    if (this.gameOver) { ctx.fillStyle = 'rgba(8,10,16,0.65)'; ctx.fillRect(0, 0, HW, HH); const win = this.winner === this.team;
      FX.text(ctx, win ? '승리!' : '패배', HW / 2, HH / 2 - 20, { size: 52, weight: 800, color: win ? '#FFD166' : '#9AA3B2', align: 'center', baseline: 'middle', shadow: 12 });
      FX.text(ctx, AR_TEAM[this.winner].name + ' 팀이 젬 10개를 지켰습니다', HW / 2, HH / 2 + 30, { size: 17, weight: 700, color: '#fff', align: 'center', baseline: 'middle' }); }
  }
  drawBrawler(ctx, cs, x, y, angle, team, hpK, name, alpha, isMe, gems, sup, chId, dashing) {
    const ch = AR_CHARS[chId] || AR_CHARS.bolt, px = x * cs, py = y * cs, T = AR_TEAM[team] || AR_TEAM.r, r = cs * (ch.hp >= 150 ? 0.5 : ch.hp <= 85 ? 0.37 : 0.42);
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(px, py + r * 0.9, r * 0.9, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    if (isMe) { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, r * 1.35, 0, Math.PI * 2); ctx.stroke(); }
    // 몸: 팀색 원 + 어두운 아래쪽 + 총구 방향 표시
    if (dashing) { ctx.strokeStyle = 'rgba(255,209,102,0.7)'; ctx.lineWidth = r * 0.5; ctx.beginPath(); ctx.moveTo(px - Math.cos(angle) * r * 3, py - Math.sin(angle) * r * 3); ctx.lineTo(px, py); ctx.stroke(); }
    const g = ctx.createRadialGradient(px - r * 0.3, py - r * 0.35, r * 0.1, px, py, r * 1.1); g.addColorStop(0, FX.tint(T.color, 0.35)); g.addColorStop(1, T.dark);
    ctx.fillStyle = g; ctx.beginPath();
    if (ch.shape === 'square') FX.rr(ctx, px - r, py - r, r * 2, r * 2, r * 0.35);
    else if (ch.shape === 'diamond') { ctx.moveTo(px, py - r * 1.15); ctx.lineTo(px + r * 1.05, py); ctx.lineTo(px, py + r * 1.15); ctx.lineTo(px - r * 1.05, py); ctx.closePath(); }
    else if (ch.shape === 'tri') { ctx.moveTo(px + Math.cos(angle) * r * 1.2, py + Math.sin(angle) * r * 1.2); ctx.lineTo(px + Math.cos(angle + 2.4) * r, py + Math.sin(angle + 2.4) * r); ctx.lineTo(px + Math.cos(angle - 2.4) * r, py + Math.sin(angle - 2.4) * r); ctx.closePath(); }
    else ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = Math.max(1.5, cs * 0.06); ctx.stroke();
    // 캐릭터 아이콘 (등에 작게)
    FX.text(ctx, ch.icon, px - Math.cos(angle) * r * 0.45, py - Math.sin(angle) * r * 0.45 + r * 0.25, { size: r * 0.75, align: 'center' });
    ctx.save(); ctx.translate(px, py); ctx.rotate(angle);
    ctx.fillStyle = '#2B3140'; FX.rr(ctx, r * 0.35, -r * 0.18, r * 0.95, r * 0.36, r * 0.12); ctx.fill();
    ctx.fillStyle = '#FFD166'; ctx.fillRect(r * 1.15, -r * 0.1, r * 0.15, r * 0.2); ctx.restore();
    // 얼굴 (눈 두 개 · 진행 방향 쪽)
    const ex = Math.cos(angle) * r * 0.25, ey = Math.sin(angle) * r * 0.25;
    ctx.fillStyle = '#fff'; [[-0.28, 0], [0.28, 0]].forEach(([ox]) => { const ax = -Math.sin(angle) * ox * r, ay = Math.cos(angle) * ox * r; ctx.beginPath(); ctx.arc(px + ex + ax, py + ey + ay, r * 0.2, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = '#12161F'; [[-0.28, 0], [0.28, 0]].forEach(([ox]) => { const ax = -Math.sin(angle) * ox * r, ay = Math.cos(angle) * ox * r; ctx.beginPath(); ctx.arc(px + ex * 1.3 + ax, py + ey * 1.3 + ay, r * 0.1, 0, Math.PI * 2); ctx.fill(); });
    // 체력바 · 이름 · 젬 수
    const bw = cs * 1.4, bx = px - bw / 2, by = py - r - cs * 0.42;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; FX.rr(ctx, bx, by, bw, cs * 0.2, cs * 0.1); ctx.fill();
    ctx.fillStyle = hpK > 0.5 ? '#06D6A0' : hpK > 0.25 ? '#FFD166' : '#FF5C7A'; FX.rr(ctx, bx, by, bw * Math.max(0, hpK), cs * 0.2, cs * 0.1); ctx.fill();
    if (sup >= 100) { ctx.strokeStyle = '#FFD166'; ctx.lineWidth = 2; FX.rr(ctx, bx - 1, by - 1, bw + 2, cs * 0.2 + 2, cs * 0.1); ctx.stroke(); }
    FX.text(ctx, (name || '') + (gems ? '  ◆' + gems : ''), px, by - cs * 0.12, { size: cs * 0.42, weight: 800, color: '#fff', align: 'center', shadow: 4 });
    if (isMe) FX.text(ctx, ch.name + ' · ' + ch.role, px, by - cs * 0.55, { size: cs * 0.32, weight: 700, color: 'rgba(255,255,255,0.7)', align: 'center', shadow: 3 });
    ctx.restore();
  }
  // 미니맵: 지도 전체를 작게 — 벽·수풀·광산, 젬(보라), 브롤러(팀색, 나는 금색), 내 시야 사각형
  drawMinimap(ctx, SW, SH) {
    const u = Math.min(72 / this.W, 96 / this.H), mw = this.W * u, mh = this.H * u, mx = 12, my = 62;   // 맵 크기에 맞춰 최대 72×96px
    if (!this._mm) { const c = document.createElement('canvas'); c.width = Math.ceil(mw); c.height = Math.ceil(mh); const g = c.getContext('2d');
      g.fillStyle = 'rgba(8,10,16,0.75)'; g.fillRect(0, 0, mw, mh);
      for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) { const c2 = this.map[y][x]; if (c2 === '.') continue;
        g.fillStyle = c2 === 'b' ? '#2E8B57' : c2 === 'G' ? '#8B5CF6' : '#5C6B85'; g.fillRect(x * u, y * u, u, u); } this._mm = c; }
    ctx.drawImage(this._mm, mx, my);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(mx - 0.5, my - 0.5, mw + 1, mh + 1);
    Object.keys(this.gems).forEach(id => { const gm = this.gems[id]; if (!gm || gm.by) return; ctx.fillStyle = '#B15DFF'; ctx.fillRect(mx + gm.x * u - 1, my + gm.y * u - 1, 2, 2); });
    Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (p.dead) return; if (p.hidden && p.team !== this.team) return;
      ctx.fillStyle = AR_TEAM[p.team === 'b' ? 'b' : 'r'].color; ctx.beginPath(); ctx.arc(mx + p.x * u, my + p.y * u, 2.2, 0, Math.PI * 2); ctx.fill(); });
    if (!this.isDead) { ctx.fillStyle = '#FFD166'; ctx.beginPath(); ctx.arc(mx + this.x * u, my + this.y * u, 2.8, 0, Math.PI * 2); ctx.fill(); }
    const v = this._view; if (v) { const cs = this.cellSize; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.strokeRect(mx + (v.camX - v.SW / v.z / 2) / cs * u, my + (v.camY - v.SH / v.z / 2) / cs * u, v.SW / v.z / cs * u, v.SH / v.z / cs * u); }
  }
  buildBg(cs) {
    const W = this.W * cs, H = this.H * cs, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#2A3A55'); bg.addColorStop(1, '#1B2739'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    // 바닥 타일
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) { g.fillStyle = (x + y) % 2 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.04)'; g.fillRect(x * cs, y * cs, cs, cs); }
    // 팀 진영 색
    g.fillStyle = 'rgba(255,92,122,0.10)'; g.fillRect(0, 0, W, cs * 5); g.fillStyle = 'rgba(76,201,240,0.10)'; g.fillRect(0, H - cs * 5, W, cs * 5);
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) { const c = this.map[y][x], px = x * cs, py = y * cs;
      if (c === '#' || c === 'G') { // 벽: 윗면 + 측면
        g.fillStyle = c === 'G' ? '#5B3AAF' : '#5C6B85'; FX.rr(g, px + 1, py + 1, cs - 2, cs - 2, cs * 0.18); g.fill();
        g.fillStyle = c === 'G' ? '#8B5CF6' : '#7E8FAB'; FX.rr(g, px + 1, py + 1, cs - 2, cs * 0.62, cs * 0.18); g.fill();
        if (c === 'G') { g.fillStyle = '#B15DFF'; g.beginPath(); g.moveTo(px + cs / 2, py + cs * 0.15); g.lineTo(px + cs * 0.75, py + cs * 0.4); g.lineTo(px + cs / 2, py + cs * 0.65); g.lineTo(px + cs * 0.25, py + cs * 0.4); g.closePath(); g.fill(); }
      } else if (c === 'b') { // 수풀
        g.fillStyle = '#2E8B57'; [[0.3, 0.35, 0.34], [0.68, 0.4, 0.3], [0.5, 0.68, 0.36]].forEach(([ox, oy, rr]) => { g.beginPath(); g.arc(px + cs * ox, py + cs * oy, cs * rr, 0, Math.PI * 2); g.fill(); });
        g.fillStyle = '#3DB870'; [[0.35, 0.3, 0.2], [0.65, 0.34, 0.18]].forEach(([ox, oy, rr]) => { g.beginPath(); g.arc(px + cs * ox, py + cs * oy, cs * rr, 0, Math.PI * 2); g.fill(); });
      } }
    this._bg = cv; this._bgCs = cs;
  }
}
