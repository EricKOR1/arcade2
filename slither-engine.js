// 뱀 아레나 — 큰 뱀이 작은 뱀을 삼키며 자라는 실시간 대전 (넓은 원형 경기장 · 카메라가 내 머리를 따라감)
//   · 조이스틱 방향으로 미끄러지듯 회전, 부스트(길이 소모)로 가속
//   · 먹이를 먹으면 길이 +1. 내 머리로 다른 뱀 몸을 박으면 크기와 상관없이 내가 탈락 (남이 내 몸을 박으면 그 친구가 탈락)
//   · 머리끼리 마주 부딪히면 조금이라도 긴 쪽이 삼키고 먹힌 뱀의 길이만큼 커짐(상한 2000), 길이가 같으면 튕겨 나옴.
//     죽으면 쓰러지는 장면 뒤 몸을 따라 먹이를 떨어뜨리고 3초 뒤 작은 뱀으로 부활
//   · 슈퍼 지렁이: 부활할 때 가끔(판에 한 마리까지) 태어남. 1등과 부딪혀도 죽지 않고, 1등의 머리를 먹으면 1등의 길이만큼 커져 새 1등 (60초)
//   네트워크: 머리 + 최근 마디 8개(방향 2글자씩)와 마디 번호(seq)를 보내고, 받는 쪽이 번호대로 이어 붙여 '보낸 쪽과 똑같은 몸'을 만듭니다.
//            처음 받았거나 신호가 크게 빠져 몸이 모자라면 그 친구에게만 'need' 를 보내 전체 몸을 한 번 받아 옵니다.
//   판정 원칙: "내 죽음은 내 화면이 정한다"
//     · 내 기기는 내 화면에 그려진 겹침이 있을 때만 나를 죽입니다(반지름 합의 0.8배 안). 남의 기기 소식만으로 죽는 길('ko' 등)은 없습니다.
//     · 몸 박기는 '누가 먼저 그 자리에 있었나'를 마디가 놓인 서버 시각으로 가림 (여유 0.15초 안이면 둘 다 삶):
//       내 머리가 내 화면에서 그려진 상대에 진행 방향 앞쪽으로 겹치고, 상대 마디가 그 자리에 먼저 놓였을 때만 내가 박음 (상대 머리가 내 몸에 닿는 것으로는 안 죽음)
//       닿은 뒤 0.35초 확인: 그사이 그 친구가 이미 쓰러졌다는 소식이 오면 안 죽음
//     · 머리끼리(넉넉하게): 어느 한쪽 화면에서라도 두 머리 원이 (반지름 합 × 1.3) 안으로 닿으면 — 정면이 아니어도 — 그 기기가 바로 결론을 냄('hh' 결론).
//       단, 상대 머리가 내 머리 뒤쪽(목·옆구리)에 닿은 것은 머리끼리가 아님(몸 박기 규칙 → 박은 쪽만 탈락).
//       결론 = 두 뱀이 보낸 신호의 길이로 비교해 더 긴 쪽이 먹음 · 먹은 쪽은 그 순간 먹힌 뱀 길이만큼 커지고, 먹힌 쪽은 결론을 받는 즉시 닿은 자리로 되감아 쓰러짐.
//       두 기기가 서로 다른 결론을 동시에 냈으면 '먼저 낸 결론'(서버 시각 → id)이 이김 — 모든 기기가 같은 규칙이라 결론이 항상 같음 (늦은 쪽은 커진 길이를 되돌림).
//       같은 길이면 본 기기가 자기만 튕김. 슈퍼 지렁이가 1등 머리에 닿으면 슈퍼가 1등 길이만큼 커져 이어받음.
//     · 점수 = 지금 길이 (쓰러져 기다리는 동안 6 = 부활 길이). HUD · 순위표 · 선생님 화면 · 결과가 모두 같은 숫자.
//     · 시간 제한(opts.endAt · 서버 시각): 끝나면 모든 화면이 finish('time') · 길이 2000 먼저 → finish('goal'). 순위는 그 순간 길이.
//     · 사라지지 않음: 숨기는 길 없음. 끊긴 친구(pos 지워짐 · 1초 넘게 신호 없음)는 흐린 '유령'(부딪혀도 안 죽음)으로 남고,
//       명단에서 빠졌거나 20초 넘게 신호가 없을 때만 지웁니다.
const SL_R = 144;              // 경기장 반지름(칸) — 지름 2배(72→144), 30명 기준 1인당 약 2,170칸²
const SL_PELLETS = 5200;       // 먹이 수 — 넓이가 4배라 먹이도 4배(밀도 유지)
// 맵: 인원에 맞춘 크기 — 1인당 넓이를 30명 맵(반지름 144)과 같게: 반지름 ∝ √인원, 먹이 ∝ 인원
//   '자동'은 교사가 시작하는 순간의 접속 인원으로 정해 세션에 'auto:N' 으로 기록 → 모든 학생이 같은 크기
const SL_MAPS = {
  auto:   { name: '자동 · 인원에 맞춤', tag: '추천', desc: '시작할 때 접속한 학생 수에 맞춰 경기장 크기를 정해요 (4~30명)', players: 0, theme: 'space' },
  galaxy: { name: '은하 광장', tag: '30명 · 대형', desc: '가장 넓은 우주 경기장. 반 전체(25~30명)가 함께할 때', players: 30, theme: 'space' },
  reef:   { name: '산호 바다', tag: '20명 · 중형', desc: '푸른 바닷속 경기장. 15~20명', players: 20, theme: 'sea' },
  forest: { name: '반딧불 숲', tag: '10명 · 소형', desc: '밤숲 경기장. 8~12명 모둠 대전', players: 10, theme: 'forest' },
  lava:   { name: '용암 분지', tag: '5명 · 초소형', desc: '좁고 뜨거운 경기장. 3~6명이 빠르게 승부', players: 5, theme: 'lava' }
};
const SL_THEMES = {
  space:  { bg: ['#16213A', '#0A0F1E'], grid: 'rgba(120,170,255,0.07)', edge: 'rgba(255,92,122,0.55)', glow: 'rgba(255,92,122,0.18)' },
  sea:    { bg: ['#0F4466', '#06233A'], grid: 'rgba(120,220,255,0.09)', edge: 'rgba(255,209,102,0.65)', glow: 'rgba(255,209,102,0.2)' },
  forest: { bg: ['#17361F', '#08160E'], grid: 'rgba(150,255,170,0.07)', edge: 'rgba(124,255,120,0.6)', glow: 'rgba(124,255,120,0.18)' },
  lava:   { bg: ['#43190F', '#1C0905'], grid: 'rgba(255,140,80,0.09)', edge: 'rgba(255,120,40,0.8)', glow: 'rgba(255,90,30,0.32)' }
};
function slMapSize(trackId) {
  const t = String(trackId || 'galaxy'), m = t.match(/^auto:(\d+)/), base = SL_MAPS[t.split(':')[0]] || SL_MAPS.galaxy;
  const n = m ? Math.max(4, Math.min(30, +m[1])) : (base.players || 30);
  return { R: Math.round(SL_R * Math.sqrt(n / 30)), pellets: Math.round(SL_PELLETS * n / 30), theme: SL_THEMES[base.theme] || SL_THEMES.space, players: n, name: base.name };
}
const SL_SEG = 0.45;           // 몸 마디 간격(칸) — 마디는 정확히 이 간격으로 찍힘
const SL_SPEED = 0.11;         // 한 프레임(16.7ms) 이동 칸 · 부스트는 1.7배
const SL_K = 8;                // 신호마다 싣는 최근 마디 수
const SL_TSM = 1679616;        // 보낸 시각(ms)을 36진 4글자로 — 이 값으로 나눈 나머지
const SL_WIN = 2000;           // 길이 2000에 먼저 닿으면 경기 끝 (그 순간 점수로 모두의 순위)
const SL_HHR = 1.3;             // 머리끼리: 두 머리 중심이 (반지름 합 × 1.3) 안이면 닿음 (넉넉하게)
const SL_ZONE = 0.3;            // 머리끼리: 상대 머리가 내 머리 앞쪽 반원 + 조금(약 ±107°) 안 — 그보다 뒤(목)면 몸 박기
const SL_LATE = 1200;           // 머리끼리 결론이 이보다(ms) 늦게 오면(끊김 뒤) 먹힌 쪽이 받지 않음 → 먹은 쪽이 되돌림
const SL_RESPAWN_LEN = 6;       // 부활 길이 = 쓰러져 기다리는 동안의 점수
const SL_HIT = 0.8;            // 몸 박기: 내 화면에서 반지름 합의 0.8배 안으로 겹쳐야 탈락 (살짝 스친 것은 살림)
const SL_GHOST = 1000;          // 신호가 이만큼(ms) 안 오면 흐린 유령 — 부딪혀도 안 죽음
const SL_DROP = 20000;          // 신호 없이 20초 → 지움 (명단에서 빠진 친구는 3초)
const SL_HH = 1500;             // 머리끼리 물음의 답을 기다리는 시간(ms) — 그동안 그 친구와는 몸 판정 쉼
const SL_CONFIRM = 350;         // 몸에 닿은 뒤 그 친구가 이미 쓰러졌는지 소식을 기다리는 시간(ms) — 먼저 박고 쓰러진 친구의 남은 몸에 죽지 않게
const SL_MARGIN = 150;          // '누가 먼저 그 자리에 있었나' 여유(ms) — 기기 시계 어긋남 + 흔들림. 이 안이면 둘 다 삼
const SL_SUPER_P = 0.09, SL_SUPER_MS = 60000, SL_SUPER_GAP = 15000;   // 슈퍼: 부활 때 9% · 60초 · 끝난 뒤 15초는 새로 안 나옴
const SL_COLORS = ['#06D6A0', '#4CC9F0', '#FFD166', '#FF5C7A', '#B15DFF', '#FF9F43', '#7DF58F', '#F78FB3'];   // 먹이 색

function slTint(hex, k) {
  const h = String(hex).replace('#', ''); if (h.length !== 6) return hex;
  return '#' + [0, 2, 4].map(i => { const c = parseInt(h.slice(i, i + 2), 16); return Math.max(0, Math.min(255, Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k)))).toString(16).padStart(2, '0'); }).join('');
}
function slRgba(hex, a) { const h = String(hex).replace('#', ''); return 'rgba(' + [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).join(',') + ',' + a + ')'; }
// 받침에 맞는 조사 (민수가 · 지훈이) — 한글이 아니면 '이(가)'
function slJosa(w, a, b) { const s = String(w || ''), c = s.charCodeAt(s.length - 1) - 0xAC00; if (!(c >= 0 && c < 11172)) return s + a + '(' + b + ')'; return s + (c % 28 ? a : b); }
// 방향 → 36진 2글자 (1296 단계)
function slEnc(a) { let q = Math.round((a + Math.PI) / (Math.PI * 2) * 1296) % 1296; if (q < 0) q += 1296; return (q < 36 ? '0' : '') + q.toString(36); }
function slDec(s, i) { return parseInt(s.substr(i, 2), 36) / 1296 * Math.PI * 2 - Math.PI; }

// 겉모습 48가지 = 색 12(색상환을 고르게 + 흰색) × 무늬 4(점 · 줄무늬 · 두 색 띠 · 흰 테두리)
//   참가 순서(slot) k → 색 (k×5)%12 (이웃 번호끼리 색이 멀리 떨어짐), 무늬 ⌊k/12⌋ — 30명이면 색 12 × 무늬 3 안에서 모두 다름
//   (보라 두 가지는 헷갈려 하나를 흰색으로 바꿈)
const SL_HUES = ['#FF4D5E', '#FF9A2E', '#FFE03D', '#A8E63A', '#2EDB6F', '#1EE8C0', '#3FD0FF', '#4F86FF', '#9B6CFF', '#F45CE0', '#FFA3C7', '#E9EDF6'];
const SL_SKINS = [];
for (let k = 0; k < 48; k++) {
  const h = (k * 5) % 12, pat = Math.floor(k / 12), c = SL_HUES[h];
  SL_SKINS.push({ c, pat, glow: slRgba(c, 0.33), hi: slTint(c, 0.55),
    edge: pat === 3 ? '#F4F7FF' : slTint(c, -0.45),
    c2: pat === 0 ? 'rgba(10,14,30,0.30)' : pat === 1 ? 'rgba(16,20,36,0.62)' : pat === 2 ? SL_HUES[(h + 4) % 12] : slTint(c, -0.5) });
}
const SL_SUPER_SKIN = { c: '#FFCC33', pat: 9, glow: 'rgba(255,214,70,0.34)', hi: '#FFF6C8', edge: '#8F5E00', c2: 'rgba(255,255,255,0.62)' };

// 점 (hx,hy) 와 꺾은선 (x0,y0) → pts[from] → … → pts[from+cnt-1] 사이가 lim 보다 가까운가 (선분 거리)
function slNear(hx, hy, lim, x0, y0, pts, from, cnt) {
  const l2 = lim * lim, end = Math.min(pts.length, from + cnt); let px = x0, py = y0;
  for (let i = from; i < end; i++) {
    const q = pts[i], qx = q[0], qy = q[1];
    if (!((hx < px - lim && hx < qx - lim) || (hx > px + lim && hx > qx + lim) || (hy < py - lim && hy < qy - lim) || (hy > py + lim && hy > qy + lim))) {
      const vx = qx - px, vy = qy - py, vv = vx * vx + vy * vy;
      let t = vv > 1e-9 ? ((hx - px) * vx + (hy - py) * vy) / vv : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = px + vx * t - hx, dy = py + vy * t - hy; if (dx * dx + dy * dy < l2) return true;
    }
    px = qx; py = qy;
  }
  return false;
}

