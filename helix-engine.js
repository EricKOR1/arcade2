// 나선 탑 내려가기 — 통통 튀는 공 아래로 탑을 좌우로 돌려 원판의 빈 틈으로 떨어뜨려요. 빨간 조각에 닿으면 끝.
//   층을 지날 때마다 점수 · 한 번에 3층 이상 떨어지면 '불꽃 공'이 되어 다음 판(빨간 조각도)을 부수고 지나감 · 바닥 목표판에 닿으면 다음 단계
//   (하이퍼캐주얼 '나선 탑' 장르를 학교용으로 새로 만든 것 — 이름·그림은 모두 새로 그림)

const HX_COLS = 9, HX_ROWS = 16, HX_SEG = 12, HX_SA = Math.PI * 2 / HX_SEG;
const HX_GAP = 3.0;              // 층 사이 높이 (칸)
const HX_R = 3.85, HX_r = 0.85;  // 원판 바깥·안쪽(기둥) 반지름 (칸)
const HX_TILT = 0.34, HX_TH = 0.38, HX_BALL = 0.36;
const HX_MID = (HX_R + HX_r) / 2 + 0.2;   // 공이 튀는 자리 (기둥에서 떨어진 거리)
const HX_FRONT = Math.PI / 2;             // 공은 늘 화면 앞쪽 (아래쪽 타원 위)
const HX_G = 0.0135, HX_BOUNCE = 0.235, HX_VMAX = 0.42;
// 단계 색 테마: 판 색 · 배경 위/아래 · 기둥 · 미니보드 번호
const HX_THEMES = [
  { p: '#4CC9F0', b1: '#20356E', b2: '#0D1534', col: '#E9EEF8', n: 1 },
  { p: '#B15DFF', b1: '#3A2066', b2: '#140B2C', col: '#F3E9FF', n: 6 },
  { p: '#06D6A0', b1: '#114D4A', b2: '#06201F', col: '#E6FFF7', n: 5 },
  { p: '#FFD166', b1: '#5A3A1C', b2: '#21130A', col: '#FFF6E2', n: 4 },
  { p: '#4361EE', b1: '#1C2A6B', b2: '#0A0F2B', col: '#E8ECFF', n: 2 },
  { p: '#F79824', b1: '#5B2A12', b2: '#200C05', col: '#FFF0E2', n: 10 }
];

