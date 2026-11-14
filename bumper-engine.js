// 범퍼카 서바이벌 3D — 규칙 · 경기장 · 차 물리 · 통신 (그리기 없음 · node 에서도 돎). 3D 그림 · HUD 는 bumper3d-engine.js
//   · 하늘에 뜬 둥근 경기장(고리 모양 조각들). 라운드(60초)마다 바깥 고리부터 조각이 흔들리다 떨어져 좁아짐 → 다음 라운드에 다시 넓어짐
//     어느 조각이 언제 떨어지는지는 판 시작 시각(seed) + 서버 시계로 정해 모든 화면이 같음 (범퍼 · 점프대 · 아이템 자리도)
//   · 크기: 선생님이 시작할 때 인원을 붙임('auto:24') → 늦게 온 학생도 같은 크기 (없으면 16명 크기)
//   · 공유 물리 없음: 각 기기가 자기 차만 움직임. 부딪힘은 '맞은 쪽 화면 기준' —
//       내 화면에서 친구 차(받은 위치 + 속도로 앞당겨 그린 자리)와 겹치면 내가 내 튕김을 계산 (친구의 속도 · 돌진 · 무게는 신호에 실린 값)
//       친구도 자기 화면에서 똑같이 → 사건 없이 양쪽이 튕김. 같은 접촉은 한 번(친구별 접촉 쿨다운)
//       한쪽 화면에서만 겹쳤으면(신호 간격 사이에 스친 경우) 그 쪽 신호에 '접촉 메아리'(상대 id · 다가온 속도)를 실음 →
//       상대 화면에서도 0.5초 안에 거의 닿아 보였을 때만(겹침 + 0.45m) 같은 세기로 튕김 — 안 닿아 보였으면 무시 (억울하게 날아가지 않게)
//   · 떨어지면 내가 'fall' 사건(마지막으로 나를 친 친구 id · 목숨 번호)을 한 번 보냄 → 친구가 +3점 (목숨 번호로 중복 막음)
//   · 점수: 떨어뜨리기 +3 · 10초 버틸 때마다 +1 · 라운드 끝까지 살아남으면 +2. 점수는 각자 셈 → 신호 · 선생님 화면 · 결과가 같은 숫자

const BP_ROUND_MS = 60000;           // 한 라운드
const BP_CRUMBLE_START = 13000;      // 라운드 시작 뒤 이때부터 바깥 고리가 떨어짐
const BP_CRUMBLE_END = 52000;        // 이때까지 가운데만 남음
const BP_WARN_MS = 2600;             // 떨어지기 전 흔들림 · 빨간 경고
const BP_CORE_R = 5.6, BP_RING_W = 2.6;
const BP_CAR_R = 1.1, BP_HEAVY_R = 1.3;
const BP_RESPAWN_MS = 2600, BP_GHOST_MS = 1600;
const BP_DASH_MS = 320, BP_DASH_CD = 2200, BP_DASH_SPD = 17;
const BP_ACC = 14, BP_KF = 1.75, BP_KL = 5.0, BP_TURN = 8.5;
const BP_CREDIT_MS = 4000;           // 떨어지기 전 이 시간 안에 나를 친 친구가 점수를 받음
const BP_PAIR_CD = 450;              // 같은 친구와 다시 튕기기까지
const BP_ECHO_MS = 650, BP_ECHO_NEAR = 0.7, BP_ECHO_WIN = 500;
const BP_FALL_Y = -24, BP_G = 22;
const BP_STAMP_WRAP = 60466176;      // 보낸 시각(서버 ms)을 36진수 5자리로
const BP_BASE_LAT = 80, BP_LEAD = 1.0;
const BP_END_GRACE = 700;            // 시간 끝 → 0.7초 기다렸다 순위 (끝나기 직전 떨어뜨린 점수가 도착하게)
const BP_PTS_KO = 3, BP_PTS_SURV = 1, BP_SURV_MS = 10000, BP_PTS_ROUND = 2;
const BP_ITEMS = {
  heavy:  { name: '무거워지기', icon: '🪨', ms: 8000, color: '#9AA4B2', desc: '덜 밀리고 더 세게 밀어요' },
  shield: { name: '방패',      icon: '🛡', ms: 6000, color: '#5EC8FF', desc: '튕김이 아주 약해져요' },
  super:  { name: '슈퍼 돌진',  icon: '⚡', ms: 9000, color: '#FFD447', desc: '돌진이 두 배로 세고 자주 써져요' }
};
const BP_ITEM_KEYS = ['heavy', 'shield', 'super'];
const BP_FONT = "'Lilita One', Pretendard, sans-serif";