// (hx,hy) 가 꺾은선(시작점 x0,y0 시각 t0 → pts[from..]) 과 lim 안으로 닿는 가장 가까운 곳 → { t: 그 자리 마디 시각, i: 마디 번호, x, y } · 없으면 null
//   ux,uy 가 0 이 아니면 그 방향 앞쪽만 · tf(i): 마디 시각 (없으면 pts[i][2])
function slHitT(hx, hy, lim, ux, uy, x0, y0, t0, pts, from, cnt, tf) {
  const end = Math.min(pts.length, from + cnt); let px = x0, py = y0, pt = t0, best = null, bd = lim * lim;
  for (let i = from; i < end; i++) {
    const q = pts[i], qx = q[0], qy = q[1], qt = tf ? tf(i) : q[2];
    if (!((hx < px - lim && hx < qx - lim) || (hx > px + lim && hx > qx + lim) || (hy < py - lim && hy < qy - lim) || (hy > py + lim && hy > qy + lim))) {
      const vx = qx - px, vy = qy - py, vv = vx * vx + vy * vy;
      let t = vv > 1e-9 ? ((hx - px) * vx + (hy - py) * vy) / vv : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const cx = px + vx * t, cy = py + vy * t, ex = cx - hx, ey = cy - hy, dd = ex * ex + ey * ey;
      if (dd < bd && (!(ux || uy) || ex * ux + ey * uy > 0)) { bd = dd; best = { t: pt + (qt - pt) * t, i, x: cx, y: cy }; }
    }
    px = qx; py = qy; pt = qt;
  }
  return best && isFinite(best.t) ? best : null;
}
// 점 (hx,hy) 에서 꺾은선 pts[from] → … → pts[from+cnt-1] 까지 가장 가까운 거리 (점이 하나면 그 점까지)
function slDist(hx, hy, pts, from, cnt) {
  const end = Math.min(pts.length, from + cnt); if (from >= end) return Infinity;
  let best = Infinity, px = pts[from][0], py = pts[from][1];
  { const ex = px - hx, ey = py - hy; best = ex * ex + ey * ey; }
  for (let i = from + 1; i < end; i++) {
    const qx = pts[i][0], qy = pts[i][1], vx = qx - px, vy = qy - py, vv = vx * vx + vy * vy;
    let t = vv > 1e-9 ? ((hx - px) * vx + (hy - py) * vy) / vv : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ex = px + vx * t - hx, ey = py + vy * t - hy, dd = ex * ex + ey * ey; if (dd < best) best = dd;
    px = qx; py = qy;
  }
  return Math.sqrt(best);
}
// 머리끼리 결론의 짝 이름: 두 뱀 id·목숨 (순서 상관없이 같은 이름)
function slPairKey(a, la, b, lb) { return a < b ? a + '.' + la + '|' + b + '.' + lb : b + '.' + lb + '|' + a + '.' + la; }
// 결론 c1 이 c2 보다 먼저인가 (서버 시각 → 보낸 id) — 모든 기기가 같은 답
function slEarlier(c1, c2) { return c1.ts < c2.ts || (c1.ts === c2.ts && String(c1.by) < String(c2.by)); }
// 순위: 점수 내림차순 → (2000 달성자 먼저) → 닉네임 → id — 모든 화면 · 선생님 화면이 같은 규칙
function slRankCmp(win) { return (a, b) => (b.s - a.s) || (win ? (a.id === win ? -1 : b.id === win ? 1 : 0) : 0) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); }

