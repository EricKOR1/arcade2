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
  for (let y = 2; y < 7 && spawns.r.length < 15; y += 2) for (let x = 4; x < W - 4 && spawns.r.length < 15; x += 3) if (open(x, y) && open(x, y + 1)) spawns.r.push([x + 0.5, y + 0.5]);
  spawns.b = spawns.r.map(([x, y]) => [W - x, H - y]);
  const mine = [W / 2, H / 2];
  const gemSpots = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.hypot(x + 0.5 - mine[0], y + 0.5 - mine[1]); if (open(x, y) && d >= 5 && d <= 11) gemSpots.push([x + 0.5, y + 0.5]); }   // 광산 둘레 고리
  return { rows, spawns, mine, gemSpots, W, H };
}
// 공통 배치 도구 — 큰 맵에 같은 모양을 여러 번 찍습니다
function arStamp(put, pts, fn) { pts.forEach(([x, y]) => fn(put, x, y)); }
const arBush = (put, x, y, w, h) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) put(xx, yy, 'b'); };
const arBlock = (put, x, y, w, h, c) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) put(xx, yy, c || '#'); };
const arPond = (put, cx, cy, rx, ry) => { for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) put(cx + x, cy + y, 'w'); };

// 젬 광산 — 기본. 넓은 마당 · 세 갈래 통로(왼쪽 수풀 · 가운데 · 오른쪽 수풀) · 가운데 광산
function arMapMine() {
  const W = 60, H = 84, m = arGrid(W, H), { set, rect, sym } = m;
  rect(0, 0, W, H, '#');
  sym(put => {
    arBlock(put, 20, 9, 20, 1); put(29, 9, '.'); put(30, 9, '.'); put(24, 9, '.'); put(35, 9, '.');     // 진영 방벽 (문 셋)
    arStamp(put, [[5, 6], [47, 6]], (p2, x, y) => arBush(p2, x, y, 8, 4));                            // 진영 옆 수풀
    for (let y = 14; y < 38; y += 4) { arBlock(put, 4, y, 2, 2); arBlock(put, 54, y, 2, 2); }          // 옆 회랑 기둥
    arStamp(put, [[8, 16], [44, 16], [8, 28], [44, 28]], (p2, x, y) => arBush(p2, x, y, 8, 5));       // 회랑 수풀
    arStamp(put, [[18, 18], [38, 18]], (p2, x, y) => arBlock(p2, x, y, 4, 6));                        // 가운데 길 바위
    arBush(put, 24, 22, 12, 2); put(29, 22, '.'); put(30, 22, '.');
    arStamp(put, [[14, 34], [42, 34]], (p2, x, y) => arBlock(p2, x, y, 4, 4));
    arPond(put, 10, 40, 3, 2); arBush(put, 20, 33, 6, 3);
  });
  rect(27, 40, 6, 4, '#', true); rect(28, 41, 4, 2, 'G', true);                                          // 광산 (작은 구덩이)
  return arFinish(m);
}
// 정글 협곡 — 강이 가로지르고 다리 두 개 · 수풀 많음 · 광산 입구가 네 방향 좁은 길
function arMapJungle() {
  const W = 64, H = 88, m = arGrid(W, H), { set, rect, sym } = m;
  rect(0, 0, W, H, '#');
  sym(put => {
    for (let x = 2; x < W - 2; x++) if (x % 9 < 3) put(x, 8, '#');
    arStamp(put, [[4, 11], [26, 11], [48, 11]], (p2, x, y) => arBush(p2, x, y, 12, 5));
    for (let x = 1; x < W - 1; x++) { if ((x > 12 && x < 18) || (x > 45 && x < 51)) continue; put(x, 22, 'w'); put(x, 23, 'w'); }   // 강 (다리 두 곳)
    arStamp(put, [[6, 28], [50, 28]], (p2, x, y) => { rect(x, y, 8, 7, '#'); p2(x + 3, y + 6, '.'); p2(x + 4, y + 6, '.'); p2(x + 7, y + 3, '.'); p2(x, y + 3, '.'); });   // 오두막
    for (let y = 26; y < 38; y++) { put(22, y, '#'); put(41, y, '#'); } put(22, 31, '.'); put(41, 31, '.');
    arBush(put, 23, 27, 18, 4); arBush(put, 2, 38, 14, 3); arBush(put, 48, 38, 14, 3);
  });
  rect(29, 42, 6, 4, '#', true); rect(30, 43, 4, 2, 'G', true);
  [[27, 43], [27, 44], [36, 43], [36, 44], [31, 40], [32, 40], [31, 47], [32, 47]].forEach(([x, y]) => set(x, y, 'b'));
  return arFinish(m);
}
// 얼음 요새 — 요새 외벽과 망루, 얼음 연못 · 수풀 적음(원거리형 유리)
function arMapIce() {
  const W = 60, H = 84, m = arGrid(W, H), { set, rect, sym } = m;
  rect(0, 0, W, H, '#');
  sym(put => {
    rect(8, 8, 44, 4, '#'); [[16, 11], [17, 11], [42, 11], [43, 11], [29, 8], [30, 8], [29, 11], [30, 11]].forEach(([x, y]) => put(x, y, '.'));   // 요새 외벽
    arStamp(put, [[2, 16], [51, 16]], (p2, x, y) => arBlock(p2, x, y, 7, 7));                        // 망루
    for (let x = 14; x < 46; x += 4) put(x, 20, '#');                                                  // 얼음 기둥 줄
    arPond(put, 18, 28, 4, 3); arPond(put, 42, 28, 4, 3);                                               // 얼음 연못
    arStamp(put, [[6, 32], [50, 32]], (p2, x, y) => arBush(p2, x, y, 5, 3));
    arStamp(put, [[24, 32], [33, 32]], (p2, x, y) => arBlock(p2, x, y, 3, 3));
  });
  rect(27, 40, 6, 4, '#', true); rect(28, 41, 4, 2, 'G', true);
  return arFinish(m);
}
const AR_THEMES = {
  mine:   { floorA: '#E8B777', floorB: '#DDA968', grout: 'rgba(120,70,25,0.18)', wallTop: '#C98A5A', wallFront: '#8E5733', wallLine: '#4A2A14', bushA: '#3FAE4A', bushB: '#2E8A3A', water: '#3AA7E0' },
  jungle: { floorA: '#8BC34A', floorB: '#7DB63F', grout: 'rgba(40,80,20,0.20)', wallTop: '#A38B6A', wallFront: '#6E5A40', wallLine: '#33281A', bushA: '#2F9E44', bushB: '#1F7A34', water: '#2E9BD6' },
  ice:    { floorA: '#D9EEF7', floorB: '#C9E3F0', grout: 'rgba(60,110,150,0.18)', wallTop: '#9CC9E4', wallFront: '#5E8FB3', wallLine: '#23445E', bushA: '#4FB58A', bushB: '#358A67', water: '#7FD0F2' }
};
const AR_ALLY = '#3FA9F5', AR_ALLY_D = '#1C6FB5', AR_ENEMY = '#F24E4E', AR_ENEMY_D = '#A92430';   // 우리 팀은 파랑 · 상대는 빨강 (기기마다 상대적으로)
const AR_FONT = "'Lilita One', Pretendard, sans-serif";