class HelixGame {
  constructor(canvas, cellSize) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.cellSize = cellSize;
    this.score = 0; this.gameOver = false; this.level = 1; this.floorsPassed = 0; this.bestStreak = 0; this.smashes = 0;
    this.lastTime = 0; this.now = 0; this.t = 0;
    this.shards = []; this.parts = []; this.pops = []; this.trail = [];
    this.drag = null; this.clearT = 0; this.squash = 0; this.hitFlash = 0; this.introT = 3.2;
    this.buildStage();
  }
  // ── 단계 만들기 ── 층 수·위험 조각이 단계마다 늘어남. 모든 층에 틈이 있고, 틈 바로 아래를 빨강이 다 막지 않게
  buildStage() {
    const L = this.level, n = Math.min(26, 9 + L * 3);
    this.theme = HX_THEMES[(L - 1) % HX_THEMES.length];
    this.floors = []; let prevGap = null;
    for (let i = 0; i < n; i++) {
      const seg = new Array(HX_SEG).fill(1);
      const gw = L <= 2 ? 2 + (Math.random() < 0.4 ? 1 : 0) : 2;
      let g0 = Math.floor(Math.random() * HX_SEG);
      if (i === 0) g0 = 5 + Math.floor(Math.random() * 4);              // 첫 층: 공 바로 아래(앞쪽 3번 조각)는 판
      for (let k = 0; k < gw; k++) seg[(g0 + k) % HX_SEG] = 0;
      // 위험 조각 수: 단계가 오를수록 많이 (첫 층은 없음)
      let nd = 0;
      if (i > 0) { const base = Math.min(4, 0.6 + L * 0.55); nd = Math.floor(base + Math.random() * 1.4); if (L === 1 && Math.random() < 0.35) nd = 0; }
      const safe = new Set();
      if (prevGap) prevGap.forEach(k => safe.add(k));                     // 윗층 틈 바로 아래
      for (let t = 0, put = 0; t < 40 && put < nd; t++) {
        const k = Math.floor(Math.random() * HX_SEG);
        if (seg[k] !== 1) continue;
        // 윗층 틈 아래는 최소 한 칸 이상 남기기 (틈 아래 전부가 빨강이 되지 않게)
        if (safe.has(k) && [...safe].filter(j => j !== k && seg[j] !== 2).length < 1) continue;
        if (safe.has(k) && Math.random() < 0.6) continue;
        seg[k] = 2; put++;
      }
      if (i === 0) for (let k = 0; k < HX_SEG; k++) if (seg[k] === 2) seg[k] = 1;
      this.floors.push({ y: HX_GAP * (i + 1), seg, broken: false, splats: [], goal: false, flash: 0 });
      prevGap = []; for (let k = 0; k < HX_SEG; k++) if (seg[k] === 0) prevGap.push(k);
    }
    // 바닥 목표판 (틈 없는 꽉 찬 판)
    this.floors.push({ y: HX_GAP * (n + 1), seg: new Array(HX_SEG).fill(3), broken: false, splats: [], goal: true, flash: 0 });
    this.total = n; this.passed = 0;
    // 첫 층 앞쪽이 판이 되도록 시작 각도
    this.rot = 0; this.rotTarget = 0;
    this.ball = { y: 0.2, vy: 0 }; this.streak = 0; this.fire = false;
    this.camY = 0; this.next = 0;
  }
  // ── 조작 ──
  segAt(rot) { let a = (HX_FRONT - rot) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return Math.floor(a / HX_SA) % HX_SEG; }
  move(d) { if (this.gameOver) return; this.rotTarget -= d * HX_SA; if (window.Sound) Sound.move(); }
  rotate() {} softDrop() {} hardDrop() {} up() {} down() {}
  pointer(type, x, y) {
    if (this.gameOver) return;
    if (type === 'down') { this.drag = { x }; return; }
    if (!this.drag) return;
    if (type === 'move') { const dx = x - this.drag.x; this.rotTarget -= dx * 0.62; this.drag.x = x; }   // 손가락 이동량에 비례
    if (type === 'up') this.drag = null;
  }
  // ── 진행 ──
  tick(now) {
    const { dt, f } = FX.frame(this, now); this.t += dt / 1000;
    this.introT = Math.max(0, this.introT - dt / 1000);
    // 탑 회전: 목표 각도로 부드럽게
    this.rot += (this.rotTarget - this.rot) * Math.min(1, 0.32 * f);
    if (!this.gameOver && this.clearT <= 0) {
      const steps = Math.max(1, Math.ceil(f * 2));
      for (let s = 0; s < steps && !this.gameOver && this.clearT <= 0; s++) this.physics(f / steps);
    } else if (this.clearT > 0) { this.clearT -= f; if (this.clearT <= 0) { this.level++; this.buildStage(); if (window.Sound) Sound.start && Sound.start(); } }
    // 카메라: 공을 따라 아래로만
    const want = this.ball.y - 4.6; if (want > this.camY) this.camY += (want - this.camY) * Math.min(1, 0.18 * f);
    // 효과
    this.squash *= Math.pow(0.82, f); this.hitFlash = Math.max(0, this.hitFlash - 0.04 * f);
    for (const fl of this.floors) if (fl.flash > 0) fl.flash = Math.max(0, fl.flash - 0.06 * f);
    for (let i = this.shards.length - 1; i >= 0; i--) { const p = this.shards[i];
      p.x += p.vx * f; p.y += p.vy * f; p.vy += 0.012 * f; p.a += p.va * f; p.l -= 0.034 * f; if (p.l <= 0) this.shards.splice(i, 1); }
    this.parts = FX.stepParts(this.parts, f, 0.04);
    for (let i = this.pops.length - 1; i >= 0; i--) if ((this.pops[i].t -= 0.022 * f) <= 0) this.pops.splice(i, 1);
    if (this.fire || this.ball.vy > 0.2) { this.trail.push({ y: this.ball.y, l: 1 }); if (this.trail.length > 14) this.trail.shift(); }
    for (const tr of this.trail) tr.l -= 0.09 * f; while (this.trail.length && this.trail[0].l <= 0) this.trail.shift();
    this.draw();
  }
  physics(f) {
    const b = this.ball, prev = b.y;
    b.vy = Math.min(HX_VMAX, b.vy + HX_G * f); b.y += b.vy * f;
    if (b.vy <= 0) return;
    // 다음으로 만날 층 (아직 안 깨진 것)
    while (this.next < this.floors.length && this.floors[this.next].broken) this.next++;
    const fl = this.floors[this.next]; if (!fl || !(prev <= fl.y && b.y >= fl.y)) return;
    const k = this.segAt(this.rot), v = fl.seg[k];
    if (fl.goal) { b.y = fl.y; this.land(fl, k); this.stageClear(fl); return; }
    if (v === 0) { this.passFloor(fl, false); return; }                       // 틈으로 통과
    if (this.fire) { this.passFloor(fl, true); b.vy = Math.min(b.vy, 0.18); return; }   // 불꽃 공: 부수고 지나감
    b.y = fl.y;
    if (v === 2) { this.die(fl, k); return; }
    this.land(fl, k); b.vy = -HX_BOUNCE;
  }
  land(fl, k) {
    this.streak = 0; this.squash = 1;
    const a = (k + 0.5) * HX_SA + (Math.random() - 0.5) * 0.3;
    fl.splats.push({ a, s: 0.7 + Math.random() * 0.5 }); if (fl.splats.length > 4) fl.splats.shift();
    for (let i = 0; i < 6; i++) { const ang = Math.PI + Math.random() * Math.PI;
      this.parts.push({ x: HX_COLS / 2 + Math.cos(ang) * 0.1, y: this.ball.y, vx: Math.cos(ang) * 0.06, vy: Math.sin(ang) * 0.06, g: 0.008, l: 0.8, c: this.theme.col, w: true }); }
    if (window.Sound) { if (Sound.note) Sound.note(330 + Math.random() * 30, 0.06, 'sine', 0.18); else if (Sound.land) Sound.land(0.2); }
  }
  passFloor(fl, smash) {
    fl.broken = true; this.passed++; this.floorsPassed++;
    this.streak++; this.bestStreak = Math.max(this.bestStreak, this.streak);
    const gain = this.level * Math.min(10, Math.max(1, this.streak)) + (smash ? 5 * this.level : 0);
    this.score += gain;
    this.pops.push({ y: fl.y, t: 1, txt: '+' + gain, c: smash ? '#FF9F43' : '#FFE38A' });
    this.shatter(fl);
    if (smash) { this.fire = false; this.streak = 0; this.smashes++; this.hitFlash = 0.5;
      for (let i = 0; i < 16; i++) { const a = Math.random() * Math.PI * 2; this.parts.push({ x: HX_COLS / 2, y: fl.y, vx: Math.cos(a) * 0.13, vy: Math.sin(a) * 0.08 - 0.03, g: 0.006, l: 1, c: i % 2 ? '#FF9F43' : '#FFE066' }); }
      if (window.Sound) Sound.explosion ? Sound.explosion() : Sound.crash && Sound.crash();
    } else if (window.Sound) { if (Sound.note) Sound.note(520 + Math.min(8, this.streak) * 70, 0.08, 'triangle', 0.2); else if (Sound.pass) Sound.pass(); }
    if (!smash && this.streak >= 3 && !this.fire) { this.fire = true; this.pops.push({ y: fl.y + 0.8, t: 1.3, txt: '불꽃 공!', c: '#FF7A3D' }); if (window.Sound && Sound.item) Sound.item(); }
  }
  // 지나간 원판이 조각나 흩어짐 (판 하나에 조각 최대 ~14개)
  shatter(fl) {
    for (let k = 0; k < HX_SEG; k++) { const v = fl.seg[k]; if (!v) continue;
      const a = (k + 0.5) * HX_SA + this.rot, c = Math.cos(a), s = Math.sin(a), rr = HX_MID;
      if (this.shards.length > 90) this.shards.shift();
      this.shards.push({ x: HX_COLS / 2 + c * rr, y: fl.y + s * rr * HX_TILT, vx: c * (0.07 + Math.random() * 0.05), vy: -0.05 - Math.random() * 0.05 + s * 0.02,
        a: Math.random() * 6, va: (Math.random() - 0.5) * 0.3, l: 1, c: v === 2 ? '#EF2D56' : this.theme.p, w: 0.9 + Math.random() * 0.5 }); }
  }
  die(fl, k) {
    this.gameOver = true; this.hitFlash = 1; this.squash = 1; fl.flash = 1;
    for (let i = 0; i < 14; i++) { const a = Math.PI + Math.random() * Math.PI; this.parts.push({ x: HX_COLS / 2, y: this.ball.y, vx: Math.cos(a) * 0.1, vy: Math.sin(a) * 0.08, g: 0.01, l: 1, c: i % 2 ? '#EF2D56' : '#fff' }); }
    if (window.Sound) { Sound.crash && Sound.crash(); Sound.gameOver && Sound.gameOver(); }
  }
  stageClear(fl) {
    this.ball.vy = 0; this.clearT = 75; fl.flash = 1; this.score += 20 * this.level; this.streak = 0; this.fire = false;
    this.pops.push({ y: fl.y - 0.5, t: 1.4, txt: '단계 완료! +' + 20 * this.level, c: '#7CFFB2' });
    for (let i = 0; i < 24; i++) { const a = Math.random() * Math.PI * 2; this.parts.push({ x: HX_COLS / 2, y: fl.y, vx: Math.cos(a) * 0.12, vy: Math.sin(a) * 0.06 - 0.06, g: 0.005, l: 1.2, c: ['#FFD166', '#06D6A0', '#4CC9F0', '#B15DFF'][i % 4] }); }
    if (window.Sound) Sound.levelUp && Sound.levelUp();
  }
  // ── 교사 미니보드: 지금 화면을 대충 줄인 모양 ──
  getSnapshot() {
    const out = []; const cx = HX_COLS / 2;
    for (let r = 0; r < HX_ROWS; r++) { const row = []; for (let c = 0; c < HX_COLS; c++) row.push(this.snapCell(c + 0.5, r + 0.5, cx)); out.push(row); }
    const by = Math.floor(this.ball.y - this.camY + HX_MID * HX_TILT + 1.2 - HX_BALL), bx = Math.floor(cx);
    if (by >= 0 && by < HX_ROWS) out[by][bx] = 22;
    return out;
  }
  snapCell(px, py, cx) {
    for (let i = 0; i < this.floors.length; i++) { const fl = this.floors[i]; if (fl.broken) continue;
      const fy = fl.y - this.camY + 1.2, dx = px - cx, dy = (py - fy) / HX_TILT, d = Math.hypot(dx, dy);
      if (d >= HX_r && d <= HX_R + 0.3) { let a = Math.atan2(dy, dx) - this.rot; a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const v = fl.seg[Math.floor(a / HX_SA) % HX_SEG]; if (v === 0) continue; return v === 2 ? 11 : v === 3 ? 23 : this.theme.n; }
      if (Math.abs(dx) < HX_r && py < fy) return 21;
    }
    return 0;
  }
  // ── 그리기 ──
  draw() {
    const ctx = this.ctx, cs = this.cellSize, W = cs * HX_COLS, H = cs * HX_ROWS, th = this.theme, cx = W / 2, top = 1.2;
    const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, th.b1); bg.addColorStop(1, th.b2); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    // 배경 빛 띠
    ctx.fillStyle = 'rgba(255,255,255,0.035)'; ctx.fillRect(cx - HX_R * cs * 1.05, 0, HX_R * cs * 2.1, H);
    const sy = wy => (wy - this.camY + top) * cs;
    const rX = HX_R * cs, rY = HX_R * HX_TILT * cs, pX = HX_r * cs, pY = HX_r * HX_TILT * cs, T = HX_TH * cs;
    // 보이는 층 (아래 → 위 순서로 그려 위층이 앞을 덮음)
    let lo = this.floors.length - 1; while (lo > 0 && sy(this.floors[lo].y) - rY > H + cs) lo--;
    let ballDrawn = false;
    for (let i = lo; i >= 0; i--) {
      const fl = this.floors[i], fy = sy(fl.y);
      if (fy + rY + T < -cs * 2) break;
      // 이 층보다 공이 아래에 있으면, 이 층 그리기 전에 공을 그림 (위층이 공을 덮음)
      if (!ballDrawn && this.ball.y > fl.y + 0.01) { this.drawBall(ctx, cs, cx, sy); ballDrawn = true; }
      const prevY = i > 0 ? sy(this.floors[i - 1].y) : -cs * 3;
      if (!fl.broken) this.drawFloor(ctx, fl, cx, fy, rX, rY, pX, pY, T, cs);
      // 이 층 위쪽 기둥 (윗층까지)
      this.drawPillar(ctx, cx, i > 0 ? prevY : fy - cs * 2.2, fy, pX, pY, th, i === 0);
    }
    if (!ballDrawn) this.drawBall(ctx, cs, cx, sy);
    // 흩어지는 조각
    for (const p of this.shards) { ctx.globalAlpha = Math.max(0, p.l); ctx.save(); ctx.translate(p.x * cs, sy(p.y)); ctx.rotate(p.a);
      const w = p.w * cs * 0.6, h = cs * 0.26; ctx.fillStyle = p.c; FX.rr(ctx, -w / 2, -h / 2, w, h, h * 0.35); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(-w / 2 + 2, -h / 2 + 1, w - 4, h * 0.3); ctx.restore(); }
    ctx.globalAlpha = 1;
    for (const p of this.parts) { ctx.globalAlpha = Math.max(0, Math.min(1, p.l)); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x * cs, sy(p.y) + HX_MID * HX_TILT * cs, cs * (p.w ? 0.07 : 0.1), 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    // 점수 팝업
    for (const p of this.pops) { ctx.globalAlpha = Math.min(1, p.t * 1.5);
      FX.text(ctx, p.txt, cx + cs * 1.8, sy(p.y) - (1 - Math.min(1, p.t)) * cs * 1.5, { size: cs * 0.5, weight: 900, color: p.c, align: 'center', stroke: 'rgba(20,10,0,.8)' }); }
    ctx.globalAlpha = 1;
    if (this.hitFlash > 0) { ctx.fillStyle = (this.gameOver ? 'rgba(255,60,80,' : 'rgba(255,170,80,') + (this.hitFlash * 0.25).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
    this.drawHud(ctx, cs, W, H);
  }
  drawPillar(ctx, cx, y0, y1, pX, pY, th, last) {
    const g = ctx.createLinearGradient(cx - pX, 0, cx + pX, 0);
    g.addColorStop(0, FX.tint(th.col, -0.35)); g.addColorStop(0.35, th.col); g.addColorStop(1, FX.tint(th.col, -0.45));
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx - pX, y0); ctx.lineTo(cx - pX, y1);
    ctx.ellipse(cx, y1, pX, pY, 0, Math.PI, 0, true); ctx.lineTo(cx + pX, y0); ctx.closePath(); ctx.fill();
    if (last) { ctx.fillStyle = FX.tint(th.col, 0.3); ctx.beginPath(); ctx.ellipse(cx, y0, pX, pY, 0, 0, 7); ctx.fill(); }   // 탑 꼭대기 뚜껑
  }
  // 원판 한 장: 조각마다 옆면(앞쪽만) + 윗면, 뒤쪽 조각부터
  drawFloor(ctx, fl, cx, fy, rX, rY, pX, pY, T, cs) {
    const th = this.theme, order = HelixGame._order || (HelixGame._order = []);
    order.length = 0; for (let k = 0; k < HX_SEG; k++) if (fl.seg[k]) order.push(k);
    const depth = k => Math.sin((k + 0.5) * HX_SA + this.rot);
    order.sort((a, b) => depth(a) - depth(b));
    const fl2 = fl.flash;
    for (const k of order) {
      const v = fl.seg[k], a0 = k * HX_SA + this.rot, a1 = a0 + HX_SA;
      const base = v === 2 ? '#EF2D56' : v === 3 ? '#FFD166' : th.p;
      const side = FX.tint(base, -0.38), topC = FX.tint(base, 0.08 + 0.12 * depth(k) * 0.5);
      // 옆면 (앞을 향한 부분만 보임)
      if (Math.sin(a0) > -0.05 || Math.sin(a1) > -0.05) {
        const s0 = Math.max(a0, this.frontFrom(a0, a1)[0]), s1 = this.frontFrom(a0, a1)[1];
        if (s1 > s0) { ctx.fillStyle = side; ctx.beginPath(); ctx.ellipse(cx, fy, rX, rY, 0, s0, s1, false); ctx.ellipse(cx, fy + T, rX, rY, 0, s1, s0, true); ctx.closePath(); ctx.fill(); }
      }
      // 윗면
      const g = ctx.createLinearGradient(0, fy - rY, 0, fy + rY); g.addColorStop(0, FX.tint(topC, -0.12)); g.addColorStop(1, FX.tint(topC, 0.15));
      ctx.fillStyle = fl2 > 0 ? FX.tint(base, 0.5 * fl2) : g;
      ctx.beginPath(); ctx.ellipse(cx, fy, rX, rY, 0, a0, a1, false); ctx.ellipse(cx, fy, pX, pY, 0, a1, a0, true); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1; ctx.stroke();
      if (v === 2) { // 위험 조각: 줄무늬 광택
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = Math.max(1, cs * 0.05); ctx.beginPath();
        ctx.ellipse(cx, fy, (HX_R - 0.35) * cs, (HX_R - 0.35) * HX_TILT * cs, 0, a0 + 0.08, a1 - 0.08); ctx.stroke(); }
    }
    // 공 자국
    for (const sp of fl.splats) { const a = sp.a + this.rot, k = Math.floor(((sp.a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) / HX_SA) % HX_SEG; if (!fl.seg[k]) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * HX_MID * cs, fy + Math.sin(a) * HX_MID * HX_TILT * cs, cs * 0.28 * sp.s, cs * 0.12 * sp.s, 0, 0, 7); ctx.fill(); }
    if (fl.goal) FX.text(ctx, '목표', cx, fy + rY * 0.72 + cs * 0.15, { size: cs * 0.42, weight: 900, color: '#5A3A00', align: 'center' });
  }
  // 조각 각도 범위 중 앞쪽(sin>0, 즉 0~π)에 걸치는 부분
  frontFrom(a0, a1) {
    const P = Math.PI * 2; let off = Math.floor(a0 / P) * P; let s = a0 - off, e = a1 - off;
    // [s,e] 와 [0,π] 또는 [2π,3π] 의 교집합
    let lo = Math.max(s, 0), hi = Math.min(e, Math.PI);
    if (hi <= lo) { lo = Math.max(s, P); hi = Math.min(e, P + Math.PI); }
    return hi > lo ? [lo + off, hi + off] : [0, -1];
  }
  drawBall(ctx, cs, cx, sy) {
    const b = this.ball, r = HX_BALL * cs, y = sy(b.y) + HX_MID * HX_TILT * cs - r;
    // 꼬리
    for (let i = 0; i < this.trail.length; i++) { const tr = this.trail[i]; ctx.globalAlpha = Math.max(0, tr.l) * 0.35;
      ctx.fillStyle = this.fire ? '#FF8A3D' : '#ffffff'; ctx.beginPath(); ctx.arc(cx, sy(tr.y) + HX_MID * HX_TILT * cs - r, r * (0.4 + 0.5 * tr.l), 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    // 그림자 (공 아래 판 위)
    const sq = this.squash, sx = 1 + sq * 0.28, syk = 1 - sq * 0.3;
    if (this.fire) { const gl = ctx.createRadialGradient(cx, y, r * 0.5, cx, y, r * 2.2); gl.addColorStop(0, 'rgba(255,140,60,0.55)'); gl.addColorStop(1, 'rgba(255,80,40,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(cx, y, r * 2.2, 0, 7); ctx.fill(); }
    ctx.save(); ctx.translate(cx, y + r * (1 - syk)); ctx.scale(sx, syk);
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    if (this.fire) { g.addColorStop(0, '#FFF3B0'); g.addColorStop(0.5, '#FFA23D'); g.addColorStop(1, '#E2471B'); }
    else { g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.6, '#F1F4FA'); g.addColorStop(1, '#B9C2D6'); }
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }
  drawHud(ctx, cs, W, H) {
    const th = this.theme, bw = W - cs * 3, bx = cs * 1.5, by = cs * 0.38, bh = cs * 0.26;
    // 단계 진행 막대: 양 끝에 지금 단계 · 다음 단계
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; FX.rr(ctx, bx, by, bw, bh, bh / 2); ctx.fill();
    const k = Math.min(1, this.passed / this.total);
    if (k > 0) { ctx.fillStyle = th.p; FX.rr(ctx, bx, by, Math.max(bh, bw * k), bh, bh / 2); ctx.fill(); }
    const dot = (x, n, on) => { ctx.fillStyle = on ? th.p : 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(x, by + bh / 2, cs * 0.42, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
      FX.text(ctx, String(n), x, by + bh / 2 + cs * 0.01, { size: cs * 0.4, weight: 900, color: on ? '#10162E' : '#fff', align: 'center', baseline: 'middle' }); };
    dot(bx - cs * 0.6, this.level, true); dot(bx + bw + cs * 0.6, this.level + 1, this.clearT > 0);
    FX.text(ctx, String(this.score), W / 2, cs * 1.55, { size: cs * 0.75, weight: 900, color: '#fff', align: 'center', stroke: 'rgba(0,0,0,.35)' });
    if (this.fire) FX.text(ctx, '불꽃!', W / 2, cs * 2.15, { size: cs * 0.36, weight: 800, color: '#FFB15A', align: 'center' });
    // 처음 안내
    if (this.introT > 0 && !this.gameOver) { ctx.globalAlpha = Math.min(1, this.introT);
      FX.glass(ctx, cs * 0.8, H * 0.62, W - cs * 1.6, cs * 1.7, cs * 0.35);
      FX.text(ctx, '좌우로 끌어서 탑 돌리기', W / 2, H * 0.62 + cs * 0.72, { size: cs * 0.44, weight: 800, color: '#fff', align: 'center' });
      FX.text(ctx, '틈으로 떨어지고 빨간 조각은 피해요', W / 2, H * 0.62 + cs * 1.3, { size: cs * 0.32, weight: 700, color: '#FFD9E0', align: 'center' });
      ctx.globalAlpha = 1; }
    if (this.clearT > 0) FX.text(ctx, '단계 ' + this.level + ' 완료!', W / 2, H * 0.3, { size: cs * 0.8, weight: 900, color: '#7CFFB2', align: 'center', stroke: 'rgba(0,30,10,.7)' });
    if (this.gameOver) { ctx.fillStyle = 'rgba(8,10,24,.66)'; ctx.fillRect(0, 0, W, H);
      FX.text(ctx, '빨간 조각에 닿았어요', W / 2, H * 0.42, { size: cs * 0.62, weight: 900, color: '#fff', align: 'center' });
      FX.text(ctx, this.score + '점 · ' + this.level + '단계 · ' + this.floorsPassed + '층', W / 2, H * 0.42 + cs * 0.85, { size: cs * 0.42, weight: 700, color: '#FFD166', align: 'center' }); }
  }
}
if (typeof window !== 'undefined') window.HelixGame = HelixGame;