class SlitherGame {
  constructor(canvas, opts) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.opts = opts || {};
    this.cellSize = this.opts.cellSize || 20;
    { const ms = slMapSize(this.opts.trackId); this.R = ms.R; this.pelletN = ms.pellets; this.theme = ms.theme; this.mapPlayers = ms.players; }   // 맵(인원)에 맞춘 경기장
    this.myId = String(this.opts.myId || 'me'); this.myName = this.opts.myName || '';
    // 겉모습: 참가 순서(slot)대로 나눔 — 늦게 들어와 겹치면 fixSkin 이 빈 것으로 바꿈
    const hash = Math.abs(this.myId.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7));
    this.skin = typeof this.opts.slot === 'number' ? this.opts.slot % SL_SKINS.length : hash % 36;
    this.peers = {}; this.leftPeers = {}; this.parts = []; this.now = 0; this.lastTime = 0;
    this.score = 0; this.kills = 0; this.best = 0; this.gameOver = false; this.toasts = []; this.banner = null;
    this.mx = 0; this.my = 0; this.boost = false; this.quality = 2;
    this.life = 0; this.seq = 0;
    this.superUntil = 0; this.superCool = 0; this.leader = null; this.leadSince = 0; this.frameN = 0;
    this.credit = {}; this.hhPairs = {}; this.hhOut = {}; this.deathTs = {}; this.noted = {}; this.dlog = []; this.glog = []; this.killedBy = null; this.fullUntil = 0; this.needAt = -1e9;
    this.endAt = +this.opts.endAt || 0; this.endReason = ''; this.endTs = 0; this.finals = {}; this.sHist = []; this.sentLen = 0;   // 시간 제한(서버 ms) · 끝난 까닭 · 끝난 서버 시각 · 친구들의 최종 점수 · 내 점수 기록(끝난 순간 값)
    this.labels = new Map(); this.pelletSpr = new Map(); this.dotSpr = new Map(); this.bgCache = null;
    this.reset(6, this.opts.slot);
    this.pellets = []; this.seed = 12345; for (let i = 0; i < this.pelletN; i++) this.spawnPellet();
  }
  get colorIdx() { return this.skin; }
  rnd() { this.seed = (this.seed * 9301 + 49297) % 233280; return this.seed / 233280; }
  spawnPellet(x, y, v) {
    if (this.pellets && this.pellets.length > this.pelletN * 1.6) return;   // 먹이가 너무 쌓이지 않게
    if (x == null) { const a = this.rnd() * Math.PI * 2, r = Math.sqrt(this.rnd()) * (this.R - 2); x = Math.cos(a) * r; y = Math.sin(a) * r; }
    this.pellets.push({ x, y, v: v || 1, c: SL_COLORS[Math.floor(this.rnd() * SL_COLORS.length)], ph: this.rnd() * 6 });
  }
  reset(len, slot) {
    let best = null, bd = -1;
    if (typeof slot === 'number') {
      // 첫 출발: 해바라기 배치(황금각). 30명이면 이웃 사이가 약 20칸 — 동시에 들어와도 서로 모르는 채로 겹치지 않음
      const k = slot % 40, a = k * 2.39996, r = Math.sqrt((k + 0.5) / 40) * (this.R - 12);
      best = [Math.cos(a) * r, Math.sin(a) * r];
    } else
    // 부활 위치: 경기장 안쪽에서 다른 뱀 머리와 가장 먼 후보 (8곳 중)
    for (let k = 0; k < 8; k++) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (this.R - 10), x = Math.cos(a) * r, y = Math.sin(a) * r;
      let near = 1e9; for (const id in this.peers) { const p = this.peers[id]; if (!p.dead) near = Math.min(near, Math.hypot(p.hx - x, p.hy - y)); }
      if (near > bd) { bd = near; best = [x, y]; } }
    this.x = best[0]; this.y = best[1]; this.angle = Math.atan2(-this.y, -this.x) + (Math.random() - 0.5);   // 가운데 쪽을 보고 출발
    this.len = len || 6; this.life++;
    this.trail = []; for (let i = 0; i < 40; i++) this.trail.push([this.x - Math.cos(this.angle) * i * SL_SEG, this.y - Math.sin(this.angle) * i * SL_SEG]);
    this.seq += 40; this.killedBy = null;
    this.deadUntil = 0; this.invul = 2000; this.boostAcc = 0; this.fullUntil = this.clock() + 700;   // 새 몸은 처음 몇 번 통째로 보냄
  }
  get isDead() { return this.now < this.deadUntil; }
  get isSuper() { return !this.isDead && this.now < this.superUntil; }
  get radius() { return 0.28 + Math.min(1.1, Math.sqrt(this.len) * 0.07); }
  static radiusOf(len) { return 0.28 + Math.min(1.1, Math.sqrt(len) * 0.07); }
  // 점수 = 지금 길이 (쓰러져 기다리는 동안 6 · 끝난 뒤엔 끝난 순간 값으로 고정) — HUD · 순위표 · 선생님 화면 · 결과가 모두 이 숫자
  curScore() { return this.gameOver ? this.score : this.isDead ? SL_RESPAWN_LEN : Math.round(Math.min(SL_WIN, this.len)); }
  // 서버 시각 ts 때의 내 점수 (기록에서) — 끝난 순간 값
  scoreAt(ts) { const h = this.sHist; for (let i = h.length - 1; i >= 0; i--) if (h[i][0] <= ts) return h[i][1]; return h.length ? h[0][1] : this.curScore(); }
  clock() { return this.now || performance.now(); }
  // 신호의 보낸 시각(36진 4글자 · 약 28분마다 되돌아옴) → 전체 서버 시각
  fullTs(ts) { const s = this.srvNow(); let df = ((s - ts) % SL_TSM + SL_TSM) % SL_TSM; if (df > SL_TSM / 2) df -= SL_TSM; return s - df; }
  srvNow() { return this.opts.serverNow ? this.opts.serverNow() : this.clock(); }   // 보낸 시각은 서버 시계로 (모든 기기가 같은 시계 → 받는 쪽이 한쪽 지연을 바로 앎)
  toast(t, c) { this.toasts.push({ text: t, color: c || '#fff', until: this.clock() + 1800 }); }
  say(t, s, c, ms) { this.banner = { t, s: s || '', c: c || '#FFD166', until: this.clock() + (ms || 3000), at: this.clock() }; }
  nameOf(id) { const p = this.peers[id]; return (p && p.name) || (this.opts.nameOf && this.opts.nameOf(id)) || '친구'; }
  send(type, target, payload) { if (this.opts.onAttack) this.opts.onAttack(type, target, payload || {}); }
  // 화면에 그리는 상대: 쓰러진 뒤(먹이로 바뀐 뒤)가 아니고 지워지지 않은 모든 친구 — 숨기는 길 없음
  shown(p) { return (!p.dead || p.dying) && p.pts.length > 0; }
  // 유령: pos 가 지워졌거나(끊김) 1초 넘게 신호가 없음 → 흐리게 그리고 부딪혀도 안 죽음 (멈춘 몸에 억울하게 죽지 않게)
  ghost(p) { return !!p.gone || this.now - p.seen > SL_GHOST; }
  // 살아 있는 상대(순위·1등·미니맵) · 부딪힐 수 있는 상대(live: 유령 아님)
  alive(p) { return !p.dead && p.pts.length > 0; }
  live(p) { return this.alive(p) && !this.ghost(p) && p.deadLife !== p.life; }   // deadLife: 쓰러졌다는 사건이 위치 신호보다 먼저 옴

  // ── 신호 ──
  // x,y,각도,길이,부스트,죽음,겉모습,삼킴 (앞 8칸은 예전 형식과 같음) · 표시(1 무적 2 슈퍼),목숨,마디번호,보낸시각,몸마디수,첫마디x,y(1/100칸),방향들
  serialize() {
    if (this.isDead && this._deadSer && this._deadKey === this.life + ':' + this.kills + ':' + this.gameOver) return this._deadSer;   // 쓰러져 기다리는 3초: 같은 글자 → 페이지가 다시 보내지 않음 (보낸 시각만 바뀌던 신호 · 인원² 만큼 받음)
    const t = this.trail, nb = Math.min(t.length, Math.ceil(this.len / SL_SEG) + 3), K = this.clock() < this.fullUntil ? nb : Math.min(SL_K, nb);
    let dirs = ''; for (let i = 1; i < K; i++) dirs += slEnc(Math.atan2(t[i][1] - t[i - 1][1], t[i][0] - t[i - 1][0]));
    const fl = (this.invul > 0 ? 1 : 0) | (this.isSuper ? 2 : 0) | (this.gameOver ? 4 : 0);   // 4: 경기 끝 — 점수 칸은 최종 점수
    if (!this.isDead) this.sentLen = Math.round(this.len);                           // 머리끼리 길이 비교에 쓰는 '보낸 길이'
    const s = [this.x.toFixed(2), this.y.toFixed(2), this.angle.toFixed(2), Math.round(this.len), (this.boost && this.len > 8 && !this.isDead) ? 1 : 0, this.isDead ? 1 : 0, this.skin, this.kills,
      fl, this.life, this.seq, (Math.round(this.srvNow()) % SL_TSM).toString(36), nb, Math.round((t[0][0] - this.x) * 100), Math.round((t[0][1] - this.y) * 100), dirs, this.curScore(), this.isDead && this.killedBy ? this.killedBy.id : '', this.isDead && this.killedBy ? this.killedBy.k : ''].join(',');   // 점수(= 지금 길이) · 머리끼리 먹힘: 먹은 친구 id · e/c
    if (this.isDead) { this._deadSer = s; this._deadKey = this.life + ':' + this.kills + ':' + this.gameOver; }
    return s;
  }
  static parse(raw) {
    const a = String(raw).split(','), has = i => a[i] != null && a[i] !== '';
    return { x: +a[0], y: +a[1], angle: +a[2], len: +a[3] || 6, boost: a[4] === '1', dead: a[5] === '1', ci: +a[6] || 0, kills: +a[7] || 0,
      fl: +a[8] || 0, life: has(9) ? +a[9] : -1, seq: has(10) ? +a[10] : -1, ts: has(11) ? parseInt(a[11], 36) : -1, nb: +a[12] || 0, ax: (+a[13] || 0) / 100, ay: (+a[14] || 0) / 100, dirs: a[15] || '', sc: has(16) ? +a[16] : NaN, kb: a[17] || '', kk: a[18] || '' };
  }
  applyPeerRaw(id, raw, name) {
    if (typeof raw !== 'string') return;                       // 이전 게임의 옛 신호 등 형식이 다르면 무시
    const d = SlitherGame.parse(raw), now = this.clock(); d.tsF = d.ts >= 0 && isFinite(d.ts) ? this.fullTs(d.ts) : NaN;
    if (!isFinite(d.x) || !isFinite(d.y) || !isFinite(d.angle) || !isFinite(d.len) || !isFinite(d.seq)) return;   // 숫자가 아니면 무시
    let p = this.peers[id];
    if (!p && this.leftPeers[id]) { p = this.peers[id] = this.leftPeers[id]; delete this.leftPeers[id]; p.left = 0; }   // 나갔다 다시 온 친구: 들고 있던 몸에서 이어 그림
    if (p) p.gone = 0;                                          // 끊겼다 다시 옴 → 들고 있던 몸에 이어 붙임
    if (!p) p = this.peers[id] = { id, pts: [], seq0: -1, lag: 0, life: d.life, dead: d.dead, hx: d.x, hy: d.y, ang: d.angle, rx: d.x, ry: d.y, ra: d.angle, vs: 0, vn: 0, d0: 0, minOff: null, late: 0, len: d.len, name: '', seen: now, sup: false };
    if (p.eatenLife === d.life && !d.dead) { p.seen = now; return; }   // 내가 머리끼리로 먹은 친구(같은 목숨)의 늦게 온 '살아 있는' 신호 → 무시 (쓰러지는 모습 그대로 · 다시 나타나지 않게)
    // 다시 태어남(목숨 번호가 바뀜) → 자취 새로
    if (d.life !== p.life || (p.dead && !p.dying && !d.dead)) { p.pts = []; p.seq0 = -1; p.lag = 0; p.dying = false; p.hhUntil = 0; p.rammedAt = 0; p.hitAt = 0; p.rx = d.x; p.ry = d.y; p.ra = d.angle; }
    // 죽음: 그리던 머리가 죽은 자리까지 마저 간 뒤 먹이로 바뀜 (stepPeers)
    if (!p.dead && d.dead) { p.dying = p.pts.length > 0; p.dyingAt = now; }
    if (!d.dead || p.dying) this.mergePts(p, d);
    // 늦음 추정: (받은 시각 - 보낸 시각) 이 가장 작았던 때보다 얼마나 더 걸렸나
    if (d.ts >= 0 && isFinite(d.ts)) { const off = ((now - d.ts) % SL_TSM + SL_TSM) % SL_TSM; if (p.minOff == null) p.minOff = off;
      let df = off - p.minOff; if (df > SL_TSM / 2) df -= SL_TSM; if (df < -SL_TSM / 2) df += SL_TSM; if (df < 0) { p.minOff = off; df = 0; } p.late = df;
      // 한쪽 지연(ms): 서버 시계면 (지금 - 보낸 시각), 아니면 '가장 빨랐던 때 + 80ms' 로 어림 — 참고용
      let one = 80 + df; if (this.opts.serverNow) { one = ((this.srvNow() - d.ts) % SL_TSM + SL_TSM) % SL_TSM; if (one > SL_TSM / 2) one = 0; }
      one = Math.max(20, Math.min(600, one)); p.net = p.net == null ? one : p.net + (one - p.net) * 0.3; }
    const wasSup = p.sup, N = SL_SKINS.length;
    p.hx = d.x; p.hy = d.y; p.ang = d.angle; p.len = Math.max(1, Math.min(3000, d.len)); p.boost = d.boost; p.dead = d.dead;
    p.skin = ((Math.round(d.ci) % N) + N) % N; p.kills = d.kills; p.sup = !!(d.fl & 2) && !d.dead; p.inv = !!(d.fl & 1); p.life = d.life; p.nb = d.nb;
    p.score = isFinite(d.sc) ? d.sc : (d.dead ? SL_RESPAWN_LEN : Math.round(Math.min(SL_WIN, p.len)));   // 그 친구 화면의 점수(= 지금 길이) 그대로
    if (isFinite(d.tsF)) { const h = p.sh || (p.sh = []); if (!h.length || h[h.length - 1][1] !== p.score) h.push([d.tsF, p.score]); while (h.length > 2 && h[1][0] < d.tsF - 8000) h.shift(); }   // 점수 기록 (끝난 순간 값)
    if (d.fl & 4) { this.finals[id] = p.score; if (this.gameOver) this.rerank(); }                 // 경기 끝 신호: 그 친구의 최종 점수 → 순위 다시 셈 (모든 화면이 같은 자료)
    else if (p.score >= SL_WIN && !this.gameOver) this.finish('goal', id, name || p.name, isFinite(d.tsF) ? d.tsF : this.srvNow());   // 끝 소식을 놓쳐도 상대 길이가 2000이면 끝
    p.name = name || p.name || ''; p.seen = now; p.raw = raw; if (d.ts >= 0 && isFinite(d.ts)) p.ts = d.ts; p.headT = d.tsF;   // 받은 머리(hx)에 있던 시각
    // 도착 간격(이동 평균) — 보내는 간격이 인원에 따라 165~235ms 로 달라짐. 다음 신호가 올 때쯤 받은 길 끝 '조금 앞'에 닿는 속도로 정해 그 사이를 고르게 감 (stepPeers)
    { const iv = p.iv || this.opts.sendMs || 165; p.iv = p.rcv == null ? iv : (now - p.rcv < iv * 2.5 ? iv + (Math.max(40, now - p.rcv) - iv) * 0.15 : iv); p.rcv = now;
      const N = Math.max(3, p.iv / 16.7), v = SL_SPEED * (p.boost ? 1.7 : 1), M = 1 + N * 0.15; p.spd = Math.max(v * 0.5, Math.min(v * 2.5, (p.lag - v * M) / N)); p.mg = v * M; }
    if (p.sup && !wasSup) { this.superCool = Math.max(this.superCool, now + SL_SUPER_GAP); this.toast(slJosa(p.name || '친구', '이', '가') + ' 슈퍼 지렁이로 태어났다!', '#FFD447'); }
    // 몸이 모자라면 (처음 받음 · 신호가 크게 빠짐) 전체 몸을 한 번 요청 — 3초에 한 번까지
    //   그 친구에게만 요청 (예전: '*' → 모든 친구가 전체 몸(길이 2000이면 약 9KB)을 2~3번씩 보내 테더링이 막힘)
    if (d.seq >= 0 && !d.dead && p.pts.length + 8 < Math.min(d.nb, Math.ceil(p.len / SL_SEG) + 1) && !(now - p.needAt < 2500)) { p.needAt = now; this.send('need', id, {}); }
  }
  // 받은 마디를 번호대로 이어 붙임
  mergePts(p, d) {
    const oldH0 = p.pts.length ? Math.hypot(p.pts[0][0] - p.hx, p.pts[0][1] - p.hy) : 0;
    if (d.seq < 0) { this.pushHead(p, d.x, d.y); return; }       // 예전 형식 신호: 머리 위치로만 자취
    const K = 1 + (d.dirs.length >> 1), q = new Array(K);
    // 마디가 놓인 시각(서버 시계): 보낸 시각 - (머리에서 그 마디까지 거리 ÷ 속도) — '누가 먼저 그 자리에 있었나'를 가리는 데 씀
    let x = d.x + d.ax, y = d.y + d.ay; const vms = SL_SPEED * (d.boost ? 1.7 : 1) / 16.7, t0 = d.tsF - Math.hypot(d.ax, d.ay) / vms; q[0] = [x, y, t0];
    for (let i = 1; i < K; i++) { const a = slDec(d.dirs, (i - 1) * 2); x += Math.cos(a) * SL_SEG; y += Math.sin(a) * SL_SEG; q[i] = [x, y, t0 - i * SL_SEG / vms]; }
    const newN = p.seq0 < 0 ? -1 : d.seq - p.seq0;
    if (d.dead && newN < 0 && -newN < p.pts.length - 1) {          // (예전 판: 쓰러지며 머리를 되감은 신호) → 그 뒤 마디를 지우고 그 자리까지만 감
      const k = -newN, s0 = p.lag - oldH0 - k * SL_SEG; p.pts.splice(0, k); p.seq0 = d.seq;
      p.lag = Math.max(0, Math.hypot(p.pts[0][0] - d.x, p.pts[0][1] - d.y) + s0); return; }
    if (p.seq0 < 0 || newN < -2 || Math.hypot(d.x - p.hx, d.y - p.hy) > 20) { p.pts = q; p.lag = 0; }      // 처음 · 다시 시작한 기기 · 순간이동
    else if (newN >= 0 && K > p.pts.length + newN) { p.pts = q; p.lag += newN * SL_SEG + Math.hypot(q[0][0] - d.x, q[0][1] - d.y) - oldH0; }   // 전체 몸이 실려 옴
    else if (newN > 0) {
      if (newN <= K) { for (let i = newN - 1; i >= 0; i--) p.pts.unshift(q[i]); }
      else {                                                     // 신호가 빠짐: 받은 점 + 빈 곳은 곧은 선으로 메움 (진짜 몸이 아니므로 시각 없음 → 여기에 닿아도 안 죽음)
        const miss = newN - K, a = q[K - 1], b = p.pts[0];
        if (miss > 160 || Math.hypot(a[0] - b[0], a[1] - b[1]) > (miss + 1) * SL_SEG + 1) p.pts = q;
        else { const fill = []; for (let j = 1; j <= miss; j++) { const t = j / (miss + 1); fill.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NaN]); } p.pts = q.concat(fill, p.pts); }
      }
      p.lag += newN * SL_SEG + Math.hypot(p.pts[0][0] - d.x, p.pts[0][1] - d.y) - oldH0;
    } else if (newN === 0) p.lag += Math.hypot(p.pts[0][0] - d.x, p.pts[0][1] - d.y) - oldH0;
    if (newN >= 0 || p.seq0 < 0 || newN < -2) p.seq0 = d.seq;
    if (p.lag < 0) p.lag = 0; if (p.lag > 15) p.lag = 1;          // 너무 밀렸으면(멈췄던 탭 등) 바로 따라잡음
    const keep = Math.ceil(Math.max(p.len, d.len) / SL_SEG) + 40; if (p.pts.length > keep) p.pts.length = keep;
  }
  pushHead(p, x, y) {
    if (!p.pts.length || Math.hypot(x - p.pts[0][0], y - p.pts[0][1]) > 8) { p.pts = [[x, y]]; p.lag = 0; return; }
    const before = Math.hypot(p.pts[0][0] - p.hx, p.pts[0][1] - p.hy);
    let h = p.pts[0], dx = x - h[0], dy = y - h[1], dd = Math.hypot(dx, dy), n = 0;
    while (dd >= SL_SEG) { const k = SL_SEG / dd; h = [h[0] + dx * k, h[1] + dy * k]; p.pts.unshift(h); n++; dx = x - h[0]; dy = y - h[1]; dd = Math.hypot(dx, dy); }
    p.lag = Math.max(0, Math.min(15, p.lag + n * SL_SEG + dd - before));
    const keep = Math.ceil(p.len / SL_SEG) + 40; if (p.pts.length > keep) p.pts.length = keep;
  }
  // 페이지가 넘기는 전체 목록: 이미 받은 신호는 다시 넣지 않음 (예전: 누가 나갈 때마다 모든 친구의 지난 신호를 다시 넣어 도착 간격·'마지막 신호' 시각이 틀어짐)
  setPeers(map) { Object.keys(map).forEach(id => { const d = map[id], p = this.peers[id]; if (d.raw && !(p && p.raw === d.raw)) this.applyPeerRaw(id, d.raw, d.name); }); Object.keys(this.peers).forEach(id => { if (!map[id]) this.removePeer(id); }); }
  // pos 가 지워짐(끊김 · 나감): 바로 지우지 않고 표시만 — 잠깐 끊긴 것이면(테더링·와이파이) 다시 온 신호를 들고 있던 몸에 이어 그림 (예전: 그 순간 뱀이 사라졌다가 짧은 몸으로 다시 나타남)
  removePeer(id) { const p = this.peers[id]; if (p && !p.gone) p.gone = this.clock(); }
  // 페이지의 참가자 명단(roster) — 명단에서 빠진 친구만 (신호가 3초 넘게 없으면) 지움. 잠깐 끊겨 빠졌다 다시 들어오면 그대로
  syncRoster(r) { const now = this.clock(); for (const id in this.leftPeers) if (r && r[id] != null) { this.peers[id] = this.leftPeers[id]; delete this.leftPeers[id]; }
    for (const id in this.peers) { const p = this.peers[id]; if (r && r[id] != null) p.left = 0; else if (!p.left) p.left = now; } }

  // ── 사건 ──
  onEvent(e) {
    if (!e || e.by === this.myId) return;
    const now = this.clock(), nm = this.nameOf(e.by), me = e.target === this.myId;
    if (e.type === 'win') { this.finish('goal', e.by, e.name || nm, isFinite(+e.ts) ? +e.ts : +e.t); return; }   // 누가 2000 달성 → 경기 끝 (그 순간 길이로 순위)
    if (e.type === 'need') { if (e.target === this.myId || e.target === '*') this.fullUntil = now + 400; return; }   // 누가 내 몸 전체를 원함 → 다음 신호에 통째로
    if (e.type === 'crash' || e.type === 'hhd') { const q = this.peers[e.by], lf = e.type === 'crash' ? e.life : e.ml; if (q && q.life === lf) q.deadLife = lf; }   // 그 친구는 쓰러짐 → 바로 부딪힘에서 뺌
    if (e.type === 'crash') {                                                       // 누가 내 몸에 부딪혀 탈락함 (알림만)
      if (!me) return; const key = 'c' + e.by + ':' + e.life; if (this.credit[key]) return; this.credit[key] = 1;
      this.toast(slJosa(nm, '이', '가') + ' 내 몸에 부딪혔다!', '#7DF58F'); return;
    }
    if (e.type === 'hh') { this.applyClaim(e); return; }                            // 머리끼리 결론 (누가 먹었나) — 받는 즉시 따름
    if (e.type === 'hhx') {                                                         // 먹힌 쪽이 결론을 받지 않음(이미 먼저 쓰러짐 · 너무 늦게 옴) → 먹은 쪽은 커진 길이 되돌림
      if (me) { this.voidClaim(e); return; }
      const q = this.peers[e.by], vl = String(e.cb) === e.by ? +e.la : +e.lb; if (e.alive && q && q.life === vl && q.deadLife === vl && !q.dead) q.deadLife = null; return; }   // 구경하는 친구: 다시 부딪힐 수 있게
    if (e.type === 'hhd' && !me && e.k === 'c') {                                   // 다른 친구들: 1등 교체 소식
      const key = e.target + '>' + e.by + ':' + e.ml;
      if (!this.noted[key]) { this.noted[key] = now; this.say(slJosa(this.nameOf(e.target), '이', '가') + ' 1등을 잡았다!', '슈퍼 지렁이가 ' + slJosa(nm, '을', '를') + ' 이기고 1등 자리를 이어받았어요', '#FFD447', 3200); }
    }
  }
  // 머리끼리 결론 c = { by: 낸 기기(A), target: 상대(B), la, lb: 두 목숨, ts: 서버 시각, w: 'a'|'b' 이긴 쪽, k: 'e' 보통 · 'c' 슈퍼가 1등을 먹음, n: 먹은 쪽이 커질 길이,
  //                    x,y: A 머리 · px,py: A 화면의 B 머리 } — 내가 낸 결론도 받은 결론도 같은 길
  //   짝(두 뱀·두 목숨)마다 가장 먼저 낸 결론만 따름 → 두 기기가 동시에 서로 다른 결론을 내도 모든 기기가 같은 결론에 이름
  applyClaim(c) {
    if (!c || c.by == null || c.target == null || !isFinite(+c.ts)) return;
    const now = this.clock(), A = String(c.by), B = String(c.target), la = +c.la, lb = +c.lb, key = slPairKey(A, la, B, lb);
    let st = this.hhPairs[key];
    if (st && st.c && !slEarlier({ ts: +c.ts, by: A }, st.c)) return;            // 이미 같은 결론이거나 더 먼저 낸 결론이 있음
    if (!st) st = this.hhPairs[key] = { at: now, grew: 0 };
    const prev = st.c; st.c = { ts: +c.ts, by: A };
    const aWin = c.w === 'a', win = aWin ? A : B, lose = aWin ? B : A, winL = aWin ? la : lb, loseL = aWin ? lb : la, n = Math.max(1, Math.round(+c.n || SL_RESPAWN_LEN));
    if (win !== this.myId && lose !== this.myId) {                                 // 구경하는 친구: 진 쪽은 곧 쓰러짐 → 그 몸에 부딪혀도 안 죽음
      if (st.obs && this.peers[st.obs.id] && this.peers[st.obs.id].deadLife === st.obs.l) this.peers[st.obs.id].deadLife = null;   // (결론이 바뀜)
      const q = this.peers[lose]; if (q && q.life === loseL) { q.deadLife = loseL; st.obs = { id: lose, l: loseL }; }
      return;
    }
    const meWin = win === this.myId, other = meWin ? lose : win, oL = meWin ? loseL : winL, myL = meWin ? winL : loseL, q = this.peers[other], nm = this.nameOf(other);
    if (q && q.life === oL) q.hhUntil = Math.max(q.hhUntil || 0, now + SL_HH);   // 이 친구와는 잠깐 몸 판정 쉼
    this.glog.push({ t: Math.round(now), key, by: A, ts: +c.ts, meWin, flip: !!prev }); if (this.glog.length > 40) this.glog.shift();
    if (meWin) {
      if (myL !== this.life || this.isDead || st.lost) return;                     // 그 목숨이 이미 끝남(둘 다 쓰러진 경우 등) → 커지지 않음
      if (this.gainFrom(other, oL, n, c.k, q)) st.grew = n;
      if (q && q.life === oL) { if (A !== this.myId) this.showBite(q, +c.x, +c.y); this.markEaten(q, oL); }
      return;
    }
    if (st.grew) { this.undoGain(other, oL, st.grew); st.grew = 0; }               // 내가 먼저 먹은 줄 알았는데 상대 결론이 더 먼저 → 되돌리고 쓰러짐
    if (q && q.eatenLife === oL) this.unmarkEaten(q);
    if (myL !== this.life || this.isDead) {                                        // 이미 쓰러져 있음(다른 까닭): 그 결론보다 분명히 먼저 쓰러졌으면 먹은 쪽이 길이를 되돌리게 알림
      const dt = this.deathTs[myL]; if (dt != null && dt < +c.ts - 150) this.send('hhx', other, { la, lb, cb: A, ct: B, cts: +c.ts });
      return;
    }
    if (A !== this.myId) {                                                         // 상대 화면이 정한 결론: 닿은 자리로 되감아 쓰러짐 (결론이 늦게 와도)
      //   단, 너무 늦게 왔거나(끊김 뒤 · 1.2초 넘음) 그 친구가 내 화면에서 유령이거나, 그 자리가 내 자취에 없으면(상대 화면의 내가 틀림) → 받지 않음: 먹은 쪽이 되돌림
      const k = this.trailNear(+c.px, +c.py), qa = this.peers[A], mh = k >= 0 ? this.trail[k] : [this.x, this.y], bh = qa && this.showBite(qa, +c.x, +c.y, true);
      if (this.srvNow() - (+c.ts) > SL_LATE || k < -1 || !qa || this.ghost(qa) || Math.hypot(bh[0] - mh[0], bh[1] - mh[1]) > (SlitherGame.radiusOf(this.len) + SlitherGame.radiusOf(qa.len)) * 1.6) { st.void = true; this.send('hhx', A, { la, lb, cb: A, ct: B, cts: +c.ts, alive: 1 }); return; }
      this.rewindAt(k); this.showBite(qa, +c.x, +c.y);                            // 내 화면에서도 두 머리가 닿은 모습 (먹은 친구 머리를 닿은 자리까지 당겨 그림)
    }
    st.lost = true;
    this.killedBy = { id: other, k: c.k === 'c' ? 'c' : 'e' };
    if (c.k === 'c') { this.die('슈퍼 지렁이 ' + nm + '에게 1등을 빼앗겼다', other, 'crown', false, true); this.say('1등을 빼앗겼어요', '슈퍼 지렁이 ' + slJosa(nm, '이', '가') + ' 내 머리를 먹었어요', '#FF5C7A', 2600); }
    else this.die('머리끼리 부딪혀 ' + nm + '에게 먹혔어요', other, 'eat', false, true);
    this.send('hhd', other, { ml: this.life, k: this.killedBy.k });               // 쓰러졌다는 소식 (다른 친구들: 그 몸에서 빼기 · 1등 교체 알림)
  }
  // 먹힌 친구가 이미 먼저 쓰러져 있었다고 알려 옴 → 그 결론으로 커진 길이를 되돌림
  voidClaim(e) {
    const st = this.hhPairs[slPairKey(String(e.cb), +e.la, String(e.ct), +e.lb)];
    if (!st || !st.c || st.c.ts !== +e.cts) return;
    const vl = e.cb === this.myId ? +e.lb : +e.la, q = this.peers[e.by]; st.void = true;
    if (st.grew) { this.undoGain(e.by, vl, st.grew); st.grew = 0; }
    if (e.alive && q && q.eatenLife === vl && q.life === vl) this.unmarkEaten(q);  // 살아 있는 그 친구를 다시 그림
  }
  // 상대 화면에서 내 머리가 닿은 자리(x,y) 에 가장 가까운 내 자취 점 번호 (1.5칸 안) · -1: 지금 머리 · -2: 없음
  trailNear(x, y) {
    if (!isFinite(x) || !isFinite(y)) return -2;
    const t = this.trail, m = Math.min(t.length - 3, 120); let bi = -2, bd = 2.25;
    { const dd = (this.x - x) ** 2 + (this.y - y) ** 2; if (dd < bd) { bd = dd; bi = -1; } }
    for (let i = 0; i < m; i++) { const dd = (t[i][0] - x) ** 2 + (t[i][1] - y) ** 2; if (dd < bd) { bd = dd; bi = i; } }
    return bi;
  }
  rewindAt(k) { const t = this.trail; if (k < 0) return; if (k > 0) { t.splice(0, k); this.seq -= k; } this.x = t[0][0]; this.y = t[0][1]; }
  // 친구 머리를 (x,y) — 결론을 낸 화면에서 닿은 자리 — 까지 받은 길을 따라 당겨 그림 (앞으로만 · 1.5칸 안)
  //   dry: 바꾸지 않고 그 뒤 그려질 머리 자리만 돌려줌
  showBite(q, x, y, dry) {
    if (!q || !q.pts.length || !isFinite(x) || !isFinite(y)) return [q ? q.rx : 0, q ? q.ry : 0];
    const pts = q.pts, h0 = Math.hypot(pts[0][0] - q.hx, pts[0][1] - q.hy); let L = null, bd = 2.25;
    { const dd = (q.hx - x) ** 2 + (q.hy - y) ** 2; if (dd < bd) { bd = dd; L = 0; } }
    for (let k = 0, e = Math.min(q.vs + 1, pts.length); k < e; k++) { const dd = (pts[k][0] - x) ** 2 + (pts[k][1] - y) ** 2; if (dd < bd) { bd = dd; L = h0 + k * SL_SEG; } }
    let fx = false; if ((L == null || L === 0) && (q.hx - x) ** 2 + (q.hy - y) ** 2 < 9 && (x - q.hx) * Math.cos(q.ang) + (y - q.hy) * Math.sin(q.ang) > 0) { fx = true; L = 0; }   // 닿은 자리가 받은 머리보다 조금 앞(그 신호가 아직 안 옴) → 그 자리까지 (다음 신호가 이어 붙음)
    if (L == null || L > q.lag + 1e-9) return [q.rx, q.ry];
    if (dry) return fx ? [x, y] : (L === 0 ? [q.hx, q.hy] : [pts[Math.round((L - h0) / SL_SEG)][0], pts[Math.round((L - h0) / SL_SEG)][1]]);
    if (fx) { q.hx = x; q.hy = y; } q.lag = L; this.placeRender(q); return [q.rx, q.ry];
  }
  // 먹은 친구: 내 화면에서 바로 쓰러지는 모습 (늦게 온 '살아 있는' 신호는 무시)
  markEaten(q, L) { q.eatenLife = L; q.deadLife = L; if (!q.dead) { q.dead = true; q.dying = q.pts.length > 0; q.dyingAt = this.clock(); } }
  unmarkEaten(q) { q.eatenLife = null; if (q.deadLife === q.life) q.deadLife = null; q.dead = false; q.dying = false; }
  gainFrom(id, life, n, k, p) { const nm = (p && p.name) || this.nameOf(id); return k === 'c' ? this.takeCrown(id, life, n, nm, p) : this.gain(id, life, n, nm, p); }
  undoGain(id, life, n) {
    const key = id + ':' + life; if (!this.credit[key]) return; delete this.credit[key];
    this.len = Math.max(SL_RESPAWN_LEN, this.len - n); this.kills = Math.max(0, this.kills - 1); if (!this.gameOver) this.score = this.curScore();
    this.glog.push({ t: Math.round(this.clock()), undo: key, n }); this.toast('동시에 부딪혀 결론이 바뀌었어요', '#4CC9F0');
  }
  setMove(x, y) { this.mx = x; this.my = y; }
  setBoost(on) { this.boost = !!on; }
  setQuality(q) { this.quality = q; }
  fire() { this.boost = true; this.kbBoost = true; }   // 패드 호환: 발사(스페이스) = 부스트 — 키를 떼면(firing=false) tick 에서 끔 (예전: 스페이스 한 번에 부스트가 계속 켜져 길이가 줄어듦)
  releaseFire() { this.boost = false; }

  dropPelletsFrom(pts, from, cnt) { const end = Math.min(pts.length, from + cnt); for (let i = from; i < end; i += 2) { const t = pts[i]; this.spawnPellet(t[0] + (this.rnd() - .5) * .4, t[1] + (this.rnd() - .5) * .4, 2); } }
  dropPellets(trail, len) { this.dropPelletsFrom(trail, 0, Math.round(len / SL_SEG)); }
  // ov: 그 순간 내 화면에서 닿음을 봤는가 (시험용 기록 dlog — 최근 30개)
  die(reason, by, cause, quiet, ov) {
    if (this.isDead) return;
    this.dlog.push({ t: Math.round(this.clock()), cause: cause || 'wall', by: by || '', ov: ov !== false, life: this.life }); if (this.dlog.length > 30) this.dlog.shift();
    reason = reason || '탈락';                                  // (이유가 빠져도 'undefined' 가 보이지 않게)
    const now = this.clock(); this.deathTs[this.life] = this.srvNow();
    this.deadUntil = now + 3000; this.best = Math.max(this.best, this.len); this.superUntil = 0;
    this.dropPellets(this.trail, this.len); this.burst(this.x, this.y, 24, SL_SKINS[this.skin].c);
    this.toast(reason + ' · 3초 뒤 부활', '#FF5C7A'); if (window.Sound) Sound.death(); if (typeof Haptic !== 'undefined') Haptic.big();
    if (by && cause === 'body' && !quiet) this.send('crash', by, { life: this.life });   // 몸 주인에게 알림 (주인 화면에 '부딪혔다')
  }
  // 경기 끝: reason 'time'(시간 제한) · 'goal'(누가 2000 달성) — 그 순간(서버 시각 ts)의 점수(= 지금 길이)로 순위. 2000 달성자가 1등
  //   내 최종 점수는 내 점수 기록에서 ts 때 값 → 친구들은 끝난 신호(표시 4)로 최종 점수를 받아 순위를 다시 셈 → 모든 화면이 같은 순위
  //   이미 끝났어도 더 이른 끝 소식(2000 동시 달성 등)이 오면 그것으로 다시 셈
  finish(reason, winId, winName, ts) {
    ts = isFinite(+ts) && +ts > 0 ? +ts : this.srvNow();
    if (this.gameOver && !(ts < this.endTs - 1)) return;
    this.endReason = reason === 'time' ? 'time' : 'goal'; this.endTs = ts; this.winId = this.endReason === 'goal' ? String(winId || '') : ''; this.winName = winName || '';
    this.score = this.winId === this.myId ? SL_WIN : this.scoreAt(ts);
    const first = !this.gameOver; this.gameOver = true;
    this.rerank();
    if (first && window.Sound && Sound.levelUp) Sound.levelUp();
  }
  // 친구의 서버 시각 ts 때 점수 (받은 신호 기록에서) — 끝난 신호가 오면 그 값
  peerScoreAt(id, p, ts) {
    if (this.finals[id] != null) return this.finals[id];
    const h = p.sh; if (h && h.length) { for (let i = h.length - 1; i >= 0; i--) if (h[i][0] <= ts) return h[i][1]; return h[0][1]; }
    return p.score != null ? p.score : (this.alive(p) ? Math.round(p.len) : SL_RESPAWN_LEN);
  }
  rerank() {
    if (!this.gameOver) return;
    const now = this.clock(), win = this.winId, list = [{ id: this.myId, name: this.myName || '', s: this.score }];
    for (const id in this.peers) { const p = this.peers[id]; if (this.finals[id] == null && now - p.seen > 6000 && id !== win) continue;
      list.push({ id, name: p.name || '', s: id === win ? SL_WIN : this.peerScoreAt(id, p, this.endTs) }); }
    if (win && !list.some(e => e.id === win)) list.push({ id: win, name: this.winName || this.nameOf(win), s: SL_WIN });   // 달성자 신호가 아직 안 왔어도 순위에 넣음
    list.sort(slRankCmp(win));
    this.rankList = list; this.rank = list.findIndex(e => e.id === this.myId) + 1; this.total = list.length;
    const top = list[0];
    this.winner = win ? (win === this.myId ? (this.myName || '나') : (this.winName || this.nameOf(win))) : (top.id === this.myId ? (this.myName || '나') : (top.name || this.nameOf(top.id)));
    const sub = '나는 ' + this.total + '명 중 ' + this.rank + '등 · 길이 ' + this.score;
    if (this.endReason === 'time') this.say('시간 끝!', sub + (this.rank === 1 ? ' · 1등!' : ' · 1등 ' + this.winner), '#FFD447', 9e9);
    else this.say(win === this.myId ? '2000 달성! 1등!' : slJosa(this.winner, '이', '가') + ' 2000 달성!', '경기 끝 · ' + sub, '#FFD447', 9e9);
  }
  burst(x, y, n, c) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 0.04 + Math.random() * 0.1; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: 1, c }); } }
  respawn() {
    const now = this.now; this.reset(6); this.toast('부활!', '#06D6A0');
    // 슈퍼 지렁이: 판에 슈퍼가 없고, 지난 슈퍼가 끝난 지 15초가 지났으면 9% (5명 이하면 12~25%)
    let other = false; for (const id in this.peers) if (this.peers[id].sup && this.alive(this.peers[id])) other = true;
    let n = 1; for (const id in this.peers) if (this.alive(this.peers[id])) n++;
    if (!other && now >= this.superCool && Math.random() < Math.max(SL_SUPER_P, Math.min(0.25, 0.6 / n))) this.becomeSuper();   // 인원이 적으면 조금 더 자주
  }
  becomeSuper() {
    const now = this.clock(); this.superUntil = now + SL_SUPER_MS; this.superCool = now + SL_SUPER_MS + SL_SUPER_GAP;
    this.say('슈퍼 지렁이!', '1등과 부딪혀도 안 죽어요 · 1등의 머리를 먹으면 1등의 길이만큼 커져요', '#FFD447', 3600);
    if (window.Sound && Sound.levelUp) Sound.levelUp(); if (typeof Haptic !== 'undefined') Haptic.good();
  }
  gain(id, life, n, nm, p) {
    const key = id + ':' + life; if (this.credit[key]) return false; this.credit[key] = 1;
    this.len += n; this.kills++; if (this.len > SL_WIN) this.len = SL_WIN; if (!this.gameOver) this.score = this.curScore();   // 부딪히는 순간 먹힌 길이만큼 (상한 2000)
    this.glog.push({ t: Math.round(this.clock()), gain: key, n }); if (this.glog.length > 40) this.glog.shift();
    this.toast(slJosa(nm, '을', '를') + ' 삼켰다! +' + n, '#FFD166'); if (p) this.burst(p.rx, p.ry, 20, SL_SKINS[p.skin || 0].c);
    if (window.Sound) Sound.kill(); if (typeof Haptic !== 'undefined') Haptic.good();
    return true;
  }
  takeCrown(id, life, len, nm, p) {
    const key = id + ':' + life; if (this.credit[key]) return false; this.credit[key] = 1;
    this.len += len; this.kills++; if (this.len > SL_WIN) this.len = SL_WIN; if (!this.gameOver) this.score = this.curScore(); this.superUntil = 0;
    this.glog.push({ t: Math.round(this.clock()), gain: key, n: len, crown: 1 }); if (this.glog.length > 40) this.glog.shift();   // 1등의 길이만큼 커짐 (머리끼리 규칙과 같게)
    this.say('1등을 잡았다!', nm + '의 길이 ' + Math.round(len) + '만큼 커져 이제 내가 1등', '#FFD447', 3600);
    this.burst(this.x, this.y, 36, '#FFD447'); if (p) this.burst(p.rx, p.ry, 20, '#FFF6C8');
    if (window.Sound) { Sound.kill(); if (Sound.levelUp) Sound.levelUp(); } if (typeof Haptic !== 'undefined') Haptic.big();
    return true;
  }

  // ── 진행 ──
  tick(now) {
    const { dt, f } = FX.frame(this, now);
    this.frameN++;
    if (!this.superCool) this.superCool = now + SL_SUPER_GAP;                       // 시작하고 15초 동안은 슈퍼 없음
    if (this.deadUntil > 0 && now >= this.deadUntil) this.respawn();
    if (this.kbBoost && !this.firing) { this.kbBoost = false; this.boost = false; }   // 스페이스를 뗌
    this.stepPeers(f, now);                                                          // 상대를 먼저 옮김 — 판정이 이번 프레임 화면과 같도록
    { const l = this.leaderId(); if (l !== this.leader || l !== this.myId) this.leadSince = now; this.leader = l; }   // leadSince: 내가 1등이 된 시각
    if (!this.isDead) {
      // 조향: 조이스틱 방향으로 서서히 회전
      const inLen = Math.hypot(this.mx, this.my);
      if (inLen > 0.15) { const want = Math.atan2(this.my, this.mx); let da = want - this.angle; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
        const rate = (0.09 - Math.min(0.05, this.len * 0.0004)) * f; this.angle += Math.max(-rate, Math.min(rate, da)); }
      if (this.angle > Math.PI) this.angle -= Math.PI * 2; else if (this.angle < -Math.PI) this.angle += Math.PI * 2;
      // 속도 · 부스트(길이 8 넘을 때만, 0.8초마다 길이 1 소모)
      const canBoost = this.boost && this.len > 8;
      const sp = SL_SPEED * (canBoost ? 1.7 : 1) * f;
      if (canBoost) { this.boostAcc += dt; if (this.boostAcc > 800) { this.boostAcc = 0; this.len -= 1; const tl = this.trail[Math.min(this.trail.length - 1, Math.ceil(this.len / SL_SEG))]; this.spawnPellet(tl[0], tl[1], 1); } }
      this.x += Math.cos(this.angle) * sp; this.y += Math.sin(this.angle) * sp;
      const R = this.radius;
      // 경기장 벽: 머리 가장자리가 경계선에 닿으면 탈락 (화면에 보이는 대로)
      if (Math.hypot(this.x, this.y) + R * 0.8 > this.R) this.die('경기장 벽에 닿았어요', '', 'wall', false, true);
      // 자취: 정확히 마디 간격마다 점을 찍음 (받는 쪽이 같은 점을 복원)
      let h = this.trail[0], dx = this.x - h[0], dy = this.y - h[1], dd = Math.sqrt(dx * dx + dy * dy);
      while (dd >= SL_SEG) { const k = SL_SEG / dd; h = [h[0] + dx * k, h[1] + dy * k]; this.trail.unshift(h); this.seq++; dx = this.x - h[0]; dy = this.y - h[1]; dd = Math.sqrt(dx * dx + dy * dy); }
      const maxPts = Math.ceil(this.len / SL_SEG) + 3; if (this.trail.length > maxPts) this.trail.length = maxPts;
      if (this.len > SL_WIN) this.len = SL_WIN;                                       // 길이 상한 2000 (닿으면 경기 끝)
      if (this.invul > 0) this.invul -= dt;
      // 먹이 (가까운 것만 거리 계산)
      const pull = R + 0.6, eat = R + 0.15, pl = this.pellets;
      for (let i = pl.length - 1; i >= 0; i--) { const q = pl[i], ex = q.x - this.x, ey = q.y - this.y; if (ex > pull || ex < -pull || ey > pull || ey < -pull) continue;
        const d = Math.sqrt(ex * ex + ey * ey);
        if (d < pull) { q.x -= ex * 0.35; q.y -= ey * 0.35; }                                   // 빨려 들어옴
        if (d < eat) { this.len += q.v; pl[i] = pl[pl.length - 1]; pl.pop(); this.spawnPellet(); if (window.Sound) Sound.nom(); } }
      // 슈퍼 시간
      if (this.superUntil) {
        if (this.isSuper && this.leader === this.myId && now - this.leadSince > 1500) { this.superUntil = 0; this.toast('1등이 되어 슈퍼 상태가 끝났어요', '#FFD447'); }
        else if (now >= this.superUntil) { this.superUntil = 0; this.toast('슈퍼 지렁이 시간이 끝났어요', '#FFD447'); }
        else if (this.frameN % 6 === 0) { const t = this.trail[Math.floor(Math.random() * Math.min(this.trail.length, Math.ceil(this.len / SL_SEG)))]; this.parts.push({ x: t[0], y: t[1], vx: (Math.random() - .5) * .03, vy: -0.03, l: 1, c: Math.random() < .5 ? '#FFF6C8' : '#FFD447' }); }
      }
      if (!this.isDead) this.collide(R, now);
    }
    // 점수(= 지금 길이) 기록 · 2000 달성 · 시간 제한 — 끝나는 순간 값으로 순위
    { const sc = this.curScore(), h = this.sHist, ts = this.srvNow(); this.score = sc; if (!h.length || h[h.length - 1][1] !== sc) h.push([ts, sc]); while (h.length > 2 && h[1][0] < ts - 8000) h.shift();
      if (!this.isDead && sc >= SL_WIN && !this.gameOver) { this.len = SL_WIN; const t = Math.round(ts); this.send('win', '*', { name: this.myName, len: SL_WIN, ts: t }); this.finish('goal', this.myId, this.myName, t); }
      else if (this.endAt > 0 && !this.gameOver && ts >= this.endAt) this.finish('time', '', '', this.endAt); }
    if (this.isSuper) this.superCool = Math.max(this.superCool, now + SL_SUPER_GAP);
    if (this.frameN % 60 === 0) this.housekeep(now);
    this.parts = FX.stepParts(this.parts, f, 0.05);
    this.toasts = this.toasts.filter(t => t.until > now);
    if (this.banner && this.banner.until < now) this.banner = null;
    this.draw();
  }
  // 상대: 받은 몸 위를 따라 미끄러지듯 이동 (꺾인 길을 질러가지 않음)
  stepPeers(f, now) {
    for (const id in this.peers) { const p = this.peers[id];
      if (p.dead && !p.dying) continue;
      const v = SL_SPEED * (p.boost ? 1.7 : 1);
      // 받은 길 위를 신호를 받을 때 정한 속도(p.spd)로 고르게 따라감. 다음 신호가 늦어 길 끝(여유 p.mg 안)에 가까워지면 서서히 늦춤
      //   (예전: 남은 길에 비례한 속도 — 신호 간격마다 빨라졌다 느려졌다 했고(165ms 에서 ±35%), 간격이 길면 길 끝에서 자주 멈칫)
      { let adv = (p.spd || v) * f * Math.min(1, 0.4 + 0.6 * p.lag / Math.max(1e-6, p.mg || v * 3)); if (p.dying) adv = Math.max(adv, p.lag * 0.3 * f); p.lag = Math.max(0, p.lag - adv); }
      this.placeRender(p);
      if (p.dying && (p.lag < 0.05 || now - p.dyingAt > 500)) {                         // 죽은 자리에 닿음 → 먹이로
        p.dying = false; this.dropPelletsFrom(p.pts, p.vs, p.vn); this.burst(p.rx, p.ry, 16, p.sup ? '#FFD447' : SL_SKINS[p.skin || 0].c); }
    }
  }
  placeRender(p) {
    const pts = p.pts, n = pts.length;
    if (!n) { p.rx = p.hx; p.ry = p.hy; p.vs = 0; p.vn = 0; p.d0 = 0; p.rt = NaN; return; }
    const hx = p.hx, hy = p.hy, h0 = Math.hypot(pts[0][0] - hx, pts[0][1] - hy);
    let L = p.lag, vs, d0;
    if (L <= h0 || n < 2) { const t = h0 > 1e-6 ? Math.min(1, L / h0) : 0; p.rx = hx + (pts[0][0] - hx) * t; p.ry = hy + (pts[0][1] - hy) * t; vs = 0; d0 = h0 * (1 - t); p.rt = p.headT + (pts[0][2] - p.headT) * t; }
    else { L -= h0; let i = Math.floor(L / SL_SEG); if (i > n - 2) { i = n - 2; L = (n - 1) * SL_SEG; }
      const t = Math.min(1, (L - i * SL_SEG) / SL_SEG), a = pts[i], b = pts[i + 1];
      p.rx = a[0] + (b[0] - a[0]) * t; p.ry = a[1] + (b[1] - a[1]) * t; vs = i + 1; d0 = SL_SEG * (1 - t); p.rt = a[2] + (b[2] - a[2]) * t; }   // rt: 그려진 머리가 그 자리에 있던 시각
    p.vs = vs; p.d0 = d0; p.vn = Math.max(0, Math.min(n - vs, Math.ceil(Math.max(0, p.len - d0) / SL_SEG) + 1));
    let a = p.ang; if (p.lag > 0.05 && vs < n) { const dx = p.rx - pts[vs][0], dy = p.ry - pts[vs][1]; if (dx * dx + dy * dy > 1e-4) a = Math.atan2(dy, dx); }
    p.ma = a;                                                    // 그려진 머리가 지금 가는 방향 (머리끼리 · 박은 쪽 가리기)
    let da = a - p.ra; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; p.ra += da * 0.4;
  }
  // 1등: 살아 있는 뱀 중 (신호의) 길이가 가장 긴 뱀 · 같으면 id 가 앞선 쪽 — 모든 기기가 같은 규칙
  leaderId() {
    let best = null, bl = -1;
    if (!this.isDead) { bl = Math.round(this.len); best = this.myId; }
    for (const id in this.peers) { const p = this.peers[id]; if (!this.alive(p)) continue; const L = Math.round(p.len); if (L > bl || (L === bl && id < best)) { bl = L; best = id; } }
    return best;
  }
  // 머리끼리인가: 두 머리가 서로의 앞쪽(약 ±107°) 안에 있고, 상대 머리가 내 목·몸보다 내 머리에 더 가까움 (반대도)
  //   — 상대 머리가 내 목·옆구리에 닿은 것은 머리끼리가 아님 (그건 상대가 내 몸을 박은 것 → 몸 박기 규칙으로 상대만 탈락)
  headOn(dx, dy, p, R, pr, n) {
    const d = Math.hypot(dx, dy) || 1e-6, ux = dx / d, uy = dy / d, pa = p.ma != null ? p.ma : p.ra;
    if (Math.cos(this.angle) * ux + Math.sin(this.angle) * uy < -SL_ZONE) return false;          // 상대 머리가 내 머리 뒤쪽
    if (-(Math.cos(pa) * ux + Math.sin(pa) * uy) < -SL_ZONE) return false;                       // 내 머리가 상대 머리 뒤쪽
    const t = this.trail, i0 = Math.ceil(R / SL_SEG) + 1;
    if (n > i0 + 1 && slDist(p.rx, p.ry, t, i0, n - i0) < d) return false;                        // 상대 머리가 내 목·몸에 더 가까움
    const j0 = p.vs + Math.max(0, Math.ceil((pr - (p.d0 || 0)) / SL_SEG)) + 1, je = p.vs + p.vn;
    if (je > j0 + 1 && slDist(this.x, this.y, p.pts, j0, je - j0) < d) return false;              // 내 머리가 상대 목·몸에 더 가까움
    return true;
  }
  // 누가 먹나: 보낸 신호의 길이로 비교 (내 길이 = 마지막으로 보낸 길이 · 상대 = 받은 길이) — 같으면 null(튕김)
  //   슈퍼 지렁이 ↔ 1등: 슈퍼가 1등의 길이만큼 먹음(k 'c')
  hhVerdict(id, p) {
    const lead = this.leader, myN = Math.round(this.len), pN = Math.round(p.len);
    if (this.isSuper && !p.sup && id === lead) return { w: 'a', k: 'c', n: pN };
    if (p.sup && !this.isSuper && lead === this.myId) return { w: 'b', k: 'c', n: myN };
    const la = this.sentLen || myN;
    if (la === pN) return null;
    return la > pN ? { w: 'a', k: 'e', n: pN } : { w: 'b', k: 'e', n: myN };
  }
  // 내 화면에서 본 머리끼리 결론을 바로 적용하고 상대(와 모두)에게 알림
  claim(id, p, v, now) {
    const pay = { la: this.life, lb: p.life, ts: Math.round(this.srvNow()), w: v.w, k: v.k, n: v.n, x: Math.round(this.x * 100) / 100, y: Math.round(this.y * 100) / 100, px: Math.round(p.rx * 100) / 100, py: Math.round(p.ry * 100) / 100 };
    p.hhUntil = now + SL_HH;
    this.send('hh', id, pay); this.hhOut[slPairKey(this.myId, this.life, id, p.life)] = { id, pay, at: now };
    this.applyClaim(Object.assign({ by: this.myId, target: id }, pay));
  }
  // 충돌 — 내 머리는 내 기기가, 내 화면에 그려진 그대로만 판정 (이번 프레임에 그릴 상대 위치 = stepPeers 뒤)
  //   ① 머리끼리 후보(두 머리 겹침 + 서로를 향함): 같은 길이로 보이면 나만 튕김, 아니면 상대에게 내 길이를 알림('hh') — 결과는 상대 답('hhr')으로만
  //   ② 몸 박기: 내 머리가 그려진 상대(머리·몸)와 반지름 합의 0.8배 안으로 겹치고, 그 겹친 곳으로 내가 가고 있을 때만 탈락
  //      — 상대 머리가 내 몸을 박는 중(내 화면)이면 그동안(+0.3초) 그 친구에게는 안 죽음 · 머리끼리 답을 기다리는 중 · 유령에는 안 죽음
  collide(R, now) {
    // 머리끼리 결론 다시 보내기: 0.6초 뒤 한 번 (사건이 빠져도 상대가 받게 · 같은 결론이라 두 번 받아도 한 번만 적용)
    for (const k in this.hhOut) { const o = this.hhOut[k]; if (now - o.at >= 600) { delete this.hhOut[k]; const st = this.hhPairs[k]; if (st && st.c && st.c.ts === o.pay.ts && st.c.by === this.myId) this.send('hh', o.id, o.pay); } }
    const lead = this.leader, ca = Math.cos(this.angle), sa = Math.sin(this.angle), t = this.trail, n = Math.min(t.length, Math.ceil(this.len / SL_SEG) + 1);
    for (const id in this.peers) { const p = this.peers[id]; if (!this.live(p) || p.dying) { p.hitAt = 0; continue; }   // 유령·쓰러짐 → 기다리던 닿음도 취소
      const pr = SlitherGame.radiusOf(p.len), rs = R + pr, dx = p.rx - this.x, dy = p.ry - this.y, d2 = dx * dx + dy * dy, reach = Math.max(p.len, this.len) + rs + 2;
      if (d2 > reach * reach) continue;
      const pa = p.ma != null ? p.ma : p.ra;
      const i0 = Math.min(n - 1, Math.ceil(R / SL_SEG) + 1);
      // 머리끼리 (넉넉하게): 두 머리 원이 (반지름 합 × 1.3) 안 + 목·옆구리가 아니라 머리끼리 → 내 화면에서 바로 결론
      { const hr = rs * SL_HHR;
        if (this.invul <= 0 && !p.inv && d2 < hr * hr && !(p.hhUntil > now) && !this.hhPairs[slPairKey(this.myId, this.life, id, p.life)] && this.headOn(dx, dy, p, R, pr, n)) {
          p.hhStart = now; const v = this.hhVerdict(id, p);
          if (!v) { this.angle = Math.atan2(-dy, -dx); p.hhUntil = now + 900; this.toast(slJosa(p.name || '친구', '과', '와') + ' 길이가 같아 튕겨 나왔어요', '#4CC9F0'); }   // 같은 길이: 나만 튕김
          else { this.claim(id, p, v, now); if (this.isDead) return; continue; }
        } }
      // 머리끼리 중: 아직 서로 겹쳐 있으면 떨어질 때까지(최대 3초) 이 친구와는 몸 판정 쉼
      if (p.hhUntil > now - 200 && now - p.hhStart < 3000 && slNear(this.x, this.y, rs, p.rx, p.ry, p.pts, p.vs, p.vn)) p.hhUntil = Math.max(p.hhUntil, now + 200);
      if (this.invul > 0 || p.hhUntil > now || (this.isSuper && id === lead)) { p.hitAt = 0; continue; }   // 슈퍼는 1등 몸에 안 죽음
      // 몸 박기 — '누가 먼저 그 자리에 있었나'(마디가 놓인 서버 시각)로 가림. 여유(SL_MARGIN) 안이면 둘 다 삼
      //   내 머리가 그려진 상대 몸·머리에 닿음(0.8배 겹침 · 내가 그쪽으로 감) + 상대 마디가 그 자리에 먼저 놓였을 때만 내가 박은 것
      //   (상대 머리가 내 몸에 닿는 것으로는 절대 안 죽음 — 박은 쪽 기기가 자기 화면에서 판정)
      if (!p.hitAt) {
        const sNow = this.srvNow();
        // 꼬리 끝은 그려진 모습이 실제보다 (그려진 머리가 늦은 만큼) 길게 남아 있음 → 그만큼은 빼고 판정
        const h1 = slHitT(this.x, this.y, rs * SL_HIT, ca, sa, p.rx, p.ry, p.rt, p.pts, p.vs, Math.max(0, p.vn - Math.ceil(p.lag / SL_SEG)), null);
        // 시각은 '닿은 그 점'에서 비교: 내 머리가 그 점에 닿는 시각 = 지금 + (그 점까지 앞쪽 거리 ÷ 내 속도)
        if (h1) { const vme = SL_SPEED * (this.boost && this.len > 8 ? 1.7 : 1) / 16.7, myT = sNow + Math.max(0, (h1.x - this.x) * ca + (h1.y - this.y) * sa) / vme;
          if (h1.t < myT - SL_MARGIN) { p.hitAt = now; p.hitX = this.x; p.hitY = this.y; p.hitSeq = this.seq; } }
        if (p.hitAt) { p.hitLife = p.life; p.myLife = this.life; }                    // 확인 시간(0.35초) 동안 그 친구가 이미 쓰러졌다는 소식이 오면 안 죽음
      }
      if (p.hitAt && now - p.hitAt > SL_CONFIRM + 100) p.hitAt = 0;                 // 오래된 닿음(그사이 판정을 쉼) → 버림
      if (p.hitAt && now - p.hitAt >= SL_CONFIRM) {                                  // 확인 시간 끝: 닿은 그 자리가 지금도 그려진 몸과 겹치면 그 자리에서 쓰러짐
        const ok = p.hitLife === p.life && p.myLife === this.life && slNear(p.hitX, p.hitY, rs * SL_HIT, p.rx, p.ry, p.pts, p.vs, p.vn); p.hitAt = 0;
        if (ok) { const k = this.seq - p.hitSeq; if (k > 0 && k < this.trail.length - 2) { this.trail.splice(0, k); this.seq -= k; } this.x = p.hitX; this.y = p.hitY;
          this.die((p.name || '친구') + ' 몸에 닿았어요', id, 'body', false, true); return; }
      }
    }
  }
  // 1초마다: 겹친 겉모습 바꾸기 · 오래된 기록 지우기
  housekeep(now) {
    const used = {}; let clash = false;
    for (const id in this.peers) { const p = this.peers[id]; if (now - p.seen > 6000) continue; used[p.skin] = 1; if (p.skin === this.skin && id < this.myId) clash = true; }
    if (clash) { for (let k = 0; k < SL_SKINS.length; k++) if (!used[k]) { this.skin = k; break; } }
    for (const k in this.noted) if (now - this.noted[k] > 20000) delete this.noted[k];
    for (const k in this.hhPairs) if (now - this.hhPairs[k].at > 30000) delete this.hhPairs[k];
    for (const k in this.deathTs) if (+k < this.life - 5) delete this.deathTs[k];
    // 지우는 경우는 둘뿐: 명단에서 빠지고 3초 넘게 신호 없음(나감) · 신호 없이 20초
    for (const id in this.peers) { const p = this.peers[id]; if (now - p.seen > SL_DROP) delete this.peers[id]; else if (p.left && now - p.left > 3000 && now - p.seen > 3000) { this.leftPeers[id] = p; delete this.peers[id]; } }
    for (const id in this.leftPeers) if (now - this.leftPeers[id].seen > SL_DROP) delete this.leftPeers[id];   // 나간 친구 몸은 20초 동안 보관 (다시 들어오면 그 자리에서 바로 이어 그림)
    if (this.labels.size > 300) this.labels.clear();
  }

  // 교사 화면 미니 보드 (30×30) — 뱀마다 비슷한 색, 나는 흰색, 슈퍼는 금색
  getSnapshot() {
    const N = 30, g = []; for (let y = 0; y < N; y++) { g.push([]); for (let x = 0; x < N; x++) { const wx = (x + .5) / N * 2 * this.R - this.R, wy = (y + .5) / N * 2 * this.R - this.R; g[y].push(Math.hypot(wx, wy) > this.R ? 63 : 66); } }
    const put = (x, y, v) => { const gx = Math.floor((x + this.R) / (2 * this.R) * N), gy = Math.floor((y + this.R) / (2 * this.R) * N); if (g[gy] && g[gy][gx] != null) g[gy][gx] = v; };
    for (const id in this.peers) { const p = this.peers[id]; if (!this.alive(p)) continue; const v = p.sup ? 39 : slCellCode(p.skin);
      for (let i = p.vs, e = p.vs + p.vn; i < e; i += 2) put(p.pts[i][0], p.pts[i][1], v); put(p.rx, p.ry, v); }
    if (!this.isDead) { const v = this.isSuper ? 39 : 22, n = Math.min(this.trail.length, Math.ceil(this.len / SL_SEG)); for (let i = 0; i < n; i += 2) put(this.trail[i][0], this.trail[i][1], v); put(this.x, this.y, v); }
    return g;
  }

  // ── 그리기 ──
  draw() {
    const ctx = this.ctx, cs = this.cellSize, W = this.canvas.clientWidth || this.canvas.width, H = this.canvas.clientHeight || this.canvas.height, now = this.now || 0;   // CSS 픽셀 기준
    const dpr = this.canvas.width / W || 1, q = this.quality;
    // 카메라: 내 머리 중심 (죽었으면 마지막 위치)
    const camX = this.x, camY = this.y;
    const zoom = Math.max(0.6, 1 - Math.min(0.4, this.len / 400));         // 커질수록 살짝 멀어짐
    const sc = cs * zoom, ox = W / 2 - camX * sc, oy = H / 2 - camY * sc;
    // 배경 (그라데이션은 크기가 바뀔 때만 새로 만듦)
    //   실제 화소 크기로 한 번 구워 두고 1:1 로 찍음 (늘려 찍기·매번 그라데이션보다 10배 이상 가벼움)
    const PW = this.canvas.width, PH = this.canvas.height;
    if (!this.bgCache || this.bgCache.w !== PW || this.bgCache.h !== PH || this.bgCache.th !== this.theme) {
      const c = document.createElement('canvas'); c.width = Math.max(1, PW); c.height = Math.max(1, PH); const g = c.getContext('2d');
      const bg = g.createRadialGradient(c.width / 2, c.height / 2, 0, c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.7); bg.addColorStop(0, this.theme.bg[0]); bg.addColorStop(1, this.theme.bg[1]); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
      this.bgCache = { cv: c, w: PW, h: PH, th: this.theme };
    }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(this.bgCache.cv, 0, 0); ctx.restore();
    // 격자: 선 전체를 한 번에
    ctx.strokeStyle = this.theme.grid; ctx.lineWidth = 1; ctx.beginPath();
    const gs = sc * 2, g0x = (ox % gs + gs) % gs, g0y = (oy % gs + gs) % gs;
    for (let x = g0x; x < W; x += gs) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = g0y; y < H; y += gs) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
    // 경기장 경계 — 화면에 들어올 때만
    if (this.R - Math.hypot(camX, camY) < Math.hypot(W, H) / 2 / sc + 7) {
      ctx.strokeStyle = this.theme.edge; ctx.lineWidth = 6; ctx.setLineDash([sc * 0.6, sc * 0.4]); ctx.beginPath(); ctx.arc(ox, oy, this.R * sc, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      const outer = ctx.createRadialGradient(ox, oy, this.R * sc, ox, oy, this.R * sc + sc * 6); outer.addColorStop(0, this.theme.glow); outer.addColorStop(1, 'rgba(255,92,122,0)');
      ctx.fillStyle = outer; ctx.beginPath(); ctx.arc(ox, oy, this.R * sc + sc * 6, 0, Math.PI * 2); ctx.arc(ox, oy, this.R * sc, 0, Math.PI * 2, true); ctx.fill();
    }
    // 먹이: 색마다 한 번 구운 그림을 찍음 (예전: 먹이마다 그라데이션을 새로 만듦)
    { const m = 16, pul = now / 300, pl = this.pellets;
      for (let i = 0; i < pl.length; i++) { const p = pl[i], px = p.x * sc + ox, py = p.y * sc + oy; if (px < -m || py < -m || px > W + m || py > H + m) continue;
        const spr = this.pelletSprite(p.c, p.v, sc, dpr), s = spr.size * (1 + Math.sin(pul + p.ph) * 0.15); ctx.drawImage(spr.cv, px - s / 2, py - s / 2, s, s); } }
    // 뱀들 (작은 순서로 그려 큰 뱀이 위에) — 화면 근처만
    const lead = this.leader, list = [], hw = W / 2 / sc, hh = H / 2 / sc;
    for (const id in this.peers) { const p = this.peers[id];
      if (!this.shown(p)) continue;
      const reach = p.len + 3; if (Math.abs(p.rx - camX) > hw + reach || Math.abs(p.ry - camY) > hh + reach) continue;
      list.push({ x: p.rx, y: p.ry, pts: p.pts, vs: p.vs, vn: p.vn, d0: p.d0, len: p.len, skin: p.sup ? SL_SUPER_SKIN : SL_SKINS[p.skin || 0], ang: p.ra, name: p.name, boost: p.boost, me: false, inv: p.inv, sup: p.sup, lead: id === lead, alpha: p.dying ? 0.45 : (this.ghost(p) ? 0.4 : 1) }); }   // 유령(끊김) → 흐리게 (사라지지 않고 기다림 · 부딪혀도 안 죽음)
    if (!this.isDead) { const t = this.trail;
      list.push({ x: this.x, y: this.y, pts: t, vs: 0, vn: Math.min(t.length, Math.ceil(this.len / SL_SEG) + 1), d0: Math.hypot(t[0][0] - this.x, t[0][1] - this.y), len: this.len, skin: this.isSuper ? SL_SUPER_SKIN : SL_SKINS[this.skin], ang: this.angle, name: this.myName, boost: this.boost && this.len > 8, me: true, inv: this.invul > 0, sup: this.isSuper, lead: lead === this.myId, alpha: 1 }); }
    list.sort((a, b) => a.len - b.len);
    const tags = [];
    for (let i = 0; i < list.length; i++) this.drawSnake(ctx, list[i], sc, ox, oy, W, H, now, dpr, q, tags);
    // 머리 위: 1등 왕관 · 슈퍼 별 · 이름표 (다른 뱀 몸에 가려지지 않게 마지막에)
    for (let i = 0; i < tags.length; i += 3) { const sn = tags[i], hx = tags[i + 1]; let top = tags[i + 2];
      if (sn.sup) { slStar(ctx, hx, top - 9, 9 + Math.sin(now / 160), '#FFD447', '#FFFFFF'); top -= 20; }
      else if (sn.lead) { slCrown(ctx, hx, top - 7, 11, '#FFD447'); top -= 17; }
      if (sn.name) { const lb = this.labelSprite((sn.sup ? '슈퍼 ' : '') + sn.name + ' · ' + Math.round(sn.len), sn.me ? '#FFD166' : sn.sup ? '#FFE58A' : '#FFFFFF', Math.round(Math.max(11, sc * 0.5)), dpr);
        ctx.drawImage(lb.cv, hx - lb.w / 2, top - lb.h + 2, lb.w, lb.h); } }
    if (this.parts.length) FX.drawParts(ctx, this.parts.map(p => ({ x: (p.x - camX) * zoom + W / 2 / cs, y: (p.y - camY) * zoom + H / 2 / cs, l: p.l, c: p.c })), cs, 3);
    this.drawHud(ctx, W, H, now, sc, zoom, ox, oy);
  }
  pelletSprite(c, v, sc, dpr) {
    const key = c + v + '|' + Math.round(sc * 2) + '|' + dpr; let s = this.pelletSpr.get(key); if (s) return s;
    if (this.pelletSpr.size > 120) this.pelletSpr.clear();
    const r = sc * (0.12 + v * 0.05), rg = r * 2.6, S = Math.max(2, Math.ceil(rg * 2 * dpr)), cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const g = cv.getContext('2d'), m = S / 2, k = S / (rg * 2);
    const gr = g.createRadialGradient(m, m, 0, m, m, m); gr.addColorStop(0, c + 'AA'); gr.addColorStop(1, c + '00'); g.fillStyle = gr; g.fillRect(0, 0, S, S);
    g.fillStyle = c; g.beginPath(); g.arc(m, m, r * k, 0, Math.PI * 2); g.fill();
    s = { cv, size: rg * 2 }; this.pelletSpr.set(key, s); return s;
  }
  labelSprite(text, color, size, dpr) {
    const key = text + '|' + color + '|' + size + '|' + dpr; let s = this.labels.get(key); if (s) return s;
    const cv = document.createElement('canvas'), g = cv.getContext('2d'), font = '800 ' + size + 'px Pretendard, sans-serif';
    g.font = font; const w = Math.ceil(g.measureText(text).width) + 8, h = size + 8; cv.width = Math.ceil(w * dpr); cv.height = Math.ceil(h * dpr);
    g.scale(dpr, dpr); g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.strokeText(text, w / 2, h / 2); g.fillStyle = color; g.fillText(text, w / 2, h / 2);
    s = { cv, w, h }; this.labels.set(key, s); return s;
  }
  // 점 무늬: 몸을 따라 r×2.1 간격으로 점 그림을 찍음 (머리에서 재는 위치는 예전 점선과 같음 — 움직이면 점도 함께 흐름)
  //   예전: 길이 0 점선 + 둥근 끝 → 점마다 곡선 도형을 만들어 칠함 — 긴 뱀 8마리 장면에서 칠하기 시간의 약 1/4 (bench8 CPU 4배 느리게: 프레임 126 → 92ms)
  drawDots(ctx, vx, vy, vn, r, dOff, col, dpr, W, H) {
    if (vn < 2) return;
    const P = r * 2.1, rd = r * 0.4, spr = this.dotSprite(col, rd, dpr), S = spr.size;
    let need = ((r - dOff) % P + P) % P;                         // 첫 점까지 남은 거리 (점선 시작 위치 dOff - r 과 같게)
    for (let i = 1; i < vn; i++) { const ax = vx[i - 1], ay = vy[i - 1], ex = vx[i] - ax, ey = vy[i] - ay, L = Math.sqrt(ex * ex + ey * ey);
      if (L < 1e-6) continue; let d = need;
      if ((ax < -S && vx[i] < -S) || (ay < -S && vy[i] < -S) || (ax > W + S && vx[i] > W + S) || (ay > H + S && vy[i] > H + S)) d += Math.max(0, Math.ceil((L - d) / P)) * P;   // 화면 밖 구간은 건너뜀
      while (d <= L) { const t = d / L; ctx.drawImage(spr.cv, ax + ex * t - S / 2, ay + ey * t - S / 2, S, S); d += P; }
      need = d - L; }
  }
  dotSprite(col, rd, dpr) {
    const key = col + '|' + Math.round(rd * 4) + '|' + dpr; let s = this.dotSpr.get(key); if (s) return s;
    if (this.dotSpr.size > 80) this.dotSpr.clear();
    const R = Math.round(rd * 4) / 4, S = Math.max(2, Math.ceil((R * 2 + 2) * dpr)), cv = document.createElement('canvas'); cv.width = S; cv.height = S;
    const g = cv.getContext('2d'); g.fillStyle = col; g.beginPath(); g.arc(S / 2, S / 2, R * dpr, 0, Math.PI * 2); g.fill();
    s = { cv, size: S / dpr }; this.dotSpr.set(key, s); return s;
  }
  drawSnake(ctx, sn, sc, ox, oy, W, H, now, dpr, q, tags) {
    const sk = sn.skin, r = SlitherGame.radiusOf(sn.len) * sc, pts = sn.pts, vs = sn.vs, ve = vs + sn.vn, m = r * 1.6 + 6;
    const hx = sn.x * sc + ox, hy = sn.y * sc + oy;
    // 화면에 드는 구간만 길로 만듦 (머리 = vs-1)
    let i0 = -2, i1 = -2; if (hx > -m && hy > -m && hx < W + m && hy < H + m) { i0 = vs - 1; i1 = vs - 1; }
    for (let i = vs; i < ve; i++) { const X = pts[i][0] * sc + ox, Y = pts[i][1] * sc + oy; if (X > -m && Y > -m && X < W + m && Y < H + m) { if (i0 === -2) i0 = i; i1 = i; } }
    if (i0 === -2) return;
    // 길 만들기: 거의 곧은 구간의 점은 건너뜀 (꺾임이 0.7px 넘을 때만 점을 남김) — 선 그리기 비용은 점 수에 비례
    const first = Math.max(vs - 1, i0 - 1), last = Math.min(ve - 1, i1 + 1), tol = 0.7 / sc, tol2 = tol * tol;
    const path = new Path2D();
    let kx, ky; if (first < vs) { kx = sn.x; ky = sn.y; } else { kx = pts[first][0]; ky = pts[first][1]; }
    path.moveTo(kx * sc + ox, ky * sc + oy);
    const dots = sk.pat === 0, vx = this._vx || (this._vx = []), vy = this._vy || (this._vy = []); let vn = 0;   // 점 무늬: 남긴 꼭짓점(화면 좌표)을 모아 둠
    if (dots) { vx[0] = kx * sc + ox; vy[0] = ky * sc + oy; vn = 1; }
    let dxk = 0, dyk = 0, px = kx, py = ky;                   // 마지막으로 남긴 점에서 나가는 방향
    for (let i = Math.max(vs, first + 1); i <= last; i++) {
      const x = pts[i][0], y = pts[i][1];
      if (dxk === 0 && dyk === 0) { dxk = x - kx; dyk = y - ky; const l = Math.hypot(dxk, dyk) || 1; dxk /= l; dyk /= l; px = x; py = y; continue; }
      const ex = x - kx, ey = y - ky, dev = ex * dyk - ey * dxk;   // 방향선에서 벗어난 거리
      if (dev * dev > tol2) { path.lineTo(px * sc + ox, py * sc + oy); if (dots) { vx[vn] = px * sc + ox; vy[vn++] = py * sc + oy; } kx = px; ky = py; dxk = x - kx; dyk = y - ky; const l = Math.hypot(dxk, dyk) || 1; dxk /= l; dyk /= l; }
      px = x; py = y;
    }
    if (last >= vs && last > first) { path.lineTo(px * sc + ox, py * sc + oy); if (dots) { vx[vn] = px * sc + ox; vy[vn++] = py * sc + oy; } }
    const dOff = first < vs ? 0 : (sn.d0 + (first - vs) * SL_SEG) * sc;     // 무늬가 머리에서 시작하도록
    const bw = Math.max(1.2, r * 0.17), inner = r * 2 - bw * 2;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (sn.alpha < 1) ctx.globalAlpha = sn.alpha;
    if (sn.sup) { ctx.strokeStyle = sk.glow; ctx.lineWidth = r * (3 + 0.5 * Math.sin(now / 140)); ctx.stroke(path); }        // 슈퍼: 금빛 광채
    else if (sn.boost && (q > 0 || sn.me)) {                                                                                              // 부스트 광채: 머리 쪽 60칸만 (예전: 몸 전체 — 길이 2000이면 가장 넓은 층을 화면 가득 한 번 더 칠함)
      const gp = new Path2D(), ge = Math.min(ve, vs + 134); gp.moveTo(hx, hy); for (let i = vs; i < ge; i++) gp.lineTo(pts[i][0] * sc + ox, pts[i][1] * sc + oy);
      ctx.strokeStyle = sk.glow; ctx.lineWidth = r * 2.9; ctx.stroke(gp); }
    ctx.strokeStyle = sk.edge; ctx.lineWidth = r * 2; ctx.stroke(path);                                                    // 테두리 (바깥 = 판정 반지름)
    ctx.strokeStyle = sk.c; ctx.lineWidth = inner; ctx.stroke(path);                                                       // 본색
    // 무늬
    if (dots) this.drawDots(ctx, vx, vy, vn, r, dOff, sk.c2, dpr, W, H);
    else if (sk.pat === 1 || sk.pat === 2) { ctx.lineCap = 'butt'; ctx.setLineDash(sk.pat === 1 ? [r * 0.75, r * 1.3] : [r * 1.25, r * 1.45]); ctx.lineDashOffset = dOff - r * 1.6; ctx.strokeStyle = sk.c2; ctx.lineWidth = inner; ctx.stroke(path); }
    else if (sk.pat === 3) { ctx.strokeStyle = sk.c2; ctx.lineWidth = r * 0.5; ctx.stroke(path); }
    else { ctx.lineCap = 'butt'; ctx.setLineDash([r * 0.7, r * 2.2]); ctx.lineDashOffset = dOff - now * 0.06; ctx.strokeStyle = sk.c2; ctx.lineWidth = inner * 0.8; ctx.stroke(path); }   // 슈퍼: 반짝이 띠가 흐름
    ctx.setLineDash([]); ctx.lineDashOffset = 0; ctx.lineCap = 'round';
    if (q >= 2 || (q >= 1 && sn.me)) { ctx.save(); ctx.translate(0, -r * 0.32); ctx.globalAlpha = 0.42 * sn.alpha; ctx.strokeStyle = sk.hi; ctx.lineWidth = r * 0.42; ctx.stroke(path); ctx.restore(); }   // 윗면 광택
    // 머리: 눈 두 개
    if (i0 === vs - 1) {
      if (sn.inv) { ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(hx, hy, r * 1.6, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
      ctx.fillStyle = sk.c; ctx.beginPath(); ctx.arc(hx, hy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = sk.edge; ctx.lineWidth = bw; ctx.beginPath(); ctx.arc(hx, hy, r - bw / 2, 0, Math.PI * 2); ctx.stroke();
      const ex = Math.cos(sn.ang), ey = Math.sin(sn.ang), nx = -ey, ny = ex;
      for (let sd = -1; sd <= 1; sd += 2) { const exx = hx + ex * r * 0.32 + nx * sd * r * 0.46, eyy = hy + ey * r * 0.32 + ny * sd * r * 0.46;
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(exx, eyy, r * 0.34, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#12161F'; ctx.beginPath(); ctx.arc(exx + ex * r * 0.12, eyy + ey * r * 0.12, r * 0.17, 0, Math.PI * 2); ctx.fill(); }
      tags.push(sn, hx, hy - r - 4);                                                       // 이름표는 모든 몸을 그린 뒤 맨 위에
    }
    if (sn.alpha < 1) ctx.globalAlpha = 1;
  }
  drawHud(ctx, W, H, now, sc, zoom, ox, oy) {
    const cs = this.cellSize, vw = W / cs, vh = H / cs, lead = this.leader, mySkin = SL_SKINS[this.skin];
    // 순위: 모두의 점수(= 지금 길이 · 쓰러져 기다리면 6) — 선생님 화면 · 결과와 같은 숫자 · 같은 규칙
    const everyone = [];
    for (const id in this.peers) { const p = this.peers[id]; if (now - p.seen > 6000 && !this.alive(p)) continue;
      everyone.push({ id, name: p.name || '', s: p.score != null ? p.score : (this.alive(p) ? Math.round(p.len) : SL_RESPAWN_LEN), me: false, sup: p.sup && this.alive(p) }); }
    everyone.push({ id: this.myId, name: this.myName || '', s: this.curScore(), me: true, sup: this.isSuper });
    if (this.gameOver && this.rankList) { everyone.length = 0; this.rankList.forEach(e => everyone.push({ id: e.id, name: e.name, s: e.s, me: e.id === this.myId, sup: false })); }   // 끝난 뒤: 최종 순위
    else everyone.sort(slRankCmp(''));
    const board = everyone.slice(0, 5), myRank = everyone.findIndex(e => e.me) + 1;
    const LX = 62;                                    // 왼쪽 위 뒤로 가기 버튼(←) 자리를 비움
    FX.glass(ctx, LX, 12, 130, 44, 12);
    FX.text(ctx, '길이 ' + this.curScore(), LX + 12, 40, { size: 20, weight: 800, color: this.isSuper ? '#FFD447' : mySkin.c });
    if (everyone.length > 1) FX.text(ctx, myRank + '위', LX + 120, 40, { size: 13, weight: 800, color: lead === this.myId ? '#FFD447' : 'rgba(255,255,255,0.7)', align: 'right' });
    // 순위표: 제목 한 줄 + 최대 5줄. 1등 왕관 · 슈퍼 별
    const lbW = 150, lbX = W - lbW - 12, lbH = 34 + board.length * 20;
    FX.glass(ctx, lbX, 12, lbW, lbH, 12);
    FX.text(ctx, '순위 · ' + everyone.length + '명', lbX + 12, 31, { size: 12, weight: 800, color: 'rgba(255,255,255,0.6)' });
    board.forEach((sn, i) => { const y = 52 + i * 20;
      if (sn.me) { ctx.fillStyle = 'rgba(255,209,102,0.14)'; FX.rr(ctx, lbX + 6, y - 14, lbW - 12, 19, 6); ctx.fill(); }
      FX.text(ctx, (i + 1) + '. ' + (sn.name || '?').slice(0, 6), lbX + 12, y, { size: 13, weight: sn.me ? 800 : 700, color: sn.me ? '#FFD166' : sn.sup ? '#FFE58A' : '#fff' });
      if (i === 0) slCrown(ctx, lbX + lbW - 50, y - 5, 8, '#FFD447'); else if (sn.sup) slStar(ctx, lbX + lbW - 50, y - 5, 6, '#FFD447', '#fff');
      FX.text(ctx, String(sn.s), lbX + lbW - 12, y, { size: 13, weight: 800, color: sn.me ? '#FFD166' : 'rgba(255,255,255,0.85)', align: 'right' }); });
    // 내가 5위 밖이면 맨 아래에 내 순위 한 줄 더
    if (myRank > 5) { const y = 12 + lbH + 18; FX.glass(ctx, lbX, 12 + lbH + 4, lbW, 24, 10, '#FFD166');
      FX.text(ctx, myRank + '. ' + (this.myName || '나').slice(0, 6), lbX + 12, y, { size: 13, weight: 800, color: '#FFD166' });
      FX.text(ctx, String(this.curScore()), lbX + lbW - 12, y, { size: 13, weight: 800, color: '#FFD166', align: 'right' }); }
    // 남은 시간 (시간 제한 게임): 가운데 위 — 좁은 화면이면 길이 카드 아래(미니맵을 그만큼 내림). 마지막 10초는 빨갛게 깜빡이며 크게
    let mmY = 66;
    if (this.endAt > 0) { const left = Math.max(0, Math.ceil(((this.gameOver ? this.endTs : this.endAt) - this.srvNow()) / 1000)), last = left <= 10 && !this.gameOver,
        txt = (last ? '' : '남은 시간 ') + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0'), wide = lbX - (LX + 130) >= 150;
      const pw = last ? 92 : 132, ph = last ? 40 : 30, px = wide ? W / 2 - pw / 2 : LX, py = wide ? 14 : 60, blink = last ? 0.6 + 0.4 * Math.abs(Math.sin(now / 250)) : 1;
      if (!this.gameOver || this.endReason === 'time') {
        ctx.fillStyle = last ? 'rgba(90,8,24,' + (0.75 * blink + 0.15).toFixed(2) + ')' : 'rgba(8,12,24,0.62)'; FX.rr(ctx, px, py, pw, ph, ph / 2); ctx.fill();
        if (last) { ctx.strokeStyle = 'rgba(255,92,122,' + blink.toFixed(2) + ')'; ctx.lineWidth = 2.5; ctx.stroke(); }
        FX.text(ctx, txt, px + pw / 2, py + ph / 2 + (last ? 8 : 5), { size: last ? 24 : 14, weight: 800, color: last ? '#FFE3E8' : '#FFFFFF', align: 'center' });
        if (!wide) mmY = py + ph + 8; } }
    // 미니맵: 왼쪽 위 (길이 카드 아래) — 오른쪽 아래는 부스트 버튼 자리
    { const mr = 46, mx2 = 12 + mr, my2 = mmY + mr; ctx.fillStyle = 'rgba(8,10,16,0.6)'; ctx.beginPath(); ctx.arc(mx2, my2, mr, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(mx2 + this.x / this.R * mr - vw / 2 / zoom / this.R * mr, my2 + this.y / this.R * mr - vh / 2 / zoom / this.R * mr, vw / zoom / this.R * mr, vh / zoom / this.R * mr);
      ctx.strokeStyle = 'rgba(255,92,122,0.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(mx2, my2, mr, 0, Math.PI * 2); ctx.stroke();
      // 모든 뱀 (내 화면 밖 포함) — 각자 색, 큰 뱀일수록 점이 큼
      for (const id in this.peers) { const p = this.peers[id]; if (!this.alive(p)) continue; const px = mx2 + p.rx / this.R * mr, py = my2 + p.ry / this.R * mr;
        if (p.sup) slStar(ctx, px, py, 4.5, '#FFD447', '#fff');
        else { ctx.fillStyle = SL_SKINS[p.skin || 0].c; ctx.beginPath(); ctx.arc(px, py, Math.min(4, 1.4 + Math.sqrt(p.len) * 0.15), 0, Math.PI * 2); ctx.fill(); }
        if (id === lead) { ctx.strokeStyle = '#FFD447'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px, py, 5.5, 0, Math.PI * 2); ctx.stroke(); } }
      if (!this.isDead) { const px = mx2 + this.x / this.R * mr, py = my2 + this.y / this.R * mr; ctx.fillStyle = this.isSuper ? '#FFD447' : mySkin.c; ctx.beginPath(); ctx.arc(px, py, 3.4, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); } }
    // 슈퍼: 남은 시간 + 1등 쪽 화살표 / 1등: 슈퍼가 다가오면 경고
    if (this.isSuper) {
      const left = Math.max(0, Math.ceil((this.superUntil - now) / 1000));
      const oy2 = mmY - 66;                                                            // 남은 시간 칸 때문에 미니맵이 내려갔으면 그만큼
      FX.glass(ctx, 12, 168 + oy2, 176, 46, 12, '#FFD447');
      slStar(ctx, 30, 191 + oy2, 8, '#FFD447', '#fff');
      FX.text(ctx, '슈퍼 지렁이 ' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0'), 44, 188 + oy2, { size: 14, weight: 800, color: '#FFD447' });
      FX.text(ctx, '1등의 머리를 노려요!', 44, 206 + oy2, { size: 11, weight: 700, color: 'rgba(255,255,255,0.8)' });
      const L = lead && lead !== this.myId ? this.peers[lead] : null;
      if (L) this.drawPointer(ctx, W, H, L.rx * sc + ox, L.ry * sc + oy, '#FFD447', '1등 · ' + Math.round(Math.hypot(L.rx - this.x, L.ry - this.y)) + '칸', now);
    } else if (lead === this.myId && !this.isDead) {
      let S = null, sd = 1e9; for (const id in this.peers) { const p = this.peers[id]; if (!p.sup || !this.alive(p)) continue; const d = Math.hypot(p.rx - this.x, p.ry - this.y); if (d < sd) { sd = d; S = p; } }
      if (S && sd < 45) { const blink = 0.55 + 0.45 * Math.sin(now / 120);
        ctx.fillStyle = 'rgba(70,6,20,0.92)'; FX.rr(ctx, W / 2 - 108, 170, 216, 32, 16); ctx.fill();
        ctx.strokeStyle = 'rgba(255,92,122,' + blink.toFixed(2) + ')'; ctx.lineWidth = 2.5; ctx.stroke();
        FX.text(ctx, '슈퍼 지렁이가 다가와요! ' + Math.round(sd) + '칸', W / 2, 191, { size: 13, weight: 800, color: '#FFE3E8', align: 'center' });
        this.drawPointer(ctx, W, H, S.rx * sc + ox, S.ry * sc + oy, '#FF5C7A', '슈퍼', now); }
    }
    if (this.isDead && !this.gameOver) { ctx.fillStyle = 'rgba(8,10,16,0.5)'; ctx.fillRect(0, 0, W, H); FX.text(ctx, '부활까지 ' + Math.ceil((this.deadUntil - now) / 1000), W / 2, H / 2, { size: 30, weight: 800, color: '#fff', align: 'center', baseline: 'middle', shadow: 10 }); FX.text(ctx, '길이 ' + SL_RESPAWN_LEN + '부터 다시 시작해요', W / 2, H / 2 + 34, { size: 15, weight: 700, color: '#FFD166', align: 'center', baseline: 'middle' }); }
    this.toasts.slice(-2).forEach((t, i) => FX.text(ctx, t.text, W / 2, Math.max(H * 0.3, 262) + (this.banner ? 92 : 0) + i * 26, { size: 17, weight: 800, color: t.color, align: 'center', stroke: 'rgba(0,0,0,0.55)', strokeW: 4 }));
    if (this.banner) { const b = this.banner, k = Math.min(1, (now - b.at) / 180), w = Math.min(W - 24, 340), y = Math.max(H * 0.3, 262), lines = b.s ? b.s.split(' · ') : [], bh = 50 + lines.length * 17;
      ctx.save(); ctx.globalAlpha = k; ctx.translate(W / 2, y); ctx.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k);
      ctx.fillStyle = 'rgba(8,12,24,0.88)'; FX.rr(ctx, -w / 2, -30, w, bh, 16); ctx.fill(); FX.glass(ctx, -w / 2, -30, w, bh, 16, b.c);
      FX.text(ctx, b.t, 0, 4, { size: 24, weight: 800, color: b.c, align: 'center' });
      lines.forEach((ln, i) => FX.text(ctx, ln, 0, 28 + i * 17, { size: 12, weight: 700, color: 'rgba(255,255,255,0.88)', align: 'center' }));
      ctx.restore(); }
    if (this.boost && this.len > 8 && !this.isDead) { ctx.strokeStyle = 'rgba(255,209,102,0.35)'; ctx.lineWidth = 8; ctx.strokeRect(4, 4, W - 8, H - 8); }
  }
  // 화면 밖 목표를 가리키는 화살표 (화면 안이면 고리)
  drawPointer(ctx, W, H, sx, sy, col, label, now) {
    const mg = 30, top = 230;
    if (sx > mg && sy > top && sx < W - mg && sy < H - mg) { ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(sx, sy, 26 + 4 * Math.sin(now / 150), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; return; }
    const cx = W / 2, cy = (top + H - mg) / 2, dx = sx - cx, dy = sy - cy, a = Math.atan2(dy, dx);
    const k = Math.min((W / 2 - mg) / Math.max(1e-6, Math.abs(dx)), ((H - mg - top) / 2) / Math.max(1e-6, Math.abs(dy))), ax = cx + dx * k, ay = cy + dy * k;
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(a); ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -10); ctx.lineTo(-3, 0); ctx.lineTo(-8, 10); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
    FX.text(ctx, label, ax - Math.cos(a) * 30, ay - Math.sin(a) * 22 + 4, { size: 12, weight: 800, color: col, align: 'center', stroke: 'rgba(0,0,0,0.6)', strokeW: 3 });
  }
}
// 왕관 (1등) · 별 (슈퍼) 도형
function slCrown(ctx, x, y, s, col) {
  ctx.beginPath(); ctx.moveTo(x - s, y + s * 0.55); ctx.lineTo(x - s, y - s * 0.3); ctx.lineTo(x - s * 0.5, y + s * 0.1); ctx.lineTo(x, y - s * 0.6); ctx.lineTo(x + s * 0.5, y + s * 0.1); ctx.lineTo(x + s, y - s * 0.3); ctx.lineTo(x + s, y + s * 0.55); ctx.closePath();
  ctx.fillStyle = col; ctx.strokeStyle = 'rgba(60,40,0,0.8)'; ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.stroke(); ctx.fill();
}
function slStar(ctx, x, y, r, col, line) {
  ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath();
  ctx.fillStyle = col; ctx.strokeStyle = line || '#fff'; ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.stroke(); ctx.fill();
}
// 교사 미니 보드용: 겉모습 색과 가장 비슷한 공용 색 번호 (shared.js 의 CELL_COLORS 를 그대로 씀)
const _slCode = {};
function slCellCode(k) {
  if (_slCode[k] != null) return _slCode[k];
  const cand = [1, 2, 3, 4, 5, 6, 7, 31, 44, 45, 52, 54, 61, 64, 65, 69], hex = SL_SKINS[k % SL_SKINS.length].c, rgb = h => [1, 3, 5].map(i => parseInt(String(h).slice(i, i + 2), 16));
  let best = 68, bd = 1e9; if (typeof CELL_COLORS !== 'undefined') { const a = rgb(hex); cand.forEach(c => { const b = rgb(CELL_COLORS[c]); if (b.some(isNaN)) return; const d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2; if (d < bd) { bd = d; best = c; } }); }
  return (_slCode[k] = best);
}