const AR_MAPS = {
  mine:   { name: '젬 광산',   tag: '★2 · 균형', desc: '넓은 마당과 가운데 광산. 양옆 수풀 회랑으로 우회하세요',       build: arMapMine },
  jungle: { name: '정글 협곡', tag: '★3 · 매복', desc: '강이 가로지르고 다리는 두 곳. 수풀이 많고 광산 입구가 좁아 매복이 잘 통합니다', build: arMapJungle },
  ice:    { name: '얼음 요새', tag: '★3 · 원거리', desc: '요새 외벽과 망루, 얼음 연못. 수풀이 적어 원거리형이 유리합니다', build: arMapIce }
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

// CC0 그림 (Kenney.nl) — 불러오기 전·실패 시엔 코드로 그린 모양으로 대체됩니다
const AR_ART = { ready: false, img: {}, n: 0, want: ['bolt', 'rock', 'hawk', 'sprout', 'owl', 'spark', 'grass1', 'grass2', 'sand1', 'sand2', 'tree', 'treeS', 'crateWood', 'crateMetal'] };
function arLoadArt(onDone) {
  if (AR_ART.started || typeof Image === 'undefined') return; AR_ART.started = true;
  AR_ART.want.forEach(k => { const im = new Image(); im.onload = () => { AR_ART.n++; if (AR_ART.n === AR_ART.want.length) { AR_ART.ready = true; (AR_ART.cbs || []).forEach(f => f()); } };
    im.onerror = () => {}; im.src = 'assets/arena/' + k + '.png'; AR_ART.img[k] = im; });
}
const arImg = k => { const im = AR_ART.img[k]; return (im && im.complete && im.naturalWidth) ? im : null; };

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
    arLoadArt(); (AR_ART.cbs = AR_ART.cbs || []).push(() => { this._bgCs = null; });   // 그림이 준비되면 바닥을 다시 굽습니다
    this.peers = {}; this.bullets = []; this.parts = []; this.gems = {}; this.held = 0;
    this.hp = this.ch.hp; this.maxHp = this.ch.hp; this.super = 0; this.dashUntil = 0; this.invulUntil = 0;
    this.ammo = 3; this.ammoT = 0; this.dmgNums = []; this.feed = [];   // 탄약 3칸 · 피해 숫자 · 킬 피드 this.kills = 0; this.score = 0; this.gameOver = false;
    this.mx = 0; this.my = 0; this.aim = null; this.angle = -Math.PI / 2; this.lastFire = 0; this.lastHurt = 0;
    this.deadUntil = 0; this.hidden = false; this.toasts = []; this.winner = null; this.countUntil = 0; this.countTeam = null;
    this.now = 0; this.lastTime = 0; this.face = 1;
    this.spawnAt(this.opts.teamSlot != null ? this.opts.teamSlot * 2 : (this.opts.slot || 0));   // 팀 안 순번 → 팀 출발점 15곳 중 하나
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
    if (this.isDead || this.gameOver || now < this.dashUntil || now - this.lastFire < Math.min(sh.cd, 240) || this.ammo < 1) return;
    this.ammo -= 1; this.ammoT = 0;
    if (!this.aim) this.autoAim();                                    // 조준 조이스틱 없이 발사 버튼만 누르면: 가까운 적을 자동 조준, 없으면 바라보는 방향
    this.lastFire = now; this.recoil = 1;
    for (let i = 0; i < sh.n; i++) { const a = this.angle + (i - (sh.n - 1) / 2) * sh.spread;
      // 폭탄(로브)은 자동 조준한 적의 거리만큼만 날아가 그 자리에 떨어집니다 (최대 사거리 안에서)
      const life = sh.lob && this.aimDist ? Math.max(6, Math.min(sh.life, Math.round(this.aimDist / sh.speed))) : sh.life;
      this.bullets.push({ x: this.x, y: this.y, vx: Math.cos(a) * sh.speed, vy: Math.sin(a) * sh.speed, life: life, dmg: sh.dmg, big: false, lob: !!sh.lob, radius: sh.radius || 0, t0: life }); }
    if (window.Sound) { const k = { rock: 'shotgun', hawk: 'sniper', owl: 'throwBomb', spark: 'smg' }[this.charId] || 'pistol'; Sound[k](); } if (window.Haptic) Haptic.tap();   // 캐릭터별 총소리
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
    this.toast(this.ch.sup.label + '!', '#FFD166'); if (window.Sound) { const k = { dash: 'dash', heal: 'heal', volley: 'throwBomb', pierce: 'sniper', blast: 'shotgun' }[this.ch.sup.kind] || 'boost'; Sound[k](); } if (window.Haptic) Haptic.big();
  }
  onEvent(e) {
    if (!e) return;
    if (e.type === 'kill' && e.target === this.myId) { const v = this.peers[e.victim]; this.feed.unshift({ a: this.myName || '나', b: v ? v.name : '상대', t: this.clock() + 4000, me: true }); this.feed.length = Math.min(3, this.feed.length); this.kills++; this.score += 50; this.toast('처치!', '#FFD166'); if (window.Sound) Sound.kill(); }
    if (e.type === 'heal' && e.target === this.myId && !this.isDead) { this.hp = Math.min(this.maxHp, this.hp + (e.amt || 40)); this.burst(this.x, this.y, 12, '#7DF58F'); this.toast('치유 +' + (e.amt || 40), '#7DF58F'); return; }
    if (e.type === 'hit' && e.target === this.myId) {
      if (this.isDead || this.clock() < this.invulUntil) return;
      this.hp = Math.max(0, this.hp - (e.dmg || 22)); this.lastHurt = this.clock(); this.hurt = 1; this.dmgNums.push({ x: this.x, y: this.y, v: e.dmg || 22, c: '#FF5C7A', t: 0 });
      if (window.Haptic) Haptic.hit(); if (window.Sound) Sound.hurt();
      if (this.hp <= 0) this.die(e.by);
    }
  }
  die(byId) {
    const now = this.clock();
    this.deadUntil = now + 3200;
    // 들고 있던 젬을 그 자리에 떨어뜨림
    if (this.held > 0 && this.opts.onDropGems) { const drops = []; for (let i = 0; i < this.held; i++) { const a = Math.random() * Math.PI * 2, r = 0.4 + Math.random() * 0.9; drops.push([this.x + Math.cos(a) * r, this.y + Math.sin(a) * r]); } this.opts.onDropGems(drops); }
    this.held = 0; this.super = 0;
    this.burst(this.x, this.y, 18, AR_TEAM[this.team].color); if (window.Sound) Sound.death();
    const who = this.peers[byId] && this.peers[byId].name; this.toast((who ? who + '에게 ' : '') + '쓰러졌다 · 3초 뒤 부활', '#FF5C7A');
    this.feed.unshift({ a: who || '상대', b: this.myName || '나', t: this.clock() + 4000, me: false }); this.feed.length = Math.min(3, this.feed.length);
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
      if (this.ammo < 3) { this.ammoT += dt; const need = this.ch.shot.cd * 1.6; if (this.ammoT >= need) { this.ammoT -= need; this.ammo += 1; } }
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
          if (this.opts.onGem) this.opts.onGem(id); if (window.Sound) Sound.gem(); } });
    }
    // 탄
    for (let i = this.bullets.length - 1; i >= 0; i--) { const b = this.bullets[i];
      b.x += b.vx * f; b.y += b.vy * f; b.life -= f;
      // 로브탄(폭탄): 벽을 넘어 날아가 착지점에서 터짐. 관통탄: 벽·적을 뚫음
      let done = b.life <= 0 || (!b.lob && !b.pierce && this.wall(b.x, b.y));
      const pop = (x, y, v, c) => this.dmgNums.push({ x, y, v, c, t: 0 });
      const gain = () => { const wasReady = this.super >= 100; if (window.Sound) Sound.hitmark(); this.super = Math.min(100, this.super + (b.big ? 0 : (this.ch.shot.n >= 3 ? 25 : this.ch.shot.n === 2 ? 35 : 60))); this.hitMark = now + 250; this.score += 2; if (!wasReady && this.super >= 100 && window.Sound) Sound.superReady(); };
      if (b.lob) { if (b.life <= 0) { // 착지 → 범위 피해
          Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (p.dead || p.team === this.team) return; if (Math.hypot(p.x - b.x, p.y - b.y) < b.radius) { if (this.opts.onAttack) this.opts.onAttack('hit', id, { dmg: b.dmg }); gain(); pop(p.x, p.y, b.dmg, '#FFD166'); } });
          this.burst(b.x, b.y, 18, '#FF9F43'); if (window.Sound) Sound.explosion(); done = true; } }
      else if (!done) Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if ((done && !b.pierce) || p.dead || p.team === this.team || (b.pierce && b.hit[id])) return;
        if (Math.hypot(p.x - b.x, p.y - b.y) < (b.big ? (b.radius || 0.9) : 0.55)) { if (!b.pierce) done = true; else b.hit[id] = 1;
          if (this.opts.onAttack) this.opts.onAttack('hit', id, { dmg: b.dmg }); gain(); pop(p.x, p.y, b.dmg, '#FFD166'); this.burst(b.x, b.y, 5, '#FFD166'); } });
      if (done) { if (b.big) this.burst(b.x, b.y, 24, '#FFD166'); this.bullets.splice(i, 1); }
    }
    this.followPeers();
    this.parts = FX.stepParts(this.parts, f, 0.05);
    this.recoil = Math.max(0, (this.recoil || 0) - 0.08 * f); this.hurt = Math.max(0, (this.hurt || 0) - 0.05 * f);
    // 승리 판정: 팀 젬 10개 → 15초 카운트다운
    const cnt = { r: 0, b: 0 }; cnt[this.team] += this.held;
    Object.keys(this.peers).forEach(id => { const p = this.peers[id]; cnt[p.team === 'b' ? 'b' : 'r'] += p.gems || 0; });
    this.teamGems = cnt;
    // 10개 이상이면서 더 많은 팀이 카운트다운 · 둘 다 10개 이상 동점이면 멈춤(남은 시간 유지) · 앞선 팀이 바뀌면 처음부터
    const lead = (cnt.r >= 10 || cnt.b >= 10) ? (cnt.r > cnt.b ? 'r' : cnt.b > cnt.r ? 'b' : 'tie') : null;
    if (lead === 'tie') { if (this.countTeam && !this.countPausedLeft) this.countPausedLeft = Math.max(0, this.countUntil - now); this.countUntil = now + (this.countPausedLeft || 15000); }
    else { if (this.countPausedLeft && lead === this.countTeam) { this.countUntil = now + this.countPausedLeft; } this.countPausedLeft = 0; }
    if (lead && lead !== 'tie' && this.countTeam !== lead) { this.countTeam = lead; this.countUntil = now + 15000; this.toast((lead === this.team ? '우리 팀' : '상대 팀') + ' 젬 10개! 15초 버티면 승리', lead === this.team ? AR_ALLY : AR_ENEMY); }
    if (!lead) { this.countTeam = null; this.countUntil = 0; this.countPausedLeft = 0; }
    if (lead && lead !== 'tie' && now >= this.countUntil) { this.gameOver = true; this.winner = lead; if (this.opts.onFinish) this.opts.onFinish(lead === this.team); if (window.Sound) Sound.levelUp(); }
    this.toasts = this.toasts.filter(t => t.until > now);
    this.dmgNums.forEach(d => d.t += 0.035 * f); this.dmgNums = this.dmgNums.filter(d => d.t < 1); this.feed = this.feed.filter(x => x.t > now);
    this.draw();
  }
  solidMove(x, y) { const c = this.cell(x, y); return c === '#' || c === 'G' || c === 'w'; }   // 물은 걸을 수 없지만 탄은 넘어갑니다
  blocked(x, y) { const r = 0.32; return this.solidMove(x - r, y - r) || this.solidMove(x + r, y - r) || this.solidMove(x - r, y + r) || this.solidMove(x + r, y + r); }

  // 상대 위치를 신호 쪽으로 부드럽게 따라감 (2D·3D 공용 — 명중 판정도 이 위치를 씀)
  followPeers() { Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (p.tx == null) return; p.x += (p.tx - p.x) * 0.5; p.y += (p.ty - p.y) * 0.5; if (p.tangle != null) p.angle = p.tangle; }); }
  getSnapshot() { return this.snapshotScaled(36, 48); }
  snapshotScaled(SW, SH) {
    const g = []; for (let y = 0; y < SH; y++) { g.push([]); for (let x = 0; x < SW; x++) { const c = this.map[Math.floor(y * this.H / SH)][Math.floor(x * this.W / SW)]; g[y].push(c === '#' ? 63 : c === 'G' ? 64 : c === 'b' ? 65 : c === 'w' ? 58 : 66); } }
    const put = (wx, wy, v) => { const x = Math.floor(wx * SW / this.W), y = Math.floor(wy * SH / this.H); if (g[y] && g[y][x] != null) g[y][x] = v; };
    Object.keys(this.gems).forEach(id => { const gm = this.gems[id]; if (gm && !gm.by) put(gm.x, gm.y, 67); });
    Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (!p.dead) put(p.x, p.y, p.team === 'b' ? 69 : 68); });
    if (!this.isDead) put(this.x, this.y, 23);
    return g;
  }
  _oldSnapshot() {
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
    // 한 칸을 화면에서 34~46px 로: 폰은 가로 약 10칸, 태블릿은 가로 18~26칸이 보입니다 (큰 화면일수록 더 넓게)
    const cellPx = Math.max(34, Math.min(46, Math.min(SW, SH) / 10.5));
    const z = Math.max(0.5, cellPx / cs);
    const vw = SW / z, vh = SH / z;                                  // 화면이 담는 월드 크기
    const camX = W <= vw ? W / 2 : Math.max(vw / 2, Math.min(W - vw / 2, this.x * cs));
    const camY = H <= vh ? H / 2 : Math.max(vh / 2, Math.min(H - vh / 2, this.y * cs));
    this._view = { z, camX, camY, SW, SH };
    if (!this.world3d) {                                              // 3D 판(ArenaGame3D)은 월드를 Three.js 로 그리고 여기선 HUD 만
    if (!this._bg || this._bgCs !== cs) this.buildBg(cs);
    ctx.fillStyle = (AR_THEMES[this.mapId] || AR_THEMES.mine).wallFront; ctx.fillRect(0, 0, SW, SH);          // 지도 밖 여백
    ctx.save(); ctx.translate(SW / 2 - camX * z, SH / 2 - camY * z); ctx.scale(z, z);
    ctx.drawImage(this._bg, 0, -this._lift);
    // 젬 (빛나는 보석)
    Object.keys(this.gems).forEach(id => { const gm = this.gems[id]; if (!gm || gm.by) return; const gx = gm.x * cs, gy = gm.y * cs + Math.sin(now / 260 + gm.x) * cs * 0.06;
      const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, cs * 0.7); gr.addColorStop(0, 'rgba(177,93,255,0.45)'); gr.addColorStop(1, 'rgba(177,93,255,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(gx, gy, cs * 0.7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#B15DFF'; ctx.beginPath(); ctx.moveTo(gx, gy - cs * 0.3); ctx.lineTo(gx + cs * 0.22, gy); ctx.lineTo(gx, gy + cs * 0.3); ctx.lineTo(gx - cs * 0.22, gy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.moveTo(gx, gy - cs * 0.3); ctx.lineTo(gx + cs * 0.22, gy); ctx.lineTo(gx, gy - cs * 0.02); ctx.closePath(); ctx.fill(); });
    // 상대 (수풀 은신은 가까울 때만)
    Object.keys(this.peers).forEach(id => { const p = this.peers[id];
      const k = FX.ease.outCubic(1); const b = p.buf; let px = p.tx != null ? p.tx : p.x, py = p.ty != null ? p.ty : p.y;
      // (위치 따라가기는 followPeers() 에서 — 3D 판도 같은 계산을 쓰도록 분리)
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
    // 벽 윗면·수풀을 캐릭터 위에 덮어 깊이감 (벽 뒤 캐릭터는 가려지고, 내가 수풀에 있으면 수풀이 반투명)
    ctx.save(); if (this.hidden) ctx.globalAlpha = 0.55; ctx.drawImage(this._top, 0, -this._lift); ctx.restore();
    // 피해 숫자: 떠오르며 사라짐
    this.dmgNums.forEach(d => { const k = FX.ease.outCubic(d.t); ctx.globalAlpha = 1 - d.t; FX.text(ctx, String(d.v), d.x * cs, (d.y - 1.1) * cs - k * cs * 1.2, { size: cs * (0.6 + 0.3 * (1 - d.t)), weight: 400, font: AR_FONT, color: d.c, align: 'center', stroke: '#1B1B2F' }); ctx.globalAlpha = 1; });
    FX.drawParts(ctx, this.parts, cs, 3);
    ctx.restore();
    } else ctx.clearRect(0, 0, SW, SH);
    if (this.world3d && this.drawLabels3D) this.drawLabels3D(ctx, SW, SH);   // 3D: 이름·체력·피해 숫자를 화면 좌표로
    // ── 여기부터 화면 좌표 (HUD) ──
    const HW = SW, HH = SH;
    // 피격 붉은 테두리
    if (this.hurt > 0.01) { ctx.fillStyle = 'rgba(255,60,80,' + (this.hurt * 0.35).toFixed(2) + ')'; ctx.fillRect(0, 0, HW, HH); }
    this.drawMinimap(ctx, HW, HH);
    // ── HUD: 팀 젬 · 카운트다운 ──
    const tg = this.teamGems || { r: 0, b: 0 }, mine = tg[this.team] || 0, theirs = tg[this.team === 'r' ? 'b' : 'r'] || 0, OUT = '#1B1B2F';
    // ── 젬 카운터 (위 가운데): 왼쪽 우리 팀(파랑) · 오른쪽 상대(빨강) · 가운데 카운트다운 ──
    const gemIcon = (x, y, sz) => { ctx.fillStyle = OUT; ctx.beginPath(); ctx.moveTo(x, y - sz - 2); ctx.lineTo(x + sz * 0.8 + 2, y); ctx.lineTo(x, y + sz + 2); ctx.lineTo(x - sz * 0.8 - 2, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#B15DFF'; ctx.beginPath(); ctx.moveTo(x, y - sz); ctx.lineTo(x + sz * 0.8, y); ctx.lineTo(x, y + sz); ctx.lineTo(x - sz * 0.8, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#E3C6FF'; ctx.beginPath(); ctx.moveTo(x, y - sz); ctx.lineTo(x + sz * 0.8, y); ctx.lineTo(x, y - sz * 0.1); ctx.closePath(); ctx.fill(); };
    const pill = (x, w, fill) => { ctx.fillStyle = OUT; FX.rr(ctx, x - 2, 8, w + 4, 46, 16); ctx.fill(); ctx.fillStyle = fill; FX.rr(ctx, x, 10, w, 42, 14); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.22)'; FX.rr(ctx, x + 3, 12, w - 6, 14, 8); ctx.fill(); };
    pill(HW / 2 - 150, 104, AR_ALLY); pill(HW / 2 + 46, 104, AR_ENEMY);
    gemIcon(HW / 2 - 122, 31, 11); FX.text(ctx, String(mine), HW / 2 - 76, 42, { size: 30, weight: 400, font: AR_FONT, color: '#fff', align: 'center', stroke: OUT, strokeW: 5 });
    gemIcon(HW / 2 + 122, 31, 11); FX.text(ctx, String(theirs), HW / 2 + 76, 42, { size: 30, weight: 400, font: AR_FONT, color: '#fff', align: 'center', stroke: OUT, strokeW: 5 });
    // 가운데: 카운트다운 (앞선 팀 색 원) 또는 목표 10
    { const cx = HW / 2, cy = 31, lead = this.countTeam, tie = mine >= 10 && mine === theirs;
      ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(cx, cy, 25, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = lead && !tie ? (lead === this.team ? AR_ALLY : AR_ENEMY) : '#3A3F55'; ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.fill();
      if (lead && !tie) { const kk = Math.max(0, Math.min(1, (this.countUntil - now) / 15000)); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * kk); ctx.stroke(); }
      FX.text(ctx, lead ? (tie ? '=' : String(Math.ceil((this.countUntil - now) / 1000))) : '10', cx, cy + 10, { size: lead ? 26 : 20, weight: 400, font: AR_FONT, color: '#fff', align: 'center', stroke: OUT, strokeW: 4 }); }
    if (this.countTeam && !(mine >= 10 && mine === theirs)) FX.text(ctx, this.countTeam === this.team ? '버티면 승리!' : '막아야 해요!', HW / 2, 72, { size: 15, weight: 400, font: AR_FONT, color: this.countTeam === this.team ? '#BFE3FF' : '#FFC2C2', align: 'center', stroke: OUT, strokeW: 4 });
    // 킬 피드 (오른쪽 위): 처치한 쪽 색 → 당한 쪽 색
    this.feed.forEach((fd, i) => { const y = 84 + i * 26, w = 170, x0 = HW - w - 10; ctx.fillStyle = 'rgba(27,27,47,0.8)'; FX.rr(ctx, x0, y, w, 22, 11); ctx.fill();
      FX.text(ctx, fd.a, x0 + w / 2 - 14, y + 16, { size: 12, weight: 800, color: fd.me ? '#8FD0FF' : '#FF8A8A', align: 'right' });
      FX.text(ctx, '💀', x0 + w / 2, y + 16, { size: 11, align: 'center' });
      FX.text(ctx, fd.b, x0 + w / 2 + 14, y + 16, { size: 12, weight: 800, color: fd.me ? '#FF8A8A' : '#8FD0FF' }); });
    this.toasts.slice(-2).forEach((t, i) => { FX.text(ctx, t.text, HW / 2, HH * 0.3 + i * 30, { size: 22, weight: 400, font: AR_FONT, color: t.color, align: 'center', stroke: '#1B1B2F', strokeW: 5 }); });
    if (this.isDead) { ctx.fillStyle = 'rgba(8,10,16,0.55)'; ctx.fillRect(0, 0, HW, HH); FX.text(ctx, '부활까지 ' + Math.ceil((this.deadUntil - now) / 1000), HW / 2, HH / 2, { size: 40, weight: 400, font: AR_FONT, color: '#fff', align: 'center', baseline: 'middle', stroke: '#1B1B2F', strokeW: 7 }); }
    if (this.gameOver) { ctx.fillStyle = 'rgba(8,10,16,0.65)'; ctx.fillRect(0, 0, HW, HH); const win = this.winner === this.team;
      FX.text(ctx, win ? '승리!' : '패배', HW / 2, HH / 2 - 20, { size: 64, weight: 400, font: AR_FONT, color: win ? '#FFD166' : '#C9CFDA', align: 'center', baseline: 'middle', stroke: '#1B1B2F', strokeW: 9 });
      FX.text(ctx, (this.winner === this.team ? '우리 팀' : '상대 팀') + '이 젬 10개를 지켰습니다', HW / 2, HH / 2 + 30, { size: 17, weight: 700, color: '#fff', align: 'center', baseline: 'middle' }); }
  }
  drawBrawler(ctx, cs, x, y, angle, team, hpK, name, alpha, isMe, gems, sup, chId, dashing) {
    const ch = AR_CHARS[chId] || AR_CHARS.bolt, px = x * cs, py = y * cs, ally = team === this.team;
    const C = ally ? AR_ALLY : AR_ENEMY, CD = ally ? AR_ALLY_D : AR_ENEMY_D, r = cs * (ch.hp >= 150 ? 0.5 : ch.hp <= 85 ? 0.38 : 0.44), OUT = '#1B1B2F';
    ctx.save(); ctx.globalAlpha = alpha;
    // 발밑: 팀색 고리 + 그림자 (브롤처럼 누가 누군지 발밑으로)
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(px, py + r * 0.85, r * 1.05, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = isMe ? '#FFFFFF' : C; ctx.lineWidth = Math.max(2, cs * 0.08); ctx.beginPath(); ctx.ellipse(px, py + r * 0.85, r * 1.1, r * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
    if (dashing) { ctx.strokeStyle = 'rgba(255,209,102,0.75)'; ctx.lineWidth = r * 0.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(px - Math.cos(angle) * r * 3.2, py - Math.sin(angle) * r * 3.2); ctx.lineTo(px, py); ctx.stroke(); }
    // 몸: 굵은 테두리 · 위쪽 광택 · 캐릭터 모양 (몸을 살짝 위로 — 발밑 고리가 보이게)
    const by0 = py - r * 0.15;
    const body = () => { ctx.beginPath();
      if (ch.shape === 'square') FX.rr(ctx, px - r, by0 - r, r * 2, r * 2, r * 0.45);
      else if (ch.shape === 'diamond') { ctx.moveTo(px, by0 - r * 1.2); ctx.lineTo(px + r * 1.08, by0); ctx.lineTo(px, by0 + r * 1.15); ctx.lineTo(px - r * 1.08, by0); ctx.closePath(); }
      else if (ch.shape === 'tri') { ctx.moveTo(px, by0 - r * 1.2); ctx.lineTo(px + r * 1.1, by0 + r * 0.9); ctx.lineTo(px - r * 1.1, by0 + r * 0.9); ctx.closePath(); }
      else ctx.arc(px, by0, r, 0, Math.PI * 2); };
    const spr = arImg(chId in AR_CHARS ? chId : 'bolt');
    if (spr) {
      // 그림 캐릭터: 오른쪽을 보는 그림을 조준 방향으로 회전 · 팀색 윤곽 광채 (누가 우리 편인지 한눈에)
      const sc = (r * 2.6) / spr.naturalHeight, w = spr.naturalWidth * sc, h = spr.naturalHeight * sc;
      ctx.save(); ctx.translate(px, by0); ctx.rotate(angle);
      ctx.shadowColor = C; ctx.shadowBlur = Math.max(6, cs * 0.35); ctx.drawImage(spr, -h * 0.5, -h / 2, w, h);
      ctx.shadowBlur = 0; ctx.drawImage(spr, -h * 0.5, -h / 2, w, h); ctx.restore();
    } else {
    body(); ctx.lineWidth = Math.max(3, cs * 0.14); ctx.strokeStyle = OUT; ctx.stroke();
    const g = ctx.createLinearGradient(0, by0 - r, 0, by0 + r); g.addColorStop(0, FX.tint(C, 0.35)); g.addColorStop(1, CD); ctx.fillStyle = g; body(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.ellipse(px - r * 0.25, by0 - r * 0.45, r * 0.45, r * 0.22, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(px, by0); ctx.rotate(angle);
    ctx.fillStyle = OUT; FX.rr(ctx, r * 0.35, -r * 0.24, r * 1.05, r * 0.48, r * 0.16); ctx.fill();
    ctx.fillStyle = '#4A5068'; FX.rr(ctx, r * 0.42, -r * 0.16, r * 0.9, r * 0.32, r * 0.1); ctx.fill(); ctx.restore();
    const ex = Math.cos(angle) * r * 0.22, ey = Math.sin(angle) * r * 0.22;
    [-1, 1].forEach(sd => { const ox = px + ex + sd * r * 0.32, oy = by0 - r * 0.05 + ey * 0.6;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ox, oy, r * 0.2, r * 0.25, 0, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(ox + ex * 0.35, oy + ey * 0.35, r * 0.1, 0, Math.PI * 2); ctx.fill(); });
    }
    // 머리 위: 이름(테두리 글자) → 체력바(두꺼운 검은 테두리, 나 초록 · 우리 파랑 · 상대 빨강) → 내 탄약
    const bw = cs * 1.55, bh = cs * 0.24, bx = px - bw / 2, bY = by0 - r - cs * 0.55;
    ctx.fillStyle = OUT; FX.rr(ctx, bx - 2, bY - 2, bw + 4, bh + 4, bh * 0.6); ctx.fill();
    ctx.fillStyle = '#3A3F55'; FX.rr(ctx, bx, bY, bw, bh, bh * 0.5); ctx.fill();
    ctx.fillStyle = isMe ? '#5EE05E' : (ally ? '#4CB3FF' : '#FF5A5A'); FX.rr(ctx, bx, bY, bw * Math.max(0, Math.min(1, hpK)), bh, bh * 0.5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; FX.rr(ctx, bx + 2, bY + 1, Math.max(0, bw * Math.max(0, Math.min(1, hpK)) - 4), bh * 0.35, bh * 0.2); ctx.fill();
    FX.text(ctx, String(Math.max(0, Math.round(hpK * ch.hp))), px, bY + bh * 0.82, { size: bh * 1.05, weight: 400, font: AR_FONT, color: '#fff', align: 'center', stroke: OUT, strokeW: 2.5 });
    if (sup >= 100) { ctx.strokeStyle = '#FFD166'; ctx.lineWidth = 2; FX.rr(ctx, bx - 4, bY - 4, bw + 8, bh + 8, bh * 0.7); ctx.stroke(); }
    FX.text(ctx, (name || '') + (gems ? '  ◆' + gems : ''), px, bY - cs * 0.12, { size: cs * 0.44, weight: 400, font: AR_FONT, color: isMe ? '#FFFFFF' : (ally ? '#BFE3FF' : '#FFC2C2'), align: 'center', stroke: OUT, strokeW: 3.5 });
    if (isMe) { const gap = cs * 0.07, aw = (bw - gap * 2) / 3, ah = cs * 0.2, ay = bY + bh + cs * 0.12; for (let k = 0; k < 3; k++) { const full = k < Math.floor(this.ammo), part = k === Math.floor(this.ammo) ? this.ammoT / (this.ch.shot.cd * 1.6) : 0, ax = bx + k * (aw + gap);
        ctx.fillStyle = OUT; FX.rr(ctx, ax - 1.5, ay - 1.5, aw + 3, ah + 3, ah * 0.5); ctx.fill(); ctx.fillStyle = '#3A3F55'; FX.rr(ctx, ax, ay, aw, ah, ah * 0.4); ctx.fill();
        if (full || part > 0) { ctx.fillStyle = full ? '#FF9F1C' : 'rgba(255,159,28,0.5)'; FX.rr(ctx, ax, ay, aw * (full ? 1 : part), ah, ah * 0.4); ctx.fill(); if (full) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; FX.rr(ctx, ax + 1, ay + 1, aw - 2, ah * 0.35, ah * 0.2); ctx.fill(); } } } }
    ctx.restore();
  }
  // 미니맵: 지도 전체를 작게 — 벽·수풀·광산, 젬(보라), 브롤러(팀색, 나는 금색), 내 시야 사각형
  drawMinimap(ctx, SW, SH) {
    const ui = Math.max(1, Math.min(1.7, Math.min(SW, SH) / 412)), u = Math.min(84 * ui / this.W, 118 * ui / this.H), mw = this.W * u, mh = this.H * u, mx = 10, my = 64;   // 맵 크기에 맞춰 (태블릿은 최대 1.7배)
    if (!this._mm || this._mmU !== u) { this._mmU = u; const c = document.createElement('canvas'); c.width = Math.ceil(mw); c.height = Math.ceil(mh); const g = c.getContext('2d');
      g.fillStyle = 'rgba(8,10,16,0.75)'; g.fillRect(0, 0, mw, mh);
      for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) { const c2 = this.map[y][x]; if (c2 === '.') continue;
        g.fillStyle = c2 === 'b' ? '#2E8B57' : c2 === 'G' ? '#8B5CF6' : c2 === 'w' ? '#3AA7E0' : '#7A8499'; g.fillRect(x * u, y * u, u + 0.5, u + 0.5); } this._mm = c; }
    ctx.drawImage(this._mm, mx, my);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(mx - 0.5, my - 0.5, mw + 1, mh + 1);
    Object.keys(this.gems).forEach(id => { const gm = this.gems[id]; if (!gm || gm.by) return; ctx.fillStyle = '#B15DFF'; ctx.fillRect(mx + gm.x * u - 1, my + gm.y * u - 1, 2, 2); });
    Object.keys(this.peers).forEach(id => { const p = this.peers[id]; if (p.dead) return; if (p.hidden && p.team !== this.team) return;
      ctx.fillStyle = p.team === this.team ? AR_ALLY : AR_ENEMY; ctx.beginPath(); ctx.arc(mx + p.x * u, my + p.y * u, 2.4, 0, Math.PI * 2); ctx.fill(); });
    if (!this.isDead) { ctx.fillStyle = '#FFD166'; ctx.beginPath(); ctx.arc(mx + this.x * u, my + this.y * u, 2.8, 0, Math.PI * 2); ctx.fill(); }
    const v = this.world3d ? null : this._view; if (v) { const cs = this.cellSize; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.strokeRect(mx + (v.camX - v.SW / v.z / 2) / cs * u, my + (v.camY - v.SH / v.z / 2) / cs * u, v.SW / v.z / cs * u, v.SH / v.z / cs * u); }
  }
  buildBg(cs) {
    const th = AR_THEMES[this.mapId] || AR_THEMES.mine, W = this.W * cs, H = this.H * cs, LIFT = cs * 0.45;   // 벽 높이만큼 윗면을 올려 그림
    const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H + LIFT; return c; };
    const floor = mk(), top = mk(), g = floor.getContext('2d'), t = top.getContext('2d');
    const at = (x, y) => (this.map[y] && this.map[y][x]) || '#', solid = c => c === '#' || c === 'G';
    // 바닥: 그림 타일(2×2칸에 한 장) — 광산·얼음은 모래, 정글은 잔디. 얼음은 푸른 눈빛을 덧칠
    const tA = arImg(this.mapId === 'jungle' ? 'grass1' : 'sand1'), tB = arImg(this.mapId === 'jungle' ? 'grass2' : 'sand2');
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) { g.fillStyle = (x + y) % 2 ? th.floorA : th.floorB; g.fillRect(x * cs, y * cs + LIFT, cs, cs); }
    if (tA && tB) { for (let y = 0; y < this.H; y += 2) for (let x = 0; x < this.W; x += 2) g.drawImage(((x * 7 + y * 3) >> 1) % 5 === 0 ? tB : tA, x * cs, y * cs + LIFT, cs * 2, cs * 2);
      if (this.mapId === 'ice') { g.fillStyle = 'rgba(214,236,250,0.72)'; g.fillRect(0, LIFT, W, H); } }
    g.strokeStyle = th.grout; g.lineWidth = 1; for (let x = 0; x <= this.W; x += 2) { g.beginPath(); g.moveTo(x * cs, LIFT); g.lineTo(x * cs, H + LIFT); g.stroke(); } for (let y = 0; y <= this.H; y += 2) { g.beginPath(); g.moveTo(0, y * cs + LIFT); g.lineTo(W, y * cs + LIFT); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,0.06)'; for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) { const h = (x * 73 + y * 151) % 23; if (h < 3) { g.beginPath(); g.arc(x * cs + cs * (0.25 + h * 0.2), y * cs + LIFT + cs * (0.3 + h * 0.15), cs * 0.07, 0, Math.PI * 2); g.fill(); } }
    // 팀 진영 (위 · 아래 5줄): 은은한 팀색 — 내 진영이 파랑
    const myTop = this.team === 'r';
    g.fillStyle = myTop ? 'rgba(63,169,245,0.14)' : 'rgba(242,78,78,0.14)'; g.fillRect(0, LIFT, W, cs * 6);
    g.fillStyle = myTop ? 'rgba(242,78,78,0.14)' : 'rgba(63,169,245,0.14)'; g.fillRect(0, H + LIFT - cs * 6, W, cs * 6);
    // 물: 파란 바탕 + 물결 · 가장자리 밝은 선
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) { if (at(x, y) !== 'w') continue; const px = x * cs, py = y * cs + LIFT;
      g.fillStyle = th.water; g.fillRect(px, py, cs, cs); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(px + cs * 0.15, py + cs * 0.45); g.quadraticCurveTo(px + cs * 0.35, py + cs * 0.3, px + cs * 0.55, py + cs * 0.45); g.stroke();
      if (at(x, y - 1) !== 'w') { g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(px, py, cs, 2); } }
    // 벽: 바닥 그림자 → 앞면(바닥층) · 윗면(윗면층, 위로 LIFT 만큼)
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) { const c = at(x, y); if (!solid(c)) continue; const px = x * cs, py = y * cs + LIFT;
      if (!solid(at(x, y + 1)) && !solid(at(x + 1, y))) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(px + cs * 0.2, py + cs, cs, cs * 0.3); }
      if (!solid(at(x, y + 1))) { g.fillStyle = c === 'G' ? '#5B3AAF' : th.wallFront; g.fillRect(px, py + cs - LIFT, cs, LIFT); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px, py + cs - 2, cs, 2); }
      const tx = px, ty = py - LIFT;
      t.fillStyle = c === 'G' ? '#8B5CF6' : th.wallTop; t.fillRect(tx, ty, cs, cs);
      const crate = c === 'G' ? null : arImg(this.mapId === 'ice' ? 'crateMetal' : 'crateWood');
      if (crate) { t.drawImage(crate, tx, ty, cs, cs); if (this.mapId === 'jungle') { t.fillStyle = 'rgba(90,110,60,0.35)'; t.fillRect(tx, ty, cs, cs); } }
      t.fillStyle = 'rgba(255,255,255,0.18)'; if (!solid(at(x, y - 1))) t.fillRect(tx, ty, cs, cs * 0.18);
      t.strokeStyle = th.wallLine; t.lineWidth = 2; t.beginPath();
      if (!solid(at(x, y - 1))) { t.moveTo(tx, ty + 1); t.lineTo(tx + cs, ty + 1); } if (!solid(at(x - 1, y))) { t.moveTo(tx + 1, ty); t.lineTo(tx + 1, ty + cs); } if (!solid(at(x + 1, y))) { t.moveTo(tx + cs - 1, ty); t.lineTo(tx + cs - 1, ty + cs); } t.stroke();
      if (c === 'G') { t.fillStyle = '#C9A7FF'; t.beginPath(); t.moveTo(tx + cs / 2, ty + cs * 0.18); t.lineTo(tx + cs * 0.78, ty + cs * 0.5); t.lineTo(tx + cs / 2, ty + cs * 0.82); t.lineTo(tx + cs * 0.22, ty + cs * 0.5); t.closePath(); t.fill(); } }
    // 벽 윗면 앞 가장자리(앞면과 만나는 선)
    t.strokeStyle = 'rgba(0,0,0,0.35)'; t.lineWidth = 2; for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) { if (!solid(at(x, y)) || solid(at(x, y + 1))) continue; const tx = x * cs, ty = y * cs; t.beginPath(); t.moveTo(tx, ty + cs); t.lineTo(tx + cs, ty + cs); t.stroke(); }
    // 수풀: 윗면층에 둥근 덤불 여러 개 (캐릭터를 가림)
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) { if (at(x, y) !== 'b') continue; const px = x * cs, py = y * cs + LIFT * 0.35;
      const tree = arImg(((x * 5 + y * 3) % 3 === 0) ? 'tree' : 'treeS');
      if (tree) t.drawImage(tree, px - cs * 0.25, py - cs * 0.25, cs * 1.5, cs * 1.5);   // 이웃 칸과 겹치게 조금 크게 — 이어진 덤불처럼
      else [[0.25, 0.55, 0.36], [0.72, 0.5, 0.34], [0.5, 0.25, 0.38], [0.5, 0.78, 0.32]].forEach(([ox, oy, rr], k) => {
        t.fillStyle = k === 2 ? th.bushA : th.bushB; t.beginPath(); t.arc(px + cs * ox, py + cs * oy, cs * rr, 0, Math.PI * 2); t.fill(); });
      t.fillStyle = 'rgba(255,255,255,0.14)'; t.beginPath(); t.arc(px + cs * 0.42, py + cs * 0.18, cs * 0.14, 0, Math.PI * 2); t.fill(); }
    this._bg = floor; this._top = top; this._lift = LIFT; this._bgCs = cs;
  }
}