// ── 결정적 난수 (기기마다 같은 결과) ──
function bpHash(a, b, c) { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function bpRng(seed) { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const bpAng = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const bpShort = id => String(id || '').slice(-4);
// 인원별 경기장 반지름(m): 8명 ≈ 18 · 16명 ≈ 21 · 30명 ≈ 26 (가운데 원 + 고리 너비 2.6m 단위로 맞춤)
function bpRadiusFor(n) { n = Math.max(1, Math.min(40, +n || 16)); const want = 8.5 + 3.3 * Math.sqrt(n); const K = Math.max(3, Math.round((want - BP_CORE_R) / BP_RING_W)); return { K, R: BP_CORE_R + K * BP_RING_W }; }
function bpParseTrack(track) { const a = String(track || '').split(':'), n = parseInt(a[1], 10); return n > 0 ? n : 16; }

// ── 경기장: 고리 조각 배치 · 떨어지는 시각 · 범퍼 · 점프대 · 아이템 (같은 seed · 크기면 같은 결과) ──
class BpArena {
  constructor(n, seed) {
    const rr = bpRadiusFor(n); this.n = n; this.K = rr.K; this.R = rr.R; this.seed = seed;
    this.s0 = Math.floor((+seed || 0) / 1000) % 1000003;
    this.nSec = [1]; this.rot = [0];
    for (let k = 1; k <= this.K; k++) { const mid = BP_CORE_R + (k - 0.5) * BP_RING_W; this.nSec.push(Math.max(6, Math.round(2 * Math.PI * mid / 3.3))); this.rot.push(bpHash(this.s0, k, 11) * Math.PI * 2); }
    this.tiles = 0; for (let k = 1; k <= this.K; k++) this.tiles += this.nSec[k];
    this.cache = {};
  }
  ringOf(r) { if (r < BP_CORE_R) return 0; const k = Math.floor((r - BP_CORE_R) / BP_RING_W) + 1; return k > this.K ? -1 : k; }
  secOf(k, ang) { if (k <= 0) return 0; const n = this.nSec[k]; let a = (ang - this.rot[k]) / (Math.PI * 2); a -= Math.floor(a); return Math.min(n - 1, Math.floor(a * n)); }
  // 라운드 r 의 배치 (한 번만 만들어 둠)
  round(r) {
    r = Math.max(0, r | 0); let L = this.cache[r]; if (L) return L;
    const keys = Object.keys(this.cache); if (keys.length > 3) delete this.cache[keys.sort((a, b) => a - b)[0]];
    L = this.cache[r] = { r, fall: [] }; const rng = bpRng(Math.floor(bpHash(this.s0, r, 77) * 4294967295));
    const K = this.K, span = (BP_CRUMBLE_END - BP_CRUMBLE_START) / K;
    L.fall.push(new Float64Array(1).fill(Infinity));
    for (let k = 1; k <= K; k++) { const n = this.nSec[k], a = new Float64Array(n), w0 = BP_CRUMBLE_START + (K - k) * span;
      // 고리 안에서도 한 곳부터 번지듯 (시작 조각에서 멀수록 늦게) + 조금씩 흩어짐
      const start = Math.floor(rng() * n), dirs = rng() < 0.5 ? 1 : -1;
      for (let s = 0; s < n; s++) { let d = ((s - start) * dirs + n) % n; d = Math.min(d, n - d) / (n / 2); a[s] = Math.round(w0 + span * (0.12 + 0.68 * d + 0.25 * rng())); }
      L.fall.push(a); }
    // 범퍼 기둥 (정해진 자리 · 그 조각이 떨어지면 함께 떨어짐) · 점프대(바깥 → 가운데로 튕겨 줌)
    const nb = Math.max(2, Math.min(6, Math.round(1.5 + this.n / 6))); L.bumpers = [];
    for (let i = 0, tries = 0; i < nb && tries < 60; tries++) { const k = 1 + Math.floor(rng() * Math.max(1, K - 1)), ang = rng() * Math.PI * 2, rad = BP_CORE_R + (k - 0.5) * BP_RING_W;
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad; if (L.bumpers.some(b => Math.hypot(b.x - x, b.z - z) < 7)) continue;
      L.bumpers.push({ x, z, r: 0.85, k, s: this.secOf(k, ang) }); i++; }
    const np = this.K >= 4 ? 2 : 1; L.pads = [];
    for (let i = 0, tries = 0; i < np && tries < 60; tries++) { const k = Math.max(2, K - 1), ang = rng() * Math.PI * 2, rad = BP_CORE_R + (k - 0.5) * BP_RING_W;
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad; if (L.pads.some(b => Math.hypot(b.x - x, b.z - z) < 12) || L.bumpers.some(b => Math.hypot(b.x - x, b.z - z) < 4)) continue;
      L.pads.push({ x, z, r: 1.15, k, s: this.secOf(k, ang) }); i++; }
    // 아이템: 4초부터 8초 간격 · 나타난 뒤 14초 넘게 남는 조각 위에만
    L.items = [];
    for (let i = 0, t = 4000; t < BP_CRUMBLE_END - 4000; i++, t += 8000) {
      const kind = BP_ITEM_KEYS[Math.floor(rng() * BP_ITEM_KEYS.length)];
      for (let tries = 0; tries < 30; tries++) { const rad = 2 + rng() * (this.R - 3), ang = rng() * Math.PI * 2, x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
        if (this.fallTime(L, x, z) < t + 14000) continue; if (L.bumpers.some(b => Math.hypot(b.x - x, b.z - z) < 2.4) || L.pads.some(b => Math.hypot(b.x - x, b.z - z) < 2.6)) continue;
        L.items.push({ id: r + ':' + i, kind, x, z, t0: t, t1: Math.min(t + 16000, this.fallTime(L, x, z) - BP_WARN_MS) }); break; }
    }
    return L;
  }
  // (x, z) 의 조각이 라운드 안에서 떨어지는 시각 (경기장 밖 = -1 · 가운데 = Infinity)
  fallTime(L, x, z) { const r = Math.hypot(x, z), k = this.ringOf(r); if (k < 0) return -1; if (k === 0) return Infinity; return L.fall[k][this.secOf(k, Math.atan2(z, x))]; }
}

// ── 규칙 · 내 차 · 친구 차 ──
class BumperCore {
  constructor(opts) {
    const o = this.opts = opts || {};
    this.myId = o.myId || 'me'; this.myName = o.myName || ''; this.sid = bpShort(this.myId);
    this.nSize = bpParseTrack(o.trackId);
    this.seed = +o.seed || 0;
    this.arena = new BpArena(this.nSize, this.seed); this.R = this.arena.R;
    this.now = 0; this.lastTime = 0;
    this.startAt = this.seed || this.srv();
    this.endAt = +o.endAt || 0; this.endReason = ''; this.endTs = 0; this.finals = {};
    this.peers = {}; this.feed = []; this.toasts = []; this.fx = []; this.banner = null; this.shake = 0;
    this.score = 0; this.kills = 0; this.falls = 0; this.life = 0; this.gameOver = false; this.rank = 0; this.total = 0; this.winner = '';
    this.mx = 0; this.my = 0; this.boostHeld = false;
    this.x = 0; this.z = 0; this.y = 0; this.vx = 0; this.vz = 0; this.vy = 0; this.h = 0;
    this.state = 'wait';            // wait(시작 전) · play · air(점프) · fall(떨어지는 중) · dead(부활 기다림)
    this.pct = 0; this.lastHitBy = ''; this.lastHitAt = -1e9; this.lastHurtAt = -1e9; this.stunUntil = 0; this.ghostUntil = 0;
    this.dashUntil = 0; this.dashReadyAt = 0; this.items = {}; this.taken = {}; this.myPicks = {};
    this.pair = {}; this.echoes = []; this.echoSeq = 0; this.echoDone = {}; this.seenFall = {};
    this.aliveSince = 0; this.survPaid = 0; this.roundIdx = -1; this.roundPaid = {};
    this.respawnAt = 0; this.fallAt = 0; this.deadAt = 0;
    this.stats = { hits: 0, echoHits: 0, echoIgnored: 0, soft: 0 }; this.log = o.debugLog ? [] : null;
    // 차 모양 · 색: 참가 순서(slot) — 늦게 온 학생은 출격할 때 안 쓰인 번호
    const roster = (o.roster || []).slice().sort(), idx = roster.indexOf(this.myId);
    this.lateJoin = idx < 0 || this.srv() - this.startAt > 6000;
    this.skin = !this.lateJoin ? (o.slot != null ? o.slot | 0 : Math.max(0, idx)) : -1;
    let saved = null; try { saved = typeof sessionStorage !== 'undefined' && JSON.parse(sessionStorage.getItem(this.saveKey()) || 'null'); } catch (e) {}
    if (saved && saved.seed === this.seed) { ['score', 'kills', 'falls', 'life'].forEach(k => { if (isFinite(+saved[k])) this[k] = +saved[k]; }); if (saved.skin >= 0) this.skin = saved.skin | 0; this.restored = true; }
    this.placeStart();
  }
  saveKey() { return 'bumper:' + this.seed + ':' + this.myId; }
  save() { try { if (typeof sessionStorage === 'undefined') return; sessionStorage.setItem(this.saveKey(), JSON.stringify({ seed: this.seed, score: this.score, kills: this.kills, falls: this.falls, life: this.life, skin: this.skin })); } catch (e) {} }
  srv() { return this.opts.serverNow ? this.opts.serverNow() : (this.now || 0); }
  clock() { return this.now || 0; }
  nameOf(id) { if (id === this.myId) return this.myName || '나'; const p = this.peers[id]; return (p && p.name) || (this.opts.nameOf && this.opts.nameOf(id)) || '친구'; }
  get isDead() { return this.state === 'dead' || this.state === 'fall'; }
  get alive() { return this.state === 'play' || this.state === 'air'; }
  get ghost() { return !this.alive || this.now < this.ghostUntil; }
  get rad() { return this.has('heavy') ? BP_HEAVY_R : BP_CAR_R; }
  get mass() { return this.has('heavy') ? 2.4 : 1; }
  has(k) { return this.items[k] > this.now; }
  dashCdOf() { return this.has('super') ? 900 : BP_DASH_CD; }
  dashReady() { return this.alive && this.now >= this.dashReadyAt; }
  roundInfo(ts) { const t = (ts == null ? this.srv() : ts) - this.startAt; if (t < 0) return { r: 0, t: 0, pre: true }; const r = Math.floor(t / BP_ROUND_MS); return { r, t: t - r * BP_ROUND_MS }; }
  // 지금 (x, z) 에 바닥이 있나 (모든 화면 같은 판단)
  solidAt(x, z, ts) { const ri = this.roundInfo(ts), L = this.arena.round(ri.r), ft = this.arena.fallTime(L, x, z); return ft > ri.t; }
  toast(text, color, ms) { this.toasts.push({ text, color: color || '#fff', until: this.now + (ms || 1700), at: this.now }); if (this.toasts.length > 4) this.toasts.shift(); }
  say(text, sub, color, ms) { this.banner = { text, sub: sub || '', color: color || '#FFD447', at: this.now, until: this.now + (ms || 2200) }; }
  feedPush(a, b, kind, me) { this.feed.unshift({ a: a || '', b: b || '?', kind, me, t: this.now + 4800 }); if (this.feed.length > 5) this.feed.length = 5; }
  addFx(kind, x, y, z, s, c) { if (this.fx.length >= 40) this.fx.shift(); this.fx.push({ kind, x, y, z, s: s || 1, c, t: 0 }); }
  sfx(k) {
    if (typeof window === 'undefined' || !window.Sound) return; const S = window.Sound;
    try { const m = { bump: 'bump', crash: 'crash', dash: 'dash', item: 'item', ko: 'kill', fall: 'death', jump: 'kartJump', spawn: 'heal', round: 'levelUp', tick: 'hitmark' }[k]; if (m && S[m]) S[m]();
      if (window.Haptic && (k === 'crash' || k === 'fall')) window.Haptic.hit(); } catch (e) {}
  }

  // ── 조작 (index.html: 조이스틱 · ⚡ 버튼 · WASD/방향키 · Space) ──
  setMove(x, y) { this.mx = +x || 0; this.my = +y || 0; }
  setBoost(on) { const was = this.boostHeld; this.boostHeld = !!on; if (on && !was) this.dash(); }
  fire() { this.dash(); }
  releaseFire() {}
  useSuper() { this.dash(); }
  onKey(e) { if (this.gameOver) return false; const k = e.key; if (k === ' ' || e.code === 'Space' || k === 'Shift' || k === 'Enter') { if (e.preventDefault) e.preventDefault(); this.dash(); return true; } return false; }
  dash() {
    if (!this.dashReady() || this.state === 'air' || this.frozen()) return false;
    const now = this.now, f = Math.hypot(this.mx, this.my) > 0.2 ? Math.atan2(this.my, this.mx) : this.h; this.h = f;
    const spd = BP_DASH_SPD * (this.has('super') ? 1.15 : 1), cf = Math.cos(f), sf = Math.sin(f), vf = this.vx * cf + this.vz * sf;
    const v = Math.max(spd, vf + 6); this.vx = cf * v; this.vz = sf * v;
    this.dashUntil = now + BP_DASH_MS; this.dashReadyAt = now + this.dashCdOf(); this.dashN = (this.dashN || 0) + 1;
    this.ghostUntil = Math.min(this.ghostUntil, now);                      // 돌진하면 보호가 풀림
    this.addFx('dash', this.x, 0.4, this.z, 1); this.sfx('dash');
    return true;
  }
  frozen() { const s = this.srv(); return s < this.startAt || (this.endAt > 0 && s >= this.endAt); }

  // ── 시작 · 부활 자리 ──
  placeStart() {
    const N = Math.max(8, (this.opts.roster || []).length || 8), s = this.skin >= 0 ? this.skin : Math.floor(Math.random() * N);
    const a = (s % N) / N * Math.PI * 2 + 0.3, rad = Math.min(this.R - 2.5, Math.max(BP_CORE_R + 1, this.R * 0.62));
    this.x = Math.cos(a) * rad; this.z = Math.sin(a) * rad; this.h = Math.atan2(-this.z, -this.x);
    if (this.restored || this.lateJoin) { this.state = 'dead'; this.respawnAt = -1; }   // 늦게 옴 · 새로고침: 친구 신호를 1.2초 받아 본 뒤 빈 자리 · 안 쓰인 차 else this.state = 'wait';
  }
  respawnPoint() {
    const ri = this.roundInfo(), L = this.arena.round(ri.r), rng = Math.random; let best = null, bs = -1e9;
    for (let i = 0; i < 48; i++) {
      const rad = Math.sqrt(rng()) * (this.R - 1.6), ang = rng() * Math.PI * 2, x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
      const ft = this.arena.fallTime(L, x, z); if (ft - ri.t < 7000 + BP_WARN_MS) continue;            // 곧 떨어질 조각 위는 안 됨
      if (L.bumpers.some(b => Math.hypot(b.x - x, b.z - z) < 2.2) || L.pads.some(b => Math.hypot(b.x - x, b.z - z) < 2)) continue;
      let dmin = 30; for (const id in this.peers) { const p = this.peers[id]; if (!this.peerSolid(p)) continue; dmin = Math.min(dmin, Math.hypot(p.x - x, p.z - z)); }
      const s = Math.min(dmin, 9) - rad * 0.08 + rng(); if (s > bs) { bs = s; best = [x, z]; }
    }
    return best || [(rng() - 0.5) * 3, (rng() - 0.5) * 3];
  }
  spawn() {
    if (this.skin < 0) {                                                  // 늦게 온 학생: 친구들이 안 쓰는 가장 작은 번호
      const used = {}; for (const id in this.peers) used[this.peers[id].skin] = 1; let s = 0; while (used[s]) s++; this.skin = s;
    }
    const p = this.respawnPoint(); this.x = p[0]; this.z = p[1]; this.y = 0; this.vx = this.vz = this.vy = 0; this.h = Math.atan2(-this.z, -this.x);
    this.state = 'play'; this.life++; this.pct = 0; this.lastHitBy = ''; this.lastHitAt = -1e9; this.stunUntil = 0; this.dashUntil = 0; this.dashReadyAt = this.now + 400;
    this.ghostUntil = this.now + BP_GHOST_MS; this.aliveSince = this.srv(); this.survPaid = 0; this.pair = {};
    this.addFx('spawn', this.x, 0, this.z, 1); this.sfx('spawn'); this.save();
  }
  // 떨어지기 시작 — 마지막으로 나를 친 친구(4초 안)에게 점수 사건
  startFall(why) {
    if (!this.alive) return;
    const now = this.now; this.state = 'fall'; this.fallAt = now; this.vy = Math.min(this.vy, 0); this.falls++;
    const by = (now - this.lastHitAt < BP_CREDIT_MS && this.lastHitBy && this.lastHitBy !== this.myId) ? this.lastHitBy : '';
    this.respawnAt = now + BP_RESPAWN_MS;
    if (this.opts.onAttack) this.opts.onAttack('fall', by || '', { life: this.life, ts: Math.round(this.srv()), nm: this.myName || '' });
    if (this.log) this.log.push({ k: 'fall', t: this.srv(), by, life: this.life, why });
    if (by) { this.feedPush(this.nameOf(by), this.myName || '나', 'ko', 2); this.toast(this.nameOf(by) + '에게 밀려 떨어짐!', '#FF8A8A', 2200); }
    else { this.feedPush('', this.myName || '나', 'self', 2); this.toast('앗, 떨어졌어요!', '#FF8A8A', 2000); }
    this.sfx('fall'); this.shake = Math.max(this.shake, 0.6); this.save();
  }

  // ── 위치 신호 ──
  // x,z,방향(도),속도x,속도z,깃발,충격%,차번호,목숨,점수,떨어뜨림,보낸시각(36진수),높이,메아리
  //   깃발: 1 경기장에 없음(부활 기다림) · 2 보호 · 4 돌진 · 8 방패 · 16 무거움 · 32 슈퍼 돌진 · 64 점프 중 · 128 경기 끝 · 256 떨어지는 중
  //   메아리: 'id4.다가온속도(×10).번호.돌진?' — 내 화면에서 그 친구와 부딪혔다 (0.65초 동안)
  serialize() {
    const now = this.now, st = this.state;
    const fl = (st === 'dead' ? 1 : 0) | (this.now < this.ghostUntil && this.alive ? 2 : 0) | (now < this.dashUntil ? 4 : 0) | (this.has('shield') ? 8 : 0) | (this.has('heavy') ? 16 : 0) | (this.has('super') ? 32 : 0)
      | (st === 'air' ? 64 : 0) | (this.gameOver ? 128 : 0) | (st === 'fall' ? 256 : 0);
    const r1 = v => { const x = Math.round(v * 10) / 10; return x === 0 ? '0' : String(x); };
    let deg = Math.round(this.h * 180 / Math.PI) % 360; if (deg < 0) deg += 360;
    while (this.echoes.length && this.echoes[0].until < now) this.echoes.shift();
    const echo = this.echoes.map(e => e.to + '.' + (e.d ? '-' : '') + e.c + '.' + e.seq).join('/');
    const still = st === 'dead' || st === 'wait';
    const head = [r1(this.x), r1(this.z), deg, still ? '0' : r1(this.vx), still ? '0' : r1(this.vz), fl, Math.round(this.pct), this.skin, this.life, this.score, this.kills].join(',');
    const tail = (st === 'air' || st === 'fall' ? r1(this.y) : '') + ',' + echo;
    if (head === this._sh && tail === this._st && this._ser) return this._ser;
    this._sh = head; this._st = tail;
    this._ser = head + ',' + (Math.round(this.srv()) % BP_STAMP_WRAP).toString(36) + ',' + tail;
    return this._ser;
  }
  static parse(raw) {
    const a = String(raw).split(','); if (a.length < 14) return null;
    const fl = +a[5] || 0;
    return { x: +a[0], z: +a[1], h: (+a[2] || 0) * Math.PI / 180, vx: +a[3] || 0, vz: +a[4] || 0, fl, pct: +a[6] || 0, skin: +a[7] || 0, life: +a[8] || 0, score: +a[9] || 0, kills: +a[10] || 0,
      st: a[11] ? parseInt(a[11], 36) : null, y: a[12] === '' ? 0 : +a[12] || 0, echo: a[13] || '' };
  }
  applyPeerRaw(id, raw, name) {
    if (typeof raw !== 'string' || id === this.myId) return;
    let p = this.peers[id];
    if (p && p.raw === raw) { if (name) p.name = name; return; }
    const d = BumperCore.parse(raw); if (!d || !isFinite(d.x) || !isFinite(d.z)) return;
    const now = this.now;
    if (!p) { p = this.peers[id] = { id, sid: bpShort(id), x: d.x, z: d.z, y: 0, h: d.h, cx: 0, cz: 0, name: name || '', fl: d.fl, nearAt: -1e9, fallY: 0, life: d.life }; }
    p.gone = 0;
    if (d.st != null && p.st != null) { const ds = (d.st - p.st + BP_STAMP_WRAP) % BP_STAMP_WRAP; if (ds === 0 || ds > BP_STAMP_WRAP - 5000) { p.raw = raw; return; } }   // 더 오래된 신호면 버림
    p.raw = raw;
    // 신호 나이(기본 지연 + 흔들림)만큼 속도로 앞당겨 그림 (탱크 · 레이저 태그와 같은 방식)
    let age = BP_BASE_LAT * BP_LEAD;
    if (d.st != null) {
      const off = now - d.st, keep = p.off != null && Math.abs(off - p.off) < 5000;
      p.off = keep ? Math.min(off, p.off + Math.max(0, now - (p.at || now)) * 0.002) : off;
      const jit = Math.max(0, off - p.off);
      if (this.opts.serverNow) { const sa = ((Math.round(this.srv()) % BP_STAMP_WRAP) - d.st + BP_STAMP_WRAP) % BP_STAMP_WRAP; if (sa < 3000) { const b = Math.max(15, Math.min(300, sa - jit)); p.base = p.base == null ? b : p.base + (b - p.base) * 0.12; } }
      age = Math.min(420, ((p.base != null ? p.base : BP_BASE_LAT) + jit) * BP_LEAD); p.st = d.st;
    }
    p.at = now; p.seen = now;
    if (p.tx != null && ((d.fl & 4) && !(p.fl & 4) || Math.hypot(d.vx - p.vx, d.vz - p.vz) > 5)) p.fastUntil = now + 350;   // 돌진 시작 · 튕김: 새 자리로 빨리 따라감
    const wasOut = !!(p.fl & (1 | 256)), had = p.tx != null, shownX = p.x, shownZ = p.z, oldLife = p.life;
    Object.assign(p, { tx: d.x, tz: d.z, vx: d.vx, vz: d.vz, sAt: now - age, th: d.h, fl: d.fl, pct: d.pct, skin: d.skin, life: d.life, score: d.score, kills: d.kills, ty: d.y,
      out: !!(d.fl & 1), ghost: !!(d.fl & 2), dashing: !!(d.fl & 4), shield: !!(d.fl & 8), heavy: !!(d.fl & 16), sup: !!(d.fl & 32), air: !!(d.fl & 64), over: !!(d.fl & 128), falling: !!(d.fl & 256) });
    if (name) p.name = name;
    if (p.falling && !(wasOut)) { p.fallStart = now; p.fallY = p.y || 0; }
    if (p.over) { this.finals[id] = d.score; if (this.gameOver) this.rerank(); }
    const g = this.predict(p, now);
    if (had && !p.out && !wasOut && oldLife === p.life && Math.hypot(shownX - g.x, shownZ - g.z) < 5) { p.cx = shownX - g.x; p.cz = shownZ - g.z; }
    else { p.cx = 0; p.cz = 0; p.x = g.x; p.z = g.z; p.h = p.th; if (!p.out && !p.falling && oldLife !== p.life && had) this.addFx('spawn', g.x, 0, g.z, 1); }
    // 메아리: 친구 화면에서 나와 부딪혔다 → 내 화면에서도 거의 닿아 보였고 아직 안 튕겼으면 같은 세기로
    if (d.echo && this.alive && !this.gameOver) d.echo.split('/').forEach(s => { const q = s.split('.'); if (q[0] !== this.sid) return;
      const key = id + ':' + q[2]; if (this.echoDone[key]) return; this.echoDone[key] = now; this.onEcho(p, Math.abs(+q[1] || 0) / 10, String(q[1]).charAt(0) === '-'); });
  }
  predict(p, now) {
    const out = this._pr || (this._pr = { x: 0, z: 0 });
    const a = Math.max(0, Math.min(420, now - p.sAt)) / 1000; let x = p.tx, z = p.tz;
    if (!p.out && (p.vx || p.vz) && a > 0) { const k = p.falling || p.air ? 1 : (1 - Math.exp(-BP_KF * a)) / (BP_KF * a); x += p.vx * a * k; z += p.vz * a * k; }   // 미끄러지며 느려지는 만큼 덜 앞당김
    out.x = x; out.z = z; return out;
  }
  removePeer(id) { const p = this.peers[id]; if (p && !p.gone) p.gone = this.clock() || 1; }
  setPeers(map) { Object.keys(map).forEach(id => { const d = map[id], p = this.peers[id]; if (d && d.raw && !(p && p.raw === d.raw)) this.applyPeerRaw(id, d.raw, d.name); }); Object.keys(this.peers).forEach(id => { if (!map[id]) this.removePeer(id); }); }
  syncRoster(r) { const now = this.clock(); for (const id in this.peers) { const p = this.peers[id]; if (r && r[id] != null) { p.left = 0; if (r[id]) p.name = p.name || r[id]; } else if (!p.left) p.left = now || 1; } }
  // 내 화면에서 부딪힐 수 있는 친구 (경기장 위 · 보호 아님 · 신호가 살아 있음)
  peerSolid(p) { return !!p && !p.out && !p.falling && !p.air && !p.ghost && !p.over && !p.gone && (this.now - p.seen) < 4500; }

  // ── 사건 받기 ──
  onEvent(e) {
    if (!e || typeof e !== 'object') return;
    const by = e.by;
    if (e.type === 'fall') {
      const key = by + ':' + (e.life | 0); if (this.seenFall[key]) return; this.seenFall[key] = 1;   // 같은 목숨은 한 번만
      const vn = this.nameOf(by) || e.nm || '친구';
      if (e.target && e.target === this.myId) {
        if (this.gameOver || (this.endAt > 0 && +e.ts >= this.endAt)) return;   // 순위를 센 뒤 · 시간 끝 뒤에 떨어진 것은 점수 없음
        this.kills++; this.score += BP_PTS_KO; this.feedPush(this.myName || '나', vn, 'ko', 1);
        this.toast(vn + ' 떨어뜨림! +' + BP_PTS_KO, '#FFD447', 2000); this.sfx('ko'); this.save();
        if (this.log) this.log.push({ k: 'ko', t: this.srv(), victim: by, life: e.life | 0 });
        return;
      }
      if (e.target) this.feedPush(this.nameOf(e.target), vn, 'ko', 0); else this.feedPush('', vn, 'self', 0);
      return;
    }
    if (e.type === 'item') {                                               // 친구가 아이템을 먹음 — 먼저(서버 시각) 먹은 사람 것
      const it = String(e.k || ''), ts = +e.ts || +e.t || 0, cur = this.taken[it];
      if (cur && (cur.ts < ts || (cur.ts === ts && cur.by < by))) return;
      this.taken[it] = { by, ts };
      const mine = this.myPicks[it]; if (mine && (ts < mine.ts || (ts === mine.ts && by < this.myId))) { delete this.myPicks[it]; this.items[mine.kind] = 0; this.toast(this.nameOf(by) + '이(가) 먼저 먹었어요', '#BFD3FF', 1500); }
      return;
    }
  }

  // ── 부딪힘 (내 화면 기준 · 내 튕김만) ──
  //   c = 다가온 속도(m/s), d = 친구가 돌진 중, n = 친구 → 나 방향
  knock(p, nx, nz, c, dashing, via, dist) {
    const now = this.now, mP = p.heavy ? 2.4 : 1, mA = this.mass, meDash = now < this.dashUntil;
    let k = (2.2 + 0.58 * Math.max(0, c)) * (2 * mP / (mA + mP));
    if (dashing) k *= p.sup ? 2.1 : 1.4;
    if (now < this.dashUntil) k *= 0.38;                                   // 내가 돌진해서 들이받았으면 나는 덜 튕김
    if (this.has('shield')) k *= 0.25;
    k *= 1 + this.pct / 85;
    const vn = this.vx * nx + this.vz * nz; if (vn < 0) { this.vx -= nx * vn; this.vz -= nz * vn; }   // 친구 쪽으로 가던 속도는 멈춤
    this.vx += nx * k; this.vz += nz * k;
    const add = (3 + Math.max(0, c) * 1.15 * (dashing ? (p.sup ? 1.8 : 1.35) : 1)) * (this.has('shield') ? 0.25 : 1) * (now < this.dashUntil ? 0.4 : 1);
    this.pct = Math.min(250, this.pct + add);
    this.stunUntil = now + Math.min(900, 220 + this.pct * 2.2 + (dashing ? 180 : 0));
    this.dashUntil = Math.min(this.dashUntil, now);
    this.lastHitBy = p.id; this.lastHitAt = now; this.lastHurtAt = now;
    this.pair[p.id] = now;
    if (via === 'overlap') { this.echoSeq = (this.echoSeq + 1) % 36; this.echoes.push({ to: p.sid, c: Math.round(Math.max(0, c) * 10), seq: this.echoSeq.toString(36), d: meDash, at: now, until: now + BP_ECHO_MS }); if (this.echoes.length > 4) this.echoes.shift(); }
    const big = k > 9;
    this.addFx('spark', this.x - nx * this.rad, 0.55, this.z - nz * this.rad, Math.min(2.2, 0.6 + k / 9));
    this.shake = Math.max(this.shake, Math.min(1, 0.15 + k / 22)); this.sfx(big ? 'crash' : 'bump');
    this.stats[via === 'echo' ? 'echoHits' : 'hits']++;
    if (this.log) this.log.push({ k: 'hit', t: this.srv(), peer: p.id, d: dist, sumR: this.rad + (p.heavy ? BP_HEAVY_R : BP_CAR_R), c, via, kick: k, pct: this.pct, nearAgo: now - p.nearAt });
  }
  onEcho(p, c, dashing) {
    const now = this.now;
    if (now - (this.pair[p.id] || -1e9) < 700) return;                    // 이미 내 화면에서 튕김
    if (this.ghost || this.state !== 'play' || !this.peerSolid(p)) { this.stats.echoIgnored++; return; }   // 점프 중 · 보호 중이면 무시
    if (now - p.nearAt > BP_ECHO_WIN) { this.stats.echoIgnored++; if (this.log) this.log.push({ k: 'echoIgnored', t: this.srv(), peer: p.id, nearAgo: now - p.nearAt, d: Math.hypot(this.x - p.x, this.z - p.z) - this.rad - (p.heavy ? BP_HEAVY_R : BP_CAR_R) }); return; }   // 내 화면에선 안 닿아 보였음 → 무시
    let nx = this.x - p.x, nz = this.z - p.z; const d = Math.hypot(nx, nz) || 1; nx /= d; nz /= d;
    this.knock(p, nx, nz, c, dashing, 'echo', d);
  }
  collidePeers(dt) {
    const now = this.now, rA = this.rad;
    for (const id in this.peers) {
      const p = this.peers[id]; if (p.out || p.falling || p.air || p.tx == null) continue;
      const rB = p.heavy ? BP_HEAVY_R : BP_CAR_R, dx = this.x - p.x, dz = this.z - p.z, d = Math.hypot(dx, dz), sum = rA + rB;
      if (d < sum + BP_ECHO_NEAR) p.nearAt = now;                           // 메아리 확인용: 내 화면에서 거의 닿아 보인 때 (보호 중 깜빡이는 차도)
      if (!this.peerSolid(p)) continue;
      if (d >= sum || this.ghost) continue;
      const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0, mB = p.heavy ? 2.4 : 1, share = mB / (this.mass + mB);
      // 겹친 만큼 밀려남 (친구도 자기 화면에서 나머지를 밀려남)
      const o = sum - d; this.x += nx * o * share; this.z += nz * o * share;
      const c = (p.vx - this.vx) * nx + (p.vz - this.vz) * nz;              // 다가오는 속도
      if (now - (this.pair[id] || -1e9) < BP_PAIR_CD) continue;
      if (c > 1.3 || p.dashing || now < this.dashUntil) this.knock(p, nx, nz, c, p.dashing, 'overlap', d);
      else if (c > 0.3) { const vn = this.vx * nx + this.vz * nz; if (vn < 0.6) { this.vx += nx * (0.6 - vn); this.vz += nz * (0.6 - vn); } this.lastHitBy = id; this.lastHitAt = now; this.pair[id] = now - BP_PAIR_CD + 150; this.stats.soft++;
        if (this.log) this.log.push({ k: 'hit', t: this.srv(), peer: id, d, sumR: sum, c, via: 'soft', kick: 0, pct: this.pct, nearAgo: 0 }); }
    }
  }
  collideStatic(L, ri) {
    for (const b of L.bumpers) { if (L.fall[b.k][b.s] <= ri.t) continue; const dx = this.x - b.x, dz = this.z - b.z, d = Math.hypot(dx, dz), sum = this.rad + b.r; if (d >= sum) continue;
      const nx = dx / (d || 1), nz = dz / (d || 1); this.x = b.x + nx * sum; this.z = b.z + nz * sum;
      const vn = this.vx * nx + this.vz * nz; if (vn < 0) { const kick = Math.max(9, -vn * 1.6); this.vx += nx * (kick - vn); this.vz += nz * (kick - vn); this.stunUntil = this.now + 260;
        this.addFx('ring', b.x, 0.9, b.z, 1); this.addFx('spark', b.x + nx * b.r, 0.7, b.z + nz * b.r, 1); this.shake = Math.max(this.shake, 0.25); this.sfx('bump'); b.hitAt = this.now; } }
    if (this.state === 'play') for (const pd of L.pads) { if (L.fall[pd.k][pd.s] <= ri.t) continue; if (Math.hypot(this.x - pd.x, this.z - pd.z) > pd.r) continue;
      // 점프대: 가운데 쪽으로 높이 (1.6초쯤 날아 가운데 근처에 내림)
      const d = Math.hypot(pd.x, pd.z) || 1; this.state = 'air'; this.vy = 11.5; this.vx = -pd.x / d * (d / 1.05); this.vz = -pd.z / d * (d / 1.05); this.y = 0.05;
      this.addFx('ring', pd.x, 0.3, pd.z, 1.4); this.sfx('jump'); pd.hitAt = this.now; }
  }
  pickItems(L, ri) {
    if (!this.alive) return;
    for (const it of L.items) {
      if (ri.t < it.t0 || ri.t >= it.t1 || this.taken[it.id] || this.myPicks[it.id]) continue;
      if (Math.hypot(this.x - it.x, this.z - it.z) > this.rad + 0.9) continue;
      const ts = Math.round(this.srv()); this.myPicks[it.id] = { ts, kind: it.kind }; this.taken[it.id] = { by: this.myId, ts };
      this.items[it.kind] = this.now + BP_ITEMS[it.kind].ms;
      if (this.opts.onAttack) this.opts.onAttack('item', '', { k: it.id, ts });
      const I = BP_ITEMS[it.kind]; this.toast(I.icon + ' ' + I.name + ' — ' + I.desc, I.color, 2400); this.sfx('item'); this.addFx('ring', it.x, 0.5, it.z, 1.2, I.color);
    }
  }

  // ── 한 걸음 (index.html loop → tick → step) ──
  step(now) {
    if (this.gameOver) return;
    const dtAll = this.lastTime ? Math.min(0.1, Math.max(0, (now - this.lastTime) / 1000)) : 0; this.lastTime = now;
    const srv = this.srv();
    // 시간 끝: 차를 멈추고 0.7초 뒤 순위 (그 사이 끝나기 전 떨어뜨린 점수가 도착)
    if (this.endAt > 0 && srv >= this.endAt) { if (!this.endShown) { this.endShown = true; this.say('시간 끝!', '순위를 세는 중…', '#FFD447', 9e9); this.sfx('round'); }
      this.now = now; this.updatePeers(dtAll); if (srv >= this.endAt + BP_END_GRACE) this.finish('time', this.endAt); return; }
    const ri = this.roundInfo(srv);
    if (!ri.pre && ri.r !== this.roundIdx) this.newRound(ri);
    // 잘게 나눠 (돌진 17m/s 도 친구를 뚫고 지나가지 않게)
    const n = Math.max(1, Math.ceil(dtAll / (1 / 60))), dt = dtAll / n;
    for (let i = 0; i < n; i++) { this.now = now - (n - 1 - i) * dt * 1000; this.updatePeers(dt); this.stepCar(dt, ri); }
    this.now = now;
    if (this.state === 'wait' && srv >= this.startAt) { this.state = 'play'; this.life = Math.max(1, this.life); this.aliveSince = srv; this.ghostUntil = 0; this.dashReadyAt = now + 300; }
    if (this.state === 'dead' && this.respawnAt < 0) this.respawnAt = now + 1200;
    if (this.state === 'dead' && now >= this.respawnAt && srv >= this.startAt) this.spawn();
    // 버티기 점수: 경기장 위에서 10초마다 +1
    if (this.alive && srv >= this.startAt) { const k = Math.floor((srv - this.aliveSince) / BP_SURV_MS); if (k > this.survPaid) { this.score += (k - this.survPaid) * BP_PTS_SURV; this.survPaid = k; this.toast('10초 버팀 +' + BP_PTS_SURV, '#9BF6C8', 1100); this.save(); } }
    // 충격 % 는 4초 동안 안 맞으면 천천히 줄어듦
    if (this.pct > 0 && now - this.lastHurtAt > 4000) this.pct = Math.max(0, this.pct - dtAll * 2.5);
    // 친구 정리: 명단에서 빠졌거나 신호가 지워진 지 2.5초
    for (const id in this.peers) { const p = this.peers[id]; if ((p.gone && now - p.gone > 2500) || (p.left && now - p.left > 3000) || now - (p.seen || 0) > 20000) delete this.peers[id]; }
    for (const k in this.echoDone) if (now - this.echoDone[k] > 5000) delete this.echoDone[k];
    this.toasts = this.toasts.filter(t => t.until > now); this.feed = this.feed.filter(f => f.t > now);
    this.shake *= Math.exp(-dtAll * 6);
    // 경고: 다음 조각들이 흔들리기 시작
    const warnAt = BP_CRUMBLE_START - BP_WARN_MS - 1500;
    if (!ri.pre && ri.t >= warnAt && !this.roundPaid['w' + ri.r]) { this.roundPaid['w' + ri.r] = 1; this.say('경기장이 무너져요!', '바깥 조각부터 떨어져요 · 빨갛게 흔들리면 피하기', '#FF9F43', 2600); }
  }
  newRound(ri) {
    const first = this.roundIdx < 0; this.roundIdx = ri.r;
    if (!first) {
      // 라운드 끝까지 살아남음 +2
      const pk = 'r' + (ri.r - 1); if (this.alive && !this.roundPaid[pk]) { this.roundPaid[pk] = 1; this.score += BP_PTS_ROUND; this.toast('라운드 생존 +' + BP_PTS_ROUND, '#FFD447', 2000); this.save(); }
    }
    this.taken = {}; this.myPicks = {};
    if (ri.t < 5000) { this.say(first ? '범퍼카 서바이벌!' : '라운드 ' + (ri.r + 1), first ? '친구를 밀어 경기장 밖으로!' : '경기장이 다시 넓어졌어요', '#FFD447', 2400); if (!first) this.sfx('round'); }
  }
  updatePeers(dt) {
    const now = this.now, kc = Math.exp(-dt * 1000 / 120), kf = Math.exp(-dt * 1000 / 35);
    for (const id in this.peers) { const p = this.peers[id]; if (p.tx == null) continue;
      const g = this.predict(p, now), k = now < (p.fastUntil || 0) ? kf : kc; p.cx *= k; p.cz *= k; p.x = g.x + p.cx; p.z = g.z + p.cz;
      p.h += bpAng(p.th - p.h) * Math.min(1, dt * 12);
      if (p.falling) { const t = (now - (p.fallStart || now)) / 1000; p.y = Math.max(BP_FALL_Y - 4, (p.fallY || 0) - 0.5 * BP_G * t * t); }
      else if (p.air) p.y += ((p.ty || 0) - p.y) * Math.min(1, dt * 14);
      else p.y = 0; }
  }
  stepCar(dt, ri) {
    if (this.state === 'wait' || this.state === 'dead') return;
    const now = this.now, L = this.arena.round(ri.r);
    if (this.state === 'fall') {
      this.vy -= BP_G * dt; this.y += this.vy * dt; this.x += this.vx * dt; this.z += this.vz * dt; this.vx *= Math.exp(-dt * 0.6); this.vz *= Math.exp(-dt * 0.6);
      if (this.y < BP_FALL_Y) { this.state = 'dead'; this.deadAt = now; this.addFx('splash', this.x, BP_FALL_Y, this.z, 1.4); }
      return;
    }
    if (this.state === 'air') {
      this.vy -= BP_G * 0.85 * dt; this.y += this.vy * dt; this.x += this.vx * dt; this.z += this.vz * dt;
      if (this.y <= 0 && this.vy < 0) { this.y = 0; this.vy = 0; this.state = 'play'; this.vx *= 0.35; this.vz *= 0.35; this.addFx('ring', this.x, 0.2, this.z, 1); this.shake = Math.max(this.shake, 0.3); this.sfx('bump');
        if (!this.solidAt(this.x, this.z)) this.startFall('land'); }
      return;
    }
    if (this.frozen()) { this.vx *= Math.exp(-dt * 6); this.vz *= Math.exp(-dt * 6); return; }
    // 조이스틱: 그 방향으로 차가 돌며 가속 (미끄러짐: 옆으로는 빨리 · 앞으로는 천천히 줄어듦)
    const stun = now < this.stunUntil, dash = now < this.dashUntil, inM = Math.min(1, Math.hypot(this.mx, this.my));
    if (inM > 0.12 && !dash) { const th = Math.atan2(this.my, this.mx); this.h += Math.max(-BP_TURN * dt, Math.min(BP_TURN * dt, bpAng(th - this.h))); }
    const cf = Math.cos(this.h), sf = Math.sin(this.h);
    if (!dash) { const al = Math.max(0, Math.cos(bpAng(Math.atan2(this.my, this.mx) - this.h))), a = BP_ACC * inM * (stun ? 0.25 : 1) * (0.35 + 0.65 * al) * (this.has('heavy') ? 0.85 : 1);
      if (inM > 0.12) { this.vx += cf * a * dt; this.vz += sf * a * dt; } }
    let vf = this.vx * cf + this.vz * sf, lx = this.vx - cf * vf, lz = this.vz - sf * vf;
    const kF = dash ? 0.15 : stun ? 1.05 : BP_KF, kL = dash ? 4 : stun ? 1.05 : BP_KL;
    vf *= Math.exp(-kF * dt); const el = Math.exp(-kL * dt); lx *= el; lz *= el;
    this.vx = cf * vf + lx; this.vz = sf * vf + lz;
    this.x += this.vx * dt; this.z += this.vz * dt;
    this.collidePeers(dt);
    this.collideStatic(L, ri);
    if (this.state !== 'play') return;
    this.pickItems(L, ri);
    if (!this.solidAt(this.x, this.z)) this.startFall('edge');
  }

  // ── 경기 끝 · 순위 (점수 내림차순 → 닉네임 → id — 결과 화면 · 선생님 화면과 같은 규칙) ──
  finish(reason, ts) {
    if (this.gameOver) return;
    this.gameOver = true; this.endReason = reason === 'goal' ? 'goal' : 'time'; this.endTs = ts || this.srv();
    this.rerank(); this.save();
  }
  rerank() {
    const now = this.clock(), list = [{ id: this.myId, name: this.myName || '', s: this.score }];
    for (const id in this.peers) { const p = this.peers[id]; if (this.finals[id] == null && (p.gone || now - (p.seen || 0) > 8000)) continue; list.push({ id, name: p.name || '', s: this.finals[id] != null ? this.finals[id] : (p.score || 0) }); }
    list.sort((a, b) => (b.s - a.s) || String(a.name).localeCompare(String(b.name), 'ko') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    this.rankList = list; this.rank = list.findIndex(e => e.id === this.myId) + 1; this.total = list.length;
    const top = list[0]; this.winner = top.id === this.myId ? (this.myName || '나') : (top.name || this.nameOf(top.id));
    this.say('시간 끝!', '나는 ' + this.total + '명 중 ' + this.rank + '등 · ' + this.score + '점' + (this.rank === 1 ? ' · 1등!' : ' · 1등 ' + this.winner), '#FFD447', 9e9);
  }
  // 지금 순위 (게임 안 순위표 · HUD)
  standings() {
    if (this.gameOver && this.rankList) return this.rankList.map(e => ({ id: e.id, name: e.name, s: e.s, me: e.id === this.myId }));
    const now = this.now, list = [{ id: this.myId, name: this.myName || '나', s: this.score, me: true }];
    for (const id in this.peers) { const p = this.peers[id]; if (p.gone || now - (p.seen || 0) > 8000) continue; list.push({ id, name: p.name || this.nameOf(id), s: p.score || 0, me: false }); }
    list.sort((a, b) => (b.s - a.s) || String(a.name).localeCompare(String(b.name), 'ko') || (a.id < b.id ? -1 : 1));
    return list;
  }
  myRank() { const l = this.standings(); return { rank: l.findIndex(e => e.me) + 1, total: l.length }; }

  // 교사 화면 미니 보드 (30×30, 위에서 본 경기장): 바다 · 바닥 · 흔들리는 조각 · 범퍼 · 점프대 · 아이템 · 차
  getSnapshot() {
    const N = 30, S = this.R + 1.5, g = [], ri = this.roundInfo(), L = this.arena.round(ri.r);
    for (let y = 0; y < N; y++) { const row = []; for (let x = 0; x < N; x++) { const wx = ((x + 0.5) / N * 2 - 1) * S, wz = ((y + 0.5) / N * 2 - 1) * S, ft = this.arena.fallTime(L, wx, wz);
      row.push(ft <= ri.t ? 41 : ft - ri.t < BP_WARN_MS ? 52 : 63); } g.push(row); }
    const put = (x, z, v) => { const gx = Math.floor((x / S + 1) / 2 * N), gy = Math.floor((z / S + 1) / 2 * N); if (g[gy] && g[gy][gx] != null) g[gy][gx] = v; };
    L.bumpers.forEach(b => { if (L.fall[b.k][b.s] > ri.t) put(b.x, b.z, 40); }); L.pads.forEach(b => { if (L.fall[b.k][b.s] > ri.t) put(b.x, b.z, 48); });
    L.items.forEach(it => { if (ri.t >= it.t0 && ri.t < it.t1 && !this.taken[it.id]) put(it.x, it.z, 67); });
    const CC = [68, 69, 4, 5, 6, 3, 1, 7, 2, 44, 24, 31];
    for (const id in this.peers) { const p = this.peers[id]; if (p.out || p.falling || p.gone) continue; put(p.x, p.z, CC[(p.skin | 0) % CC.length]); }
    if (this.alive || this.state === 'wait') put(this.x, this.z, 22);
    return g;
  }
}
if (typeof module !== 'undefined' && module.exports) module.exports = { BumperCore, BpArena, bpRadiusFor, BP_ROUND_MS, BP_ITEMS, BP_CAR_R };
